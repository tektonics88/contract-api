'use strict';

const { createApp } = require('./app');
const config = require('./config');

const app = createApp();

app.listen(config.port, () => {
  console.log(`Contract Review API listening on port ${config.port} (${config.nodeEnv})`);
});
