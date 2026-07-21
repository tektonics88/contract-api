'use strict';

const { createApp } = require('./app');
const config = require('./config');

// Safety: never allow the auth bypass in production.
if (config.disableAuth && config.nodeEnv === 'production') {
  console.error('FATAL: DISABLE_AUTH=true is not allowed when NODE_ENV=production. Exiting.');
  process.exit(1);
}

const app = createApp();

app.listen(config.port, () => {
  console.log(`Contract Review API listening on port ${config.port} (${config.nodeEnv})`);
  if (config.disableAuth) {
    console.warn(
      '\n  ⚠  DISABLE_AUTH=true — API-key authentication is OFF. For local testing only.\n'
    );
  }
});
