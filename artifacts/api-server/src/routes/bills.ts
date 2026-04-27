import { Router, type IRouter } from "express";
import {
  db,
  billsTable,
  billItemsTable,
  customersTable,
  productsTable,
} from "@workspace/db";
import { eq, asc, desc, and, sql, inArray } from "drizzle-orm";

const router: IRouter = Router();

interface BillItemInput {
  id?: number;
  product_id?: number;
  productId?: number;
  product_name?: string;
  name?: string;
  hsn?: string;
  batch?: string;
  mrp?: number | string;
  rate?: number | string;
  quantity?: number | string;
  expiry?: string;
  discount?: number | string;
  cgst?: number | string;
  sgst?: number | string;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function calcTotals(items: BillItemInput[], overallDiscountPercent: number) {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  for (const it of items) {
    const itemSubtotal = num(it.rate) * num(it.quantity);
    const itemDiscountAmount = itemSubtotal * (num(it.discount) / 100);
    const taxableAfterItemDisc = itemSubtotal - itemDiscountAmount;
    const overallDiscountAmount = taxableAfterItemDisc * (overallDiscountPercent / 100);
    const finalTaxable = taxableAfterItemDisc - overallDiscountAmount;
    subtotal += itemSubtotal;
    totalDiscount += itemDiscountAmount + overallDiscountAmount;
    totalCgst += finalTaxable * (num(it.cgst) / 100);
    totalSgst += finalTaxable * (num(it.sgst) / 100);
  }
  const grandTotal = subtotal - totalDiscount + totalCgst + totalSgst;
  return { subtotal, totalDiscount, totalCgst, totalSgst, grandTotal };
}

router.get("/bills", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(billsTable)
      .where(eq(billsTable.status, "Completed"))
      .orderBy(desc(billsTable.id));
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }, "GET /bills failed");
    res.status(500).json({ error: "Failed to list bills" });
  }
});

router.get("/held-bills", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      select b.id,
             b.bill_number,
             b.bill_date,
             b.patient_name,
             b.patient_mobile,
             b.doctor_name,
             b.grand_total,
             b.status,
             coalesce(c.cnt, 0)::int as item_count
        from bills b
        left join (
          select bill_id, count(*)::int as cnt
            from bill_items
           group by bill_id
        ) c on c.bill_id = b.id
       where b.status = 'Held'
       order by b.id desc
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch held bills" });
  }
});

router.get("/bills/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [bill] = await db.select().from(billsTable).where(eq(billsTable.id, id));
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    const items = await db
      .select({
        id: billItemsTable.id,
        bill_id: billItemsTable.billId,
        product_id: billItemsTable.productId,
        product_name: billItemsTable.productName,
        hsn: billItemsTable.hsn,
        batch: billItemsTable.batch,
        mrp: billItemsTable.mrp,
        rate: billItemsTable.rate,
        quantity: billItemsTable.quantity,
        expiry: billItemsTable.expiry,
        discount: billItemsTable.discount,
        cgst: billItemsTable.cgst,
        sgst: billItemsTable.sgst,
      })
      .from(billItemsTable)
      .where(eq(billItemsTable.billId, id));
    res.json({ ...bill, items });
  } catch (err) {
    req.log?.error({ err }, "GET /bills/:id failed");
    res.status(500).json({ error: "Failed to fetch bill" });
  }
});

router.post("/bills", async (req, res) => {
  try {
    const {
      patient_name,
      patient_mobile,
      doctor_name,
      items,
      bill_date,
      overall_discount_percent,
      status = "Completed",
    } = req.body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Bill must contain at least one item" });
    }

    const overall = num(overall_discount_percent);
    const totals = calcTotals(items as BillItemInput[], overall);

    const result = await db.transaction(async (tx) => {
      let customerId: number | null = null;
      if (patient_mobile) {
        const [existing] = await tx
          .select({ id: customersTable.id })
          .from(customersTable)
          .where(eq(customersTable.mobile, String(patient_mobile)))
          .limit(1);
        if (existing) {
          customerId = existing.id;
          await tx
            .update(customersTable)
            .set({ name: patient_name, doctorName: doctor_name ?? null })
            .where(eq(customersTable.id, customerId));
        } else {
          const [created] = await tx
            .insert(customersTable)
            .values({
              name: patient_name,
              mobile: String(patient_mobile),
              doctorName: doctor_name ?? null,
            })
            .returning({ id: customersTable.id });
          customerId = created.id;
        }
      }

      const [billRow] = await tx
        .insert(billsTable)
        .values({
          billNumber: "TEMP",
          patientName: patient_name,
          patientMobile: String(patient_mobile ?? ""),
          doctorName: doctor_name ?? null,
          subtotal: String(totals.subtotal.toFixed(2)),
          overallDiscountPercent: String(overall),
          totalDiscount: String(totals.totalDiscount.toFixed(2)),
          totalCgst: String(totals.totalCgst.toFixed(2)),
          totalSgst: String(totals.totalSgst.toFixed(2)),
          grandTotal: String(totals.grandTotal.toFixed(2)),
          customerId,
          billDate: bill_date ? new Date(bill_date) : new Date(),
          status,
        })
        .returning({ id: billsTable.id });

      const billId = billRow.id;
      const billNumber = `INV-${new Date().getFullYear()}-${String(billId).padStart(4, "0")}`;
      await tx
        .update(billsTable)
        .set({ billNumber })
        .where(eq(billsTable.id, billId));

      for (const it of items as BillItemInput[]) {
        await tx.insert(billItemsTable).values({
          billId,
          productId: (it.product_id ?? it.id) ? Number(it.product_id ?? it.id) : null,
          productName: it.product_name ?? it.name ?? "",
          hsn: it.hsn ?? null,
          batch: it.batch ?? null,
          mrp: it.mrp !== undefined ? String(it.mrp) : null,
          rate: it.rate !== undefined ? String(it.rate) : null,
          quantity: String(num(it.quantity)),
          expiry: it.expiry ?? null,
          discount: String(num(it.discount)),
          cgst: String(num(it.cgst)),
          sgst: String(num(it.sgst)),
        });
        const pid = it.product_id ?? it.id;
        if (pid && status === "Completed") {
          await tx
            .update(productsTable)
            .set({
              quantity: sql`GREATEST(0::numeric, ${productsTable.quantity} - ${num(it.quantity)}::numeric)`,
            })
            .where(eq(productsTable.id, Number(pid)));
        }
      }

      return { id: billId, bill_number: billNumber };
    });

    res.json({
      message: status === "Held" ? "Bill held" : "Bill created",
      id: result.id,
      bill_number: result.bill_number,
    });
  } catch (err) {
    req.log?.error({ err }, "POST /bills failed");
    res.status(500).json({ error: "Failed to create bill" });
  }
});

