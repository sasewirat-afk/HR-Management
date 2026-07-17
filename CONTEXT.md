# Payroll Cutoff Domain Glossary

Canonical vocabulary for CROCHET HR Management System. Established in the 6 Jul 2569 grilling session (see `docs/adr/0001-payroll-cutoff-semantics.md`).

---

## Slip Month

A **payslip's identifier**, formatted as `YYYY-MM` (e.g. `"2026-07"`). Represents the calendar month in which the payslip is generated and paid.

**Example**: `"2026-07"` = the payslip paid at the end of July 2026.

**Not to be confused with**:
- **Cutoff Cycle** — different concept, see below

---

## Base Salary

The **flat monthly amount** an employee receives each payslip. Stored per employee as `emp.monthlySalary`. Does not depend on hours worked.

**Period covered**: the entire **calendar month** of the Slip Month (1 - end of month).

**Example**: The July 2026 payslip's base salary compensates the employee for **1-31 July 2026**.

---

## Cutoff Day

The **day-of-month** at which the Adjustment Cycle boundary sits. Stored as `settings.payrollCutoffDay`, default `21`, admin-configurable 1-31.

**Semantic**: events *on or before* Cutoff Day belong to the current cycle. Events *after* Cutoff Day belong to the next cycle.

---

## Cutoff Cycle

The **date range for Adjustments** in a given Slip Month, running from `(Cutoff Day + 1)` of the *previous* calendar month to `Cutoff Day` of the Slip Month's calendar month.

**Example** (Cutoff Day = 21):
- Slip Month `"2026-07"` → Cutoff Cycle = **22 Jun 2026 – 21 Jul 2026**
- Slip Month `"2026-08"` → Cutoff Cycle = **22 Jul 2026 – 21 Aug 2026**

Implemented by `getPayrollMonth(dateStr)`: returns the Slip Month a given date belongs to.

---

## Adjustments

The set of payslip line-items that shift by the Cutoff Cycle (not the calendar month). Includes:

- **OT** (`otRequests` with `date` in cycle)
- **Late deduction** (`attendanceRecords` with `checkIn >= lateThreshold` in cycle)
- **Absent deduction** (`attendanceRecords` with missing `checkIn` in cycle)
- **Unpaid leave deduction** (`leaveRequests` where `type='unpaid'` and `startDate` in cycle)
- **Diligence eligibility check** (uses the same cycle for `hasLeave`, `hasLate`, `hasAbsent`)

**Excluded from Adjustments**:
- **Base Salary** — always calendar month
- **Commissions** — stored per Slip Month manually by Admin
- **Custom Deductions** — same
- **SSO (ประกันสังคม)** — always calendar month (percent of monthly base)

---

## Work Days (Calendar)

The count of **present attendance days** in the **calendar month** of the Slip Month. Displayed on the payslip as "จำนวนวันทำงาน".

**Example**: July 2026 slip shows "22 วันทำงาน" if the employee was present on 22 of the 31 calendar days in July.

**Not used for**: Diligence eligibility check. See Work Days (Cycle) below.

---

## Work Days (Cycle)

The count of **present attendance days** in the **Cutoff Cycle**. Used internally for Diligence eligibility (`workDaysCycle > 0` gate).

Not shown to the user directly. Two variables exist deliberately because their purposes differ.

---

## Diligence Bonus (เบี้ยขยัน)

A flat bonus (`settings.diligenceBonus`, default 500 บาท) awarded if the employee meets **all** of these conditions during the **Cutoff Cycle** (not the calendar month):

- No leave (except `comp-off`)
- No lateness
- No absence
- Work Days (Cycle) > 0

---

## Terminology Not Used

To avoid confusion, we do **not** use these terms:

- **"Payroll Month"** — ambiguous (could mean slip month or cutoff cycle). Use **Slip Month** or **Cutoff Cycle** instead.
- **"Pay Period"** — ambiguous for the same reason. Split into **Base Salary period** (calendar) and **Cutoff Cycle** (adjustments) explicitly.

---

## Terminology in Code

