import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/lib/theme";
import { Save, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [s, setS] = useState<Record<string, string>>({});
  const { theme, toggle } = useTheme();

  useEffect(() => { api.settings().then(setS); }, []);

  const update = (k: string, v: string) => setS(p => ({ ...p, [k]: v }));
  const save = async () => { await api.saveSettings(s); toast.success("Settings saved"); };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Shop info, GST, low-stock thresholds and theme." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/80 lg:col-span-2">
          <CardHeader><CardTitle>Shop Information</CardTitle><CardDescription>Used on invoices and reports.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Shop Name" v={s.shop_name} onChange={v => update("shop_name", v)} />
            <Field label="GSTIN" v={s.gstin} onChange={v => update("gstin", v)} mono />
            <Field label="Phone" v={s.phone} onChange={v => update("phone", v)} />
            <Field label="Email" v={s.email} onChange={v => update("email", v)} />
            <div className="md:col-span-2"><Field label="Address" v={s.address} onChange={v => update("address", v)} /></div>
            <Field label="Low Stock Threshold" v={s.low_stock_threshold} onChange={v => update("low_stock_threshold", v)} type="number" />
            <div className="flex items-end">
              <Button onClick={save} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"><Save className="mr-2 h-4 w-4" />Save Settings</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Switch between light and dark mode.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                {theme === "dark"
                  ? <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-accent text-primary-foreground"><Moon className="h-5 w-5" /></div>
                  : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-warning text-primary-foreground"><Sun className="h-5 w-5" /></div>}
                <div>
                  <p className="text-sm font-semibold">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">Currently {theme === "dark" ? "enabled" : "disabled"}</p>
                </div>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggle} />
            </div>
            <p className="text-xs text-muted-foreground">Your preference is saved on this device.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const Field = ({ label, v, onChange, type = "text", mono = false }:
  { label: string; v?: string; onChange: (v: string) => void; type?: string; mono?: boolean }) => (
  <div className="grid gap-1.5">
    <Label>{label}</Label>
    <Input type={type} value={v ?? ""} onChange={e => onChange(e.target.value)} className={mono ? "font-mono" : ""} />
  </div>
);
