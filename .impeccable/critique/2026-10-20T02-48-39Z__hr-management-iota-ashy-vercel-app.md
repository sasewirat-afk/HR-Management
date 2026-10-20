---
target: "https://hr-management-iota-ashy.vercel.app/"
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "url:https://hr-management-iota-ashy.vercel.app/"
timestamp: 2026-10-20T02-48-39Z
slug: hr-management-iota-ashy-vercel-app
---
# รายงานวิจารณ์งานออกแบบ — CROCHET HR Management v1.6.34

Method: dual-agent (A: design review · B: detector + browser evidence)
Target: https://hr-management-iota-ashy.vercel.app/ (หน้าล็อกอินจาก production · หน้าจอด้านในจากสำเนาโค้ดชุดเดียวกันที่รันในเครื่อง)

## Design Health Score — 21/40 (Acceptable)

| # | Heuristic | คะแนน | ประเด็นสำคัญที่สุด |
|---|-----------|-------|------------------|
| 1 | Visibility of System Status | 2 | toast อยู่ที่ top:20px right:20px ไม่ซ้อนชั้น — ตอนรีเซ็ตรหัสผ่าน toast สองตัวทับกันพอดี |
| 2 | Match System / Real World | 3 | ภาษาโดเมนดี แต่ปน พ.ศ./ค.ศ. ในเซสชันเดียว (แดชบอร์ด 2569 · รายงาน 2026) |
| 3 | User Control and Freedom | 2 | modal ไม่มี Escape ไม่มี focus trap · อนุมัติแล้วย้อนไม่ได้ |
| 4 | Consistency and Standards | 2 | กล่องโต้ตอบ 3 ระบบปนกัน: modal · toast · alert/confirm/prompt 49 จุด |
| 5 | Error Prevention | 2 | อนุมัติทีละใบมีด่านกันเกินสิทธิ์ อนุมัติกลุ่มไม่มี (ยืนยันกับโค้ดแล้ว) |
| 6 | Recognition Rather Than Recall | 2 | รหัสผ่านชั่วคราวอยู่บนจอ 3 วินาที ไม่มีปุ่มคัดลอก |
| 7 | Flexibility and Efficiency | 2 | แถบอนุมัติกลุ่มเลื่อนหายตอนรายการยาว (วัดได้ top:-446px) |
| 8 | Aesthetic and Minimalist Design | 2 | หน้ารายงาน: แท็บ 8 อัน + แบนเนอร์ changelog ของนักพัฒนา |
| 9 | Error Recovery | 3 | บอกขั้นตอนแก้จริง แต่บางกรณีบอกให้เปิด Console (F12) |
| 10 | Help and Documentation | 1 | ไม่มีความช่วยเหลือในแอป ไม่มี "ลืมรหัสผ่าน" · empty state 15 จุดเป็น div ว่าง |

## Design Specificity

ตรรกะเขียนเพื่อ HR ไทยโดยเฉพาะ (ตัวดักปี พ.ศ. ใน capture phase · ลาบวชเฉพาะชาย · OT 1.5/3 พร้อมอ้างกฎหมาย · "2 วัน (ไม่นับวันหยุด 2 วัน)") แต่เปลือกนอกเป็นเทมเพลตแอดมินแบบ Apple ที่สลับไปใช้กับ CRM หรือ POS ได้ทันที

จุดชี้ชัด: ระบบตัวอักษรเป็นของภาษาละติน ไม่เคยปรับให้ไทย — letter-spacing 0.2em + uppercase บนข้อความไทยที่หน้าล็อกอิน และ letter-spacing ติดลบทั้งแอป

