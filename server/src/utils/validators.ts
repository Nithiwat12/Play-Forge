import { roleConfigSchema } from "../games/core/roles";
import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร")
    .max(20, "ชื่อผู้ใช้ต้องไม่เกิน 20 ตัวอักษร")
    .regex(/^[a-zA-Z0-9_]+$/, "ชื่อผู้ใช้ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข และขีดล่างเท่านั้น"),
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง"),
  password: z
    .string()
    .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    .max(128, "รหัสผ่านยาวเกินไป"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

export const roomSettingsSchema = z
  .object({
    roleConfig: roleConfigSchema.optional(),
    // Minutes, converted to seconds before being stored/used by the engine.
    discussionMinutes: z.coerce.number().int().min(3).max(20).optional(),
    // How many rounds this room's match will run for. Left unset means
    // unlimited - the host can keep hitting "replay" indefinitely.
    numberOfRounds: z.coerce.number().int().min(1).max(20).optional(),
    // How each round's location/topic gets picked - see RoomSettings.
    categoryMode: z.enum(["RANDOM", "FIXED", "PER_ROUND"]).optional(),
    // Required only for "FIXED" (checked below) - the id validation itself
    // is left to the game engine, since only it knows what ids are valid.
    category: z.string().trim().min(1).max(50).optional(),
  })
  .refine((data) => data.categoryMode !== "FIXED" || Boolean(data.category), {
    message: "กรุณาเลือกหมวดหมู่เมื่อกำหนดหมวดหมู่คงที่",
    path: ["category"],
  });

export const createRoomSchema = z.object({
  gameSlug: z.string().trim().min(1, "ต้องระบุ gameSlug"),
  roomName: z.string().trim().min(3).max(40),
  maxPlayers: z.coerce.number().int().min(2).max(20),
  usePassword: z.boolean().optional().default(false),
  password: z.string().min(4).max(64).optional(),
  settings: roomSettingsSchema.optional(),
}).refine((data) => !data.usePassword || (data.password && data.password.length >= 4), {
  message: "ต้องกรอกรหัสผ่านเมื่อเปิดใช้การป้องกันด้วยรหัสผ่าน",
  path: ["password"],
});

export const joinRoomSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, "กรุณากรอกรหัสห้อง"),
  password: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
