import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { StorageService } from './storage.service.js'

@ApiTags('Storage')
@Controller('storage/assets')
export class StorageController {
  constructor(private readonly storageService: StorageService) { }

  /**
   * Public endpoint — no auth required.
   * Asset IDs are random UUIDs (unguessable), so this is safe
   * and allows <img> / <Image> tags to load without cookies.
   */
  @Get(':id/content')
  @ApiOperation({ summary: 'Lay noi dung tep da luu tru (public)' })
  async getAssetContent(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { asset, stream } = await this.storageService.getAssetContent(id)

    res.setHeader('Content-Type', asset.mimeType)
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`,
    )

    return new StreamableFile(stream)
  }
}
