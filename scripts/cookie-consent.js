// ========================================
// COOKIE CONSENT
// ========================================

(function() {
  'use strict';

  const COOKIE_CONSENT_KEY = 'sikaawards_cookie_consent';
  const COOKIE_CONSENT_EXPIRY = 365; // days

  // Check if user has already made a choice
  function hasConsented() {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    return consent !== null;
  }

  // Get user's consent choice
  function getConsent() {
    return localStorage.getItem(COOKIE_CONSENT_KEY);
  }

  // Save user's consent choice
  function setConsent(choice) {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice);
  }

  // Show cookie banner
  function showBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.classList.add('show');
    }
  }

  // Hide cookie banner
  function hideBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.classList.remove('show');
    }
  }

  // Handle accept all cookies
  function acceptAll() {
    setConsent('accepted');
    hideBanner();
    // Here you would enable all tracking scripts
    console.log('Cookies accepted');
  }

  // Handle reject all cookies
  function rejectAll() {
    setConsent('rejected');
    hideBanner();
    // Here you would disable all tracking scripts
    console.log('Cookies rejected');
  }

  // Handle custom settings (for future implementation)
  function showSettings() {
    alert('Paramètres des cookies - À implémenter');
  }

  // Initialize cookie consent
  function init() {
    // If user hasn't made a choice, show banner
    if (!hasConsented()) {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showBanner);
      } else {
        showBanner();
      }
    }

    // Set up event listeners
    const acceptBtn = document.getElementById('cookie-accept');
    const rejectBtn = document.getElementById('cookie-reject');
    const settingsBtn = document.getElementById('cookie-settings');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', acceptAll);
    }

    if (rejectBtn) {
      rejectBtn.addEventListener('click', rejectAll);
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', showSettings);
    }
  }

  // Run initialization
  init();
})();
