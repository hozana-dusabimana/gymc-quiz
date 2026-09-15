// PM2 definition for the GYMC Quiz static web server (production).
//   cd frontend && WEB_PORT=8194 pm2 start ecosystem.config.cjs
const path = require('path');
const root = path.resolve(__dirname, '..');
const port = process.env.WEB_PORT || '8194';
module.exports = {
  apps: [
    {
      name: 'gymc-web',
      cwd: __dirname,
      script: 'serve.js',
      args: port,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      env: { NODE_ENV: 'production', PORT: port },
      out_file: path.join(root, 'logs/web-out.log'),
      error_file: path.join(root, 'logs/web-err.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
