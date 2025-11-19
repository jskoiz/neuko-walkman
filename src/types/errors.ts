/**
 * Custom error types for the application
 */

export class AppError extends Error {
    constructor(message: string, public code: string, public statusCode: number = 500) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class DownloadError extends AppError {
    constructor(message: string, public originalError?: any) {
        super(message, 'DOWNLOAD_ERROR', 500);
    }
}

export class FTPError extends AppError {
    constructor(message: string, public originalError?: any) {
        super(message, 'FTP_ERROR', 502);
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR', 400);
    }
}

export class ConfigurationError extends AppError {
    constructor(message: string) {
        super(message, 'CONFIGURATION_ERROR', 500);
    }
}
