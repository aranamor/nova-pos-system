import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  usersTable,
  userSessionsTable,
  passwordResetTokensTable,
  authAuditLogTable,
} from "@workspace/db/schema";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import {
  audit,
  bumpFailedAttempts,
  csrfMiddleware,
  ensureCsrfToken,
  findUserByLogin,
  getClientIp,
  hashPassword,
  isLocked,
  rateLimit,
  recordSession,
  requireAuth,
  requireRole,
  resetFailedAttempts,
  revokeSessionRow,
  safeCompare,
  touchSession,
  validatePasswordStrength,
  verifyPassword,
} from "../lib/auth";

const router: IRouter = Router();

// ---------- schemas ----------
const loginSchema = z.object({
  username: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(128),
});
const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, dot, dash and underscore"),
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().max(255).optional(),
  password: z.string().min(1).max(128),
});
const forgotSchema = z.object({ email: z.string().trim().email().max(255) });
const resetSchema = z.object({
  token: z.string().min(20).max(256),
  password: z.string().min(1).max(128),
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
});

// ---------- /me ----------
router.get("/me", async (req, res) => {
  if (req.session?.loggedIn && req.session.userId) {
    const csrfToken = ensureCsrfToken(req, res);
    await touchSession(req).catch(() => {});
    const [u] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        fullName: usersTable.fullName,
        role: usersTable.role,
        status: usersTable.status,
        emailVerified: usersTable.emailVerified,
        mustChangePassword: usersTable.mustChangePassword,
        lastLoginAt: usersTable.lastLoginAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId))
      .limit(1);
    if (!u || u.status !== "active") {
      req.session.destroy(() => {});
      return res.json({ loggedIn: false });
    }
    return res.json({ loggedIn: true, user: u, csrfToken });
  }
  const csrfToken = ensureCsrfToken(req, res);
  res.json({ loggedIn: false, csrfToken });
});

// ---------- /login ----------
router.post(
  "/login",
  rateLimit({ keyPrefix: "login", max: 10, windowMs: 15 * 60_000 }),
  async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }
    const { username, password } = parsed.data;

    const user = await findUserByLogin(username);
    if (!user) {
      await audit(req, "login_failed", { username, success: false, detail: "no_user" });
      return res.status(401).json({ success: false, message: "Invalid username or password" });
    }
    if (user.status !== "active") {
      await audit(req, "login_failed", {
        userId: user.id,
        username: user.username,
        success: false,
        detail: "disabled",
      });
      return res.status(403).json({ success: false, message: "Account disabled" });
    }
    if (isLocked(user)) {
      await audit(req, "login_locked", {
        userId: user.id,
        username: user.username,
        success: false,
      });
      return res
        .status(423)
        .json({ success: false, message: "Account temporarily locked. Try again later." });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      const { locked } = await bumpFailedAttempts(user);
      await audit(req, "login_failed", {
        userId: user.id,
        username: user.username,
        success: false,
        detail: locked ? "locked_now" : "bad_password",
      });
      return res.status(401).json({ success: false, message: "Invalid username or password" });
    }

    // Success - regenerate session id to prevent fixation
    await new Promise<void>((resolve) =>
      req.session.regenerate((err) => {
        if (err) req.log?.error({ err }, "regenerate failed");
        resolve();
      }),
    );
    req.session.loggedIn = true;
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    ensureCsrfToken(req, res);

    await new Promise<void>((resolve) => req.session.save(() => resolve()));
    await resetFailedAttempts(user.id, getClientIp(req));
    await recordSession(req, user.id).catch(() => {});
    await audit(req, "login_success", { userId: user.id, username: user.username });

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  },
);

