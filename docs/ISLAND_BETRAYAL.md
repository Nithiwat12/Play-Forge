# Island Betrayal — รายละเอียดอัปเดต

เพิ่มเกมตาม Island Betrayal Integration Prompt.pdf ใน ZIP GameCen(1).zip ฉบับล่าสุด ไม่เปลี่ยนกติกาหรือไฟล์ของ Spy/WordHead

## การเชื่อมกับโปรเจกต์เดิม

- Client: React + TypeScript + Tailwind, route `/games/island_betrayal`, CreateRoom/JoinRoom/Lobby/PlayPage และระบบบัญชีเดิม
- Server: BaseGame / GameRegistry / GameManager และช่อง Socket.IO `game:action` เดิม
- การยืนยันตัวผู้เล่นใช้ socket ที่ผ่านระบบ auth เดิม ไม่อ่าน actor id จาก payload
- Prisma/PostgreSQL: เพิ่ม catalog row ด้วย migration ไม่มีตารางใหม่ ผลเก็บใน GameSession/GameHistory JSON เดิม
- หน้าประวัติแสดงผลผู้เล่น เป้าหมายลับ และ timeline ที่เปิดเผยเมื่อจบเกม
- ไม่มีระบบ local/hot-seat เดิม จึงใช้ multiplayer ออนไลน์ตามสถาปัตยกรรมปัจจุบัน

## วิธีเปิดใช้งาน

รันจากโฟลเดอร์ GameCen โดยตั้งค่า `.env` ของ server ตาม README เดิมไว้แล้ว:

```sh
npm run install:all
npm run prisma:generate
npm run prisma:deploy --prefix server
npm run build:server
npm run build:client
```

Migration `20260912193000_add_island_betrayal` เพิ่มเกมให้ฐานข้อมูลที่มีอยู่แล้วอย่างเดียว ฐานข้อมูลใหม่ยังใช้คำสั่ง `npm run seed` เดิมได้ จากนั้นเปิด server/client ด้วยคำสั่งเดิม เกมจะปรากฏในคลังเกม ไม่ต้องสร้างระบบห้องหรือบัญชีเพิ่ม

## กติกาที่ใช้งานได้

- 4–8 คน ทุกคนเริ่มแคมป์ สุขภาพ/ความอิ่ม/น้ำ 100 พลังงาน 10 อาหารและน้ำอย่างละ 2
- แผนที่ 7 จุด: แคมป์ ป่า ภูเขา ซากเรือ หมู่บ้าน ชายหาด ภูเขาไฟ
- เริ่มวัน 2 วินาที → กลางวัน 5 นาที → กลางคืน 30 วินาที → เหตุการณ์ 3 วินาที → เอาชีวิตรอด 3 วินาที → วันถัดไป
- เซิร์ฟเวอร์เป็นเจ้าของ deadline และสุ่มผลทั้งหมด ไม่มีปุ่มข้ามวันจาก client แม้ timer callback มาช้าก็ตรวจ deadline ก่อนรับ action
- เดินทางใช้พลังงาน 1 สำรวจใช้ 2 พบของ 1–3 ชิ้นตามพื้นที่ เก็บของจากพื้นที่เข้ากระเป๋าด้วยปุ่ม เก็บก่อนมีสิทธิ์ก่อน
- การสำรวจบาดเจ็บ 15 สุขภาพด้วยโอกาส 15% (ภูเขาไฟ 40%) พลังงานเติมทุกเช้า
- ใช้อาหาร/น้ำเพิ่มความอิ่ม/น้ำ 35 ยาเพิ่มสุขภาพ 25 ไม่เกิน 100
- แชตสำหรับการเจรจาเท่านั้น ไม่โอนทรัพยากร มีปุ่มส่งคำเตือนพร้อมสถานที่ลงบันทึกส่วนกลาง
- ส่งข้อเสนอแลกของแบบระบุคน ทรัพยากร และจำนวน ผู้รับเท่านั้นที่ยอมรับ/ปฏิเสธได้ ต้องอยู่จุดเดียวกันเมื่อแลกจริง ตรวจของทั้งสองฝั่งก่อนย้ายพร้อมกัน ป้องกันตอบรับซ้ำ/ของติดลบ
- ส่งคำขอทรัพยากรหรือคำขอช่วยเหลือได้ คำขอช่วยเหลือเปิดเผยสุขภาพ ความอิ่ม น้ำ และตำแหน่งที่ร้องขอ คนที่อยู่ด้วยกันกดส่งของ/ช่วยได้
- กระเป๋า เป้าหมาย แอ็กชันลับ และหลักฐานส่งเฉพาะเจ้าของ ไม่ broadcast ทั้งห้อง
- เป้าหมายลับสุ่มจาก: หนีพร้อมของมีค่า 2, ช่วย 3 คนต่างกัน, ไม่บริจาคเรือ, ทำลายเรือสำเร็จ 2 ครั้ง ไม่มีบทบาทคนทรยศตายตัว
- กลางคืนเลือก HELP / INVESTIGATE / STEAL / SABOTAGE / SKIP ล็อกครั้งเดียว รอผู้เล่นที่ยังเชื่อมต่อครบหรือหมดเวลา ไม่เลือกถือว่าข้าม ออกจากเกมแล้วกลับมาจะเปลี่ยนแอ็กชันที่ล็อกไว้ไม่ได้
- ลำดับลงมือกลางคืนสุ่มใหม่ทุกคืน ของที่ถูกขโมยมีจำนวนจริง ช่วยไม่สำเร็จหากของถูกขโมยไปก่อน สืบสวนให้เบาะแสความเชื่อมั่นปานกลาง ไม่ฟันธงว่าใครเป็นคนทรยศ
- สาธารณะเห็นว่ามีของถูกขโมยหรือเรือเสียหาย แต่ไม่เห็นชื่อผู้ลงมือจนเฉลยท้ายเกม ผู้เสียหายรู้ชนิดและจำนวนที่หายเป็นส่วนตัว
- เหตุการณ์: พายุ งูกัด ไฟไหม้ น้ำขึ้นสูง เถ้าภูเขาไฟ; ความเสียหายขึ้นกับตำแหน่งตาม engine
- ทุกคืนกินอาหารและน้ำอย่างละ 1 อัตโนมัติ ถ้าไม่มี ความอิ่มลด 30 / น้ำลด 35 เมื่อเป็นศูนย์เสียสุขภาพ 20 / 30 ผู้ตายดูได้อย่างเดียว รวมถึงพิมพ์แชตไม่ได้
- คนออกจากเกมไม่ขวางการรอโหวต/แอ็กชัน แต่ร่างกายยังอยู่บนเกาะและรับผลเอาชีวิตรอดตามปกติ กลับเข้ามาจะได้ข้อมูลตัวเองคืน
- เรือที่ชายหาดใช้ไม้ 6 โลหะ 4 เชือก 3 ชิ้นส่วน 2 ทุกครั้งที่บริจาคหักจากกระเป๋าจริง กลางคืนทำลายแต่ละส่วนได้ครั้งละ 1
- เรือครบเข้าสู่ ESCAPE 45 วินาที มีที่นั่งเท่าจำนวนผู้เล่นแต่ไม่เกิน 5 ขึ้นก่อนได้ก่อน เลือกขึ้น/อยู่แล้วเปลี่ยนไม่ได้ หมดเวลาไม่เลือกถือว่าอยู่บนเกาะ
- แอ็กชันพิเศษ: ผู้ที่ขึ้นเรือแล้วใช้เชือก 1 ช่วยคนที่ยังไม่เลือกขึ้นที่นั่งว่าง นับเป็นการช่วยเป้าหมายคนใหม่
- หากไม่หนีภายในคืนวันที่ 10 จบเกมโดยไม่มีผู้หนีสำเร็จ ป้องกันห้องวนไม่สิ้นสุด
- จบแล้วเปิดเผยผู้หนี ผู้ตาย เป้าหมายที่สำเร็จ และ timeline ทั้งหมด หนีสำเร็จ 1 คะแนน เป้าหมายสำเร็จอีก 1 คะแนน
- หนึ่งการเอาชีวิตรอดคือหนึ่งเกม บันทึกแยกแต่ละครั้ง กลับล็อบบี้เพื่อเริ่มเกมใหม่ ของและคะแนนไม่สะสมข้ามเกม

