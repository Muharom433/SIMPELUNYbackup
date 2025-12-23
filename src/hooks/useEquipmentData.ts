// src/hooks/useEquipmentData.ts
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useEquipmentStore, EquipmentItem, EquipmentRoom } from '../stores/equipmentStore';

export const useEquipmentData = () => {
    const {
        locations,
        setEquipment,
        setRooms,
        setLocations,
        shouldRefresh,
        getEquipmentWithRooms,
        getCacheStats,
        markStale
    } = useEquipmentStore();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Fetch location data in background (non-blocking)
     * Declared first karena dipakai oleh fetchEquipmentData
     */
    const fetchLocations = useCallback(async () => {
        try {
            const [tablesRes, racksRes, boxesRes] = await Promise.all([
                supabase.from('table').select('id, room_id, description, rack').limit(200),
                supabase.from('rack').select('id, name, table_id').limit(200),
                supabase.from('box').select('id, name, description, rack_id').limit(200)
            ]);

            setLocations({
                tables: tablesRes.data || [],
                racks: racksRes.data || [],
                boxes: boxesRes.data || []
            });

            console.log('📍 Location data loaded');
        } catch (err) {
            console.warn('⚠️ Location data warning:', err);
        }
    }, [setLocations]);

    /**
     * Fetch equipment data dengan parallel fetch strategy (seperti useRoomData)
     * - NO DATABASE JOINS = lebih cepat
     * - Parallel fetch = equipment + rooms bersamaan
     * - JS mapping = gabungkan data di client
     */
    const fetchEquipmentData = useCallback(async (forceRefresh = false) => {
        // Check cache first
        if (!forceRefresh && !shouldRefresh()) {
            console.log('📦 Equipment dari cache');
            return getEquipmentWithRooms();
        }

        setLoading(true);
        setError(null);

        try {
            console.log('🚀 Fetching equipment (with attachments, smaller batch)...');
            const startTime = Date.now();

            // ✅ OPTIMIZED: Fetch rooms FIRST (smaller table, faster)
            const roomsRes = await supabase
                .from('rooms')
                .select('id, name, code, department_id, study_program_id')
                .limit(100);

            if (roomsRes.error) {
                console.warn('Rooms fetch warning:', roomsRes.error);
            }

            // ✅ INCLUDE attachments like Tool Administration does
            // Use smaller limit (25) to avoid timeout with base64 images
            const equipmentRes = await supabase
                .from('equipment')
                .select('id, name, code, category, quantity, unit, condition, is_available, attachments, rooms_id, table_id, rack_id, box_id')
                .eq('is_available', true)
                .gt('quantity', 0)
                .order('name')
                .limit(25); // Keep small to avoid timeout with base64 images

            console.log(`⚡ Sequential fetch selesai dalam ${Date.now() - startTime}ms`);

            // Handle errors gracefully
            if (equipmentRes.error) {
                console.error('Equipment fetch error:', equipmentRes.error);
                setEquipment([]);
                setLoading(false);
                return [];
            }

            const rawEquipment = equipmentRes.data || [];
            const rawRooms = (roomsRes.data || []) as EquipmentRoom[];

            console.log(`📦 Data: ${rawEquipment.length} equipment, ${rawRooms.length} rooms`);

            // Save to store
            setRooms(rawRooms);
            setEquipment(rawEquipment as EquipmentItem[]);

            // ✅ BACKGROUND: Load location data (non-blocking)
            fetchLocations();

            const stats = getCacheStats();
            console.log(`✅ Equipment loaded. Cache hit rate: ${stats.hitRate.toFixed(1)}%`);

            return getEquipmentWithRooms();

        } catch (err: any) {
            console.error('❌ Error loading equipment:', err);
            setError(err.message || 'Gagal memuat peralatan');
            return [];
        } finally {
            setLoading(false);
        }
    }, [shouldRefresh, setEquipment, setRooms, getEquipmentWithRooms, getCacheStats, fetchLocations]);

    /**
     * Filter equipment by study program (client-side filtering)
     */
    const filterByStudyProgram = useCallback((
        departmentId: string | null,
        studyProgramId: string | null
    ): EquipmentItem[] => {
        const allEquipment = getEquipmentWithRooms();

        if (!departmentId && !studyProgramId) {
            return allEquipment;
        }

        return allEquipment.filter(eq => {
            const room = eq.rooms;
            if (!room) return false;

            // General room (no specifics) - accessible by all
            if (!room.department_id && !room.study_program_id) {
                return true;
            }

            // Match by study program first
            if (studyProgramId && room.study_program_id === studyProgramId) {
                return true;
            }

            // Match by department
            if (departmentId && room.department_id === departmentId) {
                return true;
            }

            return false;
        });
    }, [getEquipmentWithRooms]);

    /**
     * Force refresh data
     */
    const refresh = useCallback(() => {
        markStale();
        return fetchEquipmentData(true);
    }, [markStale, fetchEquipmentData]);

    return {
        // Data
        equipment: getEquipmentWithRooms(),
        locations,

        // Status
        loading,
        error,

        // Actions
        fetchEquipmentData,
        filterByStudyProgram,
        refresh,

        // Stats
        cacheStats: getCacheStats()
    };
};
