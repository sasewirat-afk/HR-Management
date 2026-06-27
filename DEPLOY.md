# 🚀 คู่มือ Deploy ระบบ CROCHET HR ขึ้น Vercel ผ่าน GitHub

## 📋 สิ่งที่ต้องเตรียม

1. **GitHub Account** — https://github.com/signup
2. **Vercel Account** — https://vercel.com/signup (Login ด้วย GitHub ได้เลย ง่ายที่สุด)
3. **Git** ติดตั้งบนเครื่อง — https://git-scm.com/download/win

---

## ขั้นตอนที่ 1️⃣ : เตรียมไฟล์

### 1.1 Copy ไฟล์ไปยังโฟลเดอร์ทำงาน
เปิด PowerShell แล้วรัน:
```powershell
mkdir C:\Users\Wirat\OneDrive\Documents\Claude\Projects\crochet-hr
Copy-Item "C:\Users\Wirat\OneDrive\Documents\Claude\Projects\HR Management\*" "C:\Users\Wirat\OneDrive\Documents\Claude\Projects\crochet-hr\" -Recurse
cd C:\Users\Wirat\OneDrive\Documents\Claude\Projects\crochet-hr
```

### 1.2 ตั้งค่า Git (ครั้งแรกของเครื่อง)
```powershell
git config --global user.name "Your Name"
git config --global user.email "crochetxofficial@gmail.com"
```

---

## ขั้นตอนที่ 2️⃣ : สร้าง GitHub Repository

1. เข้า https://github.com/new
2. **Repository name:** `crochet-hr` (หรือชื่อที่ต้องการ)
3. เลือก **Private** (แนะนำ เพื่อความปลอดภัย)
4. **อย่า** ติ๊ก "Add README" / "Add .gitignore" / "Choose a license" (เพราะเรามีแล้ว)
5. กด **Create repository**
6. **Copy URL** ของ repo ที่สร้าง เช่น `https://github.com/USERNAME/crochet-hr.git`

---

## ขั้นตอนที่ 3️⃣ : Push โค้ดขึ้น GitHub

```powershell
git init
git add .
git commit -m "Initial commit: CROCHET HR Management System"
git branch -M main
git remote add origin https://github.com/USERNAME/crochet-hr.git
git push -u origin main
```

> **แทนที่ `USERNAME`** ด้วย GitHub username ของคุณ

หากถามรหัสผ่าน: ต้องใช้ **Personal Access Token** แทน
- สร้าง Token: https://github.com/settings/tokens/new
- เลือกสิทธิ์ `repo` แล้ว Generate
- Copy token มาใช้แทน password

---

## ขั้นตอนที่ 4️⃣ : Deploy บน Vercel

### วิธีที่ 1: Import จาก GitHub (แนะนำ)

1. ไป https://vercel.com/new
2. กด **Import** ที่ repo `crochet-hr`
3. หน้า Configure Project:
   - **Framework Preset:** `Other`
   - **Build Command:** (ปล่อยว่าง)
   - **Output Directory:** (ปล่อยว่าง)
4. กด **Deploy**
5. รอประมาณ 30 วินาที → ได้ URL เช่น `https://crochet-hr.vercel.app` 🎉

### วิธีที่ 2: ใช้ Vercel CLI

```powershell
npm i -g vercel
vercel login
vercel --prod
```

---

## ขั้นตอนที่ 5️⃣ : อัปเดตในอนาคต

```powershell
cd C:\Users\Wirat\OneDrive\Documents\Claude\Projects\crochet-hr
git add .
git commit -m "Update: <บอกว่าแก้อะไร>"
git push
```

Vercel จะ **Deploy อัตโนมัติ** ทุกครั้งที่มี push ✨

---

## 🔗 Custom Domain (Optional)

ถ้ามี domain ของตัวเอง เช่น `hr.crochet.com`:
1. Vercel Dashboard → Project → Settings → Domains
2. Add domain → ทำตามที่ Vercel แจ้ง (เพิ่ม DNS Record)

---

## ⚠️ ข้อควรระวัง

1. **localStorage ทำงานแยกตาม browser** — ข้อมูลที่ user A บันทึก user B จะมองไม่เห็น
2. **ไม่มี backend database** — Prototype เท่านั้น
3. **Password เก็บแบบ plain text** — ไม่ปลอดภัยสำหรับ production
4. **Repo ควรเป็น Private**

---

## 🆘 หากติดปัญหา

- **Git ไม่รู้จักคำสั่ง:** ติดตั้ง Git ใหม่ที่ https://git-scm.com/download/win
- **Permission denied (publickey):** ใช้ HTTPS URL แทน SSH
- **Vercel build error:** เช็คว่า `index.html` อยู่ที่ root ของ repo
