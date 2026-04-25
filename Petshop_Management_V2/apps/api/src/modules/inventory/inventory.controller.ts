import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { SuperAdminGuard } from '../../common/security/super-admin.guard.js'
import { JwtGuard } from '../auth/guards/jwt.guard'
import {
  CreateProductDto,
  CreateServiceDto,
  CreateVariantDto,
  FindProductsDto,
  FindServicesDto,
  InventoryService,
  UpdateProductDto,
  UpdateServiceDto,
} from './inventory.service'
import type { ProductExportRequest, ProductImportRequest } from './product-excel.js'
import { QueueService } from '../queue/queue.service'

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtGuard, PermissionsGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly queueService: QueueService,
  ) {}

  @Get('products')
  @Permissions('product.read')
  @ApiOperation({ summary: 'Danh sách sản phẩm' })
  findAllProducts(@Query() query: FindProductsDto) {
    return this.inventoryService.findAllProducts(query)
  }

  @Post('products/export')
  @Permissions('product.read')
  @ApiOperation({ summary: 'Xuất danh sách sản phẩm ra dữ liệu Excel' })
  exportProducts(@Body() body: ProductExportRequest) {
    void this.queueService.enqueueReportExport({
      reportType: 'product_export',
      requestedBy: 'inventory.controller',
      params: {
        scope: body.scope,
        productCount: Array.isArray(body.productIds) ? body.productIds.length : 0,
        filterCount: body.filters ? Object.keys(body.filters).length : 0,
      },
    })

    return this.inventoryService.exportProducts(body)
  }

  @Post('products/import/preview')
  @Permissions('product.create', 'product.update')
  @ApiOperation({ summary: 'Xem trước import Excel sản phẩm' })
  previewProductImport(@Body() body: ProductImportRequest) {
    return this.inventoryService.previewProductImport(body)
  }

  @Post('products/import/commit')
  @Permissions('product.create', 'product.update')
  @ApiOperation({ summary: 'Thực thi import Excel sản phẩm' })
  commitProductImport(@Body() body: ProductImportRequest) {
    return this.inventoryService.commitProductImport(body)
  }

  @Post('products/bulk-delete')
  @UseGuards(SuperAdminGuard)
  @Permissions('product.delete')
  @ApiOperation({ summary: 'Xoa hang loat san pham (chi SUPER_ADMIN)' })
  bulkRemoveProducts(@Body() body: { ids?: string[] }) {
    return this.inventoryService.bulkRemoveProducts(body.ids)
  }

  @Get('products/:id')
  @Permissions('product.read')
  @ApiOperation({ summary: 'Chi tiết sản phẩm' })
  findProductById(@Param('id') id: string) {
    return this.inventoryService.findProductById(id)
  }

  @Post('products')
  @Permissions('product.create')
  @ApiOperation({ summary: 'Tạo sản phẩm mới' })
  createProduct(@Body() dto: CreateProductDto) {
    return this.inventoryService.createProduct(dto)
  }

  @Put('products/:id')
  @Permissions('product.update')
  @ApiOperation({ summary: 'Cập nhật sản phẩm' })
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.inventoryService.updateProduct(id, dto)
  }

  @Delete('products/:id')
  @Permissions('product.delete')
  @ApiOperation({ summary: 'Xóa sản phẩm' })
  removeProduct(@Param('id') id: string) {
    return this.inventoryService.removeProduct(id)
  }

  @Post('products/:id/restore')
  @Permissions('product.update')
  @ApiOperation({ summary: 'Khôi phục sản phẩm' })
  restoreProduct(@Param('id') id: string) {
    return this.inventoryService.restoreProduct(id)
  }

  @Post('products/:id/variants/batch')
  @Permissions('product.update')
  @ApiOperation({ summary: 'Tạo nhiều phiên bản sản phẩm' })
  batchCreateVariants(@Param('id') id: string, @Body() body: { variants: CreateVariantDto[] }) {
    return this.inventoryService.batchCreateVariants(id, body.variants)
  }

  @Put('products/variants/:vid')
  @Permissions('product.update')
  @ApiOperation({ summary: 'Cập nhật phiên bản sản phẩm' })
  updateVariant(@Param('vid') vid: string, @Body() dto: Partial<CreateVariantDto>) {
    return this.inventoryService.updateVariant(vid, dto)
  }

  @Delete('products/variants/:vid')
  @Permissions('product.update')
  @ApiOperation({ summary: 'Xóa phiên bản sản phẩm' })
  removeVariant(@Param('vid') vid: string) {
    return this.inventoryService.removeVariant(vid)
  }

  @Get('services')
  @Permissions('service.read')
  @ApiOperation({ summary: 'Danh sách dịch vụ' })
  findAllServices(@Query() query: FindServicesDto) {
    return this.inventoryService.findAllServices(query)
  }

  @Get('services/:id')
  @Permissions('service.read')
  @ApiOperation({ summary: 'Chi tiết dịch vụ' })
  findServiceById(@Param('id') id: string) {
    return this.inventoryService.findServiceById(id)
  }

  @Post('services')
  @Permissions('service.create')
  @ApiOperation({ summary: 'Tạo dịch vụ mới' })
  createService(@Body() dto: CreateServiceDto) {
    return this.inventoryService.createService(dto)
  }

  @Post('services/bulk-delete')
  @UseGuards(SuperAdminGuard)
  @Permissions('service.delete')
  @ApiOperation({ summary: 'Xoa hang loat dich vu (chi SUPER_ADMIN)' })
  bulkRemoveServices(@Body() body: { ids?: string[] }) {
    return this.inventoryService.bulkRemoveServices(body.ids)
  }

  @Put('services/:id')
  @Permissions('service.update')
  @ApiOperation({ summary: 'Cập nhật dịch vụ' })
  updateService(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.inventoryService.updateService(id, dto)
  }

  @Delete('services/:id')
  @Permissions('service.delete')
  @ApiOperation({ summary: 'Xóa dịch vụ' })
  removeService(@Param('id') id: string) {
    return this.inventoryService.removeService(id)
  }

  @Post('services/:id/variants/batch')
  @Permissions('service.update')
  @ApiOperation({ summary: 'Tạo nhiều phiên bản dịch vụ' })
  batchCreateServiceVariants(@Param('id') id: string, @Body() body: { variants: CreateVariantDto[] }) {
    return this.inventoryService.batchCreateServiceVariants(id, body.variants)
  }

  @Put('services/variants/:vid')
  @Permissions('service.update')
  @ApiOperation({ summary: 'Cập nhật phiên bản dịch vụ' })
  updateServiceVariant(@Param('vid') vid: string, @Body() dto: Partial<CreateVariantDto>) {
    return this.inventoryService.updateServiceVariant(vid, dto)
  }

  @Delete('services/variants/:vid')
  @Permissions('service.update')
  @ApiOperation({ summary: 'Xóa phiên bản dịch vụ' })
  removeServiceVariant(@Param('vid') vid: string) {
    return this.inventoryService.removeServiceVariant(vid)
  }

  @Get('categories')
  @Permissions('product.read')
  @ApiOperation({ summary: 'Danh mục sản phẩm' })
  findAllCategories() {
    return this.inventoryService.findAllCategories()
  }

  @Post('categories')
  @Permissions('product.create')
  createCategory(@Body() body: any) {
    return this.inventoryService.createCategory(body)
  }

  @Put('categories/:id')
  @Permissions('product.update')
  updateCategory(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updateCategory(id, body)
  }

  @Delete('categories/:id')
  @Permissions('product.delete')
  removeCategory(@Param('id') id: string) {
    return this.inventoryService.removeCategory(id)
  }

  @Get('brands')
  @Permissions('product.read')
  @ApiOperation({ summary: 'Thương hiệu sản phẩm' })
  findAllBrands() {
    return this.inventoryService.findAllBrands()
  }

  @Post('brands')
  @Permissions('product.create')
  createBrand(@Body() body: any) {
    return this.inventoryService.createBrand(body)
  }

  @Put('brands/:id')
  @Permissions('product.update')
  updateBrand(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updateBrand(id, body)
  }

  @Delete('brands/:id')
  @Permissions('product.delete')
  removeBrand(@Param('id') id: string) {
    return this.inventoryService.removeBrand(id)
  }

  @Get('units')
  @Permissions('product.read')
  @ApiOperation({ summary: 'Đơn vị tính' })
  findAllUnits() {
    return this.inventoryService.findAllUnits()
  }

  @Post('units')
  @Permissions('product.create')
  createUnit(@Body() body: any) {
    return this.inventoryService.createUnit(body)
  }

  @Put('units/:id')
  @Permissions('product.update')
  updateUnit(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updateUnit(id, body)
  }

  @Delete('units/:id')
  @Permissions('product.delete')
  removeUnit(@Param('id') id: string) {
    return this.inventoryService.removeUnit(id)
  }

  @Get('price-books')
  @Permissions('product.read', 'settings.pricing_policy.manage')
  @ApiOperation({ summary: 'Bảng giá' })
  findAllPriceBooks() {
    return this.inventoryService.findAllPriceBooks()
  }

  @Post('price-books')
  @Permissions('settings.pricing_policy.manage')
  createPriceBook(@Body() body: any) {
    return this.inventoryService.createPriceBook(body)
  }

  @Put('price-books/:id')
  @Permissions('settings.pricing_policy.manage')
  updatePriceBook(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updatePriceBook(id, body)
  }

  @Delete('price-books/:id')
  @Permissions('settings.pricing_policy.manage')
  removePriceBook(@Param('id') id: string) {
    return this.inventoryService.removePriceBook(id)
  }
}
