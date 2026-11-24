# ป้องนภา (Pongnapa) — ระบบจัดคิวงานวง

React + Tailwind + Firebase (Auth + Firestore, เรียลไทม์)

## ตั้งค่าครั้งแรก
1. สร้างโปรเจกต์ที่ https://console.firebase.google.com
   - Authentication → Sign-in method → เปิด **Email/Password**
   - Firestore Database → Create database
   - Project settings → Your apps → เพิ่ม Web app แล้วคัดลอกค่า config
2. `cp .env.example .env` แล้วใส่ค่า
3. นำกฎใน `firestore.rules` ไปวางที่ Firestore → Rules แล้วกด Publish
   (หรือ `npx firebase-tools deploy --only firestore:rules`)
4. `npm install && npm run dev` → เปิดครั้งแรกจะเป็นหน้า **สร้างบัญชีแอดมิน**

## คำสั่ง
- `npm run dev` — รันเครื่องตัวเอง
- `npm test` — ทดสอบระบบคิว/ข้อความ LINE
- `npm run build` → อัปโหลด `dist/` (เช่น `npx firebase-tools deploy --only hosting`)

## หมายเหตุการออกแบบ
- PIN ถูกเก็บผ่าน Firebase Auth (เข้ารหัสแล้ว) ไม่เก็บเป็นข้อความใน Firestore
- `usernames/{ชื่อ}` จับคู่ชื่อผู้ใช้กับอีเมลล็อกอิน ทำให้แอดมินเปลี่ยนชื่อผู้ใช้และรีเซ็ต PIN ได้บนแพ็กเกจฟรี (รีเซ็ต PIN = สร้างล็อกอินใหม่แล้วย้ายข้อมูลไป)
- อวตาร์ใช้ Open Peeps (CC0) ผ่าน DiceBear
- ยอดงาน +1 เมื่อบันทึกงานที่มีชื่อ, −1 เมื่อถอดชื่อหรือลบงาน (ทำใน transaction)
- สมาชิกใหม่หลายตำแหน่ง: Baseline = ค่าสูงสุดของ "ยอดต่ำสุดในแต่ละตำแหน่ง" เพื่อไม่ให้แซงคิวใคร
