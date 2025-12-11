import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: '*',
    methods: 'GET,POST,PATCH',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });
  const logger = new Logger('Bootstrap');
  await app.listen(3002);
  logger.log(`Application running on: ${await app.getUrl()}`);
}
bootstrap();
