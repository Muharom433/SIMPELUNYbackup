import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Package, History, Copy, CheckCircle, Clock, MapPin, ArrowRight, User, Plus, Phone } from 'lucide-react';
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
  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment_mutations')
        .select(`
          id,
          pic_name,
          pic_phone,
          notes,
          created_at,
          equipment:equipment_id(name, code),
          previous_room:previous_room_id(name, code),
          new_room:new_room_id(name, code)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Supabase join returns objects or arrays depending on relation type, usually object for many-to-one
      setHistory(data as any || []);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error(getText('Failed to load item history', 'Gagal memuat histori barang'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const formUrl = `${baseUrl}#/item-mutation`; // Assuming HashRouter based on App.tsx
    
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
                  {getText('Notes', 'Catatan')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                    <p className="mt-2">{getText('Loading history...', 'Memuat histori...')}</p>
                  </td>
                </tr>
              ) : history.length === 0 ? (
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
                            {record.equipment?.name || getText('Unknown Item', 'Barang Tidak Diketahui')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {record.equipment?.code || '-'}
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
                      <div className="text-sm text-gray-500 max-w-xs truncate" title={record.notes || ''}>
                        {record.notes || '-'}
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
  );
};

export default ItemHistory;
