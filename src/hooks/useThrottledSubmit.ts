import { useState, useCallback, useRef } from 'react';

/**
 * Hook to throttle form submissions to prevent double-clicks/spam.
 * @param delay Throttle delay in milliseconds (default 2000ms)
 * @returns [isSubmitting, throttledSubmit]
 */
export const useThrottledSubmit = (delay = 2000) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const lastRun = useRef(0);

    const throttledSubmit = useCallback(async (callback: () => Promise<void> | void) => {
        const now = Date.now();

        if (now - lastRun.current < delay) {
            return;
        }

        if (isSubmitting) return;

        try {
            lastRun.current = now;
            setIsSubmitting(true);
            await callback();
        } finally {
            // Keep isSubmitting true for a bit longer to prevent rapid re-clicks
            setTimeout(() => {
                setIsSubmitting(false);
            }, 500);
        }
    }, [delay, isSubmitting]);

    return { isSubmitting, throttledSubmit };
};
