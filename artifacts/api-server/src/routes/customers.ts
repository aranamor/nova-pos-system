import { Router, type IRouter } from "express";
import { db, customersTable, billsTable, billItemsTable } from "@workspace/db";
import { eq, asc, and, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/customers", async (req, res) => {
  try {
    const rows = await db.select().from(customersTable).orderBy(asc(customersTable.name));
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        mobile: r.mobile,
        doctor_name: r.doctorName,
      })),
    );
  } catch (err) {
    req.log?.error({ err }, "GET /customers failed");
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

router.get("/customers/:id/history", async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const rows = await db
      .select({
        product_name: billItemsTable.productName,
        last_purchase_date: sql<string>`to_char(max(${billsTable.billDate}), 'YYYY-MM-DD')`,
      })
      .from(billItemsTable)
      .innerJoin(billsTable, eq(billItemsTable.billId, billsTable.id))
      .where(and(eq(billsTable.customerId, customerId), eq(billsTable.status, "Completed")))
      .groupBy(billItemsTable.productName)
      .orderBy(desc(sql`max(${billsTable.billDate})`))
      .limit(20);
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }, "GET /customers/:id/history failed");
    res.status(500).json({ error: "Failed to fetch customer's purchase history." });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(customersTable).where(eq(customersTable.id, id));
    if (!row) return res.status(404).json({ error: "Customer not found" });
    res.json({ id: row.id, name: row.name, mobile: row.mobile, doctor_name: row.doctorName });
  } catch (err) {
    req.log?.error({ err }, "GET /customers/:id failed");
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

router.post("/customers", async (req, res) => {
  try {
    const { name, mobile, doctorName, doctor_name } = req.body ?? {};
    const [row] = await db
      .insert(customersTable)
      .values({ name, mobile, doctorName: doctorName ?? doctor_name ?? null })
      .returning({ id: customersTable.id });
    res.json({ message: "Customer added", id: row.id });
  } catch (err: any) {
    req.log?.error({ err }, "POST /customers failed");
    if (String(err?.code) === "23505") {
      return res.status(400).json({ error: "Customer with same mobile number already exists" });
    }
    res.status(500).json({ error: "Failed to add customer" });
  }
});

router.put("/customers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, mobile, doctor_name, doctorName } = req.body ?? {};
    await db
      .update(customersTable)
      .set({ name, mobile, doctorName: doctor_name ?? doctorName ?? null })
      .where(eq(customersTable.id, id));
    res.json({ message: "Customer updated successfully" });
  } catch (err: any) {
    req.log?.error({ err }, "PUT /customers/:id failed");
    if (String(err?.code) === "23505") {
      return res
        .status(400)
        .json({ error: "Another customer with this mobile number already exists." });
    }
    res.status(500).json({ error: "Failed to update customer" });
  }
});

router.delete("/customers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(customersTable).where(eq(customersTable.id, id));
    res.json({ message: "Customer deleted" });
  } catch (err) {
    req.log?.error({ err }, "DELETE /customers/:id failed");
    res.status(500).json({ error: "Delete failed" });
  }
});

export default router;
