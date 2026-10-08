import fs from 'fs';
import path from 'path';

export interface StorageAdapter {
  save(category: 'videos' | 'audio' | 'frames' | 'screenshots', fileName: string, buffer: Buffer): Promise<{
    filePath: string;
    fileSize: number;
    publicUrl: string;
  }>;
  get(category: 'videos' | 'audio' | 'frames' | 'screenshots', fileName: string): Promise<Buffer | null>;
  delete(category: 'videos' | 'audio' | 'frames' | 'screenshots', fileName: string): Promise<boolean>;
  list(category: 'videos' | 'audio' | 'frames' | 'screenshots'): Promise<string[]>;
}

export class LocalFileSystemStorage implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir: string = process.env.STORAGE_DIR || './storage') {
    this.baseDir = path.resolve(process.cwd(), baseDir);
    this.ensureDirs();
  }

  private ensureDirs() {
    const categories = ['videos', 'audio', 'frames', 'screenshots'];
    for (const cat of categories) {
      const dir = path.join(this.baseDir, cat);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  async save(
    category: 'videos' | 'audio' | 'frames' | 'screenshots',
    fileName: string,
    buffer: Buffer
  ): Promise<{ filePath: string; fileSize: number; publicUrl: string }> {
    this.ensureDirs();
    // Sanitize filename to prevent path traversal
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const timestamp = Date.now();
    const finalFileName = `${timestamp}_${safeName}`;
    const destinationPath = path.join(this.baseDir, category, finalFileName);

    await fs.promises.writeFile(destinationPath, buffer);
    const stats = await fs.promises.stat(destinationPath);

    return {
      filePath: destinationPath,
      fileSize: stats.size,
      publicUrl: `/api/storage/${category}/${finalFileName}`,
    };
  }

  async get(
    category: 'videos' | 'audio' | 'frames' | 'screenshots',
    fileName: string
  ): Promise<Buffer | null> {
    const categoryDir = path.resolve(this.baseDir, category);
    const target = path.resolve(categoryDir, fileName);
    if (!target.startsWith(categoryDir)) return null;
    if (!fs.existsSync(target)) return null;
    return await fs.promises.readFile(target);
  }

  async delete(
    category: 'videos' | 'audio' | 'frames' | 'screenshots',
    fileName: string
  ): Promise<boolean> {
    const categoryDir = path.resolve(this.baseDir, category);
    const target = path.resolve(categoryDir, fileName);
    if (!target.startsWith(categoryDir)) return false;
    if (!fs.existsSync(target)) return false;
    await fs.promises.unlink(target);
    return true;
  }

  async list(category: 'videos' | 'audio' | 'frames' | 'screenshots'): Promise<string[]> {
    const dir = path.join(this.baseDir, category);
    if (!fs.existsSync(dir)) return [];
    const files = await fs.promises.readdir(dir);
    return files.filter(f => f !== '.gitkeep');
  }
}

export const storage = new LocalFileSystemStorage();
