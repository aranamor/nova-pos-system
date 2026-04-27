import { pgTable, serial, varchar, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const billsTable = pgTable("bills", {
  id: serial("id").primaryKey(),
  billNumber: varchar("bill_number", { length: 255 }).notNull(),
  billDate: timestamp("bill_date", { withTimezone: false }).notNull().defaultNow(),
  patientName: varchar("patient_name", { length: 255 }).notNull(),
  patientMobile: varchar("patient_mobile", { length: 15 }).notNull(),
  doctorName: varchar("doctor_name", { length: 255 }),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  overallDiscountPercent: numeric("overall_discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  totalDiscount: numeric("total_discount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalCgst: numeric("total_cgst", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSgst: numeric("total_sgst", { precision: 12, scale: 2 }).notNull().default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 20 }).notNull().default("Completed"),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
});

export type Bill = typeof billsTable.$inferSelect;
export type InsertBill = typeof billsTable.$inferInsert;
