import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Wrench, Plus, Search, Edit, Trash2, Eye, Package, AlertCircle, RefreshCw, X, 
    Camera, Cpu, Wifi, Zap, FlaskConical, Armchair, Shield,
    MapPin, Hash, Layers, CheckCircle, XCircle, Star, AlertTriangle, Building,
    User, Phone, CreditCard, Clock, Calendar, FileText, ArrowRight, 
    ExternalLink, Users, Activity, TrendingUp, BarChart3
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// Mock data - replace with actual supabase calls
const mockEquipment = [
    {
        id: '1',
        name: 'Laptop Dell XPS',
        code: 'LAB-001',
        category: 'Computing',
        quantity: 8,
        unit: 'pcs',
        condition: 'GOOD',
        is_mandatory: true,
        is_available: true,
        created_at: '2024-01-15T10:00:00Z',
        rooms: { name: 'Lab Computer', department: { name: 'Computer Science' } },
        borrowing_details: [
            {
                id: 'lend-1',
                user: {
                    full_name: 'Ahmad Rizki',
                    identity_number: '220301001',
                    phone_number: '+62812-3456-7890'
                },
                borrowed_quantity: 2,
                returned_quantity: 1,
                missing_quantity: 1,
                lending_date: '2024-06-20T08:00:00Z',
                expected_return: '2024-06-27T17:00:00Z',
                status: 'active'
            },
            {
                id: 'lend-2', 
                user: {
                    full_name: 'Siti Nurhaliza',
                    identity_number: '220301002',
                    phone_number: '+62813-9876-5432'
                },
                borrowed_quantity: 1,
                returned_quantity: 1,
                missing_quantity: 0,
                lending_date: '2024-06-25T09:00:00Z',
                expected_return: '2024-06-28T16:00:00Z',
                status: 'returned'
            }
        ]
    },
    {
        id: '2',
        name: 'Projector Epson',
        code: 'AV-002',
        category: 'Audio Visual',
        quantity: 5,
        unit: 'units',
        condition: 'GOOD',
        is_mandatory: false,
        is_available: true,
        created_at: '2024-01-10T10:00:00Z',
        rooms: { name: 'Meeting Room A', department: { name: 'Engineering' } },
        borrowing_details: [
            {
                id: 'lend-3',
                user: {
                    full_name: 'Budi Santoso',
                    identity_number: '220301003',
                    phone_number: '+62814-1111-2222'
                },
                borrowed_quantity: 3,
                returned_quantity: 2,
                missing_quantity: 1,
                lending_date: '2024-06-22T14:00:00Z',
                expected_return: '2024-06-29T15:00:00Z',
                status: 'active'
            }
        ]
    }
];

const equipmentSchema = z.object({
  name: z.string().min(2, 'Equipment name must be at least 2 characters'),
  code: z.string().min(2, 'Equipment code must be at least 2 characters'),
  category: z.string().min(1, 'Please select a category'),
  rooms_id: z.string().optional().nullable(),
  is_mandatory: z.boolean().optional(),
  is_available: z.boolean().optional(),
  condition: z.enum(['GOOD', 'BROKEN', 'MAINTENANCE']).default('GOOD'),
  Spesification: z.string().optional(),
  quantity: z.number().min(0, 'Quantity cannot be negative'),
  unit: z.string().min(1, 'Unit is required (e.g., pcs, set)'),
});

type EquipmentForm = z.infer<typeof equipmentSchema>;

