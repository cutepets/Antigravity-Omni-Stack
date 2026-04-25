'use client'

import Image from 'next/image'
import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Cloud, Copy, KeyRound, RefreshCw, Save, Store, Upload } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthorization } from '@/hooks/useAuthorization'
import { api, uploadApi } from '@/lib/api'

type SettingsFormData = {
  shopName: string
  shopPhone: string
  email: string
  website: string
  shopAddress: string
  shopLogo: string
  storageProvider: 'LOCAL' | 'GOOGLE_DRIVE'
  googleAuthEnabled: boolean
  googleAuthClientId: string
  googleAuthClientSecret: string
  googleAuthAllowedDomain: string
  googleDriveEnabled: boolean
  googleDriveServiceAccountJson: string
  googleDriveClientEmail: string
  googleDriveSharedDriveId: string
  googleDriveRootFolderId: string
  googleDriveImageFolderId: string
  googleDriveDocumentFolderId: string
  googleDriveBackupFolderId: string
}

type GoogleAuthStatus = {
  enabled: boolean
  configured: boolean
  allowedDomain: string | null
  apiBaseUrl: string
  webAppBaseUrl: string
  callbackUrl: string
}

const DEFAULT_FORM: SettingsFormData = {
  shopName: '',
  shopPhone: '',
  email: '',
  website: '',
  shopAddress: '',
  shopLogo: '',
  storageProvider: 'LOCAL',
  googleAuthEnabled: false,
  googleAuthClientId: '',
  googleAuthClientSecret: '',
  googleAuthAllowedDomain: '',
  googleDriveEnabled: false,
  googleDriveServiceAccountJson: '',
  googleDriveClientEmail: '',
  googleDriveSharedDriveId: '',
  googleDriveRootFolderId: '',
  googleDriveImageFolderId: '',
  googleDriveDocumentFolderId: '',
  googleDriveBackupFolderId: '',
}

