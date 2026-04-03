const API_URL = "http://172.29.160.160/api";

async function login() {
    const login = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const errorBox = document.getElementById("errorBox");
    const successBox = document.getElementById("successBox");

    errorBox.style.display = "none";
    successBox.style.display = "none";

    if (!login || !password) {
        errorBox.textContent = "Veuillez remplir tous les champs.";
        errorBox.style.display = "block";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // Envoyer et recevoir les cookies
            body: JSON.stringify({ login, password })
        });

        const data = await response.json();

        if (!data.success) {
            errorBox.textContent = data.message || "Identifiants incorrects.";
            errorBox.style.display = "block";
            return;
        }

        // Sauvegarder le rôle dans localStorage pour utilisation côté client
        if (data.role) {
            localStorage.setItem('userRole', data.role);
        }

        successBox.textContent = "Connexion réussie !";
        successBox.style.display = "block";

        // Redirection intelligente basée sur le rôle
        const redirectUrl = data.role === 'admin' ? "/front/admin.html" : "/front/index.html";
        
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 500);

    } catch (err) {
        errorBox.textContent = "Erreur de connexion au serveur.";
        errorBox.style.display = "block";
    }
}
