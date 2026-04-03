'use client'

import React, { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import * as Switch from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

type NotificationSetting = {
    id: string
    title: string
    description: string
    enabled: boolean
}

export function TabNotifications() {
    // Fake state for now since the DB does not have notification settings schema yet
    const [settings, setSettings] = useState<NotificationSetting[]>([
        { id: 'low_stock', title: 'Cảnh báo tồn kho thấp', description: 'Khi sản phẩm sắp hết hàng cần nhập thêm.', enabled: true },
        { id: 'new_order', title: 'Đơn hàng mới', description: 'Mỗi khi có đơn hoàn tất tại quầy hoặc online.', enabled: true },
        { id: 'shift_report', title: 'Báo cáo chốt ca', description: 'Tổng hợp khi nhân viên kết thúc ca làm việc.', enabled: true },
        { id: 'vaccine_reminder', title: 'Nhắc tiêm chủng đến hạn', description: 'Pet chưa tiêm trong 30 ngày qua.', enabled: false },
        { id: 'debt_alert', title: 'Cảnh báo công nợ', description: 'Khách hàng có đơn chưa thanh toán > 7 ngày.', enabled: true },
    ])

    const toggleSetting = (id: string, value: boolean) => {
        setSettings(prev => prev.map(s => s.id === id ? { ...s, enabled: value } : s))
        // Here we would call a save API endpoint and show a toast
    }

    return (
        <div className="w-full bg-background-secondary border border-border/60 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[500px]">
            <div className="border-b border-border/50 p-6 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-foreground-base flex items-center gap-3">
                        <Bell className="text-primary-500" size={24} /> 
                        Tùy chỉnh Thông báo
                    </h2>
                    <p className="text-sm text-foreground-muted mt-1">Bật/tắt các loại thông báo trong hệ thống.</p>
                </div>
            </div>

            <div className="p-8 space-y-4">
                {settings.map(setting => (
                    <div 
                        key={setting.id}
                        className="flex items-center justify-between p-5 rounded-2xl bg-black/5 border border-border/40 hover:border-border/80 transition-colors"
                    >
                        <div>
                            <h3 className="font-bold text-sm text-foreground-base">{setting.title}</h3>
                            <p className="text-xs text-foreground-muted mt-1">{setting.description}</p>
                        </div>
                        <Switch.Root
                            checked={setting.enabled}
                            onCheckedChange={(val) => toggleSetting(setting.id, val)}
                            className={cn(
                                "relative h-[24px] w-[44px] cursor-pointer rounded-full outline-none transition-colors",
                                setting.enabled ? "bg-primary-500" : "bg-neutral-600"
                            )}
                        >
                            <Switch.Thumb
                                className={cn(
                                    "block h-[20px] w-[20px] rounded-full bg-white transition-transform shadow-sm",
                                    setting.enabled ? "translate-x-[22px]" : "translate-x-[2px]"
                                )}
                            />
                        </Switch.Root>
                    </div>
                ))}
                
                <div className="pt-4 flex justify-end">
                    <p className="text-xs text-foreground-muted italic">Cài đặt tự động lưu.</p>
                </div>
            </div>
        </div>
    )
}
