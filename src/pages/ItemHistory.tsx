import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Package, History, Copy, CheckCircle, Clock, MapPin, ArrowRight, User, Plus, Phone, AlertTriangle, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface MutationHistory {
  id: string;
  pic_name: string;
  pic_phone: string | null;
  notes: string | null;
  created_at: string;
  equipment: { name: string; code: string } | null;
  previous_room: { name: string; code: string } | null;
  new_room: { name: string; code: string } | null;
}

const ItemHistory = () => {
  const { getText } = useLanguage();
  const [history, setHistory] = useState<MutationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const navigate = useNavigate();

  const [editingItem, setEditingItem] = useState<MutationHistory | null>(null);
  const [editPicName, setEditPicName] = useState('');
  const [editPicPhone, setEditPicPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineNoteText, setInlineNoteText] = useState<string>('');

  const saveLocalUpdate = (id: string, picName: string, picPhone: string | null, notes: string | null) => {
    setHistory(prev => prev.map(item => item.id === id ? { ...item, pic_name: picName, pic_phone: picPhone, notes } : item));

    try {
      const localData = localStorage.getItem('local_equipment_mutations');
      if (localData) {
        const list = JSON.parse(localData);
        const updated = list.map((item: any) => item.id === id ? { ...item, pic_name: picName, pic_phone: picPhone, notes } : item);
        localStorage.setItem('local_equipment_mutations', JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Error updating local storage:', e);
    }
  };

  const handleSaveInlineNote = async (record: MutationHistory) => {
    const newNote = inlineNoteText.trim() || null;
    saveLocalUpdate(record.id, record.pic_name, record.pic_phone, newNote);
    setInlineEditId(null);

    if (isLocalMode) {
      toast.success(getText('Note updated', 'Keterangan berhasil diperbarui (lokal)'));
      return;
    }

    try {
      const { error } = await supabase
        .from('equipment_mutations')
        .update({ notes: newNote })
        .eq('id', record.id);

      if (error) {
        console.warn('[ItemHistory] DB note update failed, saved locally:', error);
        toast.success(getText('Note saved locally (DB update pending)', 'Keterangan diperbarui (lokal)'));
      } else {
        toast.success(getText('Note updated successfully', 'Keterangan berhasil diperbarui'));
      }
    } catch (err: any) {
      console.warn('[ItemHistory] Exception updating note:', err);
      toast.success(getText('Note saved locally', 'Keterangan diperbarui (lokal)'));
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm(getText('Are you sure you want to delete this mutation history record?', 'Apakah Anda yakin ingin menghapus catatan histori mutasi ini?'))) {
      return;
    }

    try {
      if (isLocalMode) {
        const localData = localStorage.getItem('local_equipment_mutations');
        if (localData) {
          const list = JSON.parse(localData);
          const filtered = list.filter((item: any) => item.id !== id);
          localStorage.setItem('local_equipment_mutations', JSON.stringify(filtered));
          setHistory(filtered);
          toast.success(getText('History record deleted successfully (local)', 'Catatan histori berhasil dihapus (lokal)'));
        }
      } else {
        const { error } = await supabase
          .from('equipment_mutations')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        toast.success(getText('History record deleted successfully', 'Catatan histori berhasil dihapus'));
        fetchHistory();
      }
    } catch (err: any) {
      console.error('Error deleting mutation record:', err);
      toast.error(getText('Failed to delete history record: ' + err.message, 'Gagal menghapus catatan histori: ' + err.message));
    }
  };

  const handleEditClick = (item: MutationHistory) => {
    setEditingItem(item);
    setEditPicName(item.pic_name);
    setEditPicPhone(item.pic_phone || '');
    setEditNotes(item.notes || '');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSaving(true);
    const newPicName = editPicName.trim();
    const newPicPhone = editPicPhone.trim() || null;
    const newNotes = editNotes.trim() || null;

    saveLocalUpdate(editingItem.id, newPicName, newPicPhone, newNotes);

    if (isLocalMode) {
      toast.success(getText('History record updated successfully (local)', 'Catatan histori berhasil diperbarui (lokal)'));
      setEditingItem(null);
      setIsSaving(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('equipment_mutations')
        .update({
          pic_name: newPicName,
          pic_phone: newPicPhone,
          notes: newNotes
        })
        .eq('id', editingItem.id);

      if (error) {
        console.warn('[ItemHistory] DB update failed, saved locally:', error);
        toast.success(getText('History record updated locally', 'Catatan histori berhasil diperbarui (lokal)'));
      } else {
        toast.success(getText('History record updated successfully', 'Catatan histori berhasil diperbarui'));
      }
      setEditingItem(null);
    } catch (err: any) {
      console.error('Error updating mutation record:', err);
      toast.success(getText('History record updated locally', 'Catatan histori berhasil diperbarui (lokal)'));
      setEditingItem(null);
    } finally {
      setIsSaving(false);
    }
  };

  const loadLocalHistory = () => {
    setIsLocalMode(true);
    try {
      const localData = localStorage.getItem('local_equipment_mutations');
      if (localData) {
        setHistory(JSON.parse(localData));
      } else {
        setHistory([]);
      }
    } catch (e) {
      console.error('Error loading local history:', e);
      setHistory([]);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    setIsLocalMode(false);
    try {
      // Strategy 1: Try full embedded FK query with pic_phone
      const result = await fetchWithEmbeddedRelations(true);
      if (result.success) {
        setHistory(result.data);
        return;
      }

      // Strategy 2: If pic_phone column missing, try without it
      if (result.errorType === 'missing_column') {
        console.warn('[ItemHistory] pic_phone column not found, retrying without it...');
        const result2 = await fetchWithEmbeddedRelations(false);
        if (result2.success) {
          setHistory(result2.data);
          toast.success(getText(
            'History loaded (pic_phone column missing - please run migration)',
            'Histori dimuat (kolom pic_phone belum ada - jalankan migrasi)'
          ));
          return;
        }
        // If still failing, fall through to Strategy 3
      }

      // If table doesn't exist, fallback to local storage
      if (result.errorType === 'table_not_found' || result.errorType === 'rls_denied') {
        console.warn('[ItemHistory] Falling back to local storage due to:', result.errorType);
        loadLocalHistory();
        return;
      }

      // Strategy 3: Manual client-side join (fallback for FK/relationship errors)
      console.warn('[ItemHistory] Embedded FK query failed, trying manual join...', result.errorMessage);
      const manualResult = await fetchWithManualJoin();
      if (manualResult.success) {
        setHistory(manualResult.data);
        return;
      }

      // All strategies failed
      throw new Error(manualResult.errorMessage || result.errorMessage || 'Unknown error');
    } catch (err: any) {
      console.error('[ItemHistory] Error fetching history, falling back to local storage:', err);
      loadLocalHistory();
    } finally {
      setLoading(false);
    }
  };

  // Helper: classify Supabase error
  const classifyError = (error: any): 'missing_column' | 'table_not_found' | 'rls_denied' | 'relationship_error' | 'other' => {
    const msg = (error?.message || '').toLowerCase();
    const code = (error as any)?.code || '';
    const hint = (error?.hint || '').toLowerCase();

    if (code === '42P01' || msg.includes('relation') && msg.includes('does not exist')) return 'table_not_found';
    if (code === '42703' || msg.includes('pic_phone') || (msg.includes('column') && msg.includes('does not exist'))) return 'missing_column';
    if (code === '42501' || msg.includes('row-level security') || msg.includes('insufficient_privilege') || msg.includes('permission denied')) return 'rls_denied';
    if (msg.includes('could not find a relationship') || msg.includes('ambiguous') || hint.includes('relationship') || msg.includes('schema cache')) return 'relationship_error';
    return 'other';
  };

  // Strategy 1 & 2: Fetch with embedded FK relations
  const fetchWithEmbeddedRelations = async (includePicPhone: boolean): Promise<{ success: boolean; data: MutationHistory[]; errorType?: string; errorMessage?: string }> => {
    try {
      const selectFields = includePicPhone
        ? `id, pic_name, pic_phone, notes, created_at, equipment:equipment_id(name, code), previous_room:previous_room_id(name, code), new_room:new_room_id(name, code)`
        : `id, pic_name, notes, created_at, equipment:equipment_id(name, code), previous_room:previous_room_id(name, code), new_room:new_room_id(name, code)`;

      const { data, error } = await supabase
        .from('equipment_mutations')
        .select(selectFields)
        .order('created_at', { ascending: false });

      if (error) {
        const errorType = classifyError(error);
        return { success: false, data: [], errorType, errorMessage: error.message };
      }

      const mappedData = (data || []).map((item: any) => ({
        ...item,
        pic_phone: includePicPhone ? (item.pic_phone || null) : null,
      }));
      return { success: true, data: mappedData as MutationHistory[] };
    } catch (err: any) {
      return { success: false, data: [], errorType: 'other', errorMessage: err?.message || 'Unknown error' };
    }
  };

  // Strategy 3: Manual client-side join (when FK relationships fail)
  const fetchWithManualJoin = async (): Promise<{ success: boolean; data: MutationHistory[]; errorMessage?: string }> => {
    try {
      // Step 1: Fetch raw mutations without FK joins
      let mutationsQuery = supabase
        .from('equipment_mutations')
        .select('id, equipment_id, previous_room_id, new_room_id, pic_name, notes, created_at')
        .order('created_at', { ascending: false });

      // Try with pic_phone first
      const { data: withPhone, error: phoneError } = await supabase
        .from('equipment_mutations')
        .select('id, equipment_id, previous_room_id, new_room_id, pic_name, pic_phone, notes, created_at')
        .order('created_at', { ascending: false });

      let mutations: any[];
      let hasPicPhone = true;

      if (phoneError) {
        // Retry without pic_phone
        const { data: withoutPhone, error: noPhoneError } = await supabase
          .from('equipment_mutations')
          .select('id, equipment_id, previous_room_id, new_room_id, pic_name, notes, created_at')
          .order('created_at', { ascending: false });

        if (noPhoneError) {
          return { success: false, data: [], errorMessage: noPhoneError.message };
        }
        mutations = withoutPhone || [];
        hasPicPhone = false;
      } else {
        mutations = withPhone || [];
      }

      if (mutations.length === 0) {
        return { success: true, data: [] };
      }

      // Step 2: Collect unique equipment and room IDs
      const equipmentIds = [...new Set(mutations.map((m: any) => m.equipment_id).filter(Boolean))];
      const roomIds = [...new Set([
        ...mutations.map((m: any) => m.previous_room_id).filter(Boolean),
        ...mutations.map((m: any) => m.new_room_id).filter(Boolean),
      ])];

      // Step 3: Fetch equipment and rooms in parallel
      const [equipmentRes, roomsRes] = await Promise.all([
        equipmentIds.length > 0
          ? supabase.from('equipment').select('id, name, code').in('id', equipmentIds)
          : Promise.resolve({ data: [], error: null }),
        roomIds.length > 0
          ? supabase.from('rooms').select('id, name, code').in('id', roomIds as string[])
          : Promise.resolve({ data: [], error: null }),
      ]);

      // Build lookup maps
      const equipmentMap = new Map((equipmentRes.data || []).map((e: any) => [e.id, { name: e.name, code: e.code }]));
      const roomMap = new Map((roomsRes.data || []).map((r: any) => [r.id, { name: r.name, code: r.code }]));

      // Step 4: Join data client-side
      const joined: MutationHistory[] = mutations.map((m: any) => ({
        id: m.id,
        pic_name: m.pic_name,
        pic_phone: hasPicPhone ? (m.pic_phone || null) : null,
        notes: m.notes || null,
        created_at: m.created_at,
        equipment: equipmentMap.get(m.equipment_id) || null,
        previous_room: m.previous_room_id ? (roomMap.get(m.previous_room_id) || null) : null,
        new_room: roomMap.get(m.new_room_id) || null,
      }));

      console.info('[ItemHistory] Successfully loaded via manual join:', joined.length, 'records');
      return { success: true, data: joined };
    } catch (err: any) {
      return { success: false, data: [], errorMessage: err?.message || 'Manual join failed' };
    }
  };

  const handleCopyLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const formUrl = `${baseUrl}#/item-mutation`;
    
    navigator.clipboard.writeText(formUrl).then(() => {
      setCopied(true);
      toast.success(getText('Link copied to clipboard!', 'Link berhasil disalin!'));
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error(getText('Failed to copy link', 'Gagal menyalin link'));
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <History className="h-6 w-6 mr-2 text-blue-600" />
            {getText('Item Transfer History', 'Histori Mutasi Barang')}
          </h1>
          <p className="text-gray-500 mt-1">
            {getText('Track all equipment movements across rooms', 'Lacak semua perpindahan barang antar ruangan')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/item-mutation')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {getText('Add Transfer', 'Tambah Mutasi')}
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
          >
            {copied ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? getText('Copied!', 'Tersalin!') : getText('Copy Form Link', 'Salin Link Form')}
          </button>
        </div>
      </div>

      {isLocalMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-amber-800 text-sm">
                {getText('Local Storage Mode Active', 'Mode Penyimpanan Lokal Aktif')}
              </h3>
              <p className="text-amber-700 text-xs mt-1">
                {getText(
                  'The database table for tracking mutations does not exist yet. Mutations are being saved on this browser local storage only.',
                  'Tabel database untuk mutasi barang belum dibuat. Saat ini mutasi barang disimpan sementara di penyimpanan lokal browser ini.'
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner with SQL Fix */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-red-800 text-sm">
                {getText('Database Error', 'Error Database')}
              </h3>
              <p className="text-red-700 text-xs mt-1 break-all">{error}</p>
              <div className="mt-3 bg-red-100 rounded-lg p-3">
                <p className="text-red-800 text-xs font-semibold mb-2">
                  {getText(
                    'Run this SQL in Supabase SQL Editor to fix:',
                    'Jalankan SQL ini di Supabase SQL Editor untuk memperbaiki:'
                  )}
                </p>
                <pre className="text-[10px] text-red-900 bg-white rounded p-2 overflow-x-auto whitespace-pre-wrap border border-red-200 select-all">
{`-- 1. Create the table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS public.equipment_mutations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID REFERENCES public.equipment(id) ON DELETE CASCADE,
    previous_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    new_room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    pic_name TEXT NOT NULL,
    pic_phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add pic_phone if missing
ALTER TABLE public.equipment_mutations ADD COLUMN IF NOT EXISTS pic_phone TEXT;

-- 3. Enable RLS
ALTER TABLE public.equipment_mutations ENABLE ROW LEVEL SECURITY;

-- 4. Drop ALL old policies
DROP POLICY IF EXISTS "Super admins can manage equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Authenticated users can insert equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Authenticated users can view equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Public users can insert equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Anyone can insert equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Anyone can view equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_all_select_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_all_insert_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_anon_insert_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_anon_select_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_all_update_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_all_delete_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "mutations_select_authenticated" ON public.equipment_mutations;
DROP POLICY IF EXISTS "mutations_select_anon" ON public.equipment_mutations;
DROP POLICY IF EXISTS "mutations_insert_authenticated" ON public.equipment_mutations;
DROP POLICY IF EXISTS "mutations_insert_anon" ON public.equipment_mutations;
DROP POLICY IF EXISTS "mutations_update_authenticated" ON public.equipment_mutations;
DROP POLICY IF EXISTS "mutations_delete_authenticated" ON public.equipment_mutations;

-- 5. Create proper policies (authenticated + anon separated)
CREATE POLICY "mutations_select_authenticated" ON public.equipment_mutations FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutations_select_anon" ON public.equipment_mutations FOR SELECT TO anon USING (true);
CREATE POLICY "mutations_insert_authenticated" ON public.equipment_mutations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mutations_insert_anon" ON public.equipment_mutations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "mutations_update_authenticated" ON public.equipment_mutations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "mutations_update_anon" ON public.equipment_mutations FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "mutations_delete_authenticated" ON public.equipment_mutations FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'laboratory'))
);

-- 6. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.equipment_mutations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.equipment_mutations TO anon;
GRANT DELETE ON public.equipment_mutations TO authenticated;

-- 7. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';`}
                </pre>
              </div>
              <button
                onClick={fetchHistory}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {getText('Retry', 'Coba Lagi')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Time', 'Waktu')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Equipment', 'Barang')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Movement', 'Perpindahan')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('PIC', 'Penanggung Jawab')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Phone Number', 'Nomor HP')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Notes', 'Catatan / Keterangan')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Actions', 'Aksi')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                    <p className="mt-2">{getText('Loading history...', 'Memuat histori...')}</p>
                  </td>
                </tr>
              ) : history.length === 0 && !error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <History className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      {getText('No transfers yet', 'Belum ada perpindahan')}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {getText('Item transfer records will appear here.', 'Catatan perpindahan barang akan muncul di sini.')}
                    </p>
                  </td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1.5 text-gray-400" />
                        {formatDate(record.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="h-4 w-4 mr-2 text-blue-500" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {record.equipment?.name || getText('Custom Description', 'Keterangan Kustom')}
                          </div>
                          <div className={`text-xs ${record.equipment ? 'text-gray-500' : 'text-amber-500 italic'}`}>
                            {record.equipment?.code || getText('Not registered', 'Tidak terdaftar')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">{getText('From', 'Dari')}</span>
                          <span className="text-sm font-medium text-gray-700">
                            {record.previous_room?.name || getText('Unknown', 'Tidak diketahui')}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">{getText('To', 'Ke')}</span>
                          <span className="text-sm font-medium text-blue-700">
                            {record.new_room?.name || getText('Unknown', 'Tidak diketahui')}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1.5 text-gray-400" />
                        <span className="text-sm text-gray-900">{record.pic_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.pic_phone ? (
                        <div className="flex items-center text-sm text-blue-600 hover:text-blue-800">
                          <Phone className="h-4 w-4 mr-1.5" />
                          <a href={`https://wa.me/${record.pic_phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                            {record.pic_phone}
                          </a>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {inlineEditId === record.id ? (
                        <div className="flex items-center space-x-1.5 min-w-[220px]">
                          <input
                            type="text"
                            value={inlineNoteText}
                            onChange={(e) => setInlineNoteText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineNote(record);
                              if (e.key === 'Escape') setInlineEditId(null);
                            }}
                            autoFocus
                            placeholder={getText('Type note/keterangan...', 'Ketik keterangan...')}
                            className="w-full text-xs p-1.5 border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => handleSaveInlineNote(record)}
                            className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex-shrink-0"
                            title={getText('Save Keterangan', 'Simpan Keterangan')}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setInlineEditId(null)}
                            className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex-shrink-0 text-xs font-bold"
                            title={getText('Cancel', 'Batal')}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setInlineEditId(record.id);
                            setInlineNoteText(record.notes || '');
                          }}
                          className="group flex items-center justify-between cursor-pointer p-1.5 rounded-lg hover:bg-blue-50 transition-colors max-w-xs border border-transparent hover:border-blue-200"
                          title={getText('Click to edit note/keterangan', 'Klik untuk edit keterangan')}
                        >
                          <span className={`text-sm ${record.notes ? 'text-gray-800' : 'text-blue-600 font-medium text-xs flex items-center gap-1'}`}>
                            {record.notes ? record.notes : (
                              <>
                                <Plus className="h-3.5 w-3.5 text-blue-500" />
                                {getText('Add Note', 'Tambah Keterangan')}
                              </>
                            )}
                          </span>
                          <Pencil className="h-3.5 w-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditClick(record)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors"
                          title={getText('Edit', 'Edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors"
                          title={getText('Delete', 'Hapus')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="text-lg font-semibold flex items-center">
                <Pencil className="h-5 w-5 mr-2" />
                {getText('Edit Mutation Record', 'Edit Catatan Mutasi')}
              </h3>
              <button 
                onClick={() => setEditingItem(null)} 
                className="text-white hover:text-blue-200 transition-colors focus:outline-none"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  {getText('Equipment', 'Barang')}
                </label>
                <div className="text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded-lg border border-gray-200">
                  {editingItem.equipment ? `${editingItem.equipment.name} (${editingItem.equipment.code})` : getText('Custom Description (Not registered)', 'Keterangan Kustom (Tidak terdaftar)')}
                </div>
              </div>
              
              <div>
                <label htmlFor="edit_pic_name" className="block text-sm font-medium text-gray-700">
                  {getText('PIC Name', 'Nama Penanggung Jawab')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="edit_pic_name"
                  required
                  value={editPicName}
                  onChange={(e) => setEditPicName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="edit_pic_phone" className="block text-sm font-medium text-gray-700">
                  {getText('PIC Phone Number', 'Nomor HP Penanggung Jawab')}
                </label>
                <input
                  type="tel"
                  id="edit_pic_phone"
                  value={editPicPhone}
                  onChange={(e) => setEditPicPhone(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Contoh: 081234567890"
                />
              </div>

              <div>
                <label htmlFor="edit_notes" className="block text-sm font-medium text-gray-700">
                  {getText('Notes', 'Catatan')}
                </label>
                <textarea
                  id="edit_notes"
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none"
                >
                  {getText('Cancel', 'Batal')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 focus:outline-none flex items-center"
                >
                  {isSaving && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  {getText('Save Changes', 'Simpan Perubahan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemHistory;
