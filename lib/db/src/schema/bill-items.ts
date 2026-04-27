import { pgTable, serial, varchar, integer, numeric } from "drizzle-orm/pg-core";
import { billsTable } from "./bills";
import { productsTable } from "./products";

export const billItemsTable = pgTable("bill_items", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id").notNull().references(() => billsTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  productName: varchar("product_name", { length: 255 }).notNull(),
  hsn: varchar("hsn", { length: 255 }),
  batch: varchar("batch", { length: 255 }),
  mrp: numeric("mrp", { precision: 10, scale: 2 }),
  rate: numeric("rate", { precision: 10, scale: 2 }),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  expiry: varchar("expiry", { length: 7 }),
  discount: numeric("discount", { precision: 5, scale: 2 }).default("0"),
  cgst: numeric("cgst", { precision: 5, scale: 2 }).default("0"),
  sgst: numeric("sgst", { precision: 5, scale: 2 }).default("0"),
});

export type BillItem = typeof billItemsTable.$inferSelect;
export type InsertBillItem = typeof billItemsTable.$inferInsert;
