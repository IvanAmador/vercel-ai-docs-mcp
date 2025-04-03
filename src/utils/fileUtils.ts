import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

export class FileUtils {
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsp.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  static async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fsp.stat(dirPath);
      return stats.isDirectory();
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fsp.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  static async readFile(filePath: string): Promise<string> {
    return fsp.readFile(filePath, 'utf-8');
  }

  static async writeFile(filePath: string, content: string): Promise<void> {
    await this.ensureDirectoryExists(path.dirname(filePath));
    await fsp.writeFile(filePath, content, 'utf-8');
  }

  static async listFiles(directory: string, extension?: string): Promise<string[]> {
    try {
      const files = await fsp.readdir(directory);
      if (extension) {
        return files.filter(file => file.endsWith(extension));
      }
      return files;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return []; // Directory doesn't exist, return empty list
      }
      throw error;
    }
  }

  static async removeDirectory(dirPath: string): Promise<void> {
    await fsp.rm(dirPath, { recursive: true, force: true });
  }

  static async generateHash(content: string, algorithm: string = 'sha256'): Promise<string> {
    return createHash(algorithm).update(content).digest('hex');
  }
}