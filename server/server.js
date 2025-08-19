const express = require('express');
const cors = require('cors');
const path = require('path');
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase config (required for production)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // 4h
const FRONTEND_URL = process.env.FRONTEND_URL || '';

// Logging
app.use(morgan('combined'));

// CORS configuration (set CORS_ORIGINS="https://frontend1.com,https://frontend2.com")
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const corsOptions = corsOrigins.length > 0 ? {
  origin: function(origin, callback){
    if (!origin) return callback(null, true); // allow curl/postman/no-origin
    const allowed = corsOrigins.some(o => origin === o);
    callback(allowed ? null : new Error('Not allowed by CORS'), allowed);
  },
  methods: ['GET','POST','DELETE'],
  allowedHeaders: ['Content-Type'],
} : {};
app.use(cors(corsOptions));

app.use(express.json({ limit: '256kb' }));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalLimiter);

function sanitizeEntry(entry){
  const now = Date.now();
  return {
    id: entry.id || randomUUID(),
    createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : now,
    expiresAt: typeof entry.expiresAt === 'number' && entry.expiresAt > now ? entry.expiresAt : now + DEFAULT_TTL_MS,
    game: String(entry.game || ''),
    type: String(entry.type || ''),
    target: String(entry.target || ''),
    platform: String(entry.platform || ''),
    level: entry.level != null ? String(entry.level) : '',
    password: entry.password != null ? String(entry.password) : '',
    region: entry.region != null ? String(entry.region) : '',
    notes: entry.notes != null ? String(entry.notes) : '',
  };
}

function isValidEntry(entry){
  const allowedGames = ['elden-ring','ds1','ds2','ds3','bb'];
  return entry && allowedGames.includes(entry.game) && entry.type && entry.target && entry.platform;
}

// Healthcheck (verifica conectividade com Supabase)
app.get('/api/health', async (_req, res) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY){
      return res.status(200).json({ ok: false, reason: 'missing_supabase_env' });
    }
    const { error } = await supabase
      .from('requests')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    if (error) return res.status(200).json({ ok: false, reason: 'db_error' });
    res.json({ ok: true });
  } catch {
    res.status(200).json({ ok: false, reason: 'exception' });
  }
});

// Purge expired requests periodically
async function purgeExpired(){
  try {
    const now = Date.now();
    await supabase.from('requests').delete().lte('expiresAt', now);
  } catch (e) {}
}
setInterval(purgeExpired, 10 * 60 * 1000);

// List active requests with optional pagination
app.get('/api/requests', async (req, res) => {
  try {
    const game = req.query.game ? String(req.query.game) : '';
    const pageParam = parseInt(String(req.query.page || '1'), 10);
    const sizeParam = parseInt(String(req.query.pageSize || '20'), 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize = Number.isFinite(sizeParam) ? Math.min(Math.max(sizeParam, 1), 100) : 20;
    const offset = (page - 1) * pageSize;

    const now = Date.now();
    let query = supabase
      .from('requests')
      .select('*', { count: 'exact' })
      .gt('expiresAt', now);
    if (game) query = query.eq('game', game);
    query = query.order('expiresAt', { ascending: true }).range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: 'db_error' });

    // Return a paginated payload
    res.json({ items: data || [], total: count || 0, page, pageSize });
  } catch {
    res.status(500).json({ error: 'server_error' });
  }
});

// Create request
app.post('/api/requests', writeLimiter, async (req, res) => {
  try {
    const entry = sanitizeEntry(req.body || {});
    if (!isValidEntry(entry)) return res.status(400).json({ error: 'invalid_entry' });
    const { data, error } = await supabase
      .from('requests')
      .insert(entry)
      .select()
      .single();
    if (error) return res.status(500).json({ error: 'db_error' });
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

// Delete request
app.delete('/api/requests/:id', writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', id);
    if (error) return res.status(500).json({ error: 'db_error' });
    return res.status(204).end();
  } catch {
    res.status(500).json({ error: 'server_error' });
  }
});

// Frontend handling
if (FRONTEND_URL){
  // Redirect any non-API path to the canonical frontend URL
  app.get(/^\/(?!api\b).*/, (req, res) => {
    try {
      const target = new URL(req.originalUrl || '/', FRONTEND_URL);
      res.redirect(302, target.toString());
    } catch {
      res.redirect(302, FRONTEND_URL);
    }
  });
} else {
  // Serve static frontend from repo root (local/dev)
  app.use(express.static(ROOT));
  app.get('*', (req, res) => {
    if (req.path === '/' || req.path.endsWith('.html')){
      return res.sendFile(path.join(ROOT, 'index.html'));
    }
    res.status(404).end();
  });
}

app.listen(PORT, () => {
  console.log(`Souls Help API/Server running at http://localhost:${PORT}`);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY){
    console.warn('WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. API calls will fail.');
  }
});
