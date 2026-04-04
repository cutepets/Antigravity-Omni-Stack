'use client'

import React, { useState, useEffect } from 'react'
import { Store, Upload, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { api, uploadApi } from '@/lib/api'

export function TabGeneral() {
    const queryClient = useQueryClient()
    const [isSaving, setIsSaving] = useState(false)
    const [savedState, setSavedState] = useState(false)
    const [uploadingLogo, setUploadingLogo] = useState(false)

    // ── Fetch config ──────────────────────────────────────────────
    const { data, isLoading, error } = useQuery({
        queryKey: ['settings', 'configs'],
        queryFn: async () => {
            const res = await api.get('/settings/configs')
            return res.data?.data ?? {}
        },
        retry: 1,
        staleTime: 5 * 60 * 1000,
    })

    // ── Form state — field names MUST match backend UpdateConfigDto ──
    const [formData, setFormData] = useState({
        shopName: '',
        shopPhone: '',
        email: '',
        website: '',
        shopAddress: '',  // ← backend field name
        shopLogo: '',     // ← backend field name
    })

    // Populate form when data arrives
    useEffect(() => {
        if (data) {
            setFormData({
                shopName:    data.shopName    || '',
                shopPhone:   data.shopPhone   || '',
                email:       data.email       || '',
                website:     data.website     || '',
                shopAddress: data.shopAddress || '',
                shopLogo:    data.shopLogo    || '',
            })
        }
    }, [data])

    // ── Save mutation ─────────────────────────────────────────────
    const mutation = useMutation({
        mutationFn: async (payload: typeof formData) => {
            const res = await api.put('/settings/configs', payload)
            if (!res.data?.success) throw new Error(res.data?.message || 'Lưu thất bại')
            return res.data
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
        onError: (err: any) => {
            setIsSaving(false)
            const msg = err?.response?.data?.message || err?.message || 'Lỗi không xác định'
            toast.error(`Lỗi khi lưu: ${msg}`)
        },
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSave = () => mutation.mutate(formData)

    // ── Logo upload ───────────────────────────────────────────────
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('File quá lớn. Tối đa 5MB')
            return
        }

        setUploadingLogo(true)
        try {
            const url = await uploadApi.uploadImage(file)
            setFormData(prev => ({ ...prev, shopLogo: url }))
            toast.success('Tải ảnh logo thành công!')
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Lỗi không xác định'
            toast.error(`Lỗi tải ảnh: ${msg}`)
        } finally {
            setUploadingLogo(false)
            // Reset the input so the same file can be re-selected
            e.target.value = ''
        }
    }

    // ── Loading / Error states ────────────────────────────────────
    if (isLoading) {
        return (
            <div className="h-40 flex items-center justify-center gap-3 text-foreground-muted">
                <span className="w-5 h-5 border-2 border-foreground-muted/30 border-t-foreground-muted rounded-full animate-spin" />
                Đang tải cấu hình...
            </div>
        )
    }

    if (error) {
        return (
            <div className="h-40 flex items-center justify-center gap-3 text-red-400">
                <AlertCircle size={20} />
                Không thể tải cấu hình. Vui lòng kiểm tra kết nối API.
            </div>
        )
    }

    return (
        <div className="w-full bg-background-secondary border border-border/60 rounded-3xl overflow-hidden shadow-sm">
            <div className="border-b border-border/50 p-6">
                <h2 className="text-lg font-bold text-foreground-base flex items-center gap-3">
                    <Store className="text-primary-500" size={24} />
                    Thông tin cửa hàng
                </h2>
                <p className="text-sm text-foreground-muted mt-1">Thông tin hiển thị trên hóa đơn và báo cáo.</p>
            </div>

            <div className="p-8 space-y-8">
                {/* Logo section */}
                <div>
                    <h3 className="text-sm font-bold text-foreground-base mb-3">Logo cửa hàng</h3>
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 rounded-2xl bg-black/10 border border-border/50 flex items-center justify-center overflow-hidden shrink-0 relative">
                            {uploadingLogo && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                                    <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                </div>
                            )}
                            {formData.shopLogo ? (
                                <img src={formData.shopLogo} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <Store size={32} className="text-foreground-muted/50" />
                            )}
                        </div>
                        <div>
                            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-background-tertiary hover:bg-background-elevated transition-colors border border-border/60 rounded-xl text-sm font-medium">
                                <Upload size={16} className="text-foreground-muted" />
                                {uploadingLogo ? 'Đang tải...' : 'Tải logo lên'}
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/png, image/jpeg, image/webp"
                                    onChange={handleLogoUpload}
                                    disabled={uploadingLogo}
                                />
                            </label>
                            <p className="text-xs text-foreground-muted mt-2">PNG, JPG, WebP — tối đa 5MB</p>
                            {formData.shopLogo && (
                                <button
                                    onClick={() => setFormData(prev => ({ ...prev, shopLogo: '' }))}
                                    className="text-xs text-red-400 hover:text-red-500 mt-1"
                                >
                                    Xóa logo
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground-base">Tên Cửa Hàng <span className="text-red-500">*</span></label>
                        <input
                            name="shopName"
                            value={formData.shopName}
                            onChange={handleChange}
                            placeholder="VD: Cutepets"
                            className="w-full bg-black/20 border border-border/50 rounded-xl px-4 py-3 outline-none focus:border-primary-500 transition-colors text-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground-base">Số điện thoại liên hệ</label>
                        <input
                            name="shopPhone"
                            value={formData.shopPhone}
                            onChange={handleChange}
                            placeholder="09xxxxxxxx"
                            className="w-full bg-black/20 border border-border/50 rounded-xl px-4 py-3 outline-none focus:border-primary-500 transition-colors text-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground-base">Email</label>
                        <input
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="email@shop.com"
                            className="w-full bg-black/20 border border-border/50 rounded-xl px-4 py-3 outline-none focus:border-primary-500 transition-colors text-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground-base">Website</label>
                        <input
                            name="website"
                            value={formData.website}
                            onChange={handleChange}
                            placeholder="https://..."
                            className="w-full bg-black/20 border border-border/50 rounded-xl px-4 py-3 outline-none focus:border-primary-500 transition-colors text-sm"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-bold text-foreground-base">Địa chỉ trụ sở chính</label>
                        <input
                            name="shopAddress"
                            value={formData.shopAddress}
                            onChange={handleChange}
                            placeholder="123 Đường ABC, Quận X, TP.HCM"
                            className="w-full bg-black/20 border border-border/50 rounded-xl px-4 py-3 outline-none focus:border-primary-500 transition-colors text-sm"
                        />
                    </div>
                </div>

                <div className="pt-6 border-t border-border/40 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !formData.shopName}
                        className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors text-sm"
                    >
                        {isSaving ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : savedState ? (
                            <><CheckCircle2 size={18} /> Đã Xong</>
                        ) : (
                            <><Save size={18} /> Lưu Thay Đổi</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

