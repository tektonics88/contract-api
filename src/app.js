'use strict';

const express = require('express');
const multer = require('multer');
const analyzeRouter = require('./routes/analyze');

/**
 * Builds and configures the Express application.
 * Exported separately from the server bootstrap so it can be imported
 * by tests without binding to a port.
 */
function createApp() {
  const app = express();

  // JSON body parsing for text-based requests. File uploads are handled
  // per-route by multer (which reads multipart bodies).
  app.use(express.json({ limit: '10mb' }));

  // Liveness check — handy for local dev and deploy health probes.
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/analyze', analyzeRouter);

  // 404 fallback.
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Central error handler. Keeps route handlers free of repetitive try/catch
  // plumbing — they can throw or call next(err).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Map multer upload errors (e.g. file too large) to a 400.
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    const status = err.status || 500;
    // Only log genuine server errors — 4xx are expected client mistakes.
    if (status >= 500) {
      console.error('[error]', err);
    }
    res.status(status).json({
      error: err.publicMessage || 'Internal server error',
    });
  });

  return app;
}

module.exports = { createApp };
