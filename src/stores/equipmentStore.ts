// src/stores/equipmentStore.ts
import { create } from 'zustand';

// Equipment Types
export interface EquipmentRoom {
    id: string;
    name: string;
    code: string;
    department_id?: string;
    study_program_id?: string;
    floor?: number;
}

export interface EquipmentItem {
    id: string;
    name: string;
    code: string;
    category?: string;
    quantity: number;
    unit?: string;
    condition?: string;
    is_available: boolean;
    attachments?: string; // base64 image string
    rooms_id?: string;
    table_id?: string;
    rack_id?: string;
    box_id?: string;
    // Mapped room data (from JS mapping, not DB join)
    rooms?: EquipmentRoom | null;
}

export interface LocationData {
    tables: any[];
    racks: any[];
    boxes: any[];
}

interface EquipmentStore {
    // Data
    equipment: EquipmentItem[];
    rooms: Map<string, EquipmentRoom>;
    locations: LocationData;

    // Cache status
    lastFetch: Date;
    isStale: boolean;
    cacheHits: number;
    apiCalls: number;

    // Actions
    setEquipment: (equipment: EquipmentItem[]) => void;
    setRooms: (rooms: EquipmentRoom[]) => void;
    setLocations: (locations: LocationData) => void;
    markStale: () => void;
    shouldRefresh: () => boolean;
    getEquipmentWithRooms: () => EquipmentItem[];
    incrementCacheHit: () => void;
    incrementApiCall: () => void;
    getCacheStats: () => { hitRate: number; totalCalls: number };
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useEquipmentStore = create<EquipmentStore>((set, get) => ({
    // Initial state
    equipment: [],
    rooms: new Map(),
    locations: { tables: [], racks: [], boxes: [] },
    lastFetch: new Date(0),
    isStale: true,
    cacheHits: 0,
    apiCalls: 0,

    setEquipment: (equipment) => {
        set({
            equipment,
            lastFetch: new Date(),
            isStale: false
        });
        get().incrementApiCall();
    },

    setRooms: (roomsList) => {
        const roomsMap = new Map<string, EquipmentRoom>();
        roomsList.forEach(room => roomsMap.set(room.id, room));
        set({ rooms: roomsMap });
    },

    setLocations: (locations) => {
        set({ locations });
    },

    markStale: () => set({ isStale: true }),

    shouldRefresh: () => {
        const { lastFetch, isStale, equipment } = get();
        const isExpired = (Date.now() - lastFetch.getTime()) > CACHE_DURATION;
        const isEmpty = equipment.length === 0;

        if (!isExpired && !isStale && !isEmpty) {
            get().incrementCacheHit();
            return false;
        }

        return isStale || isExpired || isEmpty;
    },

    // Map equipment with rooms from cache
    getEquipmentWithRooms: () => {
        const { equipment, rooms } = get();
        return equipment.map(eq => ({
            ...eq,
            rooms: eq.rooms_id ? rooms.get(eq.rooms_id) || null : null
        }));
    },

    incrementCacheHit: () => set(state => ({ cacheHits: state.cacheHits + 1 })),
    incrementApiCall: () => set(state => ({ apiCalls: state.apiCalls + 1 })),

    getCacheStats: () => {
        const { cacheHits, apiCalls } = get();
        const totalRequests = cacheHits + apiCalls;
        return {
            hitRate: totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0,
            totalCalls: totalRequests
        };
    }
}));
