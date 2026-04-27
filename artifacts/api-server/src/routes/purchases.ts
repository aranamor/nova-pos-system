import { Router, type IRouter } from "express";
import {
  db,
  purchaseBillsTable,
  purchaseBillItemsTable,
  productsTable,
  suppliersTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

interface PurchaseItemInput {
  productName: string;
  hsn: string;
  batch: string;
  packaging?: string;
  quantity: number | string;
  freeQuantity?: number | string;
  mrp: number | string;
  purchaseRate: number | string;
  saleRate?: number | string;
  saleRateIncl: number | string;
  discount?: number | string;
  expiry: string;
  purchase_cgst?: number | string;
  purchase_sgst?: number | string;
  purchase_igst?: number | string;
  sale_cgst?: number | string;
  sale_sgst?: number | string;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function calcPurchaseTotals(items: PurchaseItemInput[], overallDiscountPercent: number) {
  let totalPreTax = 0;
  for (const item of items) {
    const base = num(item.purchaseRate) * num(item.quantity);
    const itemDiscounted = base * (1 - num(item.discount) / 100);
    totalPreTax += itemDiscounted;
  }
  const overallDiscountAmount = totalPreTax * (overallDiscountPercent / 100);
  const taxableAmount = totalPreTax - overallDiscountAmount;
  let totalGstAmount = 0;
  for (const item of items) {
    const base = num(item.purchaseRate) * num(item.quantity);
    const itemDiscounted = base * (1 - num(item.discount) / 100);
    const finalDiscounted = itemDiscounted * (1 - overallDiscountPercent / 100);
    const totalGstPercent =
      num(item.purchase_igst) || num(item.purchase_cgst) + num(item.purchase_sgst);
    totalGstAmount += finalDiscounted * (totalGstPercent / 100);
  }
  const totalBeforeRounding = taxableAmount + totalGstAmount;
  const grandTotal = Math.round(totalBeforeRounding);
  const rounding = grandTotal - totalBeforeRounding;
  return { totalPreTax, overallDiscountAmount, taxableAmount, totalGstAmount, rounding, grandTotal };
}

async function insertPurchaseItem(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  purchaseBillId: number,
  item: PurchaseItemInput,
) {
  const baseAmount = num(item.purchaseRate) * num(item.quantity);
  const discountAmount = baseAmount * (num(item.discount) / 100);
  const taxableAmountForItem = baseAmount - discountAmount;
  const totalGstPercent =
    num(item.purchase_igst) || num(item.purchase_cgst) + num(item.purchase_sgst);
  const gstAmountForItem = taxableAmountForItem * (totalGstPercent / 100);
  const itemTotalAmount = taxableAmountForItem + gstAmountForItem;

  await tx.insert(purchaseBillItemsTable).values({
    purchaseBillId,
    productName: item.productName,
    hsn: item.hsn,
    batch: item.batch,
    packaging: item.packaging ?? null,
    quantity: String(num(item.quantity)),
    freeQuantity: String(num(item.freeQuantity)),
    mrp: String(num(item.mrp)),
    purchaseRate: String(num(item.purchaseRate)),
    saleRate: String(num(item.saleRate)),
    saleRateInclusive: String(num(item.saleRateIncl)),
    discount: String(num(item.discount)),
    expiry: item.expiry,
    purchaseCgst: String(num(item.purchase_cgst)),
    purchaseSgst: String(num(item.purchase_sgst)),
    purchaseIgst: String(num(item.purchase_igst)),
    saleCgst: String(num(item.sale_cgst)),
    saleSgst: String(num(item.sale_sgst)),
    amount: String(itemTotalAmount.toFixed(2)),
  });
}

async function updateInventoryFromPurchase(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  item: PurchaseItemInput,
) {
  const totalQuantity = num(item.quantity) + num(item.freeQuantity);
  await tx
    .insert(productsTable)
    .values({
      name: item.productName,
      hsn: item.hsn,
      batch: item.batch,
      packaging: item.packaging ?? null,
      quantity: String(totalQuantity),
      mrp: String(num(item.mrp)),
      purchaseRate: String(num(item.purchaseRate)),
      saleRate: String(num(item.saleRate)),
      saleRateInclusive: String(num(item.saleRateIncl)),
      expiry: item.expiry,
      cgst: String(num(item.sale_cgst)),
      sgst: String(num(item.sale_sgst)),
    })
    .onConflictDoUpdate({
      target: [productsTable.name, productsTable.batch],
      set: {
        quantity: sql`${productsTable.quantity} + ${totalQuantity}::numeric`,
        packaging: sql`EXCLUDED.packaging`,
        mrp: sql`EXCLUDED.mrp`,
        purchaseRate: sql`EXCLUDED.purchase_rate`,
        saleRate: sql`EXCLUDED.sale_rate`,
        saleRateInclusive: sql`EXCLUDED.sale_rate_inclusive`,
        expiry: sql`EXCLUDED.expiry`,
        cgst: sql`EXCLUDED.cgst`,
        sgst: sql`EXCLUDED.sgst`,
      },
    });
}

router.get("/purchases", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: purchaseBillsTable.id,
        bill_number: purchaseBillsTable.billNumber,
        supplier_name: purchaseBillsTable.supplierName,
        bill_date: purchaseBillsTable.billDate,
        tax_type: purchaseBillsTable.taxType,
        grand_total: purchaseBillsTable.grandTotal,
        status: purchaseBillsTable.status,
      })
      .from(purchaseBillsTable)
      .orderBy(desc(purchaseBillsTable.billDate), desc(purchaseBillsTable.id));
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }, "GET /purchases failed");
    res.status(500).json({ error: "Failed to fetch purchase bills" });
  }
});

