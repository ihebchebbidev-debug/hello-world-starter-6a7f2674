import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Setup — EcoBus" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: SetupPage,
});

function SetupPage() {
  const nav = useNavigate();
  const [f, setF] = useState({
    organizationName: "EcoBus QA Org",
    firstName: "QA",
    lastName: "Admin",
    email: `qa.admin+${Date.now()}@ecobus.test`,
    phone: "+21670000000",
    password: "Passw0rd!QA",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await AuthAPI.registerOrgAdmin(f);
      setResult(r);
      toast.success("Admin créé", { description: `${f.email} — ${f.organizationName}` });
    } catch (e: any) {
      const msg = e?.message || "Failed";
      setErr(msg);
      toast.error("Échec de la création", { description: msg });
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-elevated">
        <h1 className="text-2xl font-semibold tracking-tight">Hidden setup — create org admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Provisions a new organization + super admin via backend <code>/auth/register</code>.</p>
        <form onSubmit={submit} className="mt-6 grid gap-3">
          {(["organizationName","firstName","lastName","email","phone","password"] as const).map((k) => (
            <label key={k} className="grid gap-1 text-sm">
              <span className="font-medium capitalize">{k}</span>
              <input
                value={(f as any)[k]}
                onChange={(e) => setF({ ...f, [k]: e.target.value })}
                className="h-10 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
              />
            </label>
          ))}
          <Button type="submit" disabled={busy} className="mt-2 h-11 rounded-xl bg-primary text-primary-foreground">
            {busy ? "Creating…" : "Create admin"}
          </Button>
        </form>
        {err && <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{err}</div>}
        {result && (
          <div className="mt-4 rounded-lg bg-success/10 p-3 text-sm">
            <div className="font-semibold">Created ✓</div>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(result, null, 2)}</pre>
            <Button onClick={() => nav({ to: "/dashboard" as any })} className="mt-3 h-10 rounded-lg bg-secondary text-secondary-foreground">
              Go to dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
