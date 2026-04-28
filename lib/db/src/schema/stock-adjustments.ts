import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { productBatchesTable } from "./product-batches";

export const stockAdjustmentsTable = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => productsTable.id, {
    onDelete: "set null",
  }),
  batchId: integer("batch_id").references(() => productBatchesTable.id, {
    onDelete: "set null",
  }),
  quantityAdjusted: numeric("quantity_adjusted", { precision: 12, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 50 }).notNull(),
  notes: text("notes"),
  adjustmentDate: timestamp("adjustment_date", { withTimezone: false }).defaultNow(),
});

export type StockAdjustment = typeof stockAdjustmentsTable.$inferSelect;
export type InsertStockAdjustment = typeof stockAdjustmentsTable.$inferInsert;
