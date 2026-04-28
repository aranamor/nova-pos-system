import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import {
  usersTable,
  authAuditLogTable,
  userSessionsTable,
  type User,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    loggedIn?: boolean;
    userId?: number;
    username?: string;
    role?: "admin" | "manager" | "cashier";
    csrfToken?: string;
  }
}

// ---------- Password policy ----------
export const PASSWORD_POLICY = {
  minLength: 10,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSymbol: true,
};

export function validatePasswordStrength(pw: string): string | null {
  if (typeof pw !== "string") return "Password is required";
  if (pw.length < PASSWORD_POLICY.minLength)
    return `Password must be at least ${PASSWORD_POLICY.minLength} characters`;
  if (pw.length > 128) return "Password is too long";
  if (PASSWORD_POLICY.requireUpper && !/[A-Z]/.test(pw))
    return "Password must contain an uppercase letter";
  if (PASSWORD_POLICY.requireLower && !/[a-z]/.test(pw))
    return "Password must contain a lowercase letter";
  if (PASSWORD_POLICY.requireDigit && !/\d/.test(pw))
    return "Password must contain a digit";
  if (PASSWORD_POLICY.requireSymbol && !/[^A-Za-z0-9]/.test(pw))
    return "Password must contain a symbol";
  return null;
}

export const BCRYPT_COST = 12;
export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, BCRYPT_COST);
}
export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(pw, hash);
  } catch {
    return false;
  }
}

// Constant-time compare for tokens
export function safeCompare(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// ---------- Lockout policy ----------
export const LOCKOUT = {
  maxAttempts: 5,
  windowMinutes: 15,
  lockMinutes: 15,
};

// ---------- Request helpers ----------
export function getClientIp(req: Request): string {
  const fwd = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return fwd || req.ip || req.socket?.remoteAddress || "unknown";
}
export function getUserAgent(req: Request): string {
  return (req.headers["user-agent"] as string | undefined) ?? "";
}

// ---------- Audit log ----------
export type AuthEvent =
  | "login_success"
  | "login_failed"
  | "login_locked"
  | "logout"
  | "signup"
  | "password_reset_request"
  | "password_reset_complete"
  | "password_change"
  | "role_changed"
  | "user_created"
  | "user_disabled"
  | "user_enabled"
  | "session_revoked"
  | "csrf_failed"
  | "rate_limited";

export async function audit(
  req: Request | null,
  event: AuthEvent,
  opts: { userId?: number | null; username?: string | null; success?: boolean; detail?: string } = {},
) {
  try {
    await db.insert(authAuditLogTable).values({
      userId: opts.userId ?? req?.session?.userId ?? null,
      username: opts.username ?? req?.session?.username ?? null,
      event,
      success: opts.success ?? true,
      ipAddress: req ? getClientIp(req) : null,
      userAgent: req ? getUserAgent(req) : null,
      detail: opts.detail ?? null,
    });
  } catch {
    // never let audit failures break a request
  }
}

// ---------- CSRF (double-submit cookie) ----------
export function ensureCsrfToken(req: Request, res: Response): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  res.cookie("apexrx.csrf", req.session.csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
  });
  return req.session.csrfToken;
}

const CSRF_EXEMPT_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_PATHS = new Set(["/api/login", "/api/forgot-password", "/api/reset-password"]);

export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  if (CSRF_EXEMPT_METHODS.has(req.method)) return next();
  if (CSRF_EXEMPT_PATHS.has(req.path) || CSRF_EXEMPT_PATHS.has(req.originalUrl.split("?")[0]!))
    return next();
  const header = (req.headers["x-csrf-token"] as string | undefined) ?? "";
  const sessionToken = req.session?.csrfToken ?? "";
  if (!header || !sessionToken || !safeCompare(header, sessionToken)) {
    audit(req, "csrf_failed", { success: false, detail: req.path });
    return res.status(403).json({ error: "Invalid CSRF token" });
  }
  next();
}

// ---------- Auth middleware ----------
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.loggedIn && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}

export function requireRole(...roles: Array<"admin" | "manager" | "cashier">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.loggedIn || !req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!req.session.role || !roles.includes(req.session.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// ---------- Rate limiter (in-memory, per-route+key) ----------
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(opts: { keyPrefix: string; max: number; windowMs: number }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const key = `${opts.keyPrefix}:${ip}`;
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }
    b.count += 1;
    if (b.count > opts.max) {
      const retry = Math.ceil((b.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retry));
      audit(req, "rate_limited", { success: false, detail: opts.keyPrefix });
      return res.status(429).json({ error: "Too many requests. Please try again shortly." });
    }
    next();
  };
}

// Cleanup buckets occasionally
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
}, 60_000).unref?.();

// ---------- User helpers ----------
export async function findUserByLogin(login: string): Promise<User | null> {
  const norm = login.trim().toLowerCase();
  const rows = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.username}) = ${norm} OR lower(${usersTable.email}) = ${norm}`)
    .limit(1);
  return rows[0] ?? null;
}

export async function bumpFailedAttempts(user: User): Promise<{ locked: boolean }> {
  const next = user.failedLoginAttempts + 1;
  const shouldLock = next >= LOCKOUT.maxAttempts;
  await db
    .update(usersTable)
    .set({
      failedLoginAttempts: next,
      lockedUntil: shouldLock
        ? new Date(Date.now() + LOCKOUT.lockMinutes * 60_000)
        : user.lockedUntil,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id));
  return { locked: shouldLock };
}

export async function resetFailedAttempts(userId: number, ip: string) {
  await db
    .update(usersTable)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ip,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));
}

export function isLocked(user: User): boolean {
  return !!(user.lockedUntil && user.lockedUntil.getTime() > Date.now());
}

export async function recordSession(req: Request, userId: number) {
  if (!req.sessionID) return;
  const expires =
    req.session.cookie.expires ??
    new Date(Date.now() + (req.session.cookie.maxAge ?? 12 * 60 * 60 * 1000));
  await db
    .insert(userSessionsTable)
    .values({
      id: req.sessionID,
      userId,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      expiresAt: expires,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userSessionsTable.id,
      set: {
        lastSeenAt: new Date(),
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        expiresAt: expires,
      },
    });
}

export async function touchSession(req: Request) {
  if (!req.sessionID || !req.session?.userId) return;
  await db
    .update(userSessionsTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(userSessionsTable.id, req.sessionID));
}

export async function revokeSessionRow(sessionId: string, userId: number) {
  await db
    .update(userSessionsTable)
    .set({ revokedAt: new Date() })
    .where(sql`${userSessionsTable.id} = ${sessionId} AND ${userSessionsTable.userId} = ${userId}`);
}
