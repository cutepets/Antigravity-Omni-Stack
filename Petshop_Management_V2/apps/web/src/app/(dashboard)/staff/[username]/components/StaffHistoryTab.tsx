'use client'

import React, { useEffect, useState } from 'react'
import {
  Loader2,
  AlertCircle,
  History,
  Clock,
  FileText,
  DollarSign,
  Settings,
  UserPlus,
  LogOut,
} from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'

dayjs.extend(relativeTime)
dayjs.locale('vi')

interface StaffHistoryTabProps {
  userId: string
}

interface ActivityLog {
  id: string
  userId: string
  action: string
  entityType: string
  entityId?: string
  description: string
  metadata?: Record<string, any>
  createdAt: string
  ipAddress?: string
  userAgent?: string
}

// Activity type icons
const ACTIVITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  CREATE: UserPlus,
  UPDATE: Settings,
  DELETE: LogOut,
  LOGIN: LogOut,
  LOGOUT: LogOut,
  DOCUMENT_UPLOAD: FileText,
  DOCUMENT_DELETE: FileText,
  SALARY_UPDATE: DollarSign,
  STATUS_CHANGE: Settings,
  DEFAULT: Clock,
}

// Activity type colors
const ACTIVITY_COLORS: Record<string, string> = {
  CREATE: 'text-primary-500 bg-primary-500/10',
  UPDATE: 'text-blue-500 bg-blue-500/10',
  DELETE: 'text-red-500 bg-red-500/10',
  LOGIN: 'text-green-500 bg-green-500/10',
  LOGOUT: 'text-gray-500 bg-gray-500/10',
  DOCUMENT_UPLOAD: 'text-purple-500 bg-purple-500/10',
  DOCUMENT_DELETE: 'text-red-500 bg-red-500/10',
  SALARY_UPDATE: 'text-amber-500 bg-amber-500/10',
  STATUS_CHANGE: 'text-cyan-500 bg-cyan-500/10',
  DEFAULT: 'text-foreground-muted bg-foreground-muted/10',
}

export function StaffHistoryTab({ userId }: StaffHistoryTabProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('ALL')

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true)
        // TODO: Implement API endpoint for activity logs
        // const data = await staffApi.getActivityLogs(userId)
        // setLogs(data)
        
        // Placeholder data for demo
        const placeholderLogs: ActivityLog[] = [
          {
            id: '1',
            userId,
            action: 'UPDATE',
            entityType: 'staff',
            description: 'Cập nhật thông tin cá nhân',
            metadata: { fields: ['phone', 'email'] },
            createdAt: new Date().toISOString(),
          },
          {
            id: '2',
            userId,
            action: 'DOCUMENT_UPLOAD',
            entityType: 'document',
            description: 'Tải lên CCCD mặt trước',
            createdAt: dayjs().subtract(2, 'hours').toISOString(),
          },
          {
            id: '3',
            userId,
            action: 'LOGIN',
            entityType: 'auth',
            description: 'Đăng nhập hệ thống',
            ipAddress: '192.168.1.100',
            createdAt: dayjs().subtract(1, 'day').toISOString(),
          },
          {
            id: '4',
            userId,
            action: 'STATUS_CHANGE',
            entityType: 'staff',
            description: 'Chuyển trạng thái từ PROBATION sang WORKING',
            createdAt: dayjs().subtract(3, 'days').toISOString(),
          },
          {
            id: '5',
            userId,
            action: 'SALARY_UPDATE',
            entityType: 'salary',
            description: 'Cập nhật lương cơ bản',
            metadata: { oldSalary: 7000000, newSalary: 8000000 },
            createdAt: dayjs().subtract(7, 'days').toISOString(),
          },
          {
            id: '6',
            userId,
            action: 'CREATE',
            entityType: 'staff',
            description: 'Tạo tài khoản nhân viên mới',
            createdAt: dayjs().subtract(30, 'days').toISOString(),
          },
        ]

        setLogs(placeholderLogs)
        setError(null)
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Không thể tải lịch sử hoạt động')
      } finally {
        setLoading(false)
      }
    }

    void loadLogs()
  }, [userId])

  const getIcon = (action: string) => {
    const IconComponent = ACTIVITY_ICONS[action] || ACTIVITY_ICONS.DEFAULT
    return <IconComponent size={16} />
  }

  const getColorClass = (action: string) => {
    return ACTIVITY_COLORS[action] || ACTIVITY_COLORS.DEFAULT
  }

  const filteredLogs = filter === 'ALL' ? logs : logs.filter((log) => log.action === filter)

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)))

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-foreground-muted">
          <Loader2 size={20} className="animate-spin text-primary-500" />
          Đang tải lịch sử hoạt động...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-foreground-muted">
        <AlertCircle size={32} className="text-error" />
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-outline rounded-lg px-4 py-2 text-sm"
        >
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      {uniqueActions.length > 1 && (
        <div className="card">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('ALL')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === 'ALL'
                  ? 'bg-primary-500 text-white'
                  : 'bg-background-tertiary/50 text-foreground-muted hover:text-foreground'
              }`}
            >
              Tất cả
            </button>
            {uniqueActions.map((action) => (
              <button
                key={action}
                onClick={() => setFilter(action)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === action
                    ? 'bg-primary-500 text-white'
                    : 'bg-background-tertiary/50 text-foreground-muted hover:text-foreground'
                }`}
              >
                {action.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="card">
        <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
          <History size={16} className="text-primary-500" />
          Lịch sử hoạt động ({filteredLogs.length})
        </h3>

        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-muted">
            <History size={48} className="mb-3 text-foreground-muted/50" />
            <p>Không có hoạt động nào</p>
          </div>
        ) : (
          <div className="relative space-y-4">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            {filteredLogs.map((log) => {
              const colorClass = getColorClass(log.action)
              return (
                <div key={log.id} className="relative flex gap-4 pl-1">
                  {/* Timeline dot */}
                  <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${colorClass}`}>
                    {getIcon(log.action)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 rounded-xl border border-border bg-background-tertiary/30 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{log.description}</p>
                        {log.metadata && (
                          <div className="mt-1 text-xs text-foreground-muted">
                            {Object.entries(log.metadata).map(([key, value]) => (
                              <span key={key} className="mr-2">
                                <strong>{key}:</strong> {String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                        {log.ipAddress && (
                          <p className="mt-1 text-xs text-foreground-muted">
                            IP: {log.ipAddress}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-foreground-muted">
                        <Clock size={12} />
                        {dayjs(log.createdAt).fromNow()}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
