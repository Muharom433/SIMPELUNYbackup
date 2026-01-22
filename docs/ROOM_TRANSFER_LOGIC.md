# Logika Perpindahan Ruangan (Room Transfer)

## Overview
Ketika booking dengan status `borrowed` mengalami perubahan ruangan, sistem akan otomatis membuat checkout untuk tracking perpindahan equipment dan memastikan validasi yang benar.

## Alur Proses

### 1. Deteksi Perpindahan Ruangan
- **Kondisi**: Status booking = `borrowed` DAN `room_id` berubah
- **Trigger**: Update booking melalui BookingManagement

### 2. Pemisahan Equipment
Equipment dipisahkan menjadi 2 kategori:
- **Mandatory Equipment**: Equipment wajib yang terikat dengan ruangan
- **Optional Equipment**: Equipment opsional yang dipilih user

### 3. Pembuatan Checkout Otomatis

Sistem membuat record di tabel `checkouts` dengan karakteristik:

```javascript
{
  user_id: <user_id>,
  booking_id: <booking_id>,
  room_id: <RUANGAN_LAMA>, // ⭐ Penting: Ini adalah ruangan LAMA
  status: 'returned',
  type: 'room',
  is_room_transfer: true, // ⭐ Flag khusus perpindahan ruangan
  checkout_notes: 'AUTO-CHECKOUT: Perpindahan ruangan...'
}
```

### 4. Penanganan Equipment Mandatory LAMA

**Equipment mandatory dari ruangan lama:**
- ✅ Masuk ke tabel `checkout_items`
- ✅ Akan divalidasi di **Validation Queue**
- ✅ Stock akan dikembalikan saat admin memvalidasi di Validation Queue
- ❌ TIDAK ada di `bookings.equipment_requested` lagi

**Contoh:**
```javascript
// Data masuk ke checkout_items
[
  {
    checkout_id: '<checkout_id>',
    equipment_id: '<equipment_id>',
    quantity: 2,
    condition_notes: 'Equipment mandatory dari ruangan lama (room_id_123)'
  }
]
```

### 5. Penanganan Equipment Mandatory BARU

**Equipment mandatory dari ruangan baru:**
- ✅ Stock langsung dikurangi
- ✅ TIDAK masuk `bookings.equipment_requested` (karena akan masuk checkout_items saat return nanti)
- ℹ️ Dicek apakah sudah ada di equipment lama (untuk menghindari duplikasi pengurangan stock)

### 6. Penanganan Equipment Optional

**Equipment optional (lama maupun baru):**
- ✅ TETAP di `bookings.equipment_requested`
- ✅ Stock adjustment dilakukan langsung (borrow/return)
- ℹ️ Tidak masuk checkout_items karena bukan mandatory

**Logika:**
- Jika quantity berkurang → Return stock
- Jika quantity bertambah → Borrow stock
- Jika equipment baru ditambah → Borrow stock

### 7. Update Bookings Table

Setelah semua proses, tabel `bookings` diupdate dengan:
```javascript
{
  room_id: <RUANGAN_BARU>, // ⭐ Room_id sudah berubah ke ruangan baru
  equipment_requested: [<optional_equipment_ids>], // ⭐ HANYA optional
  equipment_quantities: [<optional_quantities>], // ⭐ HANYA optional
  status: 'borrowed' // Status tetap borrowed
}
```

## Diagram Alur

```
┌─────────────────────────────────────────────────────┐
│  Booking Status: BORROWED                           │
│  Room Change: Room A → Room B                       │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Equipment Categorization                           │
│  ┌──────────────┐        ┌──────────────┐          │
│  │ Mandatory    │        │ Optional     │          │
│  │ - Projector  │        │ - HDMI Cable │          │
│  │ - AC Remote  │        │ - Laptop     │          │
│  └──────────────┘        └──────────────┘          │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Create Checkout Record                             │
│  - room_id: Room A (OLD)                            │
│  - is_room_transfer: true                           │
│  - status: 'returned'                               │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  checkout_items                                     │
│  - Mandatory equipment OLD ONLY                     │
│  - Projector (qty: 1)                               │
│  - AC Remote (qty: 1)                               │
│  └─→ Wait for Validation Queue                     │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Stock Adjustment                                   │
│  - Borrow NEW mandatory equipment from Room B       │
│  - Adjust optional equipment (borrow/return)        │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Update Bookings Table                              │
│  - room_id: Room B (NEW)                            │
│  - equipment_requested: [optional_ids]              │
│  - status: borrowed (unchanged)                     │
└─────────────────────────────────────────────────────┘
```

## Validation Queue Role

### Tugas Validation Queue:
1. ✅ Menerima checkout dengan `is_room_transfer = true`
2. ✅ Menampilkan equipment mandatory dari ruangan lama
3. ✅ Admin memvalidasi return equipment
4. ✅ **Mengembalikan stock** equipment mandatory lama ke inventory
5. ✅ Mengubah status checkout menjadi 'completed'

### Penting:
⚠️ **Stock equipment TIDAK otomatis kembali** saat perpindahan ruangan
⚠️ Stock baru kembali setelah **admin memvalidasi di Validation Queue**
⚠️ Ini mencegah kehilangan track equipment dan memastikan accountability

## Database Schema Changes

### Migration: `20260119_add_room_transfer_flag.sql`

**Kolom baru:**
- `checkouts.is_room_transfer` (boolean, default: false)

**Purpose:**
- Membedakan checkout biasa dengan checkout perpindahan ruangan
- Membantu filtering di Validation Queue
- Audit trail untuk perpindahan ruangan

## Key Points

### ✅ DO's:
1. Selalu create checkout saat perpindahan ruangan pada status borrowed
2. Simpan room_id LAMA di checkout.room_id
3. Masukkan HANYA mandatory equipment ke checkout_items
4. Biarkan optional equipment di bookings.equipment_requested
5. Set is_room_transfer = true untuk checkout perpindahan

### ❌ DON'Ts:
1. Jangan return stock mandatory lama secara otomatis
2. Jangan masukkan optional equipment ke checkout_items
3. Jangan ubah status booking saat perpindahan ruangan
4. Jangan simpan room_id BARU di checkout (harus yang lama)

## Example Scenario

**Initial State:**
- Booking: Room A (borrowed)
- Equipment: 
  - Mandatory: Projector (1), AC Remote (1)
  - Optional: HDMI Cable (2)

**User Changes to Room B:**

**Result:**
1. **Checkout Created:**
   - room_id: Room A
   - is_room_transfer: true
   - checkout_items: [Projector (1), AC Remote (1)]

2. **Stock Adjusted:**
   - Borrowed from Room B: Projector (1), AC Remote (1)
   - Optional remains: HDMI Cable (2)

3. **Bookings Updated:**
   - room_id: Room B
   - equipment_requested: [HDMI Cable]
   - equipment_quantities: [2]
   - status: borrowed

4. **Waiting Validation:**
   - Admin validates in Validation Queue
   - Stock of Projector & AC Remote from Room A returned
   - Checkout status → completed

## Testing Checklist

- [ ] Perpindahan ruangan pada status borrowed creates checkout
- [ ] room_id di checkout adalah ruangan LAMA
- [ ] is_room_transfer flag set to true
- [ ] Mandatory equipment masuk checkout_items
- [ ] Optional equipment tetap di equipment_requested
- [ ] Stock mandatory baru langsung dikurangi
- [ ] Validation Queue menampilkan transfer checkout
- [ ] Admin dapat memvalidasi dan return stock
