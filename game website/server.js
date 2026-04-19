const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// Custom MongoDB sanitizer (express-mongo-sanitize is incompatible with Express 5)
function sanitizeObject(obj, replaceWith = '_') {
  if (typeof obj !== 'object' || obj === null) return obj;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) {
      delete obj[key];
    } else if (typeof obj[key] === 'object') {
      sanitizeObject(obj[key], replaceWith);
    } else if (typeof obj[key] === 'string' && obj[key].includes('$')) {
      obj[key] = obj[key].replace(/\$/g, replaceWith);
    }
  }
  return obj;
}
const connectDB = require('./config/db');
const Player = require('./models/Player');
const Session = require('./models/Session');
const PlatformStats = require('./models/PlatformStats');

// Load config
dotenv.config();

// ═══════════════ SECURITY CONFIG ═══════════════
const ALLOWED_ORIGINS = [
  'https://sg-prime-game-launcher.onrender.com',
  'http://localhost:3000',
  'http://localhost:4200',
  'http://127.0.0.1:3000',
  process.env.LAUNCHER_ORIGIN // Allow custom launcher origin
].filter(Boolean);

const LAUNCHER_API_KEY = process.env.LAUNCHER_API_KEY || 'sp-launcher-2026-secure';

// Initialize app
const app = express();
app.set('trust proxy', 1); // Trust first-hop proxy (Render, Heroku, etc.)
const server = http.createServer(app);

// Socket.IO with restricted CORS
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store IO in app for routes
app.set('io', io);

// ═══════════════ SECURITY MIDDLEWARE ═══════════════

// 1. Helmet — Security headers (X-Frame-Options, CSP, X-Content-Type-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers like onclick
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://api.dicebear.com", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "https://sg-prime-game-launcher.onrender.com", "wss://sg-prime-game-launcher.onrender.com", "cdn.jsdelivr.net"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// 2. CORS — Restricted to allowed origins only
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, launcher)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`[SECURITY] Blocked CORS request from: ${origin}`);
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// 3. Rate Limiting — Prevent brute force & DDoS
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  skip: (req) => req.path === '/api/health'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Only 10 auth attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
  skipSuccessfulRequests: true
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 downloads per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Download limit reached. Please try again later.' }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 API requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'API rate limit exceeded.' }
});

app.use(globalLimiter);

// 4. Request size limit — Prevent oversized payload attacks
// 4. Request size limit — Metadata limits (Multiparts handle larger files separately)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// 5. MongoDB sanitization — Prevent NoSQL injection (Express 5 compatible)
app.use((req, res, next) => {
  if (req.body) sanitizeObject(req.body);
  if (req.params) sanitizeObject(req.params);
  // Note: req.query is read-only in Express 5, but URL-decoded query strings
  // cannot contain raw $ operators, so this is safe to skip.
  next();
});

