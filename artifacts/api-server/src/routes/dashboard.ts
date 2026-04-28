import { Router, type IRouter } from "express";
import { db, billsTable, productsTable, productBatchesTable, settingsTable } from "@workspace/db";
import { sql, eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard-stats", async (req, res) => {
  try {
    const [salesToday] = await db
      .select({
        totalSales: sql<string>`coalesce(sum(${billsTable.grandTotal}), 0)`,
        billCount: sql<number>`count(${billsTable.id})::int`,
      })
      .from(billsTable)
      .where(sql`date(${billsTable.billDate}) = current_date and ${billsTable.status} = 'Completed'`);

    const [inventory] = await db
      .select({ totalItems: sql<number>`count(${productsTable.id})::int` })
      .from(productsTable);

    const [thresholdRow] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.settingKey, "lowStockThreshold"));
    const lowStockThreshold = thresholdRow ? Number(thresholdRow.settingValue) : 10;

    // Low stock = catalog items whose summed batch quantity is <= threshold
    const lowStockResult = await db.execute(sql`
      select count(*)::int as cnt from (
        select p.id from products p
        left join product_batches b on b.product_id = p.id
        group by p.id
        having coalesce(sum(b.quantity), 0) <= ${lowStockThreshold}
      ) x
    `);
    const lowStockCount = Number((lowStockResult.rows[0] as any)?.cnt ?? 0);

    const [expiring] = await db
      .select({ count: sql<number>`count(${productBatchesTable.id})::int` })
      .from(productBatchesTable)
      .where(
        sql`${productBatchesTable.expiry} is not null
            and to_date(${productBatchesTable.expiry} || '-01', 'YYYY-MM-DD')
              between current_date and (current_date + interval '1 month')`,
      );

    const recent = await db
      .select()
      .from(billsTable)
      .where(eq(billsTable.status, "Completed"))
      .orderBy(desc(billsTable.id))
      .limit(5);

    const trend = await db.execute(sql`
      with days as (
        select generate_series(current_date - interval '13 days', current_date, interval '1 day')::date as day
      )
      select to_char(d.day, 'YYYY-MM-DD') as date,
             coalesce(sum(b.grand_total), 0)::float as sales
      from days d
      left join bills b
        on date(b.bill_date) = d.day and b.status = 'Completed'
      group by d.day
      order by d.day
    `);

    const [monthRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${billsTable.grandTotal}), 0)`,
      })
      .from(billsTable)
      .where(
        sql`date(${billsTable.billDate}) >= date_trunc('month', current_date)
            and ${billsTable.status} = 'Completed'`,
      );

    res.json({
      todaySales: Number(salesToday?.totalSales ?? 0),
      todayBillsCount: salesToday?.billCount ?? 0,
      todayBillCount: salesToday?.billCount ?? 0,
      totalItems: inventory?.totalItems ?? 0,
      totalProducts: inventory?.totalItems ?? 0,
      lowStockCount,
      lowStock: lowStockCount,
      expiringCount: expiring?.count ?? 0,
      expiringSoon: expiring?.count ?? 0,
      monthSales: Number(monthRow?.total ?? 0),
      salesTrend: trend.rows,
      recentTransactions: recent,
      recentBills: recent,
    });
  } catch (err) {
    req.log?.error({ err }, "GET /dashboard-stats failed");
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

export default router;
