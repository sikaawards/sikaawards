import { auth, signOut, onAuthStateChanged } from './firebase-config.js';

onAuthStateChanged(auth, (user) => {
    const desktopNav = document.querySelector('.nav-links');
    const mobileNav = document.querySelector('.mobile-nav');

    // Remove existing logout buttons if any (to prevent duplicates on re-auth)
    document.querySelectorAll('.btn-logout-global').forEach(el => el.remove());

    if (user) {
        // Desktop — positionné à droite du header, hors du nav centré
        const headerContainer = document.querySelector('.header .container');
        if (headerContainer) {
            const logoutLink = document.createElement('a');
            logoutLink.href = '#';
            logoutLink.className = 'btn-logout-global';
            logoutLink.style.cssText = 'position:absolute; right:24px; color:var(--primary); font-family:var(--font-heading); font-size:0.75rem; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;';
            logoutLink.textContent = 'Déconnexion';
            logoutLink.onclick = async (e) => {
                e.preventDefault();
                if (confirm('Se déconnecter ?')) {
                    await signOut(auth);
                    window.location.reload();
                }
            };
            headerContainer.appendChild(logoutLink);
        }

        // Mobile
        if (mobileNav) {
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
            mobileNav.appendChild(logoutLink);
        }
    }
});