// 6. Additional security headers
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Request-ID', require('crypto').randomBytes(8).toString('hex'));
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Static folders
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.io for live analytics
let activePlayers = new Set();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  let sessionHwid = null;
  let currentSessionId = null;

  // ═══════════════ SOCKET INPUT VALIDATION ═══════════════
  const HWID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;
  const MAX_DURATION = 86400; // Max 24 hours per session (seconds)
  const MAX_PLAYTIME_INCREMENT = 3600; // Max 1 hour per playtime sync

  function validateHwid(hwid) {
    return typeof hwid === 'string' && HWID_REGEX.test(hwid);
  }

  function validateDuration(duration) {
    return typeof duration === 'number' && duration > 0 && duration <= MAX_PLAYTIME_INCREMENT;
  }

  // ─── Player Identification ───
  socket.on('player:identify', async (data) => {
    try {
      const { hwid } = data;
      if (!validateHwid(hwid)) {
        console.warn(`[SECURITY] Invalid HWID format from socket ${socket.id}: ${hwid}`);
        return;
      }
      sessionHwid = hwid;

      // Update online status in DB
      await Player.findOneAndUpdate({ hwid }, { isOnline: true, lastSeen: Date.now() });
      io.emit('stats:update', { activePlayers: activePlayers.size });
    } catch (err) {
      console.error('Player identify error:', err);
    }
  });

  // ─── Playtime Tracking (Heartbeat Sync) ───
  socket.on('stats:playtime', async (data) => {
    try {
      const { hwid, duration } = data;
      if (!validateHwid(hwid)) {
        console.warn(`[SECURITY] Invalid HWID in playtime sync from ${socket.id}`);
        return;
      }
      if (!validateDuration(duration)) {
        console.warn(`[SECURITY] Invalid duration in playtime sync from ${socket.id}: ${duration}`);
        return;
      }

      let player = await Player.findOne({ hwid });
      if (player) {
        // Cap total playtime to prevent overflow attacks
        player.totalPlayTime = Math.min(player.totalPlayTime + duration, MAX_DURATION * 365);
        player.lastSeen = Date.now();
        await player.save();
      }
    } catch (err) {
      console.error('Playtime sync error:', err);
    }
  });

  // When a player clicks PLAY in launcher
  socket.on('game:started', async (data) => {
    const hwid = data?.hwid || sessionHwid;
    if (!validateHwid(hwid)) {
      console.warn(`[SECURITY] Invalid HWID in game:started from ${socket.id}`);
      return;
    }

    activePlayers.add(socket.id);
    io.emit('stats:update', { activePlayers: activePlayers.size });

    // Start a new session in DB
    try {
      const newSession = new Session({ hwid, startTime: Date.now() });
      const saved = await newSession.save();
      currentSessionId = saved._id;
    } catch (e) {
      console.error('Failed to start session:', e);
    }

    console.log(`Player ${hwid} started game. Total: ${activePlayers.size}`);
  });

  // When a player closes the game/launcher gracefully
  socket.on('game:stopped', async () => {
    activePlayers.delete(socket.id);
    io.emit('stats:update', { activePlayers: activePlayers.size });

    // Close session in DB
    if (currentSessionId) {
      try {
        const session = await Session.findById(currentSessionId);
        if (session) {
          session.endTime = Date.now();
          session.duration = Math.round((session.endTime - session.startTime) / 1000);
          await session.save();
        }
      } catch (e) { console.error('Failed to end session:', e); }
      currentSessionId = null;
    }

    console.log(`Player stopped game. Total: ${activePlayers.size}`);
  });

  socket.on('disconnect', async () => {
    if (activePlayers.has(socket.id)) {
      activePlayers.delete(socket.id);
      io.emit('stats:update', { activePlayers: activePlayers.size });
    }

    if (sessionHwid) {
      await Player.findOneAndUpdate({ hwid: sessionHwid }, { isOnline: false, lastSeen: Date.now() });
    }

    // Auto-close session on disconnect
    if (currentSessionId) {
      try {
        const session = await Session.findById(currentSessionId);
        if (session) {
          session.endTime = Date.now();
          session.duration = Math.round((session.endTime - session.startTime) / 1000);
          await session.save();
        }
      } catch (e) { }
    }
  });

  // Initial stats for the admin dashboard
  socket.emit('stats:update', { activePlayers: activePlayers.size });
});

// Connect to DB (don't crash if fails, just log it)
connectDB();

// Basic API routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Mount Routes (with rate limiting)
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/files', apiLimiter, require('./routes/files'));
app.use('/api/branding', apiLimiter, require('./routes/branding'));
app.use('/api/news', apiLimiter, require('./routes/news'));
app.use('/api/media', apiLimiter, require('./routes/media'));
app.use('/api/analytics', apiLimiter, require('./routes/analytics'));
app.use('/api/config', apiLimiter, require('./routes/config'));
app.use('/api/players', apiLimiter, require('./routes/players'));

// Public launcher download endpoints
app.get('/api/version', (req, res) => {
  const fs = require('fs-extra');
  const path = require('path');
  const vPath = path.join(__dirname, 'uploads/version.json');

  if (fs.existsSync(vPath)) {
    const data = fs.readJsonSync(vPath);
    res.json(data);
  } else {
    res.json({ version: "0.0.0", dll_version: "0.0.0" });
  }
});

