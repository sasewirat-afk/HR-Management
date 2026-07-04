# v1.4.34 Deploy Safety Runbook

## Purpose
Zero-data-loss deployment of v1.4.34 with automated fingerprint verification and clear rollback path.

Given previous OneDrive sync issues in Day 2-3 (file truncation), we validate BOTH data integrity AND code integrity at each step.

---

## Phase 1 — Pre-Deploy Snapshot (5 นาที)

### 1.1 Data Fingerprint (BEFORE any code change is live)
Open production URL → DevTools Console → paste:

```javascript
// v1.4.34 Pre-Deploy Fingerprint — BASELINE
(async () => {
  const emps = JSON.parse(localStorage.hr_employees || '[]');
  const att = JSON.parse(localStorage.hr_attendance || localStorage.hr_attendanceRecords || '[]');
  const leaves = JSON.parse(localStorage.hr_leaveRequests || '[]');
  const settings = JSON.parse(localStorage.hr_settings || '{}');
  const paySlips = JSON.parse(localStorage.hr_paySlips || '[]');
  const commissions = JSON.parse(localStorage.hr_commissions || '[]');

  const shape = {
    empCount: emps.length,
    empActiveCount: emps.filter(e => e.active !== false).length,
    empHashCount: emps.filter(e => e.passwordHash).length,
    empPlainCount: emps.filter(e => e.password).length,
    empWithNickname: emps.filter(e => e.nickname).length,           // v1.4.34 new
    empWithNationality: emps.filter(e => e.nationality).length,    // v1.4.34 new
    attCount: att.length,
    leaveCount: leaves.length,
    paySlipCount: paySlips.length,
    commissionCount: commissions.length,
    hasCustomDeductions: !!localStorage.hr_customDeductions,       // v1.4.34 new
    firstEmpId: emps[0]?.id,
    lastEmpId: emps[emps.length - 1]?.id,
    settingsKeys: Object.keys(settings).length,
    migrationsRun: (settings._migrationsRun || []).join(','),
    appVersion: localStorage.hr__lastVersion || '(none)'
  };

  const data = JSON.stringify(shape);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  const fp = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

  console.log('=== v1.4.34 PRE-DEPLOY FINGERPRINT ===');
  console.log('SHA-256:', fp);
  console.log('Shape:', shape);
  console.log('Timestamp:', new Date().toISOString());

  // Return string to copy
  return JSON.stringify({ fp, shape, timestamp: new Date().toISOString() }, null, 2);
})();
```

Copy the console output → save as `pre_deploy_fingerprint.txt` in this folder.

### 1.2 localStorage Full Backup
Console → paste:

```javascript
// Full localStorage snapshot
const snapshot = {};
Object.keys(localStorage).filter(k => k.startsWith('hr_') || k.startsWith('hr__')).forEach(k => {
  snapshot[k] = localStorage.getItem(k);
});
copy(JSON.stringify(snapshot, null, 2));
console.log('Copied ' + Object.keys(snapshot).length + ' keys to clipboard');
```

Paste into `pre_deploy_localstorage.json` in this folder.

### 1.3 Git Safety Tag (Rollback Anchor)
```powershell
cd "C:\Users\Wirat\OneDrive\Documents\Claude\Projects\HR Management"
git tag v1.4.33-stable
git push origin v1.4.33-stable
```

This tag pins the current stable code so we can rollback in 1 command.

### 1.4 Verify Current Code Deployed Matches Git
```powershell
git log --oneline -1
# Should show: <commit> v1.4.33: ... (Day 4 H1 Option C)
```

---

## Phase 2 — Deploy v1.4.34 (2 นาที)

### 2.1 Push to GitHub
```powershell
cd "C:\Users\Wirat\OneDrive\Documents\Claude\Projects\HR Management"
git add index.html CHANGELOG.md backups/
git commit -m "v1.4.34: nickname + report sheets + payslip adjust (3 features)"
git push origin main
git tag v1.4.34
git push origin v1.4.34
```

### 2.2 Wait for Vercel Deploy
- Watch Vercel dashboard for green "Ready" status (~30-60s)
- URL: https://vercel.com/dashboard

### 2.3 Verify Bundle Integrity (before ANY user hits it)
Open a **private/incognito window** → visit production URL → check Console:
```
CROCHET HR Management System v1.4.34   ← must be v1.4.34
```

If version shows old value → hard refresh (Ctrl+Shift+R). If STILL old → Vercel deploy failed, ROLLBACK IMMEDIATELY.

---

## Phase 3 — Post-Deploy Fingerprint Compare (5 นาที)

### 3.1 Post-Deploy Fingerprint Capture
Same window that just loaded v1.4.34 → Console → paste:

