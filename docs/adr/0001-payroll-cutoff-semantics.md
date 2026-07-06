# ADR-001: Payroll Cutoff Semantics

**Status**: Accepted  
**Date**: 2026-07-06  
**Session**: Grill-with-docs — reviewing payroll cutoff misunderstanding after v1.4.48-v1.4.53 rollout

---

## Context

The company's payroll policy has two different date-scoping rules that we conflated in v1.4.48-v1.4.53:

1. **Base salary** is paid for the entire **calendar month** (1st to end of month).
2. **Adjustments** (OT, late, absent, unpaid leave, diligence bonus eligibility) are scoped to a **Cutoff Cycle** running from day `(cutoffDay + 1)` of the previous calendar month to day `cutoffDay` of the current calendar month. Default cutoff day = 21.

Concretely: **the July 2026 payslip pays the salary for 1–31 July but the OT/late/absent adjustments cover 22 June – 21 July**.

In the initial rollout we assumed the entire payslip period was the Cutoff Cycle, so the payslip PDF displayed `งวด: รอบ ก.ค. 2569 (22 มิ.ย. - 21 ก.ค. 2569)` — misleading because base salary is not scoped that way. The **calculation logic was correct**; only labels and `workDays` semantics were wrong.

We audited each affected field and made explicit decisions per field.

---

## Decision

**Two independent date scopes** coexist inside `calculatePaySlip`:

| Field | Scope | Reason |
|---|---|---|
| `baseSalary` | Calendar (implicit — flat amount) | Company policy: salary is per calendar month |
| `workDays` (displayed) | **Calendar** | Q4: label matches base salary period |
| `workDaysCycle` (internal, for diligence gate) | Cutoff Cycle | Q4.2: consistency with other adjustments |
| `otHours`, `otPay` | Cutoff Cycle | Company policy |
| `lateDays`, `lateDeducTotal` | Cutoff Cycle | Company policy |
| `unpaidDaysThisMonth`, `unpaidDeduction` | Cutoff Cycle | Company policy |
| `hasLeaveThisMonth`, `hasLateThisMonth`, `hasAbsentThisMonth` (diligence) | Cutoff Cycle | Company policy |
| `commissions` (manual entry) | Slip Month key | Admin-entered per slip, no date filter |
| `sso` | Calendar (percent of monthly base) | Legal formula |

**Labels**:
- **Payslip PDF, custom deductions modal, employee mySlips list**: `กรกฎาคม 2569 (OT/ลา/มาสาย: 22 มิ.ย. - 21 ก.ค. 2569)` — via new helper `formatSlipMonth()`.
- **Reports (OT report, Late report)**: `รอบเงินเดือน ก.ค. 2569 (adjustments: 22 มิ.ย. - 21 ก.ค. 2569)` — via renamed helper `formatPayrollCycle()`.

**`_slipMonth` default**: New setting `slipMonthDefault: 'calendar' | 'payroll'`, default `'calendar'`. On first render of `renderPaySlipAdmin`, resolve default via the setting.

**The Q4.1 Paradox is Accepted**: the same date (e.g. 25 Jul) can count as a work day in the July slip's display *and* as a late event in the August slip's late count. This is fine because the two counts answer different business questions.

---

## Consequences

### Positive
- Labels no longer mislead users.
- `workDays` on the slip reads intuitively (matches the calendar month name).
- Diligence rule stays consistent with the other Cutoff Cycle adjustments.
- Admins can toggle `_slipMonth` default behavior without a code change.

### Negative
- `calculatePaySlip` now computes attendance **twice** (calendar filter and cutoff filter) — small performance cost, mitigated by v1.4.49 DB.load cache.
- Two `workDays` variables exist internally. Anyone touching this function must know which one to use. Mitigated by keeping only `workDays` in the returned object and naming the internal one `_workDaysCycle`.
- The Q4.1 paradox must be documented for admins so a late day on 25 Jul doesn't appear "missing" when reviewing the July slip.

### Neutral
- No data migration. Records still store raw calendar dates. Only calculation grouping and display change.
- Rollback via `payrollCutoffDay = 31` still works — the extra fields degrade gracefully.

---

## Alternatives Considered

1. **Q1 Option A** — `งวด: กรกฎาคม 2569` only, no cycle disclosure.  
   *Rejected*: readers of the printed payslip need to know which cycle the OT/late totals refer to; a bare month name hides that.

2. **Q4 Option A** — `workDays` scoped to the Cutoff Cycle (matches v1.4.52 behavior).  
   *Rejected*: users kept asking "why is workDays = 9 when July has 22 workdays?" because the label above said "งวด: กรกฎาคม". Aligning `workDays` display to the calendar removes that friction.

3. **Q4.2 Option A** — diligence gate reads calendar `workDays > 0`.  
   *Rejected*: an employee who took unpaid leave for the entire cycle (22 Jun – 21 Jul) but showed up once on 25 Jul would still qualify for diligence — that violates the intent of the bonus.

4. **Q2 Option B** — `_slipMonth` defaults to `getPayrollMonth(today())` (v1.4.52 behavior).  
   *Rejected*: on 22 Jul the default jumps to August, but the admin is still working on the July slip. Calendar month is the least surprising default.

---

## References

- Grilling session: 2026-07-06 morning
- Related versions: v1.4.48 (initial rollout), v1.4.51 (reports), v1.4.52 (payslip calc), v1.4.53 (labels attempt), **v1.4.54** (this correction)
- Glossary: `CONTEXT.md`
