import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ValidationPipe, Logger } from '@nestjs/common';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // Habilitar compresión gzip/brotli para reducir ~70% el tamaño de las respuestas JSON
  app.use(compression());

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept',
  });
  const logger = new Logger('Bootstrap');
  await app.listen(3004);
  logger.log(`Application running on: ${await app.getUrl()}`);
}
bootstrap();
