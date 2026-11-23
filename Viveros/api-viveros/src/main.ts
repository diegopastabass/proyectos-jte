import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './metrics/filters/http-exception.filter';
import { ValidationPipe, Logger } from '@nestjs/common';

// Orígenes por defecto: el dashboard publicado y el servidor de desarrollo de Vite.
const ORIGENES_DEFECTO = [
  'https://jteanalytics.cl',
  'https://www.jteanalytics.cl',
  'https://app.jteanalytics.cl',
  'http://localhost:5173',
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : ORIGENES_DEFECTO,
    methods: 'GET,POST,PATCH',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });
  // Permite vaciar el buffer de métricas del POST antes de que pm2 detenga el proceso.
  app.enableShutdownHooks();
  const logger = new Logger('Bootstrap');
  await app.listen(3005);
  logger.log(`Application running on: ${await app.getUrl()}`);
}
bootstrap();
