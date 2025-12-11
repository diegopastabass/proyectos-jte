module.exports = {
  apps: [
    {
      name: "zagal_api",
      script: "dist/main.js",
      instances: 2,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3003,
      },
    },
  ],
};
