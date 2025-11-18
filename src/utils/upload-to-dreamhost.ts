/**
 * Upload service for Dreamhost FTP
 */

import { Client } from 'basic-ftp';
import { Readable } from 'stream';
import SftpClient from 'ssh2-sftp-client';

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
export async function uploadToDreamhost(
  buffer: Buffer,
  fileName: string,
  options: UploadOptions
): Promise<string> {
  // Sanitize filename one more time before upload
  const sanitizedFileName = sanitizeFileName(fileName);
  
  // Try SFTP first if useSFTP is true, otherwise try FTP
  if (options.useSFTP) {
    return await uploadViaSFTP(buffer, sanitizedFileName, options);
  } else {
    // Try FTP first, fallback to SFTP on login error
    try {
      return await uploadViaFTP(buffer, sanitizedFileName, options);
    } catch (error: any) {
      // If FTP login fails, try SFTP as fallback
      if (error.message.includes('530') || error.message.includes('Login incorrect')) {
        console.log(`[${new Date().toISOString()}] FTP login failed, trying SFTP...`);
        return await uploadViaSFTP(buffer, sanitizedFileName, options);
      }
      throw error;
    }
  }
}

/**
 * Upload via FTP
 */
async function uploadViaFTP(
  buffer: Buffer,
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
      timeout: 30000, // 30 second timeout
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

    // Create readable stream from buffer
    const stream = Readable.from(buffer);

    // Upload file
    const remoteFilePath = `${options.remotePath}/${fileName}`;
    console.log(`[${new Date().toISOString()}] Uploading file to: ${remoteFilePath}`);
    await client.uploadFrom(stream, remoteFilePath);

    console.log(`[${new Date().toISOString()}] FTP upload complete`);
    return remoteFilePath;
  } catch (error: any) {
    if (error.message.includes('timeout')) {
      throw new Error('FTP connection timed out. Please try again.');
    }
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error('Could not connect to FTP server. Please check server configuration.');
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
  buffer: Buffer,
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
    await client.put(buffer, remoteFilePath);

    console.log(`[${new Date().toISOString()}] SFTP upload complete`);
    return remoteFilePath;
  } catch (error: any) {
    if (error.message.includes('timeout')) {
      throw new Error('SFTP connection timed out. Please try again.');
    }
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error('Could not connect to SFTP server. Please check server configuration.');
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
  const remoteFilePath = `${options.remotePath}/${fileName}`;
  
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
      timeout: 30000,
    });

    console.log(`[${new Date().toISOString()}] FTP connected successfully`);
    console.log(`[${new Date().toISOString()}] Deleting file: ${remoteFilePath}`);
    
    await client.remove(remoteFilePath);

    console.log(`[${new Date().toISOString()}] FTP delete complete`);
  } catch (error: any) {
    if (error.message.includes('timeout')) {
      throw new Error('FTP connection timed out. Please try again.');
    }
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error('Could not connect to FTP server. Please check server configuration.');
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
      throw new Error('SFTP connection timed out. Please try again.');
    }
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error('Could not connect to SFTP server. Please check server configuration.');
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

