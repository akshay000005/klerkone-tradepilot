import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  HOST: z.string().default('localhost'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.string().default('info'),

  // Supabase
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal('')),
  SUPABASE_ANON_KEY: z.string().optional().or(z.literal('')),

  // FYERS API v3
  FYERS_APP_ID: z.string().optional().or(z.literal('')),
  FYERS_SECRET_KEY: z.string().optional().or(z.literal('')),
  FYERS_REDIRECT_URI: z.string().default('http://localhost:5000/api/v1/broker/fyers/callback'),
  FYERS_ACCESS_TOKEN: z.string().optional().or(z.literal('')),

  // Trading Core Defaults
  DEFAULT_TRADING_MODE: z.enum(['BACKTEST', 'PAPER', 'LIVE']).default('PAPER'),
  DEFAULT_ALLOCATED_CAPITAL: z.coerce.number().default(50000),
  RISK_PER_TRADE_PERCENT: z.coerce.number().default(0.5),
  DAILY_LOSS_LIMIT_PERCENT: z.coerce.number().default(1.5),
  MAX_OPEN_POSITIONS: z.coerce.number().default(3),
  MAX_CAPITAL_UTILISATION_PERCENT: z.coerce.number().default(50.0),

  // Security
  DASHBOARD_AUTH_SECRET: z.string().default('default-tradepilot-secret-key-change-in-prod'),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  API_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(120),

  // AI Intelligence
  OPTIONAL_AI_PROVIDER: z.enum(['gemini', 'openai', 'anthropic', 'mock']).default('mock'),
  OPTIONAL_AI_API_KEY: z.string().optional().or(z.literal('')),
  OPTIONAL_AI_MODEL: z.string().default('gemini-1.5-flash'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment configuration validation error:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

/**
 * Redacts sensitive tokens/keys before logging to console or telemetry
 */
export function getRedactedConfig() {
  return {
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    DEFAULT_TRADING_MODE: env.DEFAULT_TRADING_MODE,
    ALLOCATED_CAPITAL: env.DEFAULT_ALLOCATED_CAPITAL,
    RISK_PER_TRADE_PERCENT: env.RISK_PER_TRADE_PERCENT,
    DAILY_LOSS_LIMIT_PERCENT: env.DAILY_LOSS_LIMIT_PERCENT,
    MAX_OPEN_POSITIONS: env.MAX_OPEN_POSITIONS,
    SUPABASE_CONFIGURED: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
    FYERS_CONFIGURED: Boolean(env.FYERS_APP_ID && env.FYERS_SECRET_KEY),
    FYERS_TOKEN_PRESENT: Boolean(env.FYERS_ACCESS_TOKEN),
    AI_PROVIDER: env.OPTIONAL_AI_PROVIDER,
  };
}
