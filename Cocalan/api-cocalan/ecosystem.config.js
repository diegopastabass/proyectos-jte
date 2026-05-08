module.exports = {
  apps: [
    {
      name: 'api-cocalan',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3029,
      },
    },
  ],
};
