import { pgTable, serial, varchar, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const stockAdjustmentsTable = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  quantityAdjusted: numeric("quantity_adjusted", { precision: 10, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 50 }).notNull(),
  notes: text("notes"),
  adjustmentDate: timestamp("adjustment_date", { withTimezone: false }).defaultNow(),
});

export type StockAdjustment = typeof stockAdjustmentsTable.$inferSelect;
export type InsertStockAdjustment = typeof stockAdjustmentsTable.$inferInsert;
