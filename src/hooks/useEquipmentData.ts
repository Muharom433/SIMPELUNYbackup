// src/hooks/useEquipmentData.ts
import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useEquipmentStore, EquipmentItem, EquipmentRoom } from '../stores/equipmentStore';

export const useEquipmentData = () => {
    // Get state from store using selectors (stable references)
    const storeEquipment = useEquipmentStore(state => state.equipment);
    const locations = useEquipmentStore(state => state.locations);
    const setEquipment = useEquipmentStore(state => state.setEquipment);
    const setRooms = useEquipmentStore(state => state.setRooms);
    const setLocations = useEquipmentStore(state => state.setLocations);
    const shouldRefresh = useEquipmentStore(state => state.shouldRefresh);
    const getCacheStats = useEquipmentStore(state => state.getCacheStats);
    const markStale = useEquipmentStore(state => state.markStale);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Memoize equipment to prevent infinite re-renders
    // Equipment already has rooms included from the join
    const equipment = useMemo(() => storeEquipment, [storeEquipment]);

    /**
     * Fetch location data in background (non-blocking)
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
     * Fetch equipment data with rooms directly joined
     */
    const fetchEquipmentData = useCallback(async (forceRefresh = false) => {
        // Check cache first
        if (!forceRefresh && !shouldRefresh()) {
            console.log('📦 Equipment dari cache');
            return storeEquipment;
        }

        setLoading(true);
        setError(null);

        try {
            console.log('🚀 Fetching ALL equipment data (will be cached)...');
            const startTime = Date.now();

            // Fetch rooms (for other uses)
            const roomsRes = await supabase
                .from('rooms')
                .select('id, name, code, department_id, study_program_id')
                .order('name');

            if (roomsRes.error) {
                console.warn('Rooms fetch warning:', roomsRes.error);
            }

            // Fetch equipment WITH ROOMS - TANPA attachments untuk menghindari timeout
            // Filter is_available dan quantity di client untuk query lebih cepat
            const equipmentRes = await supabase
                .from('equipment')
                .select(`
                    id, name, code, category, quantity, unit, condition, is_available,
                    rooms_id, table_id, rack_id, box_id,
                    rooms:rooms_id (
                        id, name, code, department_id, study_program_id
                    )
                `)
                .order('name');

            console.log(`⚡ Fetch selesai dalam ${Date.now() - startTime}ms`);

            if (equipmentRes.error) {
                console.error('Equipment fetch error:', equipmentRes.error);
                setEquipment([]);
                setLoading(false);
                return [];
            }

            const rawEquipment = equipmentRes.data || [];
            const rawRooms = (roomsRes.data || []) as EquipmentRoom[];

            console.log(`📦 Loaded: ${rawEquipment.length} equipment, ${rawRooms.length} rooms`);

            // Process equipment - filter is_available dan quantity di client
            const processedEquipment = rawEquipment
                .filter((eq: any) => eq.is_available === true && eq.quantity > 0)
                .map((eq: any) => ({
                    ...eq,
                    rooms: eq.rooms || null
                })) as EquipmentItem[];

            console.log(`📦 After filter: ${processedEquipment.length} available equipment`);

            // Save to store for caching
            setRooms(rawRooms);
            setEquipment(processedEquipment);

            // Load location data in background
            fetchLocations();

            console.log(`✅ Equipment cached successfully`);

            return processedEquipment;

        } catch (err: any) {
            console.error('❌ Error loading equipment:', err);
            setError(err.message || 'Gagal memuat peralatan');
            return [];
        } finally {
            setLoading(false);
        }
    }, [shouldRefresh, setEquipment, setRooms, storeEquipment, fetchLocations]);

    /**
     * Filter equipment by study program (client-side filtering)
     */
    const filterByStudyProgram = useCallback((
        departmentId: string | null,
        studyProgramId: string | null
    ): EquipmentItem[] => {
        if (!departmentId && !studyProgramId) {
            return storeEquipment;
        }

        return storeEquipment.filter((eq: EquipmentItem) => {
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
    }, [storeEquipment]);

    /**
     * Force refresh data
     */
    const refresh = useCallback(() => {
        markStale();
        return fetchEquipmentData(true);
    }, [markStale, fetchEquipmentData]);

    return {
        // Data - stable reference from useMemo
        equipment,
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
