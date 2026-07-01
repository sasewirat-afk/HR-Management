# Changelog

All notable changes to **CROCHET HR Management System** will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.4.22] — 2026-07-01

**ลากิจ Editable Per Employee — Revert v1.4.14 hard-lock**

### Changed
- **ลากิจปรับ override ได้รายบุคคลอีกครั้ง**
- Default ยังคง 3 วัน (ตามกฎหมาย)
- Admin เข้าหน้า "ปรับสิทธิ์ลา" → ช่องลากิจไม่ถูกล็อคอีกต่อไป → กรอกค่าใหม่ได้เลย
- ถ้าปล่อยว่าง = ใช้ค่า default จาก settings (3 วัน)

### Code Changes
```js
// getLeaveBalance — accept override again
let personalQuota = ov.personal ?? settings.leaveQuotas.personal;

// UI types — remove disabled/locked flags for personal
{ k: 'personal', label: 'ลากิจ', unit: 'วัน/ปี', def: defaults.personal },

// Save handler — include personal in override keys
const types = ['personal','vacation','sick','maternity','ordination'];
```

### Use Case
- พนักงานที่มีสัญญาพิเศษ (เช่น 5 วันลากิจ ตามข้อตกลง)
- Admin ปรับเฉพาะรายคนที่ตกลงกันไว้เกิน default
- อื่นๆ ยังคง 3 วัน ตามกฎหมาย

### Backward Compat
- พนักงานเก่าที่ v1.4.14 strip override → ยังคง 3 วัน (default) ✓
- ถ้า Admin ต้องการปรับ → เข้าหน้า "ปรับสิทธิ์ลา" กรอกค่าใหม่
- Migration ก่อนหน้าไม่ต้องเปลี่ยน

---

## [1.4.21] — 2026-07-01

**P0 Fix — Cross-Device Password Sync Race**

### Root Cause (Debug Mantra Verified — H1 Confirmed)
Password change บน Desktop A → หายไปหลังจาก Desktop B (fresh browser) เปิดครั้งแรก
เกิดจาก **migration race** — Desktop B's first-run migration writes stale employees array back to cloud, overwriting Desktop A's password change

**Timeline (bug trigger):**
```
t=0.0  Desktop B opens → pullCloud (has old pw=1234)
t=0.2  Desktop A changes pw → local save → cloud upsert async
t=0.4  Desktop B migration runs → save employees WITH pw=1234
t=0.5  Desktop A upsert done → cloud=102542
t=0.6  Desktop B upsert done → cloud=1234 (OVERWRITE)  ✗
t=0.7  Realtime → Desktop A local reverted to 1234
```

### Fix — 2 Defense Layers

**Layer 1: Migration Idempotency Guard**
- ใช้ `settings._migrationsRun` array เป็น cloud-synced flag
- Migration รันครั้งแรกเท่านั้น → mark done → ครั้งต่อไป skip
```js
if (s._migrationsRun?.includes('v1.4.20-exempt')) return;
// ... do migration ...
s._migrationsRun = [...(s._migrationsRun || []), 'v1.4.20-exempt'];
```

**Layer 2: Fresh Pull Before Password Change**
- Password change handler = `async` → force cloud pull ก่อนอ่าน employees
- Ensures write on top of latest cloud state, preserves concurrent updates
```js
document.getElementById('changePassForm').addEventListener('submit', async e => {
  await DB.cloudPullAllSafe();     // ← fresh sync
  const emps = DB.load('employees'); // now has latest
  emp.password = p1;
  DB.save('employees', emps);
});
```

### UX Changes
- Change password ช้าลง 1-2 วิ (แสดง "กำลังซิงค์ข้อมูลล่าสุดจาก cloud...")
- ถ้า pull ล้มเหลว → บล็อกการเปลี่ยนรหัส + แจ้งเตือน
- Guard: ถ้าไม่พบ user ใน employees array → toast error (edge case)

### Testing Approach
```
Reproduce (before fix):
1. Clear localStorage on Desktop B
2. Desktop A logged in with old pw
3. Change password on A + immediately load Desktop B → race triggered
   → Desktop B pushes stale data → password change lost

After fix:
- Migration idempotent → won't push if already done
- Password change waits for fresh cloud → no race even with pending updates
```

### Impact
- ✅ Cross-device password change ไม่หายอีก
- ✅ Migration ไม่ race กับ concurrent updates
- ✅ Backward compat: existing users get flag on next visit
- ⚠ Change password ช้าลง ~1-2 วิ (acceptable trade-off)

### Future Improvements (Not in v1.4.21)
- Layer 3 (P2): Field-level Postgres RPC updates instead of full-array REPLACE
- General sync engine refactor for all critical writes (leaves, shifts, etc.)

---

## [1.4.20] — 2026-06-30

**Per-user Toggles — Attendance Delegation + Exempt Tracking**

### Added — Toggle "ละเว้นการพิจารณาเวลาเข้า-ออก"
- Field ใหม่: `employee.exemptFromAttendance` (default: false)
- พนักงานที่ toggle ON:
 - **ไม่ต้องสแกน** ในระบบ Tigersoft
 - **ไม่ขึ้นในรายงานเข้างาน** (tab "ไม่มา" จะไม่แสดง)
 - **ไม่นับใน stat "จากพนักงาน X คน"**
- Use case: CEO, คนสวน, แม่บ้าน, พนักงานพิเศษ ที่ไม่ต้องผูกกับ time clock

### Migration `migrateAttendanceExempt_v1_4_20()`
Auto-set 3 IDs = true (idempotent):
- `390101001` — CEO
- `670101003` — คนสวน
- `680111001` — แม่บ้าน

Admin สามารถปรับเพิ่ม/ลด ผ่านหน้าแก้ไขพนักงานได้ทีหลัง

### Effect on v1.4.19 fix
```js
// v1.4.19: derive absent from active employees master
const activeEmps = DB.load('employees').filter(e =>
  e.active && e.role !== 'admin' && !e.exemptFromAttendance   // ← + v1.4.20
);
```
Chain: `active` + `not admin` + `not exempt` → ที่เหลือคือคนต้องสแกน

---

**Per-user Toggle — Attendance Upload/Report Delegation**

### Added
- **Toggle "อัปโหลดเวลาเข้างานได้"** (per employee) — Admin เปิดให้ non-admin user ใช้เมนู "อัปโหลดเวลาเข้างาน" ได้
- **Toggle "ดูรายงานเข้างานได้"** (per employee) — Admin เปิดให้ non-admin user ใช้เมนู "รายงานเข้างาน" ได้
- อยู่ในหน้า "แก้ไขพนักงาน" ใต้ section "🔐 สิทธิ์พิเศษ (Attendance Module)"

### Data Model
```js
employee.canUploadAttendance:   boolean (default: false)
employee.canViewAttendanceReport: boolean (default: false)
```
Backward compat: undefined = false = ไม่เปลี่ยนพฤติกรรมเดิม

### Navigation Changes
```js
// Menu แสดงในกลุ่มใหม่ "Attendance (สิทธิ์พิเศษ)" สำหรับ non-admin ที่ได้ toggle
if (role !== 'admin' && (canUploadAtt || canViewAttReport)) {
  html += 'Attendance (สิทธิ์พิเศษ)';
  if (canUploadAtt) html += 'อัปโหลดเวลาเข้างาน';
  if (canViewAttReport) html += 'รายงานเข้างาน';
}
```
Admin section ยังคงเมนูเดิมอยู่ — ไม่มี regression

### Defense-in-depth Guards
1. **Menu visibility** — navLink แสดงต่อเมื่อ toggle ON
2. **Render function guard** — `renderUploadAttendance/renderAttendanceReport` เช็คสิทธิ์ก่อน render
3. **Action guard** — `confirmUploadAttendance()` re-check สิทธิ์ก่อน save
4. **Audit log** — ทุกการ upload บันทึกเป็น `attendance-upload` event พร้อม role ของผู้กระทำ

### Permission Denied UI
```html
🔒 คุณไม่มีสิทธิ์เข้าถึงเมนูนี้
ให้ Admin เปิด "..." ในหน้าแก้ไขพนักงาน
```

### Use Case
- Admin ต้องการมอบหมายงาน "อัปโหลด attendance" ให้ HR Officer หรือ Manager
- Admin ต้องการให้ Manager เห็นรายงาน attendance ระบบทั้งหมด (ไม่แค่ทีม)
- ไม่ต้องยกระดับ role → ยกเป็น Admin — ปลอดภัยกว่า

