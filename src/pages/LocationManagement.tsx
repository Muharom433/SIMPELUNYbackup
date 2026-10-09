import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Plus, Edit2, Trash2, ChevronDown, ChevronRight, X, Save, DoorOpen,
  Layers, Loader2, Table2, MapPin, Search, Eye, Users, Calendar,
  CheckCircle, AlertCircle, ArrowRightLeft, LayoutDashboard, Database,
  MoreVertical, FileText, CornerDownRight, Package, Box, Archive,
  GripVertical, CheckSquare, Square, Move, Sparkles, FolderOpen, ChevronLeft, Menu, Upload, Maximize2, QrCode, Download, RefreshCw
} from 'lucide-react';
import html2canvas from 'html2canvas';
import QRCode from 'react-qr-code';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import RoomExcelUploadModal from '../components/ExcelUpload/RoomExcelUploadModal';
import RoomQRModal from '../components/rooms/RoomQRModal';

// Types
interface Campus { id: string; name: string; location: string; description: string; latitude?: number | null; longitude?: number | null; radius_meters?: number | null; }
interface Building { id: string; name: string; code: string; description: string; campus_id: string; attachments?: string; rooms?: Room[]; }
interface Room {
  id: string; name: string; code: string; capacity: number; building_id: string;
  floor: string; department_id?: string; equipment: string[]; is_available: boolean; tables?: Tabel[];
  attachments?: string; // Base64 photo string
}
interface Tabel {
  id: string;
  room_id: string;
  description: string;
  rack: string;
  attachments?: string; // Base64 photo string
  racks?: Rack[]; // Nested racks
}
interface Rack {
  id: string;
  name: string;
  table_id: string;
  boxes?: BoxItem[]; // Nested boxes
}
interface BoxItem {
  id: string;
  name: string;
  description: string;
  rack_id: string;
  attachments?: string; // Base64 photo string
}
interface CombinedSchedule {
  id: string; type: 'lecture' | 'exam' | 'session' | 'booking';
  start_time: string; end_time: string; title: string; subtitle?: string; description?: string;
  color: string; bgColor: string;
}

