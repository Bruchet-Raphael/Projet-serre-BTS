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
  // Cherche d'abord dans le cookie HttpOnly accessToken
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  // Sinon cherche dans l'header Authorization (pour compatibilité)
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

const revokedTokens = new Set();
const refreshTokens = new Map(); // Stockage des refresh tokens: refreshTokenId -> { userId, jti, expiresAt }

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
  
  // Vérifier si le token n'a pas expiré
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

app.post('/api/login', (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ success: false, message: 'Login et mot de passe requis' });
  }

  const query = 'SELECT * FROM Utilisateur WHERE login = ?';
  db.query(query, [login], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
    if (results.length === 0) return res.status(401).json({ success: false, message: 'Utilisateur inexistant' });

    const user = results[0];
    bcrypt.compare(password, user.mdp, (err, isMatch) => {
      if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
      if (!isMatch) return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });

      const jti = uuidv4();
      const userId = user.Id || user.id || user.ID;
      
      // Access Token (15 minutes)
      const accessPayload = { sub: userId, login: user.Login, jti, type: 'accessToken' };
      const accessToken = jwt.sign(accessPayload, JWT_SECRET, { expiresIn: '15m' });

      // Refresh Token (7 jours)
      const refreshTokenId = uuidv4();
      const refreshPayload = { sub: userId, refreshTokenId, type: 'refreshToken' };
      const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, { expiresIn: '7d' });

      // Stocker le refresh token
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
      storeRefreshToken(refreshTokenId, userId, jti, expiresAt);

      // Envoyer les tokens dans des cookies HttpOnly
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: false, // false pour développement HTTP, true pour HTTPS production
        sameSite: 'Lax',
        maxAge: 15 * 60 * 1000 // 15 minutes en millisecondes
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false, // false pour développement HTTP, true pour HTTPS production
        sameSite: 'Lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours en millisecondes
      });

      return res.json({ success: true, message: 'Connexion réussie', role: user.role || 'user' });
    });
  });
});

app.post('/api/inscription', (req, res) => {
  const { prenom, nom, email, username, password } = req.body;
  if (!prenom || !nom || !email || !username || !password) {
    return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
  }

  const checkQuery = 'SELECT * FROM Utilisateur WHERE Login = ? OR Mail = ?';
  db.query(checkQuery, [username, email], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
    if (results.length > 0) return res.status(409).json({ success: false, message: 'Utilisateur ou email déjà utilisé' });

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });

      const insertQuery = 'INSERT INTO Utilisateur (nom, prenom, mail, login, mdp) VALUES (?, ?, ?, ?, ?)';
      db.query(insertQuery, [nom, prenom, email, username, hashedPassword], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });

        const userId = results.insertId;
        const jti = uuidv4();

        // Access Token (15 minutes)
        const accessPayload = { sub: userId, login: username, jti, type: 'accessToken' };
        const accessToken = jwt.sign(accessPayload, JWT_SECRET, { expiresIn: '15m' });

        // Refresh Token (7 jours)
        const refreshTokenId = uuidv4();
        const refreshPayload = { sub: userId, refreshTokenId, type: 'refreshToken' };
        const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, { expiresIn: '7d' });

        // Stocker le refresh token
        const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
        storeRefreshToken(refreshTokenId, userId, jti, expiresAt);

        // Envoyer les tokens dans des cookies HttpOnly
        res.cookie('accessToken', accessToken, {
          httpOnly: true,
          secure: false, // false pour développement HTTP, true pour HTTPS production
          sameSite: 'Lax',
          maxAge: 15 * 60 * 1000 // 15 minutes en millisecondes
        });

        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: false, // false pour développement HTTP, true pour HTTPS production
          sameSite: 'Lax',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours en millisecondes
        });

        return res.json({ success: true, message: 'Inscription réussie' });
      });
    });
  });
});

// POST - Logout (Déconnexion)
app.post('/api/logout', authMiddleware, (req, res) => {
  const jti = req.user?.jti;
  
  if (jti) {
    // Révoquer le token en ajoutant son jti à la liste des tokens révoqués
    revokeToken(jti);
  }

  // Supprimer les cookies
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: false, // false pour développement HTTP, true pour HTTPS production
    sameSite: 'Lax'
  });
  
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: false, // false pour développement HTTP, true pour HTTPS production
    sameSite: 'Lax'
  });

  return res.json({ success: true, message: 'Déconnexion réussie' });
});

