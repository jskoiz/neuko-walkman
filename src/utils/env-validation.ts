/**
 * Environment variable validation utility
 * Validates required environment variables at startup and provides clear error messages
 * Supports both Node.js (process.env) and Astro/Vite (import.meta.env) contexts
 */

interface EnvContext {
  get: (key: string) => string | undefined;
  has: (key: string) => boolean;
}

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
 * Check if environment variable exists
 */
function hasEnvValue(key: string): boolean {
  return getEnvValue(key) !== undefined;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  missing: string[];
  errors: string[];
}

/**
 * Required environment variables for bot
 */
export const BOT_REQUIRED_ENV_VARS = [
  'TELEGRAM_BOT_TOKEN',
] as const;

/**
 * Required environment variables for FTP operations
 */
export const FTP_REQUIRED_ENV_VARS = [
  'DREAMHOST_FTP_USER',
  'DREAMHOST_FTP_PASSWORD',
] as const;

/**
 * Optional environment variables with defaults
 */
export interface OptionalEnvVars {
  DREAMHOST_FTP_HOST?: string;
  DREAMHOST_FTP_PATH?: string;
  DREAMHOST_USE_SFTP?: string;
  PUBLIC_SITE_URL?: string;
  SPOTIPY_CLIENT_ID?: string;
  SPOTIPY_CLIENT_SECRET?: string;
  MAX_FILE_SIZE?: string;
  AUDIO_QUALITY?: string;
  TELEGRAM_ADMIN_IDS?: string;
  PLAYLIST_UPDATE_TOKEN?: string;
  PLAYLIST_CACHE_TTL?: string;
}

/**
 * Validate required environment variables
 */
export function validateEnvVars(requiredVars: readonly string[]): ValidationResult {
  const missing: string[] = [];
  const errors: string[] = [];

  for (const varName of requiredVars) {
    if (!hasEnvValue(varName)) {
      missing.push(varName);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    errors,
  };
}

/**
 * Validate bot environment variables
 */
export function validateBotEnv(): ValidationResult {
  return validateEnvVars(BOT_REQUIRED_ENV_VARS);
}

/**
 * Validate FTP environment variables
 */
export function validateFTPEnv(): ValidationResult {
  return validateEnvVars(FTP_REQUIRED_ENV_VARS);
}

/**
 * Validate all environment variables (bot + FTP)
 */
export function validateAllEnv(): ValidationResult {
  const botResult = validateBotEnv();
  const ftpResult = validateFTPEnv();
  
  const missing = [...botResult.missing, ...ftpResult.missing];
  
  return {
    valid: missing.length === 0,
    missing,
    errors: [...botResult.errors, ...ftpResult.errors],
  };
}

/**
 * Get environment variable value with optional default
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = getEnvValue(key);
  if (value !== undefined) {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(`Environment variable ${key} is not set and no default value provided`);
}

/**
 * Get environment variable value or undefined
 */
export function getEnvOptional(key: string): string | undefined {
  return getEnvValue(key);
}

/**
 * Format validation error message
 */
export function formatValidationError(result: ValidationResult): string {
  if (result.valid) {
    return '';
  }
  
  const missingList = result.missing.map(v => `  - ${v}`).join('\n');
  return `Missing required environment variables:\n${missingList}\n\nPlease set these in your .env file or environment.`;
}

/**
 * Validate and throw if invalid (for startup)
 */
export function validateAndThrow(requiredVars: readonly string[], context: string = 'application'): void {
  const result = validateEnvVars(requiredVars);
  if (!result.valid) {
    const errorMessage = formatValidationError(result);
    console.error(`\n❌ ${context} startup failed:\n${errorMessage}`);
    process.exit(1);
  }
}

