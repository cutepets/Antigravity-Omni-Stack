'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { usePosStore } from '@/stores/pos.store'

/**
 * Hook này:
 * 1. Khi mount: load posPreferences từ user DB vào pos.store (overwrite local)
 * 2. Khi settings thay đổi: debounce 1.5s rồi sync lên DB
 *
 * Đặt hook này trong PosLayoutClient hoặc PosPage để chạy 1 lần.
 */
export function usePosPreferencesSync() {
    const user = useAuthStore((s) => s.user)
    const updatePosPreferences = useAuthStore((s) => s.updatePosPreferences)
    const store = usePosStore()
    const hasLoaded = useRef(false)
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // 1. Load từ DB vào store (chỉ chạy 1 lần sau khi user load xong)
    useEffect(() => {
        if (!user || hasLoaded.current) return
        const prefs = user.posPreferences
        if (!prefs) {
            hasLoaded.current = true
            return
        }

        hasLoaded.current = true

        // Apply tất cả preferences từ DB xuống local store
        if (prefs.outOfStockHidden !== undefined) store.setOutOfStockHidden(prefs.outOfStockHidden)
        if (prefs.autoFocusSearch !== undefined) store.setAutoFocusSearch(prefs.autoFocusSearch)
        if (prefs.barcodeMode !== undefined) store.setBarcodeMode(prefs.barcodeMode)
        if (prefs.soundEnabled !== undefined) store.setSoundEnabled(prefs.soundEnabled)
        if (prefs.zoomLevel !== undefined) store.setZoomLevel(prefs.zoomLevel)
        if (prefs.defaultPayment !== undefined) store.setDefaultPayment(prefs.defaultPayment ?? '')
        if (prefs.roundingEnabled !== undefined) store.setRoundingEnabled(prefs.roundingEnabled)
        if (prefs.roundingUnit !== undefined) store.setRoundingUnit(prefs.roundingUnit as any)
        if (prefs.printerIp !== undefined) store.setPrinterIp(prefs.printerIp ?? '')
        if (prefs.paperSize !== undefined) store.setPaperSize(prefs.paperSize ?? 'K80')
        if (prefs.autoPrint !== undefined) store.setAutoPrint(prefs.autoPrint)
        if (prefs.autoPrintQR !== undefined) store.setAutoPrintQR(prefs.autoPrintQR)
        if (prefs.posTheme !== undefined) store.setPosTheme((prefs.posTheme as any) ?? 'light')
    }, [user, store])

    // 2. Sync lên DB sau khi settings thay đổi (debounce 1.5s)
    const {
        outOfStockHidden, autoFocusSearch, barcodeMode, soundEnabled,
        zoomLevel, defaultPayment, roundingEnabled, roundingUnit,
        printerIp, paperSize, autoPrint, autoPrintQR, posTheme,
    } = store

    useEffect(() => {
        if (!hasLoaded.current || !user) return

        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => {
            updatePosPreferences({
                outOfStockHidden, autoFocusSearch, barcodeMode, soundEnabled,
                zoomLevel, defaultPayment: defaultPayment || null, roundingEnabled, roundingUnit,
                printerIp: printerIp || null, paperSize: paperSize || null, autoPrint, autoPrintQR, posTheme,
            })
        }, 1500)

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current)
        }
    }, [
        outOfStockHidden, autoFocusSearch, barcodeMode, soundEnabled,
        zoomLevel, defaultPayment, roundingEnabled, roundingUnit,
        printerIp, paperSize, autoPrint, autoPrintQR, posTheme,
        updatePosPreferences, user,
    ])
}
