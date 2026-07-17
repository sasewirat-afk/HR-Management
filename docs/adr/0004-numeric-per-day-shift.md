# ADR-0004: Numeric Per-Day Shift + Revised Late Threshold Resolution

**Status**: Accepted
**Date**: 2026-07-16 (evening grill session)
**Session**: Grill Q1-Q11 (11 rounds, ~90 min)
**Supersedes**: ADR-0003 partially (per-employee `customStartTime` demoted to fallback role)

---

## Context

ADR-0003 (v1.4.65) introduced `emp.customStartTime` — one default start time per employee. This solved the case where an employee's schedule is fixed (e.g., บอย always starts at 10:00) but broke down when the reality is per-day varying schedules.

Real usage across three departments (grill session 16 ก.ค.) revealed:
- **Habita Kitchen** (บอย, ภูเขา, เจี๊ยบ, เชน): 06:00-19:00, 10:00-19:00, 06:00-15:00, 08:00-19:00 — different times within the same week
- **Habita Front Office** (Max, Jaa, Jan, Peach, Sol, Baw): 7 shift codes (6/7/9/10/12/13/21) with pattern rotations
- **Salon (ß)**: 3 codes (7/9/10) with special modifiers (7/, 10/) for split shifts

**Grill Q1 confirmed root pain = B (per-day variance) + C (late detection accuracy)**. The v1.4.65 `emp.customStartTime` mechanism cannot express this — under-payment continues.

**Initial proposal** (Q2-Q5) was a Shift Library with codes (`10 = 10:00-19:00`), scoped per-company with department tags. **User rejected this** in favor of a radically simpler design: **type the start hour directly as a number** in the grid cell — no library, no setup, no codes.

The user's key insight: end time is not needed in the shift record. OT is a separate request flow (otRequests table), and work-day counts are derived from Tigersoft scan resolution (ADR-0002). Only **start time** matters for late detection.

---

## Decision

### Data Model

Grid cell stores a **single value** in `shift.type` with three possible interpretations:

| Value | Meaning | Late Threshold |
|---|---|---|
| `"9"`, `"6"`, `"10"`, `"13"`, `"21"` | Start hour (integer 0-23) | `HH:00 + gracePeriodMinutes` |
| `"9.5"`, `"6.5"`, `"14.5"` | Start half-hour (integer + .5) | `HH:30 + gracePeriodMinutes` |
| `"O"` | Day off | `null` (no late check) |
| `""` (empty) | Unset — fallback to emp default | see resolution chain |

Schema unchanged from v1.4.68 — only the **semantic** of `shift.type` changes.

### Late Threshold Resolution (Q4 D)

Update `getLateThresholdForEmployee(emp, date, settings)`:

```
1. Try shift[emp, date]:
   - If type is 'O' → return null (no late check)
   - If type is numeric (0-23, .5 variants) → return HH:MM + graceMinutes
   - If type is empty or invalid → fall through to step 2

2. Try emp.customStartTime (from v1.4.65):
   - If set → return customStartTime + graceMinutes

3. Fallback: settings.lateThreshold (default '09:01')
```

All consumers of `settings.lateThreshold` must route through this helper.

### Grid Input UX (Q7 A)

Excel-like inline editing: click cell → cell becomes `<input>` → type value → Enter to save + advance to next row (Tab = advance to next column).

Validation rules (Q11.2):
- Accept: integers 0-23, `.5` variants, `O`/`o`, empty, `9:30`-style (auto-normalize)
- Reject: 24+, negatives, non-numeric, ranges, `.7` (non-half increments)

Cell display (Q11.1 C): color-coded background by hour range:
- Blue (05-08), Green (09-12), Orange (13-16), Purple (17-20), Dark purple (21-04), Gray (O), White (empty)

### Bulk Edit Adaptation (Q9.1 A)

Preserve all v1.4.63/64 bulk features, adapt to numeric input:
- **Column header click** → prompt "ทั้งทีมวันที่นี้เข้ากี่โมง?" → text input → apply to all team
- **Row header click** → prompt "คนนี้ทั้งเดือนเข้ากี่โมง?" → text input → apply to all dates
- **Weekend button** → still sets `O` for Sat/Sun
- **"Set W" button** → REMOVED (no `W` in numeric model)

### Grid Row Visibility (Q9.2 B)

Employees with `countInAttendance === false` (e.g., ADMIN001) are **hidden** from the shift grid — they don't scan Tigersoft and don't need shift entries.

### Migration (Q6 Case 5 A)

`migrateShiftsToNumeric_v1_5_0()`:

```
Guard: if settings._migrationsRun.includes('v1.5.0-numeric-shift') return

Backup: settings._preMigrationShiftBackup_v1_5_0 = deep copy of current shifts

Convert:
  for each shift in DB.shifts:
    switch shift.type:
      case 'M': shift.type = '9'   (default 09:00)
      case 'A': shift.type = '13'  (default 13:00)
      case 'N': shift.type = '22'  (default 22:00)
      case 'W': shift.type = ''    (unset — fallback to emp default)
      case 'O': shift.type = 'O'   (unchanged)
      default:  shift.type unchanged (defensive)

Save: DB.save('shifts', migrated)
Mark: settings._migrationsRun.push('v1.5.0-numeric-shift')
```

**Idempotent** (guarded), **reversible** (backup preserved), **defensive** (unknown values untouched).

---

## Consequences

### Positive

