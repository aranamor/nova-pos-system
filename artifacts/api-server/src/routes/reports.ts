import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/reports", async (req, res) => {
  const type = String(req.query.type ?? "");
  const fromDate = String(req.query.fromDate ?? req.query.from ?? "");
  const toDate = String(req.query.toDate ?? req.query.to ?? "");

  if (!type) {
    return res.status(400).json({ error: "Report type is required." });
  }
  if (!fromDate || !toDate) {
    if (type !== "inventory" && type !== "expiry") {
      return res.status(400).json({ error: "Date range is required for this report." });
    }
  }

  try {
    let result: unknown;
    switch (type) {
      case "sales":
        result = (
          await db.execute(sql`
            select bill_number, to_char(bill_date, 'YYYY-MM-DD') as date,
              patient_name, grand_total
            from bills where status = 'Completed'
              and date(bill_date) between ${fromDate} and ${toDate}
            order by bill_date desc
          `)
        ).rows;
        break;
      case "sale_gst":
        result = (
          await db.execute(sql`
            select bill_number, to_char(bill_date, 'YYYY-MM-DD') as date,
              subtotal, total_discount, (subtotal - total_discount) as taxable_value,
              total_cgst, total_sgst, grand_total
            from bills where status = 'Completed'
              and date(bill_date) between ${fromDate} and ${toDate}
            order by bill_date desc
          `)
        ).rows;
        break;
      case "purchase_gst":
        result = (
          await db.execute(sql`
            select pb.bill_number, to_char(pb.bill_date, 'YYYY-MM-DD') as date,
              pb.supplier_name, pb.tax_type,
              pb.total_pre_tax as gross_amount,
              pb.overall_discount_percent, pb.overall_discount_amount,
              pb.taxable_amount,
              case when pb.tax_type = 'CSGST' then pb.total_gst_amount / 2 else 0 end as cgst_amount,
              case when pb.tax_type = 'CSGST' then pb.total_gst_amount / 2 else 0 end as sgst_amount,
              case when pb.tax_type = 'IGST' then pb.total_gst_amount else 0 end as igst_amount,
              pb.total_gst_amount, pb.grand_total
            from purchase_bills pb where pb.status = 'Completed'
              and pb.bill_date between ${fromDate}::date and ${toDate}::date
            order by pb.bill_date desc
          `)
        ).rows;
        break;
      case "inventory":
        result = (
          await db.execute(sql`
            select name, packaging, hsn, batch, quantity, mrp, purchase_rate,
              sale_rate_inclusive, expiry
            from products order by name
          `)
        ).rows;
        break;
      case "purchases":
        result = (
          await db.execute(sql`
            select bill_number, supplier_name, to_char(bill_date, 'YYYY-MM-DD') as date,
              tax_type, grand_total
            from purchase_bills where status = 'Completed'
              and bill_date between ${fromDate}::date and ${toDate}::date
            order by bill_date desc
          `)
        ).rows;
        break;
      case "supplier_purchases":
        result = (
          await db.execute(sql`
            select pb.supplier_name, pb.bill_number,
              to_char(pb.bill_date, 'YYYY-MM-DD') as date,
              pb.total_pre_tax, pb.overall_discount_percent, pb.overall_discount_amount,
              pb.taxable_amount, pb.total_gst_amount, pb.grand_total
            from purchase_bills pb where pb.status = 'Completed'
              and pb.bill_date between ${fromDate}::date and ${toDate}::date
            order by pb.supplier_name, pb.bill_date desc
          `)
        ).rows;
        break;
      case "expiry":
        result = (
          await db.execute(sql`
            select name, batch, quantity, expiry from products
            where expiry is not null
              and to_date(expiry || '-01', 'YYYY-MM-DD') < current_date
            order by expiry
          `)
        ).rows;
        break;
      case "profitability":
        result = (
          await db.execute(sql`
            select bi.product_name, bi.batch, p.purchase_rate,
              sum(bi.quantity) as total_quantity_sold,
              avg(bi.rate) as avg_sale_rate,
              sum(bi.quantity * (bi.rate - p.purchase_rate)) as estimated_gross_profit
            from bill_items bi
            join bills b on bi.bill_id = b.id
            left join products p on bi.product_id = p.id
            where b.status = 'Completed'
              and date(b.bill_date) between ${fromDate} and ${toDate}
            group by bi.product_name, bi.batch, p.purchase_rate
            order by estimated_gross_profit desc nulls last
          `)
        ).rows;
        break;
      case "movement":
        result = (
          await db.execute(sql`
            select bi.product_name, bi.batch,
              sum(bi.quantity) as total_quantity_sold,
              count(distinct b.id) as num_bills
            from bill_items bi
            join bills b on bi.bill_id = b.id
            where b.status = 'Completed'
              and date(b.bill_date) between ${fromDate} and ${toDate}
            group by bi.product_name, bi.batch
            order by total_quantity_sold desc
          `)
        ).rows;
        break;
      case "hsn_sale":
        result = (
          await db.execute(sql`
            select bi.hsn as hsn_code,
              sum(bi.quantity) as quantity,
              (bi.cgst + bi.sgst) as gst_percent,
              sum(bi.rate * bi.quantity * (1 - (bi.discount / 100)) * (1 - (b.overall_discount_percent / 100))) as taxable_amount,
              sum((bi.rate * bi.quantity * (1 - (bi.discount / 100)) * (1 - (b.overall_discount_percent / 100))) * (bi.cgst / 100)) as cgst_amount,
              sum((bi.rate * bi.quantity * (1 - (bi.discount / 100)) * (1 - (b.overall_discount_percent / 100))) * (bi.sgst / 100)) as sgst_amount,
              sum((bi.rate * bi.quantity * (1 - (bi.discount / 100)) * (1 - (b.overall_discount_percent / 100))) * (1 + (bi.cgst + bi.sgst) / 100)) as total_amount
            from bill_items bi
            join bills b on bi.bill_id = b.id
            where b.status = 'Completed'
              and date(b.bill_date) between ${fromDate} and ${toDate}
            group by bi.hsn, bi.cgst, bi.sgst
            order by bi.hsn
          `)
        ).rows;
        break;
      default:
        return res.status(400).json({ error: "Invalid report type" });
    }
    res.json(result);
  } catch (err) {
    req.log?.error({ err, type }, "GET /reports failed");
    res.status(500).json({ error: `Failed to generate ${type} report` });
  }
});

export default router;
