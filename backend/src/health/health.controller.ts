import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';

interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'ok' | 'error' | 'skipped';
  uptime: number;
  version: string;
  timestamp: string;
}

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get('health')
  async health(): Promise<HealthResponse> {
    const skipDb = process.env.HEALTH_CHECK_DB === 'false';
    const response: HealthResponse = {
      status: 'ok',
      db: skipDb ? 'skipped' : 'ok',
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.0.1',
      timestamp: new Date().toISOString(),
    };
    if (skipDb) {
      return response;
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      response.status = 'degraded';
      response.db = 'error';
      throw new ServiceUnavailableException(response);
    }
    return response;
  }
}
