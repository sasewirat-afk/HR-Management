-- ============================================================
-- v1.4.43 RESTORE — File 05b.1 of 4: leaveRequests chunk 1
-- Init empty + first 3 records
-- ============================================================
INSERT INTO hr_data (key, value, updated_at) VALUES ('leaveRequests', '[]'::jsonb, NOW())
  ON CONFLICT (key) DO UPDATE SET value = '[]'::jsonb, updated_at = NOW();

-- Chunk 1/4: 3 records
UPDATE hr_data SET value = value || '[{"id": "LR_1782812812139_229", "days": 2, "type": "comp-off", "reason": "สลับวันหยุดมาจากวันที่ 21,28/6/69 (2วัน)", "status": "approved", "endDate": "2026-07-02", "halfDay": null, "managerId": "660101001", "startDate": "2026-07-01", "approvedBy": null, "attachment": null, "employeeId": "690615001", "requestDate": "2026-06-30", "unpaidHours": 0, "approvedDate": "2026-06-30", "approverNote": "", "attachmentName": null}, {"id": "LR_1782847813813_477", "days": 1, "type": "sick-without-cert", "reason": "ปวดท้องประจำเดือน", "status": "approved", "endDate": "2026-07-01", "halfDay": null, "managerId": "540501001", "startDate": "2026-07-01", "approvedBy": null, "attachment": null, "employeeId": "650601001", "requestDate": "2026-06-30", "unpaidHours": 0, "approvedDate": "2026-07-02", "approverNote": "", "attachmentName": null}, {"id": "LR_1782971387730_534", "days": 1, "type": "vacation", "reason": "​AL 1/69", "status": "approved", "endDate": "2026-07-05", "halfDay": null, "managerId": "690615001", "startDate": "2026-07-05", "approvedBy": null, "attachment": null, "employeeId": "670912001", "requestDate": "2026-07-02", "unpaidHours": 0, "approvedDate": "2026-07-02", "approverNote": "", "attachmentName": null}]'::jsonb, updated_at = NOW() WHERE key = 'leaveRequests';
