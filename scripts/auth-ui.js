import { auth, onAuthStateChanged } from './firebase-config.js';

function updateAuthUI(user) {
    // Gestion du bouton "Mon compte"
    const accountLinks = document.querySelectorAll('a[href="login.html"]');
    accountLinks.forEach(link => {
        if (user) {
            // Utilisateur connecté → rediriger vers l'espace personnel
            link.href = 'compte.html';
            link.textContent = 'Mon compte';
        } else {
            // Utilisateur non connecté → rediriger vers login
            link.href = 'login.html';
            link.textContent = 'Mon compte';
        }
    });
}

// Exécuter directement quand le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        onAuthStateChanged(auth, updateAuthUI);
    });
} else {
    onAuthStateChanged(auth, updateAuthUI);
}
