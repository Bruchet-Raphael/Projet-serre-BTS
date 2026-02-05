#include <iostream>
#include <unistd.h> // Pour la fonction sleep()
#include "IOPoseidon.h"

using namespace std;

int main() {
    cout << "--- Démarrage du Superviseur Eau (Etudiant 2) ---" << endl;

    string ip = "172.29.19.39"; 
    
    // Création de l'objet
    IOPoseidon maSerre(ip);

    // Connexion
    if (!maSerre.connecter()) {
        return -1; // On quitte si pas de connexion
    }

    // Boucle de test (5 fois)
    for (int i = 0; i < 5; i++) {
        cout << "\n--- Lecture n°" << i+1 << " ---" << endl;
        
        // Mise à jour des valeurs
        if (maSerre.updateAll()) {
            cout << "Température Ext : " << maSerre.getTemperature() << " °C" << endl;
            cout << "Niveau Cuve : " << (maSerre.isCuvePleine() ? "PLEIN" : "VIDE") << endl;
            cout << "Compteur Eau : " << maSerre.getImpulsions() << " impulsions" << endl;
        }

        // Test Actionneur : On allume la pompe au tour 2, on éteint au tour 4
        if (i == 2) maSerre.setPompe(true);
        if (i == 4) maSerre.setPompe(false);

        sleep(2); // Pause de 2 secondes
    }

    maSerre.deconnecter();
    cout << "Fin du programme." << endl;
    return 0;
}