'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Code2,
  Info,
  Layers,
  Package,
  Sparkles,
} from 'lucide-react'
import { settingsApi } from '@/lib/api/settings.api'

const APP_DESCRIPTION = `Petshop Management V2 là hệ thống vận hành tập trung cho Cutepets Management.
Ứng dụng hợp nhất POS bán hàng, đơn Spa/Grooming, Pet Hotel, kho, sổ quỹ, báo cáo,
nhân sự và cấu hình Google integrations trong một màn hình quản trị thống nhất.`

const TECH_STACK = [
  'Next.js 15 (App Router)',
  'NestJS (API)',
  'PostgreSQL + Prisma',
  'Redis + BullMQ',
  'TanStack Query',
  'Zustand',
]

const MODULES = [
  { name: 'POS bán hàng', color: 'text-emerald-500' },
  { name: 'Quản lý kho', color: 'text-blue-500' },
  { name: 'Spa / Grooming', color: 'text-pink-500' },
  { name: 'Pet Hotel', color: 'text-amber-500' },
  { name: 'Nhân sự & Chấm công', color: 'text-violet-500' },
  { name: 'Báo cáo & Tài chính', color: 'text-cyan-500' },
]

type ChangeLogEntry = {
  version: string
  date: string
  changes: string[]
}

const CHANGELOG: ChangeLogEntry[] = [
  {
    version: '2.5.1',
    date: '2026-04-28',
    changes: [
      'Hoàn thiện Docker production build cho Prisma/pnpm 10',
      'Giảm Docker build context bằng cách loại artifacts build/cache',
      'Mount riêng uploads và private storage để giữ ảnh/tài liệu sau recreate container',
    ],
  },
  {
    version: '2.5.0',
    date: '2026-04-26',
    changes: [
      'Sửa tự phục hồi khi trình duyệt còn giữ chunk cũ sau deploy VPS',
      'Chuẩn hóa domain Google Login từ URL app sang domain email',
      'Cập nhật nội dung Giới thiệu và thông tin vận hành production',
    ],
  },
  {
    version: '2.4.0',
    date: '2026-04-23',
    changes: [
      'Kanban Grooming với bộ lọc ngày thông minh',
      'In phiếu Grooming A4/K80',
      'Đồng bộ đơn hàng POS và Spa',
    ],
  },
  {
    version: '2.3.0',
    date: '2026-04-22',
    changes: [
      'Module Hotel với lịch sử chăm sóc và timeline',
      'Hệ thống Backup/Restore theo module',
      'Nhập xuất kho đa chi nhánh',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-04-20',
    changes: [
      'POS responsive trên mobile',
      'Thanh toán QR VietQR tự động',
      'Webhook ngân hàng real-time',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-04-15',
    changes: [
      'Hệ thống phân quyền RBAC chi tiết',
      'Lịch sử thao tác (Audit Log)',
      'Quản lý mẫu in A4/K80 tùy chỉnh',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-04-01',
    changes: [
      'Khởi tạo dự án Petshop Management V2',
      'Kiến trúc monorepo Turborepo',
      'Cơ sở dữ liệu Prisma + PostgreSQL',
    ],
  },
]

export function TabAbout() {
  const { data: aboutData } = useQuery({
    queryKey: ['settings', 'about'],
    queryFn: () => settingsApi.getAbout(),
    staleTime: Infinity,
  })

  const version = aboutData?.version ?? '—'
  const env = aboutData?.nodeEnv ?? '—'
  const buildDate = aboutData?.buildDate ?? CHANGELOG[0]?.date ?? '—'

  return (
    <div className="relative z-0 h-full w-full">
      <div className="relative h-full w-full overflow-hidden rounded-3xl border border-border/60 bg-background-secondary p-8 shadow-sm">
        <div className="mb-8 flex items-center justify-between border-b border-border/50 pb-6">
          <div className="flex items-center gap-3">
            <div className="text-primary-500">
              <Info size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground-base">
                Giới thiệu hệ thống
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                Phiên bản, lịch sử cập nhật và tổng quan dự án
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-primary-500/10 px-4 py-2 text-sm font-bold text-primary-500">
            <Sparkles size={16} />
            v{version}
          </div>
        </div>

        <div className="space-y-8 px-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <InfoCard icon={<Package size={18} />} label="Phiên bản" value={`v${version}`} />
            <InfoCard
              icon={<Layers size={18} />}
              label="Môi trường"
              value={env === 'production' ? 'Sản xuất' : 'Phát triển'}
            />
            <InfoCard icon={<Calendar size={18} />} label="Cập nhật" value={buildDate} />
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground-base">
              <Info size={16} className="text-primary-500" />
              Tổng quan dự án
            </h3>
            <p className="whitespace-pre-line rounded-2xl border border-border/40 bg-black/5 p-5 text-sm leading-relaxed text-foreground-secondary">
              {APP_DESCRIPTION}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground-base">
                <Package size={16} className="text-primary-500" />
                Các module
              </h3>
              <div className="space-y-2">
                {MODULES.map((mod) => (
                  <div
                    key={mod.name}
                    className="flex items-center gap-3 rounded-xl border border-border/40 bg-black/5 px-4 py-2.5"
                  >
                    <CheckCircle2 size={14} className={mod.color} />
                    <span className="text-sm font-medium text-foreground-base">{mod.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground-base">
                <Code2 size={16} className="text-primary-500" />
                Công nghệ
              </h3>
              <div className="space-y-2">
                {TECH_STACK.map((tech) => (
                  <div
                    key={tech}
                    className="flex items-center gap-3 rounded-xl border border-border/40 bg-black/5 px-4 py-2.5"
                  >
                    <ArrowRight size={14} className="text-foreground-muted" />
                    <span className="text-sm font-medium text-foreground-base">{tech}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground-base">
              <Calendar size={16} className="text-primary-500" />
              Lịch sử cập nhật
            </h3>
            <div className="space-y-4">
              {CHANGELOG.map((entry, idx) => (
                <div
                  key={entry.version}
                  className="relative rounded-2xl border border-border/40 bg-black/5 p-5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                          idx === 0
                            ? 'bg-primary-500/15 text-primary-500'
                            : 'bg-foreground-muted/10 text-foreground-muted'
                        }`}
                      >
                        v{entry.version}
                      </span>
                      {idx === 0 ? (
                        <span className="text-xs font-medium text-primary-500">
                          Mới nhất
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-foreground-muted">{entry.date}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {entry.changes.map((change) => (
                      <li
                        key={change}
                        className="flex items-start gap-2 text-sm text-foreground-secondary"
                      >
                        <CheckCircle2
                          size={14}
                          className="mt-0.5 shrink-0 text-emerald-500"
                        />
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-black/5 p-4">
      <div className="rounded-lg bg-primary-500/10 p-2 text-primary-500">{icon}</div>
      <div>
        <div className="text-xs text-foreground-muted">{label}</div>
        <div className="text-sm font-bold text-foreground-base">{value}</div>
      </div>
    </div>
  )
}
