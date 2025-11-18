/**
 * Script to upload all local music files to Dreamhost FTP/SFTP
 * Maintains directory structure on remote server
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { Readable } from 'stream';
import { Client } from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';
import dotenv from 'dotenv';

dotenv.config();

interface UploadOptions {
  host: string;
  user: string;
  password: string;
  baseRemotePath: string;
  useSFTP?: boolean;
}

/**
 * Upload a single file via FTP
 */
async function uploadFileViaFTP(
  localPath: string,
  remotePath: string,
  options: UploadOptions
): Promise<void> {
  const client = new Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: options.host,
      user: options.user,
      password: options.password,
      secure: false,
      timeout: 30000,
    });

    // Ensure remote directory exists
    const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
    await client.ensureDir(remoteDir);

    // Read file and upload
    const fileBuffer = await readFile(localPath);
    const stream = Readable.from(fileBuffer);
    await client.uploadFrom(stream, remotePath);

    console.log(`✅ Uploaded: ${remotePath}`);
  } finally {
    client.close();
  }
}

/**
 * Upload a single file via SFTP
 */
async function uploadFileViaSFTP(
  localPath: string,
  remotePath: string,
  options: UploadOptions
): Promise<void> {
  const client = new SftpClient();

  try {
    await client.connect({
      host: options.host,
      username: options.user,
      password: options.password,
      port: 22,
    });

    // Ensure remote directory exists
    const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
    await client.mkdir(remoteDir, true);

    // Read file and upload
    const fileBuffer = await readFile(localPath);
    await client.put(fileBuffer, remotePath);

    console.log(`✅ Uploaded: ${remotePath}`);
  } finally {
    await client.end();
  }
}

/**
 * Upload a single file
 */
async function uploadFile(
  localPath: string,
  remotePath: string,
  options: UploadOptions
): Promise<void> {
  if (options.useSFTP) {
    await uploadFileViaSFTP(localPath, remotePath, options);
  } else {
    try {
      await uploadFileViaFTP(localPath, remotePath, options);
    } catch (error: any) {
      // Fallback to SFTP if FTP fails
      if (error.message.includes('530') || error.message.includes('Login incorrect')) {
        console.log('FTP login failed, trying SFTP...');
        await uploadFileViaSFTP(localPath, remotePath, options);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Recursively upload all files in a directory
 */
async function uploadDirectory(
  localDir: string,
  remoteDir: string,
  options: UploadOptions
): Promise<number> {
  let uploadCount = 0;

  try {
    const entries = await readdir(localDir, { withFileTypes: true });

    for (const entry of entries) {
      const localPath = join(localDir, entry.name);
      const remotePath = `${remoteDir}/${entry.name}`;

      if (entry.isDirectory()) {
        // Recursively upload subdirectory
        uploadCount += await uploadDirectory(localPath, remotePath, options);
      } else if (entry.isFile()) {
        // Upload file
        const fileStat = await stat(localPath);
        const fileSizeMB = (fileStat.size / 1024 / 1024).toFixed(2);
        console.log(`📤 Uploading ${entry.name} (${fileSizeMB}MB)...`);
        
        await uploadFile(localPath, remotePath, options);
        uploadCount++;
      }
    }
  } catch (error: any) {
    console.error(`Error processing directory ${localDir}:`, error.message);
  }

  return uploadCount;
}

/**
 * Main upload function
 */
async function uploadAllMusicFiles() {
  const ftpHost = process.env.DREAMHOST_FTP_HOST || 'files.bloc.rocks';
  const ftpUser = process.env.DREAMHOST_FTP_USER;
  const ftpPassword = process.env.DREAMHOST_FTP_PASSWORD;
  const basePath = process.env.DREAMHOST_FTP_PATH?.replace(/\/[^/]+$/, '') || '/public/music';
  const useSFTP = process.env.DREAMHOST_USE_SFTP === 'true';

  if (!ftpUser || !ftpPassword) {
    console.error('❌ FTP credentials not configured');
    console.error('Please set DREAMHOST_FTP_USER and DREAMHOST_FTP_PASSWORD environment variables');
    process.exit(1);
  }

  const localMusicDir = join(process.cwd(), 'public', 'music');

  console.log('🚀 Starting upload to Dreamhost...');
  console.log(`📁 Local directory: ${localMusicDir}`);
  console.log(`🌐 Remote base path: ${basePath}`);
  console.log(`🔐 Using ${useSFTP ? 'SFTP' : 'FTP'}...`);
  console.log('');

  const options: UploadOptions = {
    host: ftpHost,
    user: ftpUser,
    password: ftpPassword,
    baseRemotePath: basePath,
    useSFTP: useSFTP,
  };

  try {
    const uploadCount = await uploadDirectory(localMusicDir, basePath, options);
    console.log('');
    console.log(`✨ Upload complete! ${uploadCount} file(s) uploaded successfully.`);
  } catch (error: any) {
    console.error('');
    console.error('❌ Upload failed:', error.message);
    process.exit(1);
  }
}

// Run the upload
uploadAllMusicFiles();

