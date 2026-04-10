const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Modbus = require('jsmodbus');
const net = require('net');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const axios = require('axios');

const fs = require('fs');

// --- Import de la classe Poseidon ---
const IOPoseidon = require('./IOPoseidon');
// --- Import de la classe TCW241   ---
const TCW241 = require('./TCW241.js');

dotenv.config();

const app = express();

// ✅ CORS configuré pour permettre credentials (cookies)
app.use(cors({
  origin: 'http://172.29.160.160', // Autoriser les requêtes du frontend
  credentials: true // Permettre aux cookies d'être envoyés
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const PORT = process.env.PORT;
const JWT_SECRET = process.env.CODE;

// ========================================
// 📄 FICHIER DE CONFIGURATION (Régulation)
// ========================================
const configFile = path.join(__dirname, 'config_regulation.json');

// Si le fichier n'existe pas, on le crée avec des valeurs par défaut
if (!fs.existsSync(configFile)) {
    const defaultConfig = {
        temperature: 28.5,
        humidite: 40.0,
        humiditeair: 100.0,
        relay0: null,
        relay1: null,
        relay2: null,
        relay3: null
    };
    fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 4));
    console.log("📄 Fichier config_regulation.json créé avec succès !");
}

// ========================================
// 🌊 VARIABLES GLOBALES (IHM & Capteurs)
// ========================================
let modeArrosageGlobal = 'inactive'; 
let seuilArrosageGlobal = 30; 
let humiditeSolGlobale = 50;

// ========================================
// 📄 FICHIER DE CONFIGURATION (Contrôles IHM)
// ========================================
const controlesFile = path.join(__dirname, 'controles.json');

if (!fs.existsSync(controlesFile)) {
    const defaultControles = {
        irrigation: { mode: 'inactive', threshold: 30 },
        misting: { mode: 'inactive', intensity: 50 },
        ventilation: { mode: 'inactive', duration: 3 },
        heating: { mode: 'inactive', target: 20 }
    };
    fs.writeFileSync(controlesFile, JSON.stringify(defaultControles, null, 4));
    console.log("📄 Fichier controles.json créé avec succès !");
} else {
    // Si le fichier existe au démarrage, on recharge les variables globales pour la pompe !
    const saved = JSON.parse(fs.readFileSync(controlesFile, 'utf8'));
    modeArrosageGlobal = saved.irrigation.mode;
    seuilArrosageGlobal = saved.irrigation.threshold;
}

// ========================================
// 🛡️ CONSTANTES RÔLES
// ========================================
const ROLES = {
  ADMIN: '1',
  USER: '0'
};

// ========================================
// 🔌 Connexion MySQL
// ========================================

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect(err => {
  if (err) {
    console.error('Erreur de connexion MySQL :', err.message);
  } else {
    console.log('Connecté à la base de données MySQL');
  }
});

// ========================================
// 🔐 JWT Middleware
// ========================================

function extractToken(req) {
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

const revokedTokens = new Set();
const refreshTokens = new Map(); 

function revokeToken(jti) { 
  revokedTokens.add(jti); 
}

function isRevoked(jti) { 
  return revokedTokens.has(jti); 
}

function storeRefreshToken(refreshTokenId, userId, jti, expiresAt) {
  refreshTokens.set(refreshTokenId, { userId, jti, expiresAt });
}

function revokeRefreshToken(refreshTokenId) {
  refreshTokens.delete(refreshTokenId);
}

function isValidRefreshToken(refreshTokenId) {
  const token = refreshTokens.get(refreshTokenId);
  if (!token) return false;
  
  if (token.expiresAt < Date.now()) {
    refreshTokens.delete(refreshTokenId);
    return false;
  }
  return true;
}

function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Token manquant' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (isRevoked(payload.jti)) {
      return res.status(401).json({ success: false, message: 'Token révoqué' });
    }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
  }
}

// ========================================
// 🔐 Routes LOGIN / INSCRIPTION
// ========================================

