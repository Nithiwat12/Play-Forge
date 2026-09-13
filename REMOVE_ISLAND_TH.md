# ลบ Island Betrayal

ลบ engine, UI, ตั้งค่าห้อง, วิธีเล่น, seed และ tests ของ Island Betrayal ออกจาก source แล้ว
API รายการเกมแสดงเฉพาะเกมที่มี engine อยู่จริง จึงไม่แสดง Island Betrayal และลิงก์ตรงไปเกมนี้ใช้ไม่ได้
เกมที่เหลือคือ Spyfall, WordHead และ ito

ติดตั้งไฟล์นี้ทับโปรเจกต์เดิมแล้ว restart backend และ rebuild frontend
หากใช้วิธีคัดลอกทับ ให้ลบโฟลเดอร์ client/src/games/island_betrayal และ server/src/games/island_betrayal รวมถึง server/tests/island.test.cjs ในเครื่องเดิมด้วย

รันจากโฟลเดอร์ GameCen:

```powershell
npm run install:all
npm run prisma:generate
npm run prisma:deploy --prefix server
npm run build:server
npm run build:client
```

Migration ใหม่ปิดรายการเกมในฐานข้อมูล โดยเก็บประวัติและความสัมพันธ์ข้อมูลเก่าไว้ ไม่ลบข้อมูลย้อนหลัง
คง migration ที่เคยรันไว้เพื่อไม่ทำให้ประวัติ migration ของฐานข้อมูลเดิมผิดลำดับ
ยังไม่ได้รัน migration บนฐานข้อมูลจริงของคุณ
