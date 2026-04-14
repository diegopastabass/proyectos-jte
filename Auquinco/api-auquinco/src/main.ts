import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error'],
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept',
  });

  process.on('uncaughtException', (err) => {
    const log = `[${new Date().toISOString()}] Uncaught Exception: ${err.message}\n${err.stack}\n\n`;
    fs.appendFileSync('fatal-crashes.log', log);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    const log = `[${new Date().toISOString()}] Unhandled Rejection: ${reason}\n\n`;
    fs.appendFileSync('fatal-crashes.log', log);
  });

  const port = process.env.PORT || 3025;
  await app.listen(port);

  Logger.log(`Server running on http://localhost:${port}`);
}
bootstrap();