app.get('/api/verify-connection', (req, res) => {
  const token = extractToken(req);
  
  if (!token) {
    return res.json({ success: true, authenticated: false, message: 'Pas de token trouvé' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (isRevoked(payload.jti)) {
      return res.json({ success: true, authenticated: false, message: 'Token révoqué' });
    }

    res.json({ 
      success: true, 
      authenticated: true, 
      user: {
        id: payload.sub,
        login: payload.login,
        role: payload.role || 'user'
      },
      message: 'Connexion vérifiée'
    });
  } catch (err) {
    return res.json({ success: true, authenticated: false, message: 'Token invalide ou expiré' });
  }
});

app.post('/api/login', (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ success: false, message: 'Login et mot de passe requis' });
  }

  const query = 'SELECT * FROM User WHERE login = ?';
  db.query(query, [login], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
    if (results.length === 0) return res.status(401).json({ success: false, message: 'User inexistant' });

    const user = results[0];
    bcrypt.compare(password, user.mdp, (err, isMatch) => {
      if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
      if (!isMatch) return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });

      const jti = uuidv4();
      const userId = user.Id || user.id || user.ID;
      const userRole = (user.role || ROLES.USER).toString().toLowerCase().trim();

      const accessPayload = { sub: userId, login: user.Login, role: userRole, jti, type: 'accessToken' };
      const accessToken = jwt.sign(accessPayload, JWT_SECRET, { expiresIn: '15m' });

      const refreshTokenId = uuidv4();
      const refreshPayload = { sub: userId, refreshTokenId, type: 'refreshToken' };
      const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, { expiresIn: '7d' });

      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
      storeRefreshToken(refreshTokenId, userId, jti, expiresAt);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: false, 
        sameSite: 'Lax',
        maxAge: 15 * 60 * 1000 
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false, 
        sameSite: 'Lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 
      });

      return res.json({ success: true, message: 'Connexion réussie', role: userRole });
    });
  });
});

app.post('/api/inscription', (req, res) => {
  const { prenom, nom, email, username, password } = req.body;
  if (!prenom || !nom || !email || !username || !password) {
    return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
  }

  const checkQuery = 'SELECT * FROM User WHERE login = ? OR mail = ?';
  db.query(checkQuery, [username, email], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
    if (results.length > 0) return res.status(409).json({ success: false, message: 'User ou email déjà utilisé' });

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });

      const insertQuery = 'INSERT INTO User (nom, prenom, mail, login, mdp, role) VALUES (?, ?, ?, ?, ?, ?)';
      db.query(insertQuery, [nom, prenom, email, username, hashedPassword, ROLES.USER], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });

        const userId = results.insertId;
        const jti = uuidv4();

        const accessPayload = { sub: userId, login: username, role: ROLES.USER, jti, type: 'accessToken' };
        const accessToken = jwt.sign(accessPayload, JWT_SECRET, { expiresIn: '15m' });

        const refreshTokenId = uuidv4();
        const refreshPayload = { sub: userId, refreshTokenId, type: 'refreshToken' };
        const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, { expiresIn: '7d' });

        const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
        storeRefreshToken(refreshTokenId, userId, jti, expiresAt);

        res.cookie('accessToken', accessToken, {
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
          maxAge: 15 * 60 * 1000
        });

        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
          maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.json({ success: true, message: 'Inscription réussie' });
      });
    });
  });
});

app.post('/api/logout', authMiddleware, (req, res) => {
  const jti = req.user?.jti;
  
  if (jti) {
    revokeToken(jti);
  }

  res.clearCookie('accessToken', { httpOnly: true, secure: false, sameSite: 'Lax' });
  res.clearCookie('refreshToken', { httpOnly: true, secure: false, sameSite: 'Lax' });

  return res.json({ success: true, message: 'Déconnexion réussie' });
});

app.post('/api/refresh-token', (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: 'Refresh token manquant' });
  }

  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    
    if (payload.type !== 'refreshToken') {
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }

    const refreshTokenId = payload.refreshTokenId;
    if (!isValidRefreshToken(refreshTokenId)) {
      return res.status(401).json({ success: false, message: 'Refresh token invalide ou expiré' });
    }

    const userId = payload.sub;
    const jti = uuidv4();
    const newAccessPayload = { sub: userId, jti, type: 'accessToken' };
    const newAccessToken = jwt.sign(newAccessPayload, JWT_SECRET, { expiresIn: '15m' });

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: false, 
      sameSite: 'Lax',
      maxAge: 15 * 60 * 1000
    });

    return res.json({ success: true, message: 'Access token rafraîchi' });

  } catch (err) {
    return res.status(401).json({ success: false, message: 'Erreur lors du rafraîchissement du token' });
  }
})

// ========================================
// 🌊 GESTION POSEIDON (ETUDIANT 2)
// ========================================

const poseidon = new IOPoseidon('172.29.254.100'); // IP Simulateur

