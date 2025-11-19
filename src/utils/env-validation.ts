/**
 * Environment variable validation utility
 * Validates required environment variables at startup and provides clear error messages
 * Supports both Node.js (process.env) and Astro/Vite (import.meta.env) contexts
 */

import { z } from 'zod';
import { ValidationError } from '../types/errors';

/**
 * Get environment variable from either process.env or import.meta.env
 */
function getEnvValue(key: string): string | undefined {
  // Try process.env first (Node.js context)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }

  // Try import.meta.env (Astro/Vite context)
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch {
    // import.meta not available, that's okay
  }

  return undefined;
}

/**
 * Environment Schema Definition
 */
const envSchema = z.object({
  // Bot Configuration
  TELEGRAM_BOT_TOKEN: z.string().min(1, "Bot token is required"),
  TELEGRAM_ADMIN_IDS: z.string().optional(),

  // FTP Configuration
  DREAMHOST_FTP_USER: z.string().min(1, "FTP user is required"),
  DREAMHOST_FTP_PASSWORD: z.string().min(1, "FTP password is required"),
  DREAMHOST_FTP_HOST: z.string().default('ftp.dreamhost.com'),
  DREAMHOST_FTP_PATH: z.string().optional(),
  DREAMHOST_USE_SFTP: z.enum(['true', 'false']).optional().default('false'),

  // App Configuration
  PUBLIC_SITE_URL: z.string().url().optional(),
  MAX_FILE_SIZE: z.string().regex(/^\d+$/, "Must be a number").optional(),
  AUDIO_QUALITY: z.string().optional(),

  // Spotify Configuration (Optional)
  SPOTIPY_CLIENT_ID: z.string().optional(),
  SPOTIPY_CLIENT_SECRET: z.string().optional(),

  // Other
  PLAYLIST_UPDATE_TOKEN: z.string().optional(),
  PLAYLIST_CACHE_TTL: z.string().regex(/^\d+$/, "Must be a number").optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  missing: string[];
  errors: string[];
  config?: EnvConfig;
}

/**
 * Collect all environment variables into an object for validation
 */
function collectEnvVars(): Record<string, any> {
  const vars: Record<string, any> = {};
  // We only collect keys defined in the schema to avoid polluting with system env vars
  const schemaKeys = Object.keys(envSchema.shape);

  for (const key of schemaKeys) {
    const value = getEnvValue(key);
    if (value !== undefined) {
      vars[key] = value;
    }
  }

  return vars;
}

/**
 * Validate all environment variables
 */
export function validateEnv(): ValidationResult {
  const envVars = collectEnvVars();
  const result = envSchema.safeParse(envVars);

  if (result.success) {
    return {
      valid: true,
      missing: [],
      errors: [],
      config: result.data,
    };
  }

  const missing: string[] = [];
  const errors: string[] = [];

  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    if (issue.code === 'invalid_type' && issue.received === 'undefined') {
      missing.push(path);
    } else {
      errors.push(`${path}: ${issue.message}`);
    }
  }

  return {
    valid: false,
    missing,
    errors,
  };
}

/**
 * Validate and throw if invalid (for startup)
 */
export function validateAndThrow(context: string = 'application'): EnvConfig {
  const result = validateEnv();

  if (!result.valid) {
    let errorMessage = `❌ ${context} startup failed:\n`;

    if (result.missing.length > 0) {
      errorMessage += `Missing required environment variables:\n${result.missing.map(v => `  - ${v}`).join('\n')}\n`;
    }

    if (result.errors.length > 0) {
      errorMessage += `Validation errors:\n${result.errors.map(e => `  - ${e}`).join('\n')}\n`;
    }

    console.error(errorMessage);

    // Only exit if we are in a Node.js environment (not browser/client-side)
    if (typeof process !== 'undefined' && process.exit) {
      process.exit(1);
    }

    throw new ValidationError(errorMessage);
  }

  return result.config!;
}

/**
 * Get a validated environment variable
 * Throws if validation hasn't run or if variable is invalid
 */
export function getEnv(key: keyof EnvConfig): string {
  const value = getEnvValue(key);
  if (value === undefined) {
    // This should ideally be caught by validateAndThrow at startup
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

// Re-export for backward compatibility if needed, but prefer validateEnv
export const validateBotEnv = validateEnv;
export const validateFTPEnv = validateEnv;
export const validateAllEnv = validateEnv;
