import { Controller, Get, Param, Res, StreamableFile, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { StorageService } from './storage.service.js'

@ApiTags('Storage')
@Controller('storage/assets')
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get(':id/content')
  @ApiOperation({ summary: 'Lay noi dung tep da luu tru' })
  async getAssetContent(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { asset, stream } = await this.storageService.getAssetContent(id)

    res.setHeader('Content-Type', asset.mimeType)
    res.setHeader('Cache-Control', 'private, max-age=60')
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`,
    )

    return new StreamableFile(stream)
  }
}
