import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListListingsQueryDto } from './dto/list-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('photos', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024, files: 5 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only images allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateListingDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('At least one photo is required');
    return this.listingsService.create(user.id, dto, files);
  }

  @Get('mine')
  async mine(@CurrentUser() user: { id: number }) {
    return this.listingsService.mine(user.id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingsService.updateOwn(user.id, id, dto);
  }

  @Post(':id/mark-sold')
  @HttpCode(HttpStatus.OK)
  async markSold(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
    return this.listingsService.markSold(user.id, id);
  }

  @Post(':id/republish')
  @HttpCode(HttpStatus.OK)
  async republish(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
    return this.listingsService.republish(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
    await this.listingsService.removeOwn(user.id, id);
  }

  @Public()
  @Get()
  async list(@Query() query: ListListingsQueryDto) {
    return this.listingsService.search(query);
  }

  @Public()
  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.listingsService.getById(id);
  }
}
