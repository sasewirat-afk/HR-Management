# CROCHET HR Management System

ระบบบริหารจัดการงานบุคคล (Human Resources) สำหรับ CROCHET

## 🎯 ฟีเจอร์

### การจัดการการลา (5 ประเภท)
- **ลากิจ:** 6 วัน/ปี (ไม่ใช้ในช่วงทดลองงาน)
- **ลาพักร้อน:** 6 วัน/ปี (Admin ปรับได้รายคน)
- **ลาป่วย:** 30 วัน/ปี (แนบใบรับรองแพทย์ได้)
- **ลาคลอด:** 90 วัน/รอบการมีบุตร
- **ลาสะสมวันหยุด:** ตามจำนวนที่สะสม (หมดอายุ 1 ปี)
- ลาครึ่งวันได้ (เช้า/บ่าย)
- Pro-rate สำหรับพนักงานใหม่หลังผ่านทดลองงาน

### คำขออื่นๆ
- **ขอ OT** พร้อมระบุเหตุผล + ช่วงเวลา
- **ขอสะสมวันหยุด** (ทำงานในวันหยุด สะสมไว้ใช้ภายหลัง)
- **ขอปฏิบัติงานนอกสถานที่** ระบุช่วงเวลาอิสระ + วัตถุประสงค์

### บริหารเวลาเข้างาน
- **อัปโหลด Excel** จากเครื่องสแกนหน้า (RadGridExport format)
- จับกลุ่มอัตโนมัติ: 1 พนักงาน + 1 วัน → เวลาเข้า/เลิกงาน
- Match ด้วย รหัสพนักงาน
- **รายงานรายวัน:** มาทำงาน / ลาหยุด / มาหลัง 08:45 / มาสายหลัง 09:01

### สลิปเงินเดือน (รูปภาพ PNG)
- คำนวณอัตโนมัติ: เงินเดือน + OT (×1.5) − หักมาสาย
- Admin สร้าง/บันทึก สลิปทั้งหมดในเดือนได้
- Employee ดาวน์โหลด PNG ย้อนหลังเองได้
- **📤 ปุ่ม Share** — แชร์ไป Line / Messenger / Email ผ่าน Web Share API
- ตั้งค่า OT Rate และค่าหักสายได้
- รองรับภาษาไทยเต็มรูปแบบ

### Cloud Sync (Optional)
- เชื่อม Supabase เพื่อให้ user ทุกคนเห็นข้อมูลเดียวกัน
- Real-time sync: เมื่อมีคนแก้ข้อมูล → user อื่นเห็นทันที
- Free tier เพียงพอสำหรับองค์กรขนาดเล็ก-กลาง
- ดูคู่มือ: `SUPABASE_SETUP.md`

### ระบบจัดการ
- **3 Roles:** Employee / Manager / Admin (HR)
- **อนุมัติ 1 ขั้น:** ส่งถึง Manager โดยตรง
- In-app Notification
- Admin: CRUD พนักงาน (เพิ่ม/ลบ/แก้ไข + Reset Password)
- รายงาน + Export CSV ภาษาไทย
- ตั้งค่าวันหยุดบริษัท

## 🚀 การใช้งาน

เปิดไฟล์ `index.html` ผ่าน browser หรือเข้าผ่าน URL ที่ deploy บน Vercel

### Demo Accounts

| Role | รหัสพนักงาน | รหัสผ่าน |
|------|------------|----------|
| Admin (HR) | ADMIN001 | admin123 |
| Manager | MGR001, MGR002 | 1234 |
| Employee | EMP001, EMP002, EMP003 | 1234 |

## 🛠️ Tech Stack

- HTML5 + CSS3 + Vanilla JavaScript (Single-page App)
- **SheetJS** - parse Excel files
- **jsPDF + autoTable** - generate PDF pay slips
- **localStorage** - persistent data storage (ไม่มี backend)
- Noto Sans Thai font

## 📁 โครงสร้างไฟล์

```
HR Management/
├── index.html              # ระบบทั้งหมด (Single Page App)
├── favicon.png             # Icon tab browser
├── logo.png                # CROCHET Logo (สีขาว)
├── logo-black.png          # CROCHET Logo (สีดำ)
├── README.md               # ไฟล์นี้
├── DEPLOY.md               # คู่มือ Deploy ขึ้น GitHub + Vercel
├── SUPABASE_SETUP.md       # คู่มือเชื่อม Supabase (Cross-user sync)
├── คู่มือการใช้งาน.docx     # คู่มือใช้งานละเอียด
├── vercel.json             # Vercel config
└── .gitignore
```

## 📖 คู่มือ
- **ติดตั้ง/Deploy:** อ่าน `DEPLOY.md`
- **เปิด Cloud Sync (ใช้กับหลาย user):** อ่าน `SUPABASE_SETUP.md`
- **ใช้งานระบบ:** อ่าน `คู่มือการใช้งาน.docx`

## ⚠️ ข้อจำกัด

- **localStorage แยกตาม browser** — ข้อมูลที่ user A บันทึก user B จะมองไม่เห็น (เพราะอยู่คนละเครื่อง/browser)
- **ไม่มี backend database** — ระบบนี้เป็น Prototype หากต้องการใช้จริงในองค์กร แนะนำให้ย้ายไป Firebase/Supabase
- **Password เก็บแบบ plain text** — ไม่ปลอดภัยสำหรับ production
- **ไฟล์แนบเก็บเป็น Base64** ใน localStorage (จำกัด ~5-10 MB)

## License

Private - CROCHET Internal Use Only
