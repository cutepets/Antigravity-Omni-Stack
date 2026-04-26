'use client'

import Image from 'next/image'
import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, Cloud, Copy, ExternalLink, KeyRound, RefreshCw, Save, Settings, Store, Upload } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthorization } from '@/hooks/useAuthorization'
import { API_URL, api, uploadApi } from '@/lib/api'

type SettingsFormData = {
  shopName: string
  shopPhone: string
  email: string
  website: string
  shopAddress: string
  shopLogo: string
  orderReturnWindowDays: string
  storageProvider: 'LOCAL' | 'GOOGLE_DRIVE'
  googleAuthEnabled: boolean
  googleAuthClientId: string
  googleAuthClientSecret: string
  googleAuthAllowedDomain: string
  googleDriveEnabled: boolean
  googleDriveAuthMode: 'SERVICE_ACCOUNT' | 'OAUTH'
  googleDriveServiceAccountJson: string
  googleDriveClientEmail: string
  googleDriveOAuthEmail: string
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
  linkCallbackUrl: string
}

const DEFAULT_FORM: SettingsFormData = {
  shopName: '',
  shopPhone: '',
  email: '',
  website: '',
  shopAddress: '',
  shopLogo: '',
  orderReturnWindowDays: '7',
  storageProvider: 'LOCAL',
  googleAuthEnabled: false,
  googleAuthClientId: '',
  googleAuthClientSecret: '',
  googleAuthAllowedDomain: '',
  googleDriveEnabled: false,
  googleDriveAuthMode: 'OAUTH',
  googleDriveServiceAccountJson: '',
  googleDriveClientEmail: '',
  googleDriveOAuthEmail: '',
  googleDriveSharedDriveId: '',
  googleDriveRootFolderId: '',
  googleDriveImageFolderId: '',
  googleDriveDocumentFolderId: '',
  googleDriveBackupFolderId: '',
}

function normalizeGoogleAllowedDomain(value: string) {
  const raw = value.trim()
  if (!raw) return ''

  try {
    const host = /^https?:\/\//i.test(raw) ? new URL(raw).hostname : raw
    return host.toLowerCase().replace(/\.$/, '').replace(/^(app|www)\./, '')
  } catch {
    return raw.toLowerCase().replace(/^(app|www)\./, '')
  }
}

