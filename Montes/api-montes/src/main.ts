import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  // `time` es timestamp sin zona en hora de Chile: el driver pg lo interpreta en la zona del proceso.
  process.env.TZ ??= 'America/Santiago';
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD',
    allowedHeaders: 'Content-Type, Accept',
  });
  const logger = new Logger('Bootstrap');
  await app.listen(3020);
  logger.log(`Application running on: ${await app.getUrl()}`);
}
bootstrap();