// POST - Refresh Token (Obtenir un nouveau access token)
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

    // Générer un nouvel access token
    const userId = payload.sub;
    const jti = uuidv4();
    const newAccessPayload = { sub: userId, jti, type: 'accessToken' };
    const newAccessToken = jwt.sign(newAccessPayload, JWT_SECRET, { expiresIn: '15m' });

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: false, // false pour développement HTTP, true pour HTTPS production
      sameSite: 'Lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
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

// --- [AJOUT ETUDIANT 2] Variables d'écoute de l'IHM et des capteurs ---
let modeArrosageGlobal = 'inactive'; 
let seuilArrosageGlobal = 30; // Valeur du curseur (en %)
let humiditeSolGlobale = 50;  // Humidité de la terre lue par le TCW241
// ----------------------------------------------------------------------

// Supervision automatique en arrière-plan
async function startWaterSupervision() {
  try {
    await poseidon.connect();
    
    // Boucle infinie toutes les 2 secondes
setInterval(async () => {
      try {
          // 1. Lire les capteurs
          await poseidon.updateAll();
          
          // 2. Exécuter l'algorithme Réseau
          await poseidon.gererChoixReseau();
          
          // --- L'INTELLIGENCE DU PILOTAGE IHM (Manuel & Auto) ---
          let besoinEau = false; // Par défaut, pas besoin d'eau

          if (modeArrosageGlobal === 'active') {
              besoinEau = true;
          } 
          else if (modeArrosageGlobal === 'auto') {
              if (humiditeSolGlobale < seuilArrosageGlobal) {
                  besoinEau = true;
              }
          }
          
          // On envoie la décision à la sécurité matérielle
          await poseidon.gererPompe(besoinEau);
      } catch (errLoop) {
          console.error("Erreur de communication avec le Poseidon :", errLoop.message);
          // C'est ici qu'on mettra plus tard la sécurité "pompe à OFF si perte réseau"
      }
    }, 2000);
    
    console.log("💧 Supervision Poseidon démarrée");
  } catch (err) {
    console.error("Erreur Supervision Poseidon:", err.message);
  }
}
startWaterSupervision(); // Lancement au démarrage


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

        // --- [AJOUT ETUDIANT 2] On intercepte l'humidité du sol pour le mode Auto ---
        if (tcw.humiditeMoyenne !== null) {
            humiditeSolGlobale = tcw.humiditeMoyenne;
        }
        // ----------------------------------------------------------------------------

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
        humidite_moyenne,
        humidite_air,
        timestamp
      FROM capteurs
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY timestamp ASC
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
    const tcwData = await getTCWData();

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

// GET - Récupérer le rôle de l'utilisateur connecté
app.get('/api/user-role', authMiddleware, (req, res) => {
  const userId = req.user.sub;

  const query = 'SELECT role FROM Utilisateur WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    res.json({ 
      success: true, 
      role: results[0].role || 'user' 
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

                // --- [AJOUT ETUDIANT 2] On intercepte l'humidité du sol pour le mode Auto ---
                if (tcw.humiditeMoyenne !== null) {
                    humiditeSolGlobale = tcw.humiditeMoyenne;
                }
                // ----------------------------------------------------------------------------

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
            INSERT INTO capteurs (temperature, h1, h2, h3, humidite_moyenne ,humidite_air , timestamp)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `;

        db.query(sql, [
            tcw.temperature,
            tcw.h1,
            tcw.h2,
            tcw.h3,
            tcw.humiditeMoyenne,
            tcw.humair
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

            // Lecture capteurs
            const data = await tcw.getAll(client);

            // Lecture consigne BDD
            db.query("SELECT temperature, humidite_moyenne, humidite_air, relai_0, relai_1, relai_2, relai_3 FROM Consigne LIMIT 1", async (err, rows) => {
    if (err || rows.length === 0) {
        console.error('Erreur lecture consigne :', err);
        socket.end();
        return;
    }

    const consigne = {
        temperature: rows[0].temperature,
        humidite: rows[0].humidite_moyenne,
        humiditeair: rows[0].humidite_air,
        relay0: rows[0].relai_0,
        relay1: rows[0].relai_1,
        relay2: rows[0].relai_2,
        relay3: rows[0].relai_3
    };

    console.log('Consigne utilisée :', consigne);

    await tcw.regulate(client, consigne);

    socket.end();
});


        } catch (err) {
            socket.end();
        }
    });
}

// ========================================
// 🔐 Admin Middleware
// ========================================

function isAdminMiddleware(req, res, next) {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Utilisateur non authentifié' });
  }

  const query = 'SELECT role FROM Utilisateur WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(403).json({ success: false, message: 'Utilisateur introuvable' });
    }

    const user = results[0];
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Accès refusé : privilèges admin requis' });
    }

    next();
  });
}

// ========================================
// 🎛️ ROUTES CONTRÔLES (Ventilation, Chauffage, etc.)
// ========================================

// GET - Récupérer les derniers contrôles appliqués
app.get('/api/controles', authMiddleware, (req, res) => {
  const query = `
    SELECT id, irrigation_mode, irrigation_threshold, 
           misting_mode, misting_intensity,
           ventilation_mode, ventilation_duration,
           heating_mode, heating_target,
           created_at
    FROM controles
    ORDER BY created_at DESC
    LIMIT 1
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    if (results.length === 0) {
      return res.json({ success: true, controles: null, message: 'Aucun contrôle enregistré' });
    }

    res.json({ success: true, controles: results[0] });
  });
});

