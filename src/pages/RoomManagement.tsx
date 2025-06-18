import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building,
  Plus,
  Search,
  Filter,
  Grid,
  List,
  Edit,
  Trash2,
  Copy,
  Eye,
  Users,
  MapPin,
  Zap,
  CheckCircle,
  AlertCircle,
  Clock,
  Settings,
  Upload,
  Download,
  MoreHorizontal,
  X,
  Save,
  Camera,
  FileText,
  Calendar,
  BarChart3,
  Wifi,
  Monitor,
  Volume2,
  Projector,
  Mic,
  AirVent,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Star,
  TrendingUp,
  Activity,
  RefreshCw,
  Package,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Room, Department } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const roomSchema = z.object({
  name: z.string().min(2, 'Room name must be at least 2 characters'),
  code: z.string().min(2, 'Room code must be at least 2 characters'),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  optimal_capacity: z.number().min(1, 'Optimal capacity must be at least 1'),
  department_id: z.string().min(1, 'Please select a department'),
  room_type: z.enum(['classroom', 'lab', 'auditorium', 'meeting_room']),
  layout_style: z.enum(['theater', 'u_shape', 'classroom', 'lab_setup']),
  building: z.string().min(1, 'Building is required'),
  floor: z.string().min(1, 'Floor is required'),
  room_number: z.string().min(1, 'Room number is required'),
  description: z.string().optional(),
  usage_guidelines: z.string().optional(),
  operating_hours_start: z.string(),
  operating_hours_end: z.string(),
  available_days: z.array(z.string()),
  is_available: z.boolean(),
  fixed_equipment: z.object({
    air_conditioning: z.boolean(),
    ac_brand: z.string().optional(),
    projector: z.boolean(),
    projector_specs: z.string().optional(),
    sound_system: z.boolean(),
    sound_specs: z.string().optional(),
    whiteboard: z.boolean(),
    whiteboard_size: z.string().optional(),
  }),
  available_equipment: z.array(z.string()),
});

type RoomForm = z.infer<typeof roomSchema>;

interface RoomWithDetails extends Room {
  department: Department;
  booking_count?: number;
  usage_percentage?: number;
  last_booking?: string;
}

