const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const errorHandler = require('./middleware/errorHandler');
const skillsRouter = require('./routes/skills');

const app = express();

// ── Middleware ────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Morgan request logging: concise format in dev, combined in production
const logFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(logFormat));

const executionsRouter = require('./routes/executions');

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