export function TabGeneral() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthorization()
  const canUpdateSettings = hasPermission('settings.app.update')

  const [isSaving, setIsSaving] = useState(false)
  const [savedState, setSavedState] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [formData, setFormData] = useState<SettingsFormData>(DEFAULT_FORM)
  const [showGoogleOAuthConfig, setShowGoogleOAuthConfig] = useState(false)
  const [showGoogleAuthConfig, setShowGoogleAuthConfig] = useState(false)
  const [showGoogleDriveConfig, setShowGoogleDriveConfig] = useState(false)
  const [driveTestError, setDriveTestError] = useState<string | null>(null)

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
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const driveStatus = params.get('google_drive')
    if (!driveStatus) return

    const message = params.get('message') || ''
    if (driveStatus === 'success') {
      toast.success('Da ket noi Google Drive thanh cong')
      queryClient.invalidateQueries({ queryKey: ['settings', 'configs'] })
    } else if (driveStatus === 'error') {
      toast.error(`Google Drive: ${message || 'Khong ket noi duoc tai khoan Google'}`)
    }

    params.delete('google_drive')
    params.delete('message')
    const nextQuery = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`)
  }, [queryClient])

  useEffect(() => {
    if (!data) return

    const resolvedGoogleDriveAuthMode =
      data.googleDriveAuthMode === 'OAUTH'
        ? 'OAUTH'
        : data.googleDriveAuthMode === 'SERVICE_ACCOUNT' && data.googleDriveServiceAccountConfigured
          ? 'SERVICE_ACCOUNT'
          : 'OAUTH'

    setFormData({
      shopName: data.shopName || '',
      shopPhone: data.shopPhone || '',
      email: data.email || '',
      website: data.website || '',
      shopAddress: data.shopAddress || '',
      shopLogo: data.shopLogo || '',
      orderReturnWindowDays: String(data.orderReturnWindowDays ?? 7),
      storageProvider: data.storageProvider || 'LOCAL',
      googleAuthEnabled: Boolean(data.googleAuthEnabled),
      googleAuthClientId: data.googleAuthClientId || '',
      googleAuthClientSecret: '',
      googleAuthAllowedDomain: normalizeGoogleAllowedDomain(data.googleAuthAllowedDomain || ''),
      googleDriveEnabled: Boolean(data.googleDriveEnabled),
      googleDriveAuthMode: resolvedGoogleDriveAuthMode,
      googleDriveServiceAccountJson: '',
      googleDriveClientEmail: data.googleDriveClientEmail || '',
      googleDriveOAuthEmail: data.googleDriveOAuthEmail || '',
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
    onMutate: () => {
      setDriveTestError(null)
    },
    onSuccess: () => {
      setDriveTestError(null)
      toast.success('✅ Kết nối Google Drive thành công!')
    },
    onError: (mutationError: any) => {
      const message = mutationError?.response?.data?.message || mutationError?.message || 'Không test được kết nối'
      setDriveTestError(message)
      toast.error(`Google Drive: ${message}`)
    },
  })

  const disconnectDriveOAuthMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/settings/google-drive/oauth/disconnect')
      return response.data
    },
    onSuccess: () => {
      toast.success('Da ngat ket noi Google Drive')
      queryClient.invalidateQueries({ queryKey: ['settings', 'configs'] })
    },
    onError: (mutationError: any) => {
      const message = mutationError?.response?.data?.message || mutationError?.message || 'Khong ngat ket noi duoc'
      toast.error(`Google Drive: ${message}`)
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

  const handleDriveOAuthConnect = () => {
    if (!canUpdateSettings) return
    window.location.href = `${API_URL}/api/settings/google-drive/oauth/start`
  }

  const handleCopy = async (value: string, label: string) => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      toast.success(`Đã copy ${label}`)
    } catch {
      toast.error(`Không copy được ${label}`)
    }
  }

  const handleSave = () => {
    if (!canUpdateSettings) return

    const payload: Record<string, unknown> = {
      shopName: formData.shopName,
      shopPhone: formData.shopPhone,
      email: formData.email,
      website: formData.website,
      shopAddress: formData.shopAddress,
      shopLogo: formData.shopLogo,
      orderReturnWindowDays: Number(formData.orderReturnWindowDays || 0),
      storageProvider: formData.storageProvider,
      googleAuthEnabled: formData.googleAuthEnabled,
      googleAuthClientId: formData.googleAuthClientId,
      googleAuthAllowedDomain: normalizeGoogleAllowedDomain(formData.googleAuthAllowedDomain),
      googleDriveEnabled: formData.googleDriveEnabled,
    }
    if (formData.googleDriveEnabled) {
      payload.googleDriveAuthMode = formData.googleDriveAuthMode
      payload.googleDriveClientEmail = formData.googleDriveClientEmail
      payload.googleDriveSharedDriveId = formData.googleDriveSharedDriveId
      payload.googleDriveRootFolderId = formData.googleDriveRootFolderId
      payload.googleDriveImageFolderId = formData.googleDriveImageFolderId
      payload.googleDriveDocumentFolderId = formData.googleDriveDocumentFolderId
      payload.googleDriveBackupFolderId = formData.googleDriveBackupFolderId
    }
    if (!formData.googleAuthClientSecret.trim()) {
      delete payload.googleAuthClientSecret
    } else {
      payload.googleAuthClientSecret = formData.googleAuthClientSecret
    }
    if (!formData.googleDriveServiceAccountJson.trim()) {
      delete payload.googleDriveServiceAccountJson
    } else if (formData.googleDriveEnabled && formData.googleDriveAuthMode === 'SERVICE_ACCOUNT') {
      payload.googleDriveServiceAccountJson = formData.googleDriveServiceAccountJson
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
      const message = uploadError?.response?.data?.message || uploadError?.message || 'Lỗi upload'
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
      googleDriveOAuth: Boolean(data?.googleDriveOAuthConnected),
    }),
    [data],
  )
  const hasGoogleAuthDraftSecret = formData.googleAuthClientSecret.trim().length > 0
  const hasSavedGoogleOAuthClient = Boolean(formData.googleAuthClientId.trim()) && integrationBadges.googleAuthSecret
  const hasGoogleDriveDraftSecret = formData.googleDriveServiceAccountJson.trim().length > 0
  const hasGoogleDriveCredential =
    formData.googleDriveAuthMode === 'OAUTH'
      ? integrationBadges.googleDriveOAuth
      : integrationBadges.googleDriveSecret || hasGoogleDriveDraftSecret
  const driveOAuthCallbackUrl = `${API_URL}/api/settings/google-drive/oauth/callback`
  const googleDriveAccountLabel =
    formData.googleDriveAuthMode === 'OAUTH'
      ? integrationBadges.googleDriveOAuth
        ? formData.googleDriveOAuthEmail || formData.googleDriveClientEmail || 'Google account'
        : 'Chưa kết nối'
      : integrationBadges.googleDriveSecret || formData.googleDriveClientEmail
        ? formData.googleDriveClientEmail || 'Service account đã lưu'
        : 'Chưa có service account'

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
            <Field label="Thời hạn đổi/trả (ngày)">
              <input
                name="orderReturnWindowDays"
                type="number"
                min={0}
                step={1}
                value={formData.orderReturnWindowDays}
                onChange={handleTextChange}
                disabled={isDisabled}
                className={inputClassName}
              />
              <p className="mt-1 text-xs text-foreground-muted">Mặc định 7 ngày từ ngày hoàn thành đơn. Nhập 0 để không giới hạn.</p>
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-border/50 bg-background-elevated/60 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <KeyRound size={16} className="text-primary-500" />
              <div>
                <h3 className="text-sm font-bold text-foreground-base">Google OAuth Client</h3>
                <p className="mt-0.5 text-xs text-foreground-muted">
                  Một bộ Client ID/Secret dùng chung cho Google Login và Google Drive.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {integrationBadges.googleAuthSecret ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">Đã cấu hình</span>
              ) : hasGoogleAuthDraftSecret ? (
                <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-300">Chưa lưu</span>
              ) : (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400">Chưa có credential</span>
              )}
              <button
                type="button"
                onClick={() => setShowGoogleOAuthConfig((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-xs font-semibold text-foreground-base transition-colors hover:bg-background-secondary"
              >
                <Settings size={14} />
                Cập nhật cấu hình
                <ChevronDown size={14} className={`transition-transform ${showGoogleOAuthConfig ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-foreground-muted md:grid-cols-3">
            <SummaryItem label="Client ID" value={formData.googleAuthClientId || 'Chưa nhập'} />
            <SummaryItem label="Secret" value={integrationBadges.googleAuthSecret ? 'Đã lưu trong DB' : hasGoogleAuthDraftSecret ? 'Có secret mới chưa lưu' : 'Chưa có'} />
            <SummaryItem label="Redirect URIs" value="Login, Link, Drive" />
          </div>

          {showGoogleOAuthConfig && (
            <div className="mt-5 space-y-5 rounded-2xl border border-border/40 bg-background-base p-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field label="Google OAuth Client ID">
              <input
                name="googleAuthClientId"
                value={formData.googleAuthClientId}
                onChange={handleTextChange}
                placeholder="1507...apps.googleusercontent.com"
                disabled={isDisabled}
                className={inputClassName}
              />
              <p className="mt-1 text-xs text-foreground-muted">
                Copy từ mục Client ID trong Google Cloud OAuth Client.
              </p>
            </Field>
            <Field label="Google OAuth Client Secret">
              <input
                type="password"
                name="googleAuthClientSecret"
                value={formData.googleAuthClientSecret}
                onChange={handleTextChange}
                placeholder={integrationBadges.googleAuthSecret ? 'Đã lưu secret. Nhập để thay mới.' : 'Nhập client secret'}
                disabled={isDisabled}
                className={inputClassName}
              />
              <p className="mt-1 text-xs text-foreground-muted">
                Secret được mã hóa trong DB. Nhập mới chỉ khi cần thay.
              </p>
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
            <Field label="Google Login redirect URI" className="md:col-span-2">
              <div className="flex gap-2">
                <input
                  value={googleAuthStatusQuery.data?.callbackUrl || ''}
                  disabled
                  className={`${inputClassName} bg-background-tertiary/70 text-foreground-muted`}
                />
                <button
                  type="button"
                  onClick={() => handleCopy(googleAuthStatusQuery.data?.callbackUrl || '', 'Google Login redirect URI')}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-background-tertiary px-4 py-2 text-xs font-semibold text-foreground-base transition-colors hover:bg-background-elevated"
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
            </Field>
            <Field label="Google Link redirect URI" className="md:col-span-2">
              <div className="flex gap-2">
                <input
                  value={googleAuthStatusQuery.data?.linkCallbackUrl || ''}
                  disabled
                  className={`${inputClassName} bg-background-tertiary/70 text-foreground-muted`}
                />
                <button
                  type="button"
                  onClick={() => handleCopy(googleAuthStatusQuery.data?.linkCallbackUrl || '', 'Google Link redirect URI')}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-background-tertiary px-4 py-2 text-xs font-semibold text-foreground-base transition-colors hover:bg-background-elevated"
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
            </Field>
            <Field label="Google Drive redirect URI" className="md:col-span-2">
              <div className="flex gap-2">
                <input
                  value={driveOAuthCallbackUrl}
                  disabled
                  className={`${inputClassName} bg-background-tertiary/70 text-foreground-muted`}
                />
                <button
                  type="button"
                  onClick={() => handleCopy(driveOAuthCallbackUrl, 'Google Drive redirect URI')}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-background-tertiary px-4 py-2 text-xs font-semibold text-foreground-base transition-colors hover:bg-background-elevated"
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
            </Field>
          </div>

          <div className="rounded-2xl border border-border/50 bg-background-base p-4 text-xs text-foreground-muted">
            <p className="font-semibold text-foreground-base">Google Cloud cần cấu hình</p>
            <p className="mt-2">1. OAuth Client loại Web application.</p>
            <p className="mt-1">2. Authorized JavaScript origin: URL web app, ví dụ <code className="rounded bg-black/20 px-1">http://localhost:3000</code>.</p>
            <p className="mt-1">3. Authorized redirect URIs: thêm Google Login redirect URI, Google Link redirect URI và Google Drive redirect URI ở trên.</p>
            <p className="mt-1">4. Nếu dùng Google Drive, OAuth consent screen phải có scope <code className="rounded bg-black/20 px-1">https://www.googleapis.com/auth/drive</code>.</p>
          </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border/50 bg-background-elevated/60 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <KeyRound size={16} className="text-primary-500" />
              <div>
                <h3 className="text-sm font-bold text-foreground-base">Google Login</h3>
                <p className="mt-0.5 text-xs text-foreground-muted">
                  Cho phép đăng nhập bằng tài khoản Google Workspace.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {formData.googleAuthEnabled && hasSavedGoogleOAuthClient ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">Đang bật</span>
              ) : formData.googleAuthEnabled ? (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400">Thiếu OAuth Client</span>
              ) : null}
              <ToggleSwitch
                checked={formData.googleAuthEnabled}
                name="googleAuthEnabled"
                onChange={handleToggleChange}
                disabled={isDisabled}
              />
            </div>
          </div>

          {formData.googleAuthEnabled && (
            <>
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowGoogleAuthConfig((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-xs font-semibold text-foreground-base transition-colors hover:bg-background-secondary"
                >
                  <Settings size={14} />
                  Cập nhật cấu hình
                  <ChevronDown size={14} className={`transition-transform ${showGoogleAuthConfig ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showGoogleAuthConfig && (
                <div className="mt-4 space-y-6 rounded-2xl border border-border/40 bg-background-base p-5">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Field label="Domain email được phép">
                      <input
                        name="googleAuthAllowedDomain"
                        value={formData.googleAuthAllowedDomain}
                        onChange={handleTextChange}
                        placeholder="petshophanoi.com"
                        disabled={isDisabled}
                        className={inputClassName}
                      />
                      <p className="mt-1 text-xs text-foreground-muted">
                        Chỉ nhập domain email, không nhập URL app. Ví dụ: petshophanoi.com.
                      </p>
                    </Field>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-background-base p-4 text-xs text-foreground-muted">
                    <p className="font-semibold text-foreground-base">Google Login dùng OAuth Client chung</p>
                    <p className="mt-2">Client ID/Secret và redirect URI nằm ở section Google OAuth Client phía trên.</p>
                    {googleAuthStatusQuery.data?.allowedDomain ? (
                      <p className="mt-1">App đang giới hạn domain: {googleAuthStatusQuery.data.allowedDomain}.</p>
                    ) : (
                      <p className="mt-1">Nếu muốn giới hạn email công ty, điền domain ở trên.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="rounded-2xl border border-border/50 bg-background-elevated/60 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Cloud size={16} className="text-primary-500" />
              <div>
                <h3 className="text-sm font-bold text-foreground-base">Google Drive — Lưu trữ đám mây</h3>
                <p className="mt-0.5 text-xs text-foreground-muted">
                  Lưu ảnh & file lên Google Drive. DB chỉ giữ link.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasGoogleDriveCredential ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">Đã kết nối</span>
              ) : hasGoogleDriveDraftSecret && formData.googleDriveAuthMode === 'SERVICE_ACCOUNT' ? (
                <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-300">Chưa lưu</span>
              ) : formData.googleDriveEnabled ? (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400">
                  {formData.googleDriveAuthMode === 'OAUTH' ? 'Chưa kết nối' : 'Thiếu secret'}
                </span>
              ) : null}
              <ToggleSwitch
                checked={formData.googleDriveEnabled}
                name="googleDriveEnabled"
                onChange={handleToggleChange}
                disabled={isDisabled}
              />
            </div>
          </div>

          {formData.googleDriveEnabled && (
            <>
              <div className="mt-5 grid grid-cols-1 gap-3 text-xs text-foreground-muted md:grid-cols-4">
                <SummaryItem label="Nơi lưu" value={formData.storageProvider === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Server local'} />
                <SummaryItem label="Kiểu kết nối" value={formData.googleDriveAuthMode === 'OAUTH' ? 'Tài khoản Google' : 'Service Account'} />
                <SummaryItem label="Tài khoản" value={googleDriveAccountLabel} />
                <SummaryItem label="Root folder" value={formData.googleDriveRootFolderId || 'Chưa nhập'} />
              </div>

              {showGoogleDriveConfig && (
              <>
              <div className="mt-5 rounded-2xl border border-border/40 bg-background-base p-4">
                <Field label="Nơi lưu trữ file">
                  <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setFormData((c) => ({ ...c, storageProvider: 'LOCAL' }))}
                      disabled={isDisabled}
                      className={`rounded-2xl border px-4 py-3.5 text-left transition-colors ${formData.storageProvider === 'LOCAL'
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-border/40 bg-black/10 hover:bg-black/20'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <div className="text-sm font-semibold text-foreground-base">Lưu trên server (Local)</div>
                      <div className="mt-1 text-xs text-foreground-muted">File lưu trực tiếp trên ổ đĩa server.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((c) => ({ ...c, storageProvider: 'GOOGLE_DRIVE' }))}
                      disabled={isDisabled}
                      className={`rounded-2xl border px-4 py-3.5 text-left transition-colors ${formData.storageProvider === 'GOOGLE_DRIVE'
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-border/40 bg-black/10 hover:bg-black/20'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <div className="text-sm font-semibold text-foreground-base">Lưu lên Google Drive</div>
                      <div className="mt-1 text-xs text-foreground-muted">File upload lên Drive, DB chỉ giữ link.</div>
                    </button>
                  </div>
                </Field>
              </div>

              {formData.storageProvider === 'GOOGLE_DRIVE' && (
                <div className="mt-4 rounded-2xl border border-border/40 bg-background-base p-4">
                  <Field label="Kiểu kết nối Google Drive">
                    <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setFormData((c) => ({ ...c, googleDriveAuthMode: 'OAUTH' }))}
                        disabled={isDisabled}
                        className={`rounded-2xl border px-4 py-3.5 text-left transition-colors ${formData.googleDriveAuthMode === 'OAUTH'
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-border/40 bg-black/10 hover:bg-black/20'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <div className="text-sm font-semibold text-foreground-base">Đăng nhập tài khoản Google</div>
                        <div className="mt-1 text-xs text-foreground-muted">Upload bằng dung lượng Drive của tài khoản cá nhân đã kết nối.</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData((c) => ({ ...c, googleDriveAuthMode: 'SERVICE_ACCOUNT' }))}
                        disabled={isDisabled}
                        className={`rounded-2xl border px-4 py-3.5 text-left transition-colors ${formData.googleDriveAuthMode === 'SERVICE_ACCOUNT'
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-border/40 bg-black/10 hover:bg-black/20'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <div className="text-sm font-semibold text-foreground-base">Service Account</div>
                        <div className="mt-1 text-xs text-foreground-muted">Dùng JSON service account, phù hợp khi có Shared Drive.</div>
                      </button>
                    </div>
                  </Field>
                </div>
              )}
              </>
              )}

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowGoogleDriveConfig((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-xs font-semibold text-foreground-base transition-colors hover:bg-background-secondary"
                >
                  <Settings size={14} />
                  Cập nhật cấu hình
                  <ChevronDown size={14} className={`transition-transform ${showGoogleDriveConfig ? 'rotate-180' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={isDisabled || testConnectionMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testConnectionMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Cloud size={16} />}
                  Kiểm tra kết nối
                </button>
              </div>

              {showGoogleDriveConfig && (
                <div className="mt-4 space-y-6 rounded-2xl border border-border/40 bg-background-base p-5">
                  {formData.googleDriveAuthMode === 'OAUTH' && (
                    <div className="rounded-2xl border border-primary-500/30 bg-primary-500/10 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground-base">Tài khoản Google Drive</p>
                          <p className="mt-1 text-xs text-foreground-muted">
                            {integrationBadges.googleDriveOAuth
                              ? `Đã kết nối: ${formData.googleDriveOAuthEmail || formData.googleDriveClientEmail || 'Google account'}`
                              : 'Chưa kết nối tài khoản Google Drive.'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleDriveOAuthConnect}
                            disabled={isDisabled || !hasSavedGoogleOAuthClient}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Cloud size={14} />
                            {integrationBadges.googleDriveOAuth ? 'Kết nối lại' : 'Kết nối Google Drive'}
                          </button>
                          {integrationBadges.googleDriveOAuth && (
                            <button
                              type="button"
                              onClick={() => disconnectDriveOAuthMutation.mutate()}
                              disabled={isDisabled || disconnectDriveOAuthMutation.isPending}
                              className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-xs font-semibold text-foreground-base transition-colors hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {disconnectDriveOAuthMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : null}
                              Ngắt kết nối
                            </button>
                          )}
                        </div>
                      </div>
                      {!hasSavedGoogleOAuthClient && (
                        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                          Cần lưu Google OAuth Client ID/Secret ở section phía trên trước khi kết nối Drive.
                        </p>
                      )}
                      <details className="mt-4 rounded-xl border border-primary-400/20 bg-background-base/70 p-4 text-xs text-foreground-muted">
                        <summary className="cursor-pointer select-none font-semibold text-foreground-base">
                          Hướng dẫn tích hợp tài khoản Google cá nhân
                        </summary>
                        <ol className="mt-3 list-decimal space-y-2.5 pl-4">
                          <li>Cấu hình <strong className="text-foreground-base">Client ID</strong> và <strong className="text-foreground-base">Client secret</strong> trong section <strong className="text-foreground-base">Google OAuth Client</strong> phía trên rồi bấm lưu.</li>
                          <li>
                            Trong{' '}
                            <a
                              href="https://console.cloud.google.com/apis/credentials/consent"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-primary-400 underline decoration-primary-400/40 hover:text-primary-300"
                            >
                              OAuth consent screen
                              <ExternalLink size={11} />
                            </a>
                            , thêm scope <code className="rounded bg-black/20 px-1 py-0.5">https://www.googleapis.com/auth/drive</code>. Nếu app đang ở Testing, thêm Gmail sẽ dùng upload vào Test users.
                          </li>
                          <li>
                            Trong OAuth Client loại Web application, thêm Authorized JavaScript origin là URL web app, ví dụ <code className="rounded bg-black/20 px-1 py-0.5">http://localhost:3000</code>. Sau đó thêm redirect URI bên dưới rồi Save.
                            <div className="mt-2 flex gap-2">
                              <input
                                value={driveOAuthCallbackUrl}
                                disabled
                                className={`${inputClassName} bg-background-tertiary/70 text-foreground-muted`}
                              />
                              <button
                                type="button"
                                onClick={() => handleCopy(driveOAuthCallbackUrl, 'Drive OAuth redirect URI')}
                                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-background-tertiary px-4 py-2 text-xs font-semibold text-foreground-base transition-colors hover:bg-background-elevated"
                              >
                                <Copy size={14} />
                                Copy
                              </button>
                            </div>
                          </li>
                          <li>Bấm <strong className="text-foreground-base">Kết nối Google Drive</strong>, chọn tài khoản Google cá nhân và đồng ý quyền Drive.</li>
                          <li>Tạo hoặc chọn thư mục trong My Drive của tài khoản đó, copy Folder ID từ URL rồi dán vào ô bên dưới.</li>
                          <li>Bấm <strong className="text-foreground-base">Lưu thay đổi</strong>, sau đó bấm <strong className="text-foreground-base">Kiểm tra kết nối</strong>.</li>
                        </ol>
                      </details>
                    </div>
                  )}

                  {formData.googleDriveAuthMode === 'SERVICE_ACCOUNT' && (
                  <details className="rounded-2xl border border-border/40 bg-background-elevated/50 p-4 text-xs text-foreground-muted">
                    <summary className="cursor-pointer select-none font-semibold text-foreground-base">
                      Hướng dẫn kết nối Service Account
                    </summary>
                    <ol className="mt-3 list-decimal space-y-2.5 pl-4">
                      <li>
                        Vào{' '}
                        <a
                          href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-primary-400 underline decoration-primary-400/40 hover:text-primary-300"
                        >
                          Google Cloud Console → Service Accounts
                          <ExternalLink size={11} />
                        </a>{' '}
                        → Tạo service account mới (hoặc dùng account hiện có).
                      </li>
                      <li>
                        <strong className="text-foreground-base">Bật Google Drive API:</strong>{' '}
                        <a
                          href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-primary-400 underline decoration-primary-400/40 hover:text-primary-300"
                        >
                          APIs & Services → Google Drive API → Enable
                          <ExternalLink size={11} />
                        </a>
                      </li>
                      <li>
                        Vào tab{' '}
                        <a
                          href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-primary-400 underline decoration-primary-400/40 hover:text-primary-300"
                        >
                          Keys của Service Account
                          <ExternalLink size={11} />
                        </a>{' '}
                        → Add Key → JSON → Download file <code className="rounded bg-black/20 px-1 py-0.5">.json</code>.
                      </li>
                      <li>
                        Trong{' '}
                        <a
                          href="https://drive.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-primary-400 underline decoration-primary-400/40 hover:text-primary-300"
                        >
                          Google Drive
                          <ExternalLink size={11} />
                        </a>
                        : tạo thư mục → chuột phải → Share → dán email service account{' '}
                        {formData.googleDriveClientEmail ? (
                          <code className="rounded bg-primary-500/15 px-1.5 py-0.5 text-primary-300">{formData.googleDriveClientEmail}</code>
                        ) : (
                          <span className="text-foreground-muted">(email sẽ hiện sau khi lưu JSON)</span>
                        )}{' '}
                        → chọn quyền <strong className="text-foreground-base">Editor</strong>.
                      </li>
                      <li>
                        Copy <strong className="text-foreground-base">Folder ID</strong> từ URL Drive:{' '}
                        <code className="rounded bg-black/20 px-1 py-0.5">drive.google.com/drive/folders/<span className="text-primary-400">FOLDER_ID_Ở_ĐÂY</span></code>{' '}
                        và dán vào ô bên dưới.
                      </li>
                    </ol>
                  </details>
                  )}

                  {driveTestError && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
                        <div className="space-y-2">
                          <p className="font-semibold text-red-300">Kết nối thất bại</p>
                          <p className="text-red-200/80">{driveTestError}</p>
                          <div className="mt-2 space-y-1.5 text-foreground-muted">
                            <p className="font-semibold text-foreground-base">Kiểm tra lại:</p>
                            <ul className="list-disc space-y-1 pl-4">
                              {formData.googleDriveAuthMode === 'OAUTH' ? (
                                <>
                                  <li>
                                    <a
                                      href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-primary-400 underline hover:text-primary-300"
                                    >
                                      Google Drive API đã Enable chưa?
                                      <ExternalLink size={10} />
                                    </a>
                                  </li>
                                  <li>OAuth consent screen đã thêm scope Drive và Gmail đã nằm trong Test users nếu app đang Testing chưa?</li>
                                  <li>Redirect URI Drive OAuth đã copy đúng tuyệt đối chưa?</li>
                                  <li>Đã bấm <strong className="text-foreground-base">Kết nối Google Drive</strong> và chọn đúng tài khoản cá nhân chưa?</li>
                                  <li>Folder ID có nằm trong My Drive của tài khoản đã kết nối không?</li>
                                  <li>Đã bấm <strong className="text-foreground-base">Lưu thay đổi</strong> trước khi test chưa?</li>
                                </>
                              ) : (
                                <>
                                  <li>
                                    <a
                                      href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-primary-400 underline hover:text-primary-300"
                                    >
                                      Google Drive API đã Enable chưa?
                                      <ExternalLink size={10} />
                                    </a>
                                  </li>
                                  <li>Folder đã Share cho email service account với quyền <strong className="text-foreground-base">Editor</strong> chưa?</li>
                                  <li>Folder ID đúng chưa? (lấy từ URL sau <code className="rounded bg-black/20 px-1">/folders/</code>)</li>
                                  <li>File JSON service account có đúng và đầy đủ không?</li>
                                  <li>Đã bấm <strong className="text-foreground-base">Lưu thay đổi</strong> trước khi test chưa?</li>
                                </>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                        {formData.googleDriveAuthMode === 'OAUTH'
                          ? 'Thư mục này phải nằm trong Google Drive của tài khoản cá nhân đã kết nối.'
                          : 'Share thư mục này cho email service account với quyền Editor.'}
                      </p>
                    </Field>

                    {formData.googleDriveAuthMode === 'SERVICE_ACCOUNT' && (
                    <Field label="Service Account JSON *" className="md:col-span-2">
                      <div className="mb-2 flex gap-2">
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
                        JSON được mã hóa trong DB. Cần env <code className="rounded bg-black/20 px-1">APP_SECRET_ENCRYPTION_KEY</code>.
                      </p>
                    </Field>
                    )}
                  </div>

                  <details className="rounded-xl border border-border/40 bg-background-elevated/50">
                    <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold text-foreground-muted hover:text-foreground-base">
                      Cấu hình nâng cao (tùy chọn)
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

                </div>
              )}
            </>
          )}
        </section>


        <div className="flex justify-end border-t border-border/40 pt-6">
          <button
            onClick={handleSave}
            disabled={!canUpdateSettings || isSaving}
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/40 bg-background-base px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase text-foreground-muted">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-foreground-base" title={value}>
        {value}
      </p>
    </div>
  )
}

function ToggleSwitch({
  checked,
  name,
  onChange,
  disabled,
}: {
  checked: boolean
  name: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  disabled: boolean
}) {
  return (
    <label className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors ${checked ? 'bg-primary-500' : 'bg-border/60'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <span
        className={`absolute left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </label>
  )
}



const inputClassName =
  'w-full rounded-xl border border-border/50 bg-black/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60'
