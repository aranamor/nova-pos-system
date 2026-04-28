import {
  pgTable,
  serial,
  varchar,
  numeric,
  boolean,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Catalog of products. One row per unique product (by name).
// Stock is tracked separately in product_batches.
export const productsTable = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    manufacturer: varchar("manufacturer", { length: 255 }),
    hsn: varchar("hsn", { length: 255 }).notNull().default(""),
    content: text("content"), // composition
    packingSize: varchar("packing_size", { length: 100 }), // e.g. "10 x 10"
    category: varchar("category", { length: 100 }),

    // Unit conversion engine
    primaryUnit: varchar("primary_unit", { length: 50 }).notNull().default("PIECE"),
    secondaryUnit: varchar("secondary_unit", { length: 50 }),
    purchaseConvMultiplier: numeric("purchase_conv_multiplier", { precision: 12, scale: 4 })
      .notNull()
      .default("1"), // primary -> secondary (e.g. 1 Box = 10 Strips)
    saleUnit: varchar("sale_unit", { length: 50 }).notNull().default("PIECE"),
    sellingConvMultiplier: numeric("selling_conv_multiplier", { precision: 12, scale: 4 })
      .notNull()
      .default("1"), // secondary -> sale (e.g. 1 Strip = 10 Tablets)

    // Tax & pricing (per sale unit)
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    mrp: numeric("mrp", { precision: 10, scale: 2 }).notNull().default("0"),
    saleRateExcl: numeric("sale_rate_excl", { precision: 10, scale: 2 }).notNull().default("0"),
    saleRateIncl: numeric("sale_rate_incl", { precision: 10, scale: 2 }).notNull().default("0"),

    // Compliance flags
    isH1: boolean("is_h1").notNull().default(false),
    isNarcotic: boolean("is_narcotic").notNull().default(false),
    isPrescriptionRequired: boolean("is_prescription_required").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: false }).defaultNow(),
  },
  (t) => ({
    nameIdx: index("products_name_idx").on(t.name),
    nameUnique: uniqueIndex("products_name_unique").on(t.name),
    categoryIdx: index("products_category_idx").on(t.category),
  }),
);

export type Product = typeof productsTable.$inferSelect;
export type InsertProduct = typeof productsTable.$inferInsert;
