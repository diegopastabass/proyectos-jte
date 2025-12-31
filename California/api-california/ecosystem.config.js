module.exports = {
  apps: [
    {
      name: 'api-california',
      script: 'dist/main.js',
      instances: 2,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3015,
      },
    },
  ],
};
