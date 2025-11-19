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
  private ftpClient: Client | null = null;
  private sftpClient: SftpClient | null = null;
  private connected: boolean = false;

  constructor(config: FTPStrategyConfig) {
    this.config = config;
  }

  /**
   * Connect to the server
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    if (this.config.useSFTP) {
      this.sftpClient = new SftpClient();
      await this.sftpClient.connect({
        host: this.config.host,
        username: this.config.user,
        password: this.config.password,
        port: 22,
      });
    } else {
      this.ftpClient = new Client();
      this.ftpClient.ftp.verbose = false;
      await this.ftpClient.access({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
        secure: false,
      });
    }
    this.connected = true;
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    if (this.sftpClient) {
      await this.sftpClient.end();
      this.sftpClient = null;
    }
    if (this.ftpClient) {
      this.ftpClient.close();
      this.ftpClient = null;
    }
    this.connected = false;
  }

  /**
   * Ensure connection exists
   */
  private async ensureConnection(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  /**
   * List directories in the base path
   */
  async listDirectories(basePath: string): Promise<string[]> {
    await this.ensureConnection();

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
    await this.ensureConnection();

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
    if (!this.sftpClient) throw new Error('SFTP client not connected');

    const directories = await this.sftpClient.list(basePath);
    return directories
      .filter((item: any) => item.type === 'd' && item.name !== '.' && item.name !== '..')
      .map((item: any) => item.name);
  }

  /**
   * List directories using FTP
   */
  private async listDirectoriesFTP(basePath: string): Promise<string[]> {
    if (!this.ftpClient) throw new Error('FTP client not connected');

    const directories = await this.ftpClient.list(basePath);
    return directories
      .filter((item: any) => item.isDirectory && item.name !== '.' && item.name !== '..')
      .map((item: any) => item.name);
  }

  /**
   * List audio files using SFTP
   */
  private async listAudioFilesSFTP(directoryPath: string): Promise<string[]> {
    if (!this.sftpClient) throw new Error('SFTP client not connected');

    const files = await this.sftpClient.list(directoryPath);
    return files
      .filter((file: any) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        return file.type === '-' && SUPPORTED_AUDIO_EXTENSIONS.includes(ext as any);
      })
      .map((file: any) => file.name);
  }

  /**
   * List audio files using FTP
   */
  private async listAudioFilesFTP(directoryPath: string): Promise<string[]> {
    if (!this.ftpClient) throw new Error('FTP client not connected');

    const files = await this.ftpClient.list(directoryPath);
    return files
      .filter((file: any) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        return !file.isDirectory && SUPPORTED_AUDIO_EXTENSIONS.includes(ext as any);
      })
      .map((file: any) => file.name);
  }
}



