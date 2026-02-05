#ifndef IOPOSEIDON_H
#define IOPOSEIDON_H

// CORRECTION : On inclut modbus.h directement (pkg-config gère le chemin)
#include <modbus.h>
#include <string>
#include <iostream>

// --- MAPPING MODBUS (ADAPTÉ AU SIMULATEUR) ---
#define ADRESSE_TEMP_EXT    5     // Registre Holding (40005)
#define ADRESSE_NIVEAU_CUVE 100   // Adresse à vérifier (Entrée ou Coil)
#define ADRESSE_COMPTEUR    1     // Registre Holding (40001) - Débitmètre
#define ADRESSE_POMPE       151   // Coil (00151)
#define ADRESSE_VANNE       152   // Coil (00152)

class IOPoseidon {
private:
    modbus_t *mb;           // Pointeur vers l'instance Modbus
    std::string ipAddress;
    int port;
    bool connected;

    // Variables de stockage interne (Cache)
    float currentTemp;
    bool cuvePleine;
    uint32_t totalImpulsions;

public:
    // Constructeur et Destructeur
    IOPoseidon(std::string ip, int port = 502);
    ~IOPoseidon();

    // Gestion de la connexion
    bool connecter();
    void deconnecter();

    // --- Méthodes de LECTURE ---
    bool updateAll(); 
    
    // Getters
    float getTemperature();
    bool isCuvePleine();
    uint32_t getImpulsions();

    // --- Méthodes d'ÉCRITURE ---
    bool setPompe(bool etat); 
    bool setReseauEau(bool utiliserPluie);
};

#endif