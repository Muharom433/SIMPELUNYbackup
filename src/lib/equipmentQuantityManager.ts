class EquipmentQuantityManager {
    constructor(private supabase: any) {}

    // ✅ ADD: Individual increaseQuantity method
    async increaseQuantity(equipmentId: string, quantity: number, reason: string = '') {
        try {
            
            // ✅ STEP 1: Get current equipment data
            const { data: equipment, error: fetchError } = await this.supabase
                .from('equipment')
                .select('id, name, code, quantity, unit')
                .eq('id', equipmentId)
                .single();

            if (fetchError) {
                throw new Error(`Database error for equipment ${equipmentId}: ${fetchError.message}`);
            }

            if (!equipment) {
                throw new Error(`Equipment with ID ${equipmentId} not found in database`);
            }


            // ✅ STEP 2: Calculate new quantity
            const newQuantity = equipment.quantity + quantity;

            // ✅ STEP 3: Update equipment quantity
            const { error: updateError } = await this.supabase
                .from('equipment')
                .update({ 
                    quantity: newQuantity,
                    updated_at: new Date().toISOString()
                })
                .eq('id', equipmentId);

            if (updateError) {
                throw updateError;
            }

            
            return {
                equipment_id: equipmentId,
                equipment_name: equipment.name,
                old_quantity: equipment.quantity,
                new_quantity: newQuantity,
                change: +quantity,
                success: true
            };

        } catch (error) {
            throw error;
        }
    }

    // ✅ ADD: Individual decreaseQuantity method
    async decreaseQuantity(equipmentId: string, quantity: number, reason: string = '') {
        try {
            
            // ✅ STEP 1: Get current equipment data
            const { data: equipment, error: fetchError } = await this.supabase
                .from('equipment')
                .select('id, name, code, quantity, unit')
                .eq('id', equipmentId)
                .single();

            if (fetchError) {
                throw new Error(`Database error for equipment ${equipmentId}: ${fetchError.message}`);
            }

            if (!equipment) {
                throw new Error(`Equipment with ID ${equipmentId} not found in database`);
            }


            // ✅ STEP 2: Validate sufficient quantity
            if (equipment.quantity < quantity) {
                const errorMsg = `Insufficient quantity for ${equipment.name || equipment.id}. Available: ${equipment.quantity}, Requested: ${quantity}`;
                throw new Error(errorMsg);
            }

            // ✅ STEP 3: Calculate new quantity
            const newQuantity = equipment.quantity - quantity;

            // ✅ STEP 4: Update equipment quantity
            const { error: updateError } = await this.supabase
                .from('equipment')
                .update({ 
                    quantity: newQuantity,
                    updated_at: new Date().toISOString()
                })
                .eq('id', equipmentId);

            if (updateError) {
                throw updateError;
            }

            
            return {
                equipment_id: equipmentId,
                equipment_name: equipment.name,
                old_quantity: equipment.quantity,
                new_quantity: newQuantity,
                change: -quantity,
                success: true
            };

        } catch (error) {
            throw error;
        }
    }

    // ✅ EXISTING: Bulk decrease method
    async bulkDecreaseQuantity(equipmentList: Array<{id: string, quantity: number}>, reason: string = '') {

        try {
            const adjustments = equipmentList.map(item => ({
                id: item.id,
                delta: -item.quantity
            }));

            const { data, error } = await this.supabase
                .rpc('bulk_adjust_quantities', { adjustments });

            if (error) {
                throw new Error(`Bulk update failed: ${error.message}`);
            }


            return data;
        } catch (error) {
            throw error;
        }
    }

    // ✅ EXISTING: Bulk increase method
    async bulkIncreaseQuantity(equipmentList: Array<{id: string, quantity: number}>, reason: string = '') {

        try {
            const adjustments = equipmentList.map(item => ({
                id: item.id,
                delta: +item.quantity
            }));

            const { data, error } = await this.supabase
                .rpc('bulk_adjust_quantities', { adjustments });

            if (error) {
                throw new Error(`Bulk update failed: ${error.message}`);
            }


            return data;
        } catch (error) {
            throw error;
        }
    }

    // ✅ EXISTING: Helper method for building equipment list from booking
    static buildEquipmentListFromBooking(booking: any): Array<{id: string, quantity: number}> {

        if (!booking.equipment_requested || booking.equipment_requested.length === 0) {
            return [];
        }

        const equipmentList = booking.equipment_requested.map((equipmentId: string, index: number) => {
            const quantity = booking.equipment_quantities?.[index] || 1;
            

            return {
                id: equipmentId,
                quantity: quantity
            };
        });

        return equipmentList;
    }

    // ✅ ADD: Helper method for building equipment list from lending
    static buildEquipmentListFromLending(lending: any): Array<{id: string, quantity: number}> {

        if (!lending.id_equipment || lending.id_equipment.length === 0) {
            return [];
        }

        const equipmentList = lending.id_equipment.map((equipmentId: string, index: number) => {
            const quantity = lending.qty?.[index] || 1;
            

            return {
                id: equipmentId,
                quantity: quantity
            };
        });

        return equipmentList;
    }

    // ✅ EXISTING: Debug method for troubleshooting
    async debugEquipment(equipmentId: string) {
        
        try {
            // Test 1: Direct query dengan exact ID
            const { data: exactMatch, error: exactError } = await this.supabase
                .from('equipment')
                .select('*')
                .eq('id', equipmentId)
                .single();


            // Test 2: Query dengan partial ID untuk cek typo
            const { data: partialMatches, error: partialError } = await this.supabase
                .from('equipment')
                .select('id, name, code')
                .ilike('id', `%${equipmentId.slice(-12)}%`);


            // Test 3: Query semua equipment untuk cek struktur data
            const { data: allEquipment, error: allError } = await this.supabase
                .from('equipment')
                .select('id, name, code')
                .limit(5);


            return {
                exactMatch,
                partialMatches,
                allEquipment
            };

        } catch (error) {
            return { error };
        }
    }

    // ✅ ADD: Batch operation for mixed increase/decrease
    async batchUpdateQuantities(operations: Array<{
        equipmentId: string;
        type: 'increase' | 'decrease';
        quantity: number;
        reason?: string;
    }>) {

        try {
            const adjustments = operations.map(op => ({
                id: op.equipmentId,
                delta: op.type === 'increase' ? op.quantity : -op.quantity
            }));

            const { data, error } = await this.supabase
                .rpc('bulk_adjust_quantities', { adjustments });

            if (error) {
                return {
                    results: [],
                    errors: [{ error: error.message }],
                    success: false
                };
            }


            return {
                results: data || [],
                errors: [],
                success: true
            };
        } catch (error) {
            return {
                results: [],
                errors: [{ error: error.message }],
                success: false
            };
        }
    }
}

export default EquipmentQuantityManager;