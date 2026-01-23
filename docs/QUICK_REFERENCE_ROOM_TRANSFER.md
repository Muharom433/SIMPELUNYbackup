# 🚀 Quick Reference: Room Transfer Feature

## 📋 TL;DR

Ketika booking dengan status **borrowed** pindah ruangan:
1. ✅ Create **checkout** (room_id = ruangan LAMA, is_room_transfer = true)
2. ✅ Equipment **mandatory** → masuk **checkout_items**
3. ✅ Equipment **optional** → tetap di **bookings.equipment_requested**
4. ✅ Admin validasi di **Validation Queue** → stock kembali

---

## 🔑 Key Database Fields

### `checkouts` table
```typescript
{
  room_id: string,           // ⭐ OLD ROOM (bukan new room!)
  is_room_transfer: boolean, // ⭐ true untuk perpindahan
  status: 'returned',
  type: 'room'
}
```

### `checkout_items` table
```typescript
{
  checkout_id: string,
  equipment_id: string,      // ⭐ HANYA mandatory equipment
  quantity: number
}
```

### `bookings` table (after transfer)
```typescript
{
  room_id: string,                  // ⭐ NEW ROOM
  equipment_requested: string[],    // ⭐ HANYA optional equipment
  equipment_quantities: number[],
  status: 'borrowed'                // unchanged
}
```

---

## 🎯 Logic Flow (Simplified)

```javascript
// 1. Detect transfer
if (roomChanged && status === 'borrowed') {
  
  // 2. Split equipment
  const mandatoryOld = oldEquipment.filter(e => e.is_mandatory);
  const optionalOld = oldEquipment.filter(e => !e.is_mandatory);
  const mandatoryNew = newEquipment.filter(e => e.is_mandatory);
  const optionalNew = newEquipment.filter(e => !e.is_mandatory);
  
  // 3. Create checkout for OLD mandatory
  await createCheckout({
    room_id: oldRoomId,           // ⭐ OLD!
    is_room_transfer: true,
    items: mandatoryOld           // ⭐ ONLY mandatory!
  });
  
  // 4. Borrow NEW mandatory
  await borrowEquipment(mandatoryNew);
  
  // 5. Adjust optional
  await adjustOptional(optionalOld, optionalNew);
  
  // 6. Update booking
  await updateBooking({
    room_id: newRoomId,           // ⭐ NEW!
    equipment_requested: optionalNew  // ⭐ ONLY optional!
  });
}
```

---

## 📊 Equipment Flow Chart

```
┌─────────────┐
│  EQUIPMENT  │
└──────┬──────┘
       │
       ├─────────────────────────────────────────┐
       │                                         │
       ▼                                         ▼
┌──────────────┐                        ┌──────────────┐
│  MANDATORY   │                        │   OPTIONAL   │
└──────┬───────┘                        └──────┬───────┘
       │                                        │
       │                                        │
   ┌───┴───┐                                ┌───┴───┐
   │       │                                │       │
   ▼       ▼                                ▼       ▼
┌──────┐ ┌──────┐                      ┌──────┐ ┌──────┐
│ OLD  │ │ NEW  │                      │ OLD  │ │ NEW  │
└───┬──┘ └──┬───┘                      └───┬──┘ └──┬───┘
    │       │                              │       │
    ▼       ▼                              ▼       ▼
┌────────┐ ┌──────────┐              ┌─────────────────┐
│checkout│ │borrow new│              │  stay in        │
│_items  │ │stock     │              │  bookings       │
└────────┘ └──────────┘              │  + adjust stock │
    │                                └─────────────────┘
    │ (wait validation)
    ▼
┌──────────┐
│return old│
│stock     │
└──────────┘
```

---

## 🎨 Visual Summary

### BEFORE Transfer
```
Booking:
├─ room_id: Room A
├─ status: borrowed
└─ equipment: [mandatory1, mandatory2, optional1, optional2]

Stock Room A: (borrowed)
Stock Room B: (available)
```

### AFTER Transfer
```
Booking:
├─ room_id: Room B ⭐
├─ status: borrowed
└─ equipment: [optional1, optional2] ⭐ (only optional!)

Checkout:
├─ room_id: Room A ⭐ (old room)
├─ is_room_transfer: true ⭐
└─ items: [mandatory1, mandatory2] ⭐ (only mandatory!)

Stock Room A: (waiting validation to return)
Stock Room B: (borrowed)
```

### AFTER Validation
```
Booking: (unchanged)

Checkout:
└─ status: completed ✅

Stock Room A: (returned) ✅
Stock Room B: (still borrowed)
```

---

## ⚠️ Common Mistakes to Avoid

### ❌ DON'T
```javascript
// DON'T save new room in checkout
checkout.room_id = newRoomId;  // WRONG!

// DON'T include optional in checkout_items
checkout_items.push(optionalEquipment);  // WRONG!

// DON'T auto-return stock
await returnStock(oldMandatory);  // WRONG! Wait for validation

// DON'T change booking status
booking.status = 'returned';  // WRONG! Keep it 'borrowed'
```

### ✅ DO
```javascript
// DO save old room in checkout
checkout.room_id = oldRoomId;  // CORRECT!

// DO include only mandatory in checkout_items
checkout_items.push(...mandatoryEquipment);  // CORRECT!

// DO wait for validation queue
// Stock returns after admin validates

// DO keep booking status
booking.status = 'borrowed';  // CORRECT!
```

---

## 🧪 Quick Test Scenarios

### Scenario 1: Simple Transfer
```
Given: Booking in Room A (borrowed) with 2 mandatory, 1 optional
When: User changes to Room B
Then:
  ✓ Checkout created with room_id = Room A
  ✓ 2 mandatory items in checkout_items
  ✓ 1 optional stays in booking
  ✓ Booking.room_id = Room B
```

### Scenario 2: No Mandatory
```
Given: Booking in Room A (borrowed) with 0 mandatory, 3 optional
When: User changes to Room B
Then:
  ✓ NO checkout created
  ✓ 3 optional stays in booking
  ✓ Booking.room_id = Room B
```

### Scenario 3: After Validation
```
Given: Checkout with 2 mandatory from Room A
When: Admin validates in Validation Queue
Then:
  ✓ Room A stock increases by 2
  ✓ Checkout status = completed
  ✓ Booking unchanged
```

---

## 🔍 Debug Checklist

When debugging room transfer:

- [ ] Check `checkouts.room_id` is OLD room (not new)
- [ ] Check `checkouts.is_room_transfer` is true
- [ ] Check `checkout_items` has ONLY mandatory equipment
- [ ] Check `bookings.room_id` is NEW room
- [ ] Check `bookings.equipment_requested` has ONLY optional
- [ ] Check stock of old room NOT auto-returned
- [ ] Check stock of new room is borrowed

---

## 📞 Quick Help

**Problem:** Stock not returning after transfer
**Solution:** Check Validation Queue - admin must validate first

**Problem:** Equipment duplicated in booking
**Solution:** Mandatory should NOT be in bookings after transfer

**Problem:** Wrong room_id in checkout
**Solution:** Checkout should have OLD room, not new

**Problem:** Optional equipment missing
**Solution:** Optional should stay in bookings.equipment_requested

---

## 📚 Full Documentation

For detailed docs, see:
- `ROOM_TRANSFER_LOGIC.md` - Complete logic explanation
- `ROOM_TRANSFER_FLOW_DIAGRAM.txt` - Visual flow
- `IMPLEMENTATION_SUMMARY_ROOM_TRANSFER.md` - Implementation details

---

**Last Updated:** 19 Jan 2026
**Version:** 1.0.0
