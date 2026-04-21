'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Camera, Keyboard, ScanLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PageContent, PageHeader } from '@/components/layout/PageLayout'
import { equipmentApi } from '@/lib/equipment'

export function EquipmentScanView() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const [code, setCode] = useState('')
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [cameraSupported, setCameraSupported] = useState(false)

  const scanMutation = useMutation({
    mutationFn: async (scanCode: string) => equipmentApi.resolveScan(scanCode.trim().toUpperCase()),
    onSuccess: (result) => {
      if (result.found && result.equipment) {
        toast.success(`Mở thiết bị ${result.equipment.code}`)
        router.push(`/equipment/${result.equipment.code}`)
        return
      }

      if (result.draft?.code) {
        toast.success(`Mã ${result.draft.code} chưa có, chuyển về form tạo mới`)
        router.push(`/equipment?draft=${result.draft.code}`)
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể xử lý mã thiết bị')
    },
  })

  useEffect(() => {
    setCameraSupported(typeof navigator !== 'undefined' && 'mediaDevices' in navigator && 'BarcodeDetector' in window)
  }, [])

  useEffect(() => {
    if (!cameraEnabled || !cameraSupported) return

    let cancelled = false

    const startCamera = async () => {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['qr_code'],
        })
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
          },
          audio: false,
        })
        if (cancelled) return

        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        const tick = async () => {
          if (!videoRef.current || scanMutation.isPending) {
            frameRef.current = window.requestAnimationFrame(tick)
            return
          }

          try {
            const codes = await detector.detect(videoRef.current)
            const value = codes?.[0]?.rawValue
            if (value) {
              setCode(value)
              stopCamera()
              scanMutation.mutate(value)
              return
            }
          } catch {
            // Ignore a single frame failure and continue scanning.
          }

          frameRef.current = window.requestAnimationFrame(tick)
        }

        frameRef.current = window.requestAnimationFrame(tick)
      } catch (error: any) {
        setCameraEnabled(false)
        toast.error(error?.message || 'Không thể mở camera')
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [cameraEnabled, cameraSupported, scanMutation])

  const stopCamera = () => {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  return (
    <>
      <PageHeader
        title="Quét thiết bị"
        description="Ưu tiên camera trên mobile. Nếu trình duyệt không hỗ trợ, nhập tay mã thiết bị."
        actions={
          <Link
            href="/equipment"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background-secondary px-4 py-2 text-sm"
          >
            <ArrowLeft size={16} />
            Về danh sách
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_420px]">
        <PageContent>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-foreground-base">Camera QR</p>
              <p className="mt-1 text-sm text-foreground-secondary">
                Mở camera sau của thiết bị để quét mã dạng <span className="font-semibold">TB0001</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (cameraEnabled) {
                  stopCamera()
                  setCameraEnabled(false)
                } else {
                  setCameraEnabled(true)
                }
              }}
              disabled={!cameraSupported}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Camera size={16} />
              {cameraEnabled ? 'Tắt camera' : 'Bật camera'}
            </button>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border/60 bg-black/60">
            <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
          </div>

          {!cameraSupported ? (
            <p className="mt-4 text-sm text-amber-300">
              Trình duyệt hiện tại chưa hỗ trợ BarcodeDetector. Vui lòng dùng nhập tay hoặc mở trên Chrome mobile mới.
            </p>
          ) : null}
        </PageContent>

        <PageContent>
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-primary-500/10 p-3 text-primary-400">
              <Keyboard size={20} />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground-base">Nhập tay / máy quét USB</p>
              <p className="text-sm text-foreground-secondary">Hỗ trợ scanner kiểu keyboard wedge.</p>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!code.trim()) {
                toast.error('Nhập mã thiết bị trước khi quét')
                return
              }
              scanMutation.mutate(code)
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground-base">Mã thiết bị</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="TB0001"
                autoFocus
                className="w-full rounded-2xl border border-border/60 bg-background-base px-4 py-4 text-lg font-semibold tracking-[0.2em] outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={scanMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-500 px-4 py-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <ScanLine size={18} />
              {scanMutation.isPending ? 'Đang xử lý...' : 'Resolve mã thiết bị'}
            </button>
          </form>

          <div className="mt-5 rounded-2xl border border-border/60 bg-background-base p-4 text-sm text-foreground-secondary">
            Nếu mã đã tồn tại, hệ thống mở chi tiết thiết bị. Nếu mã chưa có, hệ thống chuyển về form tạo mới với mã đã điền sẵn.
          </div>
        </PageContent>
      </div>
    </>
  )
}
