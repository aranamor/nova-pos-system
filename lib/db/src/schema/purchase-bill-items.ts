import { pgTable, serial, varchar, integer, numeric } from "drizzle-orm/pg-core";
import { purchaseBillsTable } from "./purchase-bills";
import { productsTable } from "./products";
import { productBatchesTable } from "./product-batches";

export const purchaseBillItemsTable = pgTable("purchase_bill_items", {
  id: serial("id").primaryKey(),
  purchaseBillId: integer("purchase_bill_id")
    .notNull()
    .references(() => purchaseBillsTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  batchId: integer("batch_id").references(() => productBatchesTable.id, {
    onDelete: "set null",
  }),
  productName: varchar("product_name", { length: 255 }).notNull(),
  hsn: varchar("hsn", { length: 255 }).notNull().default(""),
  batch: varchar("batch", { length: 100 }).notNull(),
  packaging: varchar("packaging", { length: 50 }),

  // Purchasing UoM
  purchasingUom: varchar("purchasing_uom", { length: 20 }).notNull().default("Primary"), // 'Primary' | 'Secondary'
  unitLabel: varchar("unit_label", { length: 50 }), // e.g. 'Box' or 'Strip'
  purchaseConvAtTime: numeric("purchase_conv_at_time", { precision: 12, scale: 4 })
    .notNull()
    .default("1"),
  sellingConvAtTime: numeric("selling_conv_at_time", { precision: 12, scale: 4 })
    .notNull()
    .default("1"),

  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(), // in chosen UoM
  freeQuantity: numeric("free_quantity", { precision: 12, scale: 2 }).notNull().default("0"), // in chosen UoM
  saleUnitsAdded: numeric("sale_units_added", { precision: 14, scale: 2 }).notNull().default("0"),

  mrp: numeric("mrp", { precision: 10, scale: 2 }).notNull(), // per sale unit
  purchaseRate: numeric("purchase_rate", { precision: 10, scale: 2 }).notNull(), // per chosen UoM
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