| Concept | Variable / Function |
|---|---|
| Slip Month | `_slipMonth`, `monthStr`, `s.monthStr` |
| Cutoff Day | `settings.payrollCutoffDay` |
| Cutoff Cycle mapping | `getPayrollMonth(dateStr)` returns Slip Month |
| Slip label formatter | `formatSlipMonth(monthStr)` — for payslip display |
| Report label formatter | `formatPayrollCycle(monthStr)` — for reports |
| Work Days (Calendar) | `workDays` in returned slip object |
| Work Days (Cycle) | `_workDaysCycle` — internal only |
| Base Salary period | Implicit — never filtered by date |

---

# Attendance Domain (v1.4.55 additions)

## Attendance Status

The single canonical status assigned to one employee for one calendar day. Exactly one status per employee-day. Computed by walking the **Status Priority Ladder** top-down; the first match wins.

**Values** (11 total):
1. `วันหยุด` — scheduled day off per shift
2. `ลากิจ` — personal leave
3. `ลาป่วย` — sick leave
4. `ลาพักร้อน` — vacation leave
5. `ลาสะสมวันหยุด` — compensatory day off
6. `ลาอื่นๆ` — maternity + ordination + unpaid (grouped per Q6)
7. `ทำงานนอกสถานที่` — approved field work
8. `มาตรงเวลา` — scanned before `workStart` (default 08:45)
9. `มาหลังเวลา` — scanned in `[workStart, lateThreshold)` (default 08:45-09:00)
10. `มาสาย` — scanned at/after `lateThreshold` (default 09:01)
11. `ขาดงาน` — none of the above (fallback)

---

## Status Priority Ladder

The strict resolution order used by `resolveAttendanceStatus(emp, date)`:

```
1. Day Off        (per shift schedule)
2. Leave          (any approved type)
3. Field Work     (approved, protects from Late — Q3 B)
4. Present        (Tigersoft or Time Cert)
    ├─ มาตรงเวลา
    ├─ มาหลังเวลา
    └─ มาสาย
5. Exempt Present (per Exempt Present rule)
6. Absent         (fallback)
```

**Key rule (Q3 B)**: Approved Field Work **overrides** a late scan. A scan at 09:15 with an approved 09:00-11:00 field work resolves to `ทำงานนอกสถานที่`, not `มาสาย`. Rationale: the field work approval represents the company's acknowledgement of legitimate work; the scan time is incidental.

---

## Field Work Present

A virtual `Present` state derived from an approved `fieldWorkRequests` record for the same employee and date. Merged into attendance calculations via `mergeApprovedFieldWorkForMonth(records, monthStr)` — analogous to `mergeApprovedTimeCertForMonth`.

**Scope**: Even a partial-day field work (e.g. 09:00-11:00) counts as a full present day (Q8 A). Rationale: the employee is on approved work; workday attribution should not be reduced for administrative convenience.

**Interaction with Late**: Overrides `มาสาย` per Q3 B — see Status Priority Ladder.

---

## Exempt Present

A virtual `มาตรงเวลา` state for employees flagged `exemptFromAttendance = true`. Applied on days where **all** of these hold:
- The day is **not** a scheduled Day Off (per shift schedule)
- The employee has **no** approved leave for the day

Rationale (Q13 C): exempt employees (e.g. CEO, gardener, maid) work normal working days without scanning. They don't work weekends/holidays unless explicitly scheduled.

Counted in the employee headcount (Q14 B) but never contribute to `lateDeducTotal`.

---

## Attendance Countability

Whether an employee is included in the daily attendance headcount and Present statistics.

Resolution order:
1. If `emp.countInAttendance === false` → **exclude**
2. If `emp.countInAttendance === true` → **include** (override for admins who scan, e.g. 430806001)
3. Else if `emp.role === 'admin'` → **exclude** (Q12 A default)
4. Else → **include**

Compared to `exemptFromAttendance`: that flag governs *how they're counted* (as Exempt Present rather than checking Tigersoft); `countInAttendance` governs *whether they're counted at all*.

---

## Company Sheet Split

