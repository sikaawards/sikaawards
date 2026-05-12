import { auth, signOut, onAuthStateChanged } from './firebase-config.js';

onAuthStateChanged(auth, (user) => {
    const desktopNav = document.querySelector('.nav-links');
    const mobileNav = document.querySelector('.mobile-nav');

    // Remove existing logout buttons if any (to prevent duplicates on re-auth)
    document.querySelectorAll('.btn-logout-global').forEach(el => el.remove());

    if (user) {
        // Desktop
        if (desktopNav) {
            const logoutLink = document.createElement('a');
            logoutLink.href = '#';
            logoutLink.className = 'btn-logout-global';
            logoutLink.style.color = 'var(--primary)';
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
            logoutLink.style.color = 'var(--primary)';
            logoutLink.style.fontSize = '1.5rem';
            logoutLink.textContent = 'Déconnexion';
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
});
