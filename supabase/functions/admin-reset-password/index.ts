// ============================================================
// admin-reset-password — ให้แอดมินตั้งรหัสผ่านบัญชี Auth ของพนักงานได้
// ============================================================
// ทำไมต้องมี: เบราว์เซอร์เปลี่ยนรหัสของ "บัญชีคนอื่น" ไม่ได้เลย
//   · supa.auth.updateUser() แก้ได้เฉพาะบัญชีที่กำลังล็อกอินอยู่
//   · auth.admin.updateUserById() ต้องใช้ service_role ซึ่งห้ามอยู่ในหน้าเว็บ
// ที่ผ่านมาแอปจึงใช้ signUp() ซึ่งได้ผลเฉพาะบัญชีที่ "ยังไม่มี" เท่านั้น
// พอพนักงานมีบัญชีแล้วลืมรหัส แอดมินต้องเข้าไปลบบัญชีใน Supabase Dashboard
// ก่อนทุกครั้ง — ฟังก์ชันนี้ตัดขั้นตอนนั้นทิ้ง
//
// ความปลอดภัย:
//   1. ต้องแนบ JWT ของคนที่ล็อกอินอยู่ (Supabase ตรวจให้ชั้นหนึ่งถ้าเปิด verify_jwt)
//   2. ฟังก์ชันตรวจซ้ำเองว่าคนเรียกเป็น role = admin และ active ในรายชื่อพนักงาน
//   3. เป้าหมายต้องเป็นรหัสพนักงานที่มีจริงและยัง active — สร้างบัญชีมั่วไม่ได้
//   4. รับเฉพาะรหัสผ่านที่ผ่านสูตร deriveAuthPassword มาแล้ว (hex 64 ตัว)
//      รหัสจริงของพนักงานจึงไม่เคยออกจากเบราว์เซอร์
//   5. service_role key อ่านจาก env ของ Edge Function ไม่เคยอยู่ในหน้าเว็บ
//
// ⚠ ต้องปิด "Verify JWT" ของฟังก์ชันนี้ใน Supabase (หรือ deploy ด้วย --no-verify-jwt)
//   เบราว์เซอร์ยิง OPTIONS ถามสิทธิ์ก่อนเสมอ และคำขอนั้นไม่มี Authorization header
//   ตามมาตรฐาน CORS ถ้าเปิด Verify JWT ไว้ แพลตฟอร์มจะปฏิเสธ preflight ตั้งแต่ก่อนถึง
//   โค้ดนี้ คำขอจริงจึงไม่เคยถูกส่ง (เจอ 19 ต.ค. 2569: "preflight doesn't pass
//   access control check")
//   ปิดแล้วไม่ได้หละหลวมลง เพราะชั้นที่ 1-2 ข้างบนตรวจ token และสิทธิ์แอดมินเองอยู่แล้ว
//
// ติดตั้ง: ดู supabase/functions/README.md
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AUTH_DOMAIN = 'hr.crochet.local';

// เรียกจากหน้าเว็บ e-HR เท่านั้น ตั้งเป็น * เพราะโดเมนมีทั้ง vercel preview และ production
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// อ่านรายชื่อพนักงานจาก hr_data — service_role ข้าม RLS จึงอ่านได้เสมอ
// deno-lint-ignore no-explicit-any
async function findEmployee(admin: any, empId: string) {
  const { data, error } = await admin.from('hr_data').select('value').eq('key', 'employees').maybeSingle();
  if (error) throw new Error('อ่านรายชื่อพนักงานไม่ได้: ' + error.message);
  const raw = (data as { value?: unknown } | null)?.value;
  const list = Array.isArray(raw) ? raw as Record<string, unknown>[] : [];
  return list.find((e) => String(e.id ?? '').toUpperCase() === empId.toUpperCase()) ?? null;
}

function isActive(emp: Record<string, unknown> | null) {
  return !!emp && String(emp.active ?? 'true') !== 'false';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'ต้องเรียกด้วย POST' });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return reply(500, { ok: false, error: 'ฟังก์ชันยังไม่ได้ตั้งค่า env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' });
  }

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return reply(401, { ok: false, error: 'ไม่มี token ของผู้เรียก' });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 1. คนเรียกเป็นใคร
    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user?.email) return reply(401, { ok: false, error: 'token ใช้ไม่ได้' });
    const callerId = caller.user.email.split('@')[0].toUpperCase();

    // 2. คนเรียกต้องเป็นแอดมินที่ยังทำงานอยู่
    const callerEmp = await findEmployee(admin, callerId);
    if (!isActive(callerEmp) || String(callerEmp?.role ?? '') !== 'admin') {
      return reply(403, { ok: false, error: 'เฉพาะ Admin เท่านั้น' });
    }

    // 3. ตรวจค่าที่ส่งมา
    const body = await req.json().catch(() => ({}));
    const empId = String(body.empId ?? '').trim();
    const password = String(body.password ?? '').trim();
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(empId)) return reply(400, { ok: false, error: 'รหัสพนักงานไม่ถูกต้อง' });
    if (!/^[0-9a-f]{64}$/.test(password)) {
      return reply(400, { ok: false, error: 'รหัสผ่านต้องผ่านสูตร deriveAuthPassword มาก่อน (hex 64 ตัว)' });
    }

    // 4. เป้าหมายต้องเป็นพนักงานจริงที่ยังทำงานอยู่
    const targetEmp = await findEmployee(admin, empId);
    if (!targetEmp) return reply(404, { ok: false, error: 'ไม่พบรหัสพนักงานนี้ในระบบ' });
    if (!isActive(targetEmp)) return reply(409, { ok: false, error: 'พนักงานคนนี้ถูกปิดใช้งานอยู่ — เปิด active ก่อน' });

    const email = empId.toLowerCase() + '@' + AUTH_DOMAIN;

    // 5. มีบัญชีอยู่แล้วหรือยัง (GoTrue admin API รองรับ filter ด้วยอีเมล)
    const lookup = await fetch(
      SUPABASE_URL + '/auth/v1/admin/users?filter=' + encodeURIComponent(email),
      { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } },
    );
    const found = await lookup.json().catch(() => ({}));
    const existing = (found.users ?? []).find((u: { email?: string }) => (u.email ?? '').toLowerCase() === email);

    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
      if (error) return reply(500, { ok: false, error: 'ตั้งรหัสใหม่ไม่สำเร็จ: ' + error.message });
      return reply(200, { ok: true, mode: 'updated', by: callerId });
    }

    const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return reply(500, { ok: false, error: 'สร้างบัญชีไม่สำเร็จ: ' + error.message });
    return reply(200, { ok: true, mode: 'created', by: callerId });
  } catch (e) {
    return reply(500, { ok: false, error: (e as Error).message });
  }
});
