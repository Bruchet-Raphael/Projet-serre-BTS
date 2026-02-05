#include <iostream>
#include <unistd.h> // Pour sleep()
#include "IOPoseidon.h"

using namespace std;

int main() {
    cout << "--- Démarrage du Superviseur Eau (Etudiant 2) ---" << endl;

    // IP de ton simulateur Node.js
    string ip = "172.29.19.39"; 
    
    // Création de l'objet
    IOPoseidon maSerre(ip);

    // Connexion
    if (!maSerre.connecter()) {
        return -1; 
    }

    // Boucle de test (5 tours)
    for (int i = 0; i < 5; i++) {
        cout << "\n--- Lecture n°" << i+1 << " ---" << endl;
        
        // Mise à jour des valeurs
        if (maSerre.updateAll()) {
            cout << "Température Ext : " << maSerre.getTemperature() << " °C" << endl;
            cout << "Niveau Cuve     : " << (maSerre.isCuvePleine() ? "PLEIN" : "VIDE") << endl;
            cout << "Compteur Eau    : " << maSerre.getImpulsions() << " impulsions" << endl;
        }

        // Test Pompe : ON au tour 2, OFF au tour 4
        if (i == 2) maSerre.setPompe(true);
        if (i == 4) maSerre.setPompe(false);

        sleep(2); // Pause de 2s
    }

    maSerre.deconnecter();
    cout << "Fin du programme." << endl;
    return 0;
}