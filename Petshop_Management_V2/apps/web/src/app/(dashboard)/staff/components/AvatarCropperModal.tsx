'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import { getCroppedImg } from '@/lib/utils/cropImage'
import { ZoomIn } from 'lucide-react'

interface AvatarCropperModalProps {
  isOpen: boolean
  onClose: () => void
  imageSrc: string
  onCropCompleteAction: (croppedImageBase64: string) => void
}

export const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  onCropCompleteAction,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [circleScale, setCircleScale] = useState(1)
  const [circlePos, setCirclePos] = useState({ x: 0, y: 0 })
  const [isDraggingCircle, setIsDraggingCircle] = useState(false)
  const dragStartRef = useRef({ elementX: 0, elementY: 0, mouseX: 0, mouseY: 0 })
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Handlers for draggable circle overlay
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    setIsDraggingCircle(true)
    dragStartRef.current = {
      elementX: circlePos.x,
      elementY: circlePos.y,
      mouseX: e.clientX,
      mouseY: e.clientY
    }
  }

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingCircle) return
      const dx = e.clientX - dragStartRef.current.mouseX
      const dy = e.clientY - dragStartRef.current.mouseY
      setCirclePos({
        x: dragStartRef.current.elementX + dx,
        y: dragStartRef.current.elementY + dy
      })
    }

    const handlePointerUp = () => setIsDraggingCircle(false)

    if (isDraggingCircle) {
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDraggingCircle])

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleConfirm = async () => {
    try {
      setIsProcessing(true)
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, 0)
      onCropCompleteAction(croppedImage as string)
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center app-modal-overlay">
      <div className="w-full max-w-sm rounded-[24px] bg-[#11131A] shadow-2xl overflow-hidden flex flex-col border border-white/5">
        
        {/* Header */}
        <div className="p-5 pb-4">
          <h2 className="text-xl font-bold text-white mb-1">Căn chỉnh ảnh đại diện</h2>
          <p className="text-sm text-gray-400">
            Kéo vòng tròn để chọn vị trí · Kéo nhung nhảo ảnh để pan
          </p>
        </div>

        {/* Cropper Container */}
        <div className="relative w-full h-[400px] bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={2 / 3}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            classes={{ containerClassName: 'react-easy-crop-container' }}
          />
          {/* Overlay Vòng tròn */}
          <div className="absolute inset-0 pointer-events-none flex justify-center items-center overflow-hidden z-10">
            <div 
              onPointerDown={handlePointerDown}
              style={{ 
                width: `${100 * circleScale}%`, 
                paddingBottom: `${100 * circleScale}%`,
                transform: `translate(${circlePos.x}px, ${circlePos.y}px)`,
                cursor: isDraggingCircle ? 'grabbing' : 'grab'
              }} 
              className="rounded-full border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-auto"
            />
          </div>
        </div>

        {/* Adjustments */}
        <div className="p-6 space-y-4">
          {/* Zoom Image */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 w-14 shrink-0">🔍 ảnh</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-1.5 bg-[#2A2D3C] rounded-lg appearance-none cursor-pointer accent-[#00D4FF]"
            />
          </div>

          {/* Scale Circle */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 w-14 shrink-0">⭕ vòng</span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={circleScale}
              onChange={(e) => setCircleScale(Number(e.target.value))}
              className="w-full h-1.5 bg-[#2A2D3C] rounded-lg appearance-none cursor-pointer accent-[#00E5B5]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-[#2A2D3C] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3A3D4C]"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-1 rounded-xl bg-gradient-to-r from-[#00E5B5] to-[#00D4FF] py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70"
          >
            {isProcessing ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .react-easy-crop-container .reactEasyCrop_CropArea {
          border: 2px solid #00D4FF !important;
          border-radius: 8px !important;
          box-shadow: 0 0 0 9999em rgba(0,0,0,0.5) !important;
        }
      `}} />
    </div>
  )
}
