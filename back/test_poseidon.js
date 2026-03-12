const IOPoseidon = require('./IOPoseidon');

// Configuration
const IP_SIMULATEUR = '172.29.17.186'; // Vérifie ton IP

async function runTest() {
    console.log("--- TEST AUTOMATISÉ : ETUDIANT 2 (JS) ---");
    
    const poseidon = new IOPoseidon(IP_SIMULATEUR);

    try {
        // 1. Connexion
        await poseidon.connect();

        // 2. Boucle de surveillance (10 cycles)
        for (let i = 1; i <= 10; i++) {
            console.log(`\n🔄 CYCLE ${i}/10`);
            
            // Mise à jour des lectures
            await poseidon.updateAll();

            // Affichage des données
            console.log(`   🌡️  Température : ${poseidon.getTemperature()} °C`);
            console.log(`   🪣  Niveau Cuve : ${poseidon.isCuvePleine() ? 'PLEIN' : 'VIDE'}`);
            console.log(`   💧 Conso Eau   : ${poseidon.getConsommationLitres()} Litres`);

            // Exécution des Algorithmes
            await poseidon.gererChoixReseau();

            // Simulation d'un besoin d'arrosage (1 fois sur 2)
            const demandeArrosage = (i % 2 === 0);
            console.log(`   🌾 Besoin Eau  : ${demandeArrosage ? 'OUI' : 'NON'}`);
            await poseidon.gererPompe(demandeArrosage);

            // Pause de 2 secondes
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Fin propre
        poseidon.disconnect();
        console.log("\n✅ Test terminé avec succès.");

    } catch (error) {
        console.error("💥 Erreur critique pendant le test :", error);
    }
}

runTest();