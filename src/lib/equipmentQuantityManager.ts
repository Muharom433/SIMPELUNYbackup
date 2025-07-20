// ✅ ENHANCED EquipmentQuantityManager dengan manual quantity updates

class EquipmentQuantityManager {
    private supabase: any;

    constructor(supabaseClient: any) {
        this.supabase = supabaseClient;
    }

    // ✅ CORE: Manual increase quantity (return items)
    async increaseQuantity(equipmentId: string, quantity: number, reason?: string): Promise<void> {
        if (quantity <= 0) {
            console.warn('⚠️ EquipmentQuantityManager: Invalid quantity', { equipmentId, quantity });
            return;
        }

        try {
            console.log('📈 EquipmentQuantityManager: INCREASING quantity', {
                equipmentId,
                quantity,
                reason: reason || 'No reason provided'
            });

            // Get current equipment data
            const { data: currentEquipment, error: fetchError } = await this.supabase
                .from('equipment')
                .select('id, name, code, quantity, currently_borrowed')
                .eq('id', equipmentId)
                .single();

            if (fetchError) throw fetchError;
            if (!currentEquipment) throw new Error(`Equipment ${equipmentId} not found`);

            console.log('📊 Current state BEFORE increase:', {
                name: currentEquipment.name,
                code: currentEquipment.code,
                total_quantity: currentEquipment.quantity,
                currently_borrowed: currentEquipment.currently_borrowed || 0,
                available: currentEquipment.quantity - (currentEquipment.currently_borrowed || 0)
            });

            // ✅ DECREASE currently_borrowed (increases available)
            const newCurrentlyBorrowed = Math.max(0, (currentEquipment.currently_borrowed || 0) - quantity);

            const { error: updateError } = await this.supabase
                .from('equipment')
                .update({
                    currently_borrowed: newCurrentlyBorrowed,
                    updated_at: new Date().toISOString()
                })
                .eq('id', equipmentId);

            if (updateError) throw updateError;

            console.log('✅ Successfully INCREASED available quantity:', {
                equipmentId,
                name: currentEquipment.name,
                code: currentEquipment.code,
                change: `+${quantity}`,
                old_currently_borrowed: currentEquipment.currently_borrowed || 0,
                new_currently_borrowed: newCurrentlyBorrowed,
                old_available: currentEquipment.quantity - (currentEquipment.currently_borrowed || 0),
                new_available: currentEquipment.quantity - newCurrentlyBorrowed,
                reason
            });

        } catch (error) {
            console.error('❌ Error increasing quantity:', {
                equipmentId,
                quantity,
                reason,
                error
            });
            throw error;
        }
    }

    // ✅ CORE: Manual decrease quantity (borrow items)
    async decreaseQuantity(equipmentId: string, quantity: number, reason?: string): Promise<void> {
        if (quantity <= 0) {
            console.warn('⚠️ EquipmentQuantityManager: Invalid quantity', { equipmentId, quantity });
            return;
        }

        try {
            console.log('📉 EquipmentQuantityManager: DECREASING quantity', {
                equipmentId,
                quantity,
                reason: reason || 'No reason provided'
            });

            // Get current equipment data
            const { data: currentEquipment, error: fetchError } = await this.supabase
                .from('equipment')
                .select('id, name, code, quantity, currently_borrowed')
                .eq('id', equipmentId)
                .single();

            if (fetchError) throw fetchError;
            if (!currentEquipment) throw new Error(`Equipment ${equipmentId} not found`);

            console.log('📊 Current state BEFORE decrease:', {
                name: currentEquipment.name,
                code: currentEquipment.code,
                total_quantity: currentEquipment.quantity,
                currently_borrowed: currentEquipment.currently_borrowed || 0,
                available: currentEquipment.quantity - (currentEquipment.currently_borrowed || 0)
            });

            // ✅ VALIDATION: Check availability
            const currentlyBorrowed = currentEquipment.currently_borrowed || 0;
            const availableQuantity = currentEquipment.quantity - currentlyBorrowed;
            
            if (availableQuantity < quantity) {
                const errorMsg = `Insufficient quantity for ${currentEquipment.name} (${currentEquipment.code}). Available: ${availableQuantity}, Requested: ${quantity}`;
                console.error('❌ Insufficient quantity:', {
                    equipmentId,
                    name: currentEquipment.name,
                    code: currentEquipment.code,
                    total: currentEquipment.quantity,
                    currently_borrowed: currentlyBorrowed,
                    available: availableQuantity,
                    requested: quantity
                });
                throw new Error(errorMsg);
            }

            // ✅ INCREASE currently_borrowed (decreases available)
            const newCurrentlyBorrowed = currentlyBorrowed + quantity;

            const { error: updateError } = await this.supabase
                .from('equipment')
                .update({
                    currently_borrowed: newCurrentlyBorrowed,
                    updated_at: new Date().toISOString()
                })
                .eq('id', equipmentId);

            if (updateError) throw updateError;

            console.log('✅ Successfully DECREASED available quantity:', {
                equipmentId,
                name: currentEquipment.name,
                code: currentEquipment.code,
                change: `-${quantity}`,
                old_currently_borrowed: currentlyBorrowed,
                new_currently_borrowed: newCurrentlyBorrowed,
                old_available: availableQuantity,
                new_available: currentEquipment.quantity - newCurrentlyBorrowed,
                reason
            });

        } catch (error) {
            console.error('❌ Error decreasing quantity:', {
                equipmentId,
                quantity,
                reason,
                error
            });
            throw error;
        }
    }

