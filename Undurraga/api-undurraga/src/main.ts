import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: '*',
    methods: 'GET,POST,PATCH',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });
  // Al reiniciar (pm2), guarda las lecturas que quedan en el buffer antes de salir.
  app.enableShutdownHooks();
  const logger = new Logger('Bootstrap');
  await app.listen(3002);
  logger.log(`Application running on: ${await app.getUrl()}`);
}
bootstrap();
