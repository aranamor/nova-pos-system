import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Phone, Stethoscope } from "lucide-react";

export default function Customers() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api.customers().then(setRows); }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Patients with mobile and prescribing doctor."
        actions={<Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(c => (
          <Card key={c.id} className="border-border/60 bg-card/80 transition-all hover:shadow-elev-lg hover:-translate-y-0.5">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-accent text-lg font-bold text-primary-foreground shadow-glow">
                {c.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{c.mobile}</p>
                {c.doctor_name && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Stethoscope className="h-3 w-3" />{c.doctor_name}</p>}
              </div>
              <div className="font-mono text-xs text-muted-foreground">#{c.id}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
