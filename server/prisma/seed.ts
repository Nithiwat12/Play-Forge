import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// The Game Library is data-driven: adding a future game means inserting a
// row here (or via an admin endpoint) and registering its engine in
// GameRegistry - the platform code never needs to change.
const games = [
  { name: "Island Betrayal", slug: "island_betrayal", description: "ติดเกาะกับผู้เล่น 4–8 คน สำรวจ เก็บของ แลกเปลี่ยน และร่วมสร้างเรือหนี แต่ทุกคนมีเป้าหมายลับและเลือกทรยศได้เมื่อค่ำคืนมาเยือน", minPlayers: 4, maxPlayers: 8, isActive: true },
  {
    name: "Spy Hunt",
    slug: "spyfall",
    description:
      "ผู้เล่นคนหนึ่งจะเป็นสปายลับ ส่วนคนอื่น ๆ จะรู้สถานที่และบทบาทของตัวเองที่นั่น ถามคำถามให้ฉลาด จับผิดคนที่ดูไม่เข้าพวก แล้วโหวตหาสปายให้ได้ก่อนหมดเวลา",
    minPlayers: 3,
    maxPlayers: 8,
    isActive: true,
  },
  {
    name: "ทายคำบนหัว",
    slug: "wordhead",
    description:
      "ทุกคนจะมีคำลับติดอยู่ \"บนหัว\" ที่ตัวเองมองไม่เห็นแต่คนอื่นเห็นหมด ผลัดกันถามคำถามใช่/ไม่ใช่กับเพื่อน ๆ เพื่อไขคำใบ้ แล้วทายคำของตัวเองให้ถูกก่อนหมดเวลา ยิ่งใช้คำถามน้อยยิ่งได้คะแนนเยอะ",
    minPlayers: 3,
    maxPlayers: 8,
    isActive: true,
  },
];

async function main() {
  for (const game of games) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: {
        name: game.name,
        description: game.description,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        isActive: game.isActive,
      },
      create: game,
    });
  }
  console.log(`Seeded ${games.length} game(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
