#ifndef IOPOSEIDON_H
#define IOPOSEIDON_H

#include <modbus/modbus.h>
#include <string>
#include <iostream>

// --- MAPPING MODBUS (Tes constantes validées) ---
#define ADRESSE_TEMP_EXT    5  // Registre lecture Temp (x10)
#define ADRESSE_NIVEAU_CUVE 100   // Entrée TOR (0/1)
#define ADRESSE_COMPTEUR    1   // Registre Compteur Impulsions
#define ADRESSE_POMPE       151   // Relais Pompe
#define ADRESSE_VANNE       152   // Relais Vannes (0=Ville, 1=Pluie)

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

    // --- Méthodes de LECTURE (Capteurs) ---
    // Met à jour toutes les valeurs depuis la carte
    bool updateAll(); 
    
    // Getters pour récupérer les valeurs dans ton programme principal
    float getTemperature();
    bool isCuvePleine();
    uint32_t getImpulsions();

    // --- Méthodes d'ÉCRITURE (Actionneurs) ---
    // Active ou désactive la pompe
    bool setPompe(bool etat); 
    
    // Choisit le réseau d'eau (True = Pluie, False = Ville)
    bool setReseauEau(bool utiliserPluie);
};

#endif