// ---------- /signup (admin-only by default; bootstraps the first admin) ----------
router.post(
  "/signup",
  rateLimit({ keyPrefix: "signup", max: 5, windowMs: 60 * 60_000 }),
  async (req, res, next) => {
    // Bootstrap: allow if zero users exist
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable);
    if (Number(count) === 0) return next();
    // Otherwise require admin + CSRF
    return csrfMiddleware(req, res, () => requireRole("admin")(req, res, next));
  },
  async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { username, email, fullName, password } = parsed.data;
    const pwErr = validatePasswordStrength(password);
    if (pwErr) return res.status(400).json({ success: false, message: pwErr });

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable);
    const isFirstUser = Number(count) === 0;

    const exists = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        sql`lower(${usersTable.username}) = ${username.toLowerCase()} OR lower(${usersTable.email}) = ${email.toLowerCase()}`,
      )
      .limit(1);
    if (exists.length) {
      return res.status(409).json({ success: false, message: "Username or email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const [created] = await db
      .insert(usersTable)
      .values({
        username,
        email: email.toLowerCase(),
        fullName: fullName ?? null,
        passwordHash,
        role: isFirstUser ? "admin" : "cashier",
        status: "active",
        emailVerified: isFirstUser,
      })
      .returning({ id: usersTable.id, username: usersTable.username, role: usersTable.role });

    await audit(req, isFirstUser ? "signup" : "user_created", {
      userId: created.id,
      username: created.username,
      detail: isFirstUser ? "bootstrap_admin" : `role=${created.role}`,
    });

    res.status(201).json({
      success: true,
      message: isFirstUser ? "Administrator account created" : "User created",
      user: { id: created.id, username: created.username, role: created.role },
    });
  },
);

// ---------- /logout ----------
router.post("/logout", csrfMiddleware, async (req, res) => {
  const userId = req.session?.userId ?? null;
  const username = req.session?.username ?? null;
  const sid = req.sessionID;
  if (sid && userId) {
    await db
      .update(userSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(userSessionsTable.id, sid))
      .catch(() => {});
  }
  req.session.destroy((err) => {
    if (err) {
      req.log?.error({ err }, "logout failed");
      return res.status(500).json({ message: "Could not log out." });
    }
    res.clearCookie("apexrx.sid");
    res.clearCookie("apexrx.csrf");
    audit(null, "logout", { userId, username });
    res.json({ success: true, message: "Logged out successfully" });
  });
});

// ---------- /forgot-password ----------
router.post(
  "/forgot-password",
  rateLimit({ keyPrefix: "forgot", max: 5, windowMs: 60 * 60_000 }),
  async (req, res) => {
    const parsed = forgotSchema.safeParse(req.body);
    // Always respond with the same message to prevent enumeration
    const respond = () =>
      res.json({
        success: true,
        message: "If an account exists for that email, a reset link has been issued.",
      });
    if (!parsed.success) return respond();
    const email = parsed.data.email.toLowerCase();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${email}`)
      .limit(1);

    let devToken: string | null = null;
    if (user && user.status === "active") {
      const raw = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
      await db.insert(passwordResetTokensTable).values({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60_000),
        requestIp: getClientIp(req),
      });
      await audit(req, "password_reset_request", {
        userId: user.id,
        username: user.username,
      });
      // SMTP not configured — surface the token in development for the operator.
      devToken = raw;
      req.log?.info({ userId: user.id, email }, "Password reset token issued");
    }

    if (process.env["NODE_ENV"] !== "production" && devToken) {
      return res.json({
        success: true,
        message:
          "If an account exists for that email, a reset link has been issued. (Dev: token returned below)",
        devToken,
      });
    }
    respond();
  },
);

// ---------- /reset-password ----------
router.post(
  "/reset-password",
  rateLimit({ keyPrefix: "reset", max: 10, windowMs: 60 * 60_000 }),
  async (req, res) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ success: false, message: "Invalid input" });
    const { token, password } = parsed.data;
    const pwErr = validatePasswordStrength(password);
    if (pwErr) return res.status(400).json({ success: false, message: pwErr });

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [row] = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.tokenHash, tokenHash),
          isNull(passwordResetTokensTable.usedAt),
          gt(passwordResetTokensTable.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!row) {
      return res.status(400).json({ success: false, message: "Invalid or expired token" });
    }
    const passwordHash = await hashPassword(password);
    await db
      .update(usersTable)
      .set({
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, row.userId));
    await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, row.id));
    // Invalidate all existing sessions for that user
    await db
      .update(userSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(userSessionsTable.userId, row.userId))
      .catch(() => {});

    await audit(req, "password_reset_complete", { userId: row.userId });
    res.json({ success: true, message: "Password updated. Please sign in." });
  },
);

// ---------- /change-password ----------
router.post("/change-password", requireAuth, csrfMiddleware, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid input" });
  const { currentPassword, newPassword } = parsed.data;
  if (currentPassword === newPassword)
    return res.status(400).json({ success: false, message: "New password must differ" });
  const pwErr = validatePasswordStrength(newPassword);
  if (pwErr) return res.status(400).json({ success: false, message: pwErr });

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);
  if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ success: false, message: "Current password is incorrect" });

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(usersTable)
    .set({
      passwordHash,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id));
  await audit(req, "password_change", { userId: user.id });
  res.json({ success: true, message: "Password updated" });
});

// ---------- /sessions ----------
router.get("/sessions", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(userSessionsTable)
    .where(eq(userSessionsTable.userId, req.session.userId!))
    .orderBy(desc(userSessionsTable.lastSeenAt))
    .limit(50);
  res.json(
    rows.map((r) => ({
      id: r.id,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      createdAt: r.createdAt,
      lastSeenAt: r.lastSeenAt,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      current: r.id === req.sessionID,
    })),
  );
});

router.post("/sessions/:id/revoke", requireAuth, csrfMiddleware, async (req, res) => {
  const sid = req.params.id;
  if (!sid) return res.status(400).json({ error: "Missing session id" });
  if (sid === req.sessionID)
    return res.status(400).json({ error: "Use logout to end the current session" });
  await revokeSessionRow(sid, req.session.userId!);
  await audit(req, "session_revoked", { detail: sid });
  res.json({ success: true });
});

// ---------- /audit-log (admin) ----------
router.get("/audit-log", requireAuth, requireRole("admin"), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const rows = await db
    .select()
    .from(authAuditLogTable)
    .orderBy(desc(authAuditLogTable.createdAt))
    .limit(limit);
  res.json(rows);
});

// ---------- /users (admin) ----------
const userUpdateSchema = z.object({
  role: z.enum(["admin", "manager", "cashier"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  fullName: z.string().trim().max(255).nullable().optional(),
});

router.get("/users", requireAuth, requireRole("admin"), async (_req, res) => {
  const rows = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      fullName: usersTable.fullName,
      role: usersTable.role,
      status: usersTable.status,
      lastLoginAt: usersTable.lastLoginAt,
      lastLoginIp: usersTable.lastLoginIp,
      createdAt: usersTable.createdAt,
      mustChangePassword: usersTable.mustChangePassword,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));
  res.json(rows);
});

router.patch("/users/:id", requireAuth, requireRole("admin"), csrfMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  const parsed = userUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  if (id === req.session.userId && parsed.data.role && parsed.data.role !== "admin") {
    return res.status(400).json({ error: "Cannot demote yourself" });
  }
  if (id === req.session.userId && parsed.data.status === "disabled") {
    return res.status(400).json({ error: "Cannot disable yourself" });
  }
  await db
    .update(usersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(usersTable.id, id));
  await audit(req, parsed.data.role ? "role_changed" : parsed.data.status === "disabled" ? "user_disabled" : "user_enabled", {
    detail: `target=${id} ${JSON.stringify(parsed.data)}`,
  });
  res.json({ success: true });
});

router.post(
  "/users/:id/reset-password",
  requireAuth,
  requireRole("admin"),
  csrfMiddleware,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
    const tempPassword =
      "Tmp-" +
      crypto.randomBytes(6).toString("base64url").replace(/[^A-Za-z0-9]/g, "") +
      "!9";
    const hash = await hashPassword(tempPassword);
    await db
      .update(usersTable)
      .set({
        passwordHash: hash,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id));
    // revoke their sessions
    await db
      .update(userSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(userSessionsTable.userId, id))
      .catch(() => {});
    await audit(req, "password_reset_complete", {
      detail: `admin_reset target=${id}`,
    });
    res.json({ success: true, tempPassword });
  },
);

// CSRF-aware safeCompare helper used above is exported from lib/auth
void safeCompare;

export default router;
