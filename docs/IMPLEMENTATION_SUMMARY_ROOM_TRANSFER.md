# Summary: Implementasi Perpindahan Ruangan Otomatis

## Tanggal: 19 Januari 2026

## Perubahan yang Dilakukan

### 1. Database Migration
**File:** `supabase/migrations/20260119_add_room_transfer_flag.sql`

**Perubahan:**
- Menambahkan kolom `is_room_transfer` (boolean) ke tabel `checkouts`
- Default value: `false`
- Index untuk performa query

**Purpose:**
Flag ini menandai checkout yang dibuat otomatis karena perpindahan ruangan, membedakannya dari checkout biasa.

---

### 2. Update Logika BookingManagement
**File:** `src/pages/BookingManagement.tsx`

**Fungsi yang dimodifikasi:** `handleUpdateBooking()`

#### Logika Baru:

**A. Deteksi Perpindahan Ruangan**
```typescript
if (roomChanged && originalStatus === 'borrowed')
```

**B. Pemisahan Equipment**
- **Mandatory**: Equipment wajib yang terikat ruangan
- **Optional**: Equipment opsional pilihan user

**C. Pembuatan Checkout Otomatis**
```typescript
{
  room_id: originalRoomId,        // ⭐ RUANGAN LAMA
  is_room_transfer: true,         // ⭐ FLAG PERPINDAHAN
  status: 'returned',
  type: 'room'
}
```

**D. Penanganan Equipment**

**Mandatory Equipment LAMA:**
- ✅ Masuk `checkout_items` 
- ✅ Menunggu validasi di Validation Queue
- ✅ Stock dikembalikan saat admin validasi
- ❌ TIDAK di `bookings.equipment_requested`

**Mandatory Equipment BARU:**
- ✅ Stock langsung dikurangi
- ❌ TIDAK di `bookings.equipment_requested`

**Optional Equipment:**
- ✅ TETAP di `bookings.equipment_requested`
- ✅ Stock adjustment langsung (borrow/return)

---

### 3. Dokumentasi
**File:** `docs/ROOM_TRANSFER_LOGIC.md`

**Konten:**
- Penjelasan lengkap logika perpindahan ruangan
- Diagram alur proses
- Role Validation Queue
- Checklist testing
- Do's and Don'ts

---

## Alur Kerja yang Baru

### Skenario: User memindahkan booking dari Room A ke Room B (status: borrowed)

**Step 1: User Update Booking**
- User mengubah room_id dari Room A ke Room B
- Status tetap `borrowed`

**Step 2: Sistem Create Checkout Otomatis**
```sql
INSERT INTO checkouts (
  user_id,
  booking_id,
  room_id,              -- Room A (LAMA)
  is_room_transfer,     -- true
  status,               -- 'returned'
  type                  -- 'room'
)
```

**Step 3: Sistem Insert Checkout Items**
```sql
INSERT INTO checkout_items (
  checkout_id,
  equipment_id,         -- HANYA mandatory equipment
  quantity
)
```

**Step 4: Sistem Adjust Stock**
- Borrow mandatory equipment baru dari Room B
- Adjust optional equipment

**Step 5: Sistem Update Bookings**
```sql
UPDATE bookings SET
  room_id = 'Room B',                    -- BARU
  equipment_requested = [optional_ids],   -- HANYA optional
  equipment_quantities = [quantities]
WHERE id = booking_id
```

**Step 6: Validation Queue**
- Admin melihat checkout dengan flag `is_room_transfer = true`
- Admin validasi return equipment mandatory lama
- **Stock Room A dikembalikan**
- Status checkout → `completed`

---

## Impact pada Fitur Lain

### Validation Queue
**Perlu Update:**
- [ ] Tampilkan badge khusus untuk room transfer
- [ ] Filter berdasarkan `is_room_transfer`
- [ ] Validasi harus return stock ke inventory

### Booking Management
**Sudah Updated:**
- ✅ Create checkout otomatis saat room change
- ✅ Handling equipment mandatory vs optional
- ✅ Success message informatif

### Reports
**Tidak Terpengaruh:**
- Stock reports akan tetap akurat karena:
  - Mandatory lama: menunggu validasi (belum return stock)
  - Mandatory baru: sudah dikurangi
  - Optional: langsung adjusted

---

## Database Schema Impact

### Tabel: `checkouts`
```
+ is_room_transfer BOOLEAN DEFAULT false
```

### Tabel: `checkout_items`
**Tidak ada perubahan struktur**
- Tetap: equipment_id, quantity, condition_notes

### Tabel: `bookings`
**Tidak ada perubahan struktur**
- equipment_requested: Sekarang HANYA berisi optional equipment (saat room transfer)

---

## Testing Checklist

### Unit Testing
- [ ] Room transfer creates checkout with correct data
- [ ] `is_room_transfer` flag set to true
- [ ] `room_id` in checkout is OLD room
- [ ] Mandatory equipment moves to checkout_items
- [ ] Optional equipment stays in bookings
- [ ] Stock adjustment works correctly

### Integration Testing
- [ ] Validation Queue displays transfer checkouts
- [ ] Admin can validate and return stock
- [ ] Stock reports accurate after transfer
- [ ] Booking status remains `borrowed`

### User Acceptance Testing
- [ ] User can change room on borrowed booking
- [ ] System shows appropriate success message
- [ ] Equipment list updates correctly
- [ ] Admin receives checkout notification

---

## Migration Steps

### Development
```bash
# Migration sudah dibuat di:
supabase/migrations/20260119_add_room_transfer_flag.sql

# Akan otomatis apply saat:
# 1. Supabase CLI: supabase db push
# 2. Supabase Dashboard: Manual migration upload
# 3. CI/CD: Auto deploy
```

### Production
1. Backup database
2. Apply migration
3. Verify column added
4. Test room transfer feature
5. Monitor Validation Queue

---

## Rollback Plan

Jika ada masalah:

```sql
-- Remove column
ALTER TABLE checkouts DROP COLUMN IF EXISTS is_room_transfer;

-- Remove index
DROP INDEX IF EXISTS idx_checkouts_is_room_transfer;
```

Revert code:
```bash
git revert <commit_hash>
```

---

## Key Points untuk Developer

### ✅ CRITICAL:
1. **room_id di checkout HARUS ruangan LAMA**
2. **Mandatory equipment HARUS masuk checkout_items**
3. **Optional equipment TETAP di bookings**
4. **Stock TIDAK auto-return, tunggu validasi**

### ⚠️ WARNINGS:
1. Jangan langsung return stock mandatory lama
2. Jangan masukkan optional ke checkout_items
3. Jangan ubah status booking
4. Jangan skip validasi queue

---

## Next Steps

1. **Update Validation Queue UI** (Priority: HIGH)
   - Add badge untuk room transfer
   - Show old room → new room info
   - Highlight mandatory equipment

2. **Add Notification** (Priority: MEDIUM)
   - Notify admin saat room transfer
   - Email/in-app notification

3. **Analytics Dashboard** (Priority: LOW)
   - Track room transfer frequency
   - Equipment movement reports

---

## Support & Questions

Untuk pertanyaan atau issue, hubungi:
- Developer Team
- Reference: `ROOM_TRANSFER_LOGIC.md`
- Jira Ticket: [Link]

---

**Status:** ✅ Implemented & Ready for Testing
**Version:** 1.0.0
**Last Updated:** 19 Januari 2026
