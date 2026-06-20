import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

type OtpResponse = {
  success: boolean;
  message: string;
  expiresAt: string;
};

type OtpIssue = {
  response: OtpResponse;
  code?: string;
  requestId?: number;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: number; email: string; role: string; displayName: string | null };
  isNewUser?: boolean;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private static readonly otpTtlMs = 10 * 60_000;
  private static readonly otpResendCooldownMs = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<OtpResponse> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.passwordHash && existing.emailVerifiedAt) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const displayName = this.displayNameFromEmail(email);
    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          displayName: existing.displayName ?? displayName,
          accountStatus: 'active',
          emailVerifiedAt: null,
        },
      });
    } else {
      await this.prisma.user.create({
        data: { email, passwordHash, displayName, role: 'user', accountStatus: 'active', emailVerifiedAt: null },
      });
    }

    return this.createOtp(email, 'Verification code sent');
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.accountStatus !== 'active' || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');

    const displayName = user.displayName ?? this.displayNameFromEmail(user.email);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { displayName, lastActiveAt: new Date() },
    });
    return this.authResponse(updated);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<OtpResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || user.accountStatus !== 'active' || !user.emailVerifiedAt) {
      const expiresAt = new Date(Date.now() + AuthService.otpTtlMs);
      return {
        success: true,
        message: 'If the email is registered, a reset code has been sent',
        expiresAt: expiresAt.toISOString(),
      };
    }
    return this.createOtp(email, 'Password reset code sent');
  }

  async resetPassword(dto: ResetPasswordDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing?.passwordHash || existing.accountStatus !== 'active' || !existing.emailVerifiedAt) {
      throw new UnauthorizedException('Invalid reset request');
    }

    await this.verifyOtpCode(email, dto.code);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        displayName: this.displayNameFromEmail(email),
        lastActiveAt: new Date(),
      },
    });
    return this.authResponse(user);
  }

  async requestOtp(dto: RequestOtpDto): Promise<OtpResponse> {
    const email = dto.email.trim().toLowerCase();
    return this.createOtp(email, 'OTP sent');
  }

  private async createOtp(email: string, message: string): Promise<OtpResponse> {
    const issue = await this.prisma.$transaction(async (tx): Promise<OtpIssue> => {
      // Serialize requests for one email so concurrent requests cannot double-send.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;

      const active = await tx.otpRequest.findFirst({
        where: { email, verified: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      if (active) {
        const canResendAt = active.createdAt.getTime() + AuthService.otpResendCooldownMs;
        if (Date.now() < canResendAt) {
          return {
            response: {
              success: true,
              message: 'A verification code is already active for this email. You can request a new code after 1 minute.',
              expiresAt: active.expiresAt.toISOString(),
            },
          };
        }

        await tx.otpRequest.update({
          where: { id: active.id },
          data: { verified: true },
        });
      }

      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      const hashedOtp = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + AuthService.otpTtlMs);
      const request = await tx.otpRequest.create({
        data: { email, hashedOtp, expiresAt, attempts: 0, verified: false },
        select: { id: true },
      });

      return {
        code,
        requestId: request.id,
        response: {
          success: true,
          message,
          expiresAt: expiresAt.toISOString(),
        },
      };
    });

    if (issue.code != null && issue.requestId != null) {
      try {
        await this.deliverOtp(email, issue.code);
      } catch (error) {
        // Do not leave an undelivered code active for the full validity window.
        await this.prisma.otpRequest.update({
          where: { id: issue.requestId },
          data: { verified: true },
        });
        throw error;
      }
    }
    return issue.response;
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    await this.verifyOtpCode(email, dto.code);

    let user = await this.prisma.user.findUnique({ where: { email } });
    let isNewUser = false;
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          displayName: this.displayNameFromEmail(email),
          role: 'user',
          accountStatus: 'active',
          emailVerifiedAt: new Date(),
          lastActiveAt: new Date(),
        },
      });
      isNewUser = true;
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: user.displayName ?? this.displayNameFromEmail(user.email),
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          lastActiveAt: new Date(),
        },
      });
    }

    return { ...(await this.authResponse(user)), isNewUser };
  }

  private async verifyOtpCode(email: string, code: string): Promise<void> {
    const req = await this.prisma.otpRequest.findFirst({
      where: { email, verified: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!req) throw new UnauthorizedException('OTP expired or not found');
    if (req.attempts >= 5) throw new UnauthorizedException('Too many attempts');

    const ok = await bcrypt.compare(code, req.hashedOtp);
    if (!ok) {
      await this.prisma.otpRequest.update({
        where: { id: req.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.otpRequest.update({
      where: { id: req.id },
      data: { verified: true },
    });
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    await this.cleanupExpiredRevocations();
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.accountStatus !== 'active') {
      throw new UnauthorizedException('User not found or inactive');
    }

    await this.prisma.revokedRefreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: payload.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60_000),
      },
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.cleanupExpiredRevocations();
    const payload = await this.verifyRefreshToken(refreshToken);
    await this.prisma.revokedRefreshToken.upsert({
      where: { tokenHash: this.hashToken(refreshToken) },
      update: {},
      create: {
        userId: payload.sub,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: payload.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60_000),
      },
    });
  }

  private async verifyRefreshToken(refreshToken: string): Promise<{ sub: number; type: string; exp?: number }> {
    let payload: { sub: number; type: string; exp?: number };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid refresh token');
    const revoked = await this.prisma.revokedRefreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
    });
    if (revoked) throw new UnauthorizedException('Refresh token has been revoked');
    return payload;
  }

  private async issueTokens(
    userId: number,
    email: string,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: userId, email, role };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as unknown as number,
    });
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, type: 'refresh', jti: randomUUID() },
      { expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '30d') as unknown as number },
    );
    return { accessToken, refreshToken };
  }

  private async authResponse(user: {
    id: number;
    email: string;
    role: string;
    displayName: string | null;
  }): Promise<AuthResponse> {
    const tokens = await this.issueTokens(user.id, user.email, user.role);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
      },
    };
  }

  private displayNameFromEmail(email: string): string {
    return email.split('@')[0]?.trim() || 'user';
  }

  private async deliverOtp(email: string, code: string): Promise<void> {
    const apiKey = this.config.get<string>('MAILJET_API_KEY');
    const apiSecret = this.config.get<string>('MAILJET_API_SECRET');
    const fromEmail = this.config.get<string>('MAILJET_FROM_EMAIL');
    const fromName = this.config.get<string>('MAILJET_FROM_NAME', 'PocketTrade');

    if (!apiKey || !apiSecret || !fromEmail) {
      throw new InternalServerErrorException('Mailjet email delivery is not configured');
    }

    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: fromEmail, Name: fromName },
            To: [{ Email: email }],
            Subject: 'Your PocketTrade verification code',
            TextPart: `Your PocketTrade verification code is ${code}. It expires in 10 minutes.`,
          },
        ],
      }),
    });
    const body = await response.text();

    if (!response.ok) {
      this.logger.error(`Mailjet send failed with HTTP ${response.status}: ${body}`);
      throw new InternalServerErrorException('Failed to send verification email');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body) as unknown;
    } catch {
      this.logger.error(`Mailjet send returned invalid JSON: ${body}`);
      throw new InternalServerErrorException('Failed to send verification email');
    }

    const messages = (payload as { Messages?: Array<{ Status?: string; Errors?: unknown }> }).Messages;
    const sent = Array.isArray(messages) && messages.every((message) => message.Status === 'success');
    if (!sent) {
      this.logger.error(`Mailjet send was not accepted: ${body}`);
      throw new InternalServerErrorException('Failed to send verification email');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async cleanupExpiredRevocations(): Promise<void> {
    await this.prisma.revokedRefreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}
