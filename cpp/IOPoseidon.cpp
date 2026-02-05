#include "IOPoseidon.h"
#include <iostream>
#include <errno.h> // Pour afficher les erreurs précises

using namespace std;

// Constructeur : On prépare la connexion
IOPoseidon::IOPoseidon(string ip, int p) {
    this->ipAddress = ip;
    this->port = p;
    this->connected = false;

    // Création de l'instance Modbus TCP
    // c_str() convertit le string C++ en string C standard pour la librairie
    mb = modbus_new_tcp(ipAddress.c_str(), port);

    // IMPORTANT : On définit l'ID de l'esclave (2 pour Poseidon, souvent 1 ou 255 pour simu)
    // D'après tes tests Hercule, tu utilisais l'ID 2
    modbus_set_slave(mb, 2);
}

// Destructeur : On nettoie la mémoire
IOPoseidon::~IOPoseidon() {
    modbus_free(mb);
}

// Connexion au boîtier
bool IOPoseidon::connecter() {
    if (modbus_connect(mb) == -1) {
        cerr << "❌ Erreur de connexion : " << modbus_strerror(errno) << endl;
        connected = false;
        return false;
    }
    cout << "✅ Connecté au Poseidon sur " << ipAddress << endl;
    connected = true;
    return true;
}

void IOPoseidon::deconnecter() {
    modbus_close(mb);
    connected = false;
}

// Lecture de TOUS les capteurs en une fois
// C'est ici qu'on traduit tes tests Hercule en C++
bool IOPoseidon::updateAll() {
    if (!connected) return false;

    uint16_t tab_reg[10]; // Tableau pour stocker les résultats temporaires
    uint8_t tab_bits[10]; // Tableau pour les bits (0 ou 1)

    // 1. Lire la Température (Input Register - Fonction 04)
    // On lit 1 registre à l'adresse ADRESSE_TEMP_EXT
    int rc = modbus_read_input_registers(mb, ADRESSE_TEMP_EXT, 1, tab_reg);
    if (rc == -1) {
        cerr << "Erreur lecture Temp: " << modbus_strerror(errno) << endl;
        return false;
    }
    // Conversion : La valeur brute est x10 (ex: 205 -> 20.5)
    // On cast en (short) pour gérer les températures négatives
    currentTemp = (float)((short)tab_reg[0]) / 10.0f;

    // 2. Lire le Niveau Cuve (Discrete Input - Fonction 02)
    rc = modbus_read_input_bits(mb, ADRESSE_NIVEAU_CUVE, 1, tab_bits);
    if (rc != -1) {
        cuvePleine = (tab_bits[0] == 1);
    }

    // 3. Lire le Compteur (Input Register - Fonction 04)
    // Attention : un compteur 32 bits prend 2 registres (2 mots de 16 bits)
    rc = modbus_read_input_registers(mb, ADRESSE_COMPTEUR, 2, tab_reg);
    if (rc != -1) {
        // On combine les deux mots pour faire un grand nombre (Bitwise shift)
        totalImpulsions = (tab_reg[0] << 16) + tab_reg[1];
    }

    return true;
}

// --- Getters (Accesseurs) ---
float IOPoseidon::getTemperature() { return currentTemp; }
bool IOPoseidon::isCuvePleine() { return cuvePleine; }
uint32_t IOPoseidon::getImpulsions() { return totalImpulsions; }

// --- Pilotage Actionneurs ---

// Pilotage Pompe (Coil - Fonction 05)
bool IOPoseidon::setPompe(bool etat) {
    if (!connected) return false;

    // modbus_write_bit envoie la commande 05 (celle que tu as faite dans Hercule)
    // etat ? 1 : 0  -> Si true envoie 1, sinon envoie 0
    if (modbus_write_bit(mb, ADRESSE_POMPE, etat ? 1 : 0) == -1) {
        cerr << "Erreur écriture Pompe: " << modbus_strerror(errno) << endl;
        return false;
    }
    cout << "action -> Pompe mise à : " << (etat ? "ON" : "OFF") << endl;
    return true;
}

// Pilotage Vannes (Coil - Fonction 05)
bool IOPoseidon::setReseauEau(bool utiliserPluie) {
    if (!connected) return false;

    if (modbus_write_bit(mb, ADRESSE_VANNE, utiliserPluie ? 1 : 0) == -1) {
        cerr << "Erreur écriture Vannes: " << modbus_strerror(errno) << endl;
        return false;
    }
    cout << "action -> Réseau basculé sur : " << (utiliserPluie ? "PLUIE" : "VILLE") << endl;
    return true;
}