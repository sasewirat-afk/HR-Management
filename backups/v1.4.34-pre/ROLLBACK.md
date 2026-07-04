# v1.4.34 EMERGENCY ROLLBACK PROCEDURES

Read this ONLY if v1.4.34 broke something. Otherwise ignore.

## Decision Tree

```
Problem after v1.4.34 deploy?
├─ App won't load (white screen, JS error)
│   └─ Phase A — Code rollback via Vercel (fastest)
├─ App loads but data is wrong (fingerprint mismatch)
│   ├─ ...on 1 device only
│   │   └─ Phase B — localStorage restore per-device
│   └─ ...on all devices
│       └─ Phase C — Supabase point-in-time restore (nuclear)
├─ App loads but a feature is broken
│   ├─ Feature 1 (nickname) → non-critical, skip rollback
│   ├─ Feature 2 (Excel) → non-critical, skip rollback
│   └─ Feature 3 (payslip adjust) → users see wrong netPay → ROLLBACK
└─ Login works but some users lost password
    └─ Emergency: Admin reset via Console
```

---

## Phase A — Vercel Instant Rollback (10 seconds)

**Use when**: App broken, users can't work.

1. Open https://vercel.com/dashboard
2. Select `hr-management` project
3. Click **Deployments** tab
4. Find the last v1.4.33 deployment (before v1.4.34)
5. Click `...` menu → **Promote to Production**
6. Verify with hard reload — Console should show `v1.4.33`

Then commit the git revert for consistency:
```powershell
cd "C:\Users\Wirat\OneDrive\Documents\Claude\Projects\HR Management"
git revert HEAD --no-edit
git push origin main
```

---

## Phase B — Per-Device localStorage Restore

**Use when**: Only some devices affected (rare).

Ask affected user to:
1. Open production URL → DevTools Console
2. Paste content of `pre_deploy_localstorage.json`:
```javascript
const backup = { /* PASTE JSON CONTENT FROM BACKUP FILE */ };
Object.keys(backup).forEach(k => localStorage.setItem(k, backup[k]));
console.log('Restored', Object.keys(backup).length, 'keys');
location.reload();
```

---

## Phase C — Supabase Point-in-Time Restore (NUCLEAR)

**Use ONLY when**: Cloud data confirmed corrupted (fingerprint drift matches on multiple fresh browsers).

⚠️ **WARNING**: Restoring cloud DB loses all data changes between backup time and now (leave requests, attendance uploads, everything).

1. Supabase Dashboard → `crochet-hr` project
2. Left menu → **Database** → **Backups**
3. Find backup **immediately before** v1.4.34 deploy time
   - Look at `pre_deploy_fingerprint.txt` for timestamp
   - Choose backup ≤ that time
4. Click **Restore** on that row
5. Confirm project name: `crochet-hr`
6. Wait 2-5 minutes for restore
7. Have ALL users refresh browsers to pull restored data

After restore, notify users:
> ระบบ HR ถูก restore ถึงเวลา [X:XX น.] — กรุณาลาซ้ำหากคำขอลาถูก submit หลังเวลานี้

---

## Phase D — Emergency Admin Password Reset (single user)

**Use when**: Specific user lost password ability due to migration issue.

Admin Console:
```javascript
(async () => {
  const emps = DB.load('employees');
  const target = emps.find(e => e.id === 'TARGET_ID');
  if (!target) { console.error('Not found'); return; }
  const newPass = 'temp1234';  // change this
  target.passwordHash = await hashPassword(newPass);
  delete target.password;
  target.forceChangePassword = true;
  target._updatedAt = new Date().toISOString();
  DB.save('employees', emps);
  console.log(`Reset ${target.firstName} → password: ${newPass}`);
})();
```

---

## Recovery Time Objectives

| Scenario | RTO | RPO |
|---|---|---|
| Vercel rollback | 10 seconds | 0 (code only) |
| Git revert + redeploy | 60 seconds | 0 (code only) |
| localStorage restore (per device) | 30 seconds | Since pre-deploy snapshot |
| Supabase full restore | 2-5 minutes | Since last automated backup (max 24h) |

## After Rollback

1. Post to team channel: `v1.4.34 rolled back at [time] — reason: [X]`
2. Root-cause analysis in `backups/v1.4.34-pre/rollback_incident.md`
3. Fix + patch bump to v1.4.35
4. Test in incognito FIRST before next deploy
