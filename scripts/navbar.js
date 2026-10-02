// Charger et inclure la navbar dans toutes les pages
(function() {
  fetch('navbar.html')
    .then(response => response.text())
    .then(html => {
      document.body.insertAdjacentHTML('afterbegin', html);
      // Déclencher un événement pour indiquer que la navbar est chargée
      document.dispatchEvent(new CustomEvent('navbarLoaded'));
    })
    .catch(error => console.error('Erreur lors du chargement de la navbar:', error));
})();