export function TabGeneral() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthorization()
  const canUpdateSettings = hasPermission('settings.app.update')

  const [isSaving, setIsSaving] = useState(false)
  const [savedState, setSavedState] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [formData, setFormData] = useState<SettingsFormData>(DEFAULT_FORM)

  const { data, isLoading, error } = useQuery({
    queryKey: ['settings', 'configs'],
    queryFn: async () => {
      const response = await api.get('/settings/configs')
      return response.data?.data ?? {}
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })
  const googleAuthStatusQuery = useQuery({
    queryKey: ['auth', 'google-status'],
    queryFn: async () => {
      const response = await api.get('/auth/google/status')
      return (response.data?.data ?? null) as GoogleAuthStatus | null
    },
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
      storageProvider: data.storageProvider || 'LOCAL',
      googleAuthEnabled: Boolean(data.googleAuthEnabled),
      googleAuthClientId: data.googleAuthClientId || '',
      googleAuthClientSecret: '',
      googleAuthAllowedDomain: data.googleAuthAllowedDomain || '',
      googleDriveEnabled: Boolean(data.googleDriveEnabled),
      googleDriveServiceAccountJson: '',
      googleDriveClientEmail: data.googleDriveClientEmail || '',
      googleDriveSharedDriveId: data.googleDriveSharedDriveId || '',
      googleDriveRootFolderId: data.googleDriveRootFolderId || '',
      googleDriveImageFolderId: data.googleDriveImageFolderId || '',
      googleDriveDocumentFolderId: data.googleDriveDocumentFolderId || '',
      googleDriveBackupFolderId: data.googleDriveBackupFolderId || '',
    })
  }, [data])

  const mutation = useMutation({
    mutationFn: async (payload: Partial<SettingsFormData>) => {
      const response = await api.put('/settings/configs', payload)
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Lưu thất bại')
      }
      return response.data
    },
    onMutate: () => setIsSaving(true),
    onSuccess: () => {
      setSavedState(true)
      toast.success('Đã lưu cấu hình hệ thống')
      queryClient.invalidateQueries({ queryKey: ['settings', 'configs'] })
      setTimeout(() => {
        setSavedState(false)
        setIsSaving(false)
      }, 2000)
    },
    onError: (mutationError: any) => {
      setIsSaving(false)
      const message = mutationError?.response?.data?.message || mutationError?.message || 'Lỗi không xác định'
      toast.error(`Lỗi khi lưu: ${message}`)
    },
  })

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/settings/google-drive/test')
      return response.data
    },
    onSuccess: () => {
      toast.success('Kết nối Google Drive hợp lệ')
    },
    onError: (mutationError: any) => {
      const message = mutationError?.response?.data?.message || mutationError?.message || 'Không test được kết nối'
      toast.error(`Google Drive test fail: ${message}`)
    },
  })

  const handleTextChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    if (!canUpdateSettings) return

    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleToggleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUpdateSettings) return

    const { name, checked } = event.target
    setFormData((current) => ({ ...current, [name]: checked }))
  }

  const handleCopy = async (value: string, label: string) => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      toast.success(`Da copy ${label}`)
    } catch {
      toast.error(`Khong copy duoc ${label}`)
    }
  }

  const handleSave = () => {
    if (!canUpdateSettings) return

    const payload: Partial<SettingsFormData> = { ...formData }
    if (!formData.googleAuthClientSecret.trim()) {
      delete payload.googleAuthClientSecret
    }
    if (!formData.googleDriveServiceAccountJson.trim()) {
      delete payload.googleDriveServiceAccountJson
    }

    mutation.mutate(payload)
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
      toast.success('Tải logo thành công')
    } catch (uploadError: any) {
      const message = uploadError?.response?.data?.message || uploadError?.message || 'Loi upload'
      toast.error(`Không tải được logo: ${message}`)
    } finally {
      setUploadingLogo(false)
      event.target.value = ''
    }
  }

  const integrationBadges = useMemo(
    () => ({
      googleAuthSecret: Boolean(data?.googleAuthClientSecretConfigured),
      googleDriveSecret: Boolean(data?.googleDriveServiceAccountConfigured),
    }),
    [data],
  )

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
              Cấu hình cửa hàng và Google integrations
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Cửa hàng, Google Login, Google Drive shared storage.
            </p>
          </div>

          {!canUpdateSettings ? (
            <span className="rounded-full border border-border/60 bg-background-elevated px-3 py-1 text-xs font-semibold text-foreground-muted">
              Chế độ chỉ xem
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-8 p-8">
        <section className="space-y-6">
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
                  <Image src={formData.shopLogo} alt="Logo" className="h-full w-full object-cover" width={400} height={400} unoptimized />
                ) : (
                  <Store size={32} className="text-foreground-muted/50" />
                )}
              </div>

              <div>
                <label
                  className={`inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-medium ${canUpdateSettings
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
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field label="Tên cửa hàng">
              <input name="shopName" value={formData.shopName} onChange={handleTextChange} disabled={isDisabled} className={inputClassName} />
            </Field>
            <Field label="Số điện thoại">
              <input name="shopPhone" value={formData.shopPhone} onChange={handleTextChange} disabled={isDisabled} className={inputClassName} />
            </Field>
            <Field label="Email">
              <input name="email" value={formData.email} onChange={handleTextChange} disabled={isDisabled} className={inputClassName} />
            </Field>
            <Field label="Website">
              <input name="website" value={formData.website} onChange={handleTextChange} disabled={isDisabled} className={inputClassName} />
            </Field>
            <Field label="Địa chỉ" className="md:col-span-2">
              <input name="shopAddress" value={formData.shopAddress} onChange={handleTextChange} disabled={isDisabled} className={inputClassName} />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-border/50 bg-background-elevated/60 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-base">
                <KeyRound size={16} className="text-primary-500" />
                Google Login
              </h3>
              <p className="mt-1 text-xs text-foreground-muted">
                User đăng nhập bằng Google, vẫn trả cookie/session như đăng nhập thường.
              </p>
            </div>
            <StatusBadge active={Boolean(formData.googleAuthEnabled)} configured={integrationBadges.googleAuthSecret} />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ToggleField
              label="Bật Google Login"
              checked={formData.googleAuthEnabled}
              name="googleAuthEnabled"
              onChange={handleToggleChange}
              disabled={isDisabled}
            />
            <Field label="Allowed Google Workspace/email domain">
              <input
                name="googleAuthAllowedDomain"
                value={formData.googleAuthAllowedDomain}
                onChange={handleTextChange}
                placeholder="petshophanoi.com"
                disabled={isDisabled}
                className={inputClassName}
              />
              <p className="mt-1 text-xs text-foreground-muted">
                Chi nhap domain email, khong nhap URL app. Vi du: petshophanoi.com.
              </p>
            </Field>
            <Field label="Google OAuth client ID" className="md:col-span-2">
              <input
                name="googleAuthClientId"
                value={formData.googleAuthClientId}
                onChange={handleTextChange}
                placeholder="Google OAuth client ID"
                disabled={isDisabled}
                className={inputClassName}
              />
            </Field>
            <Field label="Google OAuth client secret" className="md:col-span-2">
              <input
                type="password"
                name="googleAuthClientSecret"
                value={formData.googleAuthClientSecret}
                onChange={handleTextChange}
                placeholder={integrationBadges.googleAuthSecret ? 'Đã lưu secret. Nhập để thay mới.' : 'Nhập client secret'}
                disabled={isDisabled}
                className={inputClassName}
              />
            </Field>
            <Field label="Authorized JavaScript origin" className="md:col-span-2">
              <div className="flex gap-2">
                <input
                  value={googleAuthStatusQuery.data?.webAppBaseUrl || ''}
                  disabled
                  className={`${inputClassName} bg-background-tertiary/70 text-foreground-muted`}
                />
                <button
                  type="button"
                  onClick={() => handleCopy(googleAuthStatusQuery.data?.webAppBaseUrl || '', 'JavaScript origin')}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-background-tertiary px-4 py-2 text-xs font-semibold text-foreground-base transition-colors hover:bg-background-elevated"
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
            </Field>
            <Field label="Authorized redirect URI" className="md:col-span-2">
              <div className="flex gap-2">
                <input
                  value={googleAuthStatusQuery.data?.callbackUrl || ''}
                  disabled
                  className={`${inputClassName} bg-background-tertiary/70 text-foreground-muted`}
                />
                <button
                  type="button"
                  onClick={() => handleCopy(googleAuthStatusQuery.data?.callbackUrl || '', 'redirect URI')}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-background-tertiary px-4 py-2 text-xs font-semibold text-foreground-base transition-colors hover:bg-background-elevated"
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
            </Field>
          </div>

          <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-xs text-sky-100">
            <p className="font-semibold text-sky-50">Local Google Login test</p>
            <p className="mt-2">Local khong can deploy: them JavaScript origin http://localhost:3000 va redirect URI http://localhost:3001/api/auth/google/callback trong Google Cloud.</p>
            <p className="mt-1">Production phai dung HTTPS va copy dung chinh xac origin/redirect URI ben tren.</p>
          </div>

          <div className="mt-4 rounded-2xl border border-border/50 bg-background-base p-4 text-xs text-foreground-muted">
            <p className="font-semibold text-foreground-base">Hướng dẫn Google Cloud</p>
            <p className="mt-2">1. Tạo OAuth Client ID loại Web application.</p>
            <p className="mt-1">2. Thêm JavaScript origin và redirect URI đúng như 2 ô bên trên.</p>
            <p className="mt-1">3. Scope chỉ cần: openid, email, profile.</p>
            {googleAuthStatusQuery.data?.allowedDomain ? (
              <p className="mt-1">4. App đang giới hạn domain: {googleAuthStatusQuery.data.allowedDomain}.</p>
            ) : (
              <p className="mt-1">4. Nếu muốn giới hạn email công ty, điền Allowed domain.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border/50 bg-background-elevated/60 p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-base">
                <Cloud size={16} className="text-primary-500" />
                Google Drive shared storage
              </h3>
              <p className="mt-1 text-xs text-foreground-muted">
                Lưu ảnh & file lên Google Drive. DB chỉ giữ link.
              </p>
            </div>
            <StatusBadge active={Boolean(formData.googleDriveEnabled)} configured={integrationBadges.googleDriveSecret} />
          </div>

          {/* Step guide */}
          <div className="mb-6 rounded-2xl border border-border/40 bg-background-base p-4 text-xs text-foreground-muted">
            <p className="mb-2 font-semibold text-foreground-base">Hướng dẫn kết nối (4 bước)</p>
            <ol className="list-decimal space-y-1.5 pl-4">
              <li>Vào <strong className="text-foreground-base">Google Cloud Console</strong> → IAM → Service Accounts → Tạo service account mới.</li>
              <li>Vào tab <strong className="text-foreground-base">Keys</strong> của service account → Add Key → JSON → Download file.json.</li>
              <li>Trong <strong className="text-foreground-base">Google Drive</strong>: tạo thư mục → chuột phải → Share → dán email service account (có trong file JSON) → Editor.</li>
              <li>Copy <strong className="text-foreground-base">Folder ID</strong> từ URL Drive (phần sau <code className="bg-black/20 px-1 py-0.5 rounded">/folders/</code>) và dán vào ô bên dưới.</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ToggleField
              label="Bật Google Drive"
              checked={formData.googleDriveEnabled}
              name="googleDriveEnabled"
              onChange={handleToggleChange}
              disabled={isDisabled}
            />
            <Field label="Storage provider">
              <select
                name="storageProvider"
                value={formData.storageProvider}
                onChange={handleTextChange}
                disabled={isDisabled}
                className={inputClassName}
              >
                <option value="LOCAL">LOCAL — Lưu trên server</option>
                <option value="GOOGLE_DRIVE">GOOGLE_DRIVE — Lưu lên Drive</option>
              </select>
            </Field>

            {/* Primary Folder ID — the one thing users must fill */}
            <Field label="ID thư mục Google Drive *" className="md:col-span-2">
              <input
                name="googleDriveRootFolderId"
                value={formData.googleDriveRootFolderId}
                onChange={handleTextChange}
                placeholder="Dán Folder ID từ URL Drive: /folders/FOLDER_ID_ĐÂY"
                disabled={isDisabled}
                className={inputClassName}
              />
              <p className="mt-1 text-xs text-foreground-muted">
                Share thư mục này cho email service account với quyền Editor.
              </p>
            </Field>

            {/* Service account JSON — file picker + textarea */}
            <Field label="Service Account JSON *" className="md:col-span-2">
              <div className="flex gap-2 mb-2">
                <label
                  className={`inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-xs font-medium ${canUpdateSettings
                    ? 'cursor-pointer bg-background-tertiary transition-colors hover:bg-background-elevated'
                    : 'cursor-not-allowed bg-background-tertiary/60 text-foreground-muted'
                    }`}
                >
                  <Upload size={14} />
                  Chọn file .json
                  <input
                    type="file"
                    className="hidden"
                    accept=".json,application/json"
                    disabled={!canUpdateSettings}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = (ev) => {
                        const content = ev.target?.result as string
                        setFormData((cur) => ({ ...cur, googleDriveServiceAccountJson: content }))
                      }
                      reader.readAsText(file)
                      e.target.value = ''
                    }}
                  />
                </label>
                {integrationBadges.googleDriveSecret && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                    <CheckCircle2 size={12} />
                    Đã kết nối
                  </span>
                )}
              </div>
              <textarea
                name="googleDriveServiceAccountJson"
                value={formData.googleDriveServiceAccountJson}
                onChange={handleTextChange}
                placeholder={integrationBadges.googleDriveSecret
                  ? 'Đã lưu service account. Chọn file mới để thay, hoặc bỏ trống để giữ nguyên.'
                  : 'Dán nội dung file JSON hoặc bấm "Chọn file .json" bên trên...'}
                disabled={isDisabled}
                rows={5}
                className={`${inputClassName} min-h-32 resize-y font-mono text-xs`}
              />
              <p className="mt-1 text-xs text-foreground-muted">
                JSON được mã hóa trong DB. Cần env <code className="bg-black/20 px-1 rounded">APP_SECRET_ENCRYPTION_KEY</code>.
              </p>
            </Field>
          </div>

          {/* Advanced fields (collapsible) */}
          <details className="mt-4 rounded-xl border border-border/40 bg-background-base">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-foreground-muted hover:text-foreground-base select-none">
              ⚙️ Cấu hình nâng cao (tùy chọn)
            </summary>
            <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2">
              <Field label="Image folder ID">
                <input
                  name="googleDriveImageFolderId"
                  value={formData.googleDriveImageFolderId}
                  onChange={handleTextChange}
                  placeholder="Mặc định: dùng Root folder ID"
                  disabled={isDisabled}
                  className={inputClassName}
                />
              </Field>
              <Field label="Document folder ID">
                <input
                  name="googleDriveDocumentFolderId"
                  value={formData.googleDriveDocumentFolderId}
                  onChange={handleTextChange}
                  placeholder="Mặc định: dùng Root folder ID"
                  disabled={isDisabled}
                  className={inputClassName}
                />
              </Field>
              <Field label="Backup folder ID">
                <input
                  name="googleDriveBackupFolderId"
                  value={formData.googleDriveBackupFolderId}
                  onChange={handleTextChange}
                  placeholder="Mặc định: dùng Root folder ID"
                  disabled={isDisabled}
                  className={inputClassName}
                />
              </Field>
              <Field label="Shared Drive ID">
                <input
                  name="googleDriveSharedDriveId"
                  value={formData.googleDriveSharedDriveId}
                  onChange={handleTextChange}
                  placeholder="Chỉ cần nếu dùng Shared Drive"
                  disabled={isDisabled}
                  className={inputClassName}
                />
              </Field>
            </div>
          </details>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => testConnectionMutation.mutate()}
              disabled={
                isDisabled ||
                testConnectionMutation.isPending
              }
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testConnectionMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Cloud size={16} />}
              Kiểm tra kết nối Drive
            </button>
          </div>
        </section>


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

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <label className="text-sm font-bold text-foreground-base">{label}</label>
      {children}
    </div>
  )
}

function ToggleField({
  label,
  checked,
  name,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  name: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-foreground-base">{label}</label>
      <label className="inline-flex items-center gap-3 rounded-xl border border-border/50 bg-black/20 px-4 py-3 text-sm">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="h-4 w-4 rounded border-border/50"
        />
        <span>{checked ? 'Bật' : 'Tắt'}</span>
      </label>
    </div>
  )
}

function StatusBadge({
  active,
  configured,
}: {
  active: boolean
  configured: boolean
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`rounded-full px-3 py-1 font-semibold ${active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
        {active ? 'Hoạt động' : 'Tắt'}
      </span>
      <span className={`rounded-full px-3 py-1 font-semibold ${configured ? 'bg-sky-500/15 text-sky-400' : 'bg-amber-500/15 text-amber-400'}`}>
        {configured ? 'Đã có secret' : 'Thiếu secret'}
      </span>
    </div>
  )
}

const inputClassName =
  'w-full rounded-xl border border-border/50 bg-black/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60'
