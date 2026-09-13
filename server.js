const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const VOTES_FILE = path.join(__dirname, 'votes.json');

// Stockage des votes par IP
let votesByIP = {};

// Charger les votes existants
if (fs.existsSync(VOTES_FILE)) {
  try {
    votesByIP = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));
  } catch (e) {
    console.error('Erreur chargement votes:', e);
    votesByIP = {};
  }
}

// Sauvegarder les votes
function saveVotes() {
  fs.writeFileSync(VOTES_FILE, JSON.stringify(votesByIP, null, 2), 'utf8');
}

// Obtenir l'IP du client
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress;
  return ip === '::1' ? '127.0.0.1' : ip;
}

// Vérifier si l'IP peut voter aujourd'hui
function canVoteToday(ip, categoryId) {
  const today = new Date().toDateString();
  const key = `${ip}_${categoryId}`;
  
  if (!votesByIP[key]) {
    return true;
  }
  
  const lastVoteDate = new Date(votesByIP[key].timestamp).toDateString();
  return lastVoteDate !== today;
}

// Enregistrer un vote
function recordVote(ip, categoryId, winnerName) {
  const key = `${ip}_${categoryId}`;
  votesByIP[key] = {
    timestamp: new Date().toISOString(),
    winner: winnerName,
    categoryId: categoryId
  };
  saveVotes();
}

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API: GET /api/data
  if (req.method === 'GET' && pathname === '/api/data') {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(data);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('null');
    }
    return;
  }

  // API: POST /api/save
  if (req.method === 'POST' && pathname === '/api/save') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        JSON.parse(body); // Valider le JSON
        fs.writeFileSync(DATA_FILE, body, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        console.log('✅ Données sauvegardées dans data.json');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // API: GET /api/can-vote?categoryId=xxx
  if (req.method === 'GET' && pathname === '/api/can-vote') {
    const categoryId = parsedUrl.query.categoryId;
    const ip = getClientIP(req);
    const canVote = canVoteToday(ip, categoryId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ canVote, ip }));
    return;
  }

  // API: POST /api/vote
  if (req.method === 'POST' && pathname === '/api/vote') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { categoryId, winnerName } = JSON.parse(body);
        const ip = getClientIP(req);
        
        if (!canVoteToday(ip, categoryId)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Vous avez déjà voté aujourd\'hui pour cette catégorie.' }));
          return;
        }
        
        recordVote(ip, categoryId, winnerName);
        
        // Mettre à jour data.json
        if (fs.existsSync(DATA_FILE)) {
          const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
          if (data.categories && data.categories[categoryId]) {
            const nominees = data.categories[categoryId].nominees || [];
            const nominee = nominees.find(n => n.name === winnerName);
            if (nominee) {
              nominee.votes = (nominee.votes || 0) + 1;
              fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
            }
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        console.log(`✅ Vote enregistré: IP ${ip} -> ${winnerName} (catégorie: ${categoryId})`);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // API: GET /api/votes-by-ip
  if (req.method === 'GET' && pathname === '/api/votes-by-ip') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(votesByIP));
    return;
  }

  // Fichiers statiques
  // Supprimer le ?v=xxx
  pathname = pathname.split('?')[0];

  // Routes propres (sans .html)
  if (pathname === '/') pathname = '/accueil.html';
  else if (pathname === '/accueil') pathname = '/accueil.html';
  else if (pathname === '/categories') pathname = '/categories.html';
  else if (pathname === '/categorie') pathname = '/categorie.html';
  else if (pathname === '/playlist') pathname = '/playlist.html';
  else if (pathname === '/admin') pathname = '/admin.html';

  const filePath = path.join(__dirname, pathname);
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + pathname);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 SIKA AWARDS Server`);
  console.log(`   Local  : http://localhost:${PORT}`);
  console.log(`   Réseau : http://192.168.1.2:${PORT}`);
  console.log(`   Admin  : http://localhost:${PORT}/admin\n`);
});
