import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ListingCondition, ListingStatus, ReportStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AdminListingsQueryDto } from './dto/admin-listings-query.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';

@Injectable()
export class AdminService {
  private dashboardCache: { value: any; expiresAt: number } | null = null;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: AdminLoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || user.role !== 'admin' || user.accountStatus !== 'active' || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as unknown as number,
    });
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'refresh' },
      { expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '30d') as unknown as number },
    );
    await this.prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
  }

  async dashboard() {
    const now = Date.now();
    if (this.dashboardCache && this.dashboardCache.expiresAt > now) {
      return this.dashboardCache.value;
    }

    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60_000);
    const [
      userStatusCounts,
      listingStatusCounts,
      totalReports,
      totalFavorites,
      totalMessages,
      newUsersLast7Days,
      newListingsLast7Days,
      recentListings,
      recentActivity,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['accountStatus'], _count: { _all: true } }),
      this.prisma.listing.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.report.count(),
      this.prisma.favorite.count(),
      this.prisma.message.count(),
      this.prisma.user.count({ where: { createdAt: { gt: sevenDaysAgo } } }),
      this.prisma.listing.count({ where: { createdAt: { gt: sevenDaysAgo } } }),
      this.prisma.listing.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, brand: true, model: true, price: true, status: true, createdAt: true },
      }),
      this.prisma.adminActivityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    const userCounts = Object.fromEntries(userStatusCounts.map((row) => [row.accountStatus, row._count._all]));
    const listingCounts = Object.fromEntries(listingStatusCounts.map((row) => [row.status, row._count._all]));
    const totalUsers = Object.values(userCounts).reduce((sum, count) => sum + count, 0);
    const totalListings = Object.values(listingCounts).reduce((sum, count) => sum + count, 0);
    const response = {
      metrics: {
        totalUsers,
        activeUsers: userCounts.active ?? 0,
        suspendedUsers: userCounts.suspended ?? 0,
        totalListings,
        pendingListings: listingCounts.pending ?? 0,
        activeListings: listingCounts.active ?? 0,
        rejectedListings: listingCounts.rejected ?? 0,
        totalReports,
        totalFavorites,
        totalMessages,
        newUsersLast7Days,
        newListingsLast7Days,
      },
      recentListings,
      recentActivity: recentActivity.map((a) => ({
        type: a.action,
        description: `${a.action} ${a.targetType} ${a.targetId}`,
        createdAt: a.createdAt,
      })),
    };

    this.dashboardCache = {
      value: response,
      expiresAt: now + 45_000,
    };

    return response;
  }

  async listListings(query: AdminListingsQueryDto) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.brand) where.brand = { equals: query.brand, mode: 'insensitive' };
    if (query.model) where.model = { contains: query.model, mode: 'insensitive' };
    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 20);
    const take = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { images: { orderBy: { displayOrder: 'asc' } }, seller: { select: { id: true, email: true, displayName: true } } },
      }),
      this.prisma.listing.count({ where }),
    ]);
    return { items, total, page: query.page ?? 1, limit: take, pages: Math.ceil(total / take) };
  }

  async getListing(id: number) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { images: { orderBy: { displayOrder: 'asc' } }, seller: true, reports: true },
    });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    return listing;
  }

  async updateListing(id: number, adminId: number, dto: Record<string, unknown>) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    const data = this.sanitizeListingUpdate(dto);
    if (Object.keys(data).length === 0) throw new BadRequestException('No editable listing fields provided');
    const updated = await this.prisma.listing.update({ where: { id }, data });
    await this.log(adminId, 'edit_listing', 'listing', id, listing, updated);
    return updated;
  }

  async setListingStatus(id: number, adminId: number, status: ListingStatus, reason?: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    const updated = await this.prisma.listing.update({ where: { id }, data: { status } });
    await this.log(adminId, `${status}_listing`, 'listing', id, { status: listing.status }, { status, reason: reason ?? null });
    return updated;
  }

  async listUsers(query: AdminUsersQueryDto) {
    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.accountStatus) where.accountStatus = query.accountStatus;
    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 20);
    const take = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: { id: true, email: true, displayName: true, accountStatus: true, role: true, createdAt: true, lastActiveAt: true, suspensionReason: true },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: query.page ?? 1, limit: take, pages: Math.ceil(total / take) };
  }

  async getUser(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, displayName: true, profileImage: true, location: true, accountStatus: true, role: true, createdAt: true, lastActiveAt: true, suspensionReason: true, deletionRequestedAt: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async userListings(id: number) {
    return this.prisma.listing.findMany({ where: { sellerId: id }, orderBy: { createdAt: 'desc' }, include: { images: true } });
  }

  async suspendUser(id: number, adminId: number, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    if (user.role === 'admin') throw new BadRequestException('Cannot suspend an admin');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { accountStatus: 'suspended', suspensionReason: reason ?? null },
    });
    await this.log(adminId, 'suspend_user', 'user', id, { accountStatus: user.accountStatus }, { accountStatus: updated.accountStatus, reason: reason ?? null });
    return updated;
  }

  async restoreUser(id: number, adminId: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { accountStatus: 'active', suspensionReason: null },
    });
    await this.log(adminId, 'restore_user', 'user', id, { accountStatus: user.accountStatus }, { accountStatus: updated.accountStatus });
    return updated;
  }

  async searchAnalytics() {
    const topTerms = await this.prisma.searchLog.groupBy({
      by: ['searchTerm'],
      _count: { searchTerm: true },
      orderBy: { _count: { searchTerm: 'desc' } },
      take: 20,
    });
    const zeroResults = await this.prisma.searchLog.findMany({
      where: { resultCount: 0 },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      topTerms: topTerms.map((t) => ({ term: t.searchTerm, count: t._count.searchTerm })),
      zeroResults,
    };
  }

  async listReports(status: ReportStatus | undefined, page: number, limit: number) {
    const where = status ? { status } : {};
    const skip = (Math.max(page, 1) - 1) * Math.min(limit, 100);
    const take = Math.min(Math.max(limit, 1), 25);
    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          reporter: { select: { id: true, email: true, displayName: true } },
          reportedUser: { select: { id: true, email: true, displayName: true } },
          reportedListing: { select: { id: true, brand: true, model: true, status: true } },
          conversation: {
            include: {
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: { id: true, senderId: true, content: true, createdAt: true },
              },
            },
          },
        },
      }),
      this.prisma.report.count({ where }),
    ]);
    return { items, total, page: Math.max(page, 1), limit: take, pages: Math.ceil(total / take) };
  }

  async setReportStatus(id: number, adminId: number, status: ReportStatus) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    const updated = await this.prisma.report.update({
      where: { id },
      data: { status, reviewedAt: new Date() },
    });
    await this.log(adminId, `${status}_report`, 'report', id, { status: report.status }, { status });
    return updated;
  }

  async activity(page: number, limit: number) {
    const skip = (Math.max(page, 1) - 1) * Math.min(limit, 100);
    const take = Math.min(Math.max(limit, 1), 100);
    const [items, total] = await Promise.all([
      this.prisma.adminActivityLog.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.adminActivityLog.count(),
    ]);
    return { items, total, page: Math.max(page, 1), limit: take, pages: Math.ceil(total / take) };
  }

  private async log(adminId: number, action: string, targetType: string, targetId: number, previousValue?: unknown, newValue?: unknown) {
    await this.prisma.adminActivityLog.create({
      data: {
        adminId: String(adminId),
        action,
        targetType,
        targetId: String(targetId),
        previousValue: previousValue as object,
        newValue: newValue as object,
      },
    });
    this.dashboardCache = null;
  }

  private sanitizeListingUpdate(dto: Record<string, unknown>) {
    const data: {
      brand?: string;
      model?: string;
      price?: number;
      condition?: ListingCondition;
      storage?: string;
      colour?: string | null;
      description?: string;
      location?: string;
    } = {};
    const stringFields = ['brand', 'model', 'storage', 'description', 'location'] as const;
    for (const field of stringFields) {
      const value = dto[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        data[field] = value.trim();
      }
    }
    if (typeof dto.colour === 'string') data.colour = dto.colour.trim() || null;
    if (typeof dto.price === 'number' && Number.isInteger(dto.price) && dto.price >= 1) {
      data.price = dto.price;
    }
    if (typeof dto.condition === 'string' && Object.values(ListingCondition).includes(dto.condition as ListingCondition)) {
      data.condition = dto.condition as ListingCondition;
    }
    return data;
  }
}
