// PM2 definition for the GYMC Quiz API (production).
//   cd backend && pm2 start ecosystem.config.cjs
const path = require('path');
const root = path.resolve(__dirname, '..');
module.exports = {
  apps: [
    {
      name: 'gymc-api',
      cwd: __dirname,
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      out_file: path.join(root, 'logs/api-out.log'),
      error_file: path.join(root, 'logs/api-err.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
