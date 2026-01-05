module.exports = {
  apps: [
    {
      name: 'api-mantenimiento',
      script: 'dist/main.js',
      instances: 2,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3013,
      },
    },
  ],
};
