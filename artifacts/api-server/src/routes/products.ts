import { Router, type IRouter } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/products", async (req, res) => {
  try {
    const rows = await db.select().from(productsTable).orderBy(asc(productsTable.name));
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }, "GET /products failed");
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    if (!row) return res.status(404).json({ error: "Product not found" });
    res.json(row);
  } catch (err) {
    req.log?.error({ err }, "GET /products/:id failed");
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

router.post("/products", async (req, res) => {
  try {
    const b = req.body ?? {};
    const inserted = await db
      .insert(productsTable)
      .values({
        name: b.name,
        hsn: b.hsn,
        batch: b.batch,
        quantity: String(b.quantity ?? 0),
        packaging: b.packaging ?? null,
        mrp: String(b.mrp ?? 0),
        purchaseRate: String(b.purchase_rate ?? b.purchaseRate ?? 0),
        saleRate: String(b.saleRate ?? b.sale_rate ?? 0),
        saleRateInclusive: String(b.saleRateInclusive ?? b.sale_rate_inclusive ?? 0),
        expiry: b.expiry,
        cgst: String(b.cgst ?? 0),
        sgst: String(b.sgst ?? 0),
      })
      .returning({ id: productsTable.id });
    res.json({ message: "Product added", id: inserted[0]?.id });
  } catch (err: any) {
    req.log?.error({ err }, "POST /products failed");
    if (String(err?.code) === "23505") {
      return res.status(400).json({ error: "Product with same name & batch already exists" });
    }
    res.status(500).json({ error: "Failed to add product" });
  }
});

router.put("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const updates: Record<string, unknown> = {};
    const map: Record<string, string> = {
      name: "name",
      hsn: "hsn",
      batch: "batch",
      packaging: "packaging",
      expiry: "expiry",
    };
    const numericMap: Record<string, string> = {
      quantity: "quantity",
      mrp: "mrp",
      purchase_rate: "purchaseRate",
      purchaseRate: "purchaseRate",
      sale_rate: "saleRate",
      saleRate: "saleRate",
      sale_rate_inclusive: "saleRateInclusive",
      saleRateInclusive: "saleRateInclusive",
      cgst: "cgst",
      sgst: "sgst",
    };
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) updates[col] = b[k];
    }
    for (const [k, col] of Object.entries(numericMap)) {
      if (b[k] !== undefined) updates[col] = String(b[k]);
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    await db.update(productsTable).set(updates).where(eq(productsTable.id, id));
    res.json({ message: "Product updated" });
  } catch (err) {
    req.log?.error({ err }, "PUT /products/:id failed");
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.json({ message: "Product deleted" });
  } catch (err) {
    req.log?.error({ err }, "DELETE /products/:id failed");
    res.status(500).json({ error: "Delete failed" });
  }
});

export default router;
