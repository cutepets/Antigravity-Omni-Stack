import { SetMetadata } from '@nestjs/common'

export const PERMISSIONS_KEY = 'permissions'

/**
 * Thêm các quyền yêu cầu cho một Route.
 * Nếu truyền nhiều quyền, chỉ cần User có MỘT TRONG CÁC quyền đó là được phép truy cập (Điều kiện OR),
 * hoặc User có quyền SUPER_ADMIN / FULL_ACCESS.
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions)
