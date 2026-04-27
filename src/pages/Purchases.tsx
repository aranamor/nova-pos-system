import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";

export default function Purchases() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api.purchases().then(setRows); }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Purchases" description="Inward supply from vendors, drafts and completed purchases."
        actions={<Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"><Plus className="mr-2 h-4 w-4" /> New Purchase</Button>} />

      <Card className="border-border/60 bg-card/80">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice</th>
                  <th className="px-3 py-3 text-left">Supplier</th>
                  <th className="px-3 py-3 text-left">Date</th>
                  <th className="px-3 py-3 text-center">Tax</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono font-semibold">{r.invoice_number}</td>
                    <td className="px-3 py-3">{r.supplier_name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{formatDate(r.purchase_date)}</td>
                    <td className="px-3 py-3 text-center"><Badge variant="secondary">{r.tax_type}</Badge></td>
                    <td className="px-3 py-3 text-right font-mono font-semibold">{formatINR(r.grand_total)}</td>
                    <td className="px-3 py-3 text-center">
                      {r.status === "Completed"
                        ? <Badge className="bg-success text-success-foreground hover:bg-success">Completed</Badge>
                        : <Badge variant="outline">Draft</Badge>}
                    </td>
                    <td className="px-3 py-3 text-right"><Button variant="ghost" size="sm"><FileText className="mr-1.5 h-3.5 w-3.5" />View</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
