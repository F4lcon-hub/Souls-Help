const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'requests.json');
const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // 4h

// Ensure data dir and file
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]', 'utf-8');

async function readDb(){
  try {
    const raw = await fsp.readFile(DB_FILE, 'utf-8');
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
async function writeDb(items){
  await fsp.writeFile(DB_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

function sanitizeEntry(entry){
  const out = {
    id: entry.id || randomUUID(),
    createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now(),
    expiresAt: typeof entry.expiresAt === 'number' && entry.expiresAt > Date.now() ? entry.expiresAt : Date.now() + DEFAULT_TTL_MS,
    game: String(entry.game || ''),
    type: String(entry.type || ''),
    target: String(entry.target || ''),
    platform: String(entry.platform || ''),
    level: String(entry.level || ''),
    password: String(entry.password || ''),
    region: String(entry.region || ''),
    notes: String(entry.notes || ''),
  };
  return out;
}

function isValidEntry(entry){
  const allowedGames = ['elden-ring','ds1','ds2','ds3','bb'];
  return entry && allowedGames.includes(entry.game) && entry.type && entry.target && entry.platform;
}

app.use(cors());
app.use(express.json({ limit: '256kb' }));

// Healthcheck
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// List active requests
app.get('/api/requests', async (req, res) => {
  const game = req.query.game ? String(req.query.game) : '';
  let items = await readDb();
  const now = Date.now();
  items = items.filter(x => (x.expiresAt ?? 0) > now);
  if (game) items = items.filter(x => x.game === game);
  // Sort by expires
  items.sort((a,b) => a.expiresAt - b.expiresAt);
  res.json(items);
});

// Create request
app.post('/api/requests', async (req, res) => {
  try {
    const entry = sanitizeEntry(req.body || {});
    if (!isValidEntry(entry)) return res.status(400).json({ error: 'invalid_entry' });
    const items = await readDb();
    items.unshift(entry);
    await writeDb(items);
    res.status(201).json(entry);
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

// Delete request
app.delete('/api/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let items = await readDb();
    const before = items.length;
    items = items.filter(x => x.id !== id);
    if (items.length !== before){
      await writeDb(items);
      return res.status(204).end();
    }
    res.status(404).json({ error: 'not_found' });
  } catch {
    res.status(500).json({ error: 'server_error' });
  }
});

// Serve static frontend
app.use(express.static(ROOT));

// Fallback to index.html for root
app.get('*', (req, res) => {
  // Only serve index.html for root-like paths; otherwise 404
  if (req.path === '/' || req.path.endsWith('.html')){
    return res.sendFile(path.join(ROOT, 'index.html'));
  }
  res.status(404).end();
});

app.listen(PORT, () => {
  console.log(`Souls Help API/Server running at http://localhost:${PORT}`);
});