### Scope Note
เมื่อได้ toggle "canViewAttendanceReport" → เห็น **all employees' attendance** (เหมือน Admin)
- ต่างจากเมนู "รายงานทีม" (v1.4.17) ที่ scope by team
- Admin ตัดสินใจตามความไว้ใจ

---

## [1.4.19] — 2026-06-30

**P1 Fix — Attendance Report: Absent Detection**

### Fixed
**Symptom:**
- ระบบมีพนักงาน 101 คน (active)
- ไฟล์ Tigersoft มี 80 records (present)
- Tab "ไม่มา" แสดง **0** — ผิด (ควรเป็น 20+ คน)

**Root cause:**
```js
// เดิม
const absent = uniqueDayRecords.filter(r => !r.checkIn); // ← จากไฟล์
```
Tigersoft's export = **present only** — ไม่ export row ของคนที่ไม่สแกน  
→ `uniqueDayRecords` มี 80 rows ทั้งหมด checkIn ≠ null  
→ `absent.length === 0` เสมอ

### Fix
**Derive absent จาก employee master แทน:**
```js
// v1.4.19
const activeEmps = DB.load('employees').filter(e => e.active && e.role !== 'admin');
const presentIds = new Set(present.map(r => r.employeeCode || r.employeeId));
const autoAbsentIds = new Set(autoAbsent.map(r => r.employeeCode || r.employeeId));
const leaveIds = new Set(leaveOnDate.map(r => r.employeeId));
const trackedInFile = new Set(uniqueDayRecords.map(r => r.employeeCode || r.employeeId));

const inferredAbsent = activeEmps
  .filter(e => !presentIds.has(e.id) && !autoAbsentIds.has(e.id) &&
               !leaveIds.has(e.id) && !trackedInFile.has(e.id))
  .map(e => ({
    date: _attReportDate,
    employeeCode: e.id,
    employeeName: `${e.firstName} ${e.lastName}`,
    checkIn: null, checkOut: null,
    _inferredAbsent: true
  }));

const absent = [
  ...explicitAbsent,    // rows in file with checkIn = null (rare)
  ...inferredAbsent,    // employees NOT in file at all
  ...autoAbsent.map(...) // scanned but too late = auto-absent
];
```

### Rules (Absent Detection Waterfall)
```
สำหรับพนักงาน active คนใดคนหนึ่งในวันนั้น:
1. อยู่ในไฟล์ + มี checkIn ก่อน cutoff  → PRESENT
2. อยู่ในไฟล์ + มี checkIn หลัง cutoff  → AUTO-ABSENT (สาย > threshold)
3. อยู่ในไฟล์ + ไม่มี checkIn         → EXPLICIT ABSENT
4. มี leave request อนุมัติ           → LEAVE
5. ไม่อยู่ใน 1-4                     → INFERRED ABSENT (ใหม่!)
```

### UI Changes
- Tab "ไม่มา (N)" — count ที่ถูกต้อง
- Stat card "มาทำงาน" — เปลี่ยนจาก "จากทั้งหมด X คน" → "**จากพนักงาน 101 คน**"
- Row ในตาราง "ไม่มา" มี badge แยก:
  - "ขาดอัตโนมัติ (สแกน HH:MM)" — สายเกิน
  - "ไม่ได้สแกน" — มี row แต่ checkIn ว่าง
  - "ไม่มาทำงาน (ไม่พบใน Tigersoft)" — **ใหม่**

### Excluded from Absent Check
- `role === 'admin'` — Admin ไม่นับ (ไม่ต้องสแกน)
- `active === false` — inactive employees

### Console Diagnostic
```
[AttReport 2026-07-01] active=100, present=80, autoAbsent=0, leave=1, absent=19 (explicit=0, inferred=19)
```

---

## [1.4.18] — 2026-06-30

**P0 CRITICAL — Shift Import Semantic Change: REPLACE → MERGE**

### Root Cause (Confirmed by Console Diagnostic)
- Before Admin's import: cloud มี 837 shifts, 27 employees ใน July (Manager's data ครบ)
- Admin ลบบาง row ออกจาก Excel template (rows ที่ไม่ต้องการ update)
- Import → wipe ทั้ง 837 shifts → re-add เฉพาะ rows ที่อยู่ใน Excel
- ผล: rows ที่ Admin ลบออก = ไม่ถูก re-add = ข้อมูลหาย

**Semantic mismatch:**
- User mental model: "ลบ row = ไม่อยากแก้ → คงเดิม"
- System model (เดิม): "ลบ row = ไม่อยู่ใน scope → wipe ไม่ re-add"

### Fix (Complete Rewrite of Import Logic)

**เปลี่ยน semantic จาก REPLACE → MERGE/PATCH**

| Cell Value | Semantic |
|---|---|
| ว่าง หรือ `-` | **PRESERVE** — ไม่แตะ DB |
| `W` / `M` / `A` / `N` / `O` | **UPSERT** — เพิ่ม หรือ อัพเดทเป็นค่าใหม่ |
| `BLANK` / `X` / `DEL` / `EMPTY` / `CLEAR` | **DELETE** — ลบ shift นั้น (explicit) |
| `L` / `C` | SKIP — auto-derived from leave |
| Row ไม่อยู่ใน Excel | พนักงานทั้งคนไม่ถูกแตะ |

### Diff Preview ใหม่ (ก่อนกด Import)
```
📋 สรุปการเปลี่ยนแปลง (เดือน 2026-07)

✓ 42 กะ ใหม่ (จะถูกเพิ่ม)
~ 18 กะ (จะถูกอัพเดทเป็นค่าใหม่)
✗ 3 กะ (จะถูกลบ — มี BLANK/X/DEL ใน Excel)

🛡 PRESERVE:
   · 217 กะ ของ 24 พนักงานที่ไม่อยู่ใน Excel
   · 145 ช่องว่างใน Excel (ไม่แตะข้อมูลเดิม)

ขอบเขต: Admin (ทุกพนักงาน)
Semantic: MERGE — ช่องว่างใน Excel = "คงเดิม"
เคลียร์ต้องใส่ "-" ไม่ใช่ลบ row · ลบเด็ดขาดใส่ "BLANK"

ยืนยัน Import?
```

### Console Diagnostic
```
[Import v1.4.18 MERGE] Before: 837 shifts in 2026-07
[Import v1.4.18 MERGE] Plan: +42 new, ~18 updated, -3 deleted
[Import v1.4.18 MERGE] Preserved: 217 shifts (24 employees not in Excel) + 145 empty cells
[Import v1.4.18 MERGE] After: 856 shifts, 27 employees
```

### Post-save Audit
```js
if (lostEmps.length > 0) {
  toast(`⚠ ตรวจพบ ${lostEmps.length} พนักงานหายไป — โปรดเช็คทันที`, 'error');
}
```

### Breaking Change — UX Notice
**Manager / Admin ที่เคยใช้ Excel เพื่อ "ล้าง" shifts ของลูกน้อง:**
- เดิม: clear cell ใน Excel + import = shift ถูกลบ
- ใหม่: clear cell = **คงเดิม** (preserve)
- ต้องการลบจริง → ใส่ `BLANK` หรือ `X` หรือ `DEL` ใน cell นั้น

ป้องกัน accidental wipe — ปลอดภัยกว่ามาก

### Tested Scenarios
- ✅ Admin ลบ 80 row ออกจาก Excel → import → Manager's 217 shifts ยังอยู่
- ✅ Admin export → fill ใหม่หมด → import → ทุก cell ถูก upsert
- ✅ Admin ใส่ "X" ใน 5 cells → import → ลบ 5 shifts
- ✅ Manager import เหมือนเดิม — ทีมอื่นไม่ถูกแตะ

---

## [1.4.17] — 2026-06-30

**รายงานทีม สำหรับ Role Manager + เพิ่ม Tab สะสมวันหยุด**

### Added — Manager Reports
- **เมนูใหม่:** "รายงานทีม" สำหรับ Role Manager (อยู่ใต้ "ตารางลงกะงาน")
- ใช้ tab structure เดียวกับ Admin's รายงาน แต่ **filter ข้อมูลเฉพาะลูกน้องในทีม**
- หัวรายงานแสดง **alert banner** บอกขอบเขต: "ขอบเขต: ลูกน้องในทีมของคุณ N คน"

