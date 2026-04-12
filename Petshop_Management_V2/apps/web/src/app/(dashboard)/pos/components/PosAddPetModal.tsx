'use client';
import { useState, useEffect } from 'react';
import { X, PawPrint, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { api } from '@/lib/api';

interface PosAddPetModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  initialPet?: any;
  onSaved: (pet: any) => void;
}

export function PosAddPetModal({ isOpen, onClose, customerId, customerName, customerPhone, initialPet, onSaved }: PosAddPetModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
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

  useEffect(() => {
    if (isOpen) {
      if (initialPet) {
        setName(initialPet.name || '');
        setSpecies(initialPet.species || 'Chó');
        setGender(initialPet.gender || 'MALE');
        setDob(initialPet.dateOfBirth ? initialPet.dateOfBirth.split('T')[0] : '');
        setWeight(initialPet.weight ? String(initialPet.weight) : '');
        setBreed(initialPet.breed || '');
        setTrait(initialPet.traits?.[0] || initialPet.temperament || '');
        setNote(initialPet.notes || initialPet.note || '');
        setAltPhone(initialPet.altPhone || '');
        setError('');
        // For image, we can just show existing avatar if any
        if (initialPet.avatar) {
          const avatarUrl = String(initialPet.avatar).startsWith('http') || String(initialPet.avatar).startsWith('data:') 
            ? initialPet.avatar 
            : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${initialPet.avatar}`;
          setImagePreview(avatarUrl);
        } else {
          setImagePreview(null);
        }
        setImageFile(null);
      } else {
        setName(''); setSpecies('Chó'); setGender('MALE'); setDob(''); setWeight(''); setBreed(''); setTrait(''); setNote(''); setError(''); setAltPhone(''); setImagePreview(null); setImageFile(null);
      }
    }
  }, [isOpen, initialPet]);

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
      if (initialPet?.id) {
        res = await api.put(`/pets/${initialPet.id}`, payload);
      } else {
        res = await api.post('/pets', payload);
      }
      
      // TODO: Handle imageFile upload to a server endpoint if available like `/upload`

      onSaved(res.data?.data || res.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full form-input text-sm px-3 py-2.5 bg-[#252833] border border-[#353945] rounded-xl focus:border-cyan-500 focus:outline-none text-slate-200 transition-colors placeholder:text-slate-500";
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1b1f27] border border-[#2b303b] rounded-2xl shadow-2xl w-full max-w-[550px] overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="p-4 border-b border-[#2b303b] flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <PawPrint className="text-cyan-400" size={20} />
            {initialPet ? 'Sửa thông tin thú cưng' : 'Thêm thú cưng mới'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[80vh] custom-scrollbar">
          {error && (
             <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2 text-red-500 text-sm">
               <AlertTriangle size={16} />
               {error}
             </div>
          )}

          <div className="flex gap-4">
             {/* Thumbnail */}
             <div className="flex flex-col items-center gap-2 shrink-0">
               <label className="w-24 h-24 rounded-2xl bg-[#252833] border border-[#353945] flex items-center justify-center text-slate-500 cursor-pointer overflow-hidden relative group hover:border-cyan-500/50 transition-colors">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Pet" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={32} className="group-hover:text-cyan-400 transition-colors" />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
               </label>
               {imagePreview && (
                 <button 
                   onClick={() => { setImagePreview(null); setImageFile(null); }}
                   className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                 >
                   × Xóa
                 </button>
               )}
             </div>

             <div className="flex-1 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-400 block mb-1">Tên thú cưng <span className="text-red-400">*</span></label>
                  <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="Tên thú cưng" autoFocus />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400 block mb-1">Loài</label>
                  <div className="flex bg-[#252833] p-1 rounded-xl border border-[#353945]">
                     <button onClick={() => setSpecies('Chó')} className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${species === 'Chó' ? 'bg-[#0f2e36] text-cyan-400 font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Chó</button>
                     <button onClick={() => setSpecies('Mèo')} className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${species === 'Mèo' ? 'bg-[#0f2e36] text-cyan-400 font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Mèo</button>
                     <button onClick={() => setSpecies('Khác')} className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${species === 'Khác' ? 'bg-[#0f2e36] text-cyan-400 font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Khác</button>
                  </div>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
             <div>
                <label className="text-sm font-medium text-slate-400 block mb-1">Giới tính <span className="text-red-400">*</span></label>
                <div className="flex gap-2">
                   <button onClick={() => setGender('MALE')} className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${gender === 'MALE' ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>♂ Đực</button>
                   <button onClick={() => setGender('FEMALE')} className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${gender === 'FEMALE' ? 'border-pink-500/30 bg-pink-500/10 text-pink-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>♀ Cái</button>
                </div>
             </div>
             <div>
                <label className="text-sm font-medium text-slate-400 block mb-1">Ngày sinh</label>
                <input type="date" className={inputClass + " [color-scheme:dark]"} value={dob} onChange={e => setDob(e.target.value)} />
             </div>
             <div>
                <label className="text-sm font-medium text-slate-400 block mb-1">Cân nặng (kg)</label>
                <input type="number" step="0.1" className={inputClass} value={weight} onChange={e => setWeight(e.target.value)} placeholder="0.0" />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="text-sm font-medium text-slate-400 block mb-1">Giống</label>
               <input className={inputClass} value={breed} onChange={e => setBreed(e.target.value)} placeholder="Nhập giống..." />
             </div>
             <div>
               <label className="text-sm font-medium text-slate-400 block mb-1">Tính cách</label>
               <input className={inputClass} value={trait} onChange={e => setTrait(e.target.value)} placeholder="Thân thiện, nhút nhát..." />
             </div>
          </div>

          <div>
             <label className="text-sm font-medium text-slate-400 block mb-1">Chủ thú cưng <span className="text-red-400">*</span></label>
             <div className="flex items-center gap-3 p-3 bg-[#252833] border border-[#353945] rounded-xl mb-3">
               <div className="w-8 h-8 rounded-full bg-[#1e4854] text-cyan-400 flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                  {customerName.charAt(0) || 'U'}
               </div>
               <div>
                  <div className="font-medium text-slate-200">{customerName}</div>
                  <div className="text-xs text-slate-500">{customerPhone || '---'}</div>
               </div>
             </div>
             
             <div className="mt-4 relative">
               <label className="text-sm font-medium text-slate-400 block mb-1">SĐT phụ (nếu có)</label>
               <input className={inputClass} value={altPhone} onChange={e => setAltPhone(e.target.value)} placeholder="Nhập SĐT liên lạc khác..." />
             </div>
          </div>

          <div>
             <label className="text-sm font-medium text-slate-400 block mb-1">Ghi chú / Lưu ý phục vụ</label>
             <textarea className={inputClass + " min-h-[80px] resize-none"} value={note} onChange={e => setNote(e.target.value)} placeholder="Dị ứng, lưu ý đặc biệt..." />
          </div>
          
        </div>

        <div className="p-4 border-t border-[#2b303b] flex justify-between gap-2">
          <button onClick={onClose} className="px-6 py-2.5 bg-[#252833] hover:bg-[#2b303b] text-slate-300 rounded-xl text-sm font-semibold transition-colors border border-[#353945]">
            Hủy
          </button>
          <button onClick={handleSave} disabled={loading} className="px-8 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
            {loading ? 'Đang lưu...' : initialPet ? 'Cập nhật' : 'Thêm'}
          </button>
        </div>

      </div>
    </div>
  );
}
