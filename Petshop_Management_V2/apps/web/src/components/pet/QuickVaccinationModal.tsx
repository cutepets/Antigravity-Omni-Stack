'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Syringe, CalendarDays, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { format, addYears } from 'date-fns'
import { toast } from 'sonner'
import { petApi } from '@/lib/api/pet.api'
import { loadVaccinesFromDB, VaccineOption } from '@/app/(dashboard)/pets/_components/pet-settings-modal'
import { UploadCloud, Image as ImageIcon } from 'lucide-react'

interface QuickVaccinationModalProps {
  isOpen: boolean
  petId: string
  onClose: () => void
  onSaved?: () => void
}

export function QuickVaccinationModal({ isOpen, petId, onClose, onSaved }: QuickVaccinationModalProps) {
  const queryClient = useQueryClient()
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [vaccineOptions, setVaccineOptions] = useState<VaccineOption[]>([])
  const [vaccineName, setVaccineName] = useState('')
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [nextDueDate, setNextDueDate] = useState(() => format(addYears(new Date(), 1), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  useEffect(() => {
    setMounted(true)
    if (isOpen) {
      loadVaccinesFromDB().then((opts) => setVaccineOptions(opts))
    }
  }, [isOpen])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setDate(format(new Date(), 'yyyy-MM-dd'))
      setNextDueDate(format(addYears(new Date(), 1), 'yyyy-MM-dd'))
      setNotes('')
      setVaccineName('')
      setPhotoFile(null)
    }
  }, [isOpen])

  // Handle Ctrl+V paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen) return
      if (e.clipboardData?.files?.length) {
        setPhotoFile(e.clipboardData.files[0])
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isOpen])

  const handleDateChange = (newDate: string) => {
    setDate(newDate)
    if (newDate) {
      setNextDueDate(format(addYears(new Date(newDate), 1), 'yyyy-MM-dd'))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!vaccineName) {
      toast.error('Vui lòng chọn loại vaccine')
      return
    }

    if (!date) {
      toast.error('Vui lòng chọn ngày tiêm')
      return
    }

    setIsLoading(true)
    try {
      let photoUrl = ''
      if (photoFile) {
        const uploadRes = await petApi.uploadVaccinePhoto(petId, photoFile)
        if (uploadRes?.photoUrl) photoUrl = uploadRes.photoUrl
      }

      await petApi.addVaccination(petId, {
        vaccineName,
        date: new Date(date).toISOString(),
        ...(nextDueDate ? { nextDueDate: new Date(nextDueDate).toISOString() } : {}),
        ...(notes ? { notes } : {}),
        ...(photoUrl ? { photoUrl } : {})
      })

      toast.success('Thêm mũi tiêm thành công')

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['pet', petId] })

      onSaved?.()
      onClose()
    } catch (error) {
      console.error('Failed to add vaccination:', error)
      toast.error('Có lỗi xảy ra khi thêm mũi tiêm')
    } finally {
      setIsLoading(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm"
          />

          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-background shadow-2xl glass-panel"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 bg-background-secondary/50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
                    <Syringe size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground-base">Thêm mũi tiêm mới</h2>
                    <p className="text-sm text-foreground-muted">Cập nhật lịch sử tiêm phòng</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-foreground-muted hover:bg-white/10 hover:text-foreground transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-4">

                  {/* Vaccine Name */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground-muted">Tên / Loại Vaccine</label>
                    <select
                      value={vaccineName}
                      onChange={(e) => setVaccineName(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background-secondary px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="" disabled>-- Chọn loại mũi tiêm --</option>
                      {vaccineOptions.map((opt) => (
                        <option key={opt.id} value={opt.name}>{opt.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Date */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground-muted">Ngày tiêm</label>
                      <div className="relative">
                        <input
                          type="date"
                          required
                          value={date}
                          onChange={(e) => handleDateChange(e.target.value)}
                          className="w-full rounded-xl border border-border bg-background-secondary px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                    </div>

                    {/* Next Due Date */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground-muted">Ngày hẹn (ước tính)</label>
                      <div className="relative">
                        <input
                          type="date"
                          value={nextDueDate}
                          onChange={(e) => setNextDueDate(e.target.value)}
                          className="w-full rounded-xl border border-border bg-background-secondary px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes / Clinic */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground-muted flex items-center justify-between">
                      <span>Nơi tiêm / Ghi chú</span>
                      <span className="text-xs font-normal text-foreground-muted opacity-60">Tuỳ chọn</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ghi chú thêm..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background-secondary px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground-muted flex items-center justify-between">
                      <span>Ảnh sổ tiêm (tuỳ chọn)</span>
                      <span className="text-xs text-foreground-muted/50">Dán (Ctrl+V) hoặc Kéo thả</span>
                    </label>
                    <div
                      className="relative flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 bg-background-secondary/50 py-6 transition-colors hover:border-primary-500/50 hover:bg-primary-500/5"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (e.dataTransfer.files?.length) setPhotoFile(e.dataTransfer.files[0])
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.length) setPhotoFile(e.target.files[0])
                        }}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                      {photoFile ? (
                        <div className="flex flex-col items-center">
                          <ImageIcon size={24} className="mb-2 text-primary-500" />
                          <p className="text-sm font-medium text-foreground">{photoFile.name}</p>
                          <p className="text-xs text-foreground-muted pt-1">Nhấn hoặc kéo ảnh khác để thay đổi</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <UploadCloud size={24} className="mx-auto mb-2 text-foreground-muted" />
                          <p className="text-sm font-medium">Kéo thả ảnh vào đây</p>
                          <p className="text-xs text-foreground-muted mt-1">hoặc nhấn để chọn file / ấn Ctrl+V để dán</p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Footer */}
                <div className="mt-8 flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl px-5 py-2.5 text-sm font-medium text-foreground hover:bg-background-secondary transition-colors"
                    disabled={isLoading}
                  >
                    Hủy bớt
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-colors disabled:opacity-70"
                  >
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Plus size={18} />
                        Lưu thông tin
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
