import { Router, type IRouter } from "express";
import { db, stockAdjustmentsTable, productBatchesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.post("/stock-adjustments", async (req, res) => {
  try {
    const { batchId, productId, quantity, reason, notes } = req.body ?? {};
    const adjustedQty = -Math.abs(parseFloat(String(quantity)));
    if (!batchId || isNaN(adjustedQty) || adjustedQty === 0) {
      return res.status(400).json({ error: "Invalid batch or quantity for adjustment." });
    }

    await db.transaction(async (tx) => {
      await tx.insert(stockAdjustmentsTable).values({
        productId: productId ? Number(productId) : null,
        batchId: Number(batchId),
        quantityAdjusted: String(adjustedQty),
        reason: reason ?? "Manual Adjustment",
        notes: notes ?? null,
      });
      await tx
        .update(productBatchesTable)
        .set({
          quantity: sql`GREATEST(0::numeric, ${productBatchesTable.quantity} + ${adjustedQty}::numeric)`,
        })
        .where(eq(productBatchesTable.id, Number(batchId)));
    });

    res.json({ message: "Stock adjusted successfully." });
  } catch (err) {
    req.log?.error({ err }, "POST /stock-adjustments failed");
    res.status(500).json({ error: "Failed to adjust stock." });
  }
});

export default router;
