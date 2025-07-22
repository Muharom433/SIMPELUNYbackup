class EquipmentQuantityManager {
    constructor(private supabase: any) {}

    // ✅ ENHANCED: Bulk decrease dengan better error handling dan debugging
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
                console.log(`📦 Processing equipment: ${item.id} (quantity: ${item.quantity})`);
                
                // ✅ STEP 1: Verify equipment exists with detailed logging
                const { data: equipment, error: fetchError } = await this.supabase
                    .from('equipment')
                    .select('id, name, code, quantity, unit')
                    .eq('id', item.id)
                    .single();

                if (fetchError) {
                    console.error(`❌ Database error fetching equipment ${item.id}:`, fetchError);
                    throw new Error(`Database error for equipment ${item.id}: ${fetchError.message}`);
                }

                if (!equipment) {
                    console.error(`❌ Equipment not found in database: ${item.id}`);
                    console.log('🔍 Attempting to search equipment with partial match...');
                    
                    // ✅ DEBUGGING: Try to find equipment with partial UUID match
                    const { data: similarEquipment } = await this.supabase
                        .from('equipment')
                        .select('id, name, code')
                        .ilike('id', `%${item.id.slice(-8)}%`)
                        .limit(5);
                        
                    console.log('🔍 Similar equipment found:', similarEquipment);
                    
                    throw new Error(`Equipment with ID ${item.id} not found in database`);
                }

                console.log(`✅ Equipment found:`, {
                    id: equipment.id,
                    name: equipment.name,
                    code: equipment.code,
                    currentQuantity: equipment.quantity,
                    requestedDecrease: item.quantity
                });

                // ✅ STEP 2: Validate sufficient quantity
                if (equipment.quantity < item.quantity) {
                    const errorMsg = `Insufficient quantity for ${equipment.name || equipment.id}. Available: ${equipment.quantity}, Requested: ${item.quantity}`;
                    console.error(`❌ ${errorMsg}`);
                    throw new Error(errorMsg);
                }

                // ✅ STEP 3: Update quantity
                const newQuantity = equipment.quantity - item.quantity;
                console.log(`📊 Updating quantity: ${equipment.quantity} - ${item.quantity} = ${newQuantity}`);

                const { error: updateError } = await this.supabase
                    .from('equipment')
                    .update({ 
                        quantity: newQuantity,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id);

                if (updateError) {
                    console.error(`❌ Update error for equipment ${item.id}:`, updateError);
                    throw updateError;
                }

                console.log(`✅ Successfully decreased quantity for ${equipment.name}: ${equipment.quantity} → ${newQuantity}`);
                
                results.push({
                    equipment_id: item.id,
                    equipment_name: equipment.name,
                    old_quantity: equipment.quantity,
                    new_quantity: newQuantity,
                    change: -item.quantity,
                    success: true
                });

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

    // ✅ ENHANCED: Bulk increase dengan debugging yang sama
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
                console.log(`📦 Processing equipment: ${item.id} (quantity: +${item.quantity})`);
                
                // ✅ STEP 1: Verify equipment exists
                const { data: equipment, error: fetchError } = await this.supabase
                    .from('equipment')
                    .select('id, name, code, quantity, unit')
                    .eq('id', item.id)
                    .single();

                if (fetchError) {
                    console.error(`❌ Database error fetching equipment ${item.id}:`, fetchError);
                    throw new Error(`Database error for equipment ${item.id}: ${fetchError.message}`);
                }

                if (!equipment) {
                    console.error(`❌ Equipment not found in database: ${item.id}`);
                    throw new Error(`Equipment with ID ${item.id} not found in database`);
                }

                console.log(`✅ Equipment found:`, {
                    id: equipment.id,
                    name: equipment.name,
                    code: equipment.code,
                    currentQuantity: equipment.quantity,
                    requestedIncrease: item.quantity
                });

                // ✅ STEP 2: Update quantity
                const newQuantity = equipment.quantity + item.quantity;
                console.log(`📊 Updating quantity: ${equipment.quantity} + ${item.quantity} = ${newQuantity}`);

                const { error: updateError } = await this.supabase
                    .from('equipment')
                    .update({ 
                        quantity: newQuantity,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id);

                if (updateError) {
                    console.error(`❌ Update error for equipment ${item.id}:`, updateError);
                    throw updateError;
                }

                console.log(`✅ Successfully increased quantity for ${equipment.name}: ${equipment.quantity} → ${newQuantity}`);
                
                results.push({
                    equipment_id: item.id,
                    equipment_name: equipment.name,
                    old_quantity: equipment.quantity,
                    new_quantity: newQuantity,
                    change: +item.quantity,
                    success: true
                });

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

    // ✅ ENHANCED: buildEquipmentListFromBooking dengan debugging
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

    // ✅ NEW: Debug function untuk investigasi equipment
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
}

export default EquipmentQuantityManager;