module.exports = {
  apps: [
    {
      name: 'api-olivar',
      script: 'dist/main.js',
      instances: 2,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
      },
    },
  ],
};
