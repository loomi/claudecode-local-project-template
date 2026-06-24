import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<AppConfig, true>);

  const nodeEnv = config.get('nodeEnv', { infer: true });
  const corsOrigins = config.get('corsOrigins', { infer: true });
  const jwtAccessSecret = config.get('jwtAccessSecret', { infer: true });

  // SECURITY: refuse to boot production with the default JWT secret (root rule 6).
  if (nodeEnv === 'production' && jwtAccessSecret === 'dev-only-change-me') {
    throw new Error(
      'Refusing to start in production with the default JWT secret. Set JWT_ACCESS_SECRET.',
    );
  }
  if (nodeEnv !== 'production' && jwtAccessSecret === 'dev-only-change-me') {
    console.warn(
      'JWT_ACCESS_SECRET is the default dev value — set a 32+ char secret before deploying.',
    );
  }

  // Enable graceful shutdown so OnModuleDestroy (Prisma disconnect) fires on
  // SIGTERM/SIGINT — required for clean draining when Karpenter kills the pod.
  app.enableShutdownHooks();

  app.setGlobalPrefix('api');

  // CORS: open in dev / when no allow-list is set; locked to the configured
  // origins in production. An empty list in production stays open but warns.
  if (nodeEnv !== 'production' || corsOrigins.length === 0) {
    if (nodeEnv === 'production') {
      console.warn(
        'CORS is wide open in production — set CORS_ORIGINS to an allow-list.',
      );
    }
    app.enableCors({ origin: true, credentials: true });
  } else {
    app.enableCors({ origin: corsOrigins, credentials: true });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerPath = config.get('swaggerPath', { infer: true });
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Local Template API')
    .setDescription('REST API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(swaggerPath, app, document);

  const port = config.get('port', { infer: true });
  await app.listen(port);

  const url = await app.getUrl();

  console.log(`Application running on ${url}`);

  console.log(`Swagger docs at ${url}/${swaggerPath}`);
}

void bootstrap();
