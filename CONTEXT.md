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
