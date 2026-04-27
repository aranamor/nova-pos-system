import { pgTable, serial, varchar, integer, numeric, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { suppliersTable } from "./suppliers";

export const purchaseBillsTable = pgTable("purchase_bills", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  supplierName: varchar("supplier_name", { length: 255 }).notNull(),
  billNumber: varchar("bill_number", { length: 255 }).notNull(),
  billDate: date("bill_date").notNull(),
  taxType: varchar("tax_type", { length: 10 }).notNull(),
  totalPreTax: numeric("total_pre_tax", { precision: 12, scale: 2 }).notNull().default("0"),
  overallDiscountPercent: numeric("overall_discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  overallDiscountAmount: numeric("overall_discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  taxableAmount: numeric("taxable_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalGstAmount: numeric("total_gst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  rounding: numeric("rounding", { precision: 10, scale: 2 }).notNull().default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 20 }).notNull().default("Draft"),
  isLocked: boolean("is_locked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow(),
});

export type PurchaseBill = typeof purchaseBillsTable.$inferSelect;
export type InsertPurchaseBill = typeof purchaseBillsTable.$inferInsert;