const LocationManagement: React.FC = () => {
  const { getText } = useLanguage();

  // Data States
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection States
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [expandedFloors, setExpandedFloors] = useState<{ [key: string]: boolean }>({});
  const [expandedRooms, setExpandedRooms] = useState<{ [key: string]: boolean }>({});
  const [expandedTables, setExpandedTables] = useState<{ [key: string]: boolean }>({});
  const [expandedRacks, setExpandedRacks] = useState<{ [key: string]: boolean }>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Modal States
  const [showCampusModal, setShowCampusModal] = useState(false);
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showTabelModal, setShowTabelModal] = useState(false);
  const [showRackModal, setShowRackModal] = useState(false);
  const [showBoxModal, setShowBoxModal] = useState(false);
  const [showRoomDetailModal, setShowRoomDetailModal] = useState(false);
  const [showEditFloorModal, setShowEditFloorModal] = useState(false);
  const [showRoomExcelModal, setShowRoomExcelModal] = useState(false);
  const [editingFloorName, setEditingFloorName] = useState('');
  const [originalFloorName, setOriginalFloorName] = useState('');

  // Editing/Form States
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingTabel, setEditingTabel] = useState<Tabel | null>(null);
  const [editingRack, setEditingRack] = useState<Rack | null>(null);
  const [editingBox, setEditingBox] = useState<BoxItem | null>(null);
  const [selectedCabinetForContents, setSelectedCabinetForContents] = useState<Tabel | null>(null);
  const [showCabinetContentsModal, setShowCabinetContentsModal] = useState(false);

  // Specific State for Room Assignment
  const [roomModalMode, setRoomModalMode] = useState<'create' | 'assign'>('create');
  const [selectedTabelRoomId, setSelectedTabelRoomId] = useState<string>('');
  const [selectedRackTableId, setSelectedRackTableId] = useState<string>('');
  const [selectedBoxRackId, setSelectedBoxRackId] = useState<string>('');
  const [targetFloor, setTargetFloor] = useState<string>('');

  // Form Data
  const [campusForm, setCampusForm] = useState({ name: '', location: '', description: '', latitude: '' as string | number, longitude: '' as string | number, radius_meters: 1000 as number });
  const [buildingForm, setBuildingForm] = useState({ name: '', code: '', description: '', campus_id: '', attachments: '' });
  const [buildingImagePreview, setBuildingImagePreview] = useState<string>(''); // Preview for image upload
  const [roomForm, setRoomForm] = useState({ name: '', code: '', capacity: 0, floor: '', building_id: '', department_id: '', attachments: '' });
  const [tabelForm, setTabelForm] = useState({ name: '', description: '', rack: '', room_id: '', attachments: '' });
  const [rackForm, setRackForm] = useState({ name: '', table_id: '' });
  const [boxForm, setBoxForm] = useState({ name: '', description: '', rack_id: '', attachments: '' });

  // Room Reassignment Search
  const [roomSearchTerm, setRoomSearchTerm] = useState('');
  const [selectedAssignRooms, setSelectedAssignRooms] = useState<Room[]>([]);
  const [assignTargetFloor, setAssignTargetFloor] = useState<string>(''); // Floor tujuan untuk mode assign

  // Schedule States (for detail view)
  const [schedules, setSchedules] = useState<CombinedSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [targetDate, setTargetDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedRoomDetail, setSelectedRoomDetail] = useState<Room | null>(null);

  // Autocomplete states (similar to RoomManagement)
  const [roomNameSuggestions, setRoomNameSuggestions] = useState<string[]>([]);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [showRoomSuggestions, setShowRoomSuggestions] = useState(false);
  const [filteredRoomSuggestions, setFilteredRoomSuggestions] = useState<string[]>([]);

  // Multi-select for batch moving
  const [selectedItemsForMove, setSelectedItemsForMove] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [showBatchMoveModal, setShowBatchMoveModal] = useState(false);
  const [batchMoveTargetRack, setBatchMoveTargetRack] = useState<string>('');

  const [availableStockForCabinet, setAvailableStockForCabinet] = useState<any[]>([]);
  const [selectedStockForCabinet, setSelectedStockForCabinet] = useState<any | null>(null);
  const [claimQuantity, setClaimQuantity] = useState<number>(1);
  const [cabinetModalMode, setCabinetModalMode] = useState<'manual' | 'claim'>('manual');

  // Box stock claim states
  const [availableStockForBox, setAvailableStockForBox] = useState<any[]>([]);
  const [selectedStockForBox, setSelectedStockForBox] = useState<any | null>(null);
  const [boxClaimQuantity, setBoxClaimQuantity] = useState<number>(1);
  const [boxModalMode, setBoxModalMode] = useState<'manual' | 'claim'>('manual');

  // Drag and drop states
  const [draggedBox, setDraggedBox] = useState<BoxItem | null>(null);
  const [dragOverRackId, setDragOverRackId] = useState<string | null>(null);

  // Inline editing states
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');

  // Building Detail Modal states
  const [showBuildingDetailModal, setShowBuildingDetailModal] = useState(false);
  const [selectedBuildingDetail, setSelectedBuildingDetail] = useState<Building | null>(null);

  // Cabinet image states
  const [cabinetImagePreview, setCabinetImagePreview] = useState<string>('');

  // Cabinet Detail Modal states
  const [showCabinetDetailModal, setShowCabinetDetailModal] = useState(false);
  const [selectedCabinetDetail, setSelectedCabinetDetail] = useState<Tabel | null>(null);

  // Box image states
  const [boxImagePreview, setBoxImagePreview] = useState<string>('');

  // Room image states
  const [roomImagePreview, setRoomImagePreview] = useState<string>('');

  // Box Detail Modal states
  const [showBoxDetailModal, setShowBoxDetailModal] = useState(false);
  const [selectedBoxDetail, setSelectedBoxDetail] = useState<BoxItem | null>(null);

  // Lazy loading attachments states
  const [loadingAttachment, setLoadingAttachment] = useState(false);
  const [buildingAttachment, setBuildingAttachment] = useState<string>('');
  const [roomAttachment, setRoomAttachment] = useState<string>('');
  const [cabinetAttachment, setCabinetAttachment] = useState<string>('');
  const [boxAttachment, setBoxAttachment] = useState<string>('');

  // Fullscreen Photo Preview state
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  // Operation Loading States
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [loadingCabinet, setLoadingCabinet] = useState(false);
  const [loadingRack, setLoadingRack] = useState(false);
  const [loadingBox, setLoadingBox] = useState(false);
  const [loadingBatchMove, setLoadingBatchMove] = useState(false);

  // QR Code State
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedRoomForQR, setSelectedRoomForQR] = useState<Room | null>(null);

  useEffect(() => { fetchData(); fetchRoomSuggestions(); fetchDepartments(); }, []);

  // Sync selectedCabinetForContents when data changes
  useEffect(() => {
    if (showCabinetContentsModal && selectedCabinetForContents) {
      let found: Tabel | undefined;
      for (const b of buildings) {
        for (const r of b.rooms || []) {
          const t = r.tables?.find((t: Tabel) => t.id === selectedCabinetForContents.id);
          if (t) { found = t; break; }
        }
        if (found) break;
      }
      if (found) setSelectedCabinetForContents(found);
    }
  }, [buildings]);

  const fetchData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);

      // OPTIMIZATION: Fetch all data in parallel using Promise.all
      // This reduces load time significantly by running all queries simultaneously
      // Also exclude 'attachments' field from initial queries to reduce payload size
      const [
        campusesResult,
        buildingsResult,
        roomsResult,
        tablesResult,
        racksResult,
        boxesResult
      ] = await Promise.all([
        // Fetch Campuses
        supabase.from('campus').select('id, name, location, description, latitude, longitude, radius_meters').order('name'),
        // Fetch Buildings - exclude large attachments field initially
        supabase.from('building').select('id, name, code, description, campus_id').order('name'),
        // Fetch Rooms - exclude large attachments field initially
        supabase.from('rooms').select('id, name, code, capacity, building_id, floor, department_id, equipment, is_available').order('floor').order('name'),
        // Fetch Tables (Cabinets) - exclude attachments
        supabase.from('table').select('id, room_id, description, rack'),
        // Fetch Racks
        supabase.from('rack').select('id, name, table_id').order('name'),
        // Fetch Boxes - exclude attachments
        supabase.from('box').select('id, name, description, rack_id').order('name')
      ]);

      // Handle errors
      if (campusesResult.error) throw campusesResult.error;
      if (buildingsResult.error) throw buildingsResult.error;
      if (roomsResult.error) throw roomsResult.error;
      if (tablesResult.error) throw tablesResult.error;
      if (racksResult.error) throw racksResult.error;
      if (boxesResult.error) throw boxesResult.error;

      const campusesData = campusesResult.data || [];
      const buildingsData = buildingsResult.data || [];
      const roomsData = roomsResult.data || [];
      const tablesData = tablesResult.data || [];
      const racksData = racksResult.data || [];
      const boxesData = boxesResult.data || [];

      setCampuses(campusesData);
      setAllRooms(roomsData);

      // Build hierarchy: Box -> Rack -> Table -> Room -> Building

      // Group boxes by rack_id
      const boxesByRack = boxesData.reduce((acc: any, box) => {
        if (!acc[box.rack_id]) acc[box.rack_id] = [];
        acc[box.rack_id].push(box);
        return acc;
      }, {});

      // Attach boxes to racks
      const racksWithBoxes = racksData.map(rack => ({
        ...rack,
        boxes: boxesByRack[rack.id] || []
      }));

      // Group racks by table_id
      const racksByTable = racksWithBoxes.reduce((acc: any, rack) => {
        if (!acc[rack.table_id]) acc[rack.table_id] = [];
        acc[rack.table_id].push(rack);
        return acc;
      }, {});

      // Attach racks to tables
      const tablesWithRacks = tablesData.map(table => ({
        ...table,
        racks: racksByTable[table.id] || []
      }));

      // Group tables by room_id
      const tablesByRoom = tablesWithRacks.reduce((acc: any, table) => {
        if (!acc[table.room_id]) acc[table.room_id] = [];
        acc[table.room_id].push(table);
        return acc;
      }, {});

      // Attach tables to rooms, group rooms by building
      const roomsByBuilding = roomsData.reduce((acc: any, curr) => {
        if (!acc[curr.building_id]) acc[curr.building_id] = [];
        const roomWithTables = { ...curr, tables: tablesByRoom[curr.id] || [] };
        acc[curr.building_id].push(roomWithTables);
        return acc;
      }, {});

      // Build final hierarchy
      const buildingsWithRooms: Building[] = buildingsData.map(b => ({
        ...b,
        rooms: roomsByBuilding[b.id] || []
      }));

      setBuildings(buildingsWithRooms);
    } catch (error) {
      Swal.fire('Error', getText('Failed to load data', 'Gagal memuat data'), 'error');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // LAZY LOADING FUNCTIONS FOR ATTACHMENTS
  // These functions fetch attachments only when detail modals are opened
  // This significantly reduces initial page load time

  const fetchBuildingAttachment = async (buildingId: string) => {
    try {
      setLoadingAttachment(true);
      setBuildingAttachment('');
      const { data, error } = await supabase
        .from('building')
        .select('attachments')
        .eq('id', buildingId)
        .single();

      if (error) throw error;
      setBuildingAttachment(data?.attachments || '');
    } catch (error) {
    } finally {
      setLoadingAttachment(false);
    }
  };

  const fetchRoomAttachment = async (roomId: string) => {
    try {
      setLoadingAttachment(true);
      setRoomAttachment('');
      const { data, error } = await supabase
        .from('rooms')
        .select('attachments')
        .eq('id', roomId)
        .single();

      if (error) throw error;
      setRoomAttachment(data?.attachments || '');
    } catch (error) {
    } finally {
      setLoadingAttachment(false);
    }
  };

  const fetchCabinetAttachment = async (cabinetId: string) => {
    try {
      setLoadingAttachment(true);
      setCabinetAttachment('');
      const { data, error } = await supabase
        .from('table')
        .select('attachments')
        .eq('id', cabinetId)
        .single();

      if (error) throw error;
      setCabinetAttachment(data?.attachments || '');
    } catch (error) {
    } finally {
      setLoadingAttachment(false);
    }
  };

  const fetchBoxAttachment = async (boxId: string) => {
    try {
      setLoadingAttachment(true);
      setBoxAttachment('');
      const { data, error } = await supabase
        .from('box')
        .select('attachments')
        .eq('id', boxId)
        .single();

      if (error) throw error;
      setBoxAttachment(data?.attachments || '');
    } catch (error) {
    } finally {
      setLoadingAttachment(false);
    }
  };

  // --- Helpers ---

  const selectedCampus = useMemo(() => campuses.find(c => c.id === selectedCampusId), [campuses, selectedCampusId]);
  const selectedBuilding = useMemo(() => buildings.find(b => b.id === selectedBuildingId), [buildings, selectedBuildingId]);

  const filteredBuildings = useMemo(() =>
    buildings.filter(b => b.campus_id === selectedCampusId),
    [buildings, selectedCampusId]);

  const groupedRooms = useMemo(() => {
    if (!selectedBuilding || !selectedBuilding.rooms) return {};
    const grouped: { [key: string]: Room[] } = {};
    selectedBuilding.rooms.forEach(room => {
      const floor = room.floor || 'Unassigned Floor';
      if (!grouped[floor]) grouped[floor] = [];
      grouped[floor].push(room);
    });
    return grouped;
  }, [selectedBuilding]);

  const sortedFloors = useMemo(() => Object.keys(groupedRooms).sort(), [groupedRooms]);

  // Available floors for assign mode (from selected building)
  const availableFloorsForAssign = useMemo(() => {
    if (!selectedBuilding || !selectedBuilding.rooms) return [];
    const floors = new Set<string>();
    selectedBuilding.rooms.forEach(room => {
      if (room.floor) floors.add(room.floor);
    });
    return Array.from(floors).sort();
  }, [selectedBuilding]);

  // --- Handlers ---

  const handleCreateNewRoom = () => {
    // Reset form completely and set the target floor and building
    setRoomForm({
      name: '',
      code: '',
      capacity: 0,
      floor: targetFloor,
      building_id: selectedBuildingId || '',
      department_id: '',
      attachments: ''
    });
    setRoomNameInput('');
    setShowRoomSuggestions(false);
    setRoomImagePreview('');
    setRoomModalMode('create');
    setEditingRoom(null);
    setShowRoomModal(true);
  };

  const handleAssignExistingRoom = () => {
    setRoomModalMode('assign');
    setRoomSearchTerm('');
    setSelectedAssignRooms([]);
    setAssignTargetFloor(''); // Reset floor selection
    setShowRoomModal(true);
  };

  const executeRoomAssignment = async () => {
    if (selectedAssignRooms.length === 0 || !selectedBuildingId) {
      Swal.fire('Warning', getText('Please select rooms to move', 'Pilih ruangan yang ingin dipindahkan'), 'warning');
      return;
    }

    // Validate target floor selection
    if (!assignTargetFloor) {
      Swal.fire('Warning', getText('Please select target floor', 'Pilih lantai tujuan'), 'warning');
      return;
    }

    try {
      setLoadingRoom(true);
      const roomIds = selectedAssignRooms.map(r => r.id);
      const { error } = await supabase.from('rooms').update({
        building_id: selectedBuildingId,
        floor: assignTargetFloor
      }).in('id', roomIds);

      if (error) throw error;

      await fetchData(true);
      setShowRoomModal(false);
      setSelectedAssignRooms([]);
      setAssignTargetFloor('');
      Swal.fire({
        icon: 'success',
        title: getText('Moved!', 'Dipindahkan!'),
        text: `${selectedAssignRooms.length} ${getText('rooms moved to', 'ruangan dipindahkan ke')} ${assignTargetFloor} `,
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error: any) {
      Swal.fire('Error', getText('Failed to reassign room', 'Gagal memindahkan ruangan') + ': ' + (error.message || ''), 'error');
    } finally {
      setLoadingRoom(false);
    }
  };

  const executeSaveRoom = async () => {
    // Ensure building_id is - selectedBuildingId if roomForm.building_id is empty
    const buildingId = roomForm.building_id || selectedBuildingId;

    // Validate required fields with specific messages
    if (!roomForm.name) {
      Swal.fire('Warning', getText('Please enter room name', 'Masukkan nama ruangan'), 'warning');
      return;
    }
    if (!roomForm.code) {
      Swal.fire('Warning', getText('Please enter room code', 'Masukkan kode ruangan'), 'warning');
      return;
    }
    if (!roomForm.floor) {
      Swal.fire('Warning', getText('Please enter floor', 'Masukkan lantai'), 'warning');
      return;
    }
    if (!buildingId) {
      Swal.fire('Warning', getText('Please select a building', 'Pilih gedung terlebih dahulu'), 'warning');
      return;
    }

    try {
      setLoadingRoom(true);
      if (editingRoom) {
        // Update existing room
        const { error } = await supabase.from('rooms').update({
          name: roomForm.name,
          code: roomForm.code,
          capacity: roomForm.capacity || 0,
          floor: roomForm.floor,
          building_id: buildingId,
          department_id: roomForm.department_id || null,
          attachments: roomForm.attachments || null
        }).eq('id', editingRoom.id);

        if (error) throw error;
      } else {
        // Create new room with all required fields
        const { error } = await supabase.from('rooms').insert([{
          name: roomForm.name,
          code: roomForm.code,
          capacity: roomForm.capacity || 0,
          floor: roomForm.floor,
          building_id: buildingId,
          department_id: roomForm.department_id || null,
          is_available: true,
          equipment: [],
          attachments: roomForm.attachments || null
        }]);

        if (error) throw error;
      }

      await fetchData(true);
      setShowRoomModal(false);
      setSelectedAssignRooms([]);
      setEditingRoom(null);
      setRoomNameInput('');
      setShowRoomSuggestions(false);
      setRoomForm({ name: '', code: '', capacity: 0, floor: '', building_id: '', department_id: '', attachments: '' });
      setRoomImagePreview('');
      Swal.fire({ icon: 'success', title: getText('Room saved!', 'Ruangan disimpan!'), timer: 1500, showConfirmButton: false });
    } catch (e: any) {

      // Handle specific error codes
      if (e.code === '23505') {
        // Duplicate key - code already exists
        Swal.fire('Error', getText('Room code already exists! Please use a different code.', 'Kode ruangan sudah ada! Gunakan kode lain.'), 'error');
      } else if (e.code === '409' || e.message?.includes('409')) {
        // Conflict error
        Swal.fire('Error', getText('Room code already exists! Please use a different code.', 'Kode ruangan sudah ada! Gunakan kode lain.'), 'error');
      } else {
        Swal.fire('Error', getText('Failed to save room', 'Gagal menyimpan ruangan') + ': ' + (e.message || 'Unknown error'), 'error');
      }
    } finally {
      setLoadingRoom(false);
    }
  };

  const executeSaveCabinet = async () => {
    if (cabinetModalMode === 'manual') {
      // Manual - logic
      if (!tabelForm.name.trim()) { Swal.fire('Warning', getText('Please enter cabinet name', 'Masukkan nama kabinet'), 'warning'); return; }

      try {
        setLoadingCabinet(true);
        // Combine name and description for storage
        const combinedDescription = tabelForm.description
          ? `${tabelForm.name.trim()} | ${tabelForm.description.trim()} `
          : tabelForm.name.trim(); // Ensure trailing space for safety

        const dataToSave = {
          description: combinedDescription,
          rack: tabelForm.rack,
          room_id: selectedTabelRoomId || tabelForm.room_id,
          attachments: tabelForm.attachments || null
        };

        if (editingTabel) {
          const { error } = await supabase.from('table').update({
            description: combinedDescription,
            rack: tabelForm.rack,
            attachments: tabelForm.attachments || null
          }).eq('id', editingTabel.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('table').insert([dataToSave]);
          if (error) throw error;
        }

        setShowTabelModal(false);
        setTabelForm({ name: '', description: '', rack: '', room_id: '', attachments: '' });
        setCabinetImagePreview('');
        await fetchData(true);
        Swal.fire({ icon: 'success', title: getText('Saved!', 'Tersimpan!'), timer: 1500, showConfirmButton: false });
      } catch (e: any) {
        Swal.fire('Error', getText('Failed to save cabinet', 'Gagal menyimpan kabinet') + (e.message ? `: ${e.message}` : ''), 'error');
      } finally {
        setLoadingCabinet(false);
      }
    } else {
      // Claim - from stock
      if (!selectedStockForCabinet) { Swal.fire('Warning', getText('Please select a stock item', 'Pilih item stock'), 'warning'); return; }
      if (claimQuantity < 1 || claimQuantity > selectedStockForCabinet.quantity) {
        Swal.fire('Warning', getText('Invalid quantity', 'Jumlah tidak valid'), 'warning');
        return;
      }

      try {
        setLoadingCabinet(true);
        const roomId = selectedTabelRoomId || tabelForm.room_id;

        // Create cabinet entries only (Box has its own modal now)
        const cabinetEntries = [];
        for (let i = 0; i < claimQuantity; i++) {
          cabinetEntries.push({
            description: claimQuantity > 1
              ? `${selectedStockForCabinet.nama} #${i + 1} (${selectedStockForCabinet.code})`
              : `${selectedStockForCabinet.nama} (${selectedStockForCabinet.code})`,
            rack: tabelForm.rack,
            room_id: roomId,
            attachments: tabelForm.attachments || null
          });
        }

        const { error: insertError } = await supabase.from('table').insert(cabinetEntries);
        if (insertError) throw insertError;

        // Reduce stock quantity by claimed amount
        const newQuantity = selectedStockForCabinet.quantity - claimQuantity;
        const { error: updateError } = await supabase.from('stock').update({ quantity: newQuantity }).eq('id', selectedStockForCabinet.id);
        if (updateError) throw updateError;

        setShowTabelModal(false);
        setCabinetModalMode('manual');
        setSelectedStockForCabinet(null);
        setClaimQuantity(1);
        setTabelForm({ name: '', description: '', rack: '', room_id: '', attachments: '' });
        setCabinetImagePreview('');
        await fetchData(true);

        Swal.fire({
          icon: 'success',
          title: getText('Cabinet claimed!', 'Kabinet diambil!'),
          text: getText(`${claimQuantity} ${selectedStockForCabinet.nama} claimed. Stock reduced by ${claimQuantity}.`, `${claimQuantity} ${selectedStockForCabinet.nama} diambil. Stock berkurang ${claimQuantity}.`),
          timer: 2000,
          showConfirmButton: false
        });
      } catch (e: any) {
        Swal.fire('Error', getText('Failed to claim cabinet', 'Gagal mengambil kabinet') + (e.message ? `: ${e.message}` : ''), 'error');
      } finally {
        setLoadingCabinet(false);
      }
    }
  };

  const executeSaveRack = async () => {
    if (!rackForm.name.trim()) { Swal.fire('Warning', getText('Please enter rack name', 'Masukkan nama rak'), 'warning'); return; }

    try {
      setLoadingRack(true);
      const tableId = selectedRackTableId || rackForm.table_id;

      if (editingRack) {
        const { error } = await supabase.from('rack').update({ name: rackForm.name.trim() }).eq('id', editingRack.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rack').insert([{ name: rackForm.name.trim(), table_id: tableId }]);
        if (error) throw error;
      }

      setShowRackModal(false);
      await fetchData(true);
      Swal.fire({ icon: 'success', title: getText('Saved!', 'Tersimpan!'), timer: 1500, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire('Error', getText('Failed to save rack', 'Gagal menyimpan rak') + (e.message ? `: ${e.message}` : ''), 'error');
    } finally {
      setLoadingRack(false);
    }
  };

  const executeSaveBox = async () => {
    if (boxModalMode === 'manual') {
      // Manual - logic
      if (!boxForm.name.trim()) { Swal.fire('Warning', getText('Please enter box name', 'Masukkan nama box'), 'warning'); return; }

      try {
        setLoadingBox(true);
        const rackId = selectedBoxRackId || boxForm.rack_id;

        if (editingBox) {
          const { error } = await supabase.from('box').update({
            name: boxForm.name.trim(),
            description: boxForm.description,
            attachments: boxForm.attachments || null
          }).eq('id', editingBox.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('box').insert([{
            name: boxForm.name.trim(),
            description: boxForm.description,
            rack_id: rackId,
            attachments: boxForm.attachments || null
          }]);
          if (error) throw error;
        }

        setShowBoxModal(false);
        setBoxModalMode('manual');
        setBoxForm({ name: '', description: '', rack_id: '', attachments: '' });
        setBoxImagePreview('');
        await fetchData(true);
        Swal.fire({ icon: 'success', title: getText('Saved!', 'Tersimpan!'), timer: 1500, showConfirmButton: false });
      } catch (e: any) {
        Swal.fire('Error', getText('Failed to save box', 'Gagal menyimpan box') + (e.message ? `: ${e.message}` : ''), 'error');
      } finally {
        setLoadingBox(false);
      }
    } else {
      // Claim - from stock
      if (!selectedStockForBox) { Swal.fire('Warning', getText('Please select a stock item', 'Pilih item stock'), 'warning'); return; }
      if (boxClaimQuantity < 1 || boxClaimQuantity > selectedStockForBox.quantity) {
        Swal.fire('Warning', getText('Invalid quantity', 'Jumlah tidak valid'), 'warning');
        return;
      }

      try {
        setLoadingBox(true);
        const rackId = selectedBoxRackId || boxForm.rack_id;

        // Create boxes with stock name
        const boxEntries = [];
        for (let i = 0; i < boxClaimQuantity; i++) {
          boxEntries.push({
            name: boxClaimQuantity > 1
              ? `${selectedStockForBox.nama} #${i + 1} `
              : selectedStockForBox.nama, // Ensure trailing space for safety
            description: `${selectedStockForBox.code} - Claimed from stock`,
            rack_id: rackId,
            attachments: boxForm.attachments || null
          });
        }

        const { error: insertError } = await supabase.from('box').insert(boxEntries);
        if (insertError) throw insertError;

        // Reduce stock quantity
        const newQuantity = selectedStockForBox.quantity - boxClaimQuantity;
        const { error: updateError } = await supabase.from('stock').update({ quantity: newQuantity }).eq('id', selectedStockForBox.id);
        if (updateError) throw updateError;

        setShowBoxModal(false);
        setSelectedStockForBox(null);
        setBoxClaimQuantity(1);
        setBoxModalMode('manual');
        setBoxForm({ name: '', description: '', rack_id: '', attachments: '' });
        setBoxImagePreview('');
        await fetchData(true);

        Swal.fire({
          icon: 'success',
          title: getText('Box claimed!', 'Box diambil!'),
          text: getText(`${boxClaimQuantity} box claimed. Stock reduced by ${boxClaimQuantity}.`, `${boxClaimQuantity} box diambil. Stock berkurang ${boxClaimQuantity}.`),
          timer: 2000,
          showConfirmButton: false
        });
      } catch (e: any) {
        Swal.fire('Error', getText('Failed to claim box', 'Gagal mengambil box') + (e.message ? `: ${e.message}` : ''), 'error');
      } finally {
        setLoadingBox(false);
      }
    }
  };

  const handleShowQR = (room: Room) => {
    setSelectedRoomForQR(room);
    setShowQRModal(true);
  };

  // Schedule Logic from RoomManagement
  const fetchSchedules = async (room: Room) => {
    setLoadingSchedules(true);
    setSchedules([]);
    try {
      const combined: CombinedSchedule[] = [];
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNames[new Date(targetDate).getDay()];

      const { data: lectures } = await supabase.from('lecture_schedules').select('*')
        .eq('day', dayName).ilike('room', `%${room.name}%`).order('start_time');
      lectures?.forEach(l => combined.push({
        id: l.id, type: 'lecture', start_time: l.start_time?.substring(0, 5) || '',
        end_time: l.end_time?.substring(0, 5) || '', title: l.course_name || 'Lecture',
        subtitle: `${l.class} • ${l.subject_study}`, description: `Dosen: ${l.lecturer}`,
        color: 'text-blue-700', bgColor: 'bg-blue-50'
      }));

      // ... (Add other schedule types similarly if needed, keeping it concise for now)

      setSchedules(combined);
    } finally {
      setLoadingSchedules(false);
    }
  };

  // Fetch room name suggestions (similar to RoomManagement)
  const fetchRoomSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('lecture_schedules')
        .select('room')
        .not('room', 'is', null);

      if (error) throw error;

      const uniqueRooms = [...new Set(data.map(item => item.room).filter(Boolean))].sort();
      setRoomNameSuggestions(uniqueRooms as string[]);
    } catch (error) {
    }
  };

  // Fetch departments (similar to RoomManagement)
  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
    }
  };

  // Fetch cabinet stock (cabinet, almari, lemari) for - BOX
  const fetchCabinetStock = async () => {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        .or('category.ilike.%cabinet%,category.ilike.%almari%,category.ilike.%lemari%')
        .gt('quantity', 0)
        .order('nama');

      if (error) throw error;
      setAvailableStockForCabinet(data || []);
    } catch (error) {
    }
  };

  // Fetch box stock for - BOX
  const fetchBoxStock = async () => {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        .ilike('category', '%box%')
        .gt('quantity', 0)
        .order('nama');

      if (error) throw error;
      setAvailableStockForBox(data || []);
    } catch (error) {
    }
  };

  // Filter room suggestions based on input
  useEffect(() => {
    if (roomNameInput.length >= 1) {
      const filtered = roomNameSuggestions.filter(room =>
        room.toLowerCase().includes(roomNameInput.toLowerCase())
      );
      setFilteredRoomSuggestions(filtered);
      setShowRoomSuggestions(true);
    } else {
      setFilteredRoomSuggestions(roomNameSuggestions);
      setShowRoomSuggestions(false);
    }
  }, [roomNameInput, roomNameSuggestions]);

  // Handle room name input change
  const handleRoomNameChange = (value: string) => {
    setRoomNameInput(value);
    setRoomForm({ ...roomForm, name: value });
  };

  // Handle room name selection from suggestions
  const handleRoomNameSelect = (roomName: string) => {
    setRoomNameInput(roomName);
    setRoomForm({ ...roomForm, name: roomName });
    setShowRoomSuggestions(false);
  };

  // Handle building image - to base64
  const handleBuildingImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        Swal.fire('Warning', getText('Please select an image file', 'Pilih file gambar'), 'warning');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire('Warning', getText('Image size must be less than 5MB', 'Ukuran gambar harus kurang dari 5MB'), 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setBuildingForm({ ...buildingForm, attachments: base64String });
        setBuildingImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  // Clear building image
  const clearBuildingImage = () => {
    setBuildingForm({ ...buildingForm, attachments: '' });
    setBuildingImagePreview('');
  };

  // Handle cabinet image - to base64
  const handleCabinetImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        Swal.fire('Warning', getText('Please select an image file', 'Pilih file gambar'), 'warning');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire('Warning', getText('Image size must be less than 5MB', 'Ukuran gambar harus kurang dari 5MB'), 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setTabelForm(prev => ({ ...prev, attachments: base64String }));
        setCabinetImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  // Clear cabinet image
  const clearCabinetImage = () => {
    setTabelForm(prev => ({ ...prev, attachments: '' }));
    setCabinetImagePreview('');
  };

  // Handle box image - to base64
  const handleBoxImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        Swal.fire('Warning', getText('Please select an image file', 'Pilih file gambar'), 'warning');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire('Warning', getText('Image size must be less than 5MB', 'Ukuran gambar harus kurang dari 5MB'), 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setBoxForm(prev => ({ ...prev, attachments: base64String }));
        setBoxImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  // Clear box image
  const clearBoxImage = () => {
    setBoxForm(prev => ({ ...prev, attachments: '' }));
    setBoxImagePreview('');
  };

  // Handle room image - to base64
  const handleRoomImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        Swal.fire('Warning', getText('Please select an image file', 'Pilih file gambar'), 'warning');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire('Warning', getText('Image size must be less than 5MB', 'Ukuran gambar harus kurang dari 5MB'), 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setRoomForm(prev => ({ ...prev, attachments: base64String }));
        setRoomImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  // Clear room image
  const clearRoomImage = () => {
    setRoomForm(prev => ({ ...prev, attachments: '' }));
    setRoomImagePreview('');
  };

  // Toggle item selection for multi-select move
  const toggleItemSelection = (id: string) => {
    setSelectedItemsForMove(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedItemsForMove(new Set());
    setIsMultiSelectMode(false);
  };

  // Execute batch move
  const executeBatchMove = async () => {
    if (!batchMoveTargetRack || selectedItemsForMove.size === 0) return;

    try {
      setLoadingBatchMove(true);
      const ids = Array.from(selectedItemsForMove);
      const { error } = await supabase
        .from('box')
        .update({ rack_id: batchMoveTargetRack })
        .in('id', ids);

      if (error) throw error;

      await fetchData(true);
      clearSelection();
      setShowBatchMoveModal(false);
      setBatchMoveTargetRack('');
      Swal.fire({ icon: 'success', title: getText('Moved!', 'Dipindahkan!'), text: `${ids.length} ${getText('boxes moved successfully', 'box berhasil dipindahkan')} `, timer: 2000, showConfirmButton: false });
    } catch (error) {
      Swal.fire('Error', getText('Failed to move boxes', 'Gagal memindahkan box'), 'error');
    } finally {
      setLoadingBatchMove(false);
    }
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, box: BoxItem) => {
    setDraggedBox(box);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, rackId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverRackId(rackId);
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverRackId(null);
  };

  // Handle drop
  const handleDrop = async (e: React.DragEvent, targetRackId: string) => {
    e.preventDefault();
    setDragOverRackId(null);

    if (!draggedBox || draggedBox.rack_id === targetRackId) {
      setDraggedBox(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('box')
        .update({ rack_id: targetRackId })
        .eq('id', draggedBox.id);

      if (error) throw error;

      await fetchData(true);
      Swal.fire({ icon: 'success', title: getText('Moved!', 'Dipindahkan!'), timer: 1000, showConfirmButton: false });
    } catch (error) {
      Swal.fire('Error', getText('Failed to move box', 'Gagal memindahkan box'), 'error');
    }

    setDraggedBox(null);
  };

  // Inline edit handlers
  const startInlineEdit = (id: string, currentValue: string) => {
    setInlineEditingId(id);
    setInlineEditValue(currentValue);
  };

  const saveInlineEdit = async (type: 'box' | 'rack', id: string) => {
    if (!inlineEditValue.trim()) return;

    try {
      const { error } = await supabase
        .from(type)
        .update({ name: inlineEditValue.trim() })
        .eq('id', id);

      if (error) throw error;

      await fetchData(true);
      setInlineEditingId(null);
      setInlineEditValue('');
    } catch (error) {
    }
  };

  // Get capacity status color
  const getCapacityStatus = (current: number, max: number) => {
    const percentage = max > 0 ? (current / max) * 100 : 0;
    if (percentage >= 90) return { color: 'bg-red-500', text: 'text-red-600', status: 'full' };
    if (percentage >= 70) return { color: 'bg-amber-500', text: 'text-amber-600', status: 'almost-full' };
    if (percentage > 0) return { color: 'bg-emerald-500', text: 'text-emerald-600', status: 'available' };
    return { color: 'bg-gray-300', text: 'text-gray-500', status: 'empty' };
  };

  // Get full location path
  const getLocationPath = (room: Room) => {
    const building = buildings.find(b => b.id === room.building_id);
    const campus = campuses.find(c => c.id === building?.campus_id);
    return `${campus?.name || '?'} → ${building?.name || '?'} → ${room.floor} → ${room.name} `;
  };

  // --- Render ---

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">

      {/* SIDEBAR: CAMPUS MANAGEMENT */}
      <aside className={`${isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full opacity-0 overflow-hidden'} bg-white border-r border-gray-200 flex flex-col shadow-sm z-10 transition-all duration-300 ease-in-out`}>
        <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-md">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-lg flex items-center gap-2 truncate">
              <MapPin className="h-5 w-5 shrink-0" /> {getText('Area', 'Wilayah')}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setEditingCampus(null); setCampusForm({ name: '', location: '', description: '', latitude: '', longitude: '', radius_meters: 1000 }); setShowCampusModal(true); }}
                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                title={getText('Add Campus', 'Tambah Kampus')}
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-slate-300 hover:text-white"
                title={getText('Collapse Sidebar', 'Tutup Sidebar')}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-300 truncate">
            {getText('Manage campuses and buildings', 'Kelola kampus dan gedung')}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {campuses.map(campus => (
            <div key={campus.id} className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm transition-all hover:shadow-md">
              <div
                className={`p-3 flex items-center justify-between cursor-pointer ${selectedCampusId === campus.id ? 'bg-slate-50' : 'hover:bg-gray-50'}`}
                onClick={() => setSelectedCampusId(selectedCampusId === campus.id ? null : campus.id)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-2 h-10 rounded-full bg-slate-600 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">{campus.name}</h3>
                    <p className="text-xs text-gray-500 truncate">{campus.location}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); setEditingCampus(campus); setCampusForm({ name: campus.name, location: campus.location, description: campus.description, latitude: campus.latitude || '', longitude: campus.longitude || '', radius_meters: campus.radius_meters || 1000 }); setShowCampusModal(true); }} className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded"><Edit2 className="h-3.5 w-3.5" /></button>
                  {selectedCampusId === campus.id ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                </div>
              </div>

              {/* BUILDINGS DROPDOWN */}
              {selectedCampusId === campus.id && (
                <div className="bg-slate-50 border-t border-gray-100 p-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span>{getText('Buildings', 'Gedung')}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowRoomExcelModal(true)}
                        className="text-green-600 hover:text-green-700 flex items-center gap-1"
                        title={getText('Import Rooms from Excel', 'Import Ruangan dari Excel')}
                      >
                        <Upload className="h-3 w-3" /> {getText('Import', 'Import')}
                      </button>
                      <button
                        onClick={() => {
                          setEditingBuilding(null);
                          setBuildingForm({ name: '', code: '', description: '', campus_id: campus.id, attachments: '' });
                          setBuildingImagePreview('');
                          setShowBuildingModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> {getText('Add', 'Tambah')}
                      </button>
                    </div>
                  </div>
                  {buildings.filter(b => b.campus_id === campus.id).map(building => (
                    <div
                      key={building.id}
                      onClick={() => setSelectedBuildingId(building.id)}
                      className={`
                                        group flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm
                                        ${selectedBuildingId === building.id ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'}
`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Building2 className={`h-4 w-4 ${selectedBuildingId === building.id ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className="truncate">{building.name}</span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBuildingDetail(building);
                            fetchBuildingAttachment(building.id);
                            setShowBuildingDetailModal(true);
                          }}
                          className="p-1 hover:bg-white rounded shadow-sm text-gray-400 hover:text-blue-600"
                          title={getText('View Details', 'Lihat Detail')}
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setEditingBuilding(building);
                            setBuildingForm({
                              name: building.name,
                              code: building.code,
                              description: building.description,
                              campus_id: building.campus_id,
                              attachments: ''
                            });
                            setBuildingImagePreview('');
                            setShowBuildingModal(true);
                            // Fetch attachment asynchronously
                            const { data } = await supabase
                              .from('building')
                              .select('attachments')
                              .eq('id', building.id)
                              .single();
                            if (data?.attachments) {
                              setBuildingForm(prev => ({ ...prev, attachments: data.attachments }));
                              setBuildingImagePreview(data.attachments);
                            }
                          }}
                          className="p-1 hover:bg-white rounded shadow-sm text-gray-400 hover:text-blue-600"
                          title={getText('Edit Building', 'Edit Gedung')}
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {buildings.filter(b => b.campus_id === campus.id).length === 0 && (
                    <div className="text-center py-2 text-xs text-gray-400 italic">
                      {getText('No buildings yet', 'Belum ada gedung')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Empty state when no campuses */}
          {campuses.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <MapPin className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="font-medium text-gray-600 mb-1">{getText('No Campuses Yet', 'Belum Ada Kampus')}</h3>
              <p className="text-xs text-gray-400 mb-4">{getText('Create your first campus to get started', 'Buat kampus pertama untuk memulai')}</p>
              <button
                onClick={() => { setEditingCampus(null); setCampusForm({ name: '', location: '', description: '', latitude: '', longitude: '', radius_meters: 1000 }); setShowCampusModal(true); }}
                className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> {getText('Add Campus', 'Tambah Kampus')}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT: FLOORS & ROOMS */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
        {selectedBuilding ? (
          <>
            <header className="bg-white border-b border-gray-200 px-6 py-5 shadow-sm">
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-3 mb-3">
                {!isSidebarOpen && (
                  <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-lg transition-all shadow-sm hover:text-blue-600"
                    title={getText('Expand Sidebar', 'Buka Sidebar')}
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                )}
                <nav className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-medium">
                    <MapPin className="h-3.5 w-3.5" />
                    {campuses.find(c => c.id === selectedBuilding.campus_id)?.name}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-600 rounded-lg font-medium">
                    <Building2 className="h-3.5 w-3.5" />
                    {selectedBuilding.code}
                  </span>
                </nav>
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{selectedBuilding.name}</h1>
                  <p className="text-gray-500 text-sm mt-1">{selectedBuilding.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Stats Cards */}
                  <div className="flex gap-2">
                    <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl text-center min-w-[80px]">
                      <p className="text-lg font-bold text-blue-700">{sortedFloors.length}</p>
                      <p className="text-[10px] text-blue-500 uppercase font-medium">{getText('Floors', 'Lantai')}</p>
                    </div>
                    <div className="px-3 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl text-center min-w-[80px]">
                      <p className="text-lg font-bold text-emerald-700">{selectedBuilding.rooms?.filter(r => r.name !== '__FLOOR_PLACEHOLDER__').length || 0}</p>
                      <p className="text-[10px] text-emerald-500 uppercase font-medium">{getText('Rooms', 'Ruangan')}</p>
                    </div>
                    <div className="px-3 py-2 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 rounded-xl text-center min-w-[80px]">
                      <p className="text-lg font-bold text-violet-700">
                        {selectedBuilding.rooms?.reduce((acc, r) => acc + (r.tables?.length || 0), 0) || 0}
                      </p>
                      <p className="text-[10px] text-violet-500 uppercase font-medium">{getText('Cabinets', 'Kabinet')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-5xl mx-auto space-y-6">
                {sortedFloors.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
                    <Layers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">{getText('No Floors Configured', 'Belum Ada Lantai')}</h3>
                    <p className="text-gray-500 mb-4">{getText('Start by adding a room to create a floor.', 'Mulai dengan menambahkan ruangan untuk membuat lantai.')}</p>
                    <button
                      onClick={() => { setTargetFloor('1'); handleCreateNewRoom(); }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {getText('Add First Room', 'Tambah Ruangan Pertama')}
                    </button>
                  </div>
                ) : (
                  sortedFloors.map(floor => (
                    <div key={floor} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
                      {/* Floor Header */}
                      <div
                        className={`
px-6 py-4 flex items-center justify-between cursor-pointer transition-colors
                                            ${expandedFloors[floor] !== false ? 'bg-white border-b border-gray-100' : 'bg-gray-50 hover:bg-gray-100'}
`}
                        onClick={() => setExpandedFloors(prev => ({ ...prev, [floor]: !prev[floor] }))}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${expandedFloors[floor] !== false ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                            <Layers className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-gray-900">{floor}</h3>
                            <p className="text-xs text-gray-500">
                              {groupedRooms[floor].length} {getText('Rooms', 'Ruangan')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOriginalFloorName(floor); setEditingFloorName(floor); setShowEditFloorModal(true); }}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg font-medium flex items-center gap-1 transition-colors"
                            title={getText('Edit Floor', 'Edit Lantai')}
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setTargetFloor(floor); handleCreateNewRoom(); }}
                            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium flex items-center gap-1 transition-colors"
                          >
                            <Plus className="h-4 w-4" /> {getText('Add Room', 'Tambah Ruangan')}
                          </button>
                          {expandedFloors[floor] !== false ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                        </div>
                      </div>

                      {/* Floor Content: Rooms List */}
                      {expandedFloors[floor] !== false && (
                        <div className="p-4 bg-slate-50/50">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {groupedRooms[floor]
                              .filter(room => room.name !== '__FLOOR_PLACEHOLDER__')  // ✅ Hide placeholder
                              .map(room => (
                                <div key={room.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
                                  {/* Room Header */}
                                  <div
                                    className="p-4 flex items-start justify-between cursor-pointer"
                                    onClick={() => setExpandedRooms(prev => ({ ...prev, [room.id]: !prev[room.id] }))}
                                  >
                                    <div className="flex items-start gap-3">
                                      {/* Status indicator with gradient */}
                                      <div className={`mt-1 h-4 w-4 rounded-full shadow-sm ${room.is_available ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-red-400 to-red-600'}`} title={room.is_available ? 'Available' : 'Unavailable'} />
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h4 className="font-bold text-gray-900">{room.name}</h4>
                                          {/* Prominent ID code */}
                                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-md border border-indigo-200 font-mono font-bold">
                                            {room.code}
                                          </span>
                                        </div>
                                        {/* Room ID short hash */}
                                        <div className="mt-1 mb-1">
                                          <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded">
                                            ID: {room.id.substring(0, 8)}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                          <span className="flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            <span className="font-medium">{room.capacity}</span> {getText('capacity', 'kapasitas')}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <Table2 className="h-3 w-3" />
                                            <span className="font-medium">{room.tables?.length || 0}</span> {getText('Cabinets', 'Kabinet')}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button onClick={(e) => { e.stopPropagation(); setSelectedRoomDetail(room); fetchRoomAttachment(room.id); setShowRoomDetailModal(true); }} className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg" title="View Details"><Eye className="h-4 w-4" /></button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleShowQR(room);
                                        }}
                                        className="p-1.5 hover:bg-purple-50 text-gray-400 hover:text-purple-600 rounded-lg"
                                        title={getText('Show QR Code', 'Tampilkan QR Code')}
                                      >
                                        <QrCode className="h-4 w-4" />
                                      </button>
                                      <button onClick={async (e) => {
                                        e.stopPropagation();
                                        setEditingRoom(room);
                                        setRoomForm({ name: room.name, code: room.code, capacity: room.capacity, floor: room.floor, building_id: room.building_id, department_id: room.department_id || '', attachments: '' });
                                        setRoomImagePreview('');
                                        setRoomModalMode('create');
                                        setShowRoomModal(true);
                                        // Fetch attachment asynchronously
                                        const { data } = await supabase.from('rooms').select('attachments').eq('id', room.id).single();
                                        if (data?.attachments) {
                                          setRoomForm(prev => ({ ...prev, attachments: data.attachments }));
                                          setRoomImagePreview(data.attachments);
                                        }
                                      }} className="p-1.5 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-lg" title="Edit Room"><Edit2 className="h-4 w-4" /></button>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const result = await Swal.fire({ title: getText('Delete Room?', 'Hapus Ruangan?'), text: getText('This will also delete all cabinets in this room', 'Ini juga akan menghapus semua kabinet di ruangan ini'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
                                          if (result.isConfirmed) {
                                            await supabase.from('rooms').delete().eq('id', room.id);
                                            fetchData(true);
                                            Swal.fire('Deleted', getText('Room deleted', 'Ruangan dihapus'), 'success');
                                          }
                                        }}
                                        className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg"
                                        title="Delete Room"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                      {expandedRooms[room.id] ? <ChevronDown className="h-4 w-4 text-gray-300 ml-1" /> : <ChevronRight className="h-4 w-4 text-gray-300 ml-1" />}
                                    </div>
                                  </div>

                                  {/* Room Content: Cabinets -> Racks -> Boxes */}
                                  {expandedRooms[room.id] && (
                                    <div className="border-t border-gray-100 bg-gradient-to-b from-gray-50 to-slate-50 p-3 animate-in slide-in-from-top-1">
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                                          <Database className="h-3.5 w-3.5 text-indigo-500" />
                                          {getText('Storage Hierarchy', 'Hierarki Penyimpanan')}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingTabel(null);
                                            setSelectedTabelRoomId(room.id);
                                            setTabelForm({ name: '', description: '', rack: '', room_id: room.id, attachments: '' });
                                            setCabinetImagePreview('');
                                            setShowTabelModal(true);
                                          }}
                                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300"
                                        >
                                          <Plus className="h-4 w-4" /> {getText('Add Cabinet', 'Tambah Kabinet')}
                                        </button>
                                      </div>

                                      {room.tables && room.tables.length > 0 ? (
                                        <div className="flex flex-col gap-3">
                                          {room.tables.map(table => (
                                            <div key={table.id} className="group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200 overflow-hidden">
                                              {/* Decorative Side Line */}
                                              <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                              <div className="p-4 flex flex-col gap-3">
                                                {/* Top Row: Icon, Info & Actions */}
                                                <div className="flex items-start justify-between gap-3">
                                                  {/* Left: Icon & Name */}
                                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 group-hover:from-indigo-100 group-hover:to-purple-100 transition-colors">
                                                      <Table2 className="h-5 w-5" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                      {/* Parse name and description from combined field */}
                                                      {(() => {
                                                        const parts = (table.description || '').split(' | ');
                                                        const name = parts[0] || getText('Cabinet', 'Kabinet');
                                                        const desc = parts.length > 1 ? parts.slice(1).join(' | ') : null;
                                                        return (
                                                          <>
                                                            <h5 className="text-sm font-bold text-gray-900 truncate" title={name}>
                                                              {name}
                                                            </h5>
                                                            {desc && (
                                                              <p className="text-xs text-gray-500 truncate mt-0.5" title={desc}>
                                                                {desc}
                                                              </p>
                                                            )}
                                                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                                              <MapPin className="h-3 w-3 shrink-0" />
                                                              <span className="truncate">{table.rack || getText('No Location', 'Tanpa Lokasi')}</span>
                                                            </div>
                                                          </>
                                                        );
                                                      })()}
                                                    </div>
                                                  </div>

                                                  {/* Right: Action Buttons */}
                                                  <div className="flex items-center gap-1">
                                                    {/* Edit Button */}
                                                    <button
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        const parts = (table.description || '').split(' | ');
                                                        const name = parts[0] || '';
                                                        const desc = parts.length > 1 ? parts.slice(1).join(' | ') : '';
                                                        setEditingTabel(table);
                                                        setTabelForm({
                                                          name: name,
                                                          description: desc,
                                                          rack: table.rack || '',
                                                          room_id: table.room_id,
                                                          attachments: ''
                                                        });
                                                        setCabinetImagePreview('');
                                                        setShowTabelModal(true);
                                                        // Fetch attachment asynchronously
                                                        const { data } = await supabase.from('table').select('attachments').eq('id', table.id).single();
                                                        if (data?.attachments) {
                                                          setTabelForm(prev => ({ ...prev, attachments: data.attachments }));
                                                          setCabinetImagePreview(data.attachments);
                                                        }
                                                      }}
                                                      className="p-1.5 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-lg transition-colors"
                                                      title={getText('Edit Cabinet', 'Edit Kabinet')}
                                                    >
                                                      <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    {/* Detail Button */}
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedCabinetDetail(table);
                                                        fetchCabinetAttachment(table.id);
                                                        setShowCabinetDetailModal(true);
                                                      }}
                                                      className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                                                      title={getText('View Details', 'Lihat Detail')}
                                                    >
                                                      <Eye className="h-4 w-4" />
                                                    </button>
                                                    {/* Open Button */}
                                                    <button
                                                      onClick={() => {
                                                        setSelectedCabinetForContents(table);
                                                        setShowCabinetContentsModal(true);
                                                      }}
                                                      className="px-3 py-1.5 bg-white hover:bg-indigo-600 hover:text-white border border-gray-200 hover:border-indigo-600 rounded-lg text-xs font-medium text-gray-600 transition-all flex items-center gap-1.5 shrink-0"
                                                    >
                                                      <FolderOpen className="h-3.5 w-3.5" />
                                                      <span>{getText('Open', 'Buka')}</span>
                                                    </button>
                                                  </div>
                                                </div>

                                                {/* Bottom Row: Stats */}
                                                <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                                                  <div className="flex items-center gap-1.5" title={getText('Total Racks', 'Total Rak')}>
                                                    <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                                      <Archive className="h-3.5 w-3.5" />
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-700">{table.racks?.length || 0}</span>
                                                    <span className="text-xs text-gray-400 font-medium">{getText('Racks', 'Rak')}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1.5" title={getText('Total Boxes', 'Total Box')}>
                                                    <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                      <Box className="h-3.5 w-3.5" />
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-700">{table.racks?.reduce((acc, r) => acc + (r.boxes?.length || 0), 0) || 0}</span>
                                                    <span className="text-xs text-gray-400 font-medium">{getText('Boxes', 'Box')}</span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group">
                                          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 group-hover:bg-indigo-100">
                                            <Database className="h-8 w-8 text-gray-300 group-hover:text-indigo-400" />
                                          </div>
                                          <h3 className="text-gray-900 font-bold mb-1">{getText('No cabinets yet', 'Belum ada kabinet')}</h3>
                                          <p className="text-sm text-gray-500 max-w-xs mx-auto mb-6">{getText('Add a cabinet to start organizing racks and boxes.', 'Tambah kabinet untuk mulai mengatur rak dan box.')}</p>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingTabel(null);
                                              setSelectedTabelRoomId(room.id);
                                              setTabelForm({ name: '', description: '', rack: '', room_id: room.id, attachments: '' });
                                              setCabinetImagePreview('');
                                              setShowTabelModal(true);
                                            }}
                                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:border-indigo-400 hover:text-indigo-600 rounded-xl text-sm font-medium transition-all shadow-sm"
                                          >
                                            {getText('Create First Cabinet', 'Buat Kabinet Pertama')}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div >
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50 relative">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="absolute top-4 left-4 p-2 bg-white border border-gray-200 shadow-sm rounded-lg hover:bg-gray-50 text-gray-500 hover:text-blue-600 flex items-center gap-2 transition-all font-medium text-sm"
              >
                <Menu className="h-4 w-4" />
                {getText('Show Menu', 'Tampilkan Menu')}
              </button>
            )}
            <div className="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center mb-6">
              <LayoutDashboard className="h-10 w-10 text-slate-300" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{getText('Select a Building', 'Pilih Gedung')}</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              {getText(
                'Select a campus from the sidebar, then choose a building to manage its floors, rooms, and cabinets.',
                'Pilih kampus dari sidebar, kemudian pilih gedung untuk mengelola lantai, ruangan, dan kabinet.'
              )}
            </p>
          </div>
        )}
      </main >

      {/* --- MODALS --- */}

      {/* Campus Modal */}
      {
        showCampusModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-slate-700 to-slate-800 text-white flex justify-between items-center">
                <h3 className="font-bold text-lg">{editingCampus ? getText('Edit Campus', 'Edit Kampus') : getText('New Campus', 'Kampus Baru')}</h3>
                <button onClick={() => setShowCampusModal(false)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Name', 'Nama')} <span className="text-red-500">*</span></label>
                  <input type="text" value={campusForm.name} onChange={e => setCampusForm({ ...campusForm, name: e.target.value })} placeholder="e.g. Main Campus" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Location', 'Lokasi')} <span className="text-red-500">*</span></label>
                  <input type="text" value={campusForm.location} onChange={e => setCampusForm({ ...campusForm, location: e.target.value })} placeholder="e.g. Jl. Example No. 123" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Description', 'Deskripsi')}</label>
                  <textarea value={campusForm.description} onChange={e => setCampusForm({ ...campusForm, description: e.target.value })} placeholder="Optional description..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white resize-none" rows={3} />
                </div>

                {/* GPS Coordinates Section */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <label className="text-sm font-semibold text-gray-700">{getText('GPS Coordinates', 'Koordinat GPS')}</label>
                    <span className="text-xs text-gray-400">({getText('for attendance validation', 'untuk validasi presensi')})</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{getText('Get coordinates from Google Maps: Right-click on location → Copy coordinates', 'Dapatkan koordinat dari Google Maps: Klik kanan lokasi → Salin koordinat')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{getText('Latitude', 'Latitude')}</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={campusForm.latitude}
                        onChange={e => setCampusForm({ ...campusForm, latitude: e.target.value ? parseFloat(e.target.value) : '' })}
                        placeholder="-7.852950"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{getText('Longitude', 'Longitude')}</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={campusForm.longitude}
                        onChange={e => setCampusForm({ ...campusForm, longitude: e.target.value ? parseFloat(e.target.value) : '' })}
                        placeholder="110.164950"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">{getText('Allowed Radius (meters)', 'Radius Diizinkan (meter)')}</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="100"
                        max="5000"
                        value={campusForm.radius_meters}
                        onChange={e => setCampusForm({ ...campusForm, radius_meters: parseInt(e.target.value) || 1000 })}
                        placeholder="1000"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white text-sm pr-16"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">{getText('meters', 'meter')}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{getText('Default 1000m (1km). Attendance allowed within this radius.', 'Default 1000m (1km). Presensi diizinkan dalam radius ini.')}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                {editingCampus ? (
                  <button onClick={async () => {
                    const result = await Swal.fire({ title: getText('Delete this campus?', 'Hapus kampus ini?'), text: getText('All buildings and rooms will also be deleted!', 'Semua gedung dan ruangan juga akan terhapus!'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: getText('Yes, Delete', 'Ya, Hapus') });
                    if (result.isConfirmed) {
                      await supabase.from('campus').delete().eq('id', editingCampus.id);
                      if (selectedCampusId === editingCampus.id) { setSelectedCampusId(null); setSelectedBuildingId(null); }
                      setShowCampusModal(false); fetchData();
                      Swal.fire('Deleted', getText('Campus deleted', 'Kampus dihapus'), 'success');
                    }
                  }} className="px-4 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg flex items-center gap-1.5 transition-colors">
                    <Trash2 className="h-4 w-4" /> {getText('Delete', 'Hapus')}
                  </button>
                ) : <div />}
                <div className="flex gap-2">
                  <button onClick={() => setShowCampusModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">{getText('Cancel', 'Batal')}</button>
                  <button onClick={async () => {
                    if (!campusForm.name || !campusForm.location) { Swal.fire('Warning', getText('Please fill required fields', 'Isi field yang wajib'), 'warning'); return; }
                    try {
                      // Prepare data - convert empty strings to null for numeric fields
                      const dataToSave = {
                        name: campusForm.name,
                        location: campusForm.location,
                        description: campusForm.description,
                        latitude: campusForm.latitude === '' ? null : campusForm.latitude,
                        longitude: campusForm.longitude === '' ? null : campusForm.longitude,
                        radius_meters: campusForm.radius_meters || 1000
                      };
                      if (editingCampus) await supabase.from('campus').update(dataToSave).eq('id', editingCampus.id);
                      else await supabase.from('campus').insert([dataToSave]);
                      setShowCampusModal(false); fetchData();
                      Swal.fire({ icon: 'success', title: getText('Saved!', 'Tersimpan!'), timer: 1500, showConfirmButton: false });
                    } catch (e) {  Swal.fire('Error', getText('Failed to save', 'Gagal menyimpan'), 'error'); }
                  }} className="px-5 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-900 shadow-sm transition-all flex items-center gap-1.5">
                    <Save className="h-4 w-4" /> {getText('Save', 'Simpan')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Building Modal */}
      {
        showBuildingModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  <h3 className="font-bold text-lg">{editingBuilding ? getText('Edit Building', 'Edit Gedung') : getText('New Building', 'Gedung Baru')}</h3>
                </div>
                <button onClick={() => setShowBuildingModal(false)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <input type="hidden" value={buildingForm.campus_id} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Name', 'Nama')} <span className="text-red-500">*</span></label>
                  <input type="text" value={buildingForm.name} onChange={e => setBuildingForm({ ...buildingForm, name: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all" placeholder="e.g. Gedung F.MIPA" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Code', 'Kode')} <span className="text-red-500">*</span></label>
                  <input type="text" value={buildingForm.code} onChange={e => setBuildingForm({ ...buildingForm, code: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all" placeholder="e.g. G-MIPA" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Description', 'Deskripsi')}</label>
                  <textarea value={buildingForm.description} onChange={e => setBuildingForm({ ...buildingForm, description: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white resize-none transition-all" rows={3} placeholder="Optional description..." />
                </div>
                {/* Photo Upload Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {getText('Building Photo', 'Foto Gedung')} <span className="text-gray-400 text-xs font-normal">({getText('optional', 'opsional')})</span>
                  </label>
                  {buildingImagePreview ? (
                    <div className="relative">
                      <img
                        src={buildingImagePreview}
                        alt="Building preview"
                        className="w-full h-40 object-cover rounded-xl border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={clearBuildingImage}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg transition-colors"
                        title={getText('Remove Photo', 'Hapus Foto')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <span className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded-lg">
                        {getText('Photo attached', 'Foto terlampir')}
                      </span>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">
                          <span className="font-medium text-blue-600">{getText('Click to upload', 'Klik untuk upload')}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{getText('PNG, JPG up to 5MB', 'PNG, JPG maksimal 5MB')}</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleBuildingImageChange}
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                {editingBuilding ? (
                  <button onClick={async () => {
                    const result = await Swal.fire({ title: getText('Delete this building?', 'Hapus gedung ini?'), text: getText('All rooms and cabinets in this building will also be deleted!', 'Semua ruangan dan kabinet di gedung ini juga akan terhapus!'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: getText('Yes, Delete', 'Ya, Hapus') });
                    if (result.isConfirmed) {
                      await supabase.from('building').delete().eq('id', editingBuilding.id);
                      if (selectedBuildingId === editingBuilding.id) setSelectedBuildingId(null);
                      setShowBuildingModal(false); fetchData();
                      Swal.fire('Deleted', getText('Building deleted', 'Gedung dihapus'), 'success');
                    }
                  }} className="px-4 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg flex items-center gap-1.5 transition-colors">
                    <Trash2 className="h-4 w-4" /> {getText('Delete', 'Hapus')}
                  </button>
                ) : <div />}
                <div className="flex gap-2">
                  <button onClick={() => setShowBuildingModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">{getText('Cancel', 'Batal')}</button>
                  <button onClick={async () => {
                    if (!buildingForm.name || !buildingForm.code) {
                      Swal.fire('Warning', getText('Please fill required fields', 'Isi field yang wajib'), 'warning');
                      return;
                    }


                    try {
                      if (editingBuilding) {

                        const updateData = {
                          name: buildingForm.name.trim(),
                          code: buildingForm.code.trim(),
                          description: buildingForm.description?.trim() || '',
                          campus_id: buildingForm.campus_id,
                          attachments: buildingForm.attachments || null
                        };


                        const { data, error } = await supabase
                          .from('building')
                          .update(updateData)
                          .eq('id', editingBuilding.id)
                          .select();


                        if (error) {
                          throw error;
                        }


                      } else {

                        const { data, error } = await supabase
                          .from('building')
                          .insert([buildingForm])
                          .select();


                        if (error) {
                          throw error;
                        }

                      }

                      setShowBuildingModal(false);
                      await fetchData();
                      Swal.fire({
                        icon: 'success',
                        title: getText('Saved!', 'Tersimpan!'),
                        timer: 1500,
                        showConfirmButton: false
                      });

                    } catch (e: any) {
                      Swal.fire(
                        'Error',
                        getText('Failed to save', 'Gagal menyimpan') + ': ' + (e.message || 'Unknown'),
                        'error'
                      );
                    }
                  }} className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-all flex items-center gap-1.5">
                    <Save className="h-4 w-4" /> {getText('Save', 'Simpan')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Room Modal (Create & Assign) */}
      {
        showRoomModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transition-all">
              <div className="p-5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <DoorOpen className="h-5 w-5" />
                  <h3 className="font-bold text-lg">{editingRoom ? getText('Edit Room', 'Edit Ruangan') : getText('New Room', 'Ruangan Baru')}</h3>
                </div>
                <button onClick={() => { setShowRoomModal(false); setSelectedAssignRooms([]); setAssignTargetFloor(''); }} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
              </div>
              {!editingRoom && (
                <div className="flex border-b border-gray-100">
                  <button
                    onClick={() => setRoomModalMode('create')}
                    className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${roomModalMode === 'create' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    {getText('Create New', 'Buat Baru')}
                  </button>
                  <button
                    onClick={() => setRoomModalMode('assign')}
                    className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${roomModalMode === 'assign' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    {getText('Assign Existing', 'Pindahkan')}
                  </button>
                </div>
              )}

              {roomModalMode === 'create' ? (
                <div className="p-6 space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Floor', 'Lantai')} <span className="text-red-500">*</span></label>
                      <input type="text" value={roomForm.floor} onChange={e => setRoomForm({ ...roomForm, floor: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-teal-500 transition-all font-medium text-gray-700" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Capacity', 'Kapasitas')} <span className="text-red-500">*</span></label>
                      <input type="number" value={roomForm.capacity} onChange={e => setRoomForm({ ...roomForm, capacity: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 focus:bg-white transition-all" />
                    </div>
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Room Name', 'Nama Ruangan')} <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={roomNameInput || roomForm.name}
                      onChange={e => handleRoomNameChange(e.target.value)}
                      onFocus={() => roomNameInput.length >= 1 && setShowRoomSuggestions(true)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 focus:bg-white transition-all"
                      placeholder={getText('Type to search or enter new name...', 'Ketik untuk mencari atau masukkan nama baru...')}
                      autoFocus
                    />
                    {/* Autocomplete Dropdown */}
                    {showRoomSuggestions && filteredRoomSuggestions.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        <div className="p-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                          <span className="text-xs text-gray-500 font-medium">{getText('Suggestions from schedules', 'Saran dari jadwal')}</span>
                        </div>
                        {filteredRoomSuggestions.slice(0, 10).map((suggestion, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleRoomNameSelect(suggestion)}
                            className="px-4 py-2.5 hover:bg-teal-50 cursor-pointer text-sm text-gray-700 hover:text-teal-700 transition-colors flex items-center gap-2"
                          >
                            <DoorOpen className="h-4 w-4 text-gray-400" />
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{getText('Room Code', 'Kode Ruangan')} <span className="text-red-500">*</span></label>
                    <input type="text" value={roomForm.code} onChange={e => setRoomForm({ ...roomForm, code: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 focus:bg-white transition-all" placeholder="e.g. LAB-K1" />
                  </div>
                  {editingRoom && (
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-800">{getText('Room Availability', 'Ketersediaan Ruangan')}</label>
                        <p className="text-xs text-gray-500 mt-0.5">{getText('Toggle to enable/disable for booking', 'Aktifkan/nonaktifkan untuk pemesanan')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const newStatus = !editingRoom.is_available;
                          await supabase.from('rooms').update({ is_available: newStatus }).eq('id', editingRoom.id);
                          setEditingRoom({ ...editingRoom, is_available: newStatus });
                          fetchData();
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editingRoom.is_available ? 'bg-emerald-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${editingRoom.is_available ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  )}
                  {/* Photo Upload Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {getText('Room Photo', 'Foto Ruangan')} <span className="text-gray-400 text-xs font-normal">({getText('optional', 'opsional')})</span>
                    </label>
                    {roomImagePreview ? (
                      <div className="relative">
                        <img
                          src={roomImagePreview}
                          alt="Room preview"
                          className="w-full h-32 object-cover rounded-xl border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={clearRoomImage}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg transition-colors"
                          title={getText('Remove Photo', 'Hapus Foto')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <span className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded-lg">
                          {getText('Photo attached', 'Foto terlampir')}
                        </span>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50/50 transition-all">
                        <div className="flex flex-col items-center justify-center pt-3 pb-3">
                          <Upload className="h-6 w-6 text-gray-400 mb-1" />
                          <p className="text-xs text-gray-500">
                            <span className="font-medium text-teal-600">{getText('Click to upload', 'Klik untuk upload')}</span>
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{getText('PNG, JPG up to 5MB', 'PNG, JPG maksimal 5MB')}</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleRoomImageChange}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 h-[400px] flex flex-col">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Target Location', 'Lokasi Tujuan')}</label>
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800 flex items-center gap-2 mb-3">
                      <Building2 className="h-4 w-4" />
                      <span className="font-semibold">{selectedBuilding?.name}</span>
                    </div>

                    {/* Floor Selection Input */}
                    <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Target Floor', 'Lantai Tujuan')} <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      list="assign-floor-options"
                      value={assignTargetFloor}
                      onChange={e => setAssignTargetFloor(e.target.value)}
                      placeholder={getText('Select or type floor', 'Pilih atau ketik lantai')}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 focus:bg-white transition-all mb-2"
                    />
                    <datalist id="assign-floor-options">
                      {availableFloorsForAssign.map(floor => (
                        <option key={floor} value={floor} />
                      ))}
                    </datalist>
                  </div>
                  <div className="relative flex-1 flex flex-col min-h-0">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Search Room to Move', 'Cari Ruangan untuk Dipindah')}</label>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={roomSearchTerm}
                        onChange={e => setRoomSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Type room name or code..."
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto border rounded-lg bg-gray-50 divide-y divide-gray-100">
                      {allRooms
                        .filter(r =>
                          !roomSearchTerm ||
                          r.name.toLowerCase().includes(roomSearchTerm.toLowerCase()) ||
                          r.code.toLowerCase().includes(roomSearchTerm.toLowerCase())
                        )
                        .filter(r => r.floor !== targetFloor || r.building_id !== selectedBuildingId) // Exclude rooms already here
                        .slice(0, 50)
                        .map(room => {
                          const currentB = buildings.find(b => b.id === room.building_id);
                          const currentC = campuses.find(c => c.id === currentB?.campus_id);
                          return (
                            <div
                              key={room.id}
                              onClick={() => {
                                const isSelected = selectedAssignRooms.some(r => r.id === room.id);
                                setSelectedAssignRooms(prev => isSelected ? prev.filter(r => r.id !== room.id) : [...prev, room]);
                              }}
                              className={`p-3 cursor-pointer text-sm transition-all border rounded-xl mb-2 flex items-center justify-between group ${selectedAssignRooms.some(r => r.id === room.id) ? 'bg-teal-50 border-teal-200 shadow-sm' : 'border-transparent hover:bg-white border-gray-100'}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedAssignRooms.some(r => r.id === room.id) ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-300 bg-white group-hover:border-teal-300'}`}>
                                  {selectedAssignRooms.some(r => r.id === room.id) && <CheckSquare className="h-3.5 w-3.5" />}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-800">{room.name} <span className="text-gray-400 font-mono text-xs font-normal">({room.code})</span></div>
                                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                    <MapPin className="h-3 w-3" />
                                    {currentC?.name || '?'} • {currentB?.name || '?'} • {room.floor}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                {editingRoom ? (
                  <button onClick={async () => {
                    const result = await Swal.fire({ title: getText('Delete Room?', 'Hapus Ruangan?'), text: getText('All cabinets will also be deleted', 'Semua kabinet juga akan terhapus'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
                    if (result.isConfirmed) {
                      await supabase.from('rooms').delete().eq('id', editingRoom.id);
                      setShowRoomModal(false); fetchData();
                      Swal.fire('Deleted', getText('Room deleted', 'Ruangan dihapus'), 'success');
                    }
                  }} className="px-4 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg flex items-center gap-1.5 transition-colors">
                    <Trash2 className="h-4 w-4" /> {getText('Delete', 'Hapus')}
                  </button>
                ) : <div />}
                <div className="flex gap-2">
                  <button onClick={() => { setShowRoomModal(false); setSelectedAssignRooms([]); setAssignTargetFloor(''); }} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">{getText('Cancel', 'Batal')}</button>
                  {roomModalMode === 'create' ? (
                    <button
                      onClick={executeSaveRoom}
                      disabled={loadingRoom}
                      className="px-5 py-2 bg-teal-500 text-white font-medium rounded-lg hover:bg-teal-600 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingRoom ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {editingRoom ? getText('Save', 'Simpan') : getText('Create', 'Buat')}
                    </button>
                  ) : (
                    <button
                      onClick={executeRoomAssignment}
                      disabled={selectedAssignRooms.length === 0 || loadingRoom}
                      className="px-5 py-2 bg-teal-500 text-white font-medium rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center gap-1.5"
                    >
                      {loadingRoom ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                      {getText('Move', 'Pindahkan')}
                      {selectedAssignRooms.length > 0 && <span className="bg-teal-600 px-1.5 py-0.5 rounded text-xs ml-1">{selectedAssignRooms.length}</span>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Tabel Modal */}
      {
        showTabelModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Table2 className="h-5 w-5" />
                  <h3 className="font-bold text-lg">{editingTabel ? getText('Edit Cabinet', 'Edit Kabinet') : getText('New Cabinet', 'Kabinet Baru')}</h3>
                </div>
                <button onClick={() => { setShowTabelModal(false); setCabinetModalMode('manual'); setSelectedStockForCabinet(null); }} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
              </div>

              {/* - show when not editing */}
              {!editingTabel && (
                <div className="flex border-b border-gray-100">
                  <button
                    onClick={() => setCabinetModalMode('manual')}
                    className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${cabinetModalMode === 'manual' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    {getText('Manual Entry', 'Input Manual')}
                  </button>
                  <button
                    onClick={() => { setCabinetModalMode('claim'); fetchCabinetStock(); }}
                    className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${cabinetModalMode === 'claim' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    {getText('Claim from Stock', 'Ambil dari Stock')}
                  </button>
                </div>
              )}

              {cabinetModalMode === 'manual' ? (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Name', 'Nama')} <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={tabelForm.name}
                      onChange={e => setTabelForm({ ...tabelForm, name: e.target.value })}
                      placeholder="e.g. Cabinet A1, Wardrobe 1"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-gray-50 focus:bg-white transition-all"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Description', 'Deskripsi')} <span className="text-gray-400 text-xs font-normal">({getText('optional', 'opsional')})</span></label>
                    <textarea
                      value={tabelForm.description}
                      onChange={e => setTabelForm({ ...tabelForm, description: e.target.value })}
                      placeholder={getText('Additional notes about this cabinet...', 'Catatan tambahan tentang kabinet ini...')}
                      rows={2}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-gray-50 focus:bg-white transition-all resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Location', 'Lokasi')}</label>
                    <input
                      type="text"
                      value={tabelForm.rack}
                      onChange={e => setTabelForm({ ...tabelForm, rack: e.target.value })}
                      placeholder="e.g. Corner A, Near Window"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-gray-50 focus:bg-white transition-all"
                    />
                  </div>
                  {/* Photo Upload Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {getText('Cabinet Photo', 'Foto Kabinet')} <span className="text-gray-400 text-xs font-normal">({getText('optional', 'opsional')})</span>
                    </label>
                    {cabinetImagePreview ? (
                      <div className="relative">
                        <img
                          src={cabinetImagePreview}
                          alt="Cabinet preview"
                          className="w-full h-32 object-cover rounded-xl border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={clearCabinetImage}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg transition-colors"
                          title={getText('Remove Photo', 'Hapus Foto')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <span className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded-lg">
                          {getText('Photo attached', 'Foto terlampir')}
                        </span>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-all">
                        <div className="flex flex-col items-center justify-center pt-3 pb-3">
                          <Upload className="h-6 w-6 text-gray-400 mb-1" />
                          <p className="text-xs text-gray-500">
                            <span className="font-medium text-orange-600">{getText('Click to upload', 'Klik untuk upload')}</span>
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{getText('PNG, JPG up to 5MB', 'PNG, JPG maksimal 5MB')}</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleCabinetImageChange}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-sm text-orange-800">
                    <p className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      {getText('Claim Cabinet', 'Ambil Lemari')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Select from Stock', 'Pilih dari Stock')} <span className="text-red-500">*</span></label>
                    {availableStockForCabinet.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50">
                        {availableStockForCabinet.map(stock => (
                          <div
                            key={stock.id}
                            onClick={() => { setSelectedStockForCabinet(stock); setClaimQuantity(1); }}
                            className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedStockForCabinet?.id === stock.id ? 'bg-orange-100 border-orange-300' : 'bg-white border-gray-100 hover:border-orange-200'}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-gray-800">{stock.nama}</div>
                                <div className="text-xs text-gray-500">{stock.code} • {stock.category}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-orange-600">{stock.quantity} {stock.unit}</div>
                                <div className="text-xs text-gray-400">{getText('available', 'tersedia')}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{getText('No cabinet stock available', 'Tidak ada stock kabinet tersedia')}</p>
                        <p className="text-xs mt-1">{getText('Add stock with category Cabinet in Tool Administration', 'Tambah stock dengan kategori Cabinet di Tool Administration')}</p>
                      </div>
                    )}
                  </div>
                  {selectedStockForCabinet && (
                    <>
                      <div>
                        <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Quantity to Claim', 'Jumlah yang Diambil')} <span className="text-red-500">*</span></label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min={1}
                            max={selectedStockForCabinet.quantity}
                            value={claimQuantity}
                            onChange={e => setClaimQuantity(Math.min(Math.max(1, parseInt(e.target.value) || 1), selectedStockForCabinet.quantity))}
                            className="w-24 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-gray-50 focus:bg-white transition-all text-center font-bold"
                          />
                          <span className="text-sm text-gray-500">
                            {getText(`of ${selectedStockForCabinet.quantity} ${selectedStockForCabinet.unit} available`, `dari ${selectedStockForCabinet.quantity} ${selectedStockForCabinet.unit} tersedia`)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Location', 'Lokasi')}</label>
                        <input
                          type="text"
                          value={tabelForm.rack}
                          onChange={e => setTabelForm({ ...tabelForm, rack: e.target.value })}
                          placeholder="e.g. Corner A, Near Window"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-gray-50 focus:bg-white transition-all"
                        />
                      </div>
                      {/* Photo Upload Section for Claim Mode */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {getText('Cabinet Photo', 'Foto Kabinet')} <span className="text-gray-400 text-xs font-normal">({getText('optional', 'opsional')})</span>
                        </label>
                        {cabinetImagePreview ? (
                          <div className="relative">
                            <img
                              src={cabinetImagePreview}
                              alt="Cabinet preview"
                              className="w-full h-24 object-cover rounded-xl border border-gray-200"
                            />
                            <button
                              type="button"
                              onClick={clearCabinetImage}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-all">
                            <Upload className="h-5 w-5 text-gray-400 mb-1" />
                            <p className="text-xs text-gray-500">
                              <span className="font-medium text-orange-600">{getText('Click to upload', 'Klik untuk upload')}</span>
                            </p>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={handleCabinetImageChange}
                            />
                          </label>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                {editingTabel ? (
                  <button onClick={async () => {
                    const result = await Swal.fire({ title: getText('Delete Cabinet?', 'Hapus Kabinet?'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
                    if (result.isConfirmed) {
                      await supabase.from('table').delete().eq('id', editingTabel.id);
                      setShowTabelModal(false); fetchData(true);
                      Swal.fire('Deleted', getText('Cabinet deleted', 'Kabinet dihapus'), 'success');
                    }
                  }} className="px-3 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg flex items-center gap-1.5 text-sm transition-colors">
                    <Trash2 className="h-4 w-4" /> {getText('Delete', 'Hapus')}
                  </button>
                ) : <div />}
                <div className="flex gap-2">
                  <button onClick={() => { setShowTabelModal(false); setCabinetModalMode('manual'); setSelectedStockForCabinet(null); setClaimQuantity(1); }} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">{getText('Cancel', 'Batal')}</button>
                  <button
                    onClick={executeSaveCabinet}
                    disabled={(cabinetModalMode === 'claim' && !selectedStockForCabinet) || (loadingCabinet)}
                    className="px-5 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center gap-1.5"
                  >
                    {loadingCabinet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {cabinetModalMode === 'claim' ? getText('Claim', 'Ambil') : getText('Save', 'Simpan')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Rack Modal */}
      {
        showRackModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  <h3 className="font-bold text-lg">{editingRack ? getText('Edit Rack', 'Edit Rak') : getText('New Rack', 'Rak Baru')}</h3>
                </div>
                <button onClick={() => setShowRackModal(false)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Rack Name', 'Nama Rak')} <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={rackForm.name}
                    onChange={e => setRackForm({ ...rackForm, name: e.target.value })}
                    placeholder="e.g. Rack A1, Shelf 01"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-gray-50 focus:bg-white transition-all"
                    autoFocus
                  />
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs text-amber-700 flex items-center gap-1.5">
                    <Archive className="h-3.5 w-3.5" />
                    {getText('Racks organize boxes inside cabinets. You can add boxes after creating the rack.', 'Rak mengatur box di dalam kabinet. Anda bisa menambah box setelah rak dibuat.')}
                  </p>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                {editingRack ? (
                  <button onClick={async () => {
                    const result = await Swal.fire({ title: getText('Delete Rack?', 'Hapus Rak?'), text: getText('All boxes inside will be deleted', 'Semua box di dalamnya akan terhapus'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
                    if (result.isConfirmed) {
                      await supabase.from('rack').delete().eq('id', editingRack.id);
                      setShowRackModal(false); fetchData(true);
                      Swal.fire('Deleted', getText('Rack deleted', 'Rak dihapus'), 'success');
                    }
                  }} className="px-3 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg flex items-center gap-1.5 text-sm transition-colors">
                    <Trash2 className="h-4 w-4" /> {getText('Delete', 'Hapus')}
                  </button>
                ) : <div />}
                <div className="flex gap-2">
                  <button onClick={() => setShowRackModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">{getText('Cancel', 'Batal')}</button>
                  <button
                    onClick={executeSaveRack}
                    disabled={loadingRack}
                    className="px-5 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingRack ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {getText('Save', 'Simpan')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Box Modal */}
      {
        showBoxModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Box className="h-5 w-5" />
                  <h3 className="font-bold text-lg">{editingBox ? getText('Edit Box', 'Edit Box') : getText('New Box', 'Box Baru')}</h3>
                </div>
                <button onClick={() => { setShowBoxModal(false); setBoxModalMode('manual'); setSelectedStockForBox(null); setBoxClaimQuantity(1); }} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
              </div>

              {/* - show when creating new box */}
              {!editingBox && (
                <div className="flex border-b border-gray-100">
                  <button
                    onClick={() => setBoxModalMode('manual')}
                    className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${boxModalMode === 'manual' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    {getText('Manual Entry', 'Input Manual')}
                  </button>
                  <button
                    onClick={() => { setBoxModalMode('claim'); fetchBoxStock(); }}
                    className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${boxModalMode === 'claim' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    {getText('Claim from Stock', 'Ambil dari Stock')}
                  </button>
                </div>
              )}

              {/* Content based on mode */}
              {boxModalMode === 'manual' ? (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Box Name', 'Nama Box')} <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={boxForm.name}
                      onChange={e => setBoxForm({ ...boxForm, name: e.target.value })}
                      placeholder="e.g. Box 001, Container A"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-gray-50 focus:bg-white transition-all"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Description', 'Deskripsi')}</label>
                    <textarea
                      value={boxForm.description}
                      onChange={e => setBoxForm({ ...boxForm, description: e.target.value })}
                      placeholder={getText('What items are stored in this box?', 'Barang apa yang disimpan di box ini?')}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-gray-50 focus:bg-white transition-all resize-none"
                    />
                  </div>
                  {/* Photo Upload Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {getText('Box Photo', 'Foto Box')} <span className="text-gray-400 text-xs font-normal">({getText('optional', 'opsional')})</span>
                    </label>
                    {boxImagePreview ? (
                      <div className="relative">
                        <img
                          src={boxImagePreview}
                          alt="Box preview"
                          className="w-full h-28 object-cover rounded-xl border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={clearBoxImage}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg transition-colors"
                          title={getText('Remove Photo', 'Hapus Foto')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <span className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded-lg">
                          {getText('Photo attached', 'Foto terlampir')}
                        </span>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-all">
                        <div className="flex flex-col items-center justify-center pt-2 pb-2">
                          <Upload className="h-5 w-5 text-gray-400 mb-1" />
                          <p className="text-xs text-gray-500">
                            <span className="font-medium text-emerald-600">{getText('Click to upload', 'Klik untuk upload')}</span>
                          </p>
                          <p className="text-[10px] text-gray-400">{getText('PNG, JPG up to 5MB', 'PNG, JPG maksimal 5MB')}</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleBoxImageChange}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-xs text-emerald-700">
                      <span className="font-medium">{getText('Select box from stock:', 'Pilih box dari stock:')}</span> {getText('Stock quantity will be reduced automatically', 'Jumlah stock akan berkurang otomatis')}
                    </p>
                  </div>

                  {/* Stock List */}
                  <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-100 rounded-xl p-2 bg-gray-50">
                    {availableStockForBox.length > 0 ? (
                      availableStockForBox.map(stock => (
                        <div
                          key={stock.id}
                          onClick={() => { setSelectedStockForBox(stock); setBoxClaimQuantity(1); }}
                          className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedStockForBox?.id === stock.id ? 'bg-emerald-100 border-emerald-300' : 'bg-white border-gray-100 hover:border-emerald-200'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-emerald-600" />
                              <span className="font-medium text-gray-900 text-sm">{stock.nama}</span>
                            </div>
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                              {stock.quantity} {stock.unit}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{stock.code} • {stock.category}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{getText('No box stock available', 'Tidak ada stock box tersedia')}</p>
                        <p className="text-xs mt-1">{getText('Add stock with category Box in Tool Administration', 'Tambah stock dengan kategori Box di Tool Administration')}</p>
                      </div>
                    )}
                  </div>

                  {/* Quantity - only when stock is selected */}
                  {selectedStockForBox && (
                    <div>
                      <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('Quantity to Claim', 'Jumlah yang Diambil')} <span className="text-red-500">*</span></label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={selectedStockForBox.quantity}
                          value={boxClaimQuantity}
                          onChange={e => setBoxClaimQuantity(Math.min(Math.max(1, parseInt(e.target.value) || 1), selectedStockForBox.quantity))}
                          className="w-24 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-gray-50 focus:bg-white transition-all text-center font-bold"
                        />
                        <span className="text-sm text-gray-500">
                          {getText(`of ${selectedStockForBox.quantity} ${selectedStockForBox.unit} available`, `dari ${selectedStockForBox.quantity} ${selectedStockForBox.unit} tersedia`)}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Photo Upload Section for Claim Mode */}
                  {selectedStockForBox && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {getText('Box Photo', 'Foto Box')} <span className="text-gray-400 text-xs font-normal">({getText('optional', 'opsional')})</span>
                      </label>
                      {boxImagePreview ? (
                        <div className="relative">
                          <img src={boxImagePreview} alt="Box preview" className="w-full h-20 object-cover rounded-xl border border-gray-200" />
                          <button type="button" onClick={clearBoxImage} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-all">
                          <Upload className="h-4 w-4 text-gray-400" />
                          <p className="text-xs text-emerald-600 mt-1">{getText('Click to upload', 'Klik untuk upload')}</p>
                          <input type="file" className="hidden" accept="image/*" onChange={handleBoxImageChange} />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                {editingBox ? (
                  <button onClick={async () => {
                    const result = await Swal.fire({ title: getText('Delete Box?', 'Hapus Box?'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
                    if (result.isConfirmed) {
                      await supabase.from('box').delete().eq('id', editingBox.id);
                      setShowBoxModal(false); fetchData(true);
                      Swal.fire('Deleted', getText('Box deleted', 'Box dihapus'), 'success');
                    }
                  }} className="px-3 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg flex items-center gap-1.5 text-sm transition-colors">
                    <Trash2 className="h-4 w-4" /> {getText('Delete', 'Hapus')}
                  </button>
                ) : <div />}
                <div className="flex gap-2">
                  <button onClick={() => { setShowBoxModal(false); setBoxModalMode('manual'); setSelectedStockForBox(null); setBoxClaimQuantity(1); }} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">{getText('Cancel', 'Batal')}</button>
                  <button
                    onClick={executeSaveBox}
                    disabled={(boxModalMode === 'claim' && !selectedStockForBox) || loadingBox}
                    className="px-5 py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center gap-1.5"
                  >
                    {loadingBox ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {boxModalMode === 'claim' ? getText('Claim', 'Ambil') : getText('Save', 'Simpan')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Room Detail Modal */}
      {
        showRoomDetailModal && selectedRoomDetail && (() => {
          // Calculate room stats
          const cabinetsCount = selectedRoomDetail.tables?.length || 0;
          const department = departments.find(d => d.id === selectedRoomDetail.department_id);

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="h-5 w-5" />
                    <h3 className="font-bold text-lg">{getText('Room Details', 'Detail Ruangan')}</h3>
                  </div>
                  <button onClick={() => setShowRoomDetailModal(false)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                  {/* Room Photo - Lazy loaded */}
                  {loadingAttachment ? (
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 text-center border border-teal-100">
                      <div className="w-16 h-16 mx-auto bg-teal-100 rounded-full flex items-center justify-center mb-3">
                        <Loader2 className="h-8 w-8 text-teal-500 animate-spin" />
                      </div>
                      <h4 className="font-bold text-xl text-gray-800">{selectedRoomDetail.name}</h4>
                      <p className="text-gray-500 text-sm">{selectedRoomDetail.code}</p>
                      <p className="text-xs text-teal-500 mt-2">{getText('Loading photo...', 'Memuat foto...')}</p>
                    </div>
                  ) : roomAttachment ? (
                    <div className="relative rounded-xl overflow-hidden shadow-lg">
                      <img
                        src={roomAttachment}
                        alt={selectedRoomDetail.name}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                        <div>
                          <h4 className="text-white font-bold text-xl drop-shadow-lg">{selectedRoomDetail.name}</h4>
                          <p className="text-white/90 text-sm drop-shadow-md">{selectedRoomDetail.code}</p>
                        </div>
                        <button
                          onClick={() => setFullscreenPhoto(roomAttachment || null)}
                          className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-lg text-white transition-all shadow-lg"
                          title={getText('View Full Image', 'Lihat Gambar Penuh')}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 text-center border border-teal-100">
                      <div className="w-16 h-16 mx-auto bg-teal-100 rounded-full flex items-center justify-center mb-3">
                        <DoorOpen className="h-8 w-8 text-teal-500" />
                      </div>
                      <h4 className="font-bold text-xl text-gray-800">{selectedRoomDetail.name}</h4>
                      <p className="text-gray-500 text-sm">{selectedRoomDetail.code}</p>
                      <p className="text-xs text-teal-500 mt-2 italic">{getText('No photo available', 'Tidak ada foto')}</p>
                    </div>
                  )}

                  {/* Room Location Info */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm font-medium">{getText('Location', 'Lokasi')}</span>
                    </div>
                    <p className="text-gray-800 font-medium">{selectedBuilding?.name} • {selectedRoomDetail.floor}</p>
                    {department && (
                      <p className="text-gray-500 text-sm mt-1">{getText('Department', 'Departemen')}: {department.name}</p>
                    )}
                  </div>

                  {/* Room Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                      <div className="flex items-center gap-2 text-blue-600 mb-1">
                        <Users className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">{getText('Capacity', 'Kapasitas')}</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">{selectedRoomDetail.capacity || 0}</p>
                    </div>
                    <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
                      <div className="flex items-center gap-2 text-violet-600 mb-1">
                        <Archive className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">{getText('Cabinets', 'Kabinet')}</span>
                      </div>
                      <p className="text-2xl font-bold text-violet-700">{cabinetsCount}</p>
                    </div>
                  </div>

                  {/* Availability Status */}
                  <div className={`rounded-xl p-4 border ${selectedRoomDetail.is_available ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedRoomDetail.is_available ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {selectedRoomDetail.is_available ? (
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <X className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className={`font-medium ${selectedRoomDetail.is_available ? 'text-emerald-700' : 'text-red-700'}`}>
                          {selectedRoomDetail.is_available ? getText('Available', 'Tersedia') : getText('Not Available', 'Tidak Tersedia')}
                        </p>
                        <p className={`text-xs ${selectedRoomDetail.is_available ? 'text-emerald-600' : 'text-red-600'}`}>
                          {selectedRoomDetail.is_available ? getText('Room can be booked', 'Ruangan dapat dipesan') : getText('Room is not available for booking', 'Ruangan tidak tersedia untuk pemesanan')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Room ID */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
                    <span className="text-xs text-gray-400 font-mono">ID: {selectedRoomDetail.id}</span>
                  </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                  <button
                    onClick={() => setShowRoomDetailModal(false)}
                    className="px-5 py-2 bg-teal-500 text-white font-medium rounded-lg hover:bg-teal-600 shadow-sm transition-all"
                  >
                    {getText('Close', 'Tutup')}
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      }

      {/* Edit Floor Modal */}
      {
        showEditFloorModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  <h3 className="font-bold text-lg">{getText('Edit Floor', 'Edit Lantai')}</h3>
                </div>
                <button onClick={() => setShowEditFloorModal(false)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-purple-800">
                  <p className="font-medium mb-1">{getText('Current Floor:', 'Lantai Saat Ini:')} <span className="font-bold">{originalFloorName}</span></p>
                  <p className="text-purple-600">{getText('Renaming will update all rooms on this floor.', 'Mengganti nama akan memperbarui semua ruangan di lantai ini.')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5 text-gray-700">{getText('New Floor Name', 'Nama Lantai Baru')} <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editingFloorName}
                    onChange={e => setEditingFloorName(e.target.value)}
                    placeholder="e.g. Lantai 1, Ground Floor"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-gray-50 focus:bg-white transition-all"
                    autoFocus
                  />
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <button onClick={async () => {
                  const roomsOnFloor = groupedRooms[originalFloorName]?.length || 0;
                  const result = await Swal.fire({
                    title: getText('Delete this floor?', 'Hapus lantai ini?'),
                    text: getText(`This will delete all ${roomsOnFloor} rooms and their cabinets!`, `Ini akan menghapus semua ${roomsOnFloor} ruangan dan kabinetnya!`),
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    confirmButtonText: getText('Yes, Delete All', 'Ya, Hapus Semua')
                  });
                  if (result.isConfirmed) {
                    // Delete all rooms on this floor
                    const roomIds = groupedRooms[originalFloorName]?.map(r => r.id) || [];
                    if (roomIds.length > 0) {
                      await supabase.from('rooms').delete().in('id', roomIds);
                    }
                    setShowEditFloorModal(false);
                    fetchData();
                    Swal.fire('Deleted', getText('Floor and all rooms deleted', 'Lantai dan semua ruangan dihapus'), 'success');
                  }
                }} className="px-4 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg flex items-center gap-1.5 transition-colors">
                  <Trash2 className="h-4 w-4" /> {getText('Delete Floor', 'Hapus Lantai')}
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setShowEditFloorModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">{getText('Cancel', 'Batal')}</button>
                  <button onClick={async () => {
                    if (!editingFloorName.trim()) { Swal.fire('Warning', getText('Please enter floor name', 'Masukkan nama lantai'), 'warning'); return; }
                    if (editingFloorName.trim() === originalFloorName) { setShowEditFloorModal(false); return; }
                    try {
                      // Update all rooms on this floor with the new floor name
                      const roomIds = groupedRooms[originalFloorName]?.map(r => r.id) || [];
                      if (roomIds.length > 0) {
                        await supabase.from('rooms').update({ floor: editingFloorName.trim() }).in('id', roomIds);
                      }
                      setShowEditFloorModal(false);
                      fetchData();
                      Swal.fire({ icon: 'success', title: getText('Floor renamed!', 'Lantai diganti nama!'), timer: 1500, showConfirmButton: false });
                    } catch (e) {  Swal.fire('Error', getText('Failed to rename floor', 'Gagal mengganti nama lantai'), 'error'); }
                  }} className="px-5 py-2 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 shadow-sm transition-all flex items-center gap-1.5">
                    <Save className="h-4 w-4" /> {getText('Save', 'Simpan')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Cabinet Contents Modal (Racks & Boxes) */}
      {
        showCabinetContentsModal && selectedCabinetForContents && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <Table2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{selectedCabinetForContents.description || getText('Cabinet Details', 'Detail Kabinet')}</h3>
                    <div className="flex items-center gap-3 text-indigo-100 text-xs">
                      {selectedCabinetForContents.rack && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedCabinetForContents.rack}</span>}
                      <span className="flex items-center gap-1"><Archive className="h-3 w-3" /> {selectedCabinetForContents.racks?.length || 0} {getText('Racks', 'Rak')}</span>
                      <span className="flex items-center gap-1"><Box className="h-3 w-3" /> {selectedCabinetForContents.racks?.reduce((acc, r) => acc + (r.boxes?.length || 0), 0) || 0} {getText('Boxes', 'Box')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Delete Button */}
                  <button
                    onClick={async () => {
                      const result = await Swal.fire({
                        title: getText('Delete Cabinet?', 'Hapus Kabinet?'),
                        text: getText('All racks and boxes inside will also be deleted!', 'Semua rak dan box di dalamnya juga akan terhapus!'),
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#ef4444',
                        confirmButtonText: getText('Yes, Delete', 'Ya, Hapus'),
                        cancelButtonText: getText('Cancel', 'Batal')
                      });
                      if (result.isConfirmed) {
                        await supabase.from('table').delete().eq('id', selectedCabinetForContents.id);
                        setShowCabinetContentsModal(false);
                        setSelectedCabinetForContents(null);
                        fetchData();
                        Swal.fire({
                          icon: 'success',
                          title: getText('Deleted!', 'Terhapus!'),
                          text: getText('Cabinet has been deleted', 'Kabinet telah dihapus'),
                          timer: 1500,
                          showConfirmButton: false
                        });
                      }
                    }}
                    className="p-2 text-white/70 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                    title={getText('Delete Cabinet', 'Hapus Kabinet')}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                  {/* Close Button */}
                  <button
                    onClick={() => setShowCabinetContentsModal(false)}
                    className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Content Body */}
              <div className="flex-1 overflow-y-auto bg-gray-50 p-6">

                {/* Racks Header & Add Button */}
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <Archive className="h-5 w-5 text-indigo-500" />
                    {getText('Storage Racks', 'Rak Penyimpanan')}
                  </h4>
                  <div className="flex items-center gap-2">
                    {/* Multi-select toggle */}
                    <button
                      onClick={() => {
                        if (isMultiSelectMode) {
                          clearSelection();
                        } else {
                          setIsMultiSelectMode(true);
                        }
                      }}
                      className={`px-3 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-2 ${isMultiSelectMode
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {isMultiSelectMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      {isMultiSelectMode ? getText('Cancel Select', 'Batal Pilih') : getText('Select Multiple', 'Pilih Beberapa')}
                    </button>

                    {/* Batch move - show when items are selected */}
                    {isMultiSelectMode && selectedItemsForMove.size > 0 && (
                      <button
                        onClick={() => setShowBatchMoveModal(true)}
                        className="px-3 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 shadow-sm transition-all flex items-center gap-2"
                      >
                        <Move className="h-4 w-4" />
                        {getText('Move', 'Pindahkan')} ({selectedItemsForMove.size})
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setEditingRack(null);
                        setSelectedRackTableId(selectedCabinetForContents.id);
                        setRackForm({ name: '', table_id: selectedCabinetForContents.id });
                        setShowRackModal(true);
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      {getText('Add New Rack', 'Tambah Rak Baru')}
                    </button>
                  </div>
                </div>

                {/* Drag & Drop Info Banner */}
                {!isMultiSelectMode && (
                  <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl">
                    <p className="text-xs text-blue-700 flex items-center gap-2">
                      <GripVertical className="h-4 w-4" />
                      <span className="font-medium">{getText('Tip:', 'Tips:')}</span>
                      {getText('Drag and drop boxes between racks to move them, or use multi-select for batch operations.', 'Seret dan lepas box antar rak untuk memindahkannya, atau gunakan pilih beberapa untuk operasi massal.')}
                    </p>
                  </div>
                )}

                {/* Racks List */}
                {selectedCabinetForContents.racks && selectedCabinetForContents.racks.length > 0 ? (
                  <div className="space-y-4">
                    {selectedCabinetForContents.racks.map(rack => (
                      <div key={rack.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-300">
                        {/* Rack Header Bar */}
                        <div
                          className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${expandedRacks[rack.id] ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}
                          onClick={() => setExpandedRacks(prev => ({ ...prev, [rack.id]: !prev[rack.id] }))}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${expandedRacks[rack.id] ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                              <Archive className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <h5 className="font-bold text-gray-800">{rack.name}</h5>
                              <div className="flex items-center gap-3">
                                <p className="text-sm text-gray-500">{rack.boxes?.length || 0} {getText('Boxes stored', 'Box tersimpan')}</p>
                                {/* Capacity progress bar */}
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${(rack.boxes?.length || 0) >= 10 ? 'bg-red-500' :
                                        (rack.boxes?.length || 0) >= 7 ? 'bg-amber-500' :
                                          (rack.boxes?.length || 0) > 0 ? 'bg-emerald-500' : 'bg-gray-300'
                                        }`}
                                      style={{ width: `${Math.min((rack.boxes?.length || 0) * 10, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`text-[10px] font-medium ${(rack.boxes?.length || 0) >= 10 ? 'text-red-600' :
                                    (rack.boxes?.length || 0) >= 7 ? 'text-amber-600' : 'text-gray-400'
                                    }`}>
                                    {(rack.boxes?.length || 0) >= 10 ? getText('Full', 'Penuh') : ''}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingRack(rack); setSelectedRackTableId(rack.table_id); setRackForm(rack); setShowRackModal(true); }}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title={getText('Edit Rack', 'Edit Rak')}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const result = await Swal.fire({ title: getText('Delete Rack?', 'Hapus Rak?'), text: getText('All boxes inside will be deleted', 'Semua box di dalamnya akan terhapus'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
                                if (result.isConfirmed) {
                                  await supabase.from('rack').delete().eq('id', rack.id);
                                  fetchData(true);
                                  Swal.fire('Deleted', getText('Rack deleted', 'Rak dihapus'), 'success');
                                }
                              }}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={getText('Delete Rack', 'Hapus Rak')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <div className={`transform transition-transform duration-300 ${expandedRacks[rack.id] ? 'rotate-180' : ''}`}>
                              <ChevronDown className="h-5 w-5 text-gray-400" />
                            </div>
                          </div>
                        </div>

                        {/* Expanded Content: Boxes */}
                        {expandedRacks[rack.id] && (
                          <div
                            className={`p-5 border-t border-gray-100 bg-gray-50/30 animate-in slide-in-from-top-2 transition-all ${dragOverRackId === rack.id ? 'bg-indigo-100 ring-2 ring-indigo-400 ring-inset' : ''
                              }`}
                            onDragOver={(e) => handleDragOver(e, rack.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, rack.id)}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                {getText('Boxes in this rack', 'Box di rak ini')}
                                {dragOverRackId === rack.id && (
                                  <span className="text-indigo-600 normal-case font-medium animate-pulse">
                                    ← {getText('Drop here', 'Lepas di sini')}
                                  </span>
                                )}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingBox(null);
                                  setSelectedBoxRackId(rack.id);
                                  setBoxForm({ name: '', description: '', rack_id: rack.id, attachments: '' });
                                  setBoxImagePreview('');
                                  setShowBoxModal(true);
                                }}
                                className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-200"
                              >
                                <Plus className="h-3.5 w-3.5" /> {getText('Add Box', 'Tambah Box')}
                              </button>
                            </div>

                            {/* Boxes Grid */}
                            {rack.boxes && rack.boxes.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {rack.boxes.map(box => (
                                  <div
                                    key={box.id}
                                    draggable={!isMultiSelectMode}
                                    onDragStart={(e) => handleDragStart(e, box)}
                                    className={`group bg-white rounded-xl border p-3 transition-all relative cursor-grab active:cursor-grabbing ${selectedItemsForMove.has(box.id)
                                      ? 'border-violet-400 bg-violet-50 shadow-md ring-2 ring-violet-200'
                                      : draggedBox?.id === box.id
                                        ? 'border-indigo-400 opacity-50 shadow-lg'
                                        : 'border-gray-200 hover:border-emerald-400 hover:shadow-md'
                                      }`}
                                    onClick={() => isMultiSelectMode && toggleItemSelection(box.id)}
                                  >
                                    {/* Multi-select checkbox */}
                                    {isMultiSelectMode && (
                                      <div className="absolute top-2 left-2 z-10">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); toggleItemSelection(box.id); }}
                                          className={`w-5 h-5 rounded flex items-center justify-center transition-all ${selectedItemsForMove.has(box.id)
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-gray-100 border border-gray-300 hover:border-violet-400'
                                            }`}
                                        >
                                          {selectedItemsForMove.has(box.id) && <CheckCircle className="h-3.5 w-3.5" />}
                                        </button>
                                      </div>
                                    )}

                                    {/* Drag handle */}
                                    {!isMultiSelectMode && (
                                      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                                        <GripVertical className="h-4 w-4" />
                                      </div>
                                    )}

                                    <div className={`flex items-start gap-3 ${isMultiSelectMode ? 'pl-6' : ''}`}>
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${selectedItemsForMove.has(box.id)
                                        ? 'bg-violet-100 text-violet-600'
                                        : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white'
                                        }`}>
                                        <Box className="h-5 w-5" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <h6 className="font-bold text-gray-800 text-sm truncate pr-6">{box.name}</h6>
                                        {/* ID Badge */}
                                        <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-mono rounded">
                                          {box.id.substring(0, 7)}
                                        </span>
                                        {box.description ? (
                                          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{box.description}</p>
                                        ) : (
                                          <p className="text-[10px] text-gray-300 italic mt-1">{getText('No description', 'Tanpa deskripsi')}</p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Hover Actions */}
                                    {!isMultiSelectMode && (
                                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 p-0.5 rounded-lg shadow-sm">
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            setEditingBox(box);
                                            setSelectedBoxRackId(box.rack_id);
                                            setBoxForm({ name: box.name, description: box.description, rack_id: box.rack_id, attachments: '' });
                                            setBoxImagePreview('');
                                            setShowBoxModal(true);
                                            // Fetch attachment asynchronously
                                            const { data } = await supabase.from('box').select('attachments').eq('id', box.id).single();
                                            if (data?.attachments) {
                                              setBoxForm(prev => ({ ...prev, attachments: data.attachments }));
                                              setBoxImagePreview(data.attachments);
                                            }
                                          }}
                                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                          title="Edit"
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setSelectedBoxDetail(box); fetchBoxAttachment(box.id); setShowBoxDetailModal(true); }}
                                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                                          title={getText('View Details', 'Lihat Detail')}
                                        >
                                          <Eye className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const result = await Swal.fire({ title: getText('Delete Box?', 'Hapus Box?'), icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
                                            if (result.isConfirmed) {
                                              await supabase.from('box').delete().eq('id', box.id);
                                              fetchData(true);
                                            }
                                          }}
                                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                          title="Delete"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div
                                className={`text-center py-10 rounded-xl border-2 border-dashed transition-all ${dragOverRackId === rack.id
                                  ? 'border-indigo-400 bg-indigo-50'
                                  : 'border-gray-200 bg-gradient-to-b from-gray-50 to-white'
                                  }`}
                                onDragOver={(e) => handleDragOver(e, rack.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, rack.id)}
                              >
                                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-teal-50 rounded-2xl flex items-center justify-center shadow-sm">
                                  <FolderOpen className="h-8 w-8 text-emerald-400" />
                                </div>
                                <h5 className="text-base font-semibold text-gray-700 mb-1">
                                  {getText('No boxes yet', 'Belum ada box')}
                                </h5>
                                <p className="text-sm text-gray-400 max-w-xs mx-auto mb-4">
                                  {getText(
                                    'Add your first box to start organizing items, or drag a box here from another rack.',
                                    'Tambah box pertama untuk mulai mengatur barang, atau seret box ke sini dari rak lain.'
                                  )}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingBox(null);
                                    setSelectedBoxRackId(rack.id);
                                    setBoxForm({ name: '', description: '', rack_id: rack.id, attachments: '' });
                                    setBoxImagePreview('');
                                    setShowBoxModal(true);
                                  }}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 shadow-sm shadow-emerald-200 transition-all"
                                >
                                  <Sparkles className="h-4 w-4" />
                                  {getText('Add First Box', 'Tambah Box Pertama')}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <Archive className="h-10 w-10 text-indigo-300" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">{getText('This cabinet is empty', 'Kabinet ini kosong')}</h4>
                    <p className="text-gray-500 max-w-sm mx-auto mb-6">
                      {getText('Start by adding a rack to organize your items.', 'Mulai dengan menambahkan rak untuk mengatur barang-barang Anda.')}
                    </p>
                    <button
                      onClick={() => {
                        setEditingRack(null);
                        setSelectedRackTableId(selectedCabinetForContents.id);
                        setRackForm({ name: '', table_id: selectedCabinetForContents.id });
                        setShowRackModal(true);
                      }}
                      className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 transition-all flex items-center gap-2 mx-auto"
                    >
                      <Plus className="h-5 w-5" />
                      {getText('Create First Rack', 'Buat Rak Pertama')}
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setShowCabinetContentsModal(false)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  {getText('Close', 'Tutup')}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Batch Move Modal */}
      {
        showBatchMoveModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-violet-600 to-purple-600 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Move className="h-5 w-5" />
                  <h3 className="font-bold text-lg">{getText('Move Boxes', 'Pindahkan Box')}</h3>
                </div>
                <button onClick={() => setShowBatchMoveModal(false)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                  <p className="text-sm text-violet-800 font-medium mb-1">
                    {getText('Selected Items', 'Item Terpilih')}: <span className="font-bold">{selectedItemsForMove.size}</span>
                  </p>
                  <p className="text-xs text-violet-600">
                    {getText('Choose a target rack to move all selected boxes.', 'Pilih rak tujuan untuk memindahkan semua box yang dipilih.')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{getText('Target Rack', 'Rak Tujuan')}</label>
                  <select
                    value={batchMoveTargetRack}
                    onChange={(e) => setBatchMoveTargetRack(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-gray-50 focus:bg-white transition-all"
                  >
                    <option value="">{getText('-- Select a rack --', '-- Pilih rak --')}</option>
                    {selectedCabinetForContents?.racks?.map(rack => (
                      <option key={rack.id} value={rack.id}>
                        {rack.name} ({rack.boxes?.length || 0} {getText('boxes', 'box')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                <button
                  onClick={() => { setShowBatchMoveModal(false); clearSelection(); }}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {getText('Cancel', 'Batal')}
                </button>
                <button
                  onClick={executeBatchMove}
                  disabled={!batchMoveTargetRack || loadingBatchMove}
                  className="px-5 py-2 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center gap-1.5"
                >
                  {loadingBatchMove ? <Loader2 className="h-4 w-4 animate-spin" /> : <Move className="h-4 w-4" />}
                  {getText('Move', 'Pindahkan')} ({selectedItemsForMove.size})
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Building Detail Modal */}
      {
        showBuildingDetailModal && selectedBuildingDetail && (() => {
          // Calculate building stats
          const buildingRooms = selectedBuildingDetail.rooms || [];
          const floorsSet = new Set(buildingRooms.map(r => r.floor).filter(Boolean));
          const floorsCount = floorsSet.size;
          const roomsCount = buildingRooms.length;
          const totalCapacity = buildingRooms.reduce((sum, r) => sum + (r.capacity || 0), 0);
          const cabinetsCount = buildingRooms.reduce((sum, r) => sum + (r.tables?.length || 0), 0);

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    <h3 className="font-bold text-lg">{getText('Building Details', 'Detail Gedung')}</h3>
                  </div>
                  <button onClick={() => setShowBuildingDetailModal(false)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"><X className="h-5 w-5" /></button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                  {/* Building Photo - Lazy loaded */}
                  {loadingAttachment ? (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 text-center border border-blue-100">
                      <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-3">
                        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                      </div>
                      <h4 className="font-bold text-xl text-gray-800">{selectedBuildingDetail.name}</h4>
                      <p className="text-gray-500 text-sm">{selectedBuildingDetail.code}</p>
                      <p className="text-xs text-blue-500 mt-2">{getText('Loading photo...', 'Memuat foto...')}</p>
                    </div>
                  ) : buildingAttachment ? (
                    <div className="relative rounded-xl overflow-hidden shadow-lg">
                      <img
                        src={buildingAttachment}
                        alt={selectedBuildingDetail.name}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                        <div>
                          <h4 className="text-white font-bold text-xl drop-shadow-lg">{selectedBuildingDetail.name}</h4>
                          <p className="text-white/90 text-sm drop-shadow-md">{selectedBuildingDetail.code}</p>
                        </div>
                        <button
                          onClick={() => setFullscreenPhoto(buildingAttachment || null)}
                          className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-lg text-white transition-all shadow-lg"
                          title={getText('View Full Image', 'Lihat Gambar Penuh')}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 text-center border border-blue-100">
                      <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-3">
                        <Building2 className="h-8 w-8 text-blue-500" />
                      </div>
                      <h4 className="font-bold text-xl text-gray-800">{selectedBuildingDetail.name}</h4>
                      <p className="text-gray-500 text-sm">{selectedBuildingDetail.code}</p>
                      <p className="text-xs text-blue-500 mt-2 italic">{getText('No photo available', 'Tidak ada foto')}</p>
                    </div>
                  )}

                  {/* Building Info */}
                  {selectedBuildingDetail.description && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-sm text-gray-600">{selectedBuildingDetail.description}</p>
                    </div>
                  )}

                  {/* Building Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                      <div className="flex items-center gap-2 text-emerald-600 mb-1">
                        <Layers className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">{getText('Floors', 'Lantai')}</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-700">{floorsCount}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                      <div className="flex items-center gap-2 text-blue-600 mb-1">
                        <DoorOpen className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">{getText('Rooms', 'Ruangan')}</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">{roomsCount}</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                      <div className="flex items-center gap-2 text-amber-600 mb-1">
                        <Users className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">{getText('Capacity', 'Kapasitas')}</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-700">{totalCapacity}</p>
                    </div>
                    <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
                      <div className="flex items-center gap-2 text-violet-600 mb-1">
                        <Archive className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">{getText('Cabinets', 'Kabinet')}</span>
                      </div>
                      <p className="text-2xl font-bold text-violet-700">{cabinetsCount}</p>
                    </div>
                  </div>

                  {/* Floors List */}
                  {floorsCount > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">{getText('Floor List', 'Daftar Lantai')}</h5>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(floorsSet).sort().map(floor => (
                          <span key={floor} className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 shadow-sm">
                            {floor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                  <button
                    onClick={() => setShowBuildingDetailModal(false)}
                    className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-all"
                  >
                    {getText('Close', 'Tutup')}
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      }

      {/* Cabinet Detail Modal */}
      {
        showCabinetDetailModal && selectedCabinetDetail && (() => {
          // Parse name and description from combined field
          const parts = (selectedCabinetDetail.description || '').split(' | ');
          const cabinetName = parts[0] || getText('Cabinet', 'Kabinet');
          const cabinetDesc = parts.length > 1 ? parts.slice(1).join(' | ') : '';
          const racksCount = selectedCabinetDetail.racks?.length || 0;
          const boxesCount = selectedCabinetDetail.racks?.reduce((acc, r) => acc + (r.boxes?.length || 0), 0) || 0;

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="p-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Table2 className="h-5 w-5" />
                    <h3 className="font-bold text-lg">{getText('Cabinet Details', 'Detail Kabinet')}</h3>
                  </div>
                  <button onClick={() => setShowCabinetDetailModal(false)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                  {/* Cabinet Photo - Lazy loaded */}
                  {loadingAttachment ? (
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 text-center border border-orange-100">
                      <div className="w-16 h-16 mx-auto bg-orange-100 rounded-full flex items-center justify-center mb-3">
                        <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
                      </div>
                      <h4 className="font-bold text-xl text-gray-800">{cabinetName}</h4>
                      {selectedCabinetDetail.rack && <p className="text-gray-500 text-sm">{selectedCabinetDetail.rack}</p>}
                      <p className="text-xs text-orange-500 mt-2">{getText('Loading photo...', 'Memuat foto...')}</p>
                    </div>
                  ) : cabinetAttachment ? (
                    <div className="relative rounded-xl overflow-hidden shadow-lg">
                      <img
                        src={cabinetAttachment}
                        alt={cabinetName}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                        <div>
                          <h4 className="text-white font-bold text-xl drop-shadow-lg">{cabinetName}</h4>
                          {selectedCabinetDetail.rack && <p className="text-white/90 text-sm drop-shadow-md">{selectedCabinetDetail.rack}</p>}
                        </div>
                        <button
                          onClick={() => setFullscreenPhoto(cabinetAttachment || null)}
                          className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-lg text-white transition-all shadow-lg"
                          title={getText('View Full Image', 'Lihat Gambar Penuh')}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 text-center border border-orange-100">
                      <div className="w-16 h-16 mx-auto bg-orange-100 rounded-full flex items-center justify-center mb-3">
                        <Table2 className="h-8 w-8 text-orange-500" />
                      </div>
                      <h4 className="font-bold text-xl text-gray-800">{cabinetName}</h4>
                      {selectedCabinetDetail.rack && <p className="text-gray-500 text-sm">{selectedCabinetDetail.rack}</p>}
                      <p className="text-xs text-orange-500 mt-2 italic">{getText('No photo available', 'Tidak ada foto')}</p>
                    </div>
                  )}

                  {/* Description */}
                  {cabinetDesc && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-sm text-gray-600">{cabinetDesc}</p>
                    </div>
                  )}

                  {/* Cabinet Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                      <div className="flex items-center gap-2 text-indigo-600 mb-1">
                        <Archive className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">{getText('Racks', 'Rak')}</span>
                      </div>
                      <p className="text-2xl font-bold text-indigo-700">{racksCount}</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                      <div className="flex items-center gap-2 text-emerald-600 mb-1">
                        <Box className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">{getText('Boxes', 'Box')}</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-700">{boxesCount}</p>
                    </div>
                  </div>

                  {/* Location Info */}
                  {selectedCabinetDetail.rack && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm font-medium">{getText('Location', 'Lokasi')}</span>
                      </div>
                      <p className="text-gray-800 font-medium">{selectedCabinetDetail.rack}</p>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                  <button
                    onClick={() => setShowCabinetDetailModal(false)}
                    className="px-5 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 shadow-sm transition-all"
                  >
                    {getText('Close', 'Tutup')}
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      }

      {/* Box Detail Modal */}
      {
        showBoxDetailModal && selectedBoxDetail && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Box className="h-5 w-5" />
                  <h3 className="font-bold text-lg">{getText('Box Details', 'Detail Box')}</h3>
                </div>
                <button onClick={() => setShowBoxDetailModal(false)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Box Photo - Lazy loaded */}
                {loadingAttachment ? (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 text-center border border-emerald-100">
                    <div className="w-14 h-14 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                      <Loader2 className="h-7 w-7 text-emerald-500 animate-spin" />
                    </div>
                    <h4 className="font-bold text-lg text-gray-800">{selectedBoxDetail.name}</h4>
                    <p className="text-xs text-emerald-500 mt-1">{getText('Loading photo...', 'Memuat foto...')}</p>
                  </div>
                ) : boxAttachment ? (
                  <div className="relative rounded-xl overflow-hidden shadow-lg">
                    <img
                      src={boxAttachment}
                      alt={selectedBoxDetail.name}
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <div>
                        <h4 className="text-white font-bold text-lg drop-shadow-lg">{selectedBoxDetail.name}</h4>
                      </div>
                      <button
                        onClick={() => setFullscreenPhoto(boxAttachment || null)}
                        className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-lg text-white transition-all shadow-lg"
                        title={getText('View Full Image', 'Lihat Gambar Penuh')}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 text-center border border-emerald-100">
                    <div className="w-14 h-14 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                      <Box className="h-7 w-7 text-emerald-500" />
                    </div>
                    <h4 className="font-bold text-lg text-gray-800">{selectedBoxDetail.name}</h4>
                    <p className="text-xs text-emerald-500 mt-1 italic">{getText('No photo available', 'Tidak ada foto')}</p>
                  </div>
                )}

                {/* Box ID */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">{getText('Box ID:', 'ID Box:')}</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-mono rounded">{selectedBoxDetail.id.substring(0, 8)}...</span>
                </div>

                {/* Description */}
                {selectedBoxDetail.description && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-1">{getText('Description', 'Deskripsi')}</p>
                    <p className="text-sm text-gray-700">{selectedBoxDetail.description}</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button
                  onClick={() => setShowBoxDetailModal(false)}
                  className="px-5 py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 shadow-sm transition-all"
                >
                  {getText('Close', 'Tutup')}
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Fullscreen Photo Preview Modal */}
      {
        fullscreenPhoto && (
          <div
            className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-zoom-out"
            onClick={() => setFullscreenPhoto(null)}
          >
            <button
              onClick={() => setFullscreenPhoto(null)}
              className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full text-white transition-all"
              title={getText('Close', 'Tutup')}
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={fullscreenPhoto}
              alt="Fullscreen preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )
      }

      {/* Room Excel Upload Modal */}
      <RoomExcelUploadModal
        isOpen={showRoomExcelModal}
        onClose={() => setShowRoomExcelModal(false)}
        onSuccess={() => fetchData(true)}
        campusId={selectedCampusId || ''}
        campusName={selectedCampus?.name || ''}
      />

      {/* QR Code Modal */}
      <RoomQRModal
        isOpen={showQRModal}
        room={selectedRoomForQR}
        onClose={() => setShowQRModal(false)}
      />
    </div >
  );
};

export default LocationManagement;