### Added — Tab "สะสมวันหยุด" ใหม่
- **สรุปรายคน**: ได้รับ / ใช้แล้ว / **คงเหลือ** (เขียว) / หมดอายุ (แดง)
- **รายละเอียดคำขอ**: วันที่ขอ, พนักงาน, วันที่ทำงาน, เหตุผล, สถานะ
- Export CSV ได้
- Admin ก็เห็น tab นี้ด้วย — มีในทุก role ที่เข้าถึงรายงาน

### Scoped Filters (Manager → team only)
| Tab | Filter Logic |
|---|---|
| สรุปสิทธิ์การลา | employees ที่ managerId === me.id |
| รายละเอียดการลา | leaveRequests ที่ employeeId อยู่ในทีม |
| OT | otRequests ที่ employeeId อยู่ในทีม |
| สะสมวันหยุด | compOffRequests + accumulatedHolidays ในทีม |
| งานนอกสถานที่ | fieldWorkRequests อนุมัติแล้วในทีม |
| รับรองเวลา | timeCertRequests ในทีม |
| มาสายสะสม | attendance ของพนักงานในทีม (matched ทั้ง employeeId / employeeCode) |

### Implementation
```js
function _reportScopeEmpIds() {
  const emps = DB.load('employees');
  if (currentUser.role === 'admin') return new Set(emps.map(e => e.id));
  return new Set(emps.filter(e => e.managerId === currentUser.id).map(e => e.id));
}
// Used in each tab: r => scopeIds.has(r.employeeId)
```

### Use Case
Manager ใช้เพื่อ:
- เตรียมข้อมูลก่อนคุย one-on-one
- อบรม / coach ลูกน้องในเรื่องการลา/มาสาย/OT
- ติดตามคนที่มี outlier (มาสายเยอะ / OT เยอะผิดปกติ)

---

## [1.4.16] — 2026-06-30

**Mobile Responsive Follow-up — Tabs & Two-card Grids**

### Fixed (P1 — Mobile, 2 ตัว)

**Bug A: Tabs pill ยื่นเกิน viewport บน portrait**
- Root: `.tabs { width: fit-content }` ทำให้ pill กว้างตามเนื้อหา
- ผล: tab สุดท้ายถูกตัด (เช่น "รับรองเวลา") เลื่อนไม่ได้
- Fix: force `width: 100% !important` + `overflow-x: auto` ใน @media

**Bug B: 2-card grid (ลางาน & OT page) ตัวที่ 2 ถูกตัด**
- Root: inline `style="grid-template-columns:1fr 1fr"` — CSS file override ไม่ได้
- Fix: attribute selector `[style*="grid-template-columns:1fr 1fr"]` + `!important` → collapse to 1 column on mobile

```css
@media (max-width: 768px) {
  .tabs {
    width: 100% !important;
    overflow-x: auto;
  }
  [style*="grid-template-columns:1fr 1fr"],
  [style*="grid-template-columns: 1fr 1fr"] {
    grid-template-columns: 1fr !important;
  }
}
```

### Effect
- ✅ ทุก tab เข้าถึงได้ในทุกหน้า (Approval Center, Reports, Settings ฯลฯ)
- ✅ หน้า "ลางาน & OT" — 2 card stack เป็น 1 column บน mobile
- ✅ ทุกหน้าที่ใช้ 2-col inline grid → collapse อัตโนมัติ
- ✅ Scrollbar ของ tabs บางลง (4px) สวยงาม

---

## [1.4.15] — 2026-06-30

**Mobile Responsive — Scrollable Tables + Sticky Action Column**

### Fixed (P1 — Mobile Critical)
**Bug:** ปุ่มอนุมัติ/ปฏิเสธ (และ column ขวาสุดของทุกตาราง) บน Portrait mobile ถูก **clip มองไม่เห็น เลื่อนไม่ได้**

**Root cause:**
- `.card { overflow: hidden; }` (จำเป็นเพื่อ rounded corners)
- ไม่มี `overflow-x: auto` ใน `.card-body`
- ตารางมี 7+ columns → กว้างกว่า viewport portrait (~375px)
- Cell สุดท้ายมีปุ่ม → ยื่นออกนอก card → ถูก clip

### Fix (CSS-only, @media max-width:768px)
```css
.card { overflow: visible; }              /* allow children to overflow */
.card-body {
  overflow-x: auto;                       /* enable horizontal scroll */
  -webkit-overflow-scrolling: touch;      /* smooth iOS scrolling */
}
.card-body table {
  width: max-content;                     /* natural table width */
  min-width: 100%;
}
.card-body th, .card-body td {
  padding: 10px 12px;
  white-space: nowrap;                    /* prevent collapsed cells */
}
/* Sticky action column — visible without scrolling */
.card-body table td:last-child,
.card-body table th:last-child {
  position: sticky;
  right: 0;
  background: white;
  box-shadow: -4px 0 6px rgba(30,58,138,0.05);
  z-index: 2;
}
/* Tabs row also scrolls horizontally if too many */
.tabs { overflow-x: auto; flex-wrap: nowrap; }
```

### Bonus — Small phone (≤480px)
- Smaller table padding (8px) + 12px font
- Smaller h1 (18px)
- `btn-sm` 12px font

### Effect
- ✅ ปุ่มอนุมัติ/ปฏิเสธ visible ทุกครั้ง (sticky right)
- ✅ Swipe ตารางซ้าย-ขวาดู column อื่นๆ ได้
- ✅ Tabs scroll horizontally — ทุก tab เข้าถึงได้
- ✅ Modal full-screen-friendly (95vh)
- ✅ Stats grid 2 columns บน mobile

### Scope
ใช้ครอบคลุมทุกหน้าที่ใช้ pattern `.card > .card-body > table`:
- ศูนย์อนุมัติ (ลา/OT/สะสมหยุด/งานนอก/รับรองเวลา)
- รายงาน (สรุปสิทธิ์ลา/รายละเอียดลา/OT/มาสายสะสม ฯลฯ)
- จัดการพนักงาน
- ลางาน & OT
- คลังเครื่องเขียน

### Tested viewports
- Portrait iPhone (375px) ✓
- Portrait Galaxy (412px) ✓
- Landscape phone (812px) ✓ (already working before)
- Tablet (768px) ✓
- Desktop (>768px) — no change

---

## [1.4.14] — 2026-06-30

**Hard Reset ลากิจ = 3 (สิทธิ์ตามกฎหมาย)**

### Changed
- **ลากิจ = 3 วัน เสมอ ทุกคน — ไม่มีข้อยกเว้น**
- ไม่ pro-rate ตามเดือนที่เข้างาน
- ไม่รับ per-employee override
- ไม่ดู status ทดลองงาน (ทั้งทดลอง + ผ่านทดลอง = 3 เท่ากัน)
- เป็นสิทธิ์ขั้นต่ำตาม **กฎหมายแรงงาน พ.ร.บ.คุ้มครองแรงงาน**

### Fixed (Migration)
- **`migrateLeaveQuota_v1_4_14()`** — รันอัตโนมัติตอน startup
- Force `settings.leaveQuotas.personal = 3`
- Force `settings.probationPersonalCap = 3`
- **Strip** `leaveQuotaOverride.personal` ของพนักงานทุกคน (ที่เคยมี override เช่น 1.8, 2.0)
- Idempotent — ใช้ `_settingsVersion === '1.4.14'` กันรันซ้ำ

### UI Updated
- หน้า "ปรับสิทธิ์ลา (Admin)" → ช่องลากิจ:
 - 🔒 ล็อค ใส่ค่าไม่ได้
 - แสดง: "ล็อค — สิทธิ์ตามกฎหมาย ทุกคนเท่ากัน"
- ลาประเภทอื่น (พักร้อน/ป่วย/คลอด/บวช) — Admin ยัง override ได้ตามปกติ

### Impact
หลัง deploy v1.4.14:
- เดชา สมจิตต์ (Modern Trade): 1.8 → **3** ✓
- สุพิชชา วีระเกียรติ (Project): 2 → **3** ✓
- พนักงานใหม่อื่นๆ ที่ pro-rate ไว้ — auto-reset to 3

---

## [1.4.13] — 2026-06-30

**P0 Hotfix — Shift Import Stale-Local Race**

### Fixed
**Bug:** ถึงแม้ v1.4.12 จะ scope wipe ที่ team ของ importer แล้ว Manager B import → ทีมของ Manager A หาย

