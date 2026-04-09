'use client'

import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Save, Store, Upload } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthorization } from '@/hooks/useAuthorization'
import { api, uploadApi } from '@/lib/api'

export function TabGeneral() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthorization()
  const canUpdateSettings = hasPermission('settings.app.update')

  const [isSaving, setIsSaving] = useState(false)
  const [savedState, setSavedState] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [formData, setFormData] = useState({
    shopName: '',
    shopPhone: '',
    email: '',
    website: '',
    shopAddress: '',
    shopLogo: '',
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['settings', 'configs'],
    queryFn: async () => {
      const response = await api.get('/settings/configs')
      return response.data?.data ?? {}
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!data) return

    setFormData({
      shopName: data.shopName || '',
      shopPhone: data.shopPhone || '',
      email: data.email || '',
      website: data.website || '',
      shopAddress: data.shopAddress || '',
      shopLogo: data.shopLogo || '',
    })
  }, [data])

  const mutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const response = await api.put('/settings/configs', payload)
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Lưu thất bại')
      }
      return response.data
    },
    onMutate: () => setIsSaving(true),
    onSuccess: () => {
      setSavedState(true)
      toast.success('Đã lưu thông tin cửa hàng thành công')
      queryClient.invalidateQueries({ queryKey: ['settings', 'configs'] })
      setTimeout(() => {
        setSavedState(false)
        setIsSaving(false)
      }, 2000)
    },
    onError: (error: any) => {
      setIsSaving(false)
      const message = error?.response?.data?.message || error?.message || 'Lỗi không xác định'
      toast.error(`Lỗi khi lưu: ${message}`)
    },
  })

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUpdateSettings) return

    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleSave = () => {
    if (!canUpdateSettings) return
    mutation.mutate(formData)
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUpdateSettings) return

    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File quá lớn. Tối đa 5MB')
      return
    }

    setUploadingLogo(true)
    try {
      const imageUrl = await uploadApi.uploadImage(file)
      setFormData((current) => ({ ...current, shopLogo: imageUrl }))
      toast.success('Tải ảnh logo thành công')
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Lỗi không xác định'
      toast.error(`Lỗi tải ảnh: ${message}`)
    } finally {
      setUploadingLogo(false)
      event.target.value = ''
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center gap-3 text-foreground-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-foreground-muted/30 border-t-foreground-muted" />
        Đang tải cấu hình...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-40 items-center justify-center gap-3 text-red-400">
        <AlertCircle size={20} />
        Không thể tải cấu hình. Vui lòng kiểm tra kết nối API.
      </div>
    )
  }

  const isDisabled = !canUpdateSettings || isSaving

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-border/60 bg-background-secondary shadow-sm">
      <div className="border-b border-border/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-3 text-lg font-bold text-foreground-base">
              <Store className="text-primary-500" size={24} />
              Thông tin cửa hàng
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">Thông tin hiển thị trên hóa đơn và báo cáo.</p>
          </div>

          {!canUpdateSettings ? (
            <span className="rounded-full border border-border/60 bg-background-elevated px-3 py-1 text-xs font-semibold text-foreground-muted">
              Chế độ chỉ xem
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-8 p-8">
        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground-base">Logo cửa hàng</h3>
          <div className="flex items-center gap-6">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-black/10">
              {uploadingLogo ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                </div>
              ) : null}

              {formData.shopLogo ? (
                <img src={formData.shopLogo} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <Store size={32} className="text-foreground-muted/50" />
              )}
            </div>

            <div>
              <label
                className={`inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-medium ${
                  canUpdateSettings
                    ? 'cursor-pointer bg-background-tertiary transition-colors hover:bg-background-elevated'
                    : 'cursor-not-allowed bg-background-tertiary/60 text-foreground-muted'
                }`}
              >
                <Upload size={16} className="text-foreground-muted" />
                {uploadingLogo ? 'Đang tải...' : 'Tải logo lên'}
                <input
                  type="file"
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleLogoUpload}
                  disabled={!canUpdateSettings || uploadingLogo}
                />
              </label>
              <p className="mt-2 text-xs text-foreground-muted">PNG, JPG, WebP, tối đa 5MB</p>

              {formData.shopLogo && canUpdateSettings ? (
                <button
                  onClick={() => setFormData((current) => ({ ...current, shopLogo: '' }))}
                  className="mt-1 text-xs text-red-400 transition-colors hover:text-red-500"
                >
                  Xóa logo
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground-base">
              Tên cửa hàng <span className="text-red-500">*</span>
            </label>
            <input
              name="shopName"
              value={formData.shopName}
              onChange={handleChange}
              placeholder="VD: Cutepets"
              disabled={isDisabled}
              className="w-full rounded-xl border border-border/50 bg-black/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground-base">Số điện thoại liên hệ</label>
            <input
              name="shopPhone"
              value={formData.shopPhone}
              onChange={handleChange}
              placeholder="09xxxxxxxx"
              disabled={isDisabled}
              className="w-full rounded-xl border border-border/50 bg-black/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground-base">Email</label>
            <input
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="email@shop.com"
              disabled={isDisabled}
              className="w-full rounded-xl border border-border/50 bg-black/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground-base">Website</label>
            <input
              name="website"
              value={formData.website}
              onChange={handleChange}
              placeholder="https://..."
              disabled={isDisabled}
              className="w-full rounded-xl border border-border/50 bg-black/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-bold text-foreground-base">Địa chỉ trụ sở chính</label>
            <input
              name="shopAddress"
              value={formData.shopAddress}
              onChange={handleChange}
              placeholder="123 Đường ABC, Quận X, TP.HCM"
              disabled={isDisabled}
              className="w-full rounded-xl border border-border/50 bg-black/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border/40 pt-6">
          <button
            onClick={handleSave}
            disabled={!canUpdateSettings || isSaving || !formData.shopName}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : savedState ? (
              <>
                <CheckCircle2 size={18} />
                Đã xong
              </>
            ) : (
              <>
                <Save size={18} />
                Lưu thay đổi
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
