import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'defaultSecret',
  expiration: process.env.JWT_EXPIRATION || '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'defaultRefreshSecret',
  refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
}));