**Root cause (NEW finding):**
- v1.4.12 filter ทำงานบน **localStorage state** ของ Manager B
- ถ้า Manager B's local **ไม่ทันได้ sync** ของ Manager A (ที่เพิ่ง import ก่อนหน้า) → local ไม่มี A's data → filter "preserve" ของ A ไม่ได้ เพราะไม่มีอะไรให้ preserve
- Save = team B only → push to cloud → cloud's A data ถูกทับด้วยเลย

**Mantra Trace:**
- Step 1 (Reproduce): cloud data confirms — Mgr 690615001 imported July first, then Mgr 690302002 wiped it
- Step 2 (Trace): code filter operates on local, not cloud
- Step 3 (Falsify): tried hypothesis "filter bug" — but filter is correct on full data
- Step 4 (Breadcrumbs): cloud has team 690615001 in June, team 690302002 in July → consistent with "B's import was based on stale local missing A's July"

### Fix (Multi-layer)
1. **Force-pull cloud BEFORE filter/save**
 ```js
 const pullResult = await DB.cloudPullAllSafe();
 if (!pullResult.ok) {
   if (!confirm('Cloud pull failed — continuing may overwrite other teams. Proceed?')) return;
 }
 ```
 ทำ pull ใหม่ทุก import → localStorage มี cloud's latest state ก่อน filter

2. **Diagnostic counters** ใน confirm dialog:
 ```
 *แทนที่: เฉพาะกะของขอบเขตนี้ในเดือน 2026-07*
 ✓ ป้องกัน: ทีมอื่น 217 กะ ในเดือน 2026-07 จะถูกเก็บไว้
 ```
 ทำให้ Manager เห็นจำนวนกะของทีมอื่นที่จะถูกคงไว้ — ถ้าเห็น "0" ทั้งที่ควรมี → cancel

3. **Post-save verification** — เทียบจำนวน other-team shifts ก่อน/หลัง:
 ```js
 if (afterMonthOtherTeams < beforeMonthOtherTeams) {
   toast('⚠ DATA LOSS DETECTED', 'error');
 }
 ```

4. **Console diagnostic logs:**
 - `[Import] Before: month=X shifts (myTeam=Y, others=Z)`
 - `[Import] After: month=X shifts. Other teams preserved: Z`
 - `[Import] ⚠ DATA LOSS DETECTED: N other-team shifts lost`

### Workaround สำหรับช่วงเปลี่ยน (Modern Trade ที่หายไปแล้ว)
1. ขอให้ Manager 690615001 (Team Old) re-import July ใหม่
2. v1.4.13 pull cloud ก่อน → จะเห็น "Modern Trade team 217 shifts จะถูกเก็บไว้"
3. ยืนยัน → ผลคือทั้ง 2 ทีมจะอยู่ใน cloud พร้อมกัน

---

## [1.4.12] — 2026-06-28

**Critical Hotfix — Shift Import Cross-Team Wipe (P0)**

### Fixed
**Bug:** เมื่อ Manager A import Excel ตารางลงกะ → ลบกะของทีมอื่น (ทีม B, C, ...) **ทั้งเดือน** → เห็นแค่ทีม A
ต่อมา Manager B import → ลบ ทีม A ออกอีก → วนแบบนี้

**Root cause (line 3642):**
```js
const shifts = DB.load('shifts', []).filter(s => !s.date.startsWith(monthStr));
// ↑ wipe ENTIRE month, not scoped to importer's team
```

Export scope = ทีมของ Manager เท่านั้น (ถูก) แต่ Import wipe = ทั้งบริษัท → mismatch

**Fix:**
```js
const importerTeamIds = role === 'admin'
  ? new Set(emps.map(e => e.id))                                          // Admin: all
  : new Set(emps.filter(e => e.managerId === currentUser.id).map(e => e.id)); // Manager: team only
const shifts = DB.load('shifts', []).filter(s =>
  !s.date.startsWith(monthStr) || !importerTeamIds.has(s.employeeId)        // scoped wipe
);
// + Defensive: ถ้า file มีแถวของพนักงานนอก team → skip
```

### Improved
- Confirm dialog ของ Import แสดงขอบเขตชัด: `*ขอบเขต: ทีมของคุณ (10 คน)* · *ทีมอื่นไม่ถูกแตะ*`
- Added counter `notInTeam` — แจ้งถ้า file มีพนักงานนอก team

### Debug Mantra Trace
- ✅ Reproduce: code path confirms
- ✅ Trace: line 3642 wipe
- ✅ Falsify: 3 disprove attempts ทั้งสามตาย
- ✅ Cross-ref: 3 symptoms ตรงกับ hypothesis

---

## [1.4.11] — 2026-06-28

**Shift Code C + Diligence Exclusion + Critical Counter Leak Fix**

### Changed — Shift Schedule
- **เพิ่ม Shift Code `C`** = ลาสะสมวันหยุด (สีเขียวอ่อน)
- Cell ในตารางลงกะแยก L (ลาทั่วไป) กับ C (สลับวันหยุด) ออกจากกัน
- Excel Export Sheet 1/2/3 มี column "สะสมหยุด (C)" แยกจาก "ลา (L)"
- Header แสดงคีย์: `M=เช้า A=บ่าย N=ดึก W=ทำงาน O=หยุด L=ลา C=ลาสะสมวันหยุด`
- Import: skip both L and C (auto-derived)

### Changed — Diligence Bonus
- **ลาสะสมวันหยุด (comp-off) ไม่ตัดเบี้ยขยัน** อีกแล้ว
- เพราะเป็นการสลับวันหยุดเท่านั้น ไม่ใช่ลาจริง
- Logic: `hasLeaveThisMonth = leaves.some(r => r.type !== 'comp-off' && ...)`

### Fixed — Critical: Realtime Sync Permanent Skip (P0)
**Symptom:** หลัง Manager import 217 shifts ผ่าน Excel — Admin (และทุก session อื่น) **ไม่เห็น shifts ที่ import** แม้ refresh

**Root cause:**
1. Manager import → `DB.save('shifts', [...large array])` → `_localDirty['shifts'] = 1`
2. Cloud upsert payload ใหญ่ (>500KB) → network hang หรือ Promise timeout
3. `.then()` callback ใน save() ไม่ทำงาน → counter ไม่ลด → stuck = 1
4. ทุก realtime echo ของ key `shifts` → handler check `_localDirty['shifts'] > 0` → **SKIP** ตลอดไป
5. localStorage ของ Admin ค้างเก่า ไม่อัปเดต → render เห็น 0

Console hint ที่เปิดเผย: `[Realtime] skip 'shifts' — 1 local write(s) pending` ซ้ำๆ 24+ ครั้ง

**Fix (4 ชั้น):**
1. **ย้าย decrement ไป outer `finally`** ใน `_cloudUpsert` — guarantee ทำงานทุก exit path (success/error/throw/return/hang)
2. **Auto-recovery escape hatch:** ถ้า skip ติดกัน ≥ 5 ครั้ง → force clear dirty flag + process event
3. **Clear dirty on login** — fresh state ทุก session
4. **Debug helper** `DB.clearDirty(key?)` — manual reset จาก console

---

## [1.4.10] — 2026-06-28

**3 Features + Shift Schedule Race Fix**

### Changed
- **ลากิจ Default:** จาก 6 วัน → **3 วัน** (เท่ากันทั้งทดลองงาน + ผ่านทดลอง)
- ใช้ค่าจาก `settings.leaveQuotas.personal` (default 3) ทุก case
- Migration: ถ้าระบบเดิมยังเป็น 6 (default เก่า) → auto-migrate เป็น 3
- ถ้า Admin เคยตั้งค่าอื่น (เช่น 4) → ไม่แตะ

### Added — Shift Schedule
- **⬆ Import Excel button** ในหน้าตารางลงกะ (ข้างปุ่ม Export)
- ใช้ไฟล์ template เดียวกับที่ Export ออกมา → กรอกค่า W/M/A/N/O ลงในช่องวันที่ → upload กลับ
- รับ Sheet "ตารางกะ" — header row ที่ 5, day columns 4 ถึง 4+daysInMonth
- ก่อน save: confirm dialog แสดงจำนวนกะที่ parse ได้ + จำนวนพนักงานไม่พบ + ข้อมูลเดือนเดิมจะถูกแทนที่
- L (ลา) ถูก skip — auto-derived จาก leaveRequests

### Added — Comp-off Expire
- **Setting ใหม่:** "อายุของวันสะสมหยุด (เดือน)" ใน Settings → Leave Policy
- Default 12 เดือน · ตั้งได้ 1-60
- ใช้ใน `approveRequest('comp-off', true)` — เปลี่ยนจาก hardcoded 365 วัน

