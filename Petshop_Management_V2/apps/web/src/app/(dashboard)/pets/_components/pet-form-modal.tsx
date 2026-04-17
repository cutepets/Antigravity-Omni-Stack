'use client';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { X, PawPrint, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { petApi } from '@/lib/api/pet.api';
import { useQueryClient } from '@tanstack/react-query';
import { customToast as toast } from '@/components/ui/toast-with-copy';
import { loadBreedsFromDB, loadTempsFromDB, BreedEntry, TemperEntry, getTemperStyle, saveBreeds, saveTempers } from './pet-settings-modal';


export interface PetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  initialData?: any;
  onSaved?: (pet: any) => void;
}

export function PetFormModal({ isOpen, onClose, customerId, customerName, customerPhone, initialData, onSaved }: PetFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  // States
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Chó');
  const [gender, setGender] = useState('MALE'); // MALE, FEMALE
  const [dob, setDob] = useState('');
  const [weight, setWeight] = useState('');
  const [breed, setBreed] = useState('');
  const [trait, setTrait] = useState('');
  const [note, setNote] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [breedsList, setBreedsList] = useState<BreedEntry[]>([]);
  const [tempersList, setTempersList] = useState<TemperEntry[]>([]);
  const [showBreedDropdown, setShowBreedDropdown] = useState(false);
  const [showTraitDropdown, setShowTraitDropdown] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadBreedsFromDB().then(setBreedsList);
      loadTempsFromDB().then(setTempersList);
    }
  }, [isOpen]);

  const filteredBreeds = breedsList.filter(b => b.species === species && b.name.toLowerCase().includes(breed.toLowerCase()));
  const filteredTraits = tempersList.filter(t => t.name.toLowerCase().includes(trait.toLowerCase()));
  const showAddBreed = breed.trim() !== '' && !filteredBreeds.some(b => b.name.toLowerCase() === breed.toLowerCase().trim());
  const showAddTrait = trait.trim() !== '' && !filteredTraits.some(t => t.name.toLowerCase() === trait.toLowerCase().trim());

  const handleQuickAddBreed = () => {
    const newName = breed.trim();
    if (!newName) return;
    const newEntry: BreedEntry = { id: Date.now().toString(), name: newName, species };
    const next = [...breedsList, newEntry];
    setBreedsList(next);
    saveBreeds(next);
    setBreed(newName);
    setShowBreedDropdown(false);
    toast.success(`Đã thêm giống '${newName}' vào cài đặt`);
  };

  const handleQuickAddTrait = () => {
    const newName = trait.trim();
    if (!newName) return;
    const newEntry: TemperEntry = { name: newName, color: 'gray' };
    const next = [...tempersList, newEntry];
    setTempersList(next);
    saveTempers(next);
    setTrait(newName);
    setShowTraitDropdown(false);
    toast.success(`Đã thêm tính cách '${newName}' vào cài đặt`);
  };

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || '');
        setSpecies(initialData.species || 'Chó');
        setGender(initialData.gender || 'MALE');
        setDob(initialData.dateOfBirth ? initialData.dateOfBirth.split('T')[0] : '');
        setWeight(initialData.weight ? String(initialData.weight) : '');
        setBreed(initialData.breed || '');
        setTrait(initialData.traits?.[0] || initialData.temperament || '');
        setNote(initialData.notes || initialData.note || '');
        setAltPhone(initialData.altPhone || '');
        setError('');
        // For image, we can just show existing avatar if any
        if (initialData.avatar) {
          const avatarUrl = String(initialData.avatar).startsWith('http') || String(initialData.avatar).startsWith('data:')
            ? initialData.avatar
            : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${initialData.avatar}`;
          setImagePreview(avatarUrl);
        } else {
          setImagePreview(null);
        }
        setImageFile(null);
      } else {
        setName(''); setSpecies('Chó'); setGender('MALE'); setDob(''); setWeight(''); setBreed(''); setTrait(''); setNote(''); setError(''); setAltPhone(''); setImagePreview(null); setImageFile(null);
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name) return setError('Vui lòng nhập tên thú cưng');
    try {
      setLoading(true);
      setError('');
      const payload = {
        name,
        species,
        gender,
        birthDate: dob ? new Date(dob).toISOString() : null,
        weight: weight ? parseFloat(weight) : null,
        breed,
        traits: trait ? [trait] : [],
        temperament: trait,
        notes: note,
        customerId
      };

      let res;
      if (initialData?.id) {
        res = await api.put(`/pets/${initialData.id}`, payload);
      } else {
        res = await api.post('/pets', payload);
      }

      // TODO: Handle imageFile upload to a server endpoint if available like `/upload`

      // Upload avatar if there's a new image
      const petId = initialData?.id || res?.data?.id || res?.data?.data?.id
      if (imageFile && petId) {
        try {
          await petApi.uploadAvatar(petId, imageFile)
          toast.success('Đã lưu ảnh thú cưng')
        } catch (uploadError) {
          console.error('Upload ảnh thất bại:', uploadError)
        }
      }

      toast.success(initialData?.id ? 'Lưu thú cưng thành công' : 'Thêm thú cưng thành công');
      queryClient.invalidateQueries({ queryKey: ['pets'] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });

      if (onSaved) {
        onSaved(res.data?.data || res.data);
      } else {
        onClose();
      }
    } catch (e: any) {
      setError(e.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full form-input text-sm px-3 py-2.5 bg-background-base border border-border rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none shadow-sm placeholder:text-foreground-muted text-foreground";

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  return (
    <div className="fixed inset-0 z-100 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background-base border border-border rounded-2xl shadow-2xl w-full max-w-[550px] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <PawPrint className="text-primary-500" size={20} />
            {initialData ? 'Sửa thông tin thú cưng' : 'Thêm thú cưng mới'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-foreground-muted hover:text-foreground rounded-full hover:bg-background-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[80vh] no-scrollbar">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2 text-red-500 text-sm font-medium">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <div className="flex gap-4">
            {/* Thumbnail */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <label className="w-24 h-24 rounded-2xl bg-background-secondary border border-border flex items-center justify-center text-foreground-muted cursor-pointer overflow-hidden relative group hover:border-primary-500 transition-colors">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <Image src={imagePreview} alt="Pet" className="w-full h-full object-cover" width={400} height={400} unoptimized />
                ) : (
                  <ImageIcon size={32} className="group-hover:text-primary-500 transition-colors" />
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
              {imagePreview && (
                <button
                  onClick={() => { setImagePreview(null); setImageFile(null); }}
                  className="text-xs text-red-500 hover:text-red-400 transition-colors font-medium"
                >
                  × Xóa
                </button>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Tên thú cưng <span className="text-red-500">*</span></label>
                <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="Tên thú cưng" autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Loài</label>
                <div className="flex bg-background-secondary p-1 rounded-xl border border-border">
                  <button onClick={() => setSpecies('Chó')} className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${species === 'Chó' ? 'bg-background-base border border-border text-primary-500 font-semibold shadow-sm' : 'text-foreground-muted hover:text-foreground'}`}>Chó</button>
                  <button onClick={() => setSpecies('Mèo')} className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${species === 'Mèo' ? 'bg-background-base border border-border text-primary-500 font-semibold shadow-sm' : 'text-foreground-muted hover:text-foreground'}`}>Mèo</button>
                  <button onClick={() => setSpecies('Khác')} className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${species === 'Khác' ? 'bg-background-base border border-border text-primary-500 font-semibold shadow-sm' : 'text-foreground-muted hover:text-foreground'}`}>Khác</button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Giới tính <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <button onClick={() => setGender('MALE')} className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${gender === 'MALE' ? 'border-primary-500 bg-primary-500/10 text-primary-500 font-semibold' : 'border-border bg-background-secondary text-foreground-muted hover:bg-background-base'}`}>♂ Đực</button>
                <button onClick={() => setGender('FEMALE')} className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${gender === 'FEMALE' ? 'border-pink-500 bg-pink-500/10 text-pink-500 font-semibold' : 'border-border bg-background-secondary text-foreground-muted hover:bg-background-base'}`}>♀ Cái</button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Ngày sinh</label>
              <input type="date" className={inputClass} value={dob} onChange={e => setDob(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Cân nặng (kg)</label>
              <input type="number" step="0.1" className={inputClass} value={weight} onChange={e => setWeight(e.target.value)} placeholder="0.0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="text-sm font-medium text-foreground block mb-1">Giống</label>
              <input
                className={inputClass}
                value={breed}
                onChange={e => { setBreed(e.target.value); setShowBreedDropdown(true); }}
                onFocus={() => setShowBreedDropdown(true)}
                onBlur={() => setTimeout(() => setShowBreedDropdown(false), 200)}
                placeholder="Nhập hoặc chọn giống..."
              />
              {showBreedDropdown && (filteredBreeds.length > 0 || showAddBreed) && (
                <div className="absolute z-110 mt-1 w-full rounded-xl border border-border bg-background-base shadow-xl max-h-[200px] overflow-y-auto no-scrollbar p-1">
                  {filteredBreeds.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setBreed(b.name); setShowBreedDropdown(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors cursor-pointer"
                    >
                      {b.name}
                    </button>
                  ))}
                  {showAddBreed && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleQuickAddBreed}
                      className="w-full text-left px-3 py-2 text-sm text-primary-500 hover:bg-primary-500/10 rounded-lg transition-colors cursor-pointer font-medium flex items-center justify-between"
                    >
                      <span>+ Thêm &quot;{breed}&quot;</span>
                      <span className="text-[10px] uppercase text-primary-500/60 font-bold bg-primary-500/10 px-1.5 py-0.5 rounded">Lưu cài đặt</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <label className="text-sm font-medium text-foreground block mb-1">Tính cách</label>
              <input
                className={inputClass}
                value={trait}
                onChange={e => { setTrait(e.target.value); setShowTraitDropdown(true); }}
                onFocus={() => setShowTraitDropdown(true)}
                onBlur={() => setTimeout(() => setShowTraitDropdown(false), 200)}
                placeholder="Nhập hoặc chọn tính cách..."
              />
              {showTraitDropdown && (filteredTraits.length > 0 || showAddTrait) && (
                <div className="absolute z-110 mt-1 w-full rounded-xl border border-border bg-background-base shadow-xl max-h-[200px] overflow-y-auto no-scrollbar p-1">
                  {filteredTraits.map(t => {
                    const style = getTemperStyle(t.color)
                    return (
                      <button
                        key={t.name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setTrait(t.name); setShowTraitDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.value }}></span>
                        {t.name}
                      </button>
                    )
                  })}
                  {showAddTrait && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleQuickAddTrait}
                      className="w-full text-left px-3 py-2 text-sm text-primary-500 hover:bg-primary-500/10 rounded-lg transition-colors cursor-pointer font-medium flex items-center justify-between"
                    >
                      <span>+ Thêm &quot;{trait}&quot;</span>
                      <span className="text-[10px] uppercase text-primary-500/60 font-bold bg-primary-500/10 px-1.5 py-0.5 rounded">Lưu cài đặt</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Chủ thú cưng <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-3 p-3 bg-background-secondary border border-border rounded-xl mb-3">
              <div className="w-8 h-8 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                {customerName.charAt(0) || 'U'}
              </div>
              <div>
                <div className="font-medium text-foreground">{customerName}</div>
                <div className="text-xs text-foreground-muted">{customerPhone || '---'}</div>
              </div>
            </div>

            <div className="mt-4 relative">
              <label className="text-sm font-medium text-foreground block mb-1">SĐT phụ (nếu có)</label>
              <input className={inputClass} value={altPhone} onChange={e => setAltPhone(e.target.value)} placeholder="Nhập SĐT liên lạc khác..." />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Ghi chú / Lưu ý phục vụ</label>
            <textarea className={inputClass + " min-h-[80px] resize-none"} value={note} onChange={e => setNote(e.target.value)} placeholder="Dị ứng, lưu ý đặc biệt..." />
          </div>

        </div>

        <div className="p-4 border-t border-border flex justify-between gap-2">
          <button onClick={onClose} className="px-6 py-2.5 bg-background-base border border-border hover:bg-background-secondary text-foreground rounded-xl text-sm font-semibold transition-colors">
            Hủy
          </button>
          <button onClick={handleSave} disabled={loading} className="px-8 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm">
            {loading ? 'Đang lưu...' : initialData ? 'Cập nhật' : 'Thêm'}
          </button>
        </div>

      </div>
    </div>
  );
}