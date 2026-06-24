export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  databaseProvider: 'sqlite' | 'postgresql';
  databaseUrl: string;
  swaggerPath: string;
  jwtAccessSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  corsOrigins: string[];
}

const resolveDatabaseProvider = (): AppConfig['databaseProvider'] => {
  const raw = process.env.DATABASE_PROVIDER;
  return raw === 'postgresql' ? 'postgresql' : 'sqlite';
};

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
  databaseProvider: resolveDatabaseProvider(),
  databaseUrl: process.env.DATABASE_URL ?? '',
  swaggerPath: process.env.SWAGGER_PATH ?? 'docs',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-only-change-me',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
});