### Fixed — Shift Schedule Sync Bug (Critical Race)
**Root cause:** `_localDirty` ใช้ `Set` semantics — concurrent saves ของ key เดียวกัน collapse เหลือ entry เดียว → 1st upsert.then() คลีย flag → stale realtime echo overwrite local

```js
// Before (buggy)
this._localDirty = new Set();
this._localDirty.add(key);          // duplicate adds collapse
this._localDirty.delete(key);       // clears even if 2nd save pending!

// After (v1.4.10)
this._localDirty = {};
this._localDirty[key] = (this._localDirty[key] || 0) + 1;
// ...
this._localDirty[key]--;
// check: if (this._localDirty[key] > 0) skip echo
```

ผลคือ: คลิกตาราง shift เร็วๆ ติดกันแล้วช่องไม่ revert อีกแล้ว

---

## [1.4.9] — 2026-06-28

**Critical Hotfix — 3 Bugs**

### Fixed
**Bug #1: Approval Center ว่างเปล่าสำหรับ Admin (Critical)**
- Root cause: `renderApprovals()` filter `r.managerId === myId` — Admin ไม่ได้เป็น manager ของใคร → เห็น 0 เสมอ
- Fix: เพิ่ม `isAdmin` check → Admin เห็น **ทุก** pending request ในระบบ (manager ยังเห็นเฉพาะลูกน้องตัวเอง)
- ครอบคลุม: `renderApprovals()`, `drawApprovalList()`, `getPendingApprovals()` (sidebar badge)

**Bug #2: Data loss วันที่ 27 มิ.ย. (vacation-accrual หาย)**
- Root cause: v1.4.5 fix ครอบคลุม "refresh push" — แต่ไม่ครอบคลุม **multi-tab race** ที่ stale tab push `[]` ทับ
- Evidence: cloud `leaveRequests = []` updated_at 16:53 UTC (23:53 ไทย) — หลัง user ปิดงานไปแล้ว
- Fix: เพิ่ม **anti-data-loss guard** ใน `_cloudUpsert()`
 - ถ้ากำลังจะ push `[]` ของ key สำคัญ (`*Requests`, `employees`, `shifts`)
 - ตรวจ cloud ก่อน → ถ้า cloud มีข้อมูล → **REFUSE push** + restore local จาก cloud + toast แจ้งเตือน
 - User เห็นข้อมูลกลับมาทันที ไม่หายแน่นอน

**Bug #3: วันอาทิตย์ในปฏิทินมองเลขไม่เห็น**
- Root cause: `.weekend` background `#fafafa` (เกือบขาว) — Sunday ถูก override โดย `.today` ทำให้ text กลืนพื้น
- Fix: เพิ่ม CSS class `.sunday` → background `#1e3a8a` (navy) + color `#ffffff` (ขาว) — สีไม่ซ้ำกับ "ลา" (น้ำเงิน primary) หรือ "วันหยุด" (แดง) หรือ "วันนี้" (primary)
- Legend อัปเดต: แยก "วันอาทิตย์" กับ "วันเสาร์"

### Postmortem (Bug #2)
ลำดับเหตุการณ์:
1. 21:00-22:00 ไทย — Tab A submit `vacation-accrual` → cloud มี item แล้ว
2. มี Tab B (อีก device หรือ tab ที่เปิดไว้นานแล้ว) state เก่า `leaveRequests = []`
3. Tab B trigger action ใดๆ ที่ทำให้ `DB.save('leaveRequests', staleArray)` ถูกเรียก → `_cloudUpsert([])`
4. cloud ถูก overwrite ด้วย `[]` → ข้อมูลใหม่หาย
5. 23:53 ไทย (16:53 UTC) = timestamp ที่ Tab B push

ทำไม Realtime ไม่ป้องกัน? — Realtime ทำงาน แต่ Tab B ไม่ได้ trigger render หลังจาก submit ดังนั้น state ของ Tab B ยังเก่า ขณะที่ครั้งสุดท้ายที่ Tab B `DB.save` มันใช้ in-memory state เก่า

Guard ใหม่ block ที่ point write — ทุกครั้งที่ array critical จะ pushed empty จะถูก check กับ cloud ก่อน

---

## [1.4.8] — 2026-06-27

**Add "มาสายสะสม (นาที)" Report Tab**

### Added
- **Tab ใหม่ในหน้ารายงาน:** `มาสายสะสม` (อยู่ขวาสุด หลัง `รับรองเวลา`)
- **สรุปรายคน:** อันดับ, รหัส, ชื่อ, แผนก, จำนวนวันมาสาย, รวมเวลาสาย (นาที), เฉลี่ย/ครั้ง
- เรียงจาก **มาสายเยอะ → น้อย**
- **Month filter:** dropdown เลือก 12 เดือนย้อนหลัง (default = เดือนปัจจุบัน)
- **Stats banner:** จำนวนพนักงานมาสาย + รวมเวลาสายทั้งหมด + รวมจำนวนครั้ง
- **ปุ่ม "ดูรายละเอียด"** ต่อแถว → modal แสดงวันที่มาสายทุกวัน, เวลาเข้า/ออกงาน, จำนวนนาทีที่สาย
- **Export CSV** + **Export Excel** (`exportLateSummaryXLSX`, 2 sheets: สรุป + รายละเอียด)

### Logic
- ใช้เกณฑ์มาสายจาก Settings (`settings.lateThreshold`, default `09:01`)
- คำนวณ: `lateMinutes = (checkInMinutes − thresholdMinutes)` ถ้า > 0
- Group by `employeeId`, sort DESC ตามรวมเวลาสาย

---

## [1.4.7] — 2026-06-27

**Add .txt File Support for Attendance Upload (Tigersoft Plain Text)**

### Added
- **รับไฟล์ `.txt`** (Tigersoft Plain Text Export) เพิ่มจาก `.xlsx`
 - ไม่มี Excel auto-conversion → ไม่มี DD/MM vs MM/DD confusion
 - วันที่เป็น string `DD/MM/YYYY` ตรงจาก Tigersoft
 - แนะนำเป็นวิธีหลัก หากเป็นไปได้
- **`parseTxtAttendanceLine(line)`** — regex-based parser
 - Extract: date, time, empCode (9 digits), firstName, lastName, company, department
 - Robust ต่อ space alignment ที่ไม่เท่ากัน
- **`previewAttendanceTxt(text)`** — separate pipeline for .txt
 - Reuse `_attendanceBuffer` + `confirmUploadAttendance()` ของ Excel pipeline
- **File input accept** `.xlsx, .xls, .txt`
- **Preview banner** แยกระหว่าง Excel และ TXT (TXT badge: "ไม่มี Excel auto-conversion")

### Verified
- File "text.txt" (3,395 lines): 100% parsed, 0 errors
- 104 unique employees recognized
- Dates DD/MM/YYYY → ISO YYYY-MM-DD ครบทุก row

### Use Case
ถ้า Tigersoft Excel ส่งออกแล้ว format เพี้ยน (Excel auto-convert บางแถว เป็น datetime) — ใช้ .txt export แทน ระบบจะ parse ตรง ไม่มีความกำกวม

---

## [1.4.6] — 2026-06-27

**Normalize Excel Column A to DD/MM/YYYY at file-read time**

### Per User Request
> "เมื่อรับไฟล์แล้ว ให้ดำเนินการแปลง Format Column A อย่างไรก็ตามให้เป็น DD/MM/YYYY ก่อนการนำข้อมูลไปใช้งานเสมอ"

### Changed
- **Upload pipeline now has explicit Step 1: NORMALIZE** — ก่อน parse anything, แปลง Column A ทุก cell เป็น `DD/MM/YYYY` string format
- Excel files มี mixed formats (datetime + strings) → uniform DD/MM/YYYY ทุก row
- หลัง normalize: parse เป็น YYYY-MM-DD ISO เก็บใน DB

### Added
- **`normalizeToDDMMString(v)`** — handles 4 input cases:
 - `Date` object (Excel auto-parsed): swap month/day to recover DD/MM intent → `DD/MM/YYYY`
 - ISO `YYYY-MM-DD` string → `DD/MM/YYYY`
 - DD/MM/YYYY string: keep + zero-pad
 - DD-MM-YYYY (dash): convert to slash
