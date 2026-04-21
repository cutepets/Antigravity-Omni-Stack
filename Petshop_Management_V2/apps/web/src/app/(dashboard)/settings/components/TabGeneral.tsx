'use client'

import Image from 'next/image'
import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Cloud, KeyRound, RefreshCw, Save, Store, Upload } from 'lucide-react'
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
        throw new Error(response.data?.message || 'Luu that bai')
      }
      return response.data
    },
    onMutate: () => setIsSaving(true),
    onSuccess: () => {
      setSavedState(true)
      toast.success('Da luu cau hinh he thong')
      queryClient.invalidateQueries({ queryKey: ['settings', 'configs'] })
      setTimeout(() => {
        setSavedState(false)
        setIsSaving(false)
      }, 2000)
    },
    onError: (mutationError: any) => {
      setIsSaving(false)
      const message = mutationError?.response?.data?.message || mutationError?.message || 'Loi khong xac dinh'
      toast.error(`Loi khi luu: ${message}`)
    },
  })

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/settings/google-drive/test')
      return response.data
    },
    onSuccess: () => {
      toast.success('Ket noi Google Drive hop le')
    },
    onError: (mutationError: any) => {
      const message = mutationError?.response?.data?.message || mutationError?.message || 'Khong test duoc ket noi'
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
      toast.error('File qua lon. Toi da 5MB')
      return
    }

    setUploadingLogo(true)
    try {
      const imageUrl = await uploadApi.uploadImage(file)
      setFormData((current) => ({ ...current, shopLogo: imageUrl }))
      toast.success('Tai logo thanh cong')
    } catch (uploadError: any) {
      const message = uploadError?.response?.data?.message || uploadError?.message || 'Loi upload'
      toast.error(`Khong tai duoc logo: ${message}`)
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
        Dang tai cau hinh...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-40 items-center justify-center gap-3 text-red-400">
        <AlertCircle size={20} />
        Khong the tai cau hinh. Vui long kiem tra ket noi API.
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
              Cau hinh cua hang va Google integrations
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Cua hang, Google Login, Google Drive shared storage.
            </p>
          </div>

          {!canUpdateSettings ? (
            <span className="rounded-full border border-border/60 bg-background-elevated px-3 py-1 text-xs font-semibold text-foreground-muted">
              Che do chi xem
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-8 p-8">
        <section className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-bold text-foreground-base">Logo cua hang</h3>
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
                  className={`inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-medium ${
                    canUpdateSettings
                      ? 'cursor-pointer bg-background-tertiary transition-colors hover:bg-background-elevated'
                      : 'cursor-not-allowed bg-background-tertiary/60 text-foreground-muted'
                  }`}
                >
                  <Upload size={16} className="text-foreground-muted" />
                  {uploadingLogo ? 'Dang tai...' : 'Tai logo len'}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleLogoUpload}
                    disabled={!canUpdateSettings || uploadingLogo}
                  />
                </label>
                <p className="mt-2 text-xs text-foreground-muted">PNG, JPG, WebP, toi da 5MB</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field label="Ten cua hang">
              <input name="shopName" value={formData.shopName} onChange={handleTextChange} disabled={isDisabled} className={inputClassName} />
            </Field>
            <Field label="So dien thoai">
              <input name="shopPhone" value={formData.shopPhone} onChange={handleTextChange} disabled={isDisabled} className={inputClassName} />
            </Field>
            <Field label="Email">
              <input name="email" value={formData.email} onChange={handleTextChange} disabled={isDisabled} className={inputClassName} />
            </Field>
            <Field label="Website">
              <input name="website" value={formData.website} onChange={handleTextChange} disabled={isDisabled} className={inputClassName} />
            </Field>
            <Field label="Dia chi" className="md:col-span-2">
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
                User login bang Google, van tra cookie/session nhu login thuong.
              </p>
            </div>
            <StatusBadge active={Boolean(formData.googleAuthEnabled)} configured={integrationBadges.googleAuthSecret} />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ToggleField
              label="Bat Google Login"
              checked={formData.googleAuthEnabled}
              name="googleAuthEnabled"
              onChange={handleToggleChange}
              disabled={isDisabled}
            />
            <Field label="Allowed domain">
              <input
                name="googleAuthAllowedDomain"
                value={formData.googleAuthAllowedDomain}
                onChange={handleTextChange}
                placeholder="example.com"
                disabled={isDisabled}
                className={inputClassName}
              />
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
                placeholder={integrationBadges.googleAuthSecret ? 'Da luu secret. Nhap de thay moi.' : 'Nhap client secret'}
                disabled={isDisabled}
                className={inputClassName}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-border/50 bg-background-elevated/60 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-base">
                <Cloud size={16} className="text-primary-500" />
                Google Drive shared storage
              </h3>
              <p className="mt-1 text-xs text-foreground-muted">
                App luu file len shared drive. DB chi giu metadata va link hien thi.
              </p>
            </div>
            <StatusBadge active={Boolean(formData.googleDriveEnabled)} configured={integrationBadges.googleDriveSecret} />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field label="Storage provider">
              <select
                name="storageProvider"
                value={formData.storageProvider}
                onChange={handleTextChange}
                disabled={isDisabled}
                className={inputClassName}
              >
                <option value="LOCAL">LOCAL</option>
                <option value="GOOGLE_DRIVE">GOOGLE_DRIVE</option>
              </select>
            </Field>
            <ToggleField
              label="Bat Google Drive"
              checked={formData.googleDriveEnabled}
              name="googleDriveEnabled"
              onChange={handleToggleChange}
              disabled={isDisabled}
            />
            <Field label="Service account email">
              <input
                name="googleDriveClientEmail"
                value={formData.googleDriveClientEmail}
                onChange={handleTextChange}
                placeholder="storage@project.iam.gserviceaccount.com"
                disabled={isDisabled}
                className={inputClassName}
              />
            </Field>
            <Field label="Shared drive ID">
              <input
                name="googleDriveSharedDriveId"
                value={formData.googleDriveSharedDriveId}
                onChange={handleTextChange}
                placeholder="Shared Drive ID"
                disabled={isDisabled}
                className={inputClassName}
              />
            </Field>
            <Field label="Root folder ID">
              <input
                name="googleDriveRootFolderId"
                value={formData.googleDriveRootFolderId}
                onChange={handleTextChange}
                placeholder="Root folder ID"
                disabled={isDisabled}
                className={inputClassName}
              />
            </Field>
            <Field label="Image folder ID">
              <input
                name="googleDriveImageFolderId"
                value={formData.googleDriveImageFolderId}
                onChange={handleTextChange}
                placeholder="Images folder ID"
                disabled={isDisabled}
                className={inputClassName}
              />
            </Field>
            <Field label="Document folder ID">
              <input
                name="googleDriveDocumentFolderId"
                value={formData.googleDriveDocumentFolderId}
                onChange={handleTextChange}
                placeholder="Documents folder ID"
                disabled={isDisabled}
                className={inputClassName}
              />
            </Field>
            <Field label="Backup folder ID">
              <input
                name="googleDriveBackupFolderId"
                value={formData.googleDriveBackupFolderId}
                onChange={handleTextChange}
                placeholder="Backups folder ID"
                disabled={isDisabled}
                className={inputClassName}
              />
            </Field>
            <Field label="Service account JSON" className="md:col-span-2">
              <textarea
                name="googleDriveServiceAccountJson"
                value={formData.googleDriveServiceAccountJson}
                onChange={handleTextChange}
                placeholder={integrationBadges.googleDriveSecret ? 'Da luu service account. Dan JSON moi neu can thay.' : '{"client_email":"...","private_key":"..."}'}
                disabled={isDisabled}
                rows={8}
                className={`${inputClassName} min-h-40 resize-y`}
              />
              <p className="mt-2 text-xs text-foreground-muted">
                Secret duoc ma hoa trong DB. Can co env `APP_SECRET_ENCRYPTION_KEY` de luu va doc.
              </p>
            </Field>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => testConnectionMutation.mutate()}
              disabled={
                isDisabled ||
                !formData.googleDriveEnabled ||
                formData.storageProvider !== 'GOOGLE_DRIVE' ||
                testConnectionMutation.isPending
              }
              className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-semibold text-foreground-base transition-colors hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testConnectionMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Cloud size={16} />}
              Test Google Drive
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
                Da xong
              </>
            ) : (
              <>
                <Save size={18} />
                Luu thay doi
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
        <span>{checked ? 'Enabled' : 'Disabled'}</span>
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
        {active ? 'Enabled' : 'Disabled'}
      </span>
      <span className={`rounded-full px-3 py-1 font-semibold ${configured ? 'bg-sky-500/15 text-sky-400' : 'bg-amber-500/15 text-amber-400'}`}>
        {configured ? 'Secret saved' : 'Secret missing'}
      </span>
    </div>
  )
}

const inputClassName =
  'w-full rounded-xl border border-border/50 bg-black/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60'
