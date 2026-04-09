import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Pencil, Trash2, Check, Settings as SettingsIcon, Dog, Smile, Syringe } from 'lucide-react'
import { settingsApi } from '@/lib/api/settings.api'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface BreedEntry { id: string; species: 'Chó' | 'Mèo' | 'Khác' | string; name: string }
export interface VaccineOption { id: string; name: string }
export interface TemperEntry { name: string; color: string }

export const TEMPER_COLORS = [
  { id: 'gray', label: 'Xám', bg: 'bg-gray-500/10', text: 'text-gray-500', border: 'border-gray-500/20', value: '#64748b' },
  { id: 'emerald', label: 'Xanh lá', bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20', value: '#10b981' },
  { id: 'red', label: 'Đỏ', bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20', value: '#ef4444' },
  { id: 'amber', label: 'Cam', bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20', value: '#f59e0b' },
  { id: 'blue', label: 'Xanh', bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20', value: '#3b82f6' },
  { id: 'violet', label: 'Tím', bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/20', value: '#8b5cf6' },
  { id: 'pink', label: 'Hồng', bg: 'bg-pink-500/10', text: 'text-pink-500', border: 'border-pink-500/20', value: '#ec4899' },
]

export const getTemperStyle = (colorId: string) => {
  return TEMPER_COLORS.find(c => c.id === colorId) || TEMPER_COLORS[0]
}

const DEFAULT_BREEDS: BreedEntry[] = [
  { id: 'b1', species: 'Chó', name: 'Poodle' },
  { id: 'b2', species: 'Chó', name: 'Husky' },
  { id: 'b3', species: 'Chó', name: 'Phốc sóc' },
  { id: 'b4', species: 'Chó', name: 'Corgi' },
  { id: 'b5', species: 'Chó', name: 'Shih Tzu' },
  { id: 'b6', species: 'Chó', name: 'Chihuahua' },
  { id: 'b7', species: 'Chó', name: 'Labrador' },
  { id: 'b8', species: 'Chó', name: 'Nội địa' },
  { id: 'b9', species: 'Mèo', name: 'Anh lông ngắn' },
  { id: 'b10', species: 'Mèo', name: 'Munchkin' },
  { id: 'b11', species: 'Mèo', name: 'Ragdoll' },
  { id: 'b12', species: 'Mèo', name: 'Maine Coon' },
  { id: 'b13', species: 'Mèo', name: 'Nội địa' },
]
export const DEFAULT_TEMPERS: TemperEntry[] = [
  { name: 'Thân thiện', color: 'emerald' },
  { name: 'Hung dữ', color: 'red' },
  { name: 'Nhút nhát', color: 'amber' },
  { name: 'Năng động', color: 'blue' },
  { name: 'Điềm tĩnh', color: 'violet' },
  { name: 'Hiếu động', color: 'pink' }
]
const DEFAULT_VACCINES: VaccineOption[] = [
  { id: 'v1', name: 'Dại' },
  { id: 'v2', name: '4in1 (DHPPi)' },
  { id: 'v3', name: '5in1 (DHPPiL)' },
  { id: 'v4', name: 'Lepto' },
  { id: 'v5', name: 'FeLV' },
  { id: 'v6', name: 'FVRCP' },
]

// ─── Config Keys (DB) ────────────────────────────────────────────────────────
const KEY_BREEDS   = 'pet-breeds-v2'
const KEY_TEMPERS  = 'pet-temperaments'
const KEY_VACCINES = 'pet-vaccine-opts'

// ─── Save → chỉ lưu DB ────────────────────────────────────────────────────────
export function saveBreeds(b: BreedEntry[]) {
  settingsApi.updateConfigs({ [KEY_BREEDS]: JSON.stringify(b) }).catch(() => {})
}
export function saveTempers(t: TemperEntry[]) {
  settingsApi.updateConfigs({ [KEY_TEMPERS]: JSON.stringify(t) }).catch(() => {})
}
export function saveVaccineOptions(v: VaccineOption[]) {
  settingsApi.updateConfigs({ [KEY_VACCINES]: JSON.stringify(v) }).catch(() => {})
}

// ─── Load từ DB (async, dùng trong useEffect) ─────────────────────────────────
export async function loadBreedsFromDB(): Promise<BreedEntry[]> {
  try {
    const configs = await settingsApi.getConfigs()
    if (configs[KEY_BREEDS]) return JSON.parse(configs[KEY_BREEDS])
  } catch {
    // Fall back to defaults
  }
  return DEFAULT_BREEDS
}
export async function loadTempsFromDB(): Promise<TemperEntry[]> {
  try {
    const configs = await settingsApi.getConfigs()
    if (configs[KEY_TEMPERS]) {
       const parsed = JSON.parse(configs[KEY_TEMPERS])
       return parsed.map((t: any) => typeof t === 'string' ? { name: t, color: 'gray' } : t)
    }
  } catch {
    // Fall back to defaults
  }
  return DEFAULT_TEMPERS
}
export async function loadVaccinesFromDB(): Promise<VaccineOption[]> {
  try {
    const configs = await settingsApi.getConfigs()
    if (configs[KEY_VACCINES]) return JSON.parse(configs[KEY_VACCINES])
  } catch {
    // Fall back to defaults
  }
  return DEFAULT_VACCINES
}

// ─── Shared Component ────────────────────────────────────────────────────────
function CardHeader({ title, subtitle, count, icon: Icon }: any) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground-base">{title}</h2>
          <p className="mt-1 text-sm text-foreground-muted">{subtitle}</p>
        </div>
      </div>
      <div className="inline-flex min-w-8 items-center justify-center rounded-full bg-primary-500/10 px-2.5 py-1 text-xs font-bold text-primary-500">
        {count}
      </div>
    </div>
  )
}

interface Props { open: boolean; onClose: () => void }

const SPECIES_LIST = ['Chó', 'Mèo', 'Khác']

export function PetSettingsModal({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false)

  // Breeds
  const [breeds, setBreeds] = useState<BreedEntry[]>(DEFAULT_BREEDS)
  const [breedSpecies, setBreedSpecies] = useState('Chó')
  const [newBreed, setNewBreed] = useState('')
  const [editBreedId, setEditBreedId] = useState<string | null>(null)
  const [editBreedVal, setEditBreedVal] = useState('')

  // Temperaments
  const [tempers, setTempers] = useState<TemperEntry[]>(DEFAULT_TEMPERS)
  const [newTemper, setNewTemper] = useState('')
  const [newTemperColor, setNewTemperColor] = useState('gray')
  const [editTemperIdx, setEditTemperIdx] = useState<number | null>(null)
  const [editTemperVal, setEditTemperVal] = useState('')
  const [editTemperColor, setEditTemperColor] = useState('gray')

  // Vaccines
  const [vaccines, setVaccines] = useState<VaccineOption[]>(DEFAULT_VACCINES)
  const [newVaccine, setNewVaccine] = useState('')
  const [editVaccineId, setEditVaccineId] = useState<string | null>(null)
  const [editVaccineVal, setEditVaccineVal] = useState('')

  useEffect(() => setMounted(true), [])

  // Load từ DB khi mở modal
  useEffect(() => {
    if (!open) return
    settingsApi.getConfigs().then(configs => {
      if (configs[KEY_BREEDS])   setBreeds(JSON.parse(configs[KEY_BREEDS]))
      if (configs[KEY_TEMPERS])  setTempers(JSON.parse(configs[KEY_TEMPERS]))
      if (configs[KEY_VACCINES]) setVaccines(JSON.parse(configs[KEY_VACCINES]))
    }).catch(() => {})
  }, [open])

  // ── Breed actions ───────────────────────────────────────────────────────────
  function addBreed() {
    if (!newBreed.trim()) return
    const b = { id: Date.now().toString(), species: breedSpecies, name: newBreed.trim() }
    const next = [...breeds, b]; setBreeds(next); saveBreeds(next); setNewBreed('')
  }
  function deleteBreed(id: string) { const next = breeds.filter(b => b.id !== id); setBreeds(next); saveBreeds(next) }
  function saveEditBreed(id: string) {
    if (!editBreedVal.trim()) return
    const next = breeds.map(b => b.id === id ? { ...b, name: editBreedVal.trim() } : b)
    setBreeds(next); saveBreeds(next); setEditBreedId(null)
  }

  // ── Temper actions ──────────────────────────────────────────────────────────
  function addTemper() {
    if (!newTemper.trim() || tempers.some(t => t.name === newTemper.trim())) return
    const next = [...tempers, { name: newTemper.trim(), color: newTemperColor }]; setTempers(next); saveTempers(next); setNewTemper('')
  }
  function deleteTemper(idx: number) { const next = tempers.filter((_, i) => i !== idx); setTempers(next); saveTempers(next) }
  function saveEditTemper(idx: number) {
    if (!editTemperVal.trim()) return
    const next = [...tempers]; next[idx] = { name: editTemperVal.trim(), color: editTemperColor }; setTempers(next); saveTempers(next); setEditTemperIdx(null)
  }

  // ── Vaccine actions ─────────────────────────────────────────────────────────
  function addVaccine() {
    if (!newVaccine.trim()) return
    const v = { id: Date.now().toString(), name: newVaccine.trim() }
    const next = [...vaccines, v]; setVaccines(next); saveVaccineOptions(next); setNewVaccine('')
  }
  function deleteVaccine(id: string) { const next = vaccines.filter(v => v.id !== id); setVaccines(next); saveVaccineOptions(next) }
  function saveEditVaccine(id: string) {
    if (!editVaccineVal.trim()) return
    const next = vaccines.map(v => v.id === id ? { ...v, name: editVaccineVal.trim() } : v)
    setVaccines(next); saveVaccineOptions(next); setEditVaccineId(null)
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[900px] max-w-[100vw] glass-panel border-l border-white/10 z-50 overflow-y-auto flex flex-col"
            style={{ boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.4)' }}
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-background/70 backdrop-blur-xl z-10">
              <div className="flex items-center gap-3 text-primary-400">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-500/20 bg-primary-500/10 text-primary-500">
                  <SettingsIcon size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-lg text-foreground-base">Cài đặt dữ liệu thú cưng</h2>
                  <p className="text-sm text-foreground-muted">Quản lý giống, tính cách và mũi tiêm</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 text-foreground-muted transition-colors"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 space-y-8 pb-12">
              <div className="grid gap-5 xl:grid-cols-2">
                
                {/* Breeds Card */}
                <div data-hotkey-scope className="flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-background-secondary shadow-sm">
                  <CardHeader title="Giống thú cưng" subtitle="Phân loại theo loài" count={breeds.length} icon={Dog} />
                  <div className="flex-1 space-y-3 p-5 overflow-y-auto">
                    <div className="rounded-2xl border border-primary-500/30 bg-primary-500/5 p-2">
                      <div className="flex items-center gap-2">
                        <select 
                          value={breedSpecies} 
                          onChange={e => setBreedSpecies(e.target.value)}
                          className="h-11 w-28 rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary-500"
                        >
                          {SPECIES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input
                          value={newBreed}
                          onChange={e => setNewBreed(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addBreed()}
                          placeholder="Thêm giống mới..."
                          className="h-11 flex-1 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
                        />
                        <button
                          type="button"
                          onClick={addBreed}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-5 pt-2">
                      {SPECIES_LIST.map(sp => {
                        const list = breeds.filter(b => b.species === sp)
                        if (list.length === 0) return null
                        return (
                          <div key={sp} className="space-y-2">
                            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground-muted">{sp}</h4>
                            <div className="flex flex-wrap gap-2">
                              {list.map(b => (
                                <div key={b.id} className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1.5 text-sm">
                                  {editBreedId === b.id ? (
                                    <div className="flex items-center gap-1">
                                      <input value={editBreedVal} onChange={e => setEditBreedVal(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveEditBreed(b.id); if (e.key === 'Escape') setEditBreedId(null) }}
                                        className="h-7 w-32 rounded bg-background-secondary px-2 text-sm outline-none focus:ring-1 focus:ring-primary-500" autoFocus />
                                      <button onClick={() => saveEditBreed(b.id)} className="text-primary-500 hover:text-primary-400"><Check size={14} /></button>
                                      <button onClick={() => setEditBreedId(null)} className="text-foreground-muted hover:text-foreground"><X size={14} /></button>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="truncate font-medium text-foreground">{b.name}</span>
                                      <div className="-mr-1.5 ml-1 flex items-center gap-0.5">
                                        <button onClick={() => { setEditBreedId(b.id); setEditBreedVal(b.name) }}
                                          className="flex h-5 w-5 items-center justify-center rounded-full text-foreground-muted hover:bg-background-secondary hover:text-foreground">
                                          <Pencil size={11} />
                                        </button>
                                        <button onClick={() => deleteBreed(b.id)}
                                          className="flex h-5 w-5 items-center justify-center rounded-full text-foreground-muted hover:bg-red-500/10 hover:text-red-400">
                                          <Trash2 size={11} />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-5 flex flex-col">
                  {/* Temperaments */}
                  <div data-hotkey-scope className="overflow-hidden rounded-3xl border border-border/70 bg-background-secondary shadow-sm">
                    <CardHeader title="Tính cách" subtitle="Các đặc điểm tính cách" count={tempers.length} icon={Smile} />
                    <div className="space-y-3 p-5">
                      <div className="rounded-2xl border border-primary-500/30 bg-primary-500/5 p-2 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            value={newTemper}
                            onChange={e => setNewTemper(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addTemper()}
                            placeholder="Thêm tính cách..."
                            className="h-11 flex-1 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
                          />
                          <button
                            type="button"
                            onClick={addTemper}
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1 px-1">
                          {TEMPER_COLORS.map(c => (
                            <button key={c.id} onClick={() => setNewTemperColor(c.id)} title={c.label} className={`w-6 h-6 rounded-full border-2 transition-transform ${newTemperColor === c.id ? 'border-primary-500 scale-110' : 'border-transparent hover:scale-110'} ${c.bg} flex items-center justify-center`}>
                              {newTemperColor === c.id && <div className={`w-3 h-3 rounded-full ${c.bg.replace('/10', '')}`} style={{backgroundColor: c.value}} />}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 pt-2">
                        {tempers.map((t, i) => {
                           const cInfo = getTemperStyle(t.color)
                           return (
                             <div key={t.name} className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${cInfo.bg} ${cInfo.border} ${cInfo.text}`}>
                                {editTemperIdx === i ? (
                                  <div className="flex items-center gap-1">
                                    <input value={editTemperVal} onChange={e => setEditTemperVal(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') saveEditTemper(i); if (e.key === 'Escape') setEditTemperIdx(null) }}
                                      className="h-7 w-24 rounded bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary-500" autoFocus />
                                    <select value={editTemperColor} onChange={e => setEditTemperColor(e.target.value)} className="h-7 rounded bg-background px-1 text-sm outline-none">
                                      {TEMPER_COLORS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                    <button onClick={() => saveEditTemper(i)} className="text-primary-500 hover:text-primary-400 ml-1"><Check size={14} /></button>
                                    <button onClick={() => setEditTemperIdx(null)} className="text-foreground-muted hover:text-foreground"><X size={14} /></button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="truncate font-medium">{t.name}</span>
                                    <div className="-mr-1.5 ml-1 flex items-center gap-0.5">
                                      <button onClick={() => { setEditTemperIdx(i); setEditTemperVal(t.name); setEditTemperColor(t.color) }}
                                        className="flex h-5 w-5 items-center justify-center rounded-full opacity-70 hover:opacity-100 hover:bg-black/10">
                                        <Pencil size={11} />
                                      </button>
                                      <button onClick={() => deleteTemper(i)}
                                        className="flex h-5 w-5 items-center justify-center rounded-full opacity-70 hover:opacity-100 hover:bg-red-500/20 text-red-500">
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </>
                                )}
                             </div>
                           )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Vaccines */}
                  <div data-hotkey-scope className="overflow-hidden rounded-3xl border border-border/70 bg-background-secondary shadow-sm">
                    <CardHeader title="Mũi tiêm" subtitle="Các loại vaccine / phòng bệnh" count={vaccines.length} icon={Syringe} />
                    <div className="space-y-3 p-5">
                      <div className="rounded-2xl border border-primary-500/30 bg-primary-500/5 p-2">
                        <div className="flex items-center gap-2">
                          <input
                            value={newVaccine}
                            onChange={e => setNewVaccine(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addVaccine()}
                            placeholder="Thêm mũi tiêm..."
                            className="h-11 flex-1 rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary-500"
                          />
                          <button
                            type="button"
                            onClick={addVaccine}
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 pt-2">
                        {vaccines.map(v => (
                           <div key={v.id} className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1.5 text-sm">
                              {editVaccineId === v.id ? (
                                <div className="flex items-center gap-1">
                                  <input value={editVaccineVal} onChange={e => setEditVaccineVal(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveEditVaccine(v.id); if (e.key === 'Escape') setEditVaccineId(null) }}
                                    className="h-7 w-32 rounded bg-background-secondary px-2 text-sm outline-none focus:ring-1 focus:ring-primary-500" autoFocus />
                                  <button onClick={() => saveEditVaccine(v.id)} className="text-primary-500 hover:text-primary-400"><Check size={14} /></button>
                                  <button onClick={() => setEditVaccineId(null)} className="text-foreground-muted hover:text-foreground"><X size={14} /></button>
                                </div>
                              ) : (
                                <>
                                  <span className="truncate font-medium text-foreground">{v.name}</span>
                                  <div className="-mr-1.5 ml-1 flex items-center gap-0.5">
                                    <button onClick={() => { setEditVaccineId(v.id); setEditVaccineVal(v.name) }}
                                      className="flex h-5 w-5 items-center justify-center rounded-full text-foreground-muted hover:bg-background-secondary hover:text-foreground">
                                      <Pencil size={11} />
                                    </button>
                                    <button onClick={() => deleteVaccine(v.id)}
                                      className="flex h-5 w-5 items-center justify-center rounded-full text-foreground-muted hover:bg-red-500/10 hover:text-red-400">
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </>
                              )}
                           </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