router.get("/purchases/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [bill] = await db
      .select()
      .from(purchaseBillsTable)
      .where(eq(purchaseBillsTable.id, id));
    if (!bill) return res.status(404).json({ error: "Purchase Bill not found" });
    const items = await db
      .select()
      .from(purchaseBillItemsTable)
      .where(eq(purchaseBillItemsTable.purchaseBillId, id));
    res.json({ ...bill, items });
  } catch (err) {
    req.log?.error({ err }, "GET /purchases/:id failed");
    res.status(500).json({ error: "Failed to fetch purchase bill" });
  }
});

router.post("/purchases", async (req, res) => {
  try {
    const {
      supplierName,
      billNumber,
      billDate,
      taxType,
      items,
      overallDiscountPercent,
      status = "Draft",
    } = req.body ?? {};

    if (!supplierName || !billNumber || !billDate || !taxType || !items || items.length === 0) {
      return res.status(400).json({ error: "Missing required fields for purchase bill." });
    }

    const overall = num(overallDiscountPercent);
    const totals = calcPurchaseTotals(items as PurchaseItemInput[], overall);

    const result = await db.transaction(async (tx) => {
      let supplierId: number | null = null;
      const [existing] = await tx
        .select({ id: suppliersTable.id })
        .from(suppliersTable)
        .where(eq(suppliersTable.name, supplierName));
      if (existing) {
        supplierId = existing.id;
      } else {
        const [created] = await tx
          .insert(suppliersTable)
          .values({ name: supplierName })
          .returning({ id: suppliersTable.id });
        supplierId = created.id;
      }

      const [bill] = await tx
        .insert(purchaseBillsTable)
        .values({
          supplierId,
          supplierName,
          billNumber,
          billDate,
          taxType,
          totalPreTax: String(totals.totalPreTax.toFixed(2)),
          overallDiscountPercent: String(overall),
          overallDiscountAmount: String(totals.overallDiscountAmount.toFixed(2)),
          taxableAmount: String(totals.taxableAmount.toFixed(2)),
          totalGstAmount: String(totals.totalGstAmount.toFixed(2)),
          rounding: String(totals.rounding.toFixed(2)),
          grandTotal: String(totals.grandTotal.toFixed(2)),
          status,
          isLocked: status === "Completed",
        })
        .returning({ id: purchaseBillsTable.id });

      for (const item of items as PurchaseItemInput[]) {
        await insertPurchaseItem(tx, bill.id, item);
        if (status === "Completed") {
          await updateInventoryFromPurchase(tx, item);
        }
      }
      return bill.id;
    });

    res.json({ message: `Purchase bill saved as ${status}!`, id: result });
  } catch (err) {
    req.log?.error({ err }, "POST /purchases failed");
    res.status(500).json({ error: "Failed to create purchase bill." });
  }
});

router.put("/purchases/:id", async (req, res) => {
  try {
    const purchaseId = Number(req.params.id);
    const {
      supplierName,
      billNumber,
      billDate,
      taxType,
      items,
      overallDiscountPercent,
      status,
    } = req.body ?? {};

    const [existing] = await db
      .select()
      .from(purchaseBillsTable)
      .where(eq(purchaseBillsTable.id, purchaseId));
    if (!existing || existing.isLocked) {
      return res.status(403).json({ error: "This purchase is locked and cannot be edited." });
    }

    const overall = num(overallDiscountPercent);
    const totals = calcPurchaseTotals(items as PurchaseItemInput[], overall);

    await db.transaction(async (tx) => {
      await tx
        .delete(purchaseBillItemsTable)
        .where(eq(purchaseBillItemsTable.purchaseBillId, purchaseId));
      for (const item of items as PurchaseItemInput[]) {
        await insertPurchaseItem(tx, purchaseId, item);
        if (status === "Completed") {
          await updateInventoryFromPurchase(tx, item);
        }
      }
      await tx
        .update(purchaseBillsTable)
        .set({
          supplierName,
          billNumber,
          billDate,
          taxType,
          totalPreTax: String(totals.totalPreTax.toFixed(2)),
          overallDiscountPercent: String(overall),
          overallDiscountAmount: String(totals.overallDiscountAmount.toFixed(2)),
          taxableAmount: String(totals.taxableAmount.toFixed(2)),
          totalGstAmount: String(totals.totalGstAmount.toFixed(2)),
          rounding: String(totals.rounding.toFixed(2)),
          grandTotal: String(totals.grandTotal.toFixed(2)),
          status,
          isLocked: status === "Completed",
        })
        .where(eq(purchaseBillsTable.id, purchaseId));
    });

    res.json({ message: `Purchase bill updated and marked as ${status}!` });
  } catch (err) {
    req.log?.error({ err }, "PUT /purchases/:id failed");
    res.status(500).json({ error: "Failed to update purchase bill." });
  }
});

export default router;
