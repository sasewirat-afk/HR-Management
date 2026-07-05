-- ============================================================
-- v1.4.43 RESTORE — File 07: Verification
-- Run this AFTER files 01-06 to verify counts
-- ============================================================

-- Count check per key
SELECT 
  key,
  CASE WHEN jsonb_typeof(value) = 'array' THEN jsonb_array_length(value) ELSE NULL END as array_len,
  octet_length(value::text) as bytes,
  updated_at
FROM hr_data
ORDER BY key;

-- Expected counts:
-- employees: 98 · attendanceRecords: 4417 · shifts: 2381
-- otRequests: 71 · leaveRequests: 10 · compOffRequests: 24
-- deletedEmployeeIds: 6 · auditLog: 462 · accumulatedHolidays: 20
-- paySlips: 8 · timeCertRequests: 2 · fieldWorkRequests: 0

-- Employees with hashed passwords check
SELECT 
  COUNT(*) FILTER (WHERE elem ? 'passwordHash') as hashed,
  COUNT(*) FILTER (WHERE elem ? 'password') as plain,
  COUNT(*) as total
FROM hr_data, jsonb_array_elements(value) elem
WHERE key = 'employees';
-- Expected: hashed=98, plain=0, total=98

-- 670318002 override check
SELECT 
  elem->>'id' as id,
  elem->>'firstName' as first_name,
  elem->>'lastName' as last_name,
  elem->'leaveQuotaOverride' as override
FROM hr_data, jsonb_array_elements(value) elem
WHERE key = 'employees' AND elem->>'id' = '670318002';
-- Expected: 670318002 นุชนาเดีย หวันหยอ {sick: 19}

-- Tombstones check
SELECT jsonb_array_length(value) as tombstone_count
FROM hr_data WHERE key = 'deletedEmployeeIds';
-- Expected: 6

-- Jul 4 attendance check
SELECT COUNT(*) as jul4_count
FROM hr_data, jsonb_array_elements(value) elem
WHERE key = 'attendanceRecords' AND elem->>'date' = '2026-07-04';
-- Expected: 64
