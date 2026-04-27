import { pgTable, serial, varchar, numeric, index, uniqueIndex } from "drizzle-orm/pg-core";

export const productsTable = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    hsn: varchar("hsn", { length: 255 }).notNull(),
    batch: varchar("batch", { length: 255 }).notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("0"),
    packaging: varchar("packaging", { length: 50 }),
    mrp: numeric("mrp", { precision: 10, scale: 2 }).notNull().default("0"),
    purchaseRate: numeric("purchase_rate", { precision: 10, scale: 2 }).notNull().default("0"),
    saleRate: numeric("sale_rate", { precision: 10, scale: 2 }).notNull().default("0"),
    saleRateInclusive: numeric("sale_rate_inclusive", { precision: 10, scale: 2 }).notNull().default("0"),
    expiry: varchar("expiry", { length: 7 }).notNull(),
    cgst: numeric("cgst", { precision: 5, scale: 2 }).notNull().default("0"),
    sgst: numeric("sgst", { precision: 5, scale: 2 }).notNull().default("0"),
  },
  (t) => ({
    nameIdx: index("products_name_idx").on(t.name),
    batchIdx: index("products_batch_idx").on(t.batch),
    uniqueNameBatch: uniqueIndex("products_name_batch_unique").on(t.name, t.batch),
  }),
);

export type Product = typeof productsTable.$inferSelect;
export type InsertProduct = typeof productsTable.$inferInsert;
