/**
 * FTP/SFTP scan strategy
 * Scans remote FTP directory for music files
 */

import { Client } from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';
import type { ScanStrategy } from '../playlist-generator';
import { filterAudioFiles } from '../playlist-generator';
import { SUPPORTED_AUDIO_EXTENSIONS } from '../../constants';

export interface FTPStrategyConfig {
  host: string;
  user: string;
  password: string;
  useSFTP?: boolean;
}

export class FTPStrategy implements ScanStrategy {
  private config: FTPStrategyConfig;

  constructor(config: FTPStrategyConfig) {
    this.config = config;
  }

  /**
   * List directories in the base path
   */
  async listDirectories(basePath: string): Promise<string[]> {
    if (this.config.useSFTP) {
      return await this.listDirectoriesSFTP(basePath);
    } else {
      return await this.listDirectoriesFTP(basePath);
    }
  }

  /**
   * List audio files in a directory
   */
  async listAudioFiles(directoryPath: string): Promise<string[]> {
    if (this.config.useSFTP) {
      return await this.listAudioFilesSFTP(directoryPath);
    } else {
      return await this.listAudioFilesFTP(directoryPath);
    }
  }

  /**
   * Check if a path exists
   */
  async pathExists(pathToCheck: string): Promise<boolean> {
    // For FTP, assume path exists if we can list it
    try {
      await this.listDirectories(pathToCheck);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List directories using SFTP
   */
  private async listDirectoriesSFTP(basePath: string): Promise<string[]> {
    const client = new SftpClient();
    try {
      await client.connect({
        host: this.config.host,
        username: this.config.user,
        password: this.config.password,
        port: 22,
      });

      const directories = await client.list(basePath);
      return directories
        .filter((item: any) => item.type === 'd' && item.name !== '.' && item.name !== '..')
        .map((item: any) => item.name);
    } finally {
      await client.end();
    }
  }

  /**
   * List directories using FTP
   */
  private async listDirectoriesFTP(basePath: string): Promise<string[]> {
    const client = new Client();
    client.ftp.verbose = false;
    try {
      await client.access({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
        secure: false,
        timeout: 30000,
      });

      const directories = await client.list(basePath);
      return directories
        .filter((item: any) => item.isDirectory && item.name !== '.' && item.name !== '..')
        .map((item: any) => item.name);
    } finally {
      client.close();
    }
  }

  /**
   * List audio files using SFTP
   */
  private async listAudioFilesSFTP(directoryPath: string): Promise<string[]> {
    const client = new SftpClient();
    try {
      await client.connect({
        host: this.config.host,
        username: this.config.user,
        password: this.config.password,
        port: 22,
      });

      const files = await client.list(directoryPath);
      return files
        .filter((file: any) => {
          const ext = file.name.split('.').pop()?.toLowerCase();
          return file.type === '-' && SUPPORTED_AUDIO_EXTENSIONS.includes(ext as any);
        })
        .map((file: any) => file.name);
    } finally {
      await client.end();
    }
  }

  /**
   * List audio files using FTP
   */
  private async listAudioFilesFTP(directoryPath: string): Promise<string[]> {
    const client = new Client();
    client.ftp.verbose = false;
    try {
      await client.access({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
        secure: false,
        timeout: 30000,
      });

      const files = await client.list(directoryPath);
      return files
        .filter((file: any) => {
          const ext = file.name.split('.').pop()?.toLowerCase();
          return !file.isDirectory && SUPPORTED_AUDIO_EXTENSIONS.includes(ext as any);
        })
        .map((file: any) => file.name);
    } finally {
      client.close();
    }
  }
}

