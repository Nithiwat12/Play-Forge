-- Add only the new catalog entry; existing games and schema are untouched.
INSERT INTO "games" ("id", "name", "slug", "description", "minPlayers", "maxPlayers", "isActive")
VALUES ('3e6ee97e-8848-4d81-9ecb-0e568ff0629e', 'Island Betrayal', 'island_betrayal', 'ติดเกาะกับผู้เล่น 4–8 คน สำรวจ เก็บของ แลกเปลี่ยน และร่วมสร้างเรือหนี แต่ทุกคนมีเป้าหมายลับและเลือกทรยศได้เมื่อค่ำคืนมาเยือน', 4, 8, true)
ON CONFLICT ("slug") DO NOTHING;
