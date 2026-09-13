INSERT INTO "games" ("id", "name", "slug", "description", "minPlayers", "maxPlayers", "isActive")
VALUES ('59595553-8739-400a-a9a6-b78d06f920fe', 'ito — ใจตรงกันไหม?', 'ito', 'ร่วมมือใบ้เลขลับและเปิดไพ่จากน้อยไปมาก เล่นแบบนั่งคุยกันหรือออนไลน์พิมพ์คำใบ้', 2, 8, true)
ON CONFLICT ("slug") DO NOTHING;
