import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from the repository root, regardless of the working directory
// the backend was started from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 4000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: num(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'routeview',
    connectionLimit: 10
  },
  ml: { url: process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000' },
  ai: {
    key: process.env.OPENROUTER_API_KEY || '',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct',
    appName: process.env.OPENROUTER_APP_NAME || 'RouteView',
    appUrl: process.env.OPENROUTER_APP_URL || 'http://localhost:3000',
    timeoutMs: num(process.env.AI_REQUEST_TIMEOUT_MS, 25000),
    ratePerMin: num(process.env.AI_RATE_LIMIT_PER_MIN, 20)
  }
};