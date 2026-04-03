'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Pencil, Trash2, Check } from 'lucide-react'
import { settingsApi } from '@/lib/api/settings.api'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface BreedEntry { id: string; species: 'Chó' | 'Mèo' | 'Khác' | string; name: string }
export interface VaccineOption { id: string; name: string }

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
export const DEFAULT_TEMPERS = ['Thân thiện', 'Hung dữ', 'Nhút nhát', 'Năng động', 'Điềm tĩnh', 'Hiếu động']
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
export function saveTempers(t: string[]) {
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
  } catch {}
  return DEFAULT_BREEDS
}
export async function loadTempsFromDB(): Promise<string[]> {
  try {
    const configs = await settingsApi.getConfigs()
    if (configs[KEY_TEMPERS]) return JSON.parse(configs[KEY_TEMPERS])
  } catch {}
  return DEFAULT_TEMPERS
}
export async function loadVaccinesFromDB(): Promise<VaccineOption[]> {
  try {
    const configs = await settingsApi.getConfigs()
    if (configs[KEY_VACCINES]) return JSON.parse(configs[KEY_VACCINES])
  } catch {}
  return DEFAULT_VACCINES
}

interface Props { open: boolean; onClose: () => void }
type TabId = 'breeds' | 'tempers' | 'vaccines'

const SPECIES_LIST = ['Chó', 'Mèo', 'Khác']

