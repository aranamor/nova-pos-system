import { FormEvent, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: any | null;
  onSaved: () => void;
};

export function CustomerFormDialog({ open, onOpenChange, initial, onSaved }: Props) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setMobile(initial?.mobile ?? "");
    setDoctorName(initial?.doctor_name ?? initial?.doctorName ?? "");
  }, [open, initial]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim()) {
      toast.error("Name and mobile are required");
      return;
    }
    setBusy(true);
    try {
      if (initial?.id) {
        await api.updateCustomer(initial.id, { name, mobile, doctor_name: doctorName });
        toast.success("Customer updated");
      } else {
        await api.createCustomer({ name, mobile, doctorName });
        toast.success("Customer added");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            {initial?.id ? "Edit Customer" : "Add Customer"}
          </DialogTitle>
          <DialogDescription>Patients identified by mobile number.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label>Mobile</Label>
            <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="10-digit number" />
          </div>
          <div className="grid gap-1.5">
            <Label>Doctor (optional)</Label>
            <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {initial?.id ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
