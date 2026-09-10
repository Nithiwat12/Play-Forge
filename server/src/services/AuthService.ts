import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import type { JwtPayload, PublicUser } from "../types";
import type { RegisterInput, LoginInput } from "../utils/validators";

const SALT_ROUNDS = 12;

function toPublicUser(user: {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as any });
}

export const AuthService = {
  async register(input: RegisterInput): Promise<{ user: PublicUser; token: string }> {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { username: input.username }] },
    });
    if (existing) {
      if (existing.email === input.email) {
        throw ApiError.conflict("An account with this email already exists");
      }
      throw ApiError.conflict("This username is already taken");
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        passwordHash,
      },
    });

    const token = signToken({ sub: user.id, username: user.username, email: user.email });
    return { user: toPublicUser(user), token };
  },

  async login(input: LoginInput): Promise<{ user: PublicUser; token: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const token = signToken({ sub: user.id, username: user.username, email: user.email });
    return { user: toPublicUser(user), token };
  },

  async getById(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound("User not found");
    return toPublicUser(user);
  },

  // Shared by the socket layer so socket auth uses the exact same
  // verification logic as REST auth.
  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, env.jwtSecret) as JwtPayload;
    } catch {
      throw ApiError.unauthorized("Invalid or expired token");
    }
  },
};
