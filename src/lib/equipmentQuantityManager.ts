class EquipmentQuantityManager {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  // SIMPLE BORROW: Tambah ke active_borrows, update currently_borrowed
  async borrowEquipment(equipmentId: string, userId: string, quantity: number, refType: string, refId: string) {
    try {
      // Check current availability
      const { data: equipment, error: eqError } = await this.supabase
        .from('equipment')
        .select('quantity, currently_borrowed')
        .eq('id', equipmentId)
        .single();

      if (eqError) throw eqError;

      const available = equipment.quantity - equipment.currently_borrowed;
      if (quantity > available) {
        throw new Error(`Only ${available} available, requested ${quantity}`);
      }

      // Add to active_borrows
      const { error: borrowError } = await this.supabase
        .from('active_borrows')
        .insert({
          equipment_id: equipmentId,
          user_id: userId,
          quantity,
          reference_type: refType,
          reference_id: refId
        });

      if (borrowError) throw borrowError;

      // Update currently_borrowed
      const { error: updateError } = await this.supabase
        .from('equipment')
        .update({ 
          currently_borrowed: equipment.currently_borrowed + quantity,
          is_available: (available - quantity) > 0
        })
        .eq('id', equipmentId);

      if (updateError) throw updateError;

      console.log(`✅ Borrowed ${quantity} of equipment ${equipmentId}`);
    } catch (error) {
      console.error('Error borrowing equipment:', error);
      throw error;
    }
  }

  // SIMPLE RETURN: Remove dari active_borrows, update currently_borrowed
  async returnEquipment(equipmentId: string, userId: string, quantity: number, refType: string, refId: string) {
    try {
      // Find active borrow
      const { data: borrow, error: borrowError } = await this.supabase
        .from('active_borrows')
        .select('*')
        .eq('equipment_id', equipmentId)
        .eq('user_id', userId)
        .eq('reference_type', refType)
        .eq('reference_id', refId)
        .eq('status', 'active')
        .maybeSingle();

      if (borrowError) throw borrowError;
      if (!borrow) {
        console.warn(`No active borrow found for equipment ${equipmentId}`);
        return; // Don't throw error, just return
      }

      // Update or delete borrow record
      if (quantity >= borrow.quantity) {
        await this.supabase.from('active_borrows').delete().eq('id', borrow.id);
      } else {
        await this.supabase
          .from('active_borrows')
          .update({ quantity: borrow.quantity - quantity })
          .eq('id', borrow.id);
      }

      // Update equipment
      const { data: equipment } = await this.supabase
        .from('equipment')
        .select('quantity, currently_borrowed')
        .eq('id', equipmentId)
        .single();

      await this.supabase
        .from('equipment')
        .update({ 
          currently_borrowed: Math.max(0, equipment.currently_borrowed - quantity),
          is_available: true
        })
        .eq('id', equipmentId);

      console.log(`✅ Returned ${quantity} of equipment ${equipmentId}`);
    } catch (error) {
      console.error('Error returning equipment:', error);
      throw error;
    }
  }

  // LEGACY SUPPORT: Keep old updateQuantity method for existing code
  async updateQuantity(changes: Array<any>) {
    for (const change of changes) {
      if (change.transaction_type === 'return' && change.change_amount > 0) {
        // This is a return operation from validation queue
        // We'll implement a simple version that just updates the equipment quantity
        const { data: equipment } = await this.supabase
          .from('equipment')
          .select('quantity')
          .eq('id', change.equipment_id)
          .single();

        const newQuantity = equipment.quantity + change.change_amount;

        await this.supabase
          .from('equipment')
          .update({ 
            quantity: newQuantity,
            is_available: newQuantity > 0
          })
          .eq('id', change.equipment_id);

        console.log(`✅ Updated equipment ${change.equipment_id} quantity: +${change.change_amount}`);
      }
    }
  }
}

export default EquipmentQuantityManager;