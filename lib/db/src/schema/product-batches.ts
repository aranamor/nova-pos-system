import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { productsTable } from "./products";

// Physical stock per batch. Quantity is always in "sale units"
// (the smallest sellable unit defined on the parent product).
export const productBatchesTable = pgTable(
  "product_batches",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    batchNumber: varchar("batch_number", { length: 100 }).notNull(),
    expiry: varchar("expiry", { length: 7 }).notNull(), // YYYY-MM
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("0"),
    purchaseRate: numeric("purchase_rate", { precision: 10, scale: 2 }).notNull().default("0"), // per sale unit
    mrp: numeric("mrp", { precision: 10, scale: 2 }).notNull().default("0"), // snapshot from purchase
    createdAt: timestamp("created_at", { withTimezone: false }).defaultNow(),
  },
  (t) => ({
    productIdx: index("product_batches_product_idx").on(t.productId),
    batchIdx: index("product_batches_batch_idx").on(t.batchNumber),
    uniqueProductBatch: uniqueIndex("product_batches_product_batch_unique").on(
      t.productId,
      t.batchNumber,
    ),
  }),
);

export type ProductBatch = typeof productBatchesTable.$inferSelect;
export type InsertProductBatch = typeof productBatchesTable.$inferInsert;
