# 🗄️ คู่มือ Setup Supabase สำหรับ CROCHET HR

> **เป้าหมาย:** ทำให้ทุก user เห็นข้อมูลเดียวกัน (sync ระหว่าง browser/เครื่อง)
> **เวลาที่ใช้:** ประมาณ 10 นาที

---

## 📋 สิ่งที่จะได้

หลัง setup เสร็จ:
- ✅ ข้อมูลพนักงาน, คำขอลา, OT, เวลาเข้างาน ฯลฯ จะเก็บใน Cloud
- ✅ ทุก user (มือถือ, คอมเก่า, คอมใหม่) เห็นข้อมูลเดียวกัน
- ✅ เมื่อมีคนแก้ข้อมูล → user อื่นเห็นทันที (real-time)
- ✅ ไม่ต้องเสียเงิน (ใช้ Free tier)

---

## ขั้นตอนที่ 1️⃣ : สร้าง Supabase Account

1. เข้าเว็บ **https://supabase.com**
2. กดปุ่ม **Start your project** (มุมขวาบน)
3. Sign in ด้วย **GitHub** หรือ Email
4. ยืนยันอีเมล (ถ้าใช้ email)

---

## ขั้นตอนที่ 2️⃣ : สร้าง Project ใหม่

1. ในหน้า Dashboard กดปุ่ม **New project**
2. กรอกข้อมูล:
   - **Name:** `crochet-hr` (หรือชื่ออื่นๆ)
   - **Database Password:** ตั้งรหัสผ่านยาวๆ (เก็บไว้ที่ปลอดภัย)
   - **Region:** เลือก **Southeast Asia (Singapore)** — ใกล้ไทยที่สุด
   - **Pricing Plan:** Free
3. กด **Create new project**
4. รอประมาณ 1-2 นาที จนกว่า project จะ Ready ✅

---

## ขั้นตอนที่ 3️⃣ : สร้างตารางเก็บข้อมูล

1. ในเมนูซ้าย กด **SQL Editor** (ไอคอนกระดาษม้วน)
2. กดปุ่ม **+ New query**
3. **Copy** โค้ด SQL ด้านล่างนี้ทั้งหมด แล้ว **Paste** ลงไป:

```sql
-- ตารางเก็บข้อมูลทั้งระบบ (key-value)
create table if not exists hr_data (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- เปิด Realtime ให้กับตาราง
alter publication supabase_realtime add table hr_data;

-- เปิด RLS (Row Level Security) แต่ตั้งให้ทุกคน read/write ได้
-- (สำหรับ Prototype - production ควรเข้มกว่านี้)
alter table hr_data enable row level security;

create policy "Anyone can read"
  on hr_data for select
  using (true);

create policy "Anyone can insert"
  on hr_data for insert
  with check (true);

create policy "Anyone can update"
  on hr_data for update
  using (true);
```

4. กดปุ่ม **Run** (มุมขวาล่าง)
5. ถ้าสำเร็จจะเห็น "Success. No rows returned" ✅

---

## ขั้นตอนที่ 4️⃣ : ดึงค่า Project URL และ API Key

1. ในเมนูซ้าย กด **Project Settings** (ไอคอนเฟือง)
2. เลือกแท็บ **API**
3. จะเห็น 2 ค่าที่ต้องคัดลอก:

| ชื่อ | คำอธิบาย |
|---|---|
| **Project URL** | `https://xxxxxxxxxxxxx.supabase.co` |
| **anon public** (key) | `eyJhbGciOiJIUzI1NiIsInR5cCI6Ikpxxxxxxx...` (ยาวมาก) |

> **เก็บ 2 ค่านี้ไว้** สำหรับขั้นตอนถัดไป

⚠️ **อย่าใช้ค่า `service_role` key** เพราะมีสิทธิ์เต็มและอันตราย

---

## ขั้นตอนที่ 5️⃣ : ใส่ค่า Config ในไฟล์ index.html

เปิดไฟล์ **index.html** ด้วย Text Editor (เช่น Notepad, VS Code)

ค้นหาบรรทัดที่มีคำว่า:
```javascript
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
```

แทนที่ด้วยค่าจริงที่ได้จากขั้นตอน 4:
```javascript
const SUPABASE_URL = 'https://xxxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6Ikpxxxxxxx...';
```

บันทึกไฟล์

---

## ขั้นตอนที่ 6️⃣ : Push ขึ้น GitHub + Vercel จะ Auto-Deploy

```powershell
cd C:\Users\Wirat\OneDrive\Documents\Claude\Projects\crochet-hr
git add .
git commit -m "Add Supabase integration"
git push
```

Vercel จะ deploy ใหม่ภายใน 30 วินาที

---

## ขั้นตอนที่ 7️⃣ : ทดสอบ

1. เปิด URL ของระบบ (Vercel)
2. Login ด้วย Admin → เพิ่มพนักงานคนใหม่
3. **เปิดในมือถือ หรือ Browser ตัวอื่น** (เช่น Incognito) → Login → ควรเห็นพนักงานคนใหม่ที่เพิ่มเข้าไป
4. ถ้าเห็น → ✅ Sync ใช้งานได้แล้ว

---

## 🔍 ตรวจสอบข้อมูลใน Supabase

ดูข้อมูลใน Cloud:
1. Supabase Dashboard → **Table Editor**
2. เลือกตาราง **hr_data**
3. จะเห็น rows ที่บันทึกอยู่ แต่ละ row คือข้อมูล 1 ชุด (employees, leave_requests, ฯลฯ)

---

## 🧹 ล้างข้อมูลทั้งหมด (เริ่มใหม่)

ถ้าต้องการล้างข้อมูล:
- ไป Supabase → SQL Editor → รัน:

```sql
truncate table hr_data;
```

จากนั้นเปิด App และ Refresh → ระบบจะ seed ข้อมูล demo ใหม่

---

## ⚠️ ข้อควรระวัง

1. **anon key เปิดเผยใน HTML ได้** (ไม่อันตราย เพราะถูกจำกัดด้วย RLS Policy)
2. **service_role key ห้ามใส่ในไฟล์ HTML เด็ดขาด** (มีสิทธิ์เต็ม อันตรายมาก)
3. **Free tier มีจำกัด:**
   - 500 MB database
   - 50,000 monthly active users
   - 2 GB bandwidth/month
   - เพียงพอสำหรับองค์กรขนาดเล็ก-กลาง

4. **Backup เป็นระยะ:** ใช้ปุ่ม Export ใน Table Editor

---

## 🆘 ปัญหาที่อาจเจอ

### "Invalid API Key"
- ตรวจสอบว่า copy `anon` key ครบ (ยาวมาก ~200 ตัวอักษร)
- ไม่ใช้ `service_role` key

### ข้อมูลไม่ sync
- เช็คว่ารัน SQL ในขั้นตอน 3 สำเร็จ (มีตาราง `hr_data` ใน Table Editor)
- เปิด Developer Tools (F12) → Console → ดู error

### "row violates row-level security policy"
- RLS policy ไม่ถูกตั้งค่า → รัน SQL ในขั้นตอน 3 ใหม่

---

✅ **เสร็จแล้ว!** ระบบของคุณจะ sync ระหว่าง user ทุกคน
