// src/utils/sweetAlert.ts - VERSI SIMPLE
import Swal from 'sweetalert2';

// Global language state
let currentLanguage: 'en' | 'id' = 'en';

// Function to update language
export const updateAlertLanguage = (language: 'en' | 'id') => {
  currentLanguage = language;
};

// Simple alert functions yang langsung terima 2 parameter
export const alert = {
  success: (enText: string, idText: string = '') => {
    const message = currentLanguage === 'id' && idText ? idText : enText;
    Swal.fire({
      icon: 'success',
      title: currentLanguage === 'id' ? 'Berhasil!' : 'Success!',
      text: message,
      confirmButtonText: currentLanguage === 'id' ? 'OK' : 'OK',
      confirmButtonColor: '#10B981',
      timer: 3000,
      timerProgressBar: true,
    });
  },

  error: (enText: string, idText: string = '') => {
    const message = currentLanguage === 'id' && idText ? idText : enText;
    Swal.fire({
      icon: 'error',
      title: currentLanguage === 'id' ? 'Error!' : 'Error!',
      text: message,
      confirmButtonText: currentLanguage === 'id' ? 'OK' : 'OK',
      confirmButtonColor: '#EF4444',
    });
  },

  warning: (enText: string, idText: string = '') => {
    const message = currentLanguage === 'id' && idText ? idText : enText;
    Swal.fire({
      icon: 'warning',
      title: currentLanguage === 'id' ? 'Peringatan!' : 'Warning!',
      text: message,
      confirmButtonText: currentLanguage === 'id' ? 'OK' : 'OK',
      confirmButtonColor: '#F59E0B',
    });
  },

  confirm: (onConfirm: () => void, enText?: string, idText?: string) => {
    const title = currentLanguage === 'id' ? 'Apakah Anda yakin?' : 'Are you sure?';
    const text = currentLanguage === 'id' && idText ? idText : (enText || 'You won\'t be able to revert this!');
    const confirmBtn = currentLanguage === 'id' ? 'Ya, hapus!' : 'Yes, delete it!';
    const cancelBtn = currentLanguage === 'id' ? 'Batal' : 'Cancel';

    Swal.fire({
      title: title,
      text: text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: confirmBtn,
      cancelButtonText: cancelBtn,
    }).then((result) => {
      if (result.isConfirmed) {
        onConfirm();
      }
    });
  }
};