import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql, type SQL } from "drizzle-orm";

const router: IRouter = Router();

// Compliance filter for bill_items / purchase_bill_items joined to products.
function complianceJoinFilter(prefix: string, compliance: string): SQL | undefined {
  if (compliance === "h1") return sql.raw(`and ${prefix}.is_h1 = true`);
  if (compliance === "narcotic") return sql.raw(`and ${prefix}.is_narcotic = true`);
  if (compliance === "rx") return sql.raw(`and ${prefix}.is_prescription_required = true`);
  return undefined;
}

router.get("/reports", async (req, res) => {
  const type = String(req.query.type ?? "");
  const fromDate = String(req.query.fromDate ?? req.query.from ?? "");
  const toDate = String(req.query.toDate ?? req.query.to ?? "");
  const compliance = String(req.query.compliance ?? "").toLowerCase();

  if (!type) return res.status(400).json({ error: "Report type is required." });
  if (!fromDate || !toDate) {
    if (type !== "inventory" && type !== "expiry") {
      return res.status(400).json({ error: "Date range is required for this report." });
    }
  }

  try {
    let result: unknown;
    const compFilterP = complianceJoinFilter("p", compliance) ?? sql``;

    switch (type) {
      case "sales": {
        if (compliance && ["h1", "narcotic", "rx"].includes(compliance)) {
          result = (
            await db.execute(sql`
              select distinct b.bill_number, to_char(b.bill_date, 'YYYY-MM-DD') as date,
                b.patient_name, b.grand_total
              from bills b
              join bill_items bi on bi.bill_id = b.id
              join products p on p.id = bi.product_id
              where b.status = 'Completed'
                and date(b.bill_date) between ${fromDate} and ${toDate}
                ${compFilterP}
              order by date desc
            `)
          ).rows;
        } else {
          result = (
            await db.execute(sql`
              select bill_number, to_char(bill_date, 'YYYY-MM-DD') as date,
                patient_name, grand_total
              from bills where status = 'Completed'
                and date(bill_date) between ${fromDate} and ${toDate}
              order by bill_date desc
            `)
          ).rows;
        }
        break;
      }
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
            select p.name, p.manufacturer, p.category, p.packing_size,
              p.hsn, p.gst_rate, p.sale_unit,
              p.is_h1, p.is_narcotic, p.is_prescription_required,
              coalesce(sum(b.quantity), 0)::float as total_quantity,
              count(b.id) as batch_count
            from products p
            left join product_batches b on b.product_id = p.id
            ${compliance && ["h1","narcotic","rx"].includes(compliance) ? compFilterP : sql``}
            group by p.id
            order by p.name
          `)
        ).rows;
        break;
      case "purchases": {
        if (compliance && ["h1", "narcotic", "rx"].includes(compliance)) {
          result = (
            await db.execute(sql`
              select distinct pb.bill_number, pb.supplier_name,
                to_char(pb.bill_date, 'YYYY-MM-DD') as date,
                pb.tax_type, pb.grand_total
              from purchase_bills pb
              join purchase_bill_items pbi on pbi.purchase_bill_id = pb.id
              join products p on p.id = pbi.product_id
              where pb.status = 'Completed'
                and pb.bill_date between ${fromDate}::date and ${toDate}::date
                ${compFilterP}
              order by date desc
            `)
          ).rows;
        } else {
          result = (
            await db.execute(sql`
              select bill_number, supplier_name, to_char(bill_date, 'YYYY-MM-DD') as date,
                tax_type, grand_total
              from purchase_bills where status = 'Completed'
                and bill_date between ${fromDate}::date and ${toDate}::date
              order by bill_date desc
            `)
          ).rows;
        }
        break;
      }
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
            select p.name, b.batch_number as batch, b.quantity, b.expiry
            from product_batches b
            join products p on p.id = b.product_id
            where b.expiry is not null
              and to_date(b.expiry || '-01', 'YYYY-MM-DD') < current_date
            order by b.expiry
          `)
        ).rows;
        break;
      case "profitability":
        result = (
          await db.execute(sql`
            select bi.product_name, bi.batch,
              avg(pb.purchase_rate) as purchase_rate,
              sum(bi.quantity) as total_quantity_sold,
              avg(bi.rate) as avg_sale_rate,
              sum(bi.quantity * (bi.rate - coalesce(pb.purchase_rate, 0))) as estimated_gross_profit
            from bill_items bi
            join bills b on bi.bill_id = b.id
            left join product_batches pb on pb.id = bi.batch_id
            where b.status = 'Completed'
              and date(b.bill_date) between ${fromDate} and ${toDate}
            group by bi.product_name, bi.batch
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
      case "compliance_sales":
        result = (
          await db.execute(sql`
            select b.bill_number, to_char(b.bill_date, 'YYYY-MM-DD') as date,
              b.patient_name, bi.product_name, bi.batch,
              bi.quantity, bi.rate, (bi.rate * bi.quantity) as line_total,
              case when p.is_h1 then 'H1' else null end as h1,
              case when p.is_narcotic then 'NARCOTIC' else null end as narcotic,
              case when p.is_prescription_required then 'Rx' else null end as rx
            from bill_items bi
            join bills b on bi.bill_id = b.id
            join products p on p.id = bi.product_id
            where b.status = 'Completed'
              and date(b.bill_date) between ${fromDate} and ${toDate}
              and (p.is_h1 = true or p.is_narcotic = true or p.is_prescription_required = true)
              ${compliance && ["h1","narcotic","rx"].includes(compliance) ? compFilterP : sql``}
            order by b.bill_date desc
          `)
        ).rows;
        break;
      case "compliance_purchases":
        result = (
          await db.execute(sql`
            select pb.bill_number, pb.supplier_name,
              to_char(pb.bill_date, 'YYYY-MM-DD') as date,
              pbi.product_name, pbi.batch, pbi.quantity, pbi.purchase_rate,
              pbi.amount,
              case when p.is_h1 then 'H1' else null end as h1,
              case when p.is_narcotic then 'NARCOTIC' else null end as narcotic,
              case when p.is_prescription_required then 'Rx' else null end as rx
            from purchase_bill_items pbi
            join purchase_bills pb on pbi.purchase_bill_id = pb.id
            join products p on p.id = pbi.product_id
            where pb.status = 'Completed'
              and pb.bill_date between ${fromDate}::date and ${toDate}::date
              and (p.is_h1 = true or p.is_narcotic = true or p.is_prescription_required = true)
              ${compliance && ["h1","narcotic","rx"].includes(compliance) ? compFilterP : sql``}
            order by pb.bill_date desc
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
