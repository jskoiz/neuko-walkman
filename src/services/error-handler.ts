/**
 * Centralized Error Handler Service
 * Standardizes error logging and user notification
 */

import { AppError } from '../types/errors';
import { ERROR_MESSAGES } from '../constants';

export interface ErrorContext {
    userId?: number;
    username?: string;
    chatId?: number;
    action?: string;
    details?: any;
}

export class ErrorHandler {
    /**
     * Handle an error, log it, and return a user-friendly message
     */
    static handle(error: any, context?: ErrorContext): string {
        const timestamp = new Date().toISOString();
        const errorName = error.name || 'Error';
        const errorMessage = error.message || 'Unknown error';
        const stack = error.stack;

        // Log to console (could be replaced with a logging service)
        console.error(`[${timestamp}] [${errorName}] ${errorMessage}`);
        if (context) {
            console.error('Context:', JSON.stringify(context, null, 2));
        }
        if (stack) {
            console.error(stack);
        }

        // Determine user-friendly message
        if (error instanceof AppError) {
            // If it's a known app error, we might have a specific message map or just use the message
            // For now, we'll map common error codes to constants if needed
            return this.getUserMessage(error);
        }

        // Handle common system errors
        if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNRESET')) {
            return ERROR_MESSAGES.NETWORK_ERROR;
        }
        if (errorMessage.includes('timeout')) {
            return ERROR_MESSAGES.DOWNLOAD_TIMEOUT;
        }
        if (errorMessage.includes('File too large')) {
            return ERROR_MESSAGES.FILE_TOO_LARGE;
        }

        // Default message
        return 'An unexpected error occurred. Please try again later.';
    }

    /**
     * Get user-friendly message for AppError
     */
    private static getUserMessage(error: AppError): string {
        switch (error.code) {
            case 'DOWNLOAD_ERROR':
                return ERROR_MESSAGES.DOWNLOAD_FAILED;
            case 'FTP_ERROR':
                return ERROR_MESSAGES.FTP_ERROR;
            case 'VALIDATION_ERROR':
                return `Validation Error: ${error.message}`;
            case 'CONFIGURATION_ERROR':
                return ERROR_MESSAGES.SERVICE_UNAVAILABLE;
            default:
                return error.message;
        }
    }
}