    // ✅ BULK: Process multiple equipment (for bookings)
    async bulkIncreaseQuantity(equipmentList: Array<{id: string, quantity: number}>, reason?: string): Promise<void> {
        console.log('📈 EquipmentQuantityManager: BULK INCREASE started', {
            equipmentCount: equipmentList.length,
            totalQuantity: equipmentList.reduce((sum, item) => sum + item.quantity, 0),
            equipmentList,
            reason
        });

        for (const item of equipmentList) {
            await this.increaseQuantity(item.id, item.quantity, `${reason} (bulk operation)`);
        }

        console.log('✅ EquipmentQuantityManager: BULK INCREASE completed');
    }

    async bulkDecreaseQuantity(equipmentList: Array<{id: string, quantity: number}>, reason?: string): Promise<void> {
        console.log('📉 EquipmentQuantityManager: BULK DECREASE started', {
            equipmentCount: equipmentList.length,
            totalQuantity: equipmentList.reduce((sum, item) => sum + item.quantity, 0),
            equipmentList,
            reason
        });

        // ✅ First validate ALL equipment quantities
        const validation = await this.validateQuantityAvailable(equipmentList);
        if (!validation.isValid) {
            throw new Error(`Bulk validation failed: ${validation.errors.join(', ')}`);
        }

        // ✅ Then process all equipment
        for (const item of equipmentList) {
            await this.decreaseQuantity(item.id, item.quantity, `${reason} (bulk operation)`);
        }

        console.log('✅ EquipmentQuantityManager: BULK DECREASE completed');
    }

    // ✅ VALIDATION: Check if quantities are available
    async validateQuantityAvailable(equipmentList: Array<{id: string, quantity: number}>): Promise<{isValid: boolean, errors: string[]}> {
        console.log('🔍 Validating equipment quantities:', equipmentList);
        
        const errors: string[] = [];
        
        for (const item of equipmentList) {
            try {
                const { data: equipment } = await this.supabase
                    .from('equipment')
                    .select('id, name, code, quantity, currently_borrowed')
                    .eq('id', item.id)
                    .single();

                if (!equipment) {
                    errors.push(`Equipment ${item.id} not found`);
                    continue;
                }

                const available = equipment.quantity - (equipment.currently_borrowed || 0);
                if (available < item.quantity) {
                    errors.push(`${equipment.name} (${equipment.code}): Available ${available}, Requested ${item.quantity}`);
                }
            } catch (error) {
                errors.push(`Error checking ${item.id}: ${error}`);
            }
        }

        const result = {
            isValid: errors.length === 0,
            errors
        };

        console.log('🔍 Validation result:', result);
        return result;
    }

    // ✅ UTILITY: Build equipment list from booking data
    static buildEquipmentListFromBooking(booking: any): Array<{id: string, quantity: number}> {
        const equipmentList: Array<{id: string, quantity: number}> = [];
        
        if (booking.equipment_requested && booking.equipment_requested.length > 0) {
            for (let i = 0; i < booking.equipment_requested.length; i++) {
                const equipmentId = booking.equipment_requested[i];
                const quantity = booking.equipment_quantities && booking.equipment_quantities[i] 
                    ? booking.equipment_quantities[i] 
                    : 1;
                
                equipmentList.push({ id: equipmentId, quantity });
            }
        }

        console.log('🔧 Built equipment list from booking:', {
            bookingId: booking.id,
            equipmentList,
            equipment_requested: booking.equipment_requested,
            equipment_quantities: booking.equipment_quantities
        });

        return equipmentList;
    }

    // ✅ UTILITY: Build equipment list from lending data
    static buildEquipmentListFromLending(lending: any): Array<{id: string, quantity: number}> {
        const equipmentList: Array<{id: string, quantity: number}> = [];
        
        if (lending.id_equipment && lending.id_equipment.length > 0) {
            for (let i = 0; i < lending.id_equipment.length; i++) {
                const equipmentId = lending.id_equipment[i];
                const quantity = lending.qty && lending.qty[i] 
                    ? lending.qty[i] 
                    : 1;
                
                equipmentList.push({ id: equipmentId, quantity });
            }
        }

        console.log('🔧 Built equipment list from lending:', {
            lendingId: lending.id,
            equipmentList,
            id_equipment: lending.id_equipment,
            qty: lending.qty
        });

        return equipmentList;
    }

    // ✅ DEBUG: Get equipment current state
    async getEquipmentState(equipmentId: string): Promise<any> {
        try {
            const { data: equipment, error } = await this.supabase
                .from('equipment')
                .select('id, name, code, quantity, currently_borrowed, updated_at')
                .eq('id', equipmentId)
                .single();

            if (error) throw error;

            const state = {
                ...equipment,
                available: equipment.quantity - (equipment.currently_borrowed || 0)
            };

            console.log('📊 Equipment state:', state);
            return state;
        } catch (error) {
            console.error('❌ Error getting equipment state:', error);
            return null;
        }
    }
}

export default EquipmentQuantityManager;