// POST - Applique et sauvegarde les contrôles (Admin uniquement)
app.post('/api/controles', authMiddleware, isAdminMiddleware, (req, res) => {
  const { irrigation, misting, ventilation, heating } = req.body;

  // Validation des données
  if (!irrigation || !misting || !ventilation || !heating) {
    return res.status(400).json({ success: false, message: 'Paramètres incomplets' });
  }

  // --- [AJOUT ETUDIANT 2] On capture l'état et le seuil pour le Poseidon ---
  modeArrosageGlobal = irrigation.mode;
  seuilArrosageGlobal = irrigation.threshold || 30; // 30 par défaut si non fourni
  // -------------------------------------------------------------------------

  // Règle métier : Si ventilation est "active", chauffage ne peut pas être "active"
  if (ventilation.mode === 'active' && heating.mode === 'active') {
    return res.status(400).json({ 
      success: false, 
      message: 'Le chauffage ne peut pas être actif si la ventilation est active' 
    });
  }

  // Durée de ventilation : seulement si mode = 'active', max 6h
  if (ventilation.mode === 'active' && (!ventilation.duration || ventilation.duration > 6 || ventilation.duration < 1)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Durée ventilation invalide (1-6h)' 
    });
  }

  const query = `
    INSERT INTO controles 
    (irrigation_mode, irrigation_threshold, 
     misting_mode, misting_intensity,
     ventilation_mode, ventilation_duration,
     heating_mode, heating_target,
     created_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
  `;

  const values = [
    irrigation.mode,
    irrigation.threshold || null,
    misting.mode,
    misting.intensity || null,
    ventilation.mode,
    ventilation.duration || null,
    heating.mode,
    heating.target || null,
    req.user.sub
  ];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Erreur insert controles:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    res.json({ 
      success: true, 
      message: 'Contrôles appliqués et sauvegardés',
      controleId: results.insertId
    });
  });
});

// ========================================
// 🔧 ROUTES ADMIN
// ========================================

// GET - Liste de tous les utilisateurs (Admin uniquement)
app.get('/api/admin/users', authMiddleware, isAdminMiddleware, (req, res) => {
  const query = 'SELECT id, login, mail, role FROM Utilisateur ORDER BY login ASC';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Erreur récupération utilisateurs:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    res.json({ 
      success: true, 
      users: results,
      count: results.length
    });
  });
});

// GET - Récupérer l'historique des actions (Admin uniquement)
app.get('/api/admin/logs', authMiddleware, isAdminMiddleware, (req, res) => {
  const query = `
    SELECT 
      id, 
      user_id, 
      action, 
      details, 
      timestamp 
    FROM AuditLog 
    ORDER BY timestamp DESC 
    LIMIT 500`;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Erreur récupération logs:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    res.json({ 
      success: true, 
      logs: results || [],
      count: results ? results.length : 0
    });
  });
});

// PUT - Modifier le rôle d'un utilisateur (Admin uniquement)
app.put('/api/admin/users/:userId/role', authMiddleware, isAdminMiddleware, (req, res) => {
  const { userId } = req.params;
  const { newRole } = req.body;

  if (!newRole || !['admin', 'user'].includes(newRole)) {
    return res.status(400).json({ success: false, message: 'Rôle invalide' });
  }

  const query = 'UPDATE Utilisateur SET role = ? WHERE id = ?';
  db.query(query, [newRole, userId], (err, results) => {
    if (err) {
      console.error('Erreur mise à jour rôle:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    res.json({ success: true, message: 'Rôle mis à jour avec succès' });
  });
});

app.get('/status', async (req, res) => {
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