- **Solves pain B + C completely** — per-day varying shifts + accurate late detection.
- **Zero setup** — no library, no codes, no configuration. Admin can start typing immediately.
- **Data model minimal** — same schema, just changed interpretation of `shift.type` string.
- **Backward compat with v1.4.65** — `emp.customStartTime` becomes fallback (still works for employees without per-day shifts).
- **Rollback safe** — original shifts backed up before migration; Vercel promote to v1.4.68 + restore backup = full recovery.
- **Excel round-trip natural** — numeric cells map cleanly to Excel `Number` type (v1.5.1 Import/Export).

### Negative

- **Migration one-way in practice** — reverting v1.4.68 semantics requires manual restore of `_preMigrationShiftBackup_v1_5_0`. UI-driven rollback not offered.
- **Legend/help text rewrite** — old "M A N O" legend becomes "0-23, .5, O, empty". Admin retraining needed (1-page cheatsheet).
- **Import/Export deferred to v1.5.1** — bulk workflow via Excel not available on day 1. Admin must use inline typing for first month.
- **`shift.type` string is now overloaded** — represents time-of-day OR status ('O') OR unset (''). A `shift.startHour: number | null` + `shift.status: 'scheduled'|'day-off'|'unset'` would be cleaner but requires schema migration.

### Neutral

- OT flow, leave request flow, holiday settings, field work request, payroll calculation core — all unchanged.
- ADR-0003 `emp.customStartTime` retained as fallback layer. v1.4.65 UI (Employee edit modal) still functional.
- Grid rendering rewrite required (inline input instead of picker modal) — moderate effort, isolated to shift schedule view.

---

## Alternatives Considered

### 1. Shift Library with codes (Q2 C, Q3 B+) — INITIAL PROPOSAL

Per-company library of shift codes (`10 = 10:00-19:00`) with optional department tags. Grid cell = reference to library code.

*Rejected*: User pointed out that if the value entered is the start hour itself, no library is needed. Setup overhead + code proliferation eliminated.

### 2. Grid absorbs all states (Q5 B)

Admin marks sick/vacation/LWOP directly in grid, bypassing leaveRequests approval flow.

*Rejected in Q5*: Breaks payroll integrity (leave deduction, medical cert workflow v1.4.50, diligence bonus calculation all depend on leaveRequests).

### 3. Free-form time input per cell (Q2 A)

Each cell accepts start + end + break in one text field ("06:00-19:00 60min").

*Rejected in Q2*: Too much typing per cell, easy typos, no consistency.

### 4. All-in-one v1.5.0 with Import/Export before payroll cutoff (Q10 A)

Ship everything in one release before 21 ก.ค.

*Rejected in Q10*: Risk too high for payroll-critical release. Phased split (Q10 B) chosen for safer rollout.

### 5. Delay entirely to after 21 ก.ค. cutoff (Q10 C)

Use v1.4.68 for July payroll, deploy v1.5.0 in August.

*Rejected in Q10*: Pain B (per-day variance) unsolved for July — kitchen/front office continue to be under-paid.

---

## Interaction with Existing ADRs

### ADR-0001 (Payroll Cutoff Semantics)
No change. Base salary still calendar month, adjustments still cutoff cycle. Late detection is one component of the adjustments (late deduction).

### ADR-0002 (Attendance Status Resolution)
`workStart` and `lateThreshold` derivation now routed through `getLateThresholdForEmployee(emp, date, settings)`. Status Priority Ladder unchanged.

### ADR-0003 (Per-Employee Late Threshold)
`emp.customStartTime` demoted to **fallback layer 2** in the resolution chain. Retained for backward compat and for employees without per-day shift assignments.

---

## Test Cases (per Q11.3)

| # | shift.type | emp.customStartTime | Expected Late Threshold |
|---|---|---|---|
| A | `"9"` | `null` | `"09:16"` |
| B | `"6.5"` | `null` | `"06:46"` |
| C | `"O"` | `null` | `null` (no late check — day off) |
| D | `""` | `"10:00"` | `"10:16"` (fallback to emp default) |
| E | `""` | `null` | `"09:01"` (global fallback) |
| F | `"10"` | `"14:00"` | `"10:16"` (shift wins over emp default) |
| G | (shift record not found) | `"10:00"` | `"10:16"` (same as case D) |

Grace period = `settings.defaultGracePeriodMinutes` = 16 (v1.4.65 default).

---

## Rollback Plan

Level 1 — Immediate: `vercel promote v1.4.68` (~10 sec). Old code reads new `type` values as unknown strings, falls back to `settings.lateThreshold`. **Payroll math will be wrong** for July cycle, but no data loss.

Level 2 — Data restore: If Level 1 payroll math is unacceptable, run in console:
```javascript
const backup = DB.load('settings')._preMigrationShiftBackup_v1_5_0;
if (backup) { DB.save('shifts', backup); location.reload(); }
```
Restores M/A/N/W/O semantics fully.

Level 3 — Full revert: Reset `settings._migrationsRun` to remove `'v1.5.0-numeric-shift'` marker. Re-migration allowed after code fix.

---

## References

- Grill session transcript: 2026-07-16 evening (Q1 through Q11)
- Related ADRs: [ADR-0001](0001-payroll-cutoff-semantics.md), [ADR-0002](0002-attendance-status-resolution.md), [ADR-0003](0003-per-employee-late-threshold.md)
- Glossary: `CONTEXT.md` (Shift Domain — updated Numeric Shift Value, Late Threshold Resolution v2)
- Implementation targets: v1.5.0 core (deploy 20 ก.ค.), v1.5.1 Import/Export (after 21 ก.ค.)
- Payroll cutoff deadline: **21 ก.ค. 2569**
