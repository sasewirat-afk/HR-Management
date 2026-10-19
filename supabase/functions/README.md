# Edge Function — admin-reset-password

ให้แอดมินตั้งรหัสผ่านบัญชี Auth ของพนักงานได้จากหน้าเว็บ โดยไม่ต้องเข้า Supabase Dashboard

## ปัญหาที่แก้

เบราว์เซอร์เปลี่ยนรหัสผ่านของบัญชีคนอื่นไม่ได้ `updateUser()` แก้ได้เฉพาะบัญชีที่ล็อกอินอยู่
ส่วน `auth.admin.updateUserById()` ต้องใช้ service_role ซึ่งห้ามอยู่ในหน้าเว็บเพราะใครก็เปิดดูได้

ที่ผ่านมาแอปใช้ `signUp()` แทน ซึ่งได้ผลเฉพาะบัญชีที่ยังไม่มี พอพนักงานมีบัญชีแล้วลืมรหัส
แอดมินต้องเข้าไปลบบัญชีใน Dashboard ก่อนทุกครั้ง (19 ต.ค. 2569 เจอปัญหานี้กับ 690105007)

## ติดตั้ง

**ทางที่ 1 — Dashboard (ไม่ต้องลงอะไรในเครื่อง)**

1. Supabase → Edge Functions → Deploy a new function
2. ชื่อ `admin-reset-password` (ต้องตรงตัว แอปเรียกด้วยชื่อนี้)
3. วางเนื้อไฟล์ `admin-reset-password/index.ts` ทั้งไฟล์ → Deploy

4. **ปิด Verify JWT ของฟังก์ชันนี้** — เข้าไปที่ฟังก์ชัน → Details/Settings → ปิด
   "Verify JWT with legacy secret" → Save

**ทางที่ 2 — CLI**

```bash
npx supabase@latest login
npx supabase@latest link --project-ref <project-ref>
npx supabase@latest functions deploy admin-reset-password --no-verify-jwt
```

## ⚠ ต้องปิด Verify JWT ไม่งั้นเรียกจากหน้าเว็บไม่ได้เลย

เบราว์เซอร์ยิง `OPTIONS` ไปถามสิทธิ์ก่อนทุกครั้ง (CORS preflight) และคำขอนั้น
**ไม่มี Authorization header ติดไปด้วยตามมาตรฐาน** ถ้าเปิด Verify JWT ไว้
แพลตฟอร์มจะปฏิเสธ preflight ตั้งแต่ก่อนถึงโค้ดในฟังก์ชัน คำขอจริงจึงไม่เคยถูกส่ง

อาการที่เห็นใน Console (19 ต.ค. 2569):

```
Access to fetch ... has been blocked by CORS policy:
Response to preflight request doesn't pass access control check:
It does not have HTTP ok status.
```

ปิดแล้ว **ไม่ได้หละหลวมลง** เพราะฟังก์ชันตรวจเองครบอยู่แล้ว: ต้องมี token ที่ใช้ได้จริง
คนเรียกต้องเป็น `role = admin` ที่ยัง active และเป้าหมายต้องเป็นพนักงานจริง
ด่านของแพลตฟอร์มตรวจแค่ว่า token ถูกต้อง ไม่ได้ตรวจว่าเป็นแอดมิน

ไม่ต้องตั้ง secret เอง `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` เป็น env ที่ Supabase
ใส่ให้ทุก Edge Function อยู่แล้ว

## ตรวจว่าใช้ได้

1. ล็อกอิน e-HR ด้วยบัญชี Admin
2. กด Reset Password ให้พนักงานที่**มีบัญชีอยู่แล้ว** (เคสที่เดิมทำไม่ได้)
3. ต้องขึ้นว่าตั้งรหัสใหม่สำเร็จ โดยไม่ต้องแตะ Dashboard
4. ให้พนักงานล็อกอินด้วยรหัสใหม่

ถ้ายังไม่ได้ติดตั้ง แอปจะถอยไปใช้วิธีเดิม (`signUp`) อัตโนมัติ — ไม่พัง แค่ยังแก้บัญชีเดิมไม่ได้

## ด่านตรวจในฟังก์ชัน

| ชั้น | ตรวจอะไร |
|---|---|
| 1 | ต้องมี JWT ของคนที่ล็อกอินอยู่ |
| 2 | คนเรียกต้องเป็น `role = admin` และ `active` ในรายชื่อพนักงาน |
| 3 | เป้าหมายต้องเป็นรหัสพนักงานที่มีจริงและยัง active |
| 4 | รหัสผ่านต้องผ่านสูตร `deriveAuthPassword` มาแล้ว (hex 64 ตัว) — รหัสจริงไม่เคยออกจากเบราว์เซอร์ |
| 5 | service_role key อยู่ใน env ของฟังก์ชัน ไม่เคยอยู่ในหน้าเว็บ |

## ผลต่อเนื่องหลังติดตั้ง

แอปไม่ต้องพึ่ง `signUp()` จากเบราว์เซอร์อีกต่อไป จึง **ปิด Allow new users to sign up
ได้ถาวร** ซึ่งปิดช่องสุดท้ายที่เหลืออยู่: คนที่เดารหัสพนักงานที่ยังไม่มีบัญชีได้
จะสมัครสวมรหัสนั้นไม่ได้อีก

ลำดับที่ปลอดภัย: ติดตั้งฟังก์ชัน → ทดสอบ Reset กับบัญชีที่มีอยู่แล้วจนผ่าน → ค่อยปิดสวิตช์สมัคร
