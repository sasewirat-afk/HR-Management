# v1.4.43 Emergency Restore Checklist

## Source
- Backup: pre-deploy v1.4.41_localStorage_2026-07-04T08:20:46Z.json
- Timestamp: 2026-07-04 08:20 UTC (July 4 15:20 Thai time)
- Version at backup: 1.4.40

## Data being restored (counts)
- Employees: 98 (all hashed passwords)
- Leave overrides: 44 employees
- Attendance: 4417 records
- Jul 4 attendance: 64 records
- Leave requests: 10
- OT requests: 71
- Comp-off requests: (check)
- Shifts: 2381
- Tombstones: 6

## Restore steps

### Phase 1: Restore Cloud (Supabase)
1. Open Supabase Dashboard → SQL Editor → New query
2. Paste content of 
3. Read carefully — script does NOT auto-commit
4. Run script → check verification output
5. If counts look right → uncomment  → run again
6. If wrong → uncomment  → nothing changes

### Phase 2: Restore Desktop localStorage
Both Admin device AND 430806001 device:
1. Open production URL → Console (F12)
2. Paste content of 
3. Run
4. See "Emps: 98, Attendance: 4417" in log
5. 
6. Verify version, then verify data intact

### Phase 3: Restore Mobile
Mobile users don't need localStorage restore — they just need cloud pull:
1. Hard reload production URL
2. localStorage will be updated from restored cloud
3. Verify data

### Phase 4: Fingerprint verify
Run fingerprint script (from before) on Admin desktop
Compare with pre-Deploy v1.4.41_fingerprint_2026-07-04T08-21-13-740Z.json
Must match: passwords (all hashed), leave overrides, tombstones

## What is NOT restored (accepted loss)
- v1.4.42 personal=0 test on 670318002 (was TEST data)
- Any data changes between 08:20 UTC July 4 and now (unless in cloud already)

## After Successful Restore
1. Do NOT deploy anything yet
2. Wait for v1.4.44 with proper safeguards
3. v1.4.44 will:
   - Prevent seedData from running if cloud has data
   - Fix migrateEmployeeUpdatedAt to not overwrite cloud with baseline timestamp
   - Add employees array push guard
