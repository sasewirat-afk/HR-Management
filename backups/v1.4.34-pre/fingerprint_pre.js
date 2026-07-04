// ============================================================
// v1.4.34 PRE-DEPLOY FINGERPRINT SCRIPT
// Copy-paste into Production Console BEFORE git push
// Save output as pre_deploy_fingerprint.txt
// ============================================================
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
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(shape)));
  const fp = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  console.log('=== v1.4.34 PRE-DEPLOY FINGERPRINT ===');
  console.log('SHA-256:', fp);
  console.log('Shape:', shape);
  console.log('Time:', new Date().toISOString());
  console.log('\n--- COPY BELOW AND SAVE TO pre_deploy_fingerprint.txt ---\n');
  console.log(JSON.stringify({ fp, shape, timestamp: new Date().toISOString() }, null, 2));
})();