async function startWaterSupervision() {
  try {
    await poseidon.connect();
    
    setInterval(async () => {
      try {
          await poseidon.updateAll();
          await poseidon.gererChoixReseau(); 
          
          let besoinEau = false; 

          if (modeArrosageGlobal === 'active') {
              besoinEau = true; 
          } 
          else if (modeArrosageGlobal === 'auto') {
              if (humiditeSolGlobale < seuilArrosageGlobal) {
                  besoinEau = true; 
              }
          }
          
          await poseidon.gererPompe(besoinEau);
          
      } catch (errLoop) {
          console.error("Erreur Poseidon :", errLoop.message);
      }
    }, 2000);
    
    console.log("💧 Supervision Poseidon démarrée");
  } catch (err) {
    console.error("Erreur Supervision Poseidon:", err.message);
  }
}
startWaterSupervision(); 

// ========================================
// 🌡️ GESTION TCW241 (ETUDIANT 1)
// ========================================

async function getTCWData() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const client = new Modbus.client.TCP(socket);

    socket.connect({ host: process.env.serverIP, port: process.env.portMod });

    socket.on('connect', async () => {
      try {
        const tcw = new TCW241();

        const temp = await tcw.getTemp(client);
        const h1 = await tcw.getH1(client);
        const h2 = await tcw.getH2(client);
        const h3 = await tcw.getH3(client);
        const humair = await tcw.getHumAir(client);
        const relays = await tcw.getRelaysState(client);

        tcw.setTemperature(temp);
        tcw.setHumidites(h1, h2, h3);
        tcw.setHumAir(humair);

        if (tcw.humiditeMoyenne !== null) {
            humiditeSolGlobale = tcw.humiditeMoyenne;
        }

        socket.end();

        resolve({
          temperature: tcw.temperature,
          h1: tcw.h1,
          h2: tcw.h2,
          h3: tcw.h3,
          humiditeSol: tcw.humiditeMoyenne,
          humair : tcw.humair,
          relays,
          timestamp: tcw.timestamp
        });

      } catch (err) {
        socket.end();
        resolve({
          temperature: null,
          h1: null,
          h2: null,
          h3: null,
          humiditeSol: null,
          humair: null,
          relays: null
        });
      }
    });

    socket.on('error', () => {
      resolve({
        temperature: null,
        h1: null,
        h2: null,
        h3: null,
        humiditeSol: null,
        relays: null
      });
    });
  });
}

// ========================================
// 🌍 EXPRESS STATIC
// ========================================

app.use(express.static('/var/www/html/Serre'));

app.get('/', (req, res) => {
    res.sendFile(path.join('/var/www/html/Serre/front', 'index.html'));
});

// ========================================
// 🚀 ROUTE API UNIFIÉE
// ========================================

app.get('/api/historique-24h', authMiddleware, (req, res) => {
  try {
    const sql = `
      SELECT
          id,
          temperature,
          h1,
          h2,
          h3,
          humidite_sol,
          humidite_air,
          conso_total,
          conso_pluie,
          date
      FROM Capteur
      WHERE date >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY date ASC
      `;

    db.query(sql, (err, results) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }

      const historique = results.map(row => ({
        timestamp: new Date(row.timestamp).toLocaleTimeString('fr-FR'),
        temperature: parseFloat(row.temperature),
        h1: parseFloat(row.h1),
        h2: parseFloat(row.h2),
        h3: parseFloat(row.h3),
        humiditeMoyenne: parseFloat(row.humidite_moyenne),
        humAir: parseFloat(row.humidite_air)
      }));

      res.json({
        success: true,
        data: historique,
        count: historique.length
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/info', authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(process.env.TARGET_URL, {
      timeout: 5000,
      responseType: 'json',
      auth: { username: process.env.US, password: process.env.PSW }
    });

    const monitor = response.data?.Monitor || {};
    const tcwData = TCW241.fromMonitor(monitor);

    TCW241.store.push(tcwData);

    const waterData = {
        consoEau: poseidon.getConsommationLitres(),
        cuvePleine: poseidon.isCuvePleine(),
        tempExt: poseidon.getTemperature(),
        reseauPluie: (poseidon.getTemperature() >= 1 && poseidon.isCuvePleine())
    };

    res.json({ 
        success: true, 
        ...tcwData, 
        ...waterData 
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/user-role', authMiddleware, (req, res) => {
  const tokenRole = req.user?.role;
  const userId = req.user.sub;

  if (tokenRole) {
    return res.json({ success: true, role: tokenRole });
  }

  const query = 'SELECT role FROM User WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'User introuvable' });
    }

    const dbRole = (results[0].role || ROLES.USER).toString().toLowerCase().trim();
    res.json({ success: true, role: dbRole });
  });
}); 

