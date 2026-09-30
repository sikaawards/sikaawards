const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const crypto = require('crypto');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const VOTES_FILE = path.join(__dirname, 'votes.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Configuration des limites de vote
const VOTE_LIMITS = {
  MAX_VOTES_PER_USER_PER_CATEGORY_PER_DAY: 1,  // 1 vote par jour par compte par catégorie
  MAX_VOTES_PER_IP_PER_CATEGORY_PER_DAY: 1,     // 1 vote par jour par IP par catégorie
  MAX_VOTES_PER_DEVICE_PER_CATEGORY_PER_DAY: 1  // 1 vote par jour par device par catégorie
};

// Secret pour signer le device_id (à changer en production)
const DEVICE_SECRET = process.env.DEVICE_SECRET || 'sika-awards-device-secret-2024';

// Créer le dossier de backup s'il n'existe pas
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Stockage des votes avec structure complète
let votesData = {
  votes: [], // Array de votes avec { user_id, candidat_id, ip, device_id, date_vote, jour }
  lastBackup: null
};

// Verrou pour les transactions atomiques
let voteLock = false;

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT = 500; // 500 requêtes par minute par IP
const RATE_WINDOW = 60000; // 1 minute en ms

// Logs d'erreurs
const ERROR_LOG_FILE = path.join(__dirname, 'error.log');

function logError(message, error = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}${error ? ` - ${error.message}\n${error.stack}` : ''}\n`;
  fs.appendFileSync(ERROR_LOG_FILE, logEntry, 'utf8');
  console.error(logEntry);
}

// Backup automatique des données
function backupData() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Backup data.json
    if (fs.existsSync(DATA_FILE)) {
      const backupPath = path.join(BACKUP_DIR, `data-backup-${timestamp}.json`);
      fs.copyFileSync(DATA_FILE, backupPath);
      console.log(`✅ Backup créé: ${backupPath}`);
    }
    
    // Backup votes.json
    if (fs.existsSync(VOTES_FILE)) {
      const backupPath = path.join(BACKUP_DIR, `votes-backup-${timestamp}.json`);
      fs.copyFileSync(VOTES_FILE, backupPath);
      console.log(`✅ Backup créé: ${backupPath}`);
    }
    
    // Nettoyer les vieux backups (garder les 10 derniers)
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(10);
    
    backups.forEach(file => {
      fs.unlinkSync(path.join(BACKUP_DIR, file));
      console.log(`🗑️  Backup supprimé: ${file}`);
    });
  } catch (e) {
    logError('Erreur lors du backup', e);
  }
}

// Charger les votes existants
if (fs.existsSync(VOTES_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));
    votesData = data.votes ? { votes: data.votes, lastBackup: data.lastBackup } : votesData;
  } catch (e) {
    logError('Erreur chargement votes', e);
    votesData = { votes: [], lastBackup: null };
  }
}

// Sauvegarder les votes
function saveVotes() {
  try {
    votesData.lastBackup = new Date().toISOString();
    fs.writeFileSync(VOTES_FILE, JSON.stringify(votesData, null, 2), 'utf8');
  } catch (e) {
    logError('Erreur sauvegarde votes', e);
  }
}

// Obtenir le jour actuel (UTC, Abidjan time)
function getToday() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

// Générer un device_id sécurisé
function generateDeviceId() {
  return crypto.randomBytes(16).toString('hex');
}

// Signer un device_id
function signDeviceId(deviceId) {
  const hmac = crypto.createHmac('sha256', DEVICE_SECRET);
  hmac.update(deviceId);
  return hmac.digest('hex');
}

// Vérifier la signature d'un device_id
function verifyDeviceId(deviceId, signature) {
  const expectedSignature = signDeviceId(deviceId);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// Hasher le User-Agent (pour détection de fraude, non stocké en clair)
function hashUserAgent(userAgent) {
  if (!userAgent) return null;
  return crypto.createHash('sha256').update(userAgent).digest('hex');
}

// Vérifier rate limiting
function checkRateLimit(ip) {
  const now = Date.now();
  const requests = requestCounts.get(ip) || [];
  
  // Nettoyer les vieilles requêtes
  const recentRequests = requests.filter(time => now - time < RATE_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false; // Trop de requêtes
  }
  
  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  return true;
}

// Obtenir l'IP du client (avec support proxy/Cloudflare)
function getClientIP(req) {
  // Vérifier Cloudflare
  const cfIP = req.headers['cf-connecting-ip'];
  if (cfIP) return cfIP;
  
  // Vérifier X-Forwarded-For
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // Prendre la première IP (la plus à gauche)
    return forwarded.split(',')[0].trim();
  }
  
  // Fallback sur l'IP directe
  const ip = req.connection.remoteAddress || req.socket.remoteAddress;
  return ip === '::1' ? '127.0.0.1' : ip;
}

// Obtenir l'adresse IP locale
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Vérifier si un utilisateur peut voter (toutes les règles)
function canVote(userId, ip, deviceId, categoryId) {
  const today = getToday();
  
  // Compter les votes de cet utilisateur aujourd'hui pour cette catégorie
  const userVotesToday = votesData.votes.filter(v => 
    v.user_id === userId && v.jour === today && v.categoryId === categoryId
  ).length;
  
  if (userVotesToday >= VOTE_LIMITS.MAX_VOTES_PER_USER_PER_CATEGORY_PER_DAY) {
    return { canVote: false, reason: 'Tu as déjà voté pour cette catégorie aujourd\'hui, reviens demain.' };
  }
  
  // Compter les votes de cette IP aujourd'hui pour cette catégorie
  const ipVotesToday = votesData.votes.filter(v => 
    v.ip === ip && v.jour === today && v.categoryId === categoryId
  ).length;
  
  if (ipVotesToday >= VOTE_LIMITS.MAX_VOTES_PER_IP_PER_CATEGORY_PER_DAY) {
    return { canVote: false, reason: 'Limite atteinte pour ta connexion (1 vote par jour par catégorie).' };
  }
  
  // Compter les votes de ce device aujourd'hui pour cette catégorie
  const deviceVotesToday = votesData.votes.filter(v => 
    v.device_id === deviceId && v.jour === today && v.categoryId === categoryId
  ).length;
  
  if (deviceVotesToday >= VOTE_LIMITS.MAX_VOTES_PER_DEVICE_PER_CATEGORY_PER_DAY) {
    return { canVote: false, reason: 'Limite atteinte pour ton appareil (1 vote par jour par catégorie).' };
  }
  
  return { canVote: true };
}

// Enregistrer un vote (transaction atomique)
function recordVote(userId, categoryId, winnerName, ip, deviceId, userAgent) {
  const today = getToday();
  const vote = {
    user_id: userId,
    categoryId: categoryId,
    candidat_id: winnerName,
    ip: ip,
    device_id: deviceId,
    date_vote: new Date().toISOString(),
    jour: today,
    user_agent_hash: hashUserAgent(userAgent)
  };
  
  votesData.votes.push(vote);
  saveVotes();
  return vote;
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
  const ip = getClientIP(req);

  // Rate limiting check
  if (!checkRateLimit(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Trop de requêtes. Veuillez réessayer plus tard.' }));
    logError(`Rate limit dépassé pour IP: ${ip}`);
    return;
  }

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
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
        res.end(data);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('null');
      }
    } catch (e) {
      logError('Erreur GET /api/data', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur de lecture des données' }));
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
        backupData(); // Backup après sauvegarde
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        console.log('✅ Données sauvegardées dans data.json');
      } catch (e) {
        logError('Erreur POST /api/save', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // API: GET /api/can-vote?categoryId=xxx&userId=xxx&deviceId=xxx
  if (req.method === 'GET' && pathname === '/api/can-vote') {
    try {
      const categoryId = parsedUrl.query.categoryId;
      const userId = parsedUrl.query.userId || 'anonymous';
      const deviceId = parsedUrl.query.deviceId || null;
      
      // Vérifier si l'utilisateur peut voter
      const voteCheck = canVote(userId, ip, deviceId, categoryId);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ canVote: voteCheck.canVote, reason: voteCheck.reason }));
    } catch (e) {
      logError('Erreur GET /api/can-vote', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur de vérification du vote' }));
    }
    return;
  }

  // API: POST /api/device-id
  if (req.method === 'POST' && pathname === '/api/device-id') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { deviceId } = JSON.parse(body);
        
        // Si un deviceId est fourni, vérifier la signature
        if (deviceId) {
          const signature = signDeviceId(deviceId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ deviceId, signature }));
        } else {
          // Générer un nouveau deviceId
          const newDeviceId = generateDeviceId();
          const signature = signDeviceId(newDeviceId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ deviceId: newDeviceId, signature }));
        }
      } catch (e) {
        logError('Erreur POST /api/device-id', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // API: POST /api/vote
  if (req.method === 'POST' && pathname === '/api/vote') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { categoryId, winnerName, userId, deviceId, deviceSignature } = JSON.parse(body);
        
        // Vérifier la signature du device_id
        if (!deviceId || !deviceSignature || !verifyDeviceId(deviceId, deviceSignature)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Identifiant d\'appareil invalide.' }));
          return;
        }
        
        // Transaction atomique
        if (voteLock) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Veuillez réessayer.' }));
          return;
        }
        
        voteLock = true;
        
        try {
          // Vérifier toutes les règles de vote
          const voteCheck = canVote(userId, ip, deviceId, categoryId);
          
          if (!voteCheck.canVote) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: voteCheck.reason }));
            return;
          }
          
          // Enregistrer le vote
          recordVote(userId, categoryId, winnerName, ip, deviceId, req.headers['user-agent']);
          
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
          console.log(`✅ Vote enregistré: User ${userId} -> ${winnerName} (catégorie: ${categoryId}, IP: ${ip}, Device: ${deviceId})`);
        } finally {
          voteLock = false;
        }
      } catch (e) {
        logError('Erreur POST /api/vote', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // API: GET /api/votes-by-ip
  if (req.method === 'GET' && pathname === '/api/votes-by-ip') {
    try {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(votesData.votes));
    } catch (e) {
      logError('Erreur GET /api/votes-by-ip', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur de lecture des votes' }));
    }
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
  const localIP = getLocalIP();
  console.log(`\n🚀 SIKA AWARDS Server`);
  console.log(`   Local  : http://localhost:${PORT}`);
  console.log(`   Réseau : http://${localIP}:${PORT}`);
  console.log(`   Admin  : http://localhost:${PORT}/admin\n`);
});
