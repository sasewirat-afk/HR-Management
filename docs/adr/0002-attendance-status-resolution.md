# ADR-0002: Attendance Status Resolution

**Status**: Accepted
**Date**: 2026-07-06 (afternoon)
**Session**: Grill-with-docs on 4 attendance topics (see prompt for full topic list)

---

## Context

The v1.4.54 rollout completed payroll cutoff semantics, but a real user report on 6 Jul 2569 surfaced a bug in the attendance calculation: employee `661218001` (จิราภรณ์ เชียงราย) submitted an approved off-site work request for 7 Jul 09:00-11:00, but the attendance report classified her as `ไม่มาทำงาน (ไม่พบใน TIGERSOFT)`. She actually worked, just off-site — so the report was wrong.

Investigating further, we found the attendance status logic was **implicit** — scattered across `exportAttendanceXLSX` (line 6800-6900), `calculatePaySlip`, and the daily report renderer, each with subtly different rules. Multiple overlapping signals (Tigersoft scan, approved leave, approved field work, shift day-off, `exemptFromAttendance`) were never resolved by a single, documented priority ladder.

At the same time, the user requested three related changes to the Excel export:
- Break out leave sub-types in the `ภาพรวม` sheet
- Add `ทำงานนอกสถานที่` as a first-class status
- Split the `สรุป` sheet by company
- Exclude admin-role employees from the headcount, with a per-employee override for the one admin who does scan (430806001)
- Treat `exemptFromAttendance` employees as if they had scanned on time

We ran a grilling session with 16 targeted questions to force explicit decisions on every edge case before writing code.

---

## Decision

**Introduce a single `resolveAttendanceStatus(emp, date)` function** that returns exactly one of 11 canonical values (see `CONTEXT.md > Attendance Status`), walking the following priority ladder top-down and returning the first match:

1. Day Off (per shift schedule)
2. Leave — one of `ลากิจ`, `ลาป่วย`, `ลาพักร้อน`, `ลาสะสมวันหยุด`, `ลาอื่นๆ` (maternity/ordination/unpaid grouped)
3. Field Work (approved) — **including cases where the employee also scanned late** (Q3 B)
4. Present from scan — `มาตรงเวลา` / `มาหลังเวลา` / `มาสาย` bucketed by `checkIn` vs `workStart` / `lateThreshold`
5. Exempt Present — for `exemptFromAttendance=true` employees on non-off / non-leave days
6. Absent — fallback

Publish this rule set in `CONTEXT.md` so future changes must edit the ladder there, not scatter conditionals across the codebase.

**Per-employee attendance countability** is governed by a new `emp.countInAttendance` flag:
- `false` → exclude
- `true` → include (this is how we opt admin `430806001` back in)
- unset → derive from `emp.role` (admin excluded by default per Q12 A)

**Excel export changes**:
- `ภาพรวม` sheet: extend the status column to use all 11 values; no other structural change (Q9 A keeps the daily overview as a single cross-company table).
- `สรุป` sheet: replaced by 5 sheets — `สรุป-ทั้งหมด` + one per company (Crochet, Masterpiece, ConceptOne, Habita). A sixth `สรุป-ไม่ระบุบริษัท` is appended only if any employee lacks a `company` value.

---

## Consequences

### Positive
- Ambiguity is gone: any developer touching attendance code checks `resolveAttendanceStatus` first, and any product change is a single ladder edit.
- The field-work bug is fixed as a natural consequence — the ladder puts Field Work above Present, so approved off-site work is never misclassified as absent.
- User `661218001` and everyone like her stop losing diligence bonus + base pay for legitimate off-site work.
- Per-company sheets give each brand's HR admin a focused view without exporting five separate files.
- `countInAttendance` is a clean escape hatch — no hardcoded employee IDs in the codebase.

### Negative
- `calculatePaySlip` must now call the resolver plus (still) load attendance twice (calendar + cycle scopes from ADR-0001). Extra work per employee-day but negligible against the v1.4.49 `DB.load` cache.
- Q3 B is a strong policy statement: an approved field work request **hides** an actual late scan from the report. A dishonest employee could theoretically submit a bogus field-work request to escape lateness. Mitigation: field-work approval is the manager's checkpoint — the manager sees the scan time in the request context and can reject on suspicion.
- Existing saved paySlips (10 test slips before this ADR) were computed with the old, implicit rules. Per Q16 B, they are not silently rewritten — Admin must regenerate them via the `🗑️ ลบสลิปทั้งหมด` button + fresh generation.
- The 11-value status list is fixed in `CONTEXT.md`. Adding a 12th value (e.g. a future new leave type) requires an update to both `CONTEXT.md` and `resolveAttendanceStatus`, and the export code should stay pattern-agnostic (drive columns from the status list, don't hardcode).

### Neutral
- Zero data migration. `fieldWorkRequests`, `leaveRequests`, `attendanceRecords` all retain their existing schema. Only calculation and display change.
- Rollback path: Vercel promote v1.4.54. Field-work bug returns, but no data loss.

---

## Alternatives Considered

1. **Manual reconciliation** (Topic 1 Option C) — leave the report as-is, ask Admin to manually mark each field-work day.
   *Rejected*: doesn't scale and defeats the point of having field-work requests in the system.

2. **Q1 Option B — Present wins over Field Work / Leave.**
   *Rejected*: a scan without a follow-through workday shouldn't override a formally approved absence category. Present is a fact of the door, not a fact of the workday.

3. **Q3 Option A — Late scan wins over Field Work.**
   *Rejected*: this preserves the transparency of the late log but re-creates the exact bug that started this session — approved off-site work being counted as lateness.

4. **Q4 Option C — Flag both leave + field work as a data conflict for the admin.**
   *Rejected*: adds an "attention state" that the daily report has no place to display. Q4 A (Leave wins) preserves report simplicity; the conflict is caught at approval time, not classification time.

5. **Q12 Option D — Hardcode `ADMIN001` in the exclusion list.**
   *Rejected*: brittle. Any future admin (like the current 430806001) would need a code change. The `countInAttendance` boolean flag solves this generally.

6. **Reuse `exemptFromAttendance` as the countability toggle.**
   *Rejected*: `exemptFromAttendance` already means "counted as Exempt Present, no scan needed." Overloading it to also mean "excluded from headcount" collapses two independent axes and would flip the semantics for existing exempt employees. New flag `countInAttendance` keeps the axes independent.

7. **Split every sheet by company (Q9 Option C).**
   *Rejected*: `ภาพรวม` is designed as a chronological daily audit — splitting it by company forces the reader to reconstruct the day across four tabs. Split only where aggregation lives (`สรุป`).

---

## References

- Grilling session: 2026-07-06 afternoon
- Related session earlier that morning: [ADR-0001 payroll semantics](0001-payroll-cutoff-semantics.md)
- Glossary: `CONTEXT.md` (Attendance Domain section)
- Bug report that started this ADR: employee `661218001` field-work misclassification on 7 Jul 2569
- Implementation target: v1.4.55