app.get('/api/check-auth', authMiddleware, (req, res) => {
  const userId = req.user.sub;
  const query = 'SELECT id, login, mail, role FROM User WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'User introuvable' });
    }

    const user = results[0];
    const userRole = (user.role || 'user').toString().toLowerCase().trim();

    res.json({ 
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        login: user.login,
        email: user.mail,
        role: userRole
      }
    });
  });
});

async function readTCW241() {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        const client = new Modbus.client.TCP(socket);

        socket.connect({ host: process.env.serverIP, port: process.env.portMod });

        socket.on('connect', async () => {
            try {
                const tcw = new TCW241();

                const temp = await tcw.getTemp(client);
                const h1 = await tcw.getH1(client);
                const h2 = await tcw.getH2(client);
                const h3 = await tcw.getH3(client);
                const humair = await tcw.getHumAir(client);

                tcw.setTemperature(temp);
                tcw.setHumidites(h1, h2, h3);
                tcw.setHumAir(humair);

                if (tcw.humiditeMoyenne !== null) {
                    humiditeSolGlobale = tcw.humiditeMoyenne;
                }

                socket.end();
                resolve(tcw);

            } catch (err) {
                socket.end();
                reject(err);
            }
        });

        socket.on('error', reject);
    });
}

async function saveLoop() {
    try {
        const tcw = await readTCW241();

        const sql = `
                INSERT INTO Capteur (conso_pluie, h1, h2, h3, humidite_air, humidite_sol, temperature, conso_total, date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
              `;

        db.query(sql, [
            tcw.conso_pluie,
            tcw.h1,
            tcw.h2,
            tcw.h3,
            tcw.humair,
            tcw.humiditeMoyenne,
            tcw.temperature,
            tcw.conso_total,
        ]);

    } catch (err) {
        console.error("Erreur boucle BDD :", err.message);
    }
}

app.post('/api/relais/:numRelais', authMiddleware, async (req, res) => {
  const num = parseInt(req.params.numRelais, 10);

  if (![1, 2, 3, 4].includes(num)) {
    return res.status(400).json({ success: false, message: "Relais invalide (1 à 4)" });
  }

  const socket = new net.Socket();
  const client = new Modbus.client.TCP(socket);

  socket.connect({ host: process.env.serverIP, port: process.env.portMod });

  socket.on('connect', async () => {
    try {
      const tcw = new TCW241();

      if (num === 1) await tcw.setRelay1(client);
      if (num === 2) await tcw.setRelay2(client);
      if (num === 3) await tcw.setRelay3(client);
      if (num === 4) await tcw.setRelay4(client);

      const relays = await tcw.getRelaysState(client);

      socket.end();
      res.json({ success: true, relays });

    } catch (err) {
      socket.end();
      res.status(500).json({ success: false, error: err.message });
    }
  });

  socket.on('error', err => {
    res.status(500).json({ success: false, error: err.message });
  });
});

async function regulateLoop() {
    const socket = new net.Socket();
    const client = new Modbus.client.TCP(socket);

    socket.connect({ host: process.env.serverIP, port: process.env.portMod });

    socket.on('connect', async () => {
        try {
            const tcw = new TCW241();
            const data = await tcw.getAll(client);

            fs.readFile(configFile, 'utf8', async (err, fileData) => {
                if (err) {
                    console.error('Erreur de lecture du fichier de config :', err);
                    socket.end();
                    return;
                }

                try {
                    const consigne = JSON.parse(fileData);
                    await tcw.regulate(client, consigne);
                    socket.end();
                } catch (parseErr) {
                    console.error('Erreur de format dans config_regulation.json :', parseErr);
                    socket.end();
                }
            });

        } catch (err) { 
            socket.end();
        }
    });
}

function isAdminMiddleware(req, res, next) {
  const userId = req.user?.sub;
  const tokenRole = req.user?.role;

  if (tokenRole === ROLES.ADMIN) {
    return next();
  }

  if (!userId) {
    return res.status(401).json({ success: false, message: 'User non authentifié' });
  }

  const query = 'SELECT role FROM User WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(403).json({ success: false, message: 'User introuvable' });
    }

    const user = results[0];
    const dbRole = (user.role || "").toString().toLowerCase().trim();
    
    if (dbRole !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Accès refusé : privilèges admin requis' });
    }

    next();
  });
}