const RoomManagement: React.FC = () => {
  const [rooms, setRooms] = useState<RoomWithDetails[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showForm, setShowForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomWithDetails | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showRoomDetail, setShowRoomDetail] = useState<RoomWithDetails | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [filterFloor, setFilterFloor] = useState('');
  const [filterCapacity, setFilterCapacity] = useState<[number, number]>([0, 200]);
  const [filterEquipment, setFilterEquipment] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('');

  const form = useForm<RoomForm>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      is_available: true,
      available_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      operating_hours_start: '08:00',
      operating_hours_end: '17:00',
      fixed_equipment: {
        air_conditioning: false,
        projector: false,
        sound_system: false,
        whiteboard: false,
      },
      available_equipment: [],
    },
  });

  useEffect(() => {
    fetchRooms();
    fetchDepartments();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          *,
          department:departments(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Add mock statistics for demo
      const roomsWithStats = data?.map(room => ({
        ...room,
        booking_count: Math.floor(Math.random() * 50) + 10,
        usage_percentage: Math.floor(Math.random() * 80) + 20,
        last_booking: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      })) || [];

      setRooms(roomsWithStats);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    }
  };

  const onSubmit = async (data: RoomForm) => {
    try {
      setLoading(true);

      // Prepare equipment array from fixed and available equipment
      const equipment = [];
      if (data.fixed_equipment.air_conditioning) equipment.push('Air Conditioning');
      if (data.fixed_equipment.projector) equipment.push('Projector');
      if (data.fixed_equipment.sound_system) equipment.push('Sound System');
      if (data.fixed_equipment.whiteboard) equipment.push('Whiteboard');
      equipment.push(...data.available_equipment);

      const roomData = {
        name: data.name,
        code: data.code,
        capacity: data.capacity,
        department_id: data.department_id,
        equipment,
        is_available: data.is_available,
      };

      if (editingRoom) {
        const { error } = await supabase
          .from('rooms')
          .update(roomData)
          .eq('id', editingRoom.id);

        if (error) throw error;
        toast.success('Room updated successfully!');
      } else {
        const { error } = await supabase
          .from('rooms')
          .insert(roomData);

        if (error) throw error;
        toast.success('Room created successfully!');
      }

      setShowForm(false);
      setEditingRoom(null);
      form.reset();
      fetchRooms();
    } catch (error: any) {
      console.error('Error saving room:', error);
      toast.error(error.message || 'Failed to save room');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (room: RoomWithDetails) => {
    setEditingRoom(room);
    form.reset({
      name: room.name,
      code: room.code,
      capacity: room.capacity,
      optimal_capacity: room.capacity - 5,
      department_id: room.department_id,
      room_type: 'classroom',
      layout_style: 'classroom',
      building: 'Building A',
      floor: '1',
      room_number: room.code.split('-')[1] || '101',
      description: '',
      usage_guidelines: '',
      operating_hours_start: '08:00',
      operating_hours_end: '17:00',
      available_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      is_available: room.is_available,
      fixed_equipment: {
        air_conditioning: room.equipment.includes('Air Conditioning'),
        projector: room.equipment.includes('Projector'),
        sound_system: room.equipment.includes('Sound System'),
        whiteboard: room.equipment.includes('Whiteboard'),
      },
      available_equipment: room.equipment.filter(eq => 
        !['Air Conditioning', 'Projector', 'Sound System', 'Whiteboard'].includes(eq)
      ),
    });
    setShowForm(true);
  };

  const handleDelete = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;

    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId);

      if (error) throw error;
      toast.success('Room deleted successfully!');
      fetchRooms();
    } catch (error: any) {
      console.error('Error deleting room:', error);
      toast.error(error.message || 'Failed to delete room');
    }
  };

  const handleClone = (room: RoomWithDetails) => {
    form.reset({
      name: `${room.name} (Copy)`,
      code: `${room.code}-COPY`,
      capacity: room.capacity,
      optimal_capacity: room.capacity - 5,
      department_id: room.department_id,
      room_type: 'classroom',
      layout_style: 'classroom',
      building: 'Building A',
      floor: '1',
      room_number: room.code.split('-')[1] || '101',
      description: '',
      usage_guidelines: '',
      operating_hours_start: '08:00',
      operating_hours_end: '17:00',
      available_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      is_available: room.is_available,
      fixed_equipment: {
        air_conditioning: room.equipment.includes('Air Conditioning'),
        projector: room.equipment.includes('Projector'),
        sound_system: room.equipment.includes('Sound System'),
        whiteboard: room.equipment.includes('Whiteboard'),
      },
      available_equipment: room.equipment.filter(eq => 
        !['Air Conditioning', 'Projector', 'Sound System', 'Whiteboard'].includes(eq)
      ),
    });
    setEditingRoom(null);
    setShowForm(true);
  };

  const handleBulkStatusChange = async (status: boolean) => {
    if (selectedRooms.length === 0) {
      toast.error('Please select rooms first');
      return;
    }

    try {
      const { error } = await supabase
        .from('rooms')
        .update({ is_available: status })
        .in('id', selectedRooms);

      if (error) throw error;
      toast.success(`${selectedRooms.length} rooms updated successfully!`);
      setSelectedRooms([]);
      fetchRooms();
    } catch (error: any) {
      console.error('Error updating rooms:', error);
      toast.error(error.message || 'Failed to update rooms');
    }
  };

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.department?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCapacity = room.capacity >= filterCapacity[0] && room.capacity <= filterCapacity[1];
    
    const matchesEquipment = filterEquipment.length === 0 || 
                            filterEquipment.every(eq => room.equipment.includes(eq));
    
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'available' && room.is_available) ||
                         (filterStatus === 'unavailable' && !room.is_available);
    
    const matchesDepartment = !filterDepartment || room.department_id === filterDepartment;

    return matchesSearch && matchesCapacity && matchesEquipment && matchesStatus && matchesDepartment;
  });

  const getStatusColor = (room: RoomWithDetails) => {
    if (!room.is_available) return 'bg-red-100 text-red-800';
    if (room.usage_percentage && room.usage_percentage > 80) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (room: RoomWithDetails) => {
    if (!room.is_available) return 'Unavailable';
    if (room.usage_percentage && room.usage_percentage > 80) return 'High Usage';
    return 'Available';
  };

  const getEquipmentIcon = (equipment: string) => {
    switch (equipment.toLowerCase()) {
      case 'projector': return Projector;
      case 'air conditioning': return AirVent;
      case 'sound system': return Volume2;
      case 'whiteboard': return FileText;
      case 'microphone': return Mic;
      case 'wifi': return Wifi;
      case 'monitor': return Monitor;
      default: return Zap;
    }
  };

  const availableEquipmentOptions = [
    'HDMI Cable', 'VGA Cable', 'USB-C Hub', 'Wireless Microphone',
    'Lapel Microphone', 'Bluetooth Speaker', 'Portable Speaker',
    'Laptop (Backup)', 'Tablet', 'Document Camera', 'Webcam HD',
    'Extension Cord', 'Power Strip', 'Whiteboard Markers', 'Laser Pointer'
  ];

  const buildings = ['Building A', 'Building B', 'Building C', 'Building D'];
  const floors = ['1', '2', '3', '4', '5'];

  if (loading && rooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Building className="h-8 w-8" />
              <span>Room Management</span>
            </h1>
            <p className="mt-2 opacity-90">
              Manage rooms, equipment, and availability across all departments
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{rooms.length}</div>
            <div className="text-sm opacity-80">Total Rooms</div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setEditingRoom(null);
                form.reset();
                setShowForm(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5" />
              <span>Add Room</span>
            </button>
            
            {selectedRooms.length > 0 && (
              <>
                <button
                  onClick={() => handleBulkStatusChange(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  <CheckCircle className="h-5 w-5" />
                  <span>Enable Selected ({selectedRooms.length})</span>
                </button>
                <button
                  onClick={() => handleBulkStatusChange(false)}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                >
                  <AlertCircle className="h-5 w-5" />
                  <span>Disable Selected ({selectedRooms.length})</span>
                </button>
              </>
            )}

            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200">
              <Upload className="h-5 w-5" />
              <span>Import</span>
            </button>
            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200">
              <Download className="h-5 w-5" />
              <span>Export</span>
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 ${showFilters ? 'bg-blue-50 border-blue-300' : ''}`}
            >
              <Filter className="h-5 w-5" />
            </button>

            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <Grid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <List className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Building</label>
                <select
                  value={filterBuilding}
                  onChange={(e) => setFilterBuilding(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Buildings</option>
                  {buildings.map(building => (
                    <option key={building} value={building}>{building}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity: {filterCapacity[0]} - {filterCapacity[1]}
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={filterCapacity[1]}
                  onChange={(e) => setFilterCapacity([filterCapacity[0], parseInt(e.target.value)])}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Room Grid/List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredRooms.map((room) => (
              <div
                key={room.id}
                className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 group"
              >
                {/* Room Image Placeholder */}
                <div className="relative h-32 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg mb-4 flex items-center justify-center">
                  <Building className="h-12 w-12 text-blue-600" />
                  <div className="absolute top-2 left-2">
                    <input
                      type="checkbox"
                      checked={selectedRooms.includes(room.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRooms([...selectedRooms, room.id]);
                        } else {
                          setSelectedRooms(selectedRooms.filter(id => id !== room.id));
                        }
                      }}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room)}`}>
                      {getStatusText(room)}
                    </span>
                  </div>
                </div>

                {/* Room Info */}
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{room.name}</h3>
                    <p className="text-sm text-gray-600">{room.code}</p>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4" />
                      <span>{room.capacity} seats</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>{room.department?.name}</span>
                    </div>
                  </div>

                  {/* Equipment Icons */}
                  <div className="flex flex-wrap gap-1">
                    {room.equipment.slice(0, 4).map((eq, index) => {
                      const IconComponent = getEquipmentIcon(eq);
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-center w-6 h-6 bg-gray-100 rounded text-gray-600"
                          title={eq}
                        >
                          <IconComponent className="h-3 w-3" />
                        </div>
                      );
                    })}
                    {room.equipment.length > 4 && (
                      <div className="flex items-center justify-center w-6 h-6 bg-gray-100 rounded text-gray-600 text-xs">
                        +{room.equipment.length - 4}
                      </div>
                    )}
                  </div>

                  {/* Usage Stats */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Usage</span>
                      <span>{room.usage_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${room.usage_percentage}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setShowRoomDetail(room)}
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      <Eye className="h-4 w-4" />
                      <span>View</span>
                    </button>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleEdit(room)}
                        className="p-1 text-gray-600 hover:text-blue-600 transition-colors duration-200"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleClone(room)}
                        className="p-1 text-gray-600 hover:text-green-600 transition-colors duration-200"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(room.id)}
                        className="p-1 text-gray-600 hover:text-red-600 transition-colors duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedRooms.includes(room.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRooms([...selectedRooms, room.id]);
                      } else {
                        setSelectedRooms(selectedRooms.filter(id => id !== room.id));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg">
                    <Building className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{room.name}</h3>
                    <p className="text-sm text-gray-600">{room.code} • {room.department?.name}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900">{room.capacity}</div>
                    <div className="text-xs text-gray-500">Capacity</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900">{room.equipment.length}</div>
                    <div className="text-xs text-gray-500">Equipment</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900">{room.usage_percentage}%</div>
                    <div className="text-xs text-gray-500">Usage</div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room)}`}>
                    {getStatusText(room)}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowRoomDetail(room)}
                      className="p-2 text-gray-600 hover:text-blue-600 transition-colors duration-200"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(room)}
                      className="p-2 text-gray-600 hover:text-blue-600 transition-colors duration-200"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleClone(room)}
                      className="p-2 text-gray-600 hover:text-green-600 transition-colors duration-200"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room.id)}
                      className="p-2 text-gray-600 hover:text-red-600 transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredRooms.length === 0 && (
          <div className="text-center py-12">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No rooms found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>

      {/* Room Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingRoom ? 'Edit Room' : 'Add New Room'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingRoom(null);
                  form.reset();
                }}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-8">
              {/* Basic Information */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                  <Building className="h-5 w-5" />
                  <span>Basic Information</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room Name *
                    </label>
                    <input
                      {...form.register('name')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Computer Lab A"
                    />
                    {form.formState.errors.name && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room Code *
                    </label>
                    <input
                      {...form.register('code')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., LAB-A101"
                    />
                    {form.formState.errors.code && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.code.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department *
                    </label>
                    <select
                      {...form.register('department_id')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                    {form.formState.errors.department_id && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.department_id.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room Type *
                    </label>
                    <select
                      {...form.register('room_type')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="classroom">Classroom</option>
                      <option value="lab">Laboratory</option>
                      <option value="auditorium">Auditorium</option>
                      <option value="meeting_room">Meeting Room</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Building *
                    </label>
                    <select
                      {...form.register('building')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {buildings.map(building => (
                        <option key={building} value={building}>{building}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Floor *
                    </label>
                    <select
                      {...form.register('floor')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {floors.map(floor => (
                        <option key={floor} value={floor}>Floor {floor}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Capacity & Layout */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Capacity & Layout</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Capacity *
                    </label>
                    <input
                      {...form.register('capacity', { valueAsNumber: true })}
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form.formState.errors.capacity && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.capacity.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Optimal Capacity *
                    </label>
                    <input
                      {...form.register('optimal_capacity', { valueAsNumber: true })}
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Layout Style *
                    </label>
                    <select
                      {...form.register('layout_style')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="theater">Theater Style</option>
                      <option value="u_shape">U-Shape</option>
                      <option value="classroom">Classroom Style</option>
                      <option value="lab_setup">Lab Setup</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room Number *
                    </label>
                    <input
                      {...form.register('room_number')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 101"
                    />
                  </div>
                </div>
              </div>

              {/* Fixed Equipment */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Fixed Equipment</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        {...form.register('fixed_equipment.air_conditioning')}
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <AirVent className="h-5 w-5 text-gray-600" />
                      <label className="text-sm font-medium text-gray-700">Air Conditioning</label>
                    </div>
                    {form.watch('fixed_equipment.air_conditioning') && (
                      <input
                        {...form.register('fixed_equipment.ac_brand')}
                        type="text"
                        placeholder="Brand/Model"
                        className="ml-7 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        {...form.register('fixed_equipment.projector')}
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <Projector className="h-5 w-5 text-gray-600" />
                      <label className="text-sm font-medium text-gray-700">Built-in Projector</label>
                    </div>
                    {form.watch('fixed_equipment.projector') && (
                      <input
                        {...form.register('fixed_equipment.projector_specs')}
                        type="text"
                        placeholder="Specifications"
                        className="ml-7 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        {...form.register('fixed_equipment.sound_system')}
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <Volume2 className="h-5 w-5 text-gray-600" />
                      <label className="text-sm font-medium text-gray-700">Sound System</label>
                    </div>
                    {form.watch('fixed_equipment.sound_system') && (
                      <input
                        {...form.register('fixed_equipment.sound_specs')}
                        type="text"
                        placeholder="Amplifier details"
                        className="ml-7 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        {...form.register('fixed_equipment.whiteboard')}
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <FileText className="h-5 w-5 text-gray-600" />
                      <label className="text-sm font-medium text-gray-700">Whiteboard/Smartboard</label>
                    </div>
                    {form.watch('fixed_equipment.whiteboard') && (
                      <input
                        {...form.register('fixed_equipment.whiteboard_size')}
                        type="text"
                        placeholder="Size (e.g., 4x3 feet)"
                        className="ml-7 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Available Equipment */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Available Equipment (Borrowable)</span>
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {availableEquipmentOptions.map((equipment) => (
                    <div key={equipment} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        value={equipment}
                        {...form.register('available_equipment')}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label className="text-sm text-gray-700">{equipment}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Availability Settings */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Availability Settings</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Operating Hours
                    </label>
                    <div className="flex space-x-2">
                      <input
                        {...form.register('operating_hours_start')}
                        type="time"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="flex items-center text-gray-500">to</span>
                      <input
                        {...form.register('operating_hours_end')}
                        type="time"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Available Days
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                        <div key={day} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            value={day}
                            {...form.register('available_days')}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label className="text-sm text-gray-700 capitalize">{day}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    {...form.register('is_available')}
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-700">Room is currently available for booking</label>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Additional Information</span>
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room Description
                    </label>
                    <textarea
                      {...form.register('description')}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Describe the room's features and special characteristics..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Usage Guidelines
                    </label>
                    <textarea
                      {...form.register('usage_guidelines')}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter any special rules or restrictions for using this room..."
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingRoom(null);
                    form.reset();
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {loading ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  <span>{loading ? 'Saving...' : (editingRoom ? 'Update Room' : 'Create Room')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Detail Modal */}
      {showRoomDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {showRoomDetail.name} Details
              </h2>
              <button
                onClick={() => setShowRoomDetail(null)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* Room Image Gallery */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Room Images</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="aspect-video bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center">
                      <Camera className="h-12 w-12 text-blue-600" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Specifications */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">Specifications</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Room Code:</span>
                      <span className="font-medium">{showRoomDetail.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Department:</span>
                      <span className="font-medium">{showRoomDetail.department?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Capacity:</span>
                      <span className="font-medium">{showRoomDetail.capacity} seats</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Equipment Count:</span>
                      <span className="font-medium">{showRoomDetail.equipment.length} items</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(showRoomDetail)}`}>
                        {getStatusText(showRoomDetail)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">Usage Statistics</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-600">Usage Rate:</span>
                        <span className="font-medium">{showRoomDetail.usage_percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${showRoomDetail.usage_percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Bookings:</span>
                      <span className="font-medium">{showRoomDetail.booking_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Booking:</span>
                      <span className="font-medium">
                        {showRoomDetail.last_booking ? format(new Date(showRoomDetail.last_booking), 'MMM d, yyyy') : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Equipment List */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Available Equipment</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {showRoomDetail.equipment.map((eq, index) => {
                    const IconComponent = getEquipmentIcon(eq);
                    return (
                      <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                        <IconComponent className="h-5 w-5 text-gray-600" />
                        <span className="text-sm text-gray-900">{eq}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Booking Calendar Placeholder */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Booking Calendar</h3>
                <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">Calendar view coming soon</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomManagement;