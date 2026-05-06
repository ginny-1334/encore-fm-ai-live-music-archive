// server/index.js
//
// Encore FM server entry point.
//
// Responsibilities:
//   1. Load environment variables from .env
//   2. Connect to MongoDB
//   3. Configure Express middleware (CORS, JSON parsing, request logging)
//   4. Serve the front-end as static files from /public
//   5. Mount API routes under /api/*
//   6. Centralized error handling
//   7. Start the HTTP server on the configured port

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./db/connection');

// API route handlers
const artistsRouter  = require('./routes/artists');
const setlistsRouter = require('./routes/setlists');
const reviewsRouter  = require('./routes/reviews');
const showsRouter    = require('./routes/shows');

const app = express();

// ---------- Middleware ----------
// CORS — allows the front-end to call the API. Same-origin in production
// (Express serves both), but during dev tools like Live Server may proxy
// from a different port.
app.use(cors());

// Parses incoming JSON request bodies into req.body.
app.use(express.json({ limit: '1mb' }));

// Logs every HTTP request to the terminal. Format 'dev' is concise + colored.
app.use(morgan('dev'));

// ---------- Static front-end ----------
// Serves /public as the document root. Visiting http://localhost:5050/
// returns public/index.html. /artist.html, /style.css, /main.js etc. all
// resolve relative to this folder.
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// ---------- Health check route ----------
// A trivial endpoint we can hit from a browser to confirm the server is alive.
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'encore-fm',
    time: new Date().toISOString(),
  });
});

// ---------- API routes ----------
app.use('/api/artists',  artistsRouter);
app.use('/api/setlists', setlistsRouter);
app.use('/api/reviews',  reviewsRouter);
app.use('/api/shows',    showsRouter);

// ---------- 404 handler for unmatched API routes ----------
// Only fires for /api/* — non-API URLs fall through to the static handler.
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// ---------- Centralized error handler ----------
// Express recognizes 4-arg middleware as the error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------- Boot ----------
const PORT = process.env.PORT || 5050;

(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[server] Encore FM listening on http://localhost:${PORT}`);
    console.log(`[server] Front-end:  http://localhost:${PORT}/`);
    console.log(`[server] API health: http://localhost:${PORT}/api/health`);
  });
})();