const ToolAdministration = () => {
    const { getText } = useLanguage();
    const [equipment, setEquipment] = useState(mockEquipment);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all'); // all, available, borrowed, missing
    const [showModal, setShowModal] = useState(false);
    const [editingEquipment, setEditingEquipment] = useState(null);
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [showBorrowingModal, setShowBorrowingModal] = useState(false);
    const [activeTab, setActiveTab] = useState('overview'); // overview, borrowing

    const form = useForm({
        resolver: zodResolver(equipmentSchema),
        defaultValues: { is_mandatory: false, is_available: true, condition: 'GOOD', quantity: 1 },
    });

    const categories = [
        { name: 'Audio Visual', icon: Camera, color: 'from-violet-400 to-purple-400' },
        { name: 'Computing', icon: Cpu, color: 'from-blue-400 to-indigo-400' },
        { name: 'Connectivity', icon: Wifi, color: 'from-emerald-400 to-green-400' },
        { name: 'Power', icon: Zap, color: 'from-amber-400 to-yellow-400' },
        { name: 'Laboratory', icon: FlaskConical, color: 'from-rose-400 to-pink-400' },
        { name: 'Furniture', icon: Armchair, color: 'from-slate-400 to-gray-400' },
        { name: 'Safety', icon: Shield, color: 'from-orange-400 to-red-400' }
    ];

    const getCategoryConfig = (categoryName) => {
        return categories.find(cat => cat.name === categoryName) || categories[0];
    };

    const getEquipmentStats = () => {
        const totalEquipment = equipment.length;
        const totalBorrowed = equipment.reduce((sum, eq) => {
            const activeBorrowings = eq.borrowing_details?.filter(b => b.status === 'active') || [];
            return sum + activeBorrowings.reduce((borrowSum, b) => borrowSum + b.borrowed_quantity, 0);
        }, 0);
        const totalMissing = equipment.reduce((sum, eq) => {
            const activeBorrowings = eq.borrowing_details?.filter(b => b.status === 'active') || [];
            return sum + activeBorrowings.reduce((missSum, b) => missSum + b.missing_quantity, 0);
        }, 0);
        const equipmentWithIssues = equipment.filter(eq => {
            const activeBorrowings = eq.borrowing_details?.filter(b => b.status === 'active') || [];
            return activeBorrowings.some(b => b.missing_quantity > 0);
        }).length;

        return { totalEquipment, totalBorrowed, totalMissing, equipmentWithIssues };
    };

    const stats = getEquipmentStats();

    const filteredEquipment = equipment.filter(eq => {
        const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            eq.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || eq.category === categoryFilter;
        
        let matchesStatus = true;
        if (statusFilter === 'borrowed') {
            matchesStatus = eq.borrowing_details?.some(b => b.status === 'active') || false;
        } else if (statusFilter === 'missing') {
            matchesStatus = eq.borrowing_details?.some(b => b.status === 'active' && b.missing_quantity > 0) || false;
        } else if (statusFilter === 'available') {
            matchesStatus = !eq.borrowing_details?.some(b => b.status === 'active') || false;
        }
        
        return matchesSearch && matchesCategory && matchesStatus;
    });

    const getAllBorrowingRecords = () => {
        const allRecords = [];
        equipment.forEach(eq => {
            eq.borrowing_details?.forEach(borrow => {
                allRecords.push({
                    ...borrow,
                    equipment: eq
                });
            });
        });
        return allRecords.sort((a, b) => new Date(b.lending_date) - new Date(a.lending_date));
    };

    const getStatusColor = (status, missing = 0) => {
        if (missing > 0) return 'bg-red-100 text-red-800 border-red-200';
        if (status === 'active') return 'bg-blue-100 text-blue-800 border-blue-200';
        if (status === 'returned') return 'bg-green-100 text-green-800 border-green-200';
        return 'bg-gray-100 text-gray-800 border-gray-200';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center space-x-3 mb-2">
                            <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                                <Wrench className="h-8 w-8" />
                            </div>
                            <span>Equipment Management</span>
                        </h1>
                        <p className="text-lg opacity-90">Monitor equipment usage and track borrowing activities</p>
                    </div>
                </div>
            </div>

            {/* Statistics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Equipment</p>
                            <p className="text-3xl font-bold text-gray-900">{stats.totalEquipment}</p>
                        </div>
                        <div className="p-3 bg-blue-100 rounded-xl">
                            <Package className="h-6 w-6 text-blue-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Currently Borrowed</p>
                            <p className="text-3xl font-bold text-orange-600">{stats.totalBorrowed}</p>
                        </div>
                        <div className="p-3 bg-orange-100 rounded-xl">
                            <Activity className="h-6 w-6 text-orange-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Missing Items</p>
                            <p className="text-3xl font-bold text-red-600">{stats.totalMissing}</p>
                        </div>
                        <div className="p-3 bg-red-100 rounded-xl">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Equipment w/ Issues</p>
                            <p className="text-3xl font-bold text-yellow-600">{stats.equipmentWithIssues}</p>
                        </div>
                        <div className="p-3 bg-yellow-100 rounded-xl">
                            <TrendingUp className="h-6 w-6 text-yellow-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-200">
                    <button 
                        onClick={() => setActiveTab('overview')} 
                        className={`flex-1 py-4 px-6 text-center font-medium text-sm transition-colors duration-200 ${
                            activeTab === 'overview' 
                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Package className="h-4 w-4" />
                            <span>Equipment Overview</span>
                        </div>
                    </button>
                    <button 
                        onClick={() => setActiveTab('borrowing')} 
                        className={`flex-1 py-4 px-6 text-center font-medium text-sm transition-colors duration-200 ${
                            activeTab === 'borrowing' 
                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Users className="h-4 w-4" />
                            <span>Borrowing Records</span>
                            {stats.totalBorrowed > 0 && (
                                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-orange-500 rounded-full">
                                    {stats.totalBorrowed}
                                </span>
                            )}
                        </div>
                    </button>
                </div>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'overview' ? (
                <>
                    {/* Filters Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                            <div className="relative flex-1 w-full max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search equipment..." 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                />
                            </div>
                            
                            <div className="flex items-center gap-2 flex-wrap">
                                <select 
                                    value={categoryFilter} 
                                    onChange={(e) => setCategoryFilter(e.target.value)} 
                                    className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none bg-white text-sm"
                                >
                                    <option value="all">All Categories</option>
                                    {categories.map(cat => (
                                        <option key={cat.name} value={cat.name}>{cat.name}</option>
                                    ))}
                                </select>

                                <select 
                                    value={statusFilter} 
                                    onChange={(e) => setStatusFilter(e.target.value)} 
                                    className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none bg-white text-sm"
                                >
                                    <option value="all">All Status</option>
                                    <option value="available">Available</option>
                                    <option value="borrowed">Currently Borrowed</option>
                                    <option value="missing">Missing Items</option>
                                </select>

                                <button 
                                    onClick={() => setLoading(!loading)} 
                                    className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
                                    title="Refresh"
                                >
                                    <RefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                                </button>

                                <button 
                                    onClick={() => setShowModal(true)} 
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Add Equipment</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Equipment Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredEquipment.map(eq => {
                            const categoryConfig = getCategoryConfig(eq.category);
                            const CategoryIcon = categoryConfig.icon;
                            
                            // Calculate borrowed and missing quantities
                            const activeBorrowings = eq.borrowing_details?.filter(b => b.status === 'active') || [];
                            const totalBorrowed = activeBorrowings.reduce((sum, b) => sum + b.borrowed_quantity, 0);
                            const totalMissing = activeBorrowings.reduce((sum, b) => sum + b.missing_quantity, 0);
                            const availableQty = eq.quantity - totalBorrowed + activeBorrowings.reduce((sum, b) => sum + b.returned_quantity, 0);
                            
                            return (
                                <div key={eq.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className={`p-2 rounded-lg bg-gradient-to-r ${categoryConfig.color} text-white`}>
                                                <CategoryIcon className="h-5 w-5" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                {totalMissing > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        {totalMissing} MISSING
                                                    </span>
                                                )}
                                                {totalBorrowed > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                                                        <Users className="h-3 w-3" />
                                                        {totalBorrowed} BORROWED
                                                    </span>
                                                )}
                                                {eq.is_mandatory && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                                        <Star className="h-3 w-3" />
                                                        REQUIRED
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <h3 className="font-semibold text-lg text-gray-900 mb-2">
                                            {eq.name}
                                        </h3>
                                        
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                {eq.code}
                                            </span>
                                        </div>

                                        <div className="space-y-2 text-sm mb-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-600">Total Stock</span>
                                                <span className="font-medium text-gray-900">{eq.quantity} {eq.unit}</span>
                                            </div>
                                            
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-600">Available</span>
                                                <span className={`font-medium ${availableQty > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {availableQty} {eq.unit}
                                                </span>
                                            </div>
                                            
                                            {totalBorrowed > 0 && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-600">Borrowed</span>
                                                    <span className="font-medium text-orange-600">{totalBorrowed} {eq.unit}</span>
                                                </div>
                                            )}

                                            {totalMissing > 0 && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-600">Missing</span>
                                                    <span className="font-medium text-red-600">{totalMissing} {eq.unit}</span>
                                                </div>
                                            )}
                                            
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-600">Location</span>
                                                <span className="font-medium text-gray-900">
                                                    {eq.rooms?.name || 'Unassigned'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                            <button 
                                                onClick={() => setSelectedEquipment(eq)} 
                                                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium transition-colors text-sm"
                                            >
                                                <Eye className="h-4 w-4" />
                                                <span>View Details</span>
                                            </button>
                                            
                                            {(totalBorrowed > 0 || totalMissing > 0) && (
                                                <button 
                                                    onClick={() => {
                                                        setSelectedEquipment(eq);
                                                        setShowBorrowingModal(true);
                                                    }} 
                                                    className="flex items-center gap-1 text-orange-600 hover:text-orange-800 font-medium transition-colors text-sm"
                                                >
                                                    <Users className="h-4 w-4" />
                                                    <span>View Borrowers</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                // Borrowing Records Tab
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-blue-600" />
                            All Borrowing Records
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">Complete history of equipment borrowing activities</p>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Info</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Equipment</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Borrowed</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Returned</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Missing</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {getAllBorrowingRecords().map((record) => (
                                    <tr key={record.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-medium text-gray-900">{record.user.full_name}</div>
                                                <div className="text-sm text-gray-500 flex items-center gap-2">
                                                    <CreditCard className="h-3 w-3" />
                                                    {record.user.identity_number}
                                                </div>
                                                <div className="text-sm text-gray-500 flex items-center gap-2">
                                                    <Phone className="h-3 w-3" />
                                                    {record.user.phone_number}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-medium text-gray-900">{record.equipment.name}</div>
                                                <div className="text-sm text-gray-500">{record.equipment.code}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-lg font-bold text-blue-600">
                                                {record.borrowed_quantity}
                                            </span>
                                            <span className="text-sm text-gray-500 ml-1">{record.equipment.unit}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-lg font-bold text-green-600">
                                                {record.returned_quantity}
                                            </span>
                                            <span className="text-sm text-gray-500 ml-1">{record.equipment.unit}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-lg font-bold ${record.missing_quantity > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                {record.missing_quantity}
                                            </span>
                                            <span className="text-sm text-gray-500 ml-1">{record.equipment.unit}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(record.status, record.missing_quantity)}`}>
                                                {record.missing_quantity > 0 ? 'MISSING ITEMS' : record.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm">
                                                <div className="font-medium text-gray-900">
                                                    {format(new Date(record.lending_date), 'MMM d, yyyy')}
                                                </div>
                                                <div className="text-gray-500">
                                                    Due: {format(new Date(record.expected_return), 'MMM d')}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Borrowing Details Modal */}
            {showBorrowingModal && selectedEquipment && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-bold">{selectedEquipment.name} - Borrowing Details</h2>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Hash className="h-4 w-4 opacity-80" />
                                        <span className="font-mono text-lg opacity-90">{selectedEquipment.code}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowBorrowingModal(false)} 
                                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 max-h-[70vh] overflow-y-auto">
                            {/* Equipment Summary */}
                            <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Package className="h-5 w-5 text-blue-600" />
                                    Equipment Summary
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-600">{selectedEquipment.quantity}</div>
                                        <div className="text-sm text-gray-600">Total Stock</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-orange-600">
                                            {selectedEquipment.borrowing_details?.filter(b => b.status === 'active').reduce((sum, b) => sum + b.borrowed_quantity, 0) || 0}
                                        </div>
                                        <div className="text-sm text-gray-600">Currently Borrowed</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-red-600">
                                            {selectedEquipment.borrowing_details?.filter(b => b.status === 'active').reduce((sum, b) => sum + b.missing_quantity, 0) || 0}
                                        </div>
                                        <div className="text-sm text-gray-600">Missing Items</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-green-600">
                                            {selectedEquipment.quantity - (selectedEquipment.borrowing_details?.filter(b => b.status === 'active').reduce((sum, b) => sum + b.borrowed_quantity, 0) || 0) + (selectedEquipment.borrowing_details?.filter(b => b.status === 'active').reduce((sum, b) => sum + b.returned_quantity, 0) || 0)}
                                        </div>
                                        <div className="text-sm text-gray-600">Available</div>
                                    </div>
                                </div>
                            </div>

                            {/* Active Borrowings */}
                            <div className="mb-6">
                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-orange-600" />
                                    Active Borrowings
                                    <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                        {selectedEquipment.borrowing_details?.filter(b => b.status === 'active').length || 0}
                                    </span>
                                </h3>
                                
                                {selectedEquipment.borrowing_details?.filter(b => b.status === 'active').length > 0 ? (
                                    <div className="space-y-4">
                                        {selectedEquipment.borrowing_details.filter(b => b.status === 'active').map((borrow) => (
                                            <div key={borrow.id} className={`border rounded-lg p-4 ${borrow.missing_quantity > 0 ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`}>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start space-x-4">
                                                        <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                                                            <User className="h-6 w-6 text-white" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="font-semibold text-gray-900">{borrow.user.full_name}</h4>
                                                            <div className="space-y-1 mt-2">
                                                                <div className="flex items-center text-sm text-gray-600">
                                                                    <CreditCard className="h-4 w-4 mr-2" />
                                                                    ID: {borrow.user.identity_number}
                                                                </div>
                                                                <div className="flex items-center text-sm text-gray-600">
                                                                    <Phone className="h-4 w-4 mr-2" />
                                                                    {borrow.user.phone_number}
                                                                </div>
                                                                <div className="flex items-center text-sm text-gray-600">
                                                                    <Calendar className="h-4 w-4 mr-2" />
                                                                    Borrowed: {format(new Date(borrow.lending_date), 'MMM d, yyyy h:mm a')}
                                                                </div>
                                                                <div className="flex items-center text-sm text-gray-600">
                                                                    <Clock className="h-4 w-4 mr-2" />
                                                                    Expected Return: {format(new Date(borrow.expected_return), 'MMM d, yyyy h:mm a')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="text-right">
                                                        <div className="grid grid-cols-3 gap-4 text-center">
                                                            <div>
                                                                <div className="text-lg font-bold text-blue-600">{borrow.borrowed_quantity}</div>
                                                                <div className="text-xs text-gray-600">Borrowed</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-lg font-bold text-green-600">{borrow.returned_quantity}</div>
                                                                <div className="text-xs text-gray-600">Returned</div>
                                                            </div>
                                                            <div>
                                                                <div className={`text-lg font-bold ${borrow.missing_quantity > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                                    {borrow.missing_quantity}
                                                                </div>
                                                                <div className="text-xs text-gray-600">Missing</div>
                                                            </div>
                                                        </div>
                                                        
                                                        {borrow.missing_quantity > 0 && (
                                                            <div className="mt-3">
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                                                    {borrow.missing_quantity} {selectedEquipment.unit} Missing
                                                                </span>
                                                            </div>
                                                        )}
                                                        
                                                        <div className="mt-3 flex space-x-2">
                                                            <button className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors text-xs">
                                                                <Phone className="h-3 w-3" />
                                                                <span>Contact</span>
                                                            </button>
                                                            <button className="flex items-center space-x-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors text-xs">
                                                                <FileText className="h-3 w-3" />
                                                                <span>Details</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        <CheckCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                        <p className="text-lg font-medium">No Active Borrowings</p>
                                        <p>This equipment is currently available for borrowing.</p>
                                    </div>
                                )}
                            </div>

                            {/* Borrowing History */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-gray-600" />
                                    Borrowing History
                                    <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                        {selectedEquipment.borrowing_details?.filter(b => b.status === 'returned').length || 0}
                                    </span>
                                </h3>
                                
                                {selectedEquipment.borrowing_details?.filter(b => b.status === 'returned').length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedEquipment.borrowing_details.filter(b => b.status === 'returned').map((borrow) => (
                                            <div key={borrow.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="flex-shrink-0 h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-900">{borrow.user.full_name}</div>
                                                            <div className="text-sm text-gray-600">
                                                                {format(new Date(borrow.lending_date), 'MMM d, yyyy')} - Returned
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {borrow.borrowed_quantity} {selectedEquipment.unit} borrowed
                                                        </div>
                                                        <div className="text-xs text-green-600">
                                                            All items returned
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-500">
                                        <div className="text-sm">No previous borrowing history available.</div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="border-t border-gray-200 p-6">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-600">
                                    Last updated: {format(new Date(), 'MMM d, yyyy h:mm a')}
                                </div>
                                <div className="flex space-x-3">
                                    <button className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors">
                                        <ExternalLink className="h-4 w-4" />
                                        <span>Export Report</span>
                                    </button>
                                    <button 
                                        onClick={() => setShowBorrowingModal(false)}
                                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Equipment Detail Modal */}
            {selectedEquipment && !showBorrowingModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 p-6 text-white">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-3xl font-bold mb-2">{selectedEquipment.name}</h2>
                                    <div className="flex items-center gap-2">
                                        <Hash className="h-4 w-4 opacity-80" />
                                        <span className="font-mono text-lg opacity-90">{selectedEquipment.code}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedEquipment(null)} 
                                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-8 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Equipment Details */}
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <Package className="h-5 w-5 text-blue-600" />
                                            Equipment Details
                                        </h3>
                                        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">Category</span>
                                                <div className="flex items-center gap-2">
                                                    {(() => {
                                                        const config = getCategoryConfig(selectedEquipment.category);
                                                        const CategoryIcon = config.icon;
                                                        return (
                                                            <>
                                                                <CategoryIcon className="h-4 w-4 text-gray-600" />
                                                                <span className="font-semibold text-gray-900">{selectedEquipment.category}</span>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">Condition</span>
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                                    <CheckCircle className="h-3 w-3" />
                                                    {selectedEquipment.condition}
                                                </span>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">Location</span>
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-4 w-4 text-gray-600" />
                                                    <span className="font-semibold text-gray-900">
                                                        {selectedEquipment.rooms?.name || 'Unassigned'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">Department</span>
                                                <div className="flex items-center gap-2">
                                                    <Building className="h-4 w-4 text-gray-600" />
                                                    <span className="font-semibold text-gray-900">
                                                        {selectedEquipment.rooms?.department?.name || 'N/A'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">Total Quantity</span>
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-4 w-4 text-gray-600" />
                                                    <span className="font-bold text-lg text-gray-900">
                                                        {selectedEquipment.quantity} {selectedEquipment.unit}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">Created</span>
                                                <span className="text-sm text-gray-700">
                                                    {format(new Date(selectedEquipment.created_at), 'MMM d, yyyy')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Usage Statistics */}
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <BarChart3 className="h-5 w-5 text-blue-600" />
                                            Usage Statistics
                                        </h3>
                                        <div className="bg-gray-50 rounded-lg p-6">
                                            {(() => {
                                                const activeBorrowings = selectedEquipment.borrowing_details?.filter(b => b.status === 'active') || [];
                                                const totalBorrowed = activeBorrowings.reduce((sum, b) => sum + b.borrowed_quantity, 0);
                                                const totalMissing = activeBorrowings.reduce((sum, b) => sum + b.missing_quantity, 0);
                                                const availableQty = selectedEquipment.quantity - totalBorrowed + activeBorrowings.reduce((sum, b) => sum + b.returned_quantity, 0);
                                                const totalBorrowings = selectedEquipment.borrowing_details?.length || 0;
                                                
                                                return (
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="text-center p-3 bg-blue-100 rounded-lg">
                                                                <div className="text-2xl font-bold text-blue-600">{availableQty}</div>
                                                                <div className="text-sm text-blue-800">Available</div>
                                                            </div>
                                                            <div className="text-center p-3 bg-orange-100 rounded-lg">
                                                                <div className="text-2xl font-bold text-orange-600">{totalBorrowed}</div>
                                                                <div className="text-sm text-orange-800">Borrowed</div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="text-center p-3 bg-red-100 rounded-lg">
                                                                <div className="text-2xl font-bold text-red-600">{totalMissing}</div>
                                                                <div className="text-sm text-red-800">Missing</div>
                                                            </div>
                                                            <div className="text-center p-3 bg-green-100 rounded-lg">
                                                                <div className="text-2xl font-bold text-green-600">{totalBorrowings}</div>
                                                                <div className="text-sm text-green-800">Total Loans</div>
                                                            </div>
                                                        </div>

                                                        {totalBorrowed > 0 && (
                                                            <div className="mt-4">
                                                                <button 
                                                                    onClick={() => {
                                                                        setSelectedEquipment(selectedEquipment);
                                                                        setShowBorrowingModal(true);
                                                                    }}
                                                                    className="w-full flex items-center justify-center gap-2 p-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                                                                >
                                                                    <Users className="h-4 w-4" />
                                                                    <span>View Active Borrowers</span>
                                                                    <ArrowRight className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
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

export default ToolAdministration;