// ═══════════════ PROTECTED DOWNLOAD ENDPOINTS ═══════════════
// Downloads require API key header (x-launcher-key) or valid HWID query param
function verifyLauncherRequest(req, res, next) {
  const apiKey = req.header('x-launcher-key');
  const hwid = req.query.hwid;

  // Allow if valid API key provided
  if (apiKey && apiKey === LAUNCHER_API_KEY) {
    return next();
  }

  // Allow if HWID provided (launcher sends this)
  if (hwid && /^[a-zA-Z0-9_-]{8,64}$/.test(hwid)) {
    return next();
  }

  // Block unauthorized downloads
  console.warn(`[SECURITY] Blocked unauthorized download from IP: ${req.ip}`);
  return res.status(403).json({ error: 'Unauthorized. Use the official launcher to download.' });
}

app.get('/api/download/game', downloadLimiter, verifyLauncherRequest, (req, res) => {
  const fs = require('fs-extra');
  const path = require('path');
  const localFile = path.join(__dirname, 'uploads/games/Stumble Tracer.zip');

  if (fs.existsSync(localFile)) {
    return res.download(localFile);
  } else {
    // [LEGACY BYPASS] GridFS storage disabled
    return res.status(404).json({ error: 'Game file not found on server disk.' });
  }
});

app.get('/api/download/dll', downloadLimiter, verifyLauncherRequest, (req, res) => {
  const fs = require('fs-extra');
  const path = require('path');
  const localFile = path.join(__dirname, 'uploads/dlls/mod.dll');

  if (fs.existsSync(localFile)) {
    return res.download(localFile);
  } else {
    // [LEGACY BYPASS] GridFS storage disabled
    return res.status(404).json({ error: 'DLL file not found on server disk.' });
  }
});

// Generic asset serving from GridFS
app.get('/api/assets/:bucket/:filename', (req, res) => {
  const { serveFromGridFS } = require('./config/gridfs');
  const bucketName = req.params.bucket === 'news' ? ['news', 'news_images'] : req.params.bucket;
  return serveFromGridFS(bucketName, req.params.filename, res);
});

app.get('/api/assets/logo', (req, res) => {
  const { serveFromGridFS } = require('./config/gridfs');
  return serveFromGridFS('branding', 'logo.png', res);
});

app.get('/api/assets/banner', (req, res) => {
  const { serveFromGridFS } = require('./config/gridfs');
  return serveFromGridFS('branding', 'banner.jpg', res);
});

const PORT = process.env.PORT || 3000;
const serverInstance = server.listen(PORT, () => {
  console.log(`🚀 Stumble Tracer Admin Server running on port ${PORT}`);
  startStatsLogging();
});

// ─── Analytics Background Job ───
function startStatsLogging() {
  // Run every hour
  setInterval(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dap = await Player.countDocuments({ lastSeen: { $gte: twentyFourHoursAgo } });
      const newPlayers = await Player.countDocuments({ joinedAt: { $gte: today } });

      const allPlayers = await Player.find();
      const totalPlayTime = allPlayers.reduce((acc, p) => acc + (p.totalPlayTime || 0), 0);

      // Update or Create stats for today
      await PlatformStats.findOneAndUpdate(
        { date: today },
        {
          $max: { peakOnline: activePlayers.size },
          $set: {
            dailyActivePlayers: dap,
            newPlayers: newPlayers,
            totalPlayTime: totalPlayTime
          }
        },
        { upsert: true }
      );

      console.log(`📊 Stats Logged: ${activePlayers.size} Online, ${dap} DAP`);
    } catch (err) {
      console.error('Stats logging failed:', err);
    }
  }, 60 * 60 * 1000); // 1 Hour
}

// ═══════════════ GLOBAL ERROR HANDLER ═══════════════
app.use((err, req, res, next) => {
  console.error('🔴 [CRITICAL ERROR]:', err);
  
  // Handle Multer specifically
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ msg: 'File too large! Max 5GB allowed.' });
  }

  res.status(err.status || 500).json({
    msg: err.message || 'Internal Server Error',
    requestId: res.getHeader('X-Request-ID')
  });
});

// Remove timeouts for large file processing (400MB+)
serverInstance.timeout = 0;
serverInstance.keepAliveTimeout = 0;
serverInstance.headersTimeout = 0;
serverInstance.requestTimeout = 0;
