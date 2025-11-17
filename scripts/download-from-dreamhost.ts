/**
 * Script to download a file from Dreamhost SFTP for local testing
 */

import SftpClient from 'ssh2-sftp-client';
import dotenv from 'dotenv';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

dotenv.config();

async function downloadFromDreamhost() {
  const ftpHost = process.env.DREAMHOST_FTP_HOST || 'files.bloc.rocks';
  const ftpUser = process.env.DREAMHOST_FTP_USER;
  const ftpPassword = process.env.DREAMHOST_FTP_PASSWORD;
  const ftpPath = process.env.DREAMHOST_FTP_PATH || '/public/music/community';
  const fileName = 'atarashii_gakko_-_tokyo_calling_official_music_video_.mp3';

  if (!ftpUser || !ftpPassword) {
    console.error('FTP credentials not configured');
    process.exit(1);
  }

  const client = new SftpClient();
  
  try {
    console.log(`Connecting to SFTP: ${ftpHost} as ${ftpUser}`);
    await client.connect({
      host: ftpHost,
      username: ftpUser,
      password: ftpPassword,
      port: 22,
    });

    console.log('SFTP connected successfully');

    const remoteFilePath = `${ftpPath}/${fileName}`;
    console.log(`Downloading: ${remoteFilePath}`);
    
    const buffer = await client.get(remoteFilePath);

    // Save to local community folder
    const localDir = join(process.cwd(), 'public', 'music', 'community');
    await mkdir(localDir, { recursive: true });
    const localPath = join(localDir, fileName);
    await writeFile(localPath, buffer);

    console.log(`Downloaded to: ${localPath}`);
    console.log(`File size: ${Math.round(buffer.length / 1024 / 1024 * 100) / 100}MB`);
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

downloadFromDreamhost();

