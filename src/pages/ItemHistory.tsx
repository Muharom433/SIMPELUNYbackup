import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { Package, History, Copy, CheckCircle, Clock, MapPin, ArrowRight, User, Plus, Phone, AlertTriangle, RefreshCw, Pencil, Trash2, X, Download, Filter, Search, ChevronDown, Check, Tag, Building, DoorClosed, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ItemMutationForm from './ItemMutationForm';
import * as XLSX from 'xlsx';


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

interface DropdownSearchProps {
    items: Array<{ id: string; name?: string; nama?: string; code?: string;[key: string]: any }>;
    selectedItem: { id: string; name?: string; nama?: string;[key: string]: any } | null;
    onSelect: (item: any) => void;
    placeholder: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    className?: string;
    showCode?: boolean;
}

const DropdownSearch: React.FC<DropdownSearchProps> = ({
    items, selectedItem, onSelect, placeholder, searchPlaceholder = 'Search...',
    disabled = false, className = '', showCode = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const filteredItems = items.filter(item => {
        const itemName = item?.name || item?.nama || item?.description || '';
        const itemCode = item?.code || '';
        const search = searchTerm.toLowerCase();
        return itemName.toLowerCase().includes(search) || itemCode.toLowerCase().includes(search);
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedDisplayName = selectedItem?.name || selectedItem?.nama || selectedItem?.description || '';
    const selectedDisplayCode = selectedItem?.code || '';

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-3 py-2.5 h-[42px] text-left bg-white border border-gray-300 rounded-lg shadow-sm flex items-center justify-between transition-all ${disabled ? 'bg-gray-100 text-gray-400' : 'hover:bg-gray-50'}`}
            >
                <div className="flex items-center space-x-2 truncate">
                    {selectedItem ? (
                        <>
                            <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <MapPin className="h-3 w-3 text-blue-600" />
                            </div>
                            <div className="truncate text-sm font-medium text-gray-700">
                                {selectedDisplayName}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Search className="h-3 w-3 text-gray-400" />
                            </div>
                            <span className="text-gray-500 text-sm truncate">{placeholder}</span>
                        </>
                    )}
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ml-1 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-[300px] overflow-auto">
                    <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder={searchPlaceholder}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:border-blue-500 outline-none"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="py-1">
                        <div 
                            className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer text-sm"
                            onClick={() => { onSelect(null); setIsOpen(false); }}
                        >
                            <span className={!selectedItem ? "font-medium text-blue-600" : "text-gray-700"}>Semua Gedung</span>
                            {!selectedItem && <Check className="h-4 w-4 text-blue-600" />}
                        </div>
                        {filteredItems.map(item => (
                            <div
                                key={item.id}
                                onClick={() => { onSelect(item); setIsOpen(false); }}
                                className="flex items-center justify-between p-2 hover:bg-blue-50 cursor-pointer transition-colors text-sm"
                            >
                                <div className="truncate pr-2 text-gray-700">{item.name || item.nama}</div>
                                {selectedItem?.id === item.id && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const ItemHistory = () => {
  const { getText } = useLanguage();
  const [history, setHistory] = useState<MutationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocalMode, setIsLocalMode] = useState(false);

  const [editingItem, setEditingItem] = useState<MutationHistory | null>(null);
  const [editPicName, setEditPicName] = useState('');
  const [editPicPhone, setEditPicPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [buildingFilter, setBuildingFilter] = useState<{id: string, name: string} | null>(null);

  const uniqueBuildings = React.useMemo(() => {
    const buildingsMap = new Map<string, {id: string, name: string}>();
    history.forEach(r => {
        const prevBuilding = (r.previous_room as any)?.building?.name || (r.previous_room as any)?.building_id?.name;
        if (prevBuilding) {
            buildingsMap.set(prevBuilding, { id: prevBuilding, name: prevBuilding });
        }
        const newBuilding = (r.new_room as any)?.building?.name || (r.new_room as any)?.building_id?.name;
        if (newBuilding) {
            buildingsMap.set(newBuilding, { id: newBuilding, name: newBuilding });
        }
    });
    return Array.from(buildingsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [history]);

  const filteredHistory = history.filter(item => {
    if (!buildingFilter) return true;
    const prevBuilding = (item.previous_room as any)?.building?.name || (item.previous_room as any)?.building_id?.name;
    const newBuilding = (item.new_room as any)?.building?.name || (item.new_room as any)?.building_id?.name;
    return prevBuilding === buildingFilter.name || newBuilding === buildingFilter.name;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const handleExportExcel = () => {
    if (sortedHistory.length === 0) {
      toast.error(getText('No data to export', 'Tidak ada data untuk diekspor'));
      return;
    }

    const exportData = sortedHistory.map((item, index) => ({
      'No': index + 1,
      'Waktu': formatDate(item.created_at),
      'Nama Barang': item.equipment?.name || 'Barang Tidak Diketahui',
      'Kode Barang': item.equipment?.code || '-',
      'Dari Ruangan': item.previous_room?.name || 'Tidak diketahui',
      'Ke Ruangan': item.new_room?.name || 'Tidak diketahui',
      'Penanggung Jawab': item.pic_name,
      'No. HP': item.pic_phone || '-',
      'Catatan': item.notes || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Mengatur lebar kolom agar lebih rapi
    worksheet['!cols'] = [
      { wch: 5 },  // A: No
      { wch: 20 }, // B: Waktu
      { wch: 35 }, // C: Nama Barang
      { wch: 25 }, // D: Kode Barang
      { wch: 25 }, // E: Dari Ruangan
      { wch: 25 }, // F: Ke Ruangan
      { wch: 25 }, // G: Penanggung Jawab
      { wch: 15 }, // H: No. HP
      { wch: 45 }  // I: Catatan
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Histori Mutasi');
    XLSX.writeFile(workbook, `Histori_Mutasi_Barang_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

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
        ? `id, pic_name, pic_phone, notes, created_at, equipment:equipment_id(name, code), previous_room:previous_room_id(name, code, building:building_id(name)), new_room:new_room_id(name, code, building:building_id(name))`
        : `id, pic_name, notes, created_at, equipment:equipment_id(name, code), previous_room:previous_room_id(name, code, building:building_id(name)), new_room:new_room_id(name, code, building:building_id(name))`;

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
          ? supabase.from('rooms').select('id, name, code, building:building_id(name)').in('id', roomIds as string[])
          : Promise.resolve({ data: [], error: null }),
      ]);

      // Build lookup maps
      const equipmentMap = new Map((equipmentRes.data || []).map((e: any) => [e.id, { name: e.name, code: e.code }]));
      const roomMap = new Map((roomsRes.data || []).map((r: any) => [r.id, { name: r.name, code: r.code, building: r.building }]));

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                <History className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {getText('Item Transfer History', 'Histori Mutasi Barang')}
                </h1>
                <p className="text-gray-600 mt-1 text-sm max-w-2xl">
                  {getText('Track all equipment movements across rooms', 'Lacak semua perpindahan barang antar ruangan')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleExportExcel}
                className="flex items-center justify-center px-4 h-[42px] bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm text-sm font-medium"
                title={getText('Export to Excel', 'Export ke Excel')}
              >
                <Download className="h-4 w-4 mr-2" />
                {getText('Export', 'Export')}
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center px-4 h-[42px] bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
              >
                <Plus className="h-4 w-4 mr-2" />
                {getText('Add Transfer', 'Tambah Mutasi')}
              </button>
              
              <button
                onClick={handleCopyLink}
                className="flex items-center px-4 h-[42px] bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors shadow-sm text-sm font-medium"
              >
                {copied ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? getText('Copied!', 'Tersalin!') : getText('Form Link', 'Link Form')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8 space-y-6">

      {isLocalMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
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
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div className="flex-1"></div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-[220px]">
            <DropdownSearch
                items={uniqueBuildings}
                selectedItem={buildingFilter}
                onSelect={(item) => setBuildingFilter(item)}
                placeholder={getText('All Buildings', 'Semua Gedung')}
                searchPlaceholder={getText('Search building...', 'Cari gedung...')}
            />
          </div>
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center justify-center w-[42px] h-[42px] bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm"
            title={sortOrder === 'desc' ? getText('Sort: Newest to Oldest', 'Urutkan: Terbaru ke Terlama') : getText('Sort: Oldest to Newest', 'Urutkan: Terlama ke Terbaru')}
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-gray-500">
                {getText(
                    `Showing ${sortedHistory.length} records`,
                    `Menampilkan ${sortedHistory.length} catatan`
                )}
            </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {getText('Time', 'Waktu')}
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {getText('Equipment', 'Barang')}
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {getText('Movement', 'Perpindahan')}
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {getText('PIC', 'Penanggung Jawab')}
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {getText('Notes', 'Catatan / Keterangan')}
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap text-right">
                  {getText('Actions', 'Aksi')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                    <p className="mt-2">{getText('Loading history...', 'Memuat histori...')}</p>
                  </td>
                </tr>
              ) : history.length === 0 && !error ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
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
                sortedHistory.map((record) => (
                  <tr key={record.id} className="border-b border-gray-100 transition-all duration-150 hover:bg-emerald-50/20">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs">{formatDate(record.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
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
                    <td className="px-4 py-3 min-w-[200px] whitespace-nowrap">
                      <div className="flex flex-col gap-2 text-sm text-gray-700">
                        <div className="flex flex-col gap-0.5">
                           <div className="text-xs text-gray-400">{getText('From', 'Dari')}</div>
                           <div className="flex items-center gap-1.5 pl-2">
                             <DoorClosed className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                             <span>{record.previous_room?.name || '-'}</span>
                           </div>
                           {(record.previous_room as any)?.building?.name && (
                             <div className="flex items-center gap-1.5 pl-7">
                               <Building className="h-3 w-3 text-gray-300 flex-shrink-0" />
                               <span className="text-xs text-gray-400">{(record.previous_room as any).building.name}</span>
                             </div>
                           )}
                        </div>
                        <div className="w-full border-b border-gray-100 my-0.5 border-dashed"></div>
                        <div className="flex flex-col gap-0.5">
                           <div className="text-xs text-gray-400">{getText('To', 'Ke')}</div>
                           <div className="flex items-center gap-1.5 pl-2">
                             <DoorClosed className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                             <span className="font-medium text-gray-800">{record.new_room?.name || '-'}</span>
                           </div>
                           {(record.new_room as any)?.building?.name && (
                             <div className="flex items-center gap-1.5 pl-7">
                               <Building className="h-3 w-3 text-gray-300 flex-shrink-0" />
                               <span className="text-xs text-gray-400">{(record.new_room as any).building.name}</span>
                             </div>
                           )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900">{record.pic_name}</span>
                        </div>
                        {record.pic_phone && (
                          <div className="flex items-center text-xs text-blue-600 mt-1 pl-5">
                            <Phone className="h-3 w-3 mr-1" />
                            <a href={`https://wa.me/${record.pic_phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {record.pic_phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-sm text-gray-500" title={record.notes || ''}>
                      {record.notes ? (
                        <div className="flex items-start">
                          <span className="truncate">{record.notes}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">{getText('No notes', 'Tanpa catatan')}</span>
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
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditClick(record)}
                          className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                          title={getText('Edit', 'Edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
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
                <X className="h-5 w-5" />
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

      {/* Add Mutation Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-lg p-1.5">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold leading-tight">
                    {getText('Item Transfer Form', 'Formulir Pemindahan Barang')}
                  </h2>
                  <p className="text-blue-100 text-xs mt-0.5">
                    {getText('Record equipment movement between rooms', 'Catat perpindahan barang antar ruangan')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors focus:outline-none"
                title={getText('Close', 'Tutup')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body — embedded form */}
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <ItemMutationForm
                onSuccess={() => {
                  setShowAddModal(false);
                  fetchHistory();
                }}
                onCancel={() => setShowAddModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemHistory;
