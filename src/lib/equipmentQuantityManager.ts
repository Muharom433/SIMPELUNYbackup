class EquipmentQuantityManager {
    constructor(private supabase: any) {}

    // ✅ ADD: Individual increaseQuantity method
    async increaseQuantity(equipmentId: string, quantity: number, reason: string = '') {
        try {
            console.log(`📈 INCREASING quantity for equipment ${equipmentId} by ${quantity}`);
            console.log(`📝 Reason: ${reason}`);
            
            // ✅ STEP 1: Get current equipment data
            const { data: equipment, error: fetchError } = await this.supabase
                .from('equipment')
                .select('id, name, code, quantity, unit')
                .eq('id', equipmentId)
                .single();

            if (fetchError) {
                console.error(`❌ Database error fetching equipment ${equipmentId}:`, fetchError);
                throw new Error(`Database error for equipment ${equipmentId}: ${fetchError.message}`);
            }

            if (!equipment) {
                console.error(`❌ Equipment not found in database: ${equipmentId}`);
                throw new Error(`Equipment with ID ${equipmentId} not found in database`);
            }

            console.log(`✅ Equipment found:`, {
                id: equipment.id,
                name: equipment.name,
                currentQuantity: equipment.quantity,
                increaseBy: quantity
            });

            // ✅ STEP 2: Calculate new quantity
            const newQuantity = equipment.quantity + quantity;
            console.log(`📊 Updating quantity: ${equipment.quantity} + ${quantity} = ${newQuantity}`);

            // ✅ STEP 3: Update equipment quantity
            const { error: updateError } = await this.supabase
                .from('equipment')
                .update({ 
                    quantity: newQuantity,
                    updated_at: new Date().toISOString()
                })
                .eq('id', equipmentId);

            if (updateError) {
                console.error(`❌ Update error for equipment ${equipmentId}:`, updateError);
                throw updateError;
            }

            console.log(`✅ Successfully increased quantity for ${equipment.name}: ${equipment.quantity} → ${newQuantity}`);
            
            return {
                equipment_id: equipmentId,
                equipment_name: equipment.name,
                old_quantity: equipment.quantity,
                new_quantity: newQuantity,
                change: +quantity,
                success: true
            };

        } catch (error) {
            console.error(`❌ Error increasing quantity for ${equipmentId}:`, error);
            throw error;
        }
    }

    // ✅ ADD: Individual decreaseQuantity method
    async decreaseQuantity(equipmentId: string, quantity: number, reason: string = '') {
        try {
            console.log(`📉 DECREASING quantity for equipment ${equipmentId} by ${quantity}`);
            console.log(`📝 Reason: ${reason}`);
            
            // ✅ STEP 1: Get current equipment data
            const { data: equipment, error: fetchError } = await this.supabase
                .from('equipment')
                .select('id, name, code, quantity, unit')
                .eq('id', equipmentId)
                .single();

            if (fetchError) {
                console.error(`❌ Database error fetching equipment ${equipmentId}:`, fetchError);
                throw new Error(`Database error for equipment ${equipmentId}: ${fetchError.message}`);
            }

            if (!equipment) {
                console.error(`❌ Equipment not found in database: ${equipmentId}`);
                throw new Error(`Equipment with ID ${equipmentId} not found in database`);
            }

            console.log(`✅ Equipment found:`, {
                id: equipment.id,
                name: equipment.name,
                currentQuantity: equipment.quantity,
                decreaseBy: quantity
            });

            // ✅ STEP 2: Validate sufficient quantity
            if (equipment.quantity < quantity) {
                const errorMsg = `Insufficient quantity for ${equipment.name || equipment.id}. Available: ${equipment.quantity}, Requested: ${quantity}`;
                console.error(`❌ ${errorMsg}`);
                throw new Error(errorMsg);
            }

            // ✅ STEP 3: Calculate new quantity
            const newQuantity = equipment.quantity - quantity;
            console.log(`📊 Updating quantity: ${equipment.quantity} - ${quantity} = ${newQuantity}`);

            // ✅ STEP 4: Update equipment quantity
            const { error: updateError } = await this.supabase
                .from('equipment')
                .update({ 
                    quantity: newQuantity,
                    updated_at: new Date().toISOString()
                })
                .eq('id', equipmentId);

            if (updateError) {
                console.error(`❌ Update error for equipment ${equipmentId}:`, updateError);
                throw updateError;
            }

            console.log(`✅ Successfully decreased quantity for ${equipment.name}: ${equipment.quantity} → ${newQuantity}`);
            
            return {
                equipment_id: equipmentId,
                equipment_name: equipment.name,
                old_quantity: equipment.quantity,
                new_quantity: newQuantity,
                change: -quantity,
                success: true
            };

        } catch (error) {
            console.error(`❌ Error decreasing quantity for ${equipmentId}:`, error);
            throw error;
        }
    }

    // ✅ EXISTING: Bulk decrease method
    async bulkDecreaseQuantity(equipmentList: Array<{id: string, quantity: number}>, reason: string = '') {
        console.log('🔄 BULK DECREASE: Starting bulk operation', {
            equipmentList,
            reason,
            totalItems: equipmentList.length
        });

        const results = [];
        const errors = [];

        for (const item of equipmentList) {
            try {
                const result = await this.decreaseQuantity(item.id, item.quantity, reason);
                results.push(result);
            } catch (error) {
                console.error(`❌ Error processing equipment ${item.id}:`, error);
                errors.push({
                    equipment_id: item.id,
                    error: error.message,
                    success: false
                });
            }
        }

        // ✅ SUMMARY LOGGING
        console.log('📋 BULK DECREASE SUMMARY:', {
            total: equipmentList.length,
            successful: results.length,
            failed: errors.length,
            reason
        });

        if (errors.length > 0) {
            console.error('❌ BULK VALIDATION ERRORS:', errors);
            throw new Error(`Bulk validation failed: ${errors.map(e => e.error).join(', ')}`);
        }

        return results;
    }

    // ✅ EXISTING: Bulk increase method
    async bulkIncreaseQuantity(equipmentList: Array<{id: string, quantity: number}>, reason: string = '') {
        console.log('🔄 BULK INCREASE: Starting bulk operation', {
            equipmentList,
            reason,
            totalItems: equipmentList.length
        });

        const results = [];
        const errors = [];

        for (const item of equipmentList) {
            try {
                const result = await this.increaseQuantity(item.id, item.quantity, reason);
                results.push(result);
            } catch (error) {
                console.error(`❌ Error processing equipment ${item.id}:`, error);
                errors.push({
                    equipment_id: item.id,
                    error: error.message,
                    success: false
                });
            }
        }

        // ✅ SUMMARY LOGGING
        console.log('📋 BULK INCREASE SUMMARY:', {
            total: equipmentList.length,
            successful: results.length,
            failed: errors.length,
            reason
        });

        if (errors.length > 0) {
            console.error('❌ BULK VALIDATION ERRORS:', errors);
            throw new Error(`Bulk validation failed: ${errors.map(e => e.error).join(', ')}`);
        }

        return results;
    }

    // ✅ EXISTING: Helper method for building equipment list from booking
    static buildEquipmentListFromBooking(booking: any): Array<{id: string, quantity: number}> {
        console.log('🏗️ Building equipment list from booking:', {
            bookingId: booking.id,
            equipment_requested: booking.equipment_requested,
            equipment_quantities: booking.equipment_quantities
        });

        if (!booking.equipment_requested || booking.equipment_requested.length === 0) {
            console.log('ℹ️ No equipment requested in booking');
            return [];
        }

        const equipmentList = booking.equipment_requested.map((equipmentId: string, index: number) => {
            const quantity = booking.equipment_quantities?.[index] || 1;
            
            console.log(`📋 Equipment ${index + 1}:`, {
                id: equipmentId,
                quantity: quantity,
                index: index
            });

            return {
                id: equipmentId,
                quantity: quantity
            };
        });

        console.log('✅ Final equipment list:', equipmentList);
        return equipmentList;
    }

    // ✅ ADD: Helper method for building equipment list from lending
    static buildEquipmentListFromLending(lending: any): Array<{id: string, quantity: number}> {
        console.log('🏗️ Building equipment list from lending:', {
            lendingId: lending.id,
            id_equipment: lending.id_equipment,
            qty: lending.qty
        });

        if (!lending.id_equipment || lending.id_equipment.length === 0) {
            console.log('ℹ️ No equipment in lending record');
            return [];
        }

        const equipmentList = lending.id_equipment.map((equipmentId: string, index: number) => {
            const quantity = lending.qty?.[index] || 1;
            
            console.log(`📋 Equipment ${index + 1}:`, {
                id: equipmentId,
                quantity: quantity,
                index: index
            });

            return {
                id: equipmentId,
                quantity: quantity
            };
        });

        console.log('✅ Final equipment list:', equipmentList);
        return equipmentList;
    }

    // ✅ EXISTING: Debug method for troubleshooting
    async debugEquipment(equipmentId: string) {
        console.log(`🔍 DEBUGGING EQUIPMENT: ${equipmentId}`);
        
        try {
            // Test 1: Direct query dengan exact ID
            const { data: exactMatch, error: exactError } = await this.supabase
                .from('equipment')
                .select('*')
                .eq('id', equipmentId)
                .single();

            console.log('🎯 Exact match result:', { exactMatch, exactError });

            // Test 2: Query dengan partial ID untuk cek typo
            const { data: partialMatches, error: partialError } = await this.supabase
                .from('equipment')
                .select('id, name, code')
                .ilike('id', `%${equipmentId.slice(-12)}%`);

            console.log('🔍 Partial matches:', { partialMatches, partialError });

            // Test 3: Query semua equipment untuk cek struktur data
            const { data: allEquipment, error: allError } = await this.supabase
                .from('equipment')
                .select('id, name, code')
                .limit(5);

            console.log('📊 Sample equipment records:', { allEquipment, allError });

            return {
                exactMatch,
                partialMatches,
                allEquipment
            };

        } catch (error) {
            console.error('❌ Debug error:', error);
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
        console.log('🔄 BATCH UPDATE: Starting batch operation', {
            operations,
            totalOperations: operations.length
        });

        const results = [];
        const errors = [];

        for (const operation of operations) {
            try {
                let result;
                if (operation.type === 'increase') {
                    result = await this.increaseQuantity(
                        operation.equipmentId, 
                        operation.quantity, 
                        operation.reason || 'Batch operation'
                    );
                } else {
                    result = await this.decreaseQuantity(
                        operation.equipmentId, 
                        operation.quantity, 
                        operation.reason || 'Batch operation'
                    );
                }
                results.push(result);
            } catch (error) {
                console.error(`❌ Error in batch operation for ${operation.equipmentId}:`, error);
                errors.push({
                    equipment_id: operation.equipmentId,
                    operation_type: operation.type,
                    error: error.message,
                    success: false
                });
            }
        }

        // ✅ SUMMARY LOGGING
        console.log('📋 BATCH UPDATE SUMMARY:', {
            total: operations.length,
            successful: results.length,
            failed: errors.length
        });

        if (errors.length > 0) {
            console.error('❌ BATCH UPDATE ERRORS:', errors);
            // Don't throw error for batch operations, just return results with errors
        }

        return {
            results,
            errors,
            success: errors.length === 0
        };
    }
}

export default EquipmentQuantityManager;