function isUserMiddleware(req, res, next) {
  next();
}

// ========================================
// 🎛️ ROUTES CONTRÔLES (JSON) - CORRIGÉES
// ========================================

// GET - Récupérer les derniers contrôles appliqués depuis le JSON
app.get('/api/controles', authMiddleware, (req, res) => {
  fs.readFile(controlesFile, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Erreur lecture fichier controles' });
    }

    try {
      const config = JSON.parse(data);
      // On aplatit les données pour respecter le format attendu par ton front-end
      const controlesPlats = {
        irrigation_mode: config.irrigation.mode,
        irrigation_threshold: config.irrigation.threshold,
        misting_mode: config.misting.mode,
        misting_intensity: config.misting.intensity,
        ventilation_mode: config.ventilation.mode,
        ventilation_duration: config.ventilation.duration,
        heating_mode: config.heating.mode,
        heating_target: config.heating.target
      };
      
      res.json({ success: true, controles: controlesPlats });
    } catch (e) {
      res.status(500).json({ success: false, message: 'Erreur format json' });
    }
  });
});

// POST - Applique et sauvegarde les contrôles dans le JSON
app.post('/api/controles', authMiddleware, (req, res) => {
  const { irrigation, misting, ventilation, heating } = req.body;

  if (!irrigation || !misting || !ventilation || !heating) {
    return res.status(400).json({ success: false, message: 'Paramètres incomplets' });
  }

  // --- [AJOUT ETUDIANT 2] On capture l'état et le seuil pour le Poseidon ---
  modeArrosageGlobal = irrigation.mode;
  seuilArrosageGlobal = irrigation.threshold || 30;
  console.log(`[IHM] Arrosage -> Mode: ${modeArrosageGlobal}, Seuil: ${seuilArrosageGlobal}%`);
  // -------------------------------------------------------------------------

  if (ventilation.mode === 'active' && heating.mode === 'active') {
    return res.status(400).json({ 
      success: false, 
      message: 'Le chauffage ne peut pas être actif si la ventilation est active' 
    });
  }

  if (ventilation.mode === 'active' && (!ventilation.duration || ventilation.duration > 6 || ventilation.duration < 1)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Durée ventilation invalide (1-6h)' 
    });
  }

  // On prépare l'objet complet
  const nouveauxControles = { irrigation, misting, ventilation, heating };

  // On écrit dans le fichier JSON (plus de base de données SQL ici !)
  fs.writeFile(controlesFile, JSON.stringify(nouveauxControles, null, 4), (err) => {
    if (err) {
      console.error('Erreur écriture controles.json:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur lors de la sauvegarde' });
    }
    
    res.json({ 
      success: true, 
      message: 'Contrôles appliqués et sauvegardés'
    });
  });
});

// ========================================
// 🔧 ROUTES ADMIN
// ========================================

app.get('/api/admin/users', authMiddleware, (req, res) => {
  const query = 'SELECT id, login, mail, role FROM User ORDER BY login ASC';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Erreur récupération Users:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
    res.json({ success: true, users: results, count: results.length });
  });
});

app.put('/api/admin/users/:userId/role', authMiddleware, (req, res) => {
  const { userId } = req.params;
  const { newRole } = req.body;

  if (!newRole || !['admin', 'user'].includes(newRole)) {
    return res.status(400).json({ success: false, message: 'Rôle invalide' });
  }

  const query = 'UPDATE User SET role = ? WHERE id = ?';
  db.query(query, [newRole, userId], (err, results) => {
    if (err) {
      console.error('Erreur mise à jour rôle:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User non trouvé' });
    }
    res.json({ success: true, message: 'Rôle mis à jour avec succès' });
  });
});

app.get('/status', authMiddleware,async (req, res) => {
  try {
    const response = await axios.get(process.env.TARGET_URL, {
      timeout: 5000,
      responseType: 'json',
      auth: { username: process.env.US, password: process.env.PSW }
    });

    const monitor = response.data?.Monitor || {};
    const sensorData = TCW241.fromMonitor(monitor);

    TCW241.store.push(sensorData);

    console.log('SensorData:', sensorData);

    res.status(200).json({
      success: true,
      source: process.env.TARGET_URL,
      data: sensorData
    });
  } catch (error) {
    console.error('Erreur requête:', error.message);
    res.status(502).json({
      success: false,
      message: "Impossible de récupérer status.json",
      error: error.message
    });
  }
});

setInterval(regulateLoop, 10000);
setInterval(saveLoop, 10000);

// =======================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});