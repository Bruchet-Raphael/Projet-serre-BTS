#include "IOPoseidon.h"
#include <iostream>
#include <errno.h>

using namespace std;

IOPoseidon::IOPoseidon(string ip, int p) {
    this->ipAddress = ip;
    this->port = p;
    this->connected = false;

    mb = modbus_new_tcp(ipAddress.c_str(), port);

    // CORRECTION : ID Esclave à 1 pour le simulateur modpoll/nodejs
    modbus_set_slave(mb, 1);
}

IOPoseidon::~IOPoseidon() {
    modbus_free(mb);
}

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

bool IOPoseidon::updateAll() {
    if (!connected) return false;

    uint16_t tab_reg[10]; 
    uint8_t tab_bits[10]; 

    // --- 1. TEMPÉRATURE ---
    // CORRECTION : Utilisation de modbus_read_registers (Fonction 03 - Holding Registers)
    // Le simulateur stocke souvent les données ici.
    int rc = modbus_read_registers(mb, ADRESSE_TEMP_EXT, 1, tab_reg);
    if (rc == -1) {
        cerr << "Erreur lecture Temp: " << modbus_strerror(errno) << endl;
    } else {
        // CORRECTION : Pour le simu, on prend la valeur brute (ex: 44 pour 44°C)
        // Si tu vois que c'est 440 pour 44°C, remets la division par 10.
        currentTemp = (float)((short)tab_reg[0]); 
    }

    // --- 2. NIVEAU CUVE ---
    // On garde input_bits (Fonction 02). Si ça reste à 0, essaie modbus_read_bits (Fonction 01)
    rc = modbus_read_input_bits(mb, ADRESSE_NIVEAU_CUVE, 1, tab_bits);
    if (rc != -1) {
        cuvePleine = (tab_bits[0] == 1);
    }

    // --- 3. COMPTEUR ---
    // CORRECTION : Utilisation de modbus_read_registers (Fonction 03)
    // CORRECTION : On lit seulement 1 registre (taille = 1) car le simu gère 16 bits
    rc = modbus_read_registers(mb, ADRESSE_COMPTEUR, 1, tab_reg);
    if (rc != -1) {
        // Pas de décalage de bit complexe pour le simulateur
        totalImpulsions = (uint32_t)tab_reg[0];
    }

    return true;
}

// Getters
float IOPoseidon::getTemperature() { return currentTemp; }
bool IOPoseidon::isCuvePleine() { return cuvePleine; }
uint32_t IOPoseidon::getImpulsions() { return totalImpulsions; }

// Pilotage Actionneurs
bool IOPoseidon::setPompe(bool etat) {
    if (!connected) return false;

    if (modbus_write_bit(mb, ADRESSE_POMPE, etat ? 1 : 0) == -1) {
        cerr << "Erreur écriture Pompe: " << modbus_strerror(errno) << endl;
        return false;
    }
    cout << "action -> Pompe mise à : " << (etat ? "ON" : "OFF") << endl;
    return true;
}

bool IOPoseidon::setReseauEau(bool utiliserPluie) {
    if (!connected) return false;

    if (modbus_write_bit(mb, ADRESSE_VANNE, utiliserPluie ? 1 : 0) == -1) {
        cerr << "Erreur écriture Vannes: " << modbus_strerror(errno) << endl;
        return false;
    }
    cout << "action -> Réseau basculé sur : " << (utiliserPluie ? "PLUIE" : "VILLE") << endl;
    return true;
}