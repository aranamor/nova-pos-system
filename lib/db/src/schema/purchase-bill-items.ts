import { pgTable, serial, varchar, integer, numeric } from "drizzle-orm/pg-core";
import { purchaseBillsTable } from "./purchase-bills";

export const purchaseBillItemsTable = pgTable("purchase_bill_items", {
  id: serial("id").primaryKey(),
  purchaseBillId: integer("purchase_bill_id").notNull().references(() => purchaseBillsTable.id, { onDelete: "cascade" }),
  productName: varchar("product_name", { length: 255 }).notNull(),
  hsn: varchar("hsn", { length: 255 }).notNull(),
  batch: varchar("batch", { length: 255 }).notNull(),
  packaging: varchar("packaging", { length: 50 }),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  freeQuantity: numeric("free_quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  mrp: numeric("mrp", { precision: 10, scale: 2 }).notNull(),
  purchaseRate: numeric("purchase_rate", { precision: 10, scale: 2 }).notNull(),
  saleRate: numeric("sale_rate", { precision: 10, scale: 2 }).notNull(),
  saleRateInclusive: numeric("sale_rate_inclusive", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 5, scale: 2 }).default("0"),
  expiry: varchar("expiry", { length: 7 }).notNull(),
  purchaseCgst: numeric("purchase_cgst", { precision: 5, scale: 2 }).notNull().default("0"),
  purchaseSgst: numeric("purchase_sgst", { precision: 5, scale: 2 }).notNull().default("0"),
  purchaseIgst: numeric("purchase_igst", { precision: 5, scale: 2 }).notNull().default("0"),
  saleCgst: numeric("sale_cgst", { precision: 5, scale: 2 }).notNull().default("0"),
  saleSgst: numeric("sale_sgst", { precision: 5, scale: 2 }).notNull().default("0"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
});

export type PurchaseBillItem = typeof purchaseBillItemsTable.$inferSelect;
export type InsertPurchaseBillItem = typeof purchaseBillItemsTable.$inferInsert;
