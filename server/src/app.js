const express = require('express');
const cors = require('cors');
const requestLogger = require('./middleware/requestLogger');

const errorHandler = require('./middleware/errorHandler');
const skillsRouter = require('./routes/skills');
const executionsRouter = require('./routes/executions');

const app = express();

// ── Middleware ────────────────────────────────
let originConfig = '*';
if (process.env.CORS_ORIGIN) {
  // Allow comma-separated origins and handle accidental trailing slashes
  const origins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
  originConfig = [...new Set([...origins, ...origins.map(o => o.replace(/\/$/, ''))])];
}

app.use(cors({
  origin: originConfig
}));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);



// ── Routes ────────────────────────────────────
app.use('/api/skills', skillsRouter);
app.use('/api/executions', executionsRouter);

// Health check (useful for Render deployment)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler for unmatched routes
app.use((req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.path}`);
  err.statusCode = 404;
  return next(err);
});

// ── Centralized error handler (must be last) ──
app.use(errorHandler);

module.exports = app;
