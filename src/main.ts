import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { PrismaClientExceptionFilter } from './filters/PrismaClientExceptionFilter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''));
  app.enableCors({
    origin: (origin, callback) => {
      const normalized = (origin || '').replace(/\/+$/, '');
      if (!origin || allowedOrigins.includes(normalized)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new PrismaClientExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error('Error al iniciar la aplicación', err);
  process.exit(1);
});