## Socket actions

ใช้ envelope เดิม `{ roomId, actionType, payload }` ที่ `game:action`:

| actionType | payload |
| --- | --- |
| island:move | location |
| island:explore | {} |
| island:collect | resource, quantity |
| island:use | resource |
| island:contribute | resource, quantity |
| island:chat / island:warning | text |
| island:request | kind: resource/help, resource, quantity |
| island:fulfill | id |
| island:help | target, resource |
| island:offer | target, give, giveQuantity, want, wantQuantity |
| island:trade | id, accept |
| island:secret | kind, target?, resource?, component? |
| island:escape | choice: BOARD/STAY/RESCUE, target? |

ชนิดและจำนวนทุกค่าถูกตรวจฝั่ง server การส่งข้อมูลผิดไม่แก้ state

## การทดสอบและข้อจำกัด

ผ่าน:

- Client TypeScript build check
- Strict TypeScript check ของ Island engine และ registry
- `npm run test:island --prefix server`: 7 tests รวม Socket.IO จริงทั้ง 4 และ 8 connections, room/game handlers จริง และ persistence service จริงโดยใช้ database fixture
- ครอบคลุม timer, movement/explore/collect, privacy, chat ไม่โอนของ, trade แบบ atomic, requests/help, secret locks/theft/sabotage/investigation, death/spectator, exit/rejoin, boat/seat limit/rescue, objective/truth/result persistence
- Client room-connection regression เดิม 5 tests
- Server rejoin regression เดิม 3 tests โดยใช้ test-only transpile loader และ database stub
- React static rendering ของหน้า ACTION / SECRET / ESCAPE / FINISHED

ยังไม่ได้ทดสอบกับฐานข้อมูล PostgreSQL จริงหรือ deploy production ในงานนี้ ZIP เดิมมี node_modules ฝั่ง Windows และบาง dependency ขาด พร้อม Prisma generated client ที่เก่ากว่า schema จึงยังยืนยัน full server/client production build ในเครื่องนี้ไม่ได้ ให้ติดตั้ง dependencies และ generate Prisma ก่อน build ตามขั้นตอนข้างบน Browser runtime ในเครื่องทดสอบไม่มี Chromium จึงยังไม่ได้ตรวจหน้าจอด้วยเบราว์เซอร์จริง

สถานะเกมขณะเล่นอยู่ในหน่วยความจำตาม GameManager เดิม การ reconnect ใช้งานได้เมื่อ server process ยังทำงาน การ restart server ยังคงใช้ recovery/abort เดิมของแพลตฟอร์ม
