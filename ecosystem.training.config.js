module.exports = {
  apps: [{
    name: "hotel-training",
    script: "server.js",
    cwd: "/var/www/hotel-training/.next/standalone",
    env: {
      NODE_ENV: "production",
      PORT: 3012
    },
    env_file: "/var/www/hotel-training/.env.production.local",
    instances: 1,
    exec_mode: "fork",
    watch: false,
    max_memory_restart: "500M"
  }]
};