- **`normalizeAttendanceColumnA(rows, idx)`** — applies normalize in-place to all rows
- **Preview UI** แสดง normalize stats: datetime count / string count / ISO count / errors

### Verified
- File "RadGridExport (1)-9635b91b.xlsx" (17,257 rows):
 - 7,235 datetime values → normalized
 - 10,021 string values → kept (already DD/MM)
 - 0 errors
 - 142 unique dates across 6 months (Jan-Jun 2026)

---

## [1.4.5] — 2026-06-27

**CRITICAL FIX: Data Loss Race Condition in Cloud Sync**

### Root Cause
3 bugs combined caused intermittent data loss in employees + leave requests:

1. **`cloudPushAll()` ran on EVERY page load** (not only first-time setup)
   - Old: `if (DB.load('initialized', false)) DB.cloudPushAll();` — fires every refresh
   - Effect: If another browser added data after our `cloudPullAll` but before our `cloudPushAll`, the new data got **overwritten by our stale local data**

2. **`DB.save()` is fire-and-forget** for cloud upserts (no `await`)
   - If user refreshed page before the upsert completed, cloud still had old data
   - Next `cloudPullAll` would overwrite local with the old data

3. **Realtime handler had no concurrency guard**
   - Echoes of our own writes (or other clients' writes) could overwrite local data mid-edit

### Fix
- **New `cloudPullAllSafe()`** — returns `{ok, count, reason}` so caller can distinguish "cloud empty" from "cloud pull failed"
- **Startup sequence rewritten:**
 1. Pull cloud first (authoritative)
 2. Setup realtime
 3. Seed locally **ONLY** if `!alreadyInitialized` AND cloud pull succeeded
 4. Push initial seed up to cloud ONLY this one time
 5. **NO more unconditional `cloudPushAll()` on every load**
- **`DB._localDirty` Set** — tracks keys currently being upserted
- **Realtime handler skips updates** for keys in `_localDirty` until cloud confirms write
- **Network-fail safety:** if cloud pull fails AND localStorage is empty, show alert and stop (prevents pushing empty data over real cloud data)

### Impact
- ✅ พนักงานที่เพิ่มจะไม่หายอีก
- ✅ คำขอลาที่ส่งจะถึง Admin ทุกครั้ง
- ✅ Cross-device sync เสถียร
- ✅ Offline mode safe (ไม่ overwrite cloud โดยไม่ตั้งใจ)

### Migration Note
- **ก่อน upgrade:** Manual backup CSV จาก Supabase Table Editor
- **หลัง upgrade:** ทดสอบ add employee + refresh page ดูข้อมูลคงอยู่
- v1.4.4 → v1.4.5 ไม่ต้องแก้ schema

---

## [1.4.4] — 2026-06-26

**Attendance Report: Department lookup จาก system + "พนักงานใหม่"**

### Changed
- **คอลัมน์ "แผนก"** ในรายงานเข้างาน (ทุกตาราง + XLSX export) — เปลี่ยนจากค่าใน record (ตอน upload Excel) เป็น **lookup จาก employees ในระบบ**
 - ถ้าพบในระบบ → ใช้ `employee.department` (ตรงตามที่ Admin ตั้งล่าสุด)
 - ถ้าไม่พบ → แสดง badge **"พนักงานใหม่"** (สีส้ม)

### Added
- Helper `getDeptForAttendance(rec)` — try lookup ด้วย `employeeId` ก่อน · fallback ด้วย `employeeCode` · finally return `'พนักงานใหม่'`

### Why this matters
- เดิม: ถ้า Admin เปลี่ยนแผนกพนักงานในระบบ → รายงานเก่ายังโชว์แผนกเก่าจากไฟล์ Excel
- เดิม: รหัสที่ไม่มีในระบบ (เช่น เพิ่งจ้างมา ยังไม่ได้เพิ่ม) → โชว์ค่าจาก Excel ที่บางครั้งว่าง/ไม่ตรง
- ใหม่: รายงานสะท้อนสถานะระบบล่าสุดเสมอ · เห็นทันทีว่าใครยังไม่ได้ add เข้าระบบ

---

## [1.4.3] — 2026-06-26

**Fix: รายงานเข้างาน — date filter, distinct counts, date column**

### Fixed
- **Critical: Stats ไม่เปลี่ยนตามวันที่เลือก** — เกิดจากใน v1.3.0 ตอนเพิ่ม time-cert merge ลืม filter records ตามวันที่ก่อน → `mergeApprovedTimeCertForDate(records, date)` returns records ทั้งหมดถ้าไม่มี cert ตรงวัน → stats นับรวมทุกวัน
 - แก้: filter records → `r.date === _attReportDate` **ก่อน** เรียก merge

### Changed
- **นับ unique ต่อพนักงานต่อวัน** — ใช้ `Map` keyed by `employeeCode` เพื่อ dedup กรณีมีหลายเรคคอร์ดของคนเดียวกันในวันเดียว (เช่น cert overrides scan)
 - มาทำงาน / มาสาย / ไม่มา / ขาดอัตโนมัติ ทั้งหมด unique count
- **เพิ่มคอลัมน์ "วันที่"** ในทุกตาราง: มาทำงาน, มาสาย, ไม่มา, ลา (4 tabs)
- **XLSX Export ปรับด้วย** — เพิ่ม column วันที่ + ใช้ unique count + label "จำนวนพนักงานทั้งหมด (Unique)" ใน sheet สรุป

### Why this matters
- ก่อนแก้: เลือกวันใดได้ตัวเลขเดียวกัน (1632/1659) — ทำให้ตัดสินใจผิด
- หลังแก้: เลือก 13 พ.ค. → เห็นเฉพาะของวันนั้น · เลือก 24 พ.ค. → เห็นเฉพาะของวันนั้น

---

## [1.4.2] — 2026-06-26

**Time Certification Report (Admin Reports tab)**

### Added
- **Tab ใหม่ในหน้า "รายงาน"** — `รับรองเวลา` แสดงคำขอรับรองเวลาทั้งหมดในระบบ (รวมทั้ง pending/approved/rejected)
- **Filter buttons** — ทั้งหมด / รออนุมัติ / อนุมัติแล้ว / ปฏิเสธ พร้อมแสดงจำนวน
- **Stats grid 4 cards** — Total / Pending / Approved / Rejected
- **ตารางครบ 13 คอลัมน์** — วันที่ขอ, พนักงาน, วันที่ทำงาน, เวลาเข้า/เลิกจริง, **สแกนจริงเทียบ**, เหตุผล, หัวหน้า, สถานะ, วันอนุมัติ, หมายเหตุ, ดูหลักฐาน, ปุ่มลบ (Admin)
- **`exportTimeCertXLSX()`** — Excel 2 sheets
 - Sheet 1: คำขอครบทุกรายการ + สแกนจริง + หมายเหตุผู้อนุมัติ
 - Sheet 2: สรุปสถานะ + สรุปต่อพนักงาน (sort by total desc)
- **`deleteTimeCert(id)`** — Admin ลบคำขอได้พร้อม audit log + cascade ลบ notification

### Schema additions
- State: `_timeCertReportFilter` (filter ที่ใช้ในรายงาน)

---

## [1.4.1] — 2026-06-26

**Fix DD/MM date parsing for Tigersoft Excel imports**

### Fixed
- **Critical: ไฟล์ Tigersoft อ่านวันที่ผิด** — Tigersoft ส่งออก `DD/MM/YYYY` แต่ Excel locale (US) auto-parse แถวที่ทั้ง day+month ≤ 12 เป็น `MM/DD` → เก็บ `datetime` ที่ month/day **สลับกัน**
 - ตัวอย่าง: ค่า `01/06/2026` (1 มิ.ย.) ใน Excel กลายเป็น `datetime(2026, 1, 6)` (6 ม.ค.) → ระบบเดิมอ่านผิดเป็น 6 ม.ค.
 - แถวที่ day > 12 (เช่น `17/06/2026`) ยังเป็น string DD/MM อยู่ → 2 format ในไฟล์เดียว
- **แก้แล้ว:** `parseAnyDate(v, opts)` รับ format parameter (default 'DD/MM' Thai) — swap month/day กลับให้ถูกต้อง

### Added
- **`detectExcelDateFormat(workbook)`** — heuristic auto-detect format จาก string cells ในไฟล์
 - String date ที่ day > 12 → DD/MM confirmed (high confidence)
 - String date ที่ month > 12 → MM/DD confirmed (high confidence)
 - ไม่มี evidence → ใช้ default DD/MM (Thai)
- **UI Banner ในหน้าอัปโหลด** แสดง format ที่ detect ได้ + confidence + จำนวน evidence rows
 - High confidence → สีน้ำเงิน (info)
 - Default fallback → สีส้ม (warning) + เตือนตรวจสอบหน้าจอ
- เพิ่ม console.log สำหรับ debug

### Verified with real Tigersoft exports
- `RadGridExport (1).xlsx`: 3,212 rows · detected DD/MM (1,684 evidence) → ครอบ 26 วัน (2026-06-01 → 2026-06-26)
- `RadGridExport (2).xlsx`: 2,994 rows · detected DD/MM (1,495 evidence) → ครอบ 24 วัน (2026-05-01 → 2026-05-24)

### Behavior
- ระบบเก็บใน localStorage เป็น ISO `YYYY-MM-DD` เสมอ (มาตรฐานเดียว)
- File ที่ใช้ MM/DD format จะถูก detect และ parse ถูกต้องอัตโนมัติเช่นกัน
- Backward compatible: ข้อมูลเก่าใน localStorage ที่เก็บถูกต้องอยู่แล้วไม่ได้รับผลกระทบ

---

## [1.4.0] — 2026-06-21

**Configurable Companies (Multi-tenant CRUD)**

### Added
- **Settings UI สำหรับจัดการบริษัทในเครือ** (Admin only) — เพิ่ม/แก้ไข/ลบบริษัทได้
 - ฟิลด์: ID, ชื่อย่อ (label), ชื่อเต็ม (ใช้บนสลิป), ที่อยู่, TAX ID, เบอร์โทร, ชื่อไฟล์โลโก้
 - ตารางแสดงจำนวนพนักงานสังกัด · ลบไม่ได้ถ้ามีพนักงาน
 - ID validation: a-z, 0-9, `-`, `_` · ห้ามแก้ ID หลังบันทึก
- **Seed companies** เพิ่ม **The Habita** (4 บริษัทรวม): Masterpiece, Crochet, ConceptOne, The Habita

### Changed
- **`getCompanyInfo(id)`** — read จาก `settings.companies` (fallback hardcoded สำหรับ legacy)
- **`getCompanyLabel(id)`** — new helper return display name
- **Employee form dropdown** — populate จาก settings dynamic
- **ลบ hardcoded mapping** `({masterpiece:'Masterpiece',...})[id]` ออกทุกที่ (~7 จุด): Org Chart, Employee Management, Payroll Export, Exec Dashboard XLSX, Settings rows
- **Audit Log** — ทุกการเพิ่ม/แก้ไข/ลบบริษัท

### Schema additions
- `settings.companies: [{ id, label, name, address, taxId, phone, logo }]`

### Use cases
- เพิ่ม "The Habita" + กรอกข้อมูลที่อยู่/TAX ID แยก → สลิปเงินเดือนของพนักงาน Habita จะแสดงหัวบริษัทเฉพาะ
- เปลี่ยนชื่อ/ที่อยู่บริษัทได้เองทาง Settings ไม่ต้องแก้โค้ด
- รองรับการขยายบริษัทในเครือในอนาคต

---

## [1.3.1] — 2026-06-21

**Unpaid Leave: hourly → half-day/day**

### Changed
- **ลาไม่รับค่าจ้าง** เปลี่ยนจาก "รายชั่วโมง" → "ครึ่งวัน/วัน" — ใช้ workflow เดียวกับลาประเภทอื่น (date range + halfDay selector)
 - Form: ตัด `unpaidHoursGroup` ออก · ใช้ `dateRangeGroup` + `halfDayGroup` เหมือนทุกประเภท
 - Validation: ขั้นต่ำ 0.5 วัน (ครึ่งวัน) · ลาเต็มวัน/หลายวันได้
 - Payroll: เปลี่ยนสูตรหักเงินเป็น `unpaidDays × dailyRate` (เดิม: `unpaidHours × hourlyRate`)
 - Slip: แสดง "X วัน × Y บาท/วัน" (เดิม: "X ชม. × Y บาท/ชม.")
 - Excel export Payroll: คอลัมน์ "ลาไม่รับค่าจ้าง (วัน)" (เดิม: "(ชม.)")

### Backward compatibility
- Records เก่าที่มี `unpaidHours > 0` ยังถูกคำนวณถูก (legacy path: `hours × hourlyRate`)
- Helper ใหม่ `leaveQtyDisplay(r)` — แสดง "ชม." สำหรับ legacy, "วัน" สำหรับใหม่
- Payslip return เพิ่ม field `unpaidDays`, `dailyRate`

### Internal
- ทำให้ `calcLeaveDays` + `updateLeaveFormUI` simpler — ไม่มี branch พิเศษสำหรับ unpaid อีกแล้ว
- ตัด unused state field `unpaidHours` ในการ submit (เซ็ตเป็น 0 ตลอดสำหรับ records ใหม่)

---

## [1.3.0] — 2026-06-21

**Auto-Absent Rule + Time Certification Workflow**

### Added
- **Auto-Absent Rule** — Setting `autoAbsentLateMinutes` (default 240) · มาสายเกิน X นาทีจาก `lateThreshold` → ระบบนับเป็นขาดงานทันที (excluded from workDays + payroll calculation) · แสดง stat card "ขาดอัตโนมัติ" + แท็กแถวในตาราง "ไม่มา"
- **Time Certification Workflow** (รับรองเวลา) — เมนูใหม่ "ขอรับรองเวลา" ใต้ "ขอ OT"
 - Employee → Form: วันที่ทำงาน, เวลาเข้าจริง, เวลาเลิก (ถ้ามี), เหตุผล, แนบหลักฐาน (image/PDF ≤ 2 MB)
 - Manager → Approval tab ใหม่ "รับรองเวลา" · แสดงเวลาที่ขอเทียบกับสแกนจริง
 - Approved cert → merge เข้า attendance pool อัตโนมัติ → ใช้ในรายงาน + คำนวณเงินเดือน
 - แสดง badge "รับรองเวลา" ในตารางมาทำงาน
- **Setting: เปิด/ปิดฟังก์ชั่นรับรองเวลา** (`timeCertEnabled`) — Admin toggle ได้

### Changed
- **`renderAttendanceReport`** — merge approved time certs ก่อนจัดหมวด · auto-absent ถูกย้ายไปแท็บ "ไม่มา"
- **`calculatePaySlip`** — ใช้ merged attendance + skip auto-absent records · เพิ่ม field `autoAbsentDays` ใน return
- **`getPendingApprovals`** — รวม time cert pending ใน badge sidebar
- **Cascade delete** — ลบพนักงาน → ลบ time-cert requests ทั้งหมดของคนนั้น

### New Helpers
- `computeAutoAbsentCutoff(settings)` — return "HH:MM" cutoff
- `mergeApprovedTimeCertForDate(records, dateStr)`
- `mergeApprovedTimeCertForMonth(records, monthStr)`

### Schema additions
- `settings.autoAbsentLateMinutes: number`
- `settings.timeCertEnabled: boolean`
- New store: `timeCertRequests[]`
 - `{ id, employeeId, date, claimedCheckIn, claimedCheckOut, reason, attachment, attachmentName, status, requestDate, managerId, approverNote, approvedDate }`

---

## [1.2.2] — 2026-06-21

**Pay Slip visual refinement**

### Changed
- **Pay Slip color palette** → เปลี่ยนเป็นโทน gray ทั้งใบ (เดิม: green/red/black bars ที่ contrast แรงเกิน อ่านยาก)
 - Header bars: `#f3f4f6` light gray bg · `#374151` dark text
 - Section borders: `#475569` slim accent bar (เดิม สีเขียว/แดง บล็อกใหญ่)
 - Table headers: `#f3f4f6` (เดิม `#000` solid black + `#dc2626` solid red)
 - Net Pay box: `#4b5563` dim gray bg · white text · rounded 8px (เดิม solid black)
 - All amounts: dark gray instead of bright green/red for plus/minus
 - Borders: `#e5e7eb` ลายเส้นบาง · เพิ่ม visual hierarchy ด้วย panel grouping

### Removed
- **บรรทัด "มาสาย"** ออกจากตาราง Deductions ของสลิป (ยังคงคำนวณ + หักจากเงินสุทธิอยู่ — แค่ไม่แสดงรายการ)

---

## [1.2.1] — 2026-06-21

**Leave Policy display + sick cert rule**

### Added
- **Settings UI for leave policy parameters** — เพิ่ม 4 field ที่เคย hardcode ใน "นโยบายสิทธิ์ลา"
 - `sickCertThreshold` (default 2): ลาป่วยเกินกี่วันต้องแนบใบรับรองแพทย์
 - `backDatedLeaveMaxDays` (default 7): ห้ามยื่นลาย้อนหลังเกิน X วัน
 - `leaveCarryOverMax` (default 5): ยกยอดวันลาข้ามปีสูงสุด
 - `leaveCarryOverCutoff` (default '03-31'): วันตัดยอดยกข้ามปี

### Changed
- **Sick leave validation** — ใช้ `sickCertThreshold` แทน hardcode "1" และ "2"
 - `sick-without-cert`: ลาได้สูงสุด ${threshold} วัน (เดิม 1)
 - `sick-with-cert`: ต้องลามากกว่า ${threshold} วัน (เดิม 2)
- **showLeaveForm dropdown** — text แสดงตามค่าใน settings
- **Leave Policy Card** ในหน้า "วันหยุด & สิทธิ์ลา" → **dynamic ทั้งหมด**
 - ลาพักร้อนตามอายุงาน: คำนวณจาก `vacationAccrual` settings (Base, +วัน/ปี, เพดาน)
 - ลาป่วยตามกฎหมาย: ใช้ค่าจาก settings.leaveQuotas.sick + sickCertThreshold
 - ลากิจช่วงทดลองงาน: ใช้ probationPersonalCap + probationDays
 - ยกยอดวันลาข้ามปี: ใช้ leaveCarryOverMax + leaveCarryOverCutoff
 - ห้ามยื่นลาย้อนหลัง: ใช้ backDatedLeaveMaxDays

### Schema additions
- `settings.sickCertThreshold: number`
- `settings.backDatedLeaveMaxDays: number`
- `settings.leaveCarryOverMax: number`
- `settings.leaveCarryOverCutoff: string` (MM-DD)

---

## [1.2.0] — 2026-06-21

**HR Policy refinements before management presentation**

### Added
- **Vacation Accrual by Years of Service** — Setting ใหม่ `vacationAccrual` ปรับเพดานสิทธิ์ลาพักร้อนเพิ่มตามอายุงาน · กำหนด Base (ปีที่ 1), เริ่มเพิ่มที่ปีอายุงานเท่าใด, +วัน/ปี, เพดานสูงสุด · มี Live Preview แสดงสิทธิ์ปี 1-12 พร้อม flag เพดาน · เปิด/ปิดได้ผ่าน iOS toggle
- **Probation Personal Leave Cap** — Setting ใหม่ `probationPersonalCap` (default 3 วัน) — พนักงานในช่วงทดลองงานมีสิทธิ์ลากิจได้ตามที่กำหนด (เดิม = 0)
- **`yearsOfService`** ใน `getLeaveBalance` return — ใช้ในรายงาน/dashboard ต่อได้

### Changed
- **getLeaveBalance** — ใช้ vacation accrual table แทน fix quota เดียว · probation ไม่บล็อก personal อีกแล้ว
- **showLeaveForm** — option ลากิจในช่วงทดลองงานไม่ถูก disable ถ้า quota > 0
- **Probation alert** — แสดงสิทธิ์ลากิจตามจริง (เช่น "ลากิจได้ 3 วัน" แทน "ลาได้เฉพาะลาป่วย/ลาคลอด")

### Schema additions
- `settings.probationPersonalCap: number`
- `settings.vacationAccrual: { enabled, base, startYear, incrementPerYear, maxDays }`

---

## [1.1.0] — 2026-06-21

**Pre-presentation refinements**

### Added
- **Stationery: Edit + Delete buttons per row** — Admin / `isStationeryAdmin` ลบรายการที่เพิ่มผิดได้ พร้อม cascade ลบประวัติเบิก/รับเข้าของ item นั้น
- **Per-employee Leave Quota Override (Admin only)** — ปรับสิทธิ์ลาได้ทุกประเภท (ลากิจ, ลาพักร้อน, ลาป่วย, ลาคลอด, ลาบวช) ต่อพนักงานรายคน · Override จะข้าม Pro-rate และข้ามทดลองงาน · มีปุ่มรีเซ็ตกลับเป็น default
- **OT Multiplier แยกวันปกติ vs วันหยุด** — Setting field ใหม่ `otMultiplierHoliday` (default 3×) · ระบบ detect วันหยุดอัตโนมัติจาก companyHolidays + เสาร์-อาทิตย์ · สลิปแสดง breakdown 2 บรรทัด (OT วันปกติ × 1.5 / OT วันหยุด × 3)
- **OT Attachment** — แนบรูป/PDF ในฟอร์มขอ OT (สูงสุด 2 MB) · แสดงในศูนย์อนุมัติ Manager + หน้าของพนักงาน
- **OT request: คืนปุ่มขอลาให้ทุก role** — Employee/Manager/Accountant ส่งคำขอลาตัวเองได้กลับมา (Admin ยัง add แทนคนอื่น + auto-approve ได้)

### Fixed
- **Bulk Commission modal layout overflow** — Modal กว้างขึ้น (880px) + grid `minmax(0, ...)` + `min-width:0` บน input · responsive breakpoint @640px → stack rows

### Schema additions
- `employees[].leaveQuotaOverride: { personal?, vacation?, sick?, maternity?, ordination? }`
- `settings.otMultiplierHoliday: number`
- `otRequests[].attachment / attachmentName` (Base64)

---

## [1.0.0] — 2026-06-21

**🎉 First Production Release**

Stable baseline ของระบบ HR Management System ที่ใช้งานได้ครบทุก workflow หลัก พร้อม Export, Cloud sync, และ Multi-tenant support สำหรับ Masterpiece / Crochet / ConceptOne

### Added — Core Modules

#### Employee Self-Service
- **ระบบขอลา 7 ประเภท** — ลากิจ, ลาพักร้อน, ลาป่วย (มี/ไม่มีใบรับรอง), ลาคลอด, ลาบวช, ลาไม่รับค่าจ้าง (รายชั่วโมง), ลาสะสมวันหยุด
- ลาครึ่งวัน (เช้า/บ่าย) ได้
- Pro-rate สำหรับพนักงานใหม่หลังผ่านทดลองงาน 120 วัน
- ระบบขอ OT, สะสมวันหยุด, ปฏิบัติงานนอกสถานที่
- ปฏิทินส่วนตัว แดชบอร์ดของฉัน
- ดาวน์โหลดสลิปเงินเดือนเป็น PNG + ปุ่มแชร์ผ่าน Web Share API
- ระบบประเมินตัวเอง (ทดลองงาน 120 วัน + ประจำปี)
- ผังองค์กรแสดงสายบังคับบัญชา

#### Manager
- ศูนย์อนุมัติ (ลา/OT/สะสม/งานนอกสถานที่) พร้อม badge แจ้งจำนวนรออนุมัติ
- Dashboard ผู้บริหารแสดง KPI ทีม
- ปฏิทินทีมรวมสถานะลูกน้องทุกคน
- ตารางลงกะงาน (Shift Schedule) — Cycle ผ่านการ click (M/A/N/W/O)
- ระบบประเมินลูกน้อง (4 เกณฑ์มาตรฐาน + ปรับแต่งได้)

#### Admin (HR)
- CRUD พนักงาน + Cascade Delete ครอบคลุม leave, OT, attendance, payslip, commission
- Reset Password, ปรับ Role, ปรับสายบังคับบัญชา
- ปรับสิทธิ์ลาเป็นรายคน (override default)
- Onboarding / Offboarding Checklist
- อัปโหลดเวลาเข้างาน (Excel format `RadGridExport.xlsx`) — Match ด้วยรหัสพนักงาน
- รายงานเข้างาน รายวัน (มาทำงาน / ลาหยุด / มาสาย / ไม่มา)
- ค่าคอมมิชชั่นรายเดือนรายคน — รวมเข้าสลิปเงินเดือนอัตโนมัติ
- Audit Log บันทึกทุกการเปลี่ยนแปลงข้อมูล
- ตั้งค่าระบบ (วันหยุด, OT rate, ค่าหักสาย, เกณฑ์ประเมิน, ประกันสังคม)

#### Accountant / Finance
- ส่งออก Payroll ทั้งบริษัทในเดือนเดียว
- คำนวณอัตโนมัติ: เงินเดือน + OT (×1.5) + Commission − หักมาสาย − ลาไม่รับ