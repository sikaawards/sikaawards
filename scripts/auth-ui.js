import { auth, signOut, onAuthStateChanged } from './firebase-config.js';

function updateAuthUI(user) {
    const desktopNav = document.querySelector('.nav-links');
    const mobileNav = document.querySelector('.mobile-nav');

    // Remove existing logout buttons if any (to prevent duplicates on re-auth)
    document.querySelectorAll('.btn-logout-global').forEach(el => el.remove());

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

    if (user) {
        // Desktop — ajouter après "Mon compte" dans la navigation
        if (desktopNav) {
            const logoutLink = document.createElement('a');
            logoutLink.href = '#';
            logoutLink.className = 'btn-logout-global';
            logoutLink.textContent = 'Déconnexion';
            logoutLink.onclick = async (e) => {
                e.preventDefault();
                if (confirm('Se déconnecter ?')) {
                    await signOut(auth);
                    window.location.reload();
                }
            };
            desktopNav.appendChild(logoutLink);
        }

        // Mobile
        if (mobileNav) {
            const logoutLink = document.createElement('a');
            logoutLink.href = '#';
            logoutLink.className = 'btn-logout-global';
            logoutLink.textContent = 'Déconnexion';
            logoutLink.style.color = 'var(--primary)';
            logoutLink.style.fontWeight = '700';
            logoutLink.style.display = 'block';
            logoutLink.style.padding = '15px';
            logoutLink.style.borderTop = '1px solid var(--border)';
            logoutLink.style.cursor = 'pointer';
            logoutLink.onclick = async (e) => {
                e.preventDefault();
                if (confirm('Se déconnecter ?')) {
                    await signOut(auth);
                    window.location.reload();
                }
            };
            mobileNav.appendChild(logoutLink);
        }
    }
}

// Exécuter directement quand le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        onAuthStateChanged(auth, updateAuthUI);
    });
} else {
    onAuthStateChanged(auth, updateAuthUI);
}
