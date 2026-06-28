import { z } from 'zod';

const envSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().min(1, 'Firebase API Key is required'),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'Firebase Auth Domain is required'),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase Project ID is required'),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1, 'Firebase Storage Bucket is required'),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, 'Firebase Messaging Sender ID is required'),
  VITE_FIREBASE_APP_ID: z.string().min(1, 'Firebase App ID is required'),
  VITE_TEST_MODE: z.enum(['true', 'false']).optional().default('false'),
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_APP_VERSION: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(import.meta.env);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const messages = Object.entries(errors)
      .map(([key, vals]) => `${key}: ${vals.join(', ')}`)
      .join('\n');

    console.error('❌ Invalid environment variables:\n', messages);

    if (import.meta.env.PROD) {
      throw new Error(`Invalid environment configuration:\n${messages}`);
    }

    return {
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_AUTH_DOMAIN: '',
      VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_STORAGE_BUCKET: '',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '',
      VITE_FIREBASE_APP_ID: '',
      VITE_TEST_MODE: 'false',
    };
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function isTestMode(): boolean {
  return getEnv().VITE_TEST_MODE === 'true';
}

export function getAppVersion(): string {
  return getEnv().VITE_APP_VERSION || '0.0.0-dev';
}