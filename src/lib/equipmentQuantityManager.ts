interface EquipmentQuantityChange {
  equipment_id: string;
  change_amount: number; // positive for return, negative for borrow
  transaction_type: 'borrow' | 'return' | 'restore';
  reference_id: string;
  reference_type: 'booking' | 'lending';
}

class EquipmentQuantityManager {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  async getCurrentQuantity(equipmentId: string): Promise<{ current: number, original: number }> {
    const { data: equipment, error } = await this.supabase
      .from('equipment')
      .select('quantity, original_quantity')
      .eq('id', equipmentId)
      .single();

    if (error) throw error;
    
    // Set original_quantity if not exists
    if (equipment.original_quantity === null || equipment.original_quantity === undefined) {
      await this.supabase
        .from('equipment')
        .update({ original_quantity: equipment.quantity })
        .eq('id', equipmentId);
      
      return {
        current: equipment.quantity,
        original: equipment.quantity
      };
    }

    return {
      current: equipment.quantity,
      original: equipment.original_quantity
    };
  }

  async updateQuantity(changes: EquipmentQuantityChange[]): Promise<void> {
    for (const change of changes) {
      const { current, original } = await this.getCurrentQuantity(change.equipment_id);
      
      let newQuantity = current + change.change_amount;

      // CRITICAL: Enforce boundaries
      if (change.transaction_type === 'borrow') {
        if (change.change_amount > 0) {
          throw new Error(`Borrow amount must be negative, got: ${change.change_amount}`);
        }
        newQuantity = Math.max(0, current + change.change_amount);
        
        if (newQuantity < 0) {
          throw new Error(`Cannot borrow more than available. Available: ${current}, Requested: ${Math.abs(change.change_amount)}`);
        }
      } else if (change.transaction_type === 'return') {
        if (change.change_amount < 0) {
          throw new Error(`Return amount must be positive, got: ${change.change_amount}`);
        }
        newQuantity = Math.min(original, current + change.change_amount);
        
        if (newQuantity > original) {
          console.warn(`Return would exceed original. Capping at ${original}`);
          newQuantity = original;
        }
      } else if (change.transaction_type === 'restore') {
        newQuantity = Math.min(original, Math.max(0, current + change.change_amount));
      }

      await this.supabase
        .from('equipment')
        .update({ 
          quantity: newQuantity,
          is_available: newQuantity > 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', change.equipment_id);

      // Log the change for audit trail
      try {
        await this.supabase
          .from('equipment_quantity_logs')
          .insert({
            equipment_id: change.equipment_id,
            from_quantity: current,
            to_quantity: newQuantity,
            change_amount: change.change_amount,
            transaction_type: change.transaction_type,
            reference_id: change.reference_id,
            reference_type: change.reference_type,
            created_at: new Date().toISOString()
          });
      } catch (logError) {
        console.warn('Failed to log quantity change:', logError);
        // Don't fail the main operation if logging fails
      }
    }
  }

  async validateBorrowRequest(equipmentList: Array<{id: string, quantity: number}>): Promise<{ isValid: boolean, errors: string[] }> {
    const errors: string[] = [];

    for (const item of equipmentList) {
      const { current } = await this.getCurrentQuantity(item.id);
      
      if (item.quantity <= 0) {
        errors.push(`Invalid quantity for equipment ${item.id}: ${item.quantity}`);
      }
      
      if (item.quantity > current) {
        errors.push(`Insufficient quantity for equipment ${item.id}. Available: ${current}, Requested: ${item.quantity}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async processBorrowing(equipmentList: Array<{id: string, quantity: number}>, referenceId: string, referenceType: 'booking' | 'lending'): Promise<void> {
    const changes: EquipmentQuantityChange[] = equipmentList.map(item => ({
      equipment_id: item.id,
      change_amount: -item.quantity, // Negative for borrowing
      transaction_type: 'borrow',
      reference_id: referenceId,
      reference_type: referenceType
    }));

    await this.updateQuantity(changes);
  }

  async processReturn(equipmentList: Array<{id: string, quantity: number}>, referenceId: string, referenceType: 'booking' | 'lending'): Promise<void> {
    const changes: EquipmentQuantityChange[] = equipmentList.map(item => ({
      equipment_id: item.id,
      change_amount: item.quantity, // Positive for returning
      transaction_type: 'return',
      reference_id: referenceId,
      reference_type: referenceType
    }));

    await this.updateQuantity(changes);
  }

  async processRestore(equipmentList: Array<{id: string, quantity: number}>, referenceId: string, referenceType: 'booking' | 'lending'): Promise<void> {
    const changes: EquipmentQuantityChange[] = equipmentList.map(item => ({
      equipment_id: item.id,
      change_amount: item.quantity,
      transaction_type: 'restore',
      reference_id: referenceId,
      reference_type: referenceType
    }));

    await this.updateQuantity(changes);
  }
}

export default EquipmentQuantityManager;