router.put("/bills/:id", async (req, res) => {
  try {
    const billId = Number(req.params.id);
    const {
      items,
      patient_name,
      patient_mobile,
      doctor_name,
      overall_discount_percent,
      status = "Completed",
    } = req.body ?? {};

    const [existingBill] = await db.select().from(billsTable).where(eq(billsTable.id, billId));
    if (!existingBill) return res.status(404).json({ error: "Bill not found." });

    const existingItems = await db
      .select()
      .from(billItemsTable)
      .where(eq(billItemsTable.billId, billId));
    const wasCompleted = existingBill.status === "Completed";

    const overall = num(overall_discount_percent);
    const totals = calcTotals(items as BillItemInput[], overall);

    await db.transaction(async (tx) => {
      const existingMap: Record<number, number> = {};
      if (wasCompleted) {
        for (const it of existingItems) {
          if (it.productId) {
            existingMap[it.productId] = (existingMap[it.productId] ?? 0) + Number(it.quantity);
          }
        }
      }
      const newMap: Record<number, number> = {};
      if (status === "Completed") {
        for (const it of items as BillItemInput[]) {
          const pid = Number(it.product_id ?? it.id ?? 0);
          if (pid) newMap[pid] = (newMap[pid] ?? 0) + num(it.quantity);
        }
      }
      const allKeys = new Set([
        ...Object.keys(existingMap).map(Number),
        ...Object.keys(newMap).map(Number),
      ]);
      for (const pid of allKeys) {
        const delta = (existingMap[pid] ?? 0) - (newMap[pid] ?? 0);
        if (delta !== 0) {
          await tx
            .update(productsTable)
            .set({
              quantity: sql`GREATEST(0::numeric, ${productsTable.quantity} + ${delta}::numeric)`,
            })
            .where(eq(productsTable.id, pid));
        }
      }

      await tx.delete(billItemsTable).where(eq(billItemsTable.billId, billId));
      for (const it of items as BillItemInput[]) {
        await tx.insert(billItemsTable).values({
          billId,
          productId: (it.product_id ?? it.id) ? Number(it.product_id ?? it.id) : null,
          productName: it.product_name ?? it.name ?? "",
          hsn: it.hsn ?? null,
          batch: it.batch ?? null,
          mrp: it.mrp !== undefined ? String(it.mrp) : null,
          rate: it.rate !== undefined ? String(it.rate) : null,
          quantity: String(num(it.quantity)),
          expiry: it.expiry ?? null,
          discount: String(num(it.discount)),
          cgst: String(num(it.cgst)),
          sgst: String(num(it.sgst)),
        });
      }

      await tx
        .update(billsTable)
        .set({
          patientName: patient_name,
          patientMobile: String(patient_mobile ?? ""),
          doctorName: doctor_name ?? null,
          subtotal: String(totals.subtotal.toFixed(2)),
          overallDiscountPercent: String(overall),
          totalDiscount: String(totals.totalDiscount.toFixed(2)),
          totalCgst: String(totals.totalCgst.toFixed(2)),
          totalSgst: String(totals.totalSgst.toFixed(2)),
          grandTotal: String(totals.grandTotal.toFixed(2)),
          status,
        })
        .where(eq(billsTable.id, billId));
    });

    res.json({ message: "Bill updated", id: billId });
  } catch (err) {
    req.log?.error({ err }, "PUT /bills/:id failed");
    res.status(500).json({ error: "Failed to update bill" });
  }
});

router.delete("/bills/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db
      .delete(billsTable)
      .where(and(eq(billsTable.id, id), eq(billsTable.status, "Held")));
    res.json({ message: "Held bill deleted" });
  } catch (err) {
    req.log?.error({ err }, "DELETE /bills/:id failed");
    res.status(500).json({ error: "Failed to delete held bill" });
  }
});

// Suppress unused import warning
void asc;
void inArray;

export default router;
