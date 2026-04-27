import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, MapPin, User } from "lucide-react";

export default function Suppliers() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api.suppliers().then(setRows); }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" description="Wholesale vendors and distributor partners."
        actions={<Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"><Plus className="mr-2 h-4 w-4" /> Add Supplier</Button>} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(s => (
          <Card key={s.id} className="border-border/60 bg-card/80 transition-all hover:shadow-elev-lg">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{s.name}</h3>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><User className="h-3 w-3" />{s.contact_person}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
                  {s.name.charAt(0)}
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{s.phone}</p>
                <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{s.email}</p>
                <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{s.address}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
