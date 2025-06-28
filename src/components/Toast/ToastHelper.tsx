// utils/toastHelpers.ts
import toast from 'react-hot-toast';

export const showToast = {
  success: (enText: string, idText: string, getText: (en: string, id: string) => string, options?: any) => {
    const message = getText(enText, idText);
    console.log('Toast message:', message); // Debug log
    if (message && typeof message === 'string') {
      return toast.success(message, options);
    } else {
      console.error('Invalid toast message:', message);
      return toast.success(enText, options); // Fallback to English
    }
  },
  
  error: (enText: string, idText: string, getText: (en: string, id: string) => string, options?: any) => {
    const message = getText(enText, idText);
    console.log('Toast error message:', message); // Debug log
    if (message && typeof message === 'string') {
      return toast.error(message, options);
    } else {
      console.error('Invalid toast error message:', message);
      return toast.error(enText, options); // Fallback to English
    }
  },
  
  info: (enText: string, idText: string, getText: (en: string, id: string) => string, options?: any) => {
    const message = getText(enText, idText);
    if (message && typeof message === 'string') {
      return toast(message, options);
    } else {
      return toast(enText, options); // Fallback to English
    }
  }
};

// Alternative simpler approach - direct usage
export const safeToast = {
  success: (message: string | undefined | null, fallback: string = 'Success') => {
    const finalMessage = (message && typeof message === 'string') ? message : fallback;
    return toast.success(finalMessage);
  },
  
  error: (message: string | undefined | null, fallback: string = 'Error occurred') => {
    const finalMessage = (message && typeof message === 'string') ? message : fallback;
    return toast.error(finalMessage);
  },
  
  info: (message: string | undefined | null, fallback: string = 'Info') => {
    const finalMessage = (message && typeof message === 'string') ? message : fallback;
    return toast(finalMessage);
  }
};