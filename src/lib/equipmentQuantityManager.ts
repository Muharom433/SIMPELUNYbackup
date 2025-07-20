// ✅ Enhanced EquipmentQuantityManager with better logging and validation

class EquipmentQuantityManager {
    private supabase: any;

    constructor(supabaseClient: any) {
        this.supabase = supabaseClient;
    }

    // ✅ FIXED: Add comprehensive logging
    async increaseQuantity(equipmentId: string, quantity: number, reason?: string): Promise<void> {
        if (quantity <= 0) {
            console.warn('⚠️ EquipmentQuantityManager: Attempted to increase by non-positive quantity', { equipmentId, quantity });
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
                .select('id, name, quantity, currently_borrowed')
                .eq('id', equipmentId)
                .single();

            if (fetchError) throw fetchError;
            if (!currentEquipment) throw new Error(`Equipment ${equipmentId} not found`);

            console.log('📊 Current equipment state BEFORE increase:', {
                name: currentEquipment.name,
                total_quantity: currentEquipment.quantity,
                currently_borrowed: currentEquipment.currently_borrowed || 0,
                available: currentEquipment.quantity - (currentEquipment.currently_borrowed || 0)
            });

            // ✅ CRITICAL: Decrease currently_borrowed (which increases available quantity)
            const newCurrentlyBorrowed = Math.max(0, (currentEquipment.currently_borrowed || 0) - quantity);

            const { error: updateError } = await this.supabase
                .from('equipment')
                .update({
                    currently_borrowed: newCurrentlyBorrowed,
                    updated_at: new Date().toISOString()
                })
                .eq('id', equipmentId);

            if (updateError) throw updateError;

            console.log('✅ EquipmentQuantityManager: Successfully INCREASED quantity', {
                equipmentId,
                name: currentEquipment.name,
                change: +quantity,
                old_currently_borrowed: currentEquipment.currently_borrowed || 0,
                new_currently_borrowed: newCurrentlyBorrowed,
                old_available: currentEquipment.quantity - (currentEquipment.currently_borrowed || 0),
                new_available: currentEquipment.quantity - newCurrentlyBorrowed,
                reason
            });

        } catch (error) {
            console.error('❌ EquipmentQuantityManager: Error increasing quantity', {
                equipmentId,
                quantity,
                reason,
                error
            });
            throw error;
        }
    }

    // ✅ FIXED: Add comprehensive logging
    async decreaseQuantity(equipmentId: string, quantity: number, reason?: string): Promise<void> {
        if (quantity <= 0) {
            console.warn('⚠️ EquipmentQuantityManager: Attempted to decrease by non-positive quantity', { equipmentId, quantity });
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
                .select('id, name, quantity, currently_borrowed')
                .eq('id', equipmentId)
                .single();

            if (fetchError) throw fetchError;
            if (!currentEquipment) throw new Error(`Equipment ${equipmentId} not found`);

            console.log('📊 Current equipment state BEFORE decrease:', {
                name: currentEquipment.name,
                total_quantity: currentEquipment.quantity,
                currently_borrowed: currentEquipment.currently_borrowed || 0,
                available: currentEquipment.quantity - (currentEquipment.currently_borrowed || 0)
            });

            // ✅ VALIDATION: Check if enough quantity available
            const currentlyBorrowed = currentEquipment.currently_borrowed || 0;
            const availableQuantity = currentEquipment.quantity - currentlyBorrowed;
            
            if (availableQuantity < quantity) {
                const errorMsg = `Insufficient quantity for ${currentEquipment.name}. Available: ${availableQuantity}, Requested: ${quantity}`;
                console.error('❌ EquipmentQuantityManager: Insufficient quantity', {
                    equipmentId,
                    name: currentEquipment.name,
                    total: currentEquipment.quantity,
                    currently_borrowed: currentlyBorrowed,
                    available: availableQuantity,
                    requested: quantity
                });
                throw new Error(errorMsg);
            }

            // ✅ CRITICAL: Increase currently_borrowed (which decreases available quantity)
            const newCurrentlyBorrowed = currentlyBorrowed + quantity;

            const { error: updateError } = await this.supabase
                .from('equipment')
                .update({
                    currently_borrowed: newCurrentlyBorrowed,
                    updated_at: new Date().toISOString()
                })
                .eq('id', equipmentId);

            if (updateError) throw updateError;

            console.log('✅ EquipmentQuantityManager: Successfully DECREASED quantity', {
                equipmentId,
                name: currentEquipment.name,
                change: -quantity,
                old_currently_borrowed: currentlyBorrowed,
                new_currently_borrowed: newCurrentlyBorrowed,
                old_available: availableQuantity,
                new_available: currentEquipment.quantity - newCurrentlyBorrowed,
                reason
            });

        } catch (error) {
            console.error('❌ EquipmentQuantityManager: Error decreasing quantity', {
                equipmentId,
                quantity,
                reason,
                error
            });
            throw error;
        }
    }

    // ✅ FIXED: Bulk operations with proper logging
    async bulkIncreaseQuantity(equipmentList: Array<{id: string, quantity: number}>, reason?: string): Promise<void> {
        console.log('📈 EquipmentQuantityManager: BULK INCREASE started', {
            equipmentCount: equipmentList.length,
            totalQuantity: equipmentList.reduce((sum, item) => sum + item.quantity, 0),
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
            reason
        });

        for (const item of equipmentList) {
            await this.decreaseQuantity(item.id, item.quantity, `${reason} (bulk operation)`);
        }

        console.log('✅ EquipmentQuantityManager: BULK DECREASE completed');
    }

    // ✅ NEW: Validation method
    async validateQuantityAvailable(equipmentList: Array<{id: string, quantity: number}>): Promise<{isValid: boolean, errors: string[]}> {
        const errors: string[] = [];
        
        for (const item of equipmentList) {
            try {
                const { data: equipment } = await this.supabase
                    .from('equipment')
                    .select('id, name, quantity, currently_borrowed')
                    .eq('id', item.id)
                    .single();

                if (!equipment) {
                    errors.push(`Equipment ${item.id} not found`);
                    continue;
                }

                const available = equipment.quantity - (equipment.currently_borrowed || 0);
                if (available < item.quantity) {
                    errors.push(`${equipment.name}: Available ${available}, Requested ${item.quantity}`);
                }
            } catch (error) {
                errors.push(`Error checking ${item.id}: ${error}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

export default EquipmentQuantityManager;