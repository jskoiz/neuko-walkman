/**
 * Upload service for Dreamhost FTP
 */

import { Client } from 'basic-ftp';
import { Readable } from 'stream';
import SftpClient from 'ssh2-sftp-client';
import { FTP_TIMEOUT, ERROR_MESSAGES } from '../constants';

interface UploadOptions {
  host: string;
  user: string;
  password: string;
  remotePath: string;
  useSFTP?: boolean; // Default to false (FTP), set to true for SFTP
}

/**
 * Upload a file buffer to Dreamhost via FTP or SFTP
 */
/**
 * Upload a file buffer, stream, or file path to Dreamhost via FTP or SFTP
 */
export async function uploadToDreamhost(
  input: Buffer | Readable | string,
  fileName: string,
  options: UploadOptions
): Promise<string> {
  // Sanitize filename one more time before upload
  const sanitizedFileName = sanitizeFileName(fileName);

  // Try SFTP first if useSFTP is true, otherwise try FTP
  if (options.useSFTP) {
    return await uploadViaSFTP(input, sanitizedFileName, options);
  } else {
    // Try FTP first, fallback to SFTP on login error
    try {
      return await uploadViaFTP(input, sanitizedFileName, options);
    } catch (error: any) {
      // If FTP login fails, try SFTP as fallback
      if (error.message.includes('530') || error.message.includes('Login incorrect')) {
        console.log(`[${new Date().toISOString()}] FTP login failed, trying SFTP...`);
        return await uploadViaSFTP(input, sanitizedFileName, options);
      }
      throw error;
    }
  }
}

/**
 * Upload via FTP
 */
async function uploadViaFTP(
  input: Buffer | Readable | string,
  fileName: string,
  options: UploadOptions
): Promise<string> {
  const client = new Client();
  client.ftp.verbose = false; // Set to true for debugging

  try {
    console.log(`[${new Date().toISOString()}] Connecting to FTP: ${options.host} as ${options.user}`);

    // Connect to FTP server with timeout
    await client.access({
      host: options.host,
      user: options.user,
      password: options.password,
      secure: false, // Use plain FTP
      timeout: FTP_TIMEOUT,
    });

    console.log(`[${new Date().toISOString()}] FTP connected successfully`);

    // Ensure remote directory exists
    try {
      await client.ensureDir(options.remotePath);
      console.log(`[${new Date().toISOString()}] Directory ensured: ${options.remotePath}`);
    } catch (error) {
      // Directory might already exist, that's okay
      console.log(`[${new Date().toISOString()}] Directory check:`, error);
    }

    // Prepare source for upload
    let source: Readable | string;
    if (Buffer.isBuffer(input)) {
      source = Readable.from(input);
    } else {
      source = input;
    }

    // Upload file
    const remoteFilePath = `${options.remotePath}/${fileName}`;
    console.log(`[${new Date().toISOString()}] Uploading file to: ${remoteFilePath}`);
    await client.uploadFrom(source, remoteFilePath);

    console.log(`[${new Date().toISOString()}] FTP upload complete`);
    return remoteFilePath;
  } catch (error: any) {
    if (error.message.includes('timeout')) {
      throw new Error(ERROR_MESSAGES.FTP_ERROR);
    }
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error(ERROR_MESSAGES.FTP_ERROR);
    }
    throw error;
  } finally {
    client.close();
  }
}

/**
 * Upload via SFTP
 */
async function uploadViaSFTP(
  input: Buffer | Readable | string,
  fileName: string,
  options: UploadOptions
): Promise<string> {
  const client = new SftpClient();

  try {
    console.log(`[${new Date().toISOString()}] Connecting to SFTP: ${options.host} as ${options.user}`);

    await client.connect({
      host: options.host,
      username: options.user,
      password: options.password,
      port: 22, // SFTP default port
    });

    console.log(`[${new Date().toISOString()}] SFTP connected successfully`);

    // Ensure remote directory exists
    try {
      await client.mkdir(options.remotePath, true); // recursive
      console.log(`[${new Date().toISOString()}] Directory ensured: ${options.remotePath}`);
    } catch (error: any) {
      // Directory might already exist, that's okay
      if (!error.message.includes('exists')) {
        console.log(`[${new Date().toISOString()}] Directory check:`, error);
      }
    }

    // Upload file
    const remoteFilePath = `${options.remotePath}/${fileName}`;
    console.log(`[${new Date().toISOString()}] Uploading file to: ${remoteFilePath}`);
    await client.put(input, remoteFilePath);

    console.log(`[${new Date().toISOString()}] SFTP upload complete`);
    return remoteFilePath;
  } catch (error: any) {
    if (error.message.includes('timeout')) {
      throw new Error(ERROR_MESSAGES.FTP_ERROR);
    }
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error(ERROR_MESSAGES.FTP_ERROR);
    }
    throw new Error(`SFTP upload failed: ${error.message}`);
  } finally {
    await client.end();
  }
}

