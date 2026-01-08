import React, { useState, useEffect, useMemo } from 'react';
import {
    Building2, Plus, Edit2, Trash2, ChevronDown, ChevronRight, X, Save, DoorOpen,
    Loader2, Table2, MapPin, Search, Eye, Box, Archive,
    Upload, Maximize2, GraduationCap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../hooks/useAuth';
import Swal from 'sweetalert2';

// Types
interface Room {
    id: string;
    name: string;
    code: string;
    capacity: number;
    building_id: string;
    floor: string;
    department_id?: string;
    study_program_ids?: string[]; // Updated to array
    is_available: boolean;
    cabinets?: Cabinet[];
}

interface StudyProgram {
    id: string;
    name: string;
    code: string;
}

interface Cabinet {
    id: string;
    room_id: string;
    description: string;
    rack: string;
    attachments?: string;
    racks?: Rack[];
}

interface Rack {
    id: string;
    name: string;
    table_id: string;
    boxes?: BoxItem[];
}

interface BoxItem {
    id: string;
    name: string;
    description: string;
    rack_id: string;
    attachments?: string;
}

interface StockItem {
    id: string;
    nama: string;
    code: string;
    category: string;
    quantity: number;
    unit: string;
}

const LaboratoryLocationManagement: React.FC = () => {
    const { getText } = useLanguage();
    const { profile } = useAuth();

    // Data States
    const [rooms, setRooms] = useState<Room[]>([]);
    const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]); // Added state
    const [loading, setLoading] = useState(true);

    // Expanded States
    const [expandedRooms, setExpandedRooms] = useState<{ [key: string]: boolean }>({});
    const [expandedCabinets, setExpandedCabinets] = useState<{ [key: string]: boolean }>({});
    const [expandedRacks, setExpandedRacks] = useState<{ [key: string]: boolean }>({});

    // Modal States
    const [showCabinetModal, setShowCabinetModal] = useState(false);
    const [showRackModal, setShowRackModal] = useState(false);
    const [showBoxModal, setShowBoxModal] = useState(false);
    const [showCabinetDetailModal, setShowCabinetDetailModal] = useState(false);
    const [showBoxDetailModal, setShowBoxDetailModal] = useState(false);

    // Editing States
    const [editingCabinet, setEditingCabinet] = useState<Cabinet | null>(null);
    const [editingRack, setEditingRack] = useState<Rack | null>(null);
    const [editingBox, setEditingBox] = useState<BoxItem | null>(null);
    const [selectedCabinetDetail, setSelectedCabinetDetail] = useState<Cabinet | null>(null);
    const [selectedBoxDetail, setSelectedBoxDetail] = useState<BoxItem | null>(null);

    // Form States
    const [selectedRoomId, setSelectedRoomId] = useState<string>('');
    const [selectedCabinetId, setSelectedCabinetId] = useState<string>('');
    const [selectedRackId, setSelectedRackId] = useState<string>('');

    const [cabinetForm, setCabinetForm] = useState({ name: '', description: '', location: '', attachments: '' });
    const [rackForm, setRackForm] = useState({ name: '' });
    const [boxForm, setBoxForm] = useState({ name: '', description: '', attachments: '' });

    // Image Preview States
    const [cabinetImagePreview, setCabinetImagePreview] = useState<string>('');
    const [boxImagePreview, setBoxImagePreview] = useState<string>('');

    // Modal Mode States (manual or claim from stock)
    const [cabinetModalMode, setCabinetModalMode] = useState<'manual' | 'claim'>('manual');
    const [boxModalMode, setBoxModalMode] = useState<'manual' | 'claim'>('manual');

    // Stock States
    const [cabinetStock, setCabinetStock] = useState<StockItem[]>([]);
    const [boxStock, setBoxStock] = useState<StockItem[]>([]);
    const [selectedCabinetStock, setSelectedCabinetStock] = useState<StockItem | null>(null);
    const [selectedBoxStock, setSelectedBoxStock] = useState<StockItem | null>(null);
    const [cabinetClaimQty, setCabinetClaimQty] = useState(1);
    const [boxClaimQty, setBoxClaimQty] = useState(1);

    // Lazy Loading Attachment States
    const [loadingAttachment, setLoadingAttachment] = useState(false);
    const [cabinetAttachment, setCabinetAttachment] = useState<string>('');
    const [boxAttachment, setBoxAttachment] = useState<string>('');

    // Fullscreen Photo
    const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

    // Search
    const [searchTerm, setSearchTerm] = useState('');

    // Check laboran access
    const isLaboratory = profile?.role === 'laboratory';
    const laborDepartmentId = profile?.department_id;
    const laborStudyProgramId = profile?.study_program_id;

    // Fetch data on mount
    useEffect(() => {
        if (isLaboratory && laborDepartmentId) {
            fetchRooms();
            fetchStudyPrograms(); // Fetch study programs
        }
    }, [isLaboratory, laborDepartmentId, laborStudyProgramId]);

    // Fetch study programs
    const fetchStudyPrograms = async () => {
        const { data } = await supabase.from('study_programs').select('id, name, code');
        setStudyPrograms(data || []);
    };

    // Fetch rooms filtered by laboran's department and study program
    const fetchRooms = async () => {
        try {
            setLoading(true);

            // Fetch all rooms - filtering by dept/prodi is done client-side
            let query = supabase
                .from('rooms')
                .select('id, name, code, capacity, building_id, floor, department_id, study_program_ids, is_available')
                .order('name');

            const { data: roomsData, error: roomsError } = await query;
            if (roomsError) throw roomsError;

            // Filter rooms: dept matches OR (dept null but prodi matches)
            let filteredRooms = (roomsData || []).filter(room => {
                const roomDeptId = (room as any).department_id;
                const roomProdiIds = (room as any).study_program_ids || [];

                // Case 1: Department exists and matches user's department -> SHOW
                if (roomDeptId && roomDeptId === laborDepartmentId) {
                    return true;
                }

                // Case 2: Department is null/general BUT study_program_ids includes user's prodi -> SHOW
                if (!roomDeptId && laborStudyProgramId && roomProdiIds.includes(laborStudyProgramId)) {
                    return true;
                }

                // Otherwise -> HIDE
                return false;
            });

            // Fetch cabinets, racks, boxes
            const roomIds = filteredRooms.map(r => r.id);

            if (roomIds.length > 0) {
                const [cabinetsRes, racksRes, boxesRes] = await Promise.all([
                    supabase.from('table').select('id, room_id, description, rack').in('room_id', roomIds),
                    supabase.from('rack').select('id, name, table_id'),
                    supabase.from('box').select('id, name, description, rack_id')
                ]);

                const cabinets = cabinetsRes.data || [];
                const racks = racksRes.data || [];
                const boxes = boxesRes.data || [];

                // Build hierarchy
                const boxesByRack = boxes.reduce((acc: any, box) => {
                    if (!acc[box.rack_id]) acc[box.rack_id] = [];
                    acc[box.rack_id].push(box);
                    return acc;
                }, {});

                const racksWithBoxes = racks.map(rack => ({
                    ...rack,
                    boxes: boxesByRack[rack.id] || []
                }));

                const racksByCabinet = racksWithBoxes.reduce((acc: any, rack) => {
                    if (!acc[rack.table_id]) acc[rack.table_id] = [];
                    acc[rack.table_id].push(rack);
                    return acc;
                }, {});

                const cabinetsWithRacks = cabinets.map(cab => ({
                    ...cab,
                    racks: racksByCabinet[cab.id] || []
                }));

                const cabinetsByRoom = cabinetsWithRacks.reduce((acc: any, cab) => {
                    if (!acc[cab.room_id]) acc[cab.room_id] = [];
                    acc[cab.room_id].push(cab);
                    return acc;
                }, {});

                filteredRooms = filteredRooms.map(room => ({
                    ...room,
                    cabinets: cabinetsByRoom[room.id] || []
                }));
            }

            setRooms(filteredRooms);
        } catch (error) {
            console.error('Error fetching rooms:', error);
            Swal.fire('Error', getText('Failed to load data', 'Gagal memuat data'), 'error');
        } finally {
            setLoading(false);
        }
    };

    // Fetch cabinet stock
    const fetchCabinetStock = async () => {
        const { data } = await supabase
            .from('stock')
            .select('*')
            .or('category.ilike.%cabinet%,category.ilike.%almari%,category.ilike.%lemari%')
            .gt('quantity', 0)
            .order('nama');
        setCabinetStock(data || []);
    };

    // Fetch box stock
    const fetchBoxStock = async () => {
        const { data } = await supabase
            .from('stock')
            .select('*')
            .ilike('category', '%box%')
            .gt('quantity', 0)
            .order('nama');
        setBoxStock(data || []);
    };

    // Fetch cabinet attachment
    const fetchCabinetAttachment = async (cabinetId: string) => {
        setLoadingAttachment(true);
        setCabinetAttachment('');
        const { data } = await supabase.from('table').select('attachments').eq('id', cabinetId).single();
        setCabinetAttachment(data?.attachments || '');
        setLoadingAttachment(false);
    };

    // Fetch box attachment
    const fetchBoxAttachment = async (boxId: string) => {
        setLoadingAttachment(true);
        setBoxAttachment('');
        const { data } = await supabase.from('box').select('attachments').eq('id', boxId).single();
        setBoxAttachment(data?.attachments || '');
        setLoadingAttachment(false);
    };

    // Handle image upload to base64
    const handleImageChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        setForm: (fn: (prev: any) => any) => void,
        setPreview: (val: string) => void
    ) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                Swal.fire('Warning', getText('Please select an image file', 'Pilih file gambar'), 'warning');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                Swal.fire('Warning', getText('Image size must be less than 5MB', 'Ukuran gambar maksimal 5MB'), 'warning');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                setForm(prev => ({ ...prev, attachments: base64 }));
                setPreview(base64);
            };
            reader.readAsDataURL(file);
        }
    };

    // Filtered rooms based on search
    const filteredRooms = useMemo(() => {
        if (!searchTerm) return rooms;
        const lower = searchTerm.toLowerCase();
        return rooms.filter(r =>
            r.name.toLowerCase().includes(lower) ||
            r.code.toLowerCase().includes(lower)
        );
    }, [rooms, searchTerm]);

    // Access check
    if (!isLaboratory) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
                <div className="text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <X className="h-10 w-10 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">{getText('Access Denied', 'Akses Ditolak')}</h2>
                    <p className="text-gray-500">{getText('This page is only for Laboratory staff', 'Halaman ini hanya untuk Laboran')}</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    // Reset forms
    const resetCabinetForm = () => {
        setCabinetForm({ name: '', description: '', location: '', attachments: '' });
        setCabinetImagePreview('');
        setEditingCabinet(null);
        setCabinetModalMode('manual');
        setSelectedCabinetStock(null);
        setCabinetClaimQty(1);
    };

    const resetBoxForm = () => {
        setBoxForm({ name: '', description: '', attachments: '' });
        setBoxImagePreview('');
        setEditingBox(null);
        setBoxModalMode('manual');
        setSelectedBoxStock(null);
        setBoxClaimQty(1);
    };

    // Parse cabinet name
    const parseCabinetName = (description: string) => {
        const parts = (description || '').split(' | ');
        return { name: parts[0] || 'Cabinet', desc: parts.length > 1 ? parts.slice(1).join(' | ') : null };
    };

    // Save Cabinet
    const saveCabinet = async () => {
        if (cabinetModalMode === 'manual') {
            if (!cabinetForm.name.trim()) {
                Swal.fire('Warning', getText('Please enter cabinet name', 'Masukkan nama kabinet'), 'warning');
                return;
            }
            try {
                const combinedDesc = cabinetForm.description
                    ? `${cabinetForm.name.trim()} | ${cabinetForm.description.trim()}`
                    : cabinetForm.name.trim();

                if (editingCabinet) {
                    await supabase.from('table').update({
                        description: combinedDesc,
                        rack: cabinetForm.location,
                        attachments: cabinetForm.attachments || null
                    }).eq('id', editingCabinet.id);
                } else {
                    await supabase.from('table').insert([{
                        description: combinedDesc,
                        rack: cabinetForm.location,
                        room_id: selectedRoomId,
                        attachments: cabinetForm.attachments || null
                    }]);
                }
                setShowCabinetModal(false);
                resetCabinetForm();
                fetchRooms();
                Swal.fire({ icon: 'success', title: getText('Saved!', 'Tersimpan!'), timer: 1500, showConfirmButton: false });
            } catch (e) {
                console.error(e);
                Swal.fire('Error', getText('Failed to save cabinet', 'Gagal menyimpan kabinet'), 'error');
            }
        } else {
            if (!selectedCabinetStock) {
                Swal.fire('Warning', getText('Please select a stock item', 'Pilih item stock'), 'warning');
                return;
            }
            try {
                const entries = [];
                for (let i = 0; i < cabinetClaimQty; i++) {
                    entries.push({
                        description: cabinetClaimQty > 1 ? `${selectedCabinetStock.nama} #${i + 1}` : selectedCabinetStock.nama,
                        rack: cabinetForm.location,
                        room_id: selectedRoomId,
                        attachments: cabinetForm.attachments || null
                    });
                }
                await supabase.from('table').insert(entries);
                await supabase.from('stock').update({ quantity: selectedCabinetStock.quantity - cabinetClaimQty }).eq('id', selectedCabinetStock.id);
                setShowCabinetModal(false);
                resetCabinetForm();
                fetchRooms();
                Swal.fire({ icon: 'success', title: getText('Cabinet claimed!', 'Kabinet diambil!'), timer: 1500, showConfirmButton: false });
            } catch (e) {
                console.error(e);
                Swal.fire('Error', getText('Failed to claim cabinet', 'Gagal mengambil kabinet'), 'error');
            }
        }
    };

    // Save Rack
    const saveRack = async () => {
        if (!rackForm.name.trim()) {
            Swal.fire('Warning', getText('Please enter rack name', 'Masukkan nama rak'), 'warning');
            return;
        }
        try {
            if (editingRack) {
                await supabase.from('rack').update({ name: rackForm.name.trim() }).eq('id', editingRack.id);
            } else {
                await supabase.from('rack').insert([{ name: rackForm.name.trim(), table_id: selectedCabinetId }]);
            }
            setShowRackModal(false);
            setRackForm({ name: '' });
            setEditingRack(null);
            fetchRooms();
            Swal.fire({ icon: 'success', title: getText('Saved!', 'Tersimpan!'), timer: 1500, showConfirmButton: false });
        } catch (e) {
            console.error(e);
            Swal.fire('Error', getText('Failed to save rack', 'Gagal menyimpan rak'), 'error');
        }
    };

    // Save Box
    const saveBox = async () => {
        if (boxModalMode === 'manual') {
            if (!boxForm.name.trim()) {
                Swal.fire('Warning', getText('Please enter box name', 'Masukkan nama box'), 'warning');
                return;
            }
            try {
                if (editingBox) {
                    await supabase.from('box').update({
                        name: boxForm.name.trim(),
                        description: boxForm.description,
                        attachments: boxForm.attachments || null
                    }).eq('id', editingBox.id);
                } else {
                    await supabase.from('box').insert([{
                        name: boxForm.name.trim(),
                        description: boxForm.description,
                        rack_id: selectedRackId,
                        attachments: boxForm.attachments || null
                    }]);
                }
                setShowBoxModal(false);
                resetBoxForm();
                fetchRooms();
                Swal.fire({ icon: 'success', title: getText('Saved!', 'Tersimpan!'), timer: 1500, showConfirmButton: false });
            } catch (e) {
                console.error(e);
                Swal.fire('Error', getText('Failed to save box', 'Gagal menyimpan box'), 'error');
            }
        } else {
            if (!selectedBoxStock) {
                Swal.fire('Warning', getText('Please select a stock item', 'Pilih item stock'), 'warning');
                return;
            }
            try {
                const entries = [];
                for (let i = 0; i < boxClaimQty; i++) {
                    entries.push({
                        name: boxClaimQty > 1 ? `${selectedBoxStock.nama} #${i + 1}` : selectedBoxStock.nama,
                        description: `${selectedBoxStock.code} - Claimed from stock`,
                        rack_id: selectedRackId,
                        attachments: boxForm.attachments || null
                    });
                }
                await supabase.from('box').insert(entries);
                await supabase.from('stock').update({ quantity: selectedBoxStock.quantity - boxClaimQty }).eq('id', selectedBoxStock.id);
                setShowBoxModal(false);
                resetBoxForm();
                fetchRooms();
                Swal.fire({ icon: 'success', title: getText('Box claimed!', 'Box diambil!'), timer: 1500, showConfirmButton: false });
            } catch (e) {
                console.error(e);
                Swal.fire('Error', getText('Failed to claim box', 'Gagal mengambil box'), 'error');
            }
        }
    };

    // Delete handlers
    const deleteCabinet = async (id: string) => {
        const result = await Swal.fire({ title: getText('Delete Cabinet?', 'Hapus Kabinet?'), text: getText('All racks and boxes inside will be deleted!', 'Semua rak dan box di dalamnya akan terhapus!'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
        if (result.isConfirmed) {
            await supabase.from('table').delete().eq('id', id);
            fetchRooms();
            Swal.fire({ icon: 'success', title: getText('Deleted!', 'Terhapus!'), timer: 1500, showConfirmButton: false });
        }
    };

    const deleteRack = async (id: string) => {
        const result = await Swal.fire({ title: getText('Delete Rack?', 'Hapus Rak?'), text: getText('All boxes inside will be deleted!', 'Semua box di dalamnya akan terhapus!'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
        if (result.isConfirmed) {
            await supabase.from('rack').delete().eq('id', id);
            fetchRooms();
            Swal.fire({ icon: 'success', title: getText('Deleted!', 'Terhapus!'), timer: 1500, showConfirmButton: false });
        }
    };

    const deleteBox = async (id: string) => {
        const result = await Swal.fire({ title: getText('Delete Box?', 'Hapus Box?'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
        if (result.isConfirmed) {
            await supabase.from('box').delete().eq('id', id);
            fetchRooms();
            Swal.fire({ icon: 'success', title: getText('Deleted!', 'Terhapus!'), timer: 1500, showConfirmButton: false });
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                                <Building2 className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{getText('Laboratory Location Management', 'Manajemen Lokasi Laboratorium')}</h1>
                                <p className="text-gray-500 text-sm flex items-center gap-2 mt-1">
                                    <GraduationCap className="h-4 w-4" />
                                    {getText('Manage cabinets, racks, and boxes for your study program', 'Kelola kabinet, rak, dan box untuk program studi Anda')}
                                </p>
                            </div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={getText('Search rooms...', 'Cari ruangan...')} className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white/80 w-64 transition-all" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                            <div className="flex items-center gap-2 text-blue-600 mb-1"><DoorOpen className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">{getText('Rooms', 'Ruangan')}</span></div>
                            <p className="text-2xl font-bold text-blue-700">{rooms.length}</p>
                        </div>
                        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
                            <div className="flex items-center gap-2 text-violet-600 mb-1"><Table2 className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">{getText('Cabinets', 'Kabinet')}</span></div>
                            <p className="text-2xl font-bold text-violet-700">{rooms.reduce((acc, r) => acc + (r.cabinets?.length || 0), 0)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                            <div className="flex items-center gap-2 text-amber-600 mb-1"><Archive className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">{getText('Racks', 'Rak')}</span></div>
                            <p className="text-2xl font-bold text-amber-700">{rooms.reduce((acc, r) => acc + (r.cabinets?.reduce((a, c) => a + (c.racks?.length || 0), 0) || 0), 0)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                            <div className="flex items-center gap-2 text-emerald-600 mb-1"><Box className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">{getText('Boxes', 'Box')}</span></div>
                            <p className="text-2xl font-bold text-emerald-700">{rooms.reduce((acc, r) => acc + (r.cabinets?.reduce((a, c) => a + (c.racks?.reduce((b, rk) => b + (rk.boxes?.length || 0), 0) || 0), 0) || 0), 0)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rooms List */}
            <div className="max-w-7xl mx-auto space-y-4">
                {filteredRooms.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                        <DoorOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">{getText('No Rooms Found', 'Tidak Ada Ruangan')}</h3>
                        <p className="text-gray-500 text-sm">{getText('No rooms are assigned to your study program yet.', 'Belum ada ruangan yang ditetapkan untuk program studi Anda.')}</p>
                    </div>
                ) : (
                    filteredRooms.map(room => (
                        <div key={room.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                            <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedRooms(prev => ({ ...prev, [room.id]: !prev[room.id] }))}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${room.is_available ? 'bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600' : 'bg-gradient-to-br from-red-100 to-rose-100 text-red-600'}`}><DoorOpen className="h-6 w-6" /></div>
                                    <div>
                                        <div className="flex items-center gap-2"><h3 className="font-bold text-gray-900">{room.name}</h3><span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-md font-mono font-bold">{room.code}</span></div>
                                        <p className="text-sm text-gray-500">{room.floor} • {room.cabinets?.length || 0} {getText('Cabinets', 'Kabinet')}</p>
                                        {room.study_program_ids && room.study_program_ids.length > 0 && (
                                            <div className="flex items-start text-xs text-blue-600 mt-1">
                                                <GraduationCap className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                                                <span className="line-clamp-1">
                                                    {room.study_program_ids.map(id => studyPrograms.find(sp => sp.id === id)?.name || '').filter(Boolean).join(', ')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); setSelectedRoomId(room.id); resetCabinetForm(); setShowCabinetModal(true); }} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"><Plus className="h-4 w-4" />{getText('Add Cabinet', 'Tambah Kabinet')}</button>
                                    {expandedRooms[room.id] ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                                </div>
                            </div>
                            {expandedRooms[room.id] && (
                                <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                                    {room.cabinets && room.cabinets.length > 0 ? (
                                        <div className="space-y-3">
                                            {room.cabinets.map(cabinet => {
                                                const { name, desc } = parseCabinetName(cabinet.description);
                                                return (
                                                    <div key={cabinet.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-indigo-300 transition-all">
                                                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => setExpandedCabinets(prev => ({ ...prev, [cabinet.id]: !prev[cabinet.id] }))}>
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg flex items-center justify-center text-indigo-600"><Table2 className="h-5 w-5" /></div>
                                                                <div>
                                                                    <h4 className="font-semibold text-gray-900">{name}</h4>
                                                                    {desc && <p className="text-xs text-gray-500">{desc}</p>}
                                                                    {cabinet.rack && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" /> {cabinet.rack}</p>}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-gray-500">{cabinet.racks?.length || 0} {getText('Racks', 'Rak')}</span>
                                                                <button onClick={(e) => { e.stopPropagation(); setSelectedCabinetDetail(cabinet); fetchCabinetAttachment(cabinet.id); setShowCabinetDetailModal(true); }} className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg"><Eye className="h-4 w-4" /></button>
                                                                <button onClick={async (e) => { e.stopPropagation(); const { name: n, desc: d } = parseCabinetName(cabinet.description); setEditingCabinet(cabinet); setCabinetForm({ name: n, description: d || '', location: cabinet.rack || '', attachments: '' }); setCabinetImagePreview(''); setSelectedRoomId(cabinet.room_id); setShowCabinetModal(true); const { data } = await supabase.from('table').select('attachments').eq('id', cabinet.id).single(); if (data?.attachments) { setCabinetForm(prev => ({ ...prev, attachments: data.attachments })); setCabinetImagePreview(data.attachments); } }} className="p-1.5 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-lg"><Edit2 className="h-4 w-4" /></button>
                                                                <button onClick={(e) => { e.stopPropagation(); deleteCabinet(cabinet.id); }} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                                                                {expandedCabinets[cabinet.id] ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                                                            </div>
                                                        </div>
                                                        {expandedCabinets[cabinet.id] && (
                                                            <div className="border-t border-gray-100 bg-slate-50/50 p-3">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5"><Archive className="h-3.5 w-3.5 text-amber-500" />{getText('Racks', 'Rak')}</span>
                                                                    <button onClick={() => { setSelectedCabinetId(cabinet.id); setRackForm({ name: '' }); setEditingRack(null); setShowRackModal(true); }} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"><Plus className="h-3.5 w-3.5" />{getText('Add Rack', 'Tambah Rak')}</button>
                                                                </div>
                                                                {cabinet.racks && cabinet.racks.length > 0 ? (
                                                                    <div className="space-y-2">
                                                                        {cabinet.racks.map(rack => (
                                                                            <div key={rack.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                                                <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => setExpandedRacks(prev => ({ ...prev, [rack.id]: !prev[rack.id] }))}>
                                                                                    <div className="flex items-center gap-2"><Archive className="h-4 w-4 text-amber-500" /><span className="font-medium text-gray-800 text-sm">{rack.name}</span><span className="text-xs text-gray-400">({rack.boxes?.length || 0} {getText('boxes', 'box')})</span></div>
                                                                                    <div className="flex items-center gap-1">
                                                                                        <button onClick={(e) => { e.stopPropagation(); setEditingRack(rack); setRackForm({ name: rack.name }); setSelectedCabinetId(cabinet.id); setShowRackModal(true); }} className="p-1 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded"><Edit2 className="h-3.5 w-3.5" /></button>
                                                                                        <button onClick={(e) => { e.stopPropagation(); deleteRack(rack.id); }} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                                                                                        {expandedRacks[rack.id] ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                                                                                    </div>
                                                                                </div>
                                                                                {expandedRacks[rack.id] && (
                                                                                    <div className="border-t border-gray-100 bg-emerald-50/30 p-3">
                                                                                        <div className="flex items-center justify-between mb-2">
                                                                                            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5"><Box className="h-3 w-3 text-emerald-500" />{getText('Boxes', 'Box')}</span>
                                                                                            <button onClick={() => { setSelectedRackId(rack.id); resetBoxForm(); setShowBoxModal(true); }} className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"><Plus className="h-3 w-3" />{getText('Add Box', 'Tambah Box')}</button>
                                                                                        </div>
                                                                                        {rack.boxes && rack.boxes.length > 0 ? (
                                                                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                                                                {rack.boxes.map(box => (
                                                                                                    <div key={box.id} className="bg-white rounded-lg border border-gray-200 p-2.5 hover:border-emerald-300 transition-all group">
                                                                                                        <div className="flex items-start justify-between gap-1">
                                                                                                            <div className="flex items-center gap-2 min-w-0"><Box className="h-4 w-4 text-emerald-500 shrink-0" /><span className="text-sm font-medium text-gray-800 truncate">{box.name}</span></div>
                                                                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                                                <button onClick={() => { setSelectedBoxDetail(box); fetchBoxAttachment(box.id); setShowBoxDetailModal(true); }} className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded"><Eye className="h-3 w-3" /></button>
                                                                                                                <button onClick={async () => { setEditingBox(box); setBoxForm({ name: box.name, description: box.description || '', attachments: '' }); setBoxImagePreview(''); setSelectedRackId(rack.id); setShowBoxModal(true); const { data } = await supabase.from('box').select('attachments').eq('id', box.id).single(); if (data?.attachments) { setBoxForm(prev => ({ ...prev, attachments: data.attachments })); setBoxImagePreview(data.attachments); } }} className="p-1 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded"><Edit2 className="h-3 w-3" /></button>
                                                                                                                <button onClick={() => deleteBox(box.id)} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded"><Trash2 className="h-3 w-3" /></button>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        {box.description && <p className="text-xs text-gray-400 mt-1 truncate">{box.description}</p>}
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        ) : <p className="text-xs text-gray-400 italic text-center py-3">{getText('No boxes yet', 'Belum ada box')}</p>}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : <p className="text-xs text-gray-400 italic text-center py-4">{getText('No racks yet', 'Belum ada rak')}</p>}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : <p className="text-gray-400 italic text-center py-6">{getText('No cabinets yet. Add your first cabinet!', 'Belum ada kabinet. Tambah kabinet pertama!')}</p>}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Cabinet Modal */}
            {showCabinetModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Table2 className="h-5 w-5" />
                                <h3 className="font-bold text-lg">{editingCabinet ? getText('Edit Cabinet', 'Edit Kabinet') : getText('New Cabinet', 'Kabinet Baru')}</h3>
                            </div>
                            <button onClick={() => { setShowCabinetModal(false); resetCabinetForm(); }} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
                        </div>
                        {!editingCabinet && (
                            <div className="flex border-b border-gray-100">
                                <button onClick={() => setCabinetModalMode('manual')} className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${cabinetModalMode === 'manual' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>{getText('Manual Entry', 'Input Manual')}</button>
                                <button onClick={() => { setCabinetModalMode('claim'); fetchCabinetStock(); }} className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${cabinetModalMode === 'claim' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>{getText('Claim from Stock', 'Ambil dari Stock')}</button>
                            </div>
                        )}
                        <div className="p-6 space-y-4">
                            {cabinetModalMode === 'manual' ? (
                                <>
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Name', 'Nama')} <span className="text-red-500">*</span></label>
                                        <input type="text" value={cabinetForm.name} onChange={e => setCabinetForm({ ...cabinetForm, name: e.target.value })} placeholder="e.g. Cabinet A1" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-gray-50 focus:bg-white transition-all" autoFocus />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Description', 'Deskripsi')}</label>
                                        <textarea value={cabinetForm.description} onChange={e => setCabinetForm({ ...cabinetForm, description: e.target.value })} placeholder={getText('Additional notes...', 'Catatan tambahan...')} rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-gray-50 focus:bg-white transition-all resize-none" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Location', 'Lokasi')}</label>
                                        <input type="text" value={cabinetForm.location} onChange={e => setCabinetForm({ ...cabinetForm, location: e.target.value })} placeholder="e.g. Corner A, Near Window" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-gray-50 focus:bg-white transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Cabinet Photo', 'Foto Kabinet')}</label>
                                        {cabinetImagePreview ? (
                                            <div className="relative">
                                                <img src={cabinetImagePreview} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                                                <button type="button" onClick={() => { setCabinetForm({ ...cabinetForm, attachments: '' }); setCabinetImagePreview(''); }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"><X className="h-4 w-4" /></button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all">
                                                <Upload className="h-6 w-6 text-gray-400 mb-1" />
                                                <p className="text-xs text-indigo-600">{getText('Click to upload', 'Klik untuk upload')}</p>
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, setCabinetForm, setCabinetImagePreview)} />
                                            </label>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm text-indigo-800">
                                        <p>{getText('Select cabinet from stock', 'Pilih kabinet dari stock')}</p>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-100 rounded-xl p-2 bg-gray-50">
                                        {cabinetStock.length > 0 ? cabinetStock.map(stock => (
                                            <div key={stock.id} onClick={() => { setSelectedCabinetStock(stock); setCabinetClaimQty(1); }} className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedCabinetStock?.id === stock.id ? 'bg-indigo-100 border-indigo-300' : 'bg-white border-gray-100 hover:border-indigo-200'}`}>
                                                <div className="flex items-center justify-between">
                                                    <div><div className="font-semibold text-gray-800">{stock.nama}</div><div className="text-xs text-gray-500">{stock.code} • {stock.category}</div></div>
                                                    <div className="text-right"><div className="text-sm font-bold text-indigo-600">{stock.quantity} {stock.unit}</div></div>
                                                </div>
                                            </div>
                                        )) : <p className="text-center py-8 text-gray-400 text-sm">{getText('No cabinet stock available', 'Tidak ada stock kabinet')}</p>}
                                    </div>
                                    {selectedCabinetStock && (
                                        <>
                                            <div>
                                                <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Quantity', 'Jumlah')}</label>
                                                <input type="number" min={1} max={selectedCabinetStock.quantity} value={cabinetClaimQty} onChange={e => setCabinetClaimQty(Math.min(Math.max(1, parseInt(e.target.value) || 1), selectedCabinetStock.quantity))} className="w-24 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-gray-50 focus:bg-white transition-all text-center font-bold" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Location', 'Lokasi')}</label>
                                                <input type="text" value={cabinetForm.location} onChange={e => setCabinetForm({ ...cabinetForm, location: e.target.value })} placeholder="e.g. Corner A" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-gray-50 focus:bg-white transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Photo', 'Foto')}</label>
                                                {cabinetImagePreview ? (
                                                    <div className="relative">
                                                        <img src={cabinetImagePreview} alt="Preview" className="w-full h-24 object-cover rounded-xl border border-gray-200" />
                                                        <button type="button" onClick={() => { setCabinetForm({ ...cabinetForm, attachments: '' }); setCabinetImagePreview(''); }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"><X className="h-3 w-3" /></button>
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all">
                                                        <Upload className="h-5 w-5 text-gray-400" />
                                                        <p className="text-xs text-indigo-600 mt-1">{getText('Click to upload', 'Klik untuk upload')}</p>
                                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, setCabinetForm, setCabinetImagePreview)} />
                                                    </label>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                            {editingCabinet ? <button onClick={() => deleteCabinet(editingCabinet.id)} className="px-3 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg flex items-center gap-1.5 text-sm"><Trash2 className="h-4 w-4" />{getText('Delete', 'Hapus')}</button> : <div />}
                            <div className="flex gap-2">
                                <button onClick={() => { setShowCabinetModal(false); resetCabinetForm(); }} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">{getText('Cancel', 'Batal')}</button>
                                <button onClick={saveCabinet} disabled={cabinetModalMode === 'claim' && !selectedCabinetStock} className="px-5 py-2 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600 disabled:opacity-50 shadow-sm flex items-center gap-1.5"><Save className="h-4 w-4" />{cabinetModalMode === 'claim' ? getText('Claim', 'Ambil') : getText('Save', 'Simpan')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rack Modal */}
            {showRackModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2"><Archive className="h-5 w-5" /><h3 className="font-bold text-lg">{editingRack ? getText('Edit Rack', 'Edit Rak') : getText('New Rack', 'Rak Baru')}</h3></div>
                            <button onClick={() => { setShowRackModal(false); setEditingRack(null); }} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-6">
                            <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Rack Name', 'Nama Rak')} <span className="text-red-500">*</span></label>
                            <input type="text" value={rackForm.name} onChange={e => setRackForm({ name: e.target.value })} placeholder="e.g. Rack 1, Shelf A" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-gray-50 focus:bg-white transition-all" autoFocus />
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                            {editingRack ? <button onClick={() => deleteRack(editingRack.id)} className="px-3 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg flex items-center gap-1.5 text-sm"><Trash2 className="h-4 w-4" />{getText('Delete', 'Hapus')}</button> : <div />}
                            <div className="flex gap-2">
                                <button onClick={() => { setShowRackModal(false); setEditingRack(null); }} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">{getText('Cancel', 'Batal')}</button>
                                <button onClick={saveRack} className="px-5 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 shadow-sm flex items-center gap-1.5"><Save className="h-4 w-4" />{getText('Save', 'Simpan')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Box Modal */}
            {showBoxModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2"><Box className="h-5 w-5" /><h3 className="font-bold text-lg">{editingBox ? getText('Edit Box', 'Edit Box') : getText('New Box', 'Box Baru')}</h3></div>
                            <button onClick={() => { setShowBoxModal(false); resetBoxForm(); }} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
                        </div>
                        {!editingBox && (
                            <div className="flex border-b border-gray-100">
                                <button onClick={() => setBoxModalMode('manual')} className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${boxModalMode === 'manual' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>{getText('Manual Entry', 'Input Manual')}</button>
                                <button onClick={() => { setBoxModalMode('claim'); fetchBoxStock(); }} className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${boxModalMode === 'claim' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>{getText('Claim from Stock', 'Ambil dari Stock')}</button>
                            </div>
                        )}
                        <div className="p-6 space-y-4">
                            {boxModalMode === 'manual' ? (
                                <>
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Name', 'Nama')} <span className="text-red-500">*</span></label>
                                        <input type="text" value={boxForm.name} onChange={e => setBoxForm({ ...boxForm, name: e.target.value })} placeholder="e.g. Box A1" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-gray-50 focus:bg-white transition-all" autoFocus />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Description', 'Deskripsi')}</label>
                                        <textarea value={boxForm.description} onChange={e => setBoxForm({ ...boxForm, description: e.target.value })} placeholder={getText('Contents or notes...', 'Isi atau catatan...')} rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-gray-50 focus:bg-white transition-all resize-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Box Photo', 'Foto Box')}</label>
                                        {boxImagePreview ? (
                                            <div className="relative">
                                                <img src={boxImagePreview} alt="Preview" className="w-full h-28 object-cover rounded-xl border border-gray-200" />
                                                <button type="button" onClick={() => { setBoxForm({ ...boxForm, attachments: '' }); setBoxImagePreview(''); }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"><X className="h-4 w-4" /></button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-all">
                                                <Upload className="h-5 w-5 text-gray-400 mb-1" />
                                                <p className="text-xs text-emerald-600">{getText('Click to upload', 'Klik untuk upload')}</p>
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, setBoxForm, setBoxImagePreview)} />
                                            </label>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-800">
                                        <p>{getText('Select box from stock', 'Pilih box dari stock')}</p>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-100 rounded-xl p-2 bg-gray-50">
                                        {boxStock.length > 0 ? boxStock.map(stock => (
                                            <div key={stock.id} onClick={() => { setSelectedBoxStock(stock); setBoxClaimQty(1); }} className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedBoxStock?.id === stock.id ? 'bg-emerald-100 border-emerald-300' : 'bg-white border-gray-100 hover:border-emerald-200'}`}>
                                                <div className="flex items-center justify-between">
                                                    <div><div className="font-semibold text-gray-800">{stock.nama}</div><div className="text-xs text-gray-500">{stock.code} • {stock.category}</div></div>
                                                    <div className="text-sm font-bold text-emerald-600">{stock.quantity} {stock.unit}</div>
                                                </div>
                                            </div>
                                        )) : <p className="text-center py-8 text-gray-400 text-sm">{getText('No box stock available', 'Tidak ada stock box')}</p>}
                                    </div>
                                    {selectedBoxStock && (
                                        <>
                                            <div>
                                                <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Quantity', 'Jumlah')}</label>
                                                <input type="number" min={1} max={selectedBoxStock.quantity} value={boxClaimQty} onChange={e => setBoxClaimQty(Math.min(Math.max(1, parseInt(e.target.value) || 1), selectedBoxStock.quantity))} className="w-24 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-gray-50 focus:bg-white transition-all text-center font-bold" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Photo', 'Foto')}</label>
                                                {boxImagePreview ? (
                                                    <div className="relative">
                                                        <img src={boxImagePreview} alt="Preview" className="w-full h-20 object-cover rounded-xl border border-gray-200" />
                                                        <button type="button" onClick={() => { setBoxForm({ ...boxForm, attachments: '' }); setBoxImagePreview(''); }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"><X className="h-3 w-3" /></button>
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-all">
                                                        <Upload className="h-4 w-4 text-gray-400" />
                                                        <p className="text-xs text-emerald-600 mt-1">{getText('Click to upload', 'Klik untuk upload')}</p>
                                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, setBoxForm, setBoxImagePreview)} />
                                                    </label>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                            {editingBox ? <button onClick={() => deleteBox(editingBox.id)} className="px-3 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg flex items-center gap-1.5 text-sm"><Trash2 className="h-4 w-4" />{getText('Delete', 'Hapus')}</button> : <div />}
                            <div className="flex gap-2">
                                <button onClick={() => { setShowBoxModal(false); resetBoxForm(); }} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">{getText('Cancel', 'Batal')}</button>
                                <button onClick={saveBox} disabled={boxModalMode === 'claim' && !selectedBoxStock} className="px-5 py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 shadow-sm flex items-center gap-1.5"><Save className="h-4 w-4" />{boxModalMode === 'claim' ? getText('Claim', 'Ambil') : getText('Save', 'Simpan')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cabinet Detail Modal */}
            {showCabinetDetailModal && selectedCabinetDetail && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2"><Table2 className="h-5 w-5" /><h3 className="font-bold text-lg">{getText('Cabinet Details', 'Detail Kabinet')}</h3></div>
                            <button onClick={() => setShowCabinetDetailModal(false)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {loadingAttachment ? (
                                <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
                            ) : cabinetAttachment ? (
                                <div className="relative rounded-xl overflow-hidden cursor-pointer" onClick={() => setFullscreenPhoto(cabinetAttachment)}>
                                    <img src={cabinetAttachment} alt="Cabinet" className="w-full h-48 object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                                    <div className="absolute bottom-2 right-2 p-1.5 bg-white/20 rounded-lg backdrop-blur-sm"><Maximize2 className="h-4 w-4 text-white" /></div>
                                </div>
                            ) : (
                                <div className="bg-indigo-50 rounded-xl p-8 text-center"><Table2 className="h-12 w-12 text-indigo-300 mx-auto mb-2" /><p className="text-indigo-600 text-sm">{getText('No photo available', 'Tidak ada foto')}</p></div>
                            )}
                            <div className="bg-gray-50 rounded-xl p-4">
                                <h4 className="font-bold text-gray-900 mb-1">{parseCabinetName(selectedCabinetDetail.description).name}</h4>
                                {parseCabinetName(selectedCabinetDetail.description).desc && <p className="text-gray-600 text-sm mb-2">{parseCabinetName(selectedCabinetDetail.description).desc}</p>}
                                {selectedCabinetDetail.rack && <p className="text-gray-500 text-sm flex items-center gap-1"><MapPin className="h-4 w-4" /> {selectedCabinetDetail.rack}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-amber-50 rounded-xl p-3 text-center"><Archive className="h-5 w-5 text-amber-500 mx-auto mb-1" /><p className="text-lg font-bold text-amber-700">{selectedCabinetDetail.racks?.length || 0}</p><p className="text-xs text-amber-600">{getText('Racks', 'Rak')}</p></div>
                                <div className="bg-emerald-50 rounded-xl p-3 text-center"><Box className="h-5 w-5 text-emerald-500 mx-auto mb-1" /><p className="text-lg font-bold text-emerald-700">{selectedCabinetDetail.racks?.reduce((a, r) => a + (r.boxes?.length || 0), 0) || 0}</p><p className="text-xs text-emerald-600">{getText('Boxes', 'Box')}</p></div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button onClick={() => setShowCabinetDetailModal(false)} className="px-5 py-2 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600 shadow-sm">{getText('Close', 'Tutup')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Box Detail Modal */}
            {showBoxDetailModal && selectedBoxDetail && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2"><Box className="h-5 w-5" /><h3 className="font-bold text-lg">{getText('Box Details', 'Detail Box')}</h3></div>
                            <button onClick={() => setShowBoxDetailModal(false)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {loadingAttachment ? (
                                <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
                            ) : boxAttachment ? (
                                <div className="relative rounded-xl overflow-hidden cursor-pointer" onClick={() => setFullscreenPhoto(boxAttachment)}>
                                    <img src={boxAttachment} alt="Box" className="w-full h-40 object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                                    <div className="absolute bottom-2 right-2 p-1.5 bg-white/20 rounded-lg backdrop-blur-sm"><Maximize2 className="h-4 w-4 text-white" /></div>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 rounded-xl p-8 text-center"><Box className="h-12 w-12 text-emerald-300 mx-auto mb-2" /><p className="text-emerald-600 text-sm">{getText('No photo available', 'Tidak ada foto')}</p></div>
                            )}
                            <div className="bg-gray-50 rounded-xl p-4">
                                <h4 className="font-bold text-gray-900 mb-1">{selectedBoxDetail.name}</h4>
                                {selectedBoxDetail.description && <p className="text-gray-600 text-sm">{selectedBoxDetail.description}</p>}
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button onClick={() => setShowBoxDetailModal(false)} className="px-5 py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 shadow-sm">{getText('Close', 'Tutup')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Photo */}
            {fullscreenPhoto && (
                <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setFullscreenPhoto(null)}>
                    <button className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30 transition-colors"><X className="h-6 w-6" /></button>
                    <img src={fullscreenPhoto} alt="Fullscreen" className="max-w-full max-h-full object-contain rounded-lg" />
                </div>
            )}
        </div>
    );
};

export default LaboratoryLocationManagement;
