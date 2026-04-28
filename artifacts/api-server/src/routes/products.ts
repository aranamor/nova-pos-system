import { Router, type IRouter } from "express";
import { db, productsTable, productBatchesTable } from "@workspace/db";
import { eq, asc, sql, ilike, or } from "drizzle-orm";

const router: IRouter = Router();

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

// List catalog products with computed total stock and availability.
// Optional ?status=Available|NotAvailable|All (default All)
router.get("/products", async (req, res) => {
  try {
    const status = String(req.query.status ?? "All");
    const search = String(req.query.q ?? req.query.search ?? "").trim();

    const result = await db.execute(sql`
      select
        p.*,
        coalesce(sum(b.quantity), 0)::float8 as total_quantity,
        count(b.id)::int as batch_count,
        min(b.expiry) as earliest_expiry,
        max(b.mrp) as latest_mrp
      from products p
      left join product_batches b on b.product_id = p.id
      ${search ? sql`where p.name ilike ${'%' + search + '%'} or p.manufacturer ilike ${'%' + search + '%'} or p.hsn ilike ${'%' + search + '%'}` : sql``}
      group by p.id
      order by p.name asc
    `);
    let rows = result.rows as any[];
    if (status === "Available") rows = rows.filter((r) => Number(r.total_quantity) > 0);
    else if (status === "NotAvailable") rows = rows.filter((r) => Number(r.total_quantity) <= 0);
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }, "GET /products failed");
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Quick search for purchase form & POS — returns top matches with batch info
router.get("/products/search", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json([]);
    const rows = await db
      .select()
      .from(productsTable)
      .where(or(ilike(productsTable.name, `%${q}%`), ilike(productsTable.manufacturer, `%${q}%`)))
      .orderBy(asc(productsTable.name))
      .limit(20);
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }, "GET /products/search failed");
    res.status(500).json({ error: "Failed to search products" });
  }
});

// Flat inventory listing (one row per batch) for POS search
router.get("/inventory", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const result = await db.execute(sql`
      select
        b.id as batch_id,
        b.batch_number,
        b.expiry,
        b.quantity,
        b.purchase_rate,
        b.mrp,
        p.id as product_id,
        p.name,
        p.hsn,
        p.manufacturer,
        p.packing_size,
        p.sale_unit,
        p.sale_rate_excl,
        p.sale_rate_incl,
        p.gst_rate,
        p.is_h1,
        p.is_narcotic,
        p.is_prescription_required
      from product_batches b
      join products p on p.id = b.product_id
      where b.quantity > 0
      ${q ? sql`and (p.name ilike ${'%' + q + '%'} or b.batch_number ilike ${'%' + q + '%'} or p.manufacturer ilike ${'%' + q + '%'})` : sql``}
      order by p.name, b.expiry
      limit 50
    `);
    res.json(result.rows);
  } catch (err) {
    req.log?.error({ err }, "GET /inventory failed");
    res.status(500).json({ error: "Failed to fetch inventory" });
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

router.get("/products/:id/batches", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(productBatchesTable)
      .where(eq(productBatchesTable.productId, id))
      .orderBy(asc(productBatchesTable.expiry));
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }, "GET /products/:id/batches failed");
    res.status(500).json({ error: "Failed to fetch batches" });
  }
});

router.post("/products", async (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.name?.trim()) return res.status(400).json({ error: "Name is required" });

    const inserted = await db
      .insert(productsTable)
      .values({
        name: String(b.name).trim(),
        manufacturer: b.manufacturer ?? null,
        hsn: b.hsn ?? "",
        content: b.content ?? null,
        packingSize: b.packing_size ?? b.packingSize ?? null,
        category: b.category ?? null,
        primaryUnit: b.primary_unit ?? b.primaryUnit ?? "PIECE",
        secondaryUnit: b.secondary_unit ?? b.secondaryUnit ?? null,
        purchaseConvMultiplier: String(num(b.purchase_conv_multiplier ?? b.purchaseConvMultiplier ?? 1)),
        saleUnit: b.sale_unit ?? b.saleUnit ?? "PIECE",
        sellingConvMultiplier: String(num(b.selling_conv_multiplier ?? b.sellingConvMultiplier ?? 1)),
        gstRate: String(num(b.gst_rate ?? b.gstRate ?? 0)),
        mrp: String(num(b.mrp)),
        saleRateExcl: String(num(b.sale_rate_excl ?? b.saleRateExcl)),
        saleRateIncl: String(num(b.sale_rate_incl ?? b.saleRateIncl)),
        isH1: bool(b.is_h1 ?? b.isH1),
        isNarcotic: bool(b.is_narcotic ?? b.isNarcotic),
        isPrescriptionRequired: bool(b.is_prescription_required ?? b.isPrescriptionRequired),
      })
      .returning({ id: productsTable.id });
    res.json({ message: "Product added", id: inserted[0]?.id });
  } catch (err: any) {
    req.log?.error({ err }, "POST /products failed");
    if (String(err?.code) === "23505") {
      return res.status(400).json({ error: "Product with the same name already exists" });
    }
    res.status(500).json({ error: "Failed to add product" });
  }
});

router.put("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const updates: Record<string, unknown> = {};

    const stringMap: Record<string, string> = {
      name: "name",
      manufacturer: "manufacturer",
      hsn: "hsn",
      content: "content",
      packing_size: "packingSize",
      packingSize: "packingSize",
      category: "category",
      primary_unit: "primaryUnit",
      primaryUnit: "primaryUnit",
      secondary_unit: "secondaryUnit",
      secondaryUnit: "secondaryUnit",
      sale_unit: "saleUnit",
      saleUnit: "saleUnit",
    };
    const numMap: Record<string, string> = {
      purchase_conv_multiplier: "purchaseConvMultiplier",
      purchaseConvMultiplier: "purchaseConvMultiplier",
      selling_conv_multiplier: "sellingConvMultiplier",
      sellingConvMultiplier: "sellingConvMultiplier",
      gst_rate: "gstRate",
      gstRate: "gstRate",
      mrp: "mrp",
      sale_rate_excl: "saleRateExcl",
      saleRateExcl: "saleRateExcl",
      sale_rate_incl: "saleRateIncl",
      saleRateIncl: "saleRateIncl",
    };
    const boolMap: Record<string, string> = {
      is_h1: "isH1",
      isH1: "isH1",
      is_narcotic: "isNarcotic",
      isNarcotic: "isNarcotic",
      is_prescription_required: "isPrescriptionRequired",
      isPrescriptionRequired: "isPrescriptionRequired",
    };
    for (const [k, col] of Object.entries(stringMap)) {
      if (b[k] !== undefined) updates[col] = b[k];
    }
    for (const [k, col] of Object.entries(numMap)) {
      if (b[k] !== undefined) updates[col] = String(num(b[k]));
    }
    for (const [k, col] of Object.entries(boolMap)) {
      if (b[k] !== undefined) updates[col] = bool(b[k]);
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    await db.update(productsTable).set(updates).where(eq(productsTable.id, id));
    res.json({ message: "Product updated" });
  } catch (err: any) {
    req.log?.error({ err }, "PUT /products/:id failed");
    if (String(err?.code) === "23505") {
      return res.status(400).json({ error: "Another product with that name already exists" });
    }
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