เครื่องตรวจอัตโนมัติ: 5 findings ระดับ warning — low-contrast x3 (#7b87a3 บนขาว 3.6:1), gray-on-color x1, dark-glow x1 ตรงกับที่ฝั่งรีวิวออกแบบจับได้เองโดยไม่เห็นผลนี้ (โทเค็น --muted)

## Priority Issues

**[P0] บนมือถือ ปุ่มอนุมัติทับชื่อพนักงาน** — คอลัมน์ปุ่มตรึงขวา พื้นหลังโปร่ง 70% กิน 53% ของจอ 375px ทับชื่อ ~80px · ตารางกว้างจริง 937px · ปุ่มสูง 31px · แก้: เปลี่ยนเป็นการ์ดที่ ≤768px ปุ่มเต็มความกว้าง 48px · /impeccable adapt

**[P0] กฎย่อหน้าจอไม่จับกริดหลักของแดชบอร์ด** — ตัวเลือก CSS จับจากข้อความ inline style "1fr 1fr" แต่โค้ดเขียน 2fr 1fr และ repeat(3,1fr) · ที่ 375px การ์ดสิทธิ์วันลาเหลือกว้าง 90px ไทล์คำขอ 67px · แก้: ให้คลาสจริงและ breakpoint จริง · /impeccable adapt

**[P1] อนุมัติกลุ่มข้ามด่านที่อนุมัติทีละใบบังคับ** — bulkApproveApprovals ไม่ตรวจสิทธิ์และไม่ลง audit ขณะที่ approveRequest ทำทั้งสองอย่าง · แก้: ตรวจทั้งชุดก่อน confirm แล้วแสดงใบสรุปที่ติ๊กรายการเกินสิทธิ์ออกได้ · /impeccable harden

**[P1] รหัสผ่านชั่วคราวถูกทำลายโดยระบบที่สร้างมันขึ้นมา** — toast 3 วินาที ไม่มีปุ่มคัดลอก มี toast อีกตัวทับ · ปุ่มรีเซ็ตไม่ถามยืนยันและไม่แสดงชื่อ · ไม่มี "ลืมรหัสผ่าน" ในระบบเลย · แก้: modal ผลลัพธ์ค้างอยู่พร้อมปุ่มคัดลอก · /impeccable clarify

**[P1] ข้อความรองตกคอนทราสต์ และป้ายหมวดเมนูแย่สุด** — --muted 3.6:1 · หัวข้อหมวด sidebar 10.5px สีจาง ยืดตัวอักษร uppercase บนพื้นกระจก · แก้: --muted ~6:1 · พื้นข้อความรอง 13px · :lang(th) { letter-spacing: normal; text-transform: none } · /impeccable typeset

## Persona Red Flags

- แป้นพิมพ์/โปรแกรมอ่านหน้าจอ: เมนู 18 รายการเป็น div onclick ไม่มี role/tabindex/href · ทั้งไฟล์มี aria- 1 จุด tabindex 0 จุด · แดชบอร์ดแอดมิน Tab ไปถึงได้ 4 จุด
- หัวหน้าเคลียร์งานค้าง: แถบเลือกทั้งหมดหาย หัวตารางไม่ตรึง ไม่มีค้นหา/เรียง/แบ่งหน้า ปฏิเสธต้องพิมพ์ใน prompt() ทีละใบ
- พนักงานป่วยยื่นจากมือถือ: ตัวเลือกประเภทลายาว 54 ตัวอักษรในช่อง 335px ตัด "เหลือ 30 วัน" ทิ้ง · ช่องแนบใบรับรองแพทย์อยู่ใต้ขอบจอ ไม่มีภาพตัวอย่าง/ชื่อไฟล์/ความคืบหน้า รับไฟล์ 12MB โดยไม่เตือน

## Minor Observations

div class="icon" ว่าง 15 จุด · h1 ขึ้นต้นด้วยช่องว่าง 18 จุด · แท็บ (0) เด่นเท่าแท็บที่มี 20 รายการ · แบนเนอร์ changelog กลับมาทุกครั้ง · ฟอนต์ 13-15 น้ำหนักสำหรับ UI ไทยล้วน Sarabun ไม่เคยถูกใช้บน Apple · โหลด 1.82MB ก่อนล็อกอิน (Excel 425KB + html2canvas 199KB ที่ยังไม่ใช้) · ช่องล็อกอิน 14px ทำ iOS ซูมเอง และไม่มี autocomplete

## Questions to Consider

1. ทำไมหน้าแรกของแอดมินแสดงวันลาคงเหลือของแอดมินเอง แทนที่จะเป็นคิวงาน 20 ใบที่รออยู่
2. ถ้าปิดเอฟเฟกต์กระจกทิ้ง เหลืออะไรในหน้าจอที่บอกว่านี่คือระบบ HR ไทย
3. ปุ่มอนุมัติทั้งหมดถูกออกแบบมาเพื่อช่วยตัดสินใจ หรือเพื่อทำให้ตัวเลขงานค้างลดลง
