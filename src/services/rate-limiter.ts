/**
 * Rate Limiter Service
 * Manages rate limiting for bot users
 */

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

export class RateLimiter {
    private store: Map<string, RateLimitEntry>;
    private config: RateLimitConfig;

    constructor(config: RateLimitConfig = { windowMs: 60 * 1000, maxRequests: 5 }) {
        this.store = new Map();
        this.config = config;
    }

    /**
     * Check if a key is rate limited
     * Returns true if allowed, false if limited
     */
    check(key: string): boolean {
        const now = Date.now();
        const entry = this.store.get(key);

        if (!entry) {
            this.store.set(key, {
                count: 1,
                resetTime: now + this.config.windowMs,
            });
            return true;
        }

        if (now > entry.resetTime) {
            // Window expired, reset
            this.store.set(key, {
                count: 1,
                resetTime: now + this.config.windowMs,
            });
            return true;
        }

        if (entry.count < this.config.maxRequests) {
            entry.count++;
            return true;
        }

        return false;
    }

    /**
     * Get remaining requests for a key
     */
    getRemaining(key: string): number {
        const now = Date.now();
        const entry = this.store.get(key);

        if (!entry || now > entry.resetTime) {
            return this.config.maxRequests;
        }

        return Math.max(0, this.config.maxRequests - entry.count);
    }

    /**
     * Reset limit for a key
     */
    reset(key: string): void {
        this.store.delete(key);
    }

    /**
     * Clean up expired entries
     */
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.resetTime) {
                this.store.delete(key);
            }
        }
    }
}
