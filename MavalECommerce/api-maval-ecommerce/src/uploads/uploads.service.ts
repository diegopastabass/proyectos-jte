import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Service for managing file uploads on the filesystem.
 * Provides utility methods for file deletion and directory setup.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  /**
   * Deletes a file from the filesystem.
   * Handles errors gracefully — logs a warning if the file does not exist
   * or cannot be deleted, but does not throw.
   *
   * @param filePath - Relative or absolute path to the file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);
      await fs.unlink(absolutePath);
      this.logger.log(`Deleted file: ${absolutePath}`);
    } catch (error) {
      this.logger.warn(`Failed to delete file "${filePath}": ${error.message}`);
    }
  }

  /**
   * Ensures the uploads/products directory exists.
   * Creates it recursively if it does not exist.
   */
  async ensureUploadDir(): Promise<void> {
    const uploadDir = path.join(process.cwd(), 'uploads', 'products');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      this.logger.log(`Upload directory ensured: ${uploadDir}`);
    } catch (error) {
      this.logger.error(`Failed to create upload directory: ${error.message}`);
    }
  }
}
