module.exports = {
  apps: [
    {
      name: 'api-zunigamediciones',
      script: 'dist/main.js',
      instances: 2,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3017,
      },
    },
  ],
};
