import { pgTable, varchar } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  settingKey: varchar("setting_key", { length: 255 }).primaryKey(),
  settingValue: varchar("setting_value", { length: 255 }),
});

export type Setting = typeof settingsTable.$inferSelect;
