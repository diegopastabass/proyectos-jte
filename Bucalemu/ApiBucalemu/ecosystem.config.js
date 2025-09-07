module.exports = {
  apps: [
    {
      name: "bucalemu_api",
      script: "dist/main.js",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
