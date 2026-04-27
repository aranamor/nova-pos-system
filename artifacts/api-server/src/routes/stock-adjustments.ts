import { Router, type IRouter } from "express";
import { db, stockAdjustmentsTable, productsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.post("/stock-adjustments", async (req, res) => {
  try {
    const { productId, quantity, reason, notes } = req.body ?? {};
    const adjustedQty = -Math.abs(parseFloat(String(quantity)));
    if (!productId || isNaN(adjustedQty) || adjustedQty === 0) {
      return res.status(400).json({ error: "Invalid product or quantity for adjustment." });
    }

    await db.transaction(async (tx) => {
      await tx.insert(stockAdjustmentsTable).values({
        productId: Number(productId),
        quantityAdjusted: String(adjustedQty),
        reason: reason ?? "Manual Adjustment",
        notes: notes ?? null,
      });
      await tx
        .update(productsTable)
        .set({
          quantity: sql`GREATEST(0::numeric, ${productsTable.quantity} + ${adjustedQty}::numeric)`,
        })
        .where(eq(productsTable.id, Number(productId)));
    });

    res.json({ message: "Stock adjusted successfully." });
  } catch (err) {
    req.log?.error({ err }, "POST /stock-adjustments failed");
    res.status(500).json({ error: "Failed to adjust stock." });
  }
});

export default router;