/**
 * Sanitize filename to remove special characters and ensure safety
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .substring(0, 255) // Limit length
    .toLowerCase(); // Convert to lowercase for consistency
}

/**
 * Delete a file from Dreamhost via FTP or SFTP
 */
export async function deleteFromDreamhost(
  fileName: string,
  options: UploadOptions
): Promise<void> {
  // Normalize filename to lowercase to match how files are stored on server
  // (uploaded files are sanitized and converted to lowercase via sanitizeFileName)
  const normalizedFileName = fileName.toLowerCase();
  const remoteFilePath = `${options.remotePath}/${normalizedFileName}`;

  if (options.useSFTP) {
    await deleteViaSFTP(remoteFilePath, options);
  } else {
    // Try FTP first, fallback to SFTP on login error
    try {
      await deleteViaFTP(remoteFilePath, options);
    } catch (error: any) {
      // If FTP login fails, try SFTP as fallback
      if (error.message.includes('530') || error.message.includes('Login incorrect')) {
        console.log(`[${new Date().toISOString()}] FTP login failed, trying SFTP...`);
        await deleteViaSFTP(remoteFilePath, options);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Delete file via FTP
 */
async function deleteViaFTP(
  remoteFilePath: string,
  options: UploadOptions
): Promise<void> {
  const client = new Client();
  client.ftp.verbose = false;

  try {
    console.log(`[${new Date().toISOString()}] Connecting to FTP: ${options.host} as ${options.user}`);

    await client.access({
      host: options.host,
      user: options.user,
      password: options.password,
      secure: false,
      timeout: FTP_TIMEOUT,
    });

    console.log(`[${new Date().toISOString()}] FTP connected successfully`);
    console.log(`[${new Date().toISOString()}] Deleting file: ${remoteFilePath}`);

    await client.remove(remoteFilePath);

    console.log(`[${new Date().toISOString()}] FTP delete complete`);
  } catch (error: any) {
    if (error.message.includes('timeout')) {
      throw new Error(ERROR_MESSAGES.FTP_ERROR);
    }
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error(ERROR_MESSAGES.FTP_ERROR);
    }
    if (error.message.includes('550') || error.message.includes('not found')) {
      throw new Error('File not found on server.');
    }
    throw error;
  } finally {
    client.close();
  }
}

/**
 * Delete file via SFTP
 */
async function deleteViaSFTP(
  remoteFilePath: string,
  options: UploadOptions
): Promise<void> {
  const client = new SftpClient();

  try {
    console.log(`[${new Date().toISOString()}] Connecting to SFTP: ${options.host} as ${options.user}`);

    await client.connect({
      host: options.host,
      username: options.user,
      password: options.password,
      port: 22,
    });

    console.log(`[${new Date().toISOString()}] SFTP connected successfully`);
    console.log(`[${new Date().toISOString()}] Deleting file: ${remoteFilePath}`);

    await client.delete(remoteFilePath);

    console.log(`[${new Date().toISOString()}] SFTP delete complete`);
  } catch (error: any) {
    if (error.message.includes('timeout')) {
      throw new Error(ERROR_MESSAGES.FTP_ERROR);
    }
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error(ERROR_MESSAGES.FTP_ERROR);
    }
    if (error.message.includes('No such file') || error.message.includes('not found')) {
      throw new Error('File not found on server.');
    }
    throw new Error(`SFTP delete failed: ${error.message}`);
  } finally {
    await client.end();
  }
}

/**
 * Test FTP connection
 */
export async function testFTPConnection(options: UploadOptions): Promise<boolean> {
  const client = new Client();

  try {
    await client.access({
      host: options.host,
      user: options.user,
      password: options.password,
      secure: false,
    });

    await client.list();
    return true;
  } catch (error) {
    console.error('FTP connection test failed:', error);
    return false;
  } finally {
    client.close();
  }
}

