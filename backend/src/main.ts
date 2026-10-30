import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { ApiResponseInterceptor } from './common/http/api-response.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:8090').split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());

  const port = Number(process.env.PORT ?? 8091);
  await app.listen(port);
}

void bootstrap();
