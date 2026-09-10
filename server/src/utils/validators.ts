import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers, and underscores"),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createRoomSchema = z.object({
  gameSlug: z.string().trim().min(1, "gameSlug is required"),
  roomName: z.string().trim().min(3).max(40),
  maxPlayers: z.coerce.number().int().min(2).max(20),
  usePassword: z.boolean().optional().default(false),
  password: z.string().min(4).max(64).optional(),
}).refine((data) => !data.usePassword || (data.password && data.password.length >= 4), {
  message: "Password is required when password protection is enabled",
  path: ["password"],
});

export const joinRoomSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, "Room code is required"),
  password: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
