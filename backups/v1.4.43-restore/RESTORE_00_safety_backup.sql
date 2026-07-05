-- ============================================================
-- v1.4.43 RESTORE — File 00: Safety Backup Current State
-- Run this FIRST. Creates hr_data_before_restore_20260705 table
-- as safety net. Then run Files 01-07 in order.
-- ============================================================

-- Drop old safety backup if exists (in case of rerun)
DROP TABLE IF EXISTS hr_data_before_restore_20260705;

-- Create safety backup of current cloud state
CREATE TABLE hr_data_before_restore_20260705 AS SELECT * FROM hr_data;

-- Verify safety backup
SELECT COUNT(*) as backup_row_count FROM hr_data_before_restore_20260705;
