import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, extname, join } from 'path';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor(private config: ConfigService) {
    const url = this.config.get<string>('CLOUDINARY_URL');
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (url) {
      cloudinary.config(url);
    } else {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
    }
  }

  async uploadImage(
    buffer: Buffer,
    filename: string,
    folder: string,
  ): Promise<{ url: string; publicId: string }> {
    if (!this.hasCloudinaryConfig()) {
      return this.writeLocalImage(buffer, filename, folder);
    }

    try {
      return await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id: filename,
            resource_type: 'image',
          },
          (error, result: UploadApiResponse | undefined) => {
            if (error || !result)
              return reject(error ?? new Error('Upload failed'));
            resolve({ url: result.secure_url, publicId: result.public_id });
          },
        );
        const readable = new Readable();
        readable.push(buffer);
        readable.push(null);
        readable.pipe(uploadStream);
      });
    } catch (error) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw error;
      }
      return this.writeLocalImage(buffer, filename, folder);
    }
  }

  private hasCloudinaryConfig(): boolean {
    return Boolean(
      this.config.get<string>('CLOUDINARY_URL') ||
        (this.config.get<string>('CLOUDINARY_CLOUD_NAME') &&
          this.config.get<string>('CLOUDINARY_API_KEY') &&
          this.config.get<string>('CLOUDINARY_API_SECRET')),
    );
  }

  private async writeLocalImage(
    buffer: Buffer,
    filename: string,
    folder: string,
  ): Promise<{ url: string; publicId: string }> {
    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '_');
    const extension = extname(filename) || '.jpg';
    const publicId = `${safeFolder}/${randomUUID()}${extension}`;
    const assetPath = join(process.cwd(), 'public', 'assets', publicId);
    await fs.mkdir(dirname(assetPath), { recursive: true });
    await fs.writeFile(assetPath, buffer);
    const baseUrl = this.config.get<string>('API_PUBLIC_URL') || 'http://localhost:3000';
    return { url: `${baseUrl}/assets/${publicId.replace(/\\/g, '/')}`, publicId };
  }
}
