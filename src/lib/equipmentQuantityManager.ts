class EquipmentQuantityManager {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  // ✅ SIMPLE: Langsung kurangi quantity saat approved
  async decreaseQuantity(equipmentId: string, amount: number, reason: string = '') {
    try {
      console.log(`📉 DECREASE: Equipment ${equipmentId} by ${amount} (${reason})`);
      
      // Get current quantity
      const { data: equipment, error: getError } = await this.supabase
        .from('equipment')
        .select('quantity, name')
        .eq('id', equipmentId)
        .single();

      if (getError) throw getError;

      const currentQuantity = equipment.quantity || 0;
      const newQuantity = Math.max(0, currentQuantity - amount);

      console.log(`📊 ${equipment.name}: ${currentQuantity} → ${newQuantity} (-${amount})`);

      // Update quantity directly
      const { error: updateError } = await this.supabase
        .from('equipment')
        .update({ 
          quantity: newQuantity,
          is_available: newQuantity > 0
        })
        .eq('id', equipmentId);

      if (updateError) throw updateError;

      console.log(`✅ SUCCESS: Equipment ${equipmentId} quantity decreased`);
      
    } catch (error) {
      console.error('❌ Error decreasing quantity:', error);
      throw error;
    }
  }

  // ✅ SIMPLE: Langsung tambah quantity saat return
  async increaseQuantity(equipmentId: string, amount: number, reason: string = '') {
    try {
      console.log(`📈 INCREASE: Equipment ${equipmentId} by ${amount} (${reason})`);
      
      // Get current quantity
      const { data: equipment, error: getError } = await this.supabase
        .from('equipment')
        .select('quantity, name')
        .eq('id', equipmentId)
        .single();

      if (getError) throw getError;

      const currentQuantity = equipment.quantity || 0;
      const newQuantity = currentQuantity + amount;

      console.log(`📊 ${equipment.name}: ${currentQuantity} → ${newQuantity} (+${amount})`);

      // Update quantity directly
      const { error: updateError } = await this.supabase
        .from('equipment')
        .update({ 
          quantity: newQuantity,
          is_available: true
        })
        .eq('id', equipmentId);

      if (updateError) throw updateError;

      console.log(`✅ SUCCESS: Equipment ${equipmentId} quantity increased`);
      
    } catch (error) {
      console.error('❌ Error increasing quantity:', error);
      throw error;
    }
  }

  // ✅ BULK: Process multiple equipment at once
  async bulkDecreaseQuantity(equipmentList: Array<{id: string, quantity: number}>, reason: string = '') {
    console.log(`📉 BULK DECREASE: ${equipmentList.length} items (${reason})`);
    
    for (const item of equipmentList) {
      try {
        await this.decreaseQuantity(item.id, item.quantity, reason);
      } catch (error) {
        console.error(`❌ Failed to decrease ${item.id}:`, error);
        // Continue with other items
      }
    }
  }

  async bulkIncreaseQuantity(equipmentList: Array<{id: string, quantity: number}>, reason: string = '') {
    console.log(`📈 BULK INCREASE: ${equipmentList.length} items (${reason})`);
    
    for (const item of equipmentList) {
      try {
        await this.increaseQuantity(item.id, item.quantity, reason);
      } catch (error) {
        console.error(`❌ Failed to increase ${item.id}:`, error);
        // Continue with other items
      }
    }
  }

  // ✅ VALIDATION: Check if enough quantity available
  async validateQuantityAvailable(equipmentList: Array<{id: string, quantity: number}>) {
    try {
      const errors: string[] = [];
      
      for (const item of equipmentList) {
        const { data: equipment, error } = await this.supabase
          .from('equipment')
          .select('id, name, quantity')
          .eq('id', item.id)
          .single();

        if (error || !equipment) {
          errors.push(`Equipment ${item.id} not found`);
          continue;
        }

        if (item.quantity > equipment.quantity) {
          errors.push(`${equipment.name}: Only ${equipment.quantity} available, requested ${item.quantity}`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error('Error validating quantity:', error);
      return {
        isValid: false,
        errors: ['Validation failed']
      };
    }
  }

  // ✅ LEGACY SUPPORT: Keep old updateQuantity method for ValidationQueue
  async updateQuantity(changes: Array<any>) {
    console.log('⚠️ LEGACY updateQuantity called:', changes);
    
    for (const change of changes) {
      if (change.transaction_type === 'return' && change.change_amount > 0) {
        console.log(`🔄 Processing return via legacy method: ${change.equipment_id} +${change.change_amount}`);
        
        try {
          await this.increaseQuantity(
            change.equipment_id,
            change.change_amount,
            'Validation Queue Return'
          );
        } catch (error) {
          console.error(`❌ Error processing legacy return for ${change.equipment_id}:`, error);
        }
      } else if (change.transaction_type === 'borrow' && change.change_amount > 0) {
        console.log(`🔄 Processing borrow via legacy method: ${change.equipment_id} -${change.change_amount}`);
        
        try {
          await this.decreaseQuantity(
            change.equipment_id,
            change.change_amount,
            'Validation Queue Borrow'
          );
        } catch (error) {
          console.error(`❌ Error processing legacy borrow for ${change.equipment_id}:`, error);
        }
      }
    }
  }

  // ✅ HELPER: Get current equipment status
  async getEquipmentStatus(equipmentId: string) {
    try {
      const { data: equipment, error } = await this.supabase
        .from('equipment')
        .select('id, name, quantity, original_quantity')
        .eq('id', equipmentId)
        .single();

      if (error) throw error;

      const originalQty = equipment.original_quantity || equipment.quantity;
      const currentQty = equipment.quantity || 0;
      const missing = Math.max(0, originalQty - currentQty);

      return {
        id: equipment.id,
        name: equipment.name,
        current_quantity: currentQty,
        original_quantity: originalQty,
        missing: missing,
        status: currentQty > 0 ? 'available' : 'out_of_stock'
      };
    } catch (error) {
      console.error('Error getting equipment status:', error);
      throw error;
    }
  }
}

export default EquipmentQuantityManager;