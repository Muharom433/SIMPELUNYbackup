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
                supabase.from('table').select('id, room_id, description, rack').limit(1000),
                supabase.from('rack').select('id, name, table_id').limit(1000),
                supabase.from('box').select('id, name, description, rack_id').limit(1000)
            ]);

            setLocations({
                tables: tablesRes.data || [],
                racks: racksRes.data || [],
                boxes: boxesRes.data || []
            });


        } catch (err) {
        }
    }, [setLocations]);

    /**
     * Fetch equipment data with rooms directly joined
     */
    const fetchEquipmentData = useCallback(async (forceRefresh = false) => {
        // Check cache first
        if (!forceRefresh && !shouldRefresh()) {

            return storeEquipment;
        }

        setLoading(true);
        setError(null);

        try {

            const startTime = Date.now();

            // Fetch rooms (for other uses)
            const roomsRes = await supabase
                .from('rooms')
                .select('id, name, code, department_id, study_program_ids')
                .order('name');

            if (roomsRes.error) {
            }

            // Fetch equipment WITH ROOMS - TANPA attachments untuk menghindari timeout
            // Filter is_available dan quantity di client untuk query lebih cepat
            // Fetch equipment WITH ROOMS - Chunked Strategy
            // We fetch in batches of 1000 to bypass the default row limit
            const BATCH_SIZE = 1000;
            let allEquipment: any[] = [];
            let from = 0;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('equipment')
                    .select(`
                        id, name, code, category, quantity, unit, condition, is_available,
                        rooms_id, table_id, rack_id, box_id,
                        rooms:rooms_id (
                            id, name, code, department_id, study_program_ids
                        )
                    `)
                    .order('name')
                    .range(from, from + BATCH_SIZE - 1);

                if (error) {
                    if (from === 0) {
                        setEquipment([]);
                        setLoading(false);
                        return [];
                    } else {
                        break;
                    }
                }

                if (data && data.length > 0) {
                    allEquipment.push(...data);
                    if (data.length < BATCH_SIZE) {
                        hasMore = false;
                    } else {
                        from += BATCH_SIZE;
                    }
                } else {
                    hasMore = false;
                }
            }

            const rawEquipment = allEquipment;
            const rawRooms = (roomsRes.data || []) as EquipmentRoom[];



            // Process equipment - filter is_available dan quantity di client
            const processedEquipment = rawEquipment
                .filter((eq: any) => eq.is_available === true && eq.quantity > 0)
                .map((eq: any) => ({
                    ...eq,
                    rooms: eq.rooms || null
                })) as EquipmentItem[];



            // Save to store for caching
            setRooms(rawRooms);
            setEquipment(processedEquipment);

            // Load location data in background
            fetchLocations();



            return processedEquipment;

        } catch (err: any) {
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

            const roomProdiIds = (room as any).study_program_ids || [];

            // Case 1: Department exists and matches -> SHOW
            if (room.department_id && room.department_id === departmentId) {
                return true;
            }

            // Case 2: Department is null but study_program_ids includes user's prodi -> SHOW
            if (!room.department_id && studyProgramId && roomProdiIds.includes(studyProgramId)) {
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
