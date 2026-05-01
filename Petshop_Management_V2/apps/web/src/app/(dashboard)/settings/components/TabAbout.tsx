'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Code2,
  Info,
  Package,
  Sparkles,
} from 'lucide-react'
import { settingsApi } from '@/lib/api/settings.api'

const TECH_STACK = [
  'Next.js 15 (App Router)',
  'NestJS (API)',
  'PostgreSQL + Prisma',
  'Redis + BullMQ',
  'TanStack Query',
  'Zustand',
]

const MODULES = [
  { name: 'Khách hàng & CRM', color: 'text-sky-500' },
  { name: 'Hồ sơ thú cưng', color: 'text-lime-500' },
  { name: 'POS bán hàng', color: 'text-emerald-500' },
  { name: 'Đơn hàng & đổi trả', color: 'text-orange-500' },
  { name: 'Kho & nhà cung cấp', color: 'text-blue-500' },
  { name: 'Spa / Grooming', color: 'text-pink-500' },
  { name: 'Pet Hotel', color: 'text-amber-500' },
  { name: 'Nhân sự & Chấm công', color: 'text-violet-500' },
  { name: 'Báo cáo & Tài chính', color: 'text-cyan-500' },
  { name: 'Cài đặt & tích hợp', color: 'text-slate-500' },
]

type ChangeLogEntry = {
  version: string
  date: string
  changes: string[]
}

const CHANGELOG: ChangeLogEntry[] = [
  {
    version: 'current',
    date: '2026-05-01',
    changes: [
      'Map lại kiến trúc hệ thống, tài liệu vận hành và luồng deploy Docker production',
      'Cập nhật hồ sơ khách hàng với ngày sinh, lịch sử điểm và dữ liệu chăm sóc chi tiết hơn',
      'Hoàn thiện nhập xuất CRM, kiểm tra dữ liệu Excel và bộ test liên quan',
      'Chuẩn hóa phân loại khách hàng, nhà cung cấp, staff và dữ liệu Excel trước bản deploy mới',
      'Đóng gói lại Docker production cho bản phát hành mới nhất',
    ],
  },
  {
    version: '0.99',
    date: '2026-04-26',
    changes: [
      'Sửa tự phục hồi khi trình duyệt còn giữ chunk cũ sau deploy VPS',
      'Chuẩn hóa domain Google Login từ URL app sang domain email',
      'Cập nhật nội dung Giới thiệu và thông tin vận hành production',
    ],
  },
  {
    version: '0.98',
    date: '2026-04-23',
    changes: [
      'Kanban Grooming với bộ lọc ngày thông minh',
      'In phiếu Grooming A4/K80',
      'Đồng bộ đơn hàng POS và Spa',
    ],
  },
  {
    version: '0.97',
    date: '2026-04-22',
    changes: [
      'Module Hotel với lịch sử chăm sóc và timeline',
      'Hệ thống Backup/Restore theo module',
      'Nhập xuất kho đa chi nhánh',
    ],
  }
]

export function TabAbout() {
  const { data: aboutData } = useQuery({
    queryKey: ['settings', 'about'],
    queryFn: () => settingsApi.getAbout(),
    staleTime: Infinity,
  })

  const displayVersion = aboutData?.version ?? 'runtime'
  const buildDate = aboutData?.buildDate ?? CHANGELOG[0]?.date ?? '—'
  const buildLabel = aboutData?.buildNumber ? `Build #${aboutData.buildNumber}` : null
  const gitLabel = aboutData?.gitSha ? `Git ${aboutData.gitSha}` : null
  const recentChangelog = CHANGELOG.slice(0, 3).map((entry, index) =>
    index === 0 ? { ...entry, version: displayVersion } : entry,
  )

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
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-primary-500/10 px-3 py-1.5 text-xs font-bold text-primary-500">
            <Sparkles size={16} />
            V{displayVersion}
          </div>
        </div>

        <div className="space-y-8 px-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoCard icon={<Package size={18} />} label="Phiên bản" value={`V${displayVersion}`} />
            <InfoCard icon={<Calendar size={18} />} label="Cập nhật" value={buildDate} />
            {buildLabel ? (
              <InfoCard icon={<Code2 size={18} />} label="Mã build" value={buildLabel} />
            ) : null}
            {gitLabel ? (
              <InfoCard icon={<Code2 size={18} />} label="Commit" value={gitLabel} />
            ) : null}
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
              {recentChangelog.map((entry, idx) => (
                <div
                  key={entry.version}
                  className="relative rounded-2xl border border-border/40 bg-black/5 p-5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold ${idx === 0
                          ? 'bg-primary-500/15 text-primary-500'
                          : 'bg-foreground-muted/10 text-foreground-muted'
                          }`}
                      >
                        V{entry.version}
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
