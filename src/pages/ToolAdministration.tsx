import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Wrench, Plus, Search, Edit, Trash2, Eye, Package, AlertCircle, RefreshCw, X, QrCode, Building
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Equipment, Room, Department } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const equipmentSchema = z.object({
  name: z.string().min(2, 'Equipment name must be at least 2 characters'),
  code: z.string().min(2, 'Equipment code must be at least 2 characters'),
  category: z.string().min(1, 'Please select a category'),
  rooms_id: z.string().optional().nullable(),
  is_mandatory: z.boolean().optional(),
  is_available: z.boolean().optional(),
  Spesification: z.string().optional(),
  quantity: z.number().min(0, 'Quantity cannot be negative'),
  unit: z.string().min(1, 'Unit is required (e.g., pcs, set)'),
});

type EquipmentForm = z.infer<typeof equipmentSchema>;

interface EquipmentWithDetails extends Equipment {
  rooms?: Room & { department: Department };
}

const ToolAdministration: React.FC = () => {
    const { profile } = useAuth();
    const [equipment, setEquipment] = useState<EquipmentWithDetails[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [roomFilter, setRoomFilter] = useState<string>('all');
    const [showModal, setShowModal] = useState(false);
    const [editingEquipment, setEditingEquipment] = useState<EquipmentWithDetails | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithDetails | null>(null);

    const form = useForm<EquipmentForm>({
        resolver: zodResolver(equipmentSchema),
        defaultValues: { is_mandatory: false, is_available: true, quantity: 1 },
    });

    const categories = [ 'Audio Visual', 'Computing', 'Connectivity', 'Power', 'Laboratory', 'Furniture', 'Safety' ];

    useEffect(() => {
        fetchEquipment();
        fetchRooms();
    }, []);

    const fetchEquipment = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('equipment')
                .select(`*, rooms (*, department:departments(*))`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setEquipment(data || []);
        } catch (error) {
            console.error('Error fetching equipment:', error);
            toast.error('Failed to load equipment');
        } finally { setLoading(false); }
    };

    const fetchRooms = async () => {
        try {
            const { data, error } = await supabase.from('rooms').select('*').order('name');
            if (error) throw error;
            setRooms(data || []);
        } catch (error) {
            console.error('Error fetching rooms:', error);
        }
    };

    const handleSubmit = async (data: EquipmentForm) => {
        try {
            setLoading(true);
            const equipmentData = {
                name: data.name,
                code: data.code.toUpperCase(),
                category: data.category,
                is_mandatory: data.is_mandatory,
                is_available: data.is_available,
                rooms_id: data.rooms_id || null,
                Spesification: data.Spesification,
                quantity: data.quantity,
                unit: data.unit,
            };

            if (editingEquipment) {
                const { error } = await supabase.from('equipment').update(equipmentData).eq('id', editingEquipment.id);
                if (error) throw error;
                toast.success('Equipment updated successfully');
            } else {
                const { error } = await supabase.from('equipment').insert([equipmentData]);
                if (error) throw error;
                toast.success('Equipment created successfully');
            }

            setShowModal(false);
            setEditingEquipment(null);
            form.reset();
            fetchEquipment();
        } catch (error: any) {
            console.error('Error saving equipment:', error);
            if (error.code === '23505') { toast.error('Equipment code already exists'); } 
            else { toast.error(error.message || 'Failed to save equipment'); }
        } finally { setLoading(false); }
    };

    const handleEdit = (eq: EquipmentWithDetails) => {
        setEditingEquipment(eq);
        form.reset({
            name: eq.name,
            code: eq.code,
            category: eq.category,
            is_mandatory: eq.is_mandatory,
            is_available: eq.is_available,
            rooms_id: eq.rooms_id,
            Spesification: eq.Spesification || '',
            quantity: eq.quantity,
            unit: eq.unit,
        });
        setShowModal(true);
    };

    const handleDelete = async (equipmentId: string) => {
        try {
            setLoading(true);
            const { error } = await supabase.from('equipment').delete().eq('id', equipmentId);
            if (error) throw error;
            toast.success('Equipment deleted successfully');
            setShowDeleteConfirm(null);
            fetchEquipment();
        } catch (error: any) {
            console.error('Error deleting equipment:', error);
            toast.error(error.message || 'Failed to delete equipment');
        } finally { setLoading(false); }
    };

    const filteredEquipment = equipment.filter(eq => {
        const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) || eq.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || eq.category === categoryFilter;
        const matchesRoom = roomFilter === 'all' || eq.rooms_id === roomFilter;
        return matchesSearch && matchesCategory && matchesRoom;
    });

    const getStatusChip = (is_available: boolean) => {
        const statusClass = is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        return (<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>{is_available ? 'AVAILABLE' : 'IN USE'}</span>);
    };

    if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
        return (<div className="flex items-center justify-center h-64"><div className="text-center"><AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3><p className="text-gray-600">You don't have permission to access tool administration.</p></div></div>);
    }

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-gray-700 to-gray-900 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold flex items-center space-x-3"><Wrench className="h-8 w-8" /><span>Tool Administration</span></h1><p className="mt-2 opacity-90">Manage all equipment inventory</p></div><div className="hidden md:block text-right"><div className="text-2xl font-bold">{equipment.length}</div><div className="text-sm opacity-80">Total Equipment</div></div></div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                    <div className="relative flex-1 w-full max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><input type="text" placeholder="Search by name or code..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" /></div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 border rounded-lg"><option value="all">All Categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
                        <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className="px-3 py-2 border rounded-lg"><option value="all">All Rooms</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>
                        <button onClick={() => fetchEquipment()} className="p-2 border rounded-lg"><RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
                        <button onClick={() => { setEditingEquipment(null); form.reset({ is_available: true, quantity: 1 }); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"><Plus className="h-4 w-4" /><span>Add Equipment</span></button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredEquipment.map(eq => (
                    <div key={eq.id} className="bg-white rounded-xl shadow-sm border p-4 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start"><h3 className="font-semibold text-lg text-gray-900">{eq.name}</h3>{getStatusChip(eq.is_available)}</div>
                            <p className="text-sm text-gray-500 mb-2">{eq.code}</p>
                            <div className="text-xs text-gray-600 space-y-1">
                                <p><strong>Category:</strong> {eq.category}</p>
                                <p><strong>Location:</strong> {eq.rooms?.name || 'Not assigned'}</p>
                                <p><strong>Department:</strong> {eq.rooms?.department?.name || 'N/A'}</p>
                                <p><strong>Quantity:</strong> {eq.quantity} {eq.unit}</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-end space-x-1 pt-3 mt-3 border-t">
                            <button onClick={() => setSelectedEquipment(eq)} className="p-1 text-gray-500 hover:text-blue-600"><Eye className="h-4 w-4" /></button>
                            <button onClick={() => handleEdit(eq)} className="p-1 text-gray-500 hover:text-green-600"><Edit className="h-4 w-4" /></button>
                            <button onClick={() => setShowDeleteConfirm(eq.id)} className="p-1 text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-semibold">{editingEquipment ? 'Edit Equipment' : 'Add New Equipment'}</h3><button onClick={() => setShowModal(false)}><X className="h-6 w-6" /></button></div>
                            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label>Name *</label><input {...form.register('name')} className="w-full border rounded-md p-2" />{form.formState.errors.name && <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>}</div>
                                    <div><label>Code *</label><input {...form.register('code')} className="w-full border rounded-md p-2" />{form.formState.errors.code && <p className="text-red-500 text-xs mt-1">{form.formState.errors.code.message}</p>}</div>
                                </div>
                                <div><label>Category *</label><select {...form.register('category')} className="w-full border rounded-md p-2"><option value="">Select Category</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>{form.formState.errors.category && <p className="text-red-500 text-xs mt-1">{form.formState.errors.category.message}</p>}</div>
                                <div><label>Room Location</label><select {...form.register('rooms_id')} className="w-full border rounded-md p-2"><option value="">Not Assigned</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label>Quantity *</label><input type="number" {...form.register('quantity', {valueAsNumber: true})} className="w-full border rounded-md p-2" />{form.formState.errors.quantity && <p className="text-red-500 text-xs mt-1">{form.formState.errors.quantity.message}</p>}</div>
                                    <div><label>Unit *</label><input {...form.register('unit')} placeholder="e.g. pcs, set, unit" className="w-full border rounded-md p-2" />{form.formState.errors.unit && <p className="text-red-500 text-xs mt-1">{form.formState.errors.unit.message}</p>}</div>
                                </div>
                                <div><label>Specification</label><textarea {...form.register('Spesification')} className="w-full border rounded-md p-2" rows={3}></textarea></div>
                                <div className="flex items-center"><input {...form.register('is_mandatory')} type="checkbox" className="h-4 w-4 rounded" /><label className="ml-2 text-sm">Mandatory for room bookings</label></div>
                                <div className="flex items-center"><input {...form.register('is_available')} type="checkbox" className="h-4 w-4 rounded" /><label className="ml-2 text-sm">Available for lending</label></div>
                                <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-md">Cancel</button><button type="submit" disabled={loading} className="px-4 py-2 bg-gray-800 text-white rounded-md disabled:opacity-50">{loading ? 'Saving...' : 'Save'}</button></div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            
            {selectedEquipment && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center"><h2 className="text-2xl font-bold text-gray-900">{selectedEquipment.name}</h2><button onClick={() => setSelectedEquipment(null)} className="p-2 rounded-full hover:bg-gray-100"><X/></button></div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Details</h3>
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                                    <p><strong>Code:</strong> {selectedEquipment.code}</p>
                                    <p><strong>Category:</strong> {selectedEquipment.category}</p>
                                    <p><strong>Status:</strong> {getStatusChip(selectedEquipment.is_available)}</p>
                                    <p><strong>Location:</strong> {selectedEquipment.rooms?.name || 'Not assigned'}</p>
                                    <p><strong>Quantity:</strong> {selectedEquipment.quantity} {selectedEquipment.unit}</p>
                                    <p><strong>Mandatory:</strong> {selectedEquipment.is_mandatory ? 'Yes' : 'No'}</p>
                                </div>
                                <h3 className="text-lg font-semibold">Specification</h3>
                                <div className="bg-gray-50 p-4 rounded-lg h-full text-sm"><p>{selectedEquipment.Spesification || 'No specification details.'}</p></div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">History & Maintenance</h3>
                                <div className="bg-gray-50 p-4 rounded-lg h-full text-center text-gray-500">Maintenance and lending history will be shown here.</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center mb-4">
                            <div className="flex-shrink-0"><AlertCircle className="h-6 w-6 text-red-600" /></div>
                            <div className="ml-3"><h3 className="text-lg font-medium text-gray-900">Delete Equipment</h3></div>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this equipment? This action cannot be undone and may affect related booking records.</p>
                        <div className="flex space-x-3">
                            <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200">Cancel</button>
                            <button onClick={() => handleDelete(showDeleteConfirm)} disabled={loading} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200">{loading ? 'Deleting...' : 'Delete'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ToolAdministration;