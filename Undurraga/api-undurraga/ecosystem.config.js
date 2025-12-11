module.exports = {
  apps: [
    {
      name: 'api-undurraga',
      script: 'dist/src/main.js',
      instances: 2,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
  ],
};
