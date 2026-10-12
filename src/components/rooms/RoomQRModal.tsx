import React, { useState, useCallback } from 'react';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';
import { X, Download, Loader2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { User } from '../../types';

export interface RoomQRObject {
  id: string;
  name: string;
  code?: string;
  department_id?: string | null;
  department?: { id: string; name?: string } | null;
  study_program_ids?: string[] | null;
}

interface RoomQRModalProps {
  isOpen: boolean;
  room: RoomQRObject | null;
  onClose: () => void;
  currentUser?: User | null;
  onQRUpdated?: () => void;
}

export const RoomQRModal: React.FC<RoomQRModalProps> = ({
  isOpen,
  room,
  onClose,
}) => {
  const { getText } = useLanguage();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadQR = useCallback(async () => {
    const cardElement = document.getElementById('qr-card-element');
    if (!cardElement || !room) return;

    setIsDownloading(true);
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(cardElement, {
          backgroundColor: '#ffffff',
          scale: 2
        });

        const link = document.createElement('a');
        link.download = `QR-${room.name.replace(/\s+/g, '-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        await Swal.fire({
          icon: 'success',
          title: getText('Success!', 'Berhasil!'),
          text: getText('QR Code downloaded successfully', 'QR Code berhasil diunduh'),
          confirmButtonColor: '#10B981',
          timer: 2000,
          timerProgressBar: true,
          customClass: {
            container: '!z-[100000]'
          },
          didOpen: () => {
            const c = Swal.getContainer();
            if (c) c.style.zIndex = '100000';
          }
        });
      } catch {
        await Swal.fire({
          icon: 'error',
          title: 'Error!',
          text: getText('Failed to download QR Code', 'Gagal mengunduh QR Code'),
          confirmButtonColor: '#EF4444',
          customClass: {
            container: '!z-[100000]'
          },
          didOpen: () => {
            const c = Swal.getContainer();
            if (c) c.style.zIndex = '100000';
          }
        });
      } finally {
        setIsDownloading(false);
      }
    }, 400);
  }, [room, getText]);

  if (!isOpen || !room) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="font-bold text-lg text-gray-900 leading-tight">
              {getText('Room QR Code', 'Kode QR Ruangan')}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{room.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title={getText('Close', 'Tutup')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col items-center overflow-y-auto flex-1">
          {/* The Printable Card to be captured */}
          <div
            id="qr-card-element"
            className="bg-white p-6 border-2 border-gray-900 rounded-xl flex flex-col items-center gap-4 w-64 shadow-sm"
          >
            <div className="text-center">
              <h2 className="font-bold text-xl uppercase text-gray-900">{room.name}</h2>
              <p className="text-xs text-gray-500 font-mono">{room.code || ''}</p>
            </div>
            <div className="bg-white p-2 rounded flex items-center justify-center min-h-[180px]">
              <QRCode
                value={room.id}
                size={180}
                viewBox="0 0 256 256"
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Scan untuk Presensi</p>
              <p className="text-[8px] text-gray-300 mt-1">Fakultas Vokasi UNY</p>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
            {getText(
              'Print and paste this QR code in the room for lecturers to check in.',
              'Cetak dan tempel kode QR ini di ruangan agar dosen dapat melakukan presensi.'
            )}
          </p>

          {/* Action buttons */}
          <div className="flex gap-3 w-full mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
            >
              {getText('Close', 'Tutup')}
            </button>
            <button
              onClick={handleDownloadQR}
              disabled={isDownloading}
              className={`flex-1 px-4 py-2 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                isDownloading
                  ? 'bg-blue-400 cursor-wait opacity-80'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow'
              }`}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{getText('Processing...', 'Memproses...')}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomQRModal;

