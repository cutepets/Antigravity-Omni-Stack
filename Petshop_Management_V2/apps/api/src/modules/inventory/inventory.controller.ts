import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import {
  InventoryService,
  FindProductsDto, CreateProductDto, UpdateProductDto, CreateVariantDto,
  FindServicesDto, CreateServiceDto, UpdateServiceDto,
} from './inventory.service'
import { JwtGuard } from '../auth/guards/jwt.guard'

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ─── Products ─────────────────────────────────────────────────────────────

  @Get('products')
  @ApiOperation({ summary: 'Danh sách sản phẩm' })
  findAllProducts(@Query() query: FindProductsDto) {
    return this.inventoryService.findAllProducts(query)
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Chi tiết sản phẩm' })
  findProductById(@Param('id') id: string) {
    return this.inventoryService.findProductById(id)
  }

  @Post('products')
  @ApiOperation({ summary: 'Tạo sản phẩm mới' })
  createProduct(@Body() dto: CreateProductDto) {
    return this.inventoryService.createProduct(dto)
  }

  @Put('products/:id')
  @ApiOperation({ summary: 'Cập nhật sản phẩm' })
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.inventoryService.updateProduct(id, dto)
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Xóa sản phẩm' })
  removeProduct(@Param('id') id: string) {
    return this.inventoryService.removeProduct(id)
  }

  @Post('products/:id/variants/batch')
  @ApiOperation({ summary: 'Tạo nhiều phiên bản sản phẩm' })
  batchCreateVariants(@Param('id') id: string, @Body() body: { variants: CreateVariantDto[] }) {
    return this.inventoryService.batchCreateVariants(id, body.variants)
  }

  @Put('products/variants/:vid')
  @ApiOperation({ summary: 'Cập nhật phiên bản sản phẩm' })
  updateVariant(@Param('vid') vid: string, @Body() dto: Partial<CreateVariantDto>) {
    return this.inventoryService.updateVariant(vid, dto)
  }

  @Delete('products/variants/:vid')
  @ApiOperation({ summary: 'Xóa phiên bản sản phẩm' })
  removeVariant(@Param('vid') vid: string) {
    return this.inventoryService.removeVariant(vid)
  }

  // ─── Services ─────────────────────────────────────────────────────────────

  @Get('services')
  @ApiOperation({ summary: 'Danh sách dịch vụ' })
  findAllServices(@Query() query: FindServicesDto) {
    return this.inventoryService.findAllServices(query)
  }

  @Get('services/:id')
  @ApiOperation({ summary: 'Chi tiết dịch vụ' })
  findServiceById(@Param('id') id: string) {
    return this.inventoryService.findServiceById(id)
  }

  @Post('services')
  @ApiOperation({ summary: 'Tạo dịch vụ mới' })
  createService(@Body() dto: CreateServiceDto) {
    return this.inventoryService.createService(dto)
  }

  @Put('services/:id')
  @ApiOperation({ summary: 'Cập nhật dịch vụ' })
  updateService(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.inventoryService.updateService(id, dto)
  }

  @Delete('services/:id')
  @ApiOperation({ summary: 'Xóa dịch vụ' })
  removeService(@Param('id') id: string) {
    return this.inventoryService.removeService(id)
  }

  @Post('services/:id/variants/batch')
  @ApiOperation({ summary: 'Tạo nhiều phiên bản dịch vụ' })
  batchCreateServiceVariants(@Param('id') id: string, @Body() body: { variants: CreateVariantDto[] }) {
    return this.inventoryService.batchCreateServiceVariants(id, body.variants)
  }

  @Put('services/variants/:vid')
  @ApiOperation({ summary: 'Cập nhật phiên bản dịch vụ' })
  updateServiceVariant(@Param('vid') vid: string, @Body() dto: Partial<CreateVariantDto>) {
    return this.inventoryService.updateServiceVariant(vid, dto)
  }

  @Delete('services/variants/:vid')
  @ApiOperation({ summary: 'Xóa phiên bản dịch vụ' })
  removeServiceVariant(@Param('vid') vid: string) {
    return this.inventoryService.removeServiceVariant(vid)
  }

  // ─── Dictionaries ─────────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'Danh mục sản phẩm' })
  findAllCategories() {
    return this.inventoryService.findAllCategories()
  }

  @Post('categories')
  createCategory(@Body() body: any) {
    return this.inventoryService.createCategory(body)
  }

  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updateCategory(id, body)
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.inventoryService.removeCategory(id)
  }

  @Get('brands')
  @ApiOperation({ summary: 'Thương hiệu sản phẩm' })
  findAllBrands() {
    return this.inventoryService.findAllBrands()
  }

  @Post('brands')
  createBrand(@Body() body: any) {
    return this.inventoryService.createBrand(body)
  }

  @Put('brands/:id')
  updateBrand(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updateBrand(id, body)
  }

  @Delete('brands/:id')
  removeBrand(@Param('id') id: string) {
    return this.inventoryService.removeBrand(id)
  }

  @Get('units')
  @ApiOperation({ summary: 'Đơn vị tính' })
  findAllUnits() {
    return this.inventoryService.findAllUnits()
  }

  @Post('units')
  createUnit(@Body() body: any) {
    return this.inventoryService.createUnit(body)
  }

  @Put('units/:id')
  updateUnit(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updateUnit(id, body)
  }

  @Delete('units/:id')
  removeUnit(@Param('id') id: string) {
    return this.inventoryService.removeUnit(id)
  }

  @Get('price-books')
  @ApiOperation({ summary: 'Bảng giá' })
  findAllPriceBooks() {
    return this.inventoryService.findAllPriceBooks()
  }

  @Post('price-books')
  createPriceBook(@Body() body: any) {
    return this.inventoryService.createPriceBook(body)
  }

  @Put('price-books/:id')
  updatePriceBook(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updatePriceBook(id, body)
  }

  @Delete('price-books/:id')
  removePriceBook(@Param('id') id: string) {
    return this.inventoryService.removePriceBook(id)
  }
}
