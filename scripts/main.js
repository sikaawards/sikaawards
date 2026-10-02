/* ========================================
   SIKA AWARDS — Main Script
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

  // --- Menu mobile ---
  const header = document.querySelector('.header');
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  const setMenu = (open) => {
    if (!hamburger || !mobileNav) return;
    hamburger.classList.toggle('active', open);
    mobileNav.classList.toggle('active', open);
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    document.body.classList.toggle('nav-open', open);
  };
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => setMenu(!mobileNav.classList.contains('active')));
    mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', () => { if (window.innerWidth > 768) setMenu(false); });
  }
  // Header plus marqué dès qu'on fait défiler la page
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // --- Reveal on scroll ---
  const reveals = document.querySelectorAll('.reveal');
  const observerOptions = { threshold: 0.15, rootMargin: '0px 0px -40px 0px' };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  reveals.forEach(el => observer.observe(el));
  
  window.refreshReveals = () => {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => observer.observe(el));
  };

  // --- Animated counter ---
  const counters = document.querySelectorAll('.stat-number');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-count'), 10);
        if (isNaN(target)) return;
        let current = 0;
        const step = Math.max(1, Math.floor(target / 60));
        const timer = setInterval(() => {
          current += step;
          if (current >= target) { current = target; clearInterval(timer); }
          el.textContent = current + (el.getAttribute('data-suffix') || '');
        }, 25);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(el => counterObserver.observe(el));

  // --- Smooth anchor links ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const id = anchor.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // --- Countdown timer ---
  const countdownEl = document.getElementById('countdown');
  if (countdownEl) {
    // Date d'ouverture des votes - 28 Novembre 2026 à 00:00
    const deadline = new Date('2026-11-28T00:00:00');
    function updateCountdown() {
      const now = new Date();
      const diff = deadline - now;
      if (diff <= 0) {
        countdownEl.textContent = 'VOTES OUVERTS';
        return;
      }
      
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      
      // Si plus de 24h, afficher seulement les jours
      if (d > 0) {
        countdownEl.innerHTML = d + ' <strong>JOUR' + (d > 1 ? 'S' : '') + '</strong>';
      } else {
        // Si moins de 24h (jour J), afficher heures:minutes:secondes
        countdownEl.textContent =
          String(h).padStart(2, '0') + ':' +
          String(m).padStart(2, '0') + ':' +
          String(s).padStart(2, '0');
      }
    }
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  // --- Category scroll arrows ---
  window.initScrollArrows = function () {
    document.querySelectorAll('.cat-arrow').forEach(btn => {
      if (btn.getAttribute('data-init')) return;
      btn.setAttribute('data-init', 'true');

      btn.addEventListener('click', () => {
        const track = btn.closest('.cat-scroll').querySelector('.cat-track');
        const firstCard = track.querySelector('.nominee-card');
        if (!firstCard) return;

        const cardWidth = firstCard.offsetWidth;
        const gap = parseInt(window.getComputedStyle(track).gap) || 16;
        const scrollAmount = (cardWidth + gap) * (btn.classList.contains('prev') ? -1 : 1);

        // Scroll instantané sans animation
        track.scrollLeft += scrollAmount;
      });
    });
  };

  window.initScrollArrows();

  // Défloutage permanent au CLIC avec sauvegarde
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.nominee-card, .nominee-big-card');
    if (card) {
      card.classList.add('revealed');
      
      // Sauvegarder le nom dans le localStorage
      const nameEl = card.querySelector('.nominee-name-label, .nominee-big-name');
      if (nameEl) {
        const name = nameEl.textContent.trim();
        let revealed = JSON.parse(localStorage.getItem('sika_awards_revealed') || '[]');
        if (!revealed.includes(name)) {
          revealed.push(name);
          localStorage.setItem('sika_awards_revealed', JSON.stringify(revealed));
        }
      }
    }
  });

  // Restaurer l'état déflouté des cartes
  const restoreRevealed = () => {
    const revealed = JSON.parse(localStorage.getItem('sika_awards_revealed') || '[]');
    if (revealed.length === 0) return;
    
    document.querySelectorAll('.nominee-card:not(.revealed), .nominee-big-card:not(.revealed)').forEach(card => {
      const nameEl = card.querySelector('.nominee-name-label, .nominee-big-name');
      if (nameEl && revealed.includes(nameEl.textContent.trim())) {
        card.classList.add('revealed');
      }
    });
  };

  // On observe les changements dans le DOM pour appliquer l'état déflouté sur les cartes générées dynamiquement
  const domObserver = new MutationObserver((mutations) => {
    restoreRevealed();
  });
  domObserver.observe(document.body, { childList: true, subtree: true });

  // Appliquer une première fois au chargement
  restoreRevealed();

});
