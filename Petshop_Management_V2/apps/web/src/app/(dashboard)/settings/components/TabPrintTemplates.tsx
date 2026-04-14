import React, { useEffect, useState } from 'react'
import { Printer, Save, CheckCircle2 } from 'lucide-react'
import { settingsApi, PrintTemplate } from '@/lib/api/settings.api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function TabPrintTemplates() {
  const queryClient = useQueryClient()
  const [activeTemplate, setActiveTemplate] = useState<PrintTemplate | null>(null)
  
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['settings.print-templates'],
    queryFn: () => settingsApi.getPrintTemplates()
  })

  useEffect(() => {
    if (!activeTemplate && templates.length > 0) {
      setActiveTemplate(templates[0])
    }
  }, [templates, activeTemplate])

  const mutation = useMutation({
    mutationFn: (data: { type: string, payload: { content: string, paperSize: string } }) => 
      settingsApi.updatePrintTemplate(data.type, data.payload),
    onSuccess: (updated) => {
      toast.success('Lưu mẫu in thành công')
      queryClient.setQueryData(['settings.print-templates'], (old: PrintTemplate[]) => 
        old.map(t => t.type === updated.type ? updated : t)
      )
      setActiveTemplate(updated)
    },
    onError: () => {
      toast.error('Có lỗi xảy ra khi lưu mẫu in')
    }
  })

  const [content, setContent] = useState('')
  const [paperSize, setPaperSize] = useState('')

  useEffect(() => {
    if (activeTemplate) {
      setContent(activeTemplate.content)
      setPaperSize(activeTemplate.paperSize)
    }
  }, [activeTemplate])

  const handleSave = () => {
    if (!activeTemplate) return
    mutation.mutate({
      type: activeTemplate.type,
      payload: { content, paperSize }
    })
  }

  if (isLoading) {
    return <div className="p-8 text-center text-foreground-muted">Đang tải...</div>
  }

  return (
    <div className="flex h-full min-h-[600px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-background-secondary shadow-sm lg:flex-row">
      {/* Sidebar List */}
      <div className="w-full shrink-0 border-b border-border/50 bg-background-elevated lg:w-[280px] lg:border-b-0 lg:border-r">
        <div className="p-4 flex items-center gap-2 border-b border-border/50">
          <Printer size={18} className="text-primary-500" />
          <h3 className="font-bold text-foreground-base">Mẫu in</h3>
        </div>
        <div className="p-2 space-y-1">
          {templates.map(template => (
            <button
              key={template.type}
              onClick={() => setActiveTemplate(template)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-xl text-sm transition-all',
                activeTemplate?.type === template.type
                  ? 'bg-primary-500/10 text-primary-500 font-semibold'
                  : 'hover:bg-black/5 text-foreground-secondary hover:text-foreground-base'
              )}
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-h-0 bg-background-base">
        {activeTemplate ? (
          <>
            <div className="flex items-center justify-between border-b border-border/50 p-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-foreground-base">{activeTemplate.name}</h2>
                <p className="text-xs text-foreground-muted opacity-0">Chỉnh sửa nội dung hóa đơn/phiếu in</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value)}
                  className="h-10 rounded-xl border border-border/50 bg-background-elevated px-3 text-sm font-medium outline-none"
                >
                  <option value="k80">Khổ K80 (80mm)</option>
                  <option value="a4">Khổ A4 (210mm)</option>
                  <option value="a5">Khổ A5 (148mm)</option>
                </select>
                
                <button
                  onClick={handleSave}
                  disabled={mutation.isPending}
                  className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {mutation.isPending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  ) : mutation.isSuccess ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                  Lưu
                </button>
              </div>
            </div>
            
            <div className="flex-1 flex overflow-hidden p-4 gap-4 relative">
              <div className="flex-1 flex flex-col gap-2 relative">
                <div className="text-sm font-semibold text-foreground-base flex items-center justify-between">
                  <span>Nội dung mẫu in (HTML)</span>
                  <span className="text-xs font-normal text-foreground-muted">Sử dụng HTML và tailwind css</span>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-full resize-none rounded-xl border border-border/50 bg-background-elevated p-4 font-mono text-[13px] leading-relaxed text-foreground-base outline-none focus:border-primary-500/50"
                  spellCheck={false}
                />
                <div className="text-xs text-foreground-muted bg-primary-500/5 p-3 rounded-lg border border-primary-500/10 shrink-0">
                  <strong>Biến có sẵn: </strong> 
                  <code className="text-primary-500 mx-1">{"{{shopName}}"}</code> 
                  <code className="text-primary-500 mx-1">{"{{shopAddress}}"}</code> 
                  <code className="text-primary-500 mx-1">{"{{shopPhone}}"}</code> 
                  <code className="text-primary-500 mx-1">{"{{totalAmount}}"}</code> 
                  <code className="text-primary-500 mx-1">{"{{items_html}}"}</code> 
                  v.v. Tùy thuộc vào phần in.
                </div>
              </div>
              
              <div className="flex-1 flex flex-col gap-2 relative">
                <div className="text-sm font-semibold text-foreground-base flex items-center justify-between">
                  <span>Xem trước (Preview)</span>
                </div>
                <div className="flex-1 rounded-xl border border-border/50 bg-white p-4 overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: content }} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-foreground-muted text-sm">
            Chọn một mẫu in để chỉnh sửa
          </div>
        )}
      </div>
    </div>
  )
}
