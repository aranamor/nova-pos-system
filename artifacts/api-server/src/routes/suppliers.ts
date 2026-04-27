import { Router, type IRouter } from "express";
import { db, suppliersTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/suppliers", async (req, res) => {
  try {
    const rows = await db.select().from(suppliersTable).orderBy(asc(suppliersTable.name));
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        contact_person: r.contactPerson,
        phone: r.phone,
        email: r.email,
        address: r.address,
      })),
    );
  } catch (err) {
    req.log?.error({ err }, "GET /suppliers failed");
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
});

router.post("/suppliers", async (req, res) => {
  try {
    const b = req.body ?? {};
    const [row] = await db
      .insert(suppliersTable)
      .values({
        name: b.name,
        contactPerson: b.contact_person ?? b.contactPerson ?? null,
        phone: b.phone ?? null,
        email: b.email ?? null,
        address: b.address ?? null,
      })
      .returning({ id: suppliersTable.id });
    res.json({ message: "Supplier added", id: row.id });
  } catch (err: any) {
    req.log?.error({ err }, "POST /suppliers failed");
    if (String(err?.code) === "23505") {
      return res.status(400).json({ error: "Supplier with this name already exists" });
    }
    res.status(500).json({ error: "Failed to add supplier" });
  }
});

router.put("/suppliers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    await db
      .update(suppliersTable)
      .set({
        name: b.name,
        contactPerson: b.contact_person ?? b.contactPerson ?? null,
        phone: b.phone ?? null,
        email: b.email ?? null,
        address: b.address ?? null,
      })
      .where(eq(suppliersTable.id, id));
    res.json({ message: "Supplier updated" });
  } catch (err) {
    req.log?.error({ err }, "PUT /suppliers/:id failed");
    res.status(500).json({ error: "Failed to update supplier" });
  }
});

router.delete("/suppliers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
    res.json({ message: "Supplier deleted" });
  } catch (err) {
    req.log?.error({ err }, "DELETE /suppliers/:id failed");
    res.status(500).json({ error: "Delete failed" });
  }
});

export default router;
