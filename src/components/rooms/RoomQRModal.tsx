import React, { useState, useEffect, useCallback, useMemo } from 'react';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';
import { X, Download, RotateCcw, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { useRoomQR } from '../../hooks/useRoomQR';
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
  currentUser: propUser,
  onQRUpdated
}) => {
  const { getText } = useLanguage();
  const { user: authUser } = useAuth();
  const user = propUser || authUser;

  const { qrData, loading, isRedeeming, fetchPayload, redeemQR } = useRoomQR();
  const [isDownloading, setIsDownloading] = useState(false);
  const [justRedeemed, setJustRedeemed] = useState(false);

  // Fetch payload whenever modal opens with a valid room
  useEffect(() => {
    if (isOpen && room?.id) {
      setJustRedeemed(false);
      fetchPayload(room.id, user?.id);
    }
  }, [isOpen, room?.id, user?.id, fetchPayload]);

  // Determine whether current user has permission to redeem this room
  const canManageRoom = useMemo(() => {
    if (!user || !room) return false;
    if (user.role === 'super_admin') return true;

    const roomDeptId = room.department_id || room.department?.id || null;
    const userDeptId = user.department_id || null;

    if (user.role === 'department_admin') {
      return Boolean(userDeptId && roomDeptId === userDeptId);
    }

    if (user.role === 'laboratory') {
      if (userDeptId && roomDeptId === userDeptId) return true;
      if (!roomDeptId && user.study_program_id && room.study_program_ids?.includes(user.study_program_id)) {
        return true;
      }
      return false;
    }

    return false;
  }, [user, room]);

  const handleRedeem = async () => {
    if (!room || !user || isRedeeming || loading) return;

    const result = await Swal.fire({
      title: getText('Redeem QR Code?', 'Tukar Kode QR?'),
      html: `
        <div style="text-align: left; font-size: 0.875rem; color: #4B5563; line-height: 1.5;">
          <p style="color: #DC2626; font-weight: 600; margin-bottom: 0.5rem;">
            ${getText(
              '⚠️ Warning: The current QR code will become invalid immediately!',
              '⚠️ Peringatan: Kode QR saat ini akan langsung tidak berlaku!'
            )}
          </p>
          <p style="margin-bottom: 0;">
            ${getText(
              'The new QR must be printed and posted in the room. Lecturers cannot check in until the new QR is posted.',
              'Kode QR baru harus dicetak dan ditempel di ruangan. Dosen tidak dapat melakukan presensi hingga kode QR baru ditempel.'
            )}
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: getText('Yes, Redeem QR', 'Ya, Tukar QR'),
      cancelButtonText: getText('Cancel', 'Batal'),
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      customClass: {
        container: '!z-[100000]'
      },
      didOpen: () => {
        const container = Swal.getContainer();
        if (container) {
          container.style.zIndex = '100000';
        }
      }
    });

    if (result.isConfirmed) {
      try {
        await redeemQR(room.id, user.id);
        setJustRedeemed(true);
        await Swal.fire({
          icon: 'success',
          title: getText('Success!', 'Berhasil!'),
          text: getText(
            'QR Code successfully redeemed! Please print and post the new QR code in the room.',
            'Kode QR berhasil diperbarui! Harap cetak dan tempel kode QR baru di ruangan.'
          ),
          confirmButtonColor: '#10B981',
          timer: 3000,
          timerProgressBar: true,
          customClass: {
            container: '!z-[100000]'
          },
          didOpen: () => {
            const c = Swal.getContainer();
            if (c) c.style.zIndex = '100000';
          }
        });
        onQRUpdated?.();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : undefined;
        await Swal.fire({
          icon: 'error',
          title: 'Error!',
          text: msg || getText('Failed to redeem QR code', 'Gagal memperbarui kode QR'),
          confirmButtonColor: '#EF4444',
          customClass: {
            container: '!z-[100000]'
          },
          didOpen: () => {
            const c = Swal.getContainer();
            if (c) c.style.zIndex = '100000';
          }
        });
      }
    }
  };

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

  const currentPayload = qrData?.payload || room.id;
  const isSecured = qrData?.mode === 'secured';

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
          {/* Status Badge */}
          <div className="w-full flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              {isSecured ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Secured QR (v{qrData?.version || 1})</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Legacy QR</span>
                </span>
              )}
            </div>

            {/* Redeem button for authorized managers */}
            {canManageRoom && (
              <button
                onClick={handleRedeem}
                disabled={isRedeeming || loading}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={getText(
                  'Rotate and invalidate the current QR code',
                  'Perbarui dan batalkan kode QR saat ini'
                )}
              >
                {isRedeeming ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{getText('Redeeming...', 'Memperbarui...')}</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{getText('Redeem QR', 'Tukar QR')}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Just Redeemed Notification Banner */}
          {justRedeemed && (
            <div className="w-full mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in duration-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {getText('New QR code generated successfully!', 'Kode QR baru berhasil dibuat!')}
                </p>
                <p className="mt-0.5 text-emerald-700">
                  {getText(
                    'Please download and print this new QR code immediately. The previous QR code is no longer valid.',
                    'Harap segera unduh dan cetak kode QR baru ini. Kode QR sebelumnya sudah tidak berlaku.'
                  )}
                </p>
              </div>
            </div>
          )}

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
              {loading ? (
                <div className="w-[180px] h-[180px] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <QRCode
                  value={currentPayload}
                  size={180}
                  viewBox="0 0 256 256"
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                />
              )}
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
              disabled={isDownloading || loading}
              className={`flex-1 px-4 py-2 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                isDownloading || loading
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