```javascript
// v1.4.34 POST-DEPLOY FINGERPRINT — must match shape (ignoring new fields)
(async () => {
  const emps = JSON.parse(localStorage.hr_employees || '[]');
  const att = JSON.parse(localStorage.hr_attendance || localStorage.hr_attendanceRecords || '[]');
  const leaves = JSON.parse(localStorage.hr_leaveRequests || '[]');
  const settings = JSON.parse(localStorage.hr_settings || '{}');
  const paySlips = JSON.parse(localStorage.hr_paySlips || '[]');
  const commissions = JSON.parse(localStorage.hr_commissions || '[]');

  const shape = {
    empCount: emps.length,
    empActiveCount: emps.filter(e => e.active !== false).length,
    empHashCount: emps.filter(e => e.passwordHash).length,
    empPlainCount: emps.filter(e => e.password).length,
    empWithNickname: emps.filter(e => e.nickname).length,
    empWithNationality: emps.filter(e => e.nationality).length,
    attCount: att.length,
    leaveCount: leaves.length,
    paySlipCount: paySlips.length,
    commissionCount: commissions.length,
    hasCustomDeductions: !!localStorage.hr_customDeductions,
    firstEmpId: emps[0]?.id,
    lastEmpId: emps[emps.length - 1]?.id,
    settingsKeys: Object.keys(settings).length,
    migrationsRun: (settings._migrationsRun || []).join(','),
    appVersion: localStorage.hr__lastVersion || '(none)'
  };

  const data = JSON.stringify(shape);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  const fp = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

  console.log('=== v1.4.34 POST-DEPLOY FINGERPRINT ===');
  console.log('SHA-256:', fp);
  console.log('Shape:', shape);
})();
```

### 3.2 Compare Rules

**MUST MATCH** (core data integrity):
- `empCount` — same number of employees
- `empActiveCount` — same active count
- `empHashCount` + `empPlainCount` — sum must equal empCount
- `attCount` — same attendance records
- `leaveCount` — same leave requests
- `paySlipCount` + `commissionCount` — same

**MAY DIFFER** (expected additions from v1.4.34):
- `empWithNickname` — same as before (no new nicknames added yet) OR unchanged
- `empWithNationality` — same as before OR unchanged
- `hasCustomDeductions` — false (until admin adds one)
- `appVersion` — changes from `1.4.33` → `1.4.34` after first click
- `settingsKeys` — MAY be +3 (new report recipient/sender fields seeded)

**MUST BE:**
- `firstEmpId`, `lastEmpId` — same values (order preserved)

If any MUST MATCH field differs → **ROLLBACK IMMEDIATELY (see Phase 4)**

---

## Phase 4 — Rollback Procedure

Use ONLY if data loss detected in Phase 3 or app broken after deploy.

### 4.1 Code Rollback via Git (fastest, 30 seconds)
```powershell
cd "C:\Users\Wirat\OneDrive\Documents\Claude\Projects\HR Management"

# Revert to stable version
git revert HEAD --no-edit
git push origin main

# OR force back to tag (destructive but faster)
# git reset --hard v1.4.33-stable
# git push --force origin main
```

Vercel auto-redeploys v1.4.33 in ~30 seconds.

### 4.2 Vercel Instant Rollback (alternative, 10 seconds)
1. Vercel Dashboard → hr-management project → Deployments
2. Find previous v1.4.33 deployment → click `...` → **Promote to Production**
3. Instant rollback without git changes (do git revert afterwards for consistency)

### 4.3 Data Rollback via Supabase (only if data actually lost)
1. Supabase Dashboard → Database → Backups → Scheduled backups
2. Find `02 Jul 2026 21:44:12 (+0000) PHYSICAL` — or nearest before v1.4.34 deploy time
3. Click **Restore** → confirm project name
4. Wait 2-5 minutes for restore

⚠️ **WARNING**: Data restore will LOSE all changes between backup time and now (attendance uploads, leave requests, etc). Only do this if data is genuinely corrupted.

### 4.4 localStorage Rollback (per-device, if only some users affected)
User opens Console → paste:
```javascript
// Paste content from pre_deploy_localstorage.json above
const backup = { /* pasted content */ };
Object.keys(backup).forEach(k => localStorage.setItem(k, backup[k]));
location.reload();
```

---

## Phase 5 — Feature Verification Tests

After Phase 3 fingerprint matches, run these:

### Test A: Feature 1 (Nickname)
1. Admin → จัดการพนักงาน → แก้ไข พนักงาน 690309002
2. **Must see**: field `ชื่อเล่น` between name and department
3. Enter test value → Save
4. Reopen → value persists

### Test B: Feature 2 (Excel Report)
1. Attendance report → pick date with leaves + late records
2. Export Excel
3. **Must see**: 6 sheets total including `ลา-สาย` and `สรุปวันทำงาน`
4. Verify letter format matches spec image

### Test C: Feature 3 (Payslip Adjust)
1. Admin → payslip-admin → click **Adjust** on any row
2. Modal opens → add `กยศ` = 500
3. Reopen → row shows Adjust (1)
4. Preview PNG → **Must see**: `กยศ -500 บาท` in DEDUCTIONS
5. Net pay reduced by 500

### Test D: Regression (Verify nothing broke)
- [ ] Login normal user
- [ ] Login admin
- [ ] Submit leave request
- [ ] Approve leave (as admin)
- [ ] Generate payslip
- [ ] Sidebar name displays Thai correctly (no `&lt;` entities)
- [ ] Password change flow (Day 3 H3): requires current password

If ALL tests pass → v1.4.34 STABLE ✅

If ANY test fails → Rollback per Phase 4 → Investigate.

---

## Emergency Contacts / Escalation

- Vercel status: https://www.vercel-status.com
- Supabase status: https://status.supabase.com
- GitHub status: https://www.githubstatus.com

## Post-Deploy Cleanup

After 24 hours of stable v1.4.34:
- Delete `v1.4.33-stable` tag (safety anchor no longer needed)
- Keep `v1.4.33` tag for permanent history