export function PetSettingsModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('breeds')
  const [mounted, setMounted] = useState(false)

  // Breeds
  const [breeds, setBreeds] = useState<BreedEntry[]>(DEFAULT_BREEDS)
  const [breedSpecies, setBreedSpecies] = useState('Chó')
  const [newBreed, setNewBreed] = useState('')
  const [editBreedId, setEditBreedId] = useState<string | null>(null)
  const [editBreedVal, setEditBreedVal] = useState('')

  // Temperaments
  const [tempers, setTempers] = useState<string[]>(DEFAULT_TEMPERS)
  const [newTemper, setNewTemper] = useState('')
  const [editTemperIdx, setEditTemperIdx] = useState<number | null>(null)
  const [editTemperVal, setEditTemperVal] = useState('')

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
    if (!newTemper.trim() || tempers.includes(newTemper.trim())) return
    const next = [...tempers, newTemper.trim()]; setTempers(next); saveTempers(next); setNewTemper('')
  }
  function deleteTemper(idx: number) { const next = tempers.filter((_, i) => i !== idx); setTempers(next); saveTempers(next) }
  function saveEditTemper(idx: number) {
    if (!editTemperVal.trim()) return
    const next = [...tempers]; next[idx] = editTemperVal.trim(); setTempers(next); saveTempers(next); setEditTemperIdx(null)
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

  if (!open || !mounted) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div
        style={{ width: '100%', maxWidth: '32rem', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ fontWeight: 700, margin: 0, color: '#0f172a' }}>⚙️ Cài đặt dữ liệu thú cưng</h3>
          <button onClick={onClose} style={{ padding: '6px', borderRadius: '8px', cursor: 'pointer', border: 'none', background: 'none', color: '#64748b' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          {([
            { id: 'breeds',  label: 'Giống',    icon: '🐕' },
            { id: 'tempers', label: 'Tính cách', icon: '😊' },
            { id: 'vaccines',label: 'Mũi tiêm',  icon: '💉' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer',
                borderBottom: tab === t.id ? '2px solid #00D4FF' : '2px solid transparent',
                color: tab === t.id ? '#00D4FF' : '#64748b',
                background: tab === t.id ? 'white' : 'transparent',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {tab === 'breeds' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={breedSpecies} onChange={e => setBreedSpecies(e.target.value)}
                  style={{ width: '112px', padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {SPECIES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input value={newBreed} onChange={e => setNewBreed(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addBreed()}
                  placeholder="Tên giống..." style={{ flex: 1, padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                <button onClick={addBreed}
                  style={{ padding: '8px 12px', background: '#00D4FF', color: 'black', borderRadius: '8px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  <Plus size={15} />
                </button>
              </div>

              {SPECIES_LIST.map(sp => {
                const list = breeds.filter(b => b.species === sp)
                if (list.length === 0) return null
                return (
                  <div key={sp}>
                    <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px' }}>{sp}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {list.map(b => (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: '#f8fafc' }}>
                          {editBreedId === b.id ? (
                            <>
                              <input value={editBreedVal} onChange={e => setEditBreedVal(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveEditBreed(b.id); if (e.key === 'Escape') setEditBreedId(null) }}
                                style={{ flex: 1, fontSize: '14px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} autoFocus />
                              <button onClick={() => saveEditBreed(b.id)} style={{ padding: '4px', color: '#10b981', border: 'none', background: 'transparent', cursor: 'pointer' }}><Check size={14} /></button>
                              <button onClick={() => setEditBreedId(null)} style={{ padding: '4px', color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={14} /></button>
                            </>
                          ) : (
                            <>
                              <span style={{ flex: 1, fontSize: '14px', color: '#334155' }}>{b.name}</span>
                              <button onClick={() => { setEditBreedId(b.id); setEditBreedVal(b.name) }}
                                style={{ padding: '4px', color: '#94a3b8', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => deleteBreed(b.id)}
                                style={{ padding: '4px', color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'tempers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={newTemper} onChange={e => setNewTemper(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTemper()}
                  placeholder="Tên tính cách..." style={{ flex: 1, padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                <button onClick={addTemper}
                  style={{ padding: '8px 12px', background: '#00D4FF', color: 'black', borderRadius: '8px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  <Plus size={15} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {tempers.map((t, i) => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: '#f8fafc' }}>
                    {editTemperIdx === i ? (
                      <>
                        <input value={editTemperVal} onChange={e => setEditTemperVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditTemper(i); if (e.key === 'Escape') setEditTemperIdx(null) }}
                          style={{ flex: 1, fontSize: '14px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} autoFocus />
                        <button onClick={() => saveEditTemper(i)} style={{ padding: '4px', color: '#10b981', border: 'none', background: 'transparent', cursor: 'pointer' }}><Check size={14} /></button>
                        <button onClick={() => setEditTemperIdx(null)} style={{ padding: '4px', color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: '14px', color: '#334155' }}>{t}</span>
                        <button onClick={() => { setEditTemperIdx(i); setEditTemperVal(t) }}
                          style={{ padding: '4px', color: '#94a3b8', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteTemper(i)}
                          style={{ padding: '4px', color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'vaccines' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={newVaccine} onChange={e => setNewVaccine(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addVaccine()}
                  placeholder="Tên mũi tiêm..." style={{ flex: 1, padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                <button onClick={addVaccine}
                  style={{ padding: '8px 12px', background: '#00D4FF', color: 'black', borderRadius: '8px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  <Plus size={15} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {vaccines.map(v => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: '#f8fafc' }}>
                    {editVaccineId === v.id ? (
                      <>
                        <input value={editVaccineVal} onChange={e => setEditVaccineVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditVaccine(v.id); if (e.key === 'Escape') setEditVaccineId(null) }}
                          style={{ flex: 1, fontSize: '14px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} autoFocus />
                        <button onClick={() => saveEditVaccine(v.id)} style={{ padding: '4px', color: '#10b981', border: 'none', background: 'transparent', cursor: 'pointer' }}><Check size={14} /></button>
                        <button onClick={() => setEditVaccineId(null)} style={{ padding: '4px', color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '18px' }}>💉</span>
                        <span style={{ flex: 1, fontSize: '14px', color: '#334155' }}>{v.name}</span>
                        <button onClick={() => { setEditVaccineId(v.id); setEditVaccineVal(v.name) }}
                          style={{ padding: '4px', color: '#94a3b8', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteVaccine(v.id)}
                          style={{ padding: '4px', color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
