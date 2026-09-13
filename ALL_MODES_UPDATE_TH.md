# อัปเดตล่าสุด: ลบ Island Betrayal และเพิ่มโหมดทุกเกม

เหลือ 3 เกม: Spyfall (Spy Hunt), WordHead และ ito
อัปเดต UI ตามภาพ: ตัวเลือกการสื่อสารอยู่ในกรอบรูปแบบเล่นของแต่ละเกม โหมดนั่งด้วยกันซ่อนช่องพิมพ์ถาม/ตอบ/ใบ้ ส่วนออนไลน์แสดงช่องพิมพ์และปุ่มส่งที่จำเป็น

เลือกโหมดตอนสร้างห้อง ทุกคนเห็นโหมดในล็อบบี้และหน้าเล่นเกม และโหมดเดิมคงอยู่เมื่อเล่นรอบต่อไปหรือ reconnect

| เกม | นั่งด้วยกัน | ออนไลน์ไม่ใช้เสียง |
| --- | --- | --- |
| Spyfall | พูดถาม/ตอบและเลือกถามคนถัดไปได้ ไม่บังคับข้อความ | ต้องพิมพ์คำถาม เลือกผู้รับ ผู้รับต้องส่งคำตอบก่อนถามต่อ มีบันทึกให้อ่านทุกคน |
| WordHead | พูดคำใบ้แล้วกดให้คำใบ้ พูดคำตอบแล้วกดตอบแล้วได้ | บังคับคำใบ้และคำตอบเป็นข้อความ ซ่อนปุ่มตอบแล้วแบบพูด ใช้การโหวตคำตอบในระบบ |
| ito | พูดคำใบ้ ไม่มีช่องพิมพ์ เสนอและยืนยันเปิดไพ่ผ่านระบบ | ต้องพิมพ์คำใบ้ทุกใบก่อนเสนอเปิดไพ่ ทุกคนอ่านและกดยืนยันหรือรอก่อน |

ทั้งสองโหมดใช้บัญชีและอุปกรณ์ของแต่ละคน เพื่อให้ข้อมูลลับอยู่กับเจ้าของเท่านั้น ไม่มีระบบไมโครโฟนหรือส่งต่อเครื่องเดียว
กติกาโหมดออนไลน์ตรวจบน server ด้วย ไม่ใช่แค่ซ่อนปุ่ม: ส่งข้อความว่างไม่ได้ และ Spyfall ถามต่อข้ามคำตอบไม่ได้
ห้องเก่าที่ไม่มี playMode ใช้ TABLE เพื่อรักษาวิธีเล่นเดิม ห้องใหม่หน้าเว็บเริ่มต้นเลือก ONLINE และเปลี่ยนได้ก่อนสร้าง
เมื่ออยากเปลี่ยนโหมดให้สร้างห้องใหม่

## ติดตั้ง
เก็บ .env เดิมไว้ ZIP ไม่รวม node_modules, .git, build หรือค่าลับ
ควรแตก ZIP ลงโฟลเดอร์ใหม่แล้วนำ .env ของ server/client เดิมมาใส่
ถ้าคัดลอกทับโฟลเดอร์เก่า ต้องลบ client/src/games/island_betrayal, server/src/games/island_betrayal, server/tests/island.test.cjs และ docs/ISLAND_BETRAYAL.md ด้วย

รันจาก GameCen:

```powershell
npm run install:all
npm run prisma:generate
npm run prisma:deploy --prefix server
npm run build:server
npm run build:client
```

จากนั้น restart backend และใช้ frontend ที่ build ใหม่ หรือรัน npm run dev:server และ npm run dev:client คนละ terminal
Migration เพิ่ม ito และปิดรายการ Island Betrayal ในฐานข้อมูล ไม่ลบประวัติ/ห้องเก่าและ foreign keys
Migration เดิมเก็บไว้ตามลำดับ ไม่ลบ migration ที่เคยใช้งาน
รายการเกม API กรองตาม engine ที่ติดตั้งจริง ทำให้ Island Betrayal ไม่แสดงแม้ฐานข้อมูลยังมีรายการเก่า และเปิดหน้าสร้างเกมที่ถูกลบผ่านลิงก์ตรงไม่ได้

## ทดสอบ
- Server: 21 tests ผ่าน (rejoin เดิม 3, ito 9, play modes 9)
- Socket.IO ทดสอบจริงครบทั้ง 3 เกม × 2 โหมด โดยจำลองฐานข้อมูล: การส่งข้อความ ข้อมูลลับ reconnect และกติกาที่แตกต่างกัน
- Client reconnect เดิม 5 tests ผ่าน
- TypeScript และ Vite production build ผ่าน
- ยังไม่ได้ตรวจภาพหน้าจอใน browser และยังไม่ได้รัน migration กับฐานข้อมูลจริงของผู้ใช้
- สถานะเกมยังเก็บในหน่วยความจำตามระบบเดิม การ reconnect ต้องเป็น server process เดิม

## Commit ที่แนะนำ

```text
Remove Island Betrayal and add table/online modes to all games

- Remove Island engine, UI, settings, catalog seed and tests
- Retire Island catalog entry while retaining existing history
- Add persistent play mode selection and room/game mode labels
- Require typed Spyfall questions and answers online
- Require typed WordHead hints and guesses online
- Preserve spoken actions for table mode and ito consensus flow
- Add real Socket.IO coverage for every game and mode
```

ตรวจ render ของ React ครบ 3 เกม × 2 โหมด ยืนยันช่องพิมพ์มีเฉพาะ ONLINE และปุ่มพูดของ WordHead มีเฉพาะ TABLE ผ่านทั้งหมด (ไม่ใช่การตรวจภาพหน้าจอใน browser)
