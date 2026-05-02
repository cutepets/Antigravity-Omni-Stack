'use client'

import { usePathname } from 'next/navigation'
import { ChangePasswordDialog } from '@/components/account/ChangePasswordDialog'
import { useAuthStore } from '@/stores/auth.store'

export function PasswordChangePrompt() {
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const shouldPromptPasswordChange = useAuthStore((state) => state.shouldPromptPasswordChange)
  const dismissPasswordChangePrompt = useAuthStore((state) => state.dismissPasswordChangePrompt)
  const fetchMe = useAuthStore((state) => state.fetchMe)

  if (!user || pathname.startsWith('/login')) return null

  return (
    <ChangePasswordDialog
      open={Boolean(shouldPromptPasswordChange)}
      selfUpdate
      title="Đổi mật khẩu mặc định"
      description="Tài khoản đang dùng mật khẩu mặc định. Vui lòng đổi sang mật khẩu riêng để bảo mật."
      onOpenChange={(open) => {
        if (!open) dismissPasswordChangePrompt()
      }}
      onSuccess={() => {
        dismissPasswordChangePrompt()
        void fetchMe()
      }}
    />
  )
}