Excel attendance export splits the `สรุป` sheet into 5+ sheets:
- `สรุป-ทั้งหมด` — company-agnostic totals (existing behavior kept as first sheet)
- `สรุป-Crochet`, `สรุป-Masterpiece`, `สรุป-ConceptOne`, `สรุป-Habita` — per `emp.company`
- `สรุป-ไม่ระบุบริษัท` — appended only if any employee has empty/undefined company

The `ภาพรวม` sheet is **not** split (Q9 A) — the daily overview stays as one table for cross-company visibility.

---

## Custom Start Time

An optional per-employee working-day start time (`emp.customStartTime`, string `HH:MM`). When present, this employee is on a non-default schedule (e.g. Habita Kitchen at 10:00, Cafe at 14:00). Absent field = employee uses `settings.workStartTime` (default 08:45).

Set via the Employee edit modal by Admin. Not settable in the shift grid — the grid uses `emp.customStartTime` as the base but per-shift override is deferred to a future ADR.

---

## Grace Period

The number of minutes after the working-day start before a scan is considered late. Stored as `settings.defaultGracePeriodMinutes` (default `16`, matching the existing `workStart=08:45 / lateThreshold=09:01` gap).

Company-wide — not per-employee. Change once, applies to all employees who use `customStartTime`. Employees without `customStartTime` continue to use `settings.lateThreshold` directly (backward compat).

---

## Late Threshold

The `HH:MM` at or after which a scan is counted as late. Derived by `getLateThresholdForEmployee(emp, date, settings)` — **3-tier resolution chain** per ADR-0004:

1. **Per-day shift** (`shift[emp, date].type`):
   - Numeric (`'9'`, `'6.5'`) → `HH:MM + defaultGracePeriodMinutes`
   - `'O'` → `null` (day off, no late check)
   - Empty/invalid → fall through to step 2
2. **Employee default** (`emp.customStartTime` from ADR-0003):
   - If set → `customStartTime + defaultGracePeriodMinutes`
3. **Global fallback** (`settings.lateThreshold`, default `'09:01'`)

All late detection (payroll, attendance report, resolveAttendanceStatus) MUST route through this helper. Direct reads of `settings.lateThreshold` from calculation code are a bug — they miss both per-day AND per-employee cases.

---

## Numeric Shift Value (ADR-0004, v1.5.0)

Grid cell stores `shift.type` as a string with three interpretations:

| Value | Meaning | Effect on Late Detection |
|---|---|---|
| `'0'` – `'23'` | Start hour (integer) | Threshold = `HH:00 + grace` |
| `'0.5'` – `'23.5'` | Start half-hour | Threshold = `HH:30 + grace` |
| `'O'` | Day off | No late check (null threshold) |
| `''` (empty) | Unset — fallback to emp/global | See Late Threshold chain |

**Superseded by ADR-0004**: The old `'W'` / `'M'` / `'A'` / `'N'` codes (from pre-v1.5.0) are migrated as:
- `'M'` → `'9'` (default morning 09:00)
- `'A'` → `'13'` (default afternoon 13:00)
- `'N'` → `'22'` (default night 22:00)
- `'W'` → `''` (unset — most flexible fallback)
- `'O'` → `'O'` (unchanged)

Migration is idempotent (guarded by `settings._migrationsRun`) and reversible (original shifts saved to `settings._preMigrationShiftBackup_v1_5_0`).

---

## Grid Cell Display (v1.5.0)

Cell background color reflects the start hour range for pattern-recognition at a glance:

| Hour range | Color |
|---|---|
| 05:00 – 08:59 | Blue (early morning) |
| 09:00 – 12:59 | Green (standard) |
| 13:00 – 16:59 | Orange (afternoon) |
| 17:00 – 20:59 | Purple (evening) |
| 21:00 – 04:59 | Dark purple (night) |
| `'O'` | Gray (day off) |
| Empty | White (unset) |

Cell text = the raw value (`9`, `6.5`, `O`, blank).

---

## Field Work Retroactive Rules

- **Q15 (Reject)**: If a previously-approved field work is rejected after the date has passed, subsequent report renders re-classify the day. If the day already contributed to a saved paySlip, that paySlip is not silently mutated; Admin must regenerate.
- **Q16 (Approve retroactive)**: If a field work is approved after the date, reports auto-update on next render. Saved paySlips require manual regeneration.
