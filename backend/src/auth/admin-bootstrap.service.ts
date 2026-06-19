import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const email = this.config.get<string>('ADMIN_BOOTSTRAP_EMAIL')?.trim().toLowerCase();
    const password = this.config.get<string>('ADMIN_BOOTSTRAP_PASSWORD');

    if (!email || !password) {
      return;
    }

    if (password.length < 12) {
      this.logger.warn('ADMIN_BOOTSTRAP_PASSWORD is set but shorter than 12 characters; admin bootstrap skipped');
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        role: 'admin',
        accountStatus: 'active',
        displayName: 'PocketTrade Admin',
        suspensionReason: null,
      },
      create: {
        email,
        passwordHash,
        role: 'admin',
        accountStatus: 'active',
        displayName: 'PocketTrade Admin',
      },
    });

    this.logger.log(`Admin bootstrap ready for ${email}`);
  }
}
