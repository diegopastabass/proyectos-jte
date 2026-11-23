module.exports = {
  apps: [
    {
      name: 'api-viveros',
      script: 'dist/main.js',
      // Una sola instancia: el buffer del POST y la caché de resúmenes viven en memoria.
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        TZ: 'America/Santiago',
      },
    },
  ],
};
