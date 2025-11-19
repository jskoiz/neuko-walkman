/**
 * Local filesystem scan strategy
 * Scans local filesystem for music files
 */

import fs from 'fs';
import path from 'path';
import type { ScanStrategy } from '../playlist-generator';
import { filterAudioFiles } from '../playlist-generator';

export class LocalFileSystemStrategy implements ScanStrategy {
  /**
   * List directories in the base path
   */
  async listDirectories(basePath: string): Promise<string[]> {
    if (!fs.existsSync(basePath)) {
      return [];
    }

    const items = fs.readdirSync(basePath, { withFileTypes: true });
    return items
      .filter(item => item.isDirectory())
      .map(item => item.name);
  }

  /**
   * List audio files in a directory (recursively)
   */
  async listAudioFiles(directoryPath: string): Promise<string[]> {
    if (!fs.existsSync(directoryPath)) {
      return [];
    }

    const files: string[] = [];
    this.scanDirectoryRecursive(directoryPath, '', files);
    return files;
  }

  /**
   * Recursively scan directory for audio files
   */
  private scanDirectoryRecursive(dirPath: string, relativePath: string, files: string[]): void {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      const relativeFilePath = path.join(relativePath, item.name).replace(/\\/g, '/');

      if (item.isDirectory()) {
        // Recursively scan subdirectories
        this.scanDirectoryRecursive(fullPath, relativeFilePath, files);
      } else if (item.isFile()) {
        // Check if it's an audio file
        const ext = path.extname(item.name).toLowerCase();
        if (filterAudioFiles([item.name]).length > 0) {
          files.push(relativeFilePath);
        }
      }
    }
  }

  /**
   * Check if a path exists
   */
  async pathExists(pathToCheck: string): Promise<boolean> {
    return fs.existsSync(pathToCheck);
  }
}

