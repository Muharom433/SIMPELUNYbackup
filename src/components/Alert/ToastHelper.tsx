// src/utils/sweetAlert.ts
import Swal from 'sweetalert2';

// Global messages yang bisa diubah berdasarkan bahasa
export let ALERT_MESSAGES = {
  // Success messages
  bookingSuccess: 'Booking submitted successfully!',
  bookingUpdated: 'Booking updated successfully',
  bookingDeleted: 'Booking deleted successfully',
  checkoutSuccess: 'Checkout completed successfully!',
  lendingSuccess: 'Equipment lending request submitted successfully!',
  examCreated: 'Exam created successfully',
  examUpdated: 'Exam updated successfully',
  examDeleted: 'Exam deleted successfully',
  
  // Error messages
  bookingFailed: 'Failed to create booking',
  checkoutFailed: 'Failed to process checkout',
  lendingFailed: 'Failed to create lending request',
  loadFailed: 'Failed to load data',
  updateFailed: 'Failed to update',
  deleteFailed: 'Failed to delete',
  selectRoom: 'Please select a room',
  selectEquipment: 'Please select at least one equipment',
  
  // Confirm messages
  confirmDelete: 'Are you sure?',
  confirmDeleteText: 'You won\'t be able to revert this!',
  confirmDeleteButton: 'Yes, delete it!',
  cancelButton: 'Cancel',
  
  // Button texts
  ok: 'OK',
  success: 'Success!',
  error: 'Error!',
  warning: 'Warning!',
};

// Function to update messages based on language
export const updateAlertLanguage = (language: 'en' | 'id') => {
  if (language === 'id') {
    ALERT_MESSAGES = {
      // Success messages
      bookingSuccess: 'Pemesanan berhasil dikirim!',
      bookingUpdated: 'Pemesanan berhasil diperbarui',
      bookingDeleted: 'Pemesanan berhasil dihapus',
      checkoutSuccess: 'Checkout berhasil diselesaikan!',
      lendingSuccess: 'Permintaan peminjaman peralatan berhasil dikirim!',
      examCreated: 'Ujian berhasil dibuat',
      examUpdated: 'Ujian berhasil diperbarui',
      examDeleted: 'Ujian berhasil dihapus',
      
      // Error messages
      bookingFailed: 'Gagal membuat pemesanan',
      checkoutFailed: 'Gagal memproses checkout',
      lendingFailed: 'Gagal membuat permintaan peminjaman',
      loadFailed: 'Gagal memuat data',
      updateFailed: 'Gagal memperbarui',
      deleteFailed: 'Gagal menghapus',
      selectRoom: 'Silakan pilih ruangan',
      selectEquipment: 'Silakan pilih minimal satu peralatan',
      
      // Confirm messages
      confirmDelete: 'Apakah Anda yakin?',
      confirmDeleteText: 'Anda tidak akan bisa membatalkan ini!',
      confirmDeleteButton: 'Ya, hapus!',
      cancelButton: 'Batal',
      
      // Button texts
      ok: 'OK',
      success: 'Berhasil!',
      error: 'Error!',
      warning: 'Peringatan!',
    };
  } else {
    // Reset to English (original values above)
    ALERT_MESSAGES = {
      bookingSuccess: 'Booking submitted successfully!',
      bookingUpdated: 'Booking updated successfully',
      bookingDeleted: 'Booking deleted successfully',
      checkoutSuccess: 'Checkout completed successfully!',
      lendingSuccess: 'Equipment lending request submitted successfully!',
      examCreated: 'Exam created successfully',
      examUpdated: 'Exam updated successfully',
      examDeleted: 'Exam deleted successfully',
      bookingFailed: 'Failed to create booking',
      checkoutFailed: 'Failed to process checkout',
      lendingFailed: 'Failed to create lending request',
      loadFailed: 'Failed to load data',
      updateFailed: 'Failed to update',
      deleteFailed: 'Failed to delete',
      selectRoom: 'Please select a room',
      selectEquipment: 'Please select at least one equipment',
      confirmDelete: 'Are you sure?',
      confirmDeleteText: 'You won\'t be able to revert this!',
      confirmDeleteButton: 'Yes, delete it!',
      cancelButton: 'Cancel',
      ok: 'OK',
      success: 'Success!',
      error: 'Error!',
      warning: 'Warning!',
    };
  }
};

// Sweet Alert wrapper functions
export const showSuccess = (message: string) => {
  Swal.fire({
    icon: 'success',
    title: ALERT_MESSAGES.success,
    text: message,
    confirmButtonText: ALERT_MESSAGES.ok,
    confirmButtonColor: '#10B981',
    timer: 3000,
    timerProgressBar: true,
  });
};

export const showError = (message: string) => {
  Swal.fire({
    icon: 'error',
    title: ALERT_MESSAGES.error,
    text: message,
    confirmButtonText: ALERT_MESSAGES.ok,
    confirmButtonColor: '#EF4444',
  });
};

export const showWarning = (message: string) => {
  Swal.fire({
    icon: 'warning',
    title: ALERT_MESSAGES.warning,
    text: message,
    confirmButtonText: ALERT_MESSAGES.ok,
    confirmButtonColor: '#F59E0B',
  });
};

export const showConfirm = (onConfirm: () => void, customText?: string) => {
  Swal.fire({
    title: ALERT_MESSAGES.confirmDelete,
    text: customText || ALERT_MESSAGES.confirmDeleteText,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#EF4444',
    cancelButtonColor: '#6B7280',
    confirmButtonText: ALERT_MESSAGES.confirmDeleteButton,
    cancelButtonText: ALERT_MESSAGES.cancelButton,
  }).then((result) => {
    if (result.isConfirmed) {
      onConfirm();
    }
  });
};

// Quick use functions (using ALERT_MESSAGES keys)
export const alert = {
  success: (messageKey: keyof typeof ALERT_MESSAGES) => showSuccess(ALERT_MESSAGES[messageKey]),
  error: (messageKey: keyof typeof ALERT_MESSAGES) => showError(ALERT_MESSAGES[messageKey]),
  warning: (messageKey: keyof typeof ALERT_MESSAGES) => showWarning(ALERT_MESSAGES[messageKey]),
  
  // Custom messages
  successCustom: (message: string) => showSuccess(message),
  errorCustom: (message: string) => showError(message),
  warningCustom: (message: string) => showWarning(message),
};