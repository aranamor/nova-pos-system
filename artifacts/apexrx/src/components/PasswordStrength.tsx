import { useMemo } from "react";

export function passwordScore(pw: string): { score: number; label: string; checks: { label: string; ok: boolean }[] } {
  const checks = [
    { label: "At least 10 characters", ok: pw.length >= 10 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(pw) },
    { label: "Lowercase letter", ok: /[a-z]/.test(pw) },
    { label: "Number", ok: /\d/.test(pw) },
    { label: "Symbol", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  let score = passed;
  if (pw.length >= 16) score = Math.min(5, score + 0.5);
  const label =
    passed <= 1 ? "Very weak" : passed === 2 ? "Weak" : passed === 3 ? "Fair" : passed === 4 ? "Strong" : "Excellent";
  return { score, label, checks };
}

export function PasswordStrength({ password }: { password: string }) {
  const { score, label, checks } = useMemo(() => passwordScore(password), [password]);
  const pct = Math.min(100, (score / 5) * 100);
  const color =
    score <= 1
      ? "bg-destructive"
      : score === 2
      ? "bg-orange-500"
      : score === 3
      ? "bg-yellow-500"
      : score === 4
      ? "bg-emerald-500"
      : "bg-emerald-400";

  return (
    <div className="space-y-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${color}`}
          style={{ width: password ? `${pct}%` : "0%" }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Password strength</span>
        <span className="font-medium">{password ? label : "—"}</span>
      </div>
      <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        {checks.map((c) => (
          <li
            key={c.label}
            className={`flex items-center gap-1.5 ${c.ok ? "text-emerald-500" : "text-muted-foreground"}`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                c.ok ? "bg-emerald-500" : "bg-muted-foreground/40"
              }`}
            />
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
