import {
  pgTable,
  serial,
  varchar,
  timestamp,
  boolean,
  integer,
  text,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "cashier"]);
export const userStatusEnum = pgEnum("user_status", ["active", "disabled"]);

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 64 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull().default("cashier"),
    status: userStatusEnum("status").notNull().default("active"),
    emailVerified: boolean("email_verified").notNull().default(false),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastLoginIp: varchar("last_login_ip", { length: 64 }),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    usernameIdx: uniqueIndex("users_username_lower_idx").on(t.username),
    emailIdx: uniqueIndex("users_email_lower_idx").on(t.email),
  }),
);

export const userSessionsTable = pgTable(
  "user_sessions",
  {
    id: varchar("id", { length: 128 }).primaryKey(), // session id (sid)
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("user_sessions_user_idx").on(t.userId),
  }),
);

export const passwordResetTokensTable = pgTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    requestIp: varchar("request_ip", { length: 64 }),
  },
  (t) => ({
    userIdx: index("password_reset_user_idx").on(t.userId),
  }),
);

export const authAuditLogTable = pgTable(
  "auth_audit_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    username: varchar("username", { length: 64 }),
    event: varchar("event", { length: 64 }).notNull(),
    success: boolean("success").notNull().default(true),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("auth_audit_user_idx").on(t.userId),
    eventIdx: index("auth_audit_event_idx").on(t.event),
    createdIdx: index("auth_audit_created_idx").on(t.createdAt),
  }),
);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
export type UserSession = typeof userSessionsTable.$inferSelect;
export type AuthAuditLog = typeof authAuditLogTable.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
