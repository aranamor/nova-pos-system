import { pgTable, serial, varchar } from "drizzle-orm/pg-core";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  mobile: varchar("mobile", { length: 15 }).notNull().unique(),
  doctorName: varchar("doctor_name", { length: 255 }),
});

export type Customer = typeof customersTable.$inferSelect;
export type InsertCustomer = typeof customersTable.$inferInsert;
