import { z } from 'zod';
import { reportError } from '../observability/error-reporter.js';

export const configSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  SERVICE_NAME: z.string().default('verity'),

  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(1).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  ENABLE_EMAIL_VERIFICATION: z.enum(['true', 'false']).default('false'),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // AI Providers
  LLM_PROVIDER: z.enum(['mock', 'openai', 'anthropic', 'gemini']).default('mock'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  // Monitoring Thresholds
  ALERT_API_LATENCY_WARNING_MS: z.coerce.number().default(500),
  ALERT_API_LATENCY_CRITICAL_MS: z.coerce.number().default(2000),
  ALERT_DB_LATENCY_WARNING_MS: z.coerce.number().default(100),
  ALERT_DB_LATENCY_CRITICAL_MS: z.coerce.number().default(500),
  ALERT_QUEUE_DEPTH_WARNING: z.coerce.number().default(1000),
  ALERT_QUEUE_DEPTH_CRITICAL: z.coerce.number().default(5000),
  ALERT_QUEUE_WAIT_TIME_WARNING_MS: z.coerce.number().default(300000),
  ALERT_QUEUE_WAIT_TIME_CRITICAL_MS: z.coerce.number().default(1800000),
  ALERT_AI_GENERATION_WARNING_MS: z.coerce.number().default(30000),
  ALERT_AI_GENERATION_CRITICAL_MS: z.coerce.number().default(90000),
});

let parsedConfig: z.infer<typeof configSchema>;

try {
  // Try to parse process.env. We use .passthrough() internally if we need to let nextjs variables through, 
  // but configSchema filters strictly.
  parsedConfig = configSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    const msg = `❌ Invalid environment variables: ${issues}`;
    console.error(msg);
    // Exit immediately on invalid configuration in production/staging unless building
    const isBuildPhase = process.env.npm_lifecycle_event === 'build' || process.env.NEXT_PHASE === 'phase-production-build';
    
    if (process.env.NODE_ENV !== 'test' && !isBuildPhase) {
      process.exit(1);
    }
    // Fallback for tests or build phase if needed, using unknown to strictly cast
    parsedConfig = process.env as unknown as z.infer<typeof configSchema>;
  } else {
    throw error;
  }
}

export const config = {
  env: parsedConfig.NODE_ENV,
  serviceName: parsedConfig.SERVICE_NAME,
  
  database: {
    url: parsedConfig.DATABASE_URL,
  },
  
  auth: {
    secret: parsedConfig.BETTER_AUTH_SECRET ?? parsedConfig.SESSION_SECRET ?? '',
    url: parsedConfig.BETTER_AUTH_URL ?? parsedConfig.NEXT_PUBLIC_APP_URL,
    requireEmailVerification: parsedConfig.ENABLE_EMAIL_VERIFICATION === 'true',
    github: {
      clientId: parsedConfig.GITHUB_CLIENT_ID ?? '',
      clientSecret: parsedConfig.GITHUB_CLIENT_SECRET ?? '',
    }
  },

  ai: {
    provider: parsedConfig.LLM_PROVIDER,
    openaiKey: parsedConfig.OPENAI_API_KEY ?? '',
    anthropicKey: parsedConfig.ANTHROPIC_API_KEY ?? '',
    geminiKey: parsedConfig.GEMINI_API_KEY ?? '',
  },

  monitoring: {
    apiLatencyWarningMs: parsedConfig.ALERT_API_LATENCY_WARNING_MS,
    apiLatencyCriticalMs: parsedConfig.ALERT_API_LATENCY_CRITICAL_MS,
    dbLatencyWarningMs: parsedConfig.ALERT_DB_LATENCY_WARNING_MS,
    dbLatencyCriticalMs: parsedConfig.ALERT_DB_LATENCY_CRITICAL_MS,
    queueDepthWarning: parsedConfig.ALERT_QUEUE_DEPTH_WARNING,
    queueDepthCritical: parsedConfig.ALERT_QUEUE_DEPTH_CRITICAL,
    queueWaitTimeWarningMs: parsedConfig.ALERT_QUEUE_WAIT_TIME_WARNING_MS,
    queueWaitTimeCriticalMs: parsedConfig.ALERT_QUEUE_WAIT_TIME_CRITICAL_MS,
    aiGenerationWarningMs: parsedConfig.ALERT_AI_GENERATION_WARNING_MS,
    aiGenerationCriticalMs: parsedConfig.ALERT_AI_GENERATION_CRITICAL_MS,
  }
};
