import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface RoomQRPayload {
  payload: string;
  mode: 'legacy' | 'secured';
  version: number;
  rotated_at: string | null;
}

export interface RoomQRStatus {
  room_id: string;
  mode: 'legacy' | 'secured';
  version: number;
  rotated_at: string | null;
}

export function useRoomQR() {
  const [loading, setLoading] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [qrData, setQRData] = useState<RoomQRPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPayload = useCallback(async (roomId: string, userId?: string) => {
    if (!roomId) return null;
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_room_qr_payload', {
        p_room_id: roomId,
        p_user_id: userId || null
      });

      if (rpcError) throw rpcError;

      const payloadData = data as unknown as RoomQRPayload;
      setQRData(payloadData);
      return payloadData;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch QR payload';
      setError(msg);
      // Fallback to legacy UUID display so the modal does not break for admins if payload fetch fails
      const fallbackData: RoomQRPayload = {
        payload: roomId,
        mode: 'legacy',
        version: 0,
        rotated_at: null
      };
      setQRData(fallbackData);
      return fallbackData;
    } finally {
      setLoading(false);
    }
  }, []);

  const redeemQR = useCallback(async (roomId: string, userId: string, password: string) => {
    if (!roomId || !userId || !password) {
      throw new Error('Room ID, User ID, and password are required');
    }

    setIsRedeeming(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('redeem_room_qr', {
        p_room_id: roomId,
        p_user_id: userId,
        p_password: password
      });

      if (rpcError) throw rpcError;

      const newQRData = data as unknown as RoomQRPayload;
      setQRData(newQRData);
      return newQRData;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to redeem QR code';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsRedeeming(false);
    }
  }, []);

  const fetchStatuses = useCallback(async (userId?: string): Promise<RoomQRStatus[]> => {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_room_qr_statuses', {
        p_user_id: userId || null
      });

      if (rpcError) throw rpcError;
      return (data || []) as unknown as RoomQRStatus[];
    } catch {
      return [];
    }
  }, []);

  return {
    qrData,
    loading,
    isRedeeming,
    error,
    fetchPayload,
    redeemQR,
    fetchStatuses,
    setQRData
  };
}
