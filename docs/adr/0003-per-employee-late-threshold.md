# ADR-0003: Per-Employee Late Threshold

**Status**: Accepted
**Date**: 2026-07-08 (evening)
**Session**: Grill-me — shift schedule UX (Q2 series)

---

## Context

The company employs staff with genuinely different working schedules — for example บอย (Habita Kitchen) starts at 10:00, while ก้อย (Marketing) starts at 14:00. The system currently applies a single company-wide `lateThreshold` (09:01) to everyone, which means anyone starting after 09:00 is permanently marked late — under-paying them despite legitimate schedules.

Two workarounds have been attempted:
1. Set `otMultiplierHoliday = 1.5` (v1.4.60 workaround) — masks the OT-side of the problem but not late detection.
2. Manually treat some employees as `exemptFromAttendance` (v1.4.55) — removes them from late tracking entirely, losing all visibility.

Neither is right. We need actual per-employee schedule support.

The grill session on 8 Jul afternoon (Q2.1/Q2.2/Q3.1) landed on:
- **Q2.1 A**: One default start time per employee (rare per-shift override deferred to future)
- **Q2.2 C**: Set the default in the Employee edit modal (not in the shift grid)
- **Q3.1 A**: Grace period is a single global setting (start with 16 minutes = current 08:45 → 09:01 offset)

---

## Decision

Add two optional data fields and one derivation helper:

### Data
- `employee.customStartTime` — optional string in `HH:MM` format. When present, this employee's working day starts at that time and their late threshold shifts accordingly. When absent, the employee uses `settings.workStartTime`.
- `settings.defaultGracePeriodMinutes` — number (default 16). The grace period added to `customStartTime` to derive the late threshold. Chosen as 16 because the existing `workStart=08:45 / lateThreshold=09:01` gap is 16 minutes — this preserves current behavior exactly.

### Derivation
Introduce `getLateThresholdForEmployee(emp, settings)`:
```
if emp.customStartTime is set:
    return addMinutes(emp.customStartTime, settings.defaultGracePeriodMinutes)
else:
    return settings.lateThreshold  // existing behavior
```

### Consumers
Update two places to call the derivation helper instead of reading `settings.lateThreshold` directly:
- `calculatePaySlip` — used to compute `lateRecords` and `totalLateMinutes` (payroll math)
- `resolveAttendanceStatus` (ADR-0002) — used to bucket a scan as `มาตรงเวลา` / `มาหลังเวลา` / `มาสาย`

### Migration
`migrateGracePeriod_v1_4_65()` — idempotent (guarded by `settings._migrationsRun`), adds `defaultGracePeriodMinutes: 16` to settings if missing. Does not touch existing `workStart` / `lateThreshold`. Does not touch any employee record — `customStartTime` is opt-in per-employee via the edit modal.

### UI
- Employee edit modal: add "เวลาเริ่มงาน (custom)" input (optional, defaults to global)
- Settings page: add "ระยะเวลาผ่อนผัน (นาที)" input, exposed alongside existing late/OT settings

---

## Consequences

### Positive
- Employees with legitimate late-start schedules stop being penalised — payroll becomes correct.
- The one-field addition (`customStartTime`) lets Admin opt in per employee without a bulk migration.
- Existing employees (no `customStartTime`) get identical calculations as before — zero regression risk on the ~131 people currently in the system.
- Grace period is now explicit and configurable, replacing the implicit `lateThreshold - workStart` offset.

### Negative
- Two "start times" now exist per employee (global default + per-emp override) — Admin must remember which one is active when troubleshooting a late claim. Mitigate with clear label in the payslip and attendance detail views.
- The grace period `defaultGracePeriodMinutes` is company-wide, not per-employee. Some late-start employees may want tighter or looser grace than others. Q3.1 A explicitly deferred this — revisit if it becomes a real complaint.
- The `settings.lateThreshold` field remains as the fallback for employees without `customStartTime`. This is intentional (backward compat) but means the system now has two ways to express "late for a 08:45 start" — `lateThreshold: '09:01'` OR `customStartTime: '08:45' + grace: 16`. Guidance: only use `customStartTime` for non-default schedules.

### Neutral
- No employees currently have `customStartTime` set → zero calculation change on deploy. First real effect happens when Admin opens an employee's edit form and enters a time.
- Rollback (Vercel promote v1.4.64) leaves `defaultGracePeriodMinutes` in settings as a harmless orphan field. Any `customStartTime` values also become orphans — the old code will ignore them and revert to `settings.lateThreshold`.

---

## Alternatives Considered

1. **Per-shift `startTime` on each shift record (Q2.1 B pure)**  
   *Rejected*: hugely more complex — every shift row needs a time, the grid cell needs a time picker per click, and calculation code has to look up shift-by-date instead of employee-by-date. Real usage doesn't need this; almost every affected employee has a fixed schedule.

2. **Shift-code presets (`M10`, `M14`, `M17`) — Q2.1 C**  
   *Rejected*: proliferates the SHIFT_TYPES vocabulary and still leaves the derivation ambiguous. Doesn't scale beyond a handful of preset times.

3. **Per-employee grace period (`emp.gracePeriodMinutes`)**  
   *Rejected for now* (Q3.1 A chose fixed): adds a second axis of complexity for a feature nobody has asked for. Can be added later without breaking this ADR.

4. **Compute `lateThreshold` inline every time (no helper)**  
   *Rejected*: repeated logic is a bug factory. A single helper `getLateThresholdForEmployee` centralises the rule.

---

## References

- Grill session: 2026-07-08 evening
- Related ADRs: [ADR-0001 payroll cutoff](0001-payroll-cutoff-semantics.md), [ADR-0002 attendance status](0002-attendance-status-resolution.md)
- Glossary: `CONTEXT.md` (Attendance Domain — new terms Custom Start Time, Grace Period, Late Threshold)
- Implementation target: v1.4.65
- Related version notes: v1.4.60 hardcoded ×3 fix (band-aid for OT side of this issue)
