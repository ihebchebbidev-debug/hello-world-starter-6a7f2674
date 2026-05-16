import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Bus, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AuthAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }, { title: "Signup — EcoBus" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  void navigate;
  const [organizationName, setOrgName] = useState("");
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && isAuthenticated) return <Navigate to="/dashboard" />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Read live from the form so Chrome autofill values are captured even
    // if React state hasn't synced their `change` events yet.
    const fd = new FormData(e.currentTarget);
    const v = {
      organizationName: String(fd.get("organizationName") || organizationName).trim(),
      firstName: String(fd.get("firstName") || firstName).trim(),
      lastName: String(fd.get("lastName") || lastName).trim(),
      email: String(fd.get("email") || email).trim(),
      phone: String(fd.get("phone") || phone).trim(),
      password: String(fd.get("password") || password),
    };
    if (!v.organizationName || !v.firstName || !v.lastName || !v.email) {
      toast.error("Tous les champs requis doivent être remplis.");
      return;
    }
    if (v.password.length < 8) {
      toast.error("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    setBusy(true);
    try {
      const res = await AuthAPI.registerOrgAdmin({ ...v, phone: v.phone || undefined });
      toast.success(`Compte admin créé pour ${res.organization?.name || v.organizationName}`);
      if (typeof window !== "undefined") window.location.href = "/dashboard";
    } catch (err: any) {
      toast.error(err?.message || "Échec de la création du compte");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-surface p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-md">
            <Bus className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold text-foreground">EcoBus</span>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-8 shadow-elevated">
          <div className="mb-6 space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
              <ShieldAlert className="h-3 w-3" /> Route secrète — tests uniquement
            </div>
            <h1 className="text-[26px] font-semibold tracking-tight text-foreground">Créer un admin + organisation</h1>
            <p className="text-sm text-muted-foreground">
              Crée une nouvelle école (organisation) et son administrateur initial via{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">POST /auth/register</code>.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org">Nom de l'organisation / école</Label>
              <Input id="org" name="organizationName" autoComplete="organization" required value={organizationName} onChange={(e) => setOrgName(e.target.value)} placeholder="École Primaire des Oliviers" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fn">Prénom</Label>
                <Input id="fn" name="firstName" autoComplete="given-name" required value={firstName} onChange={(e) => setFirst(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ln">Nom</Label>
                <Input id="ln" name="lastName" autoComplete="family-name" required value={lastName} onChange={(e) => setLast(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email admin</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@ecole.tn" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone (optionnel)</Label>
              <Input id="phone" name="phone" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+216 ..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Mot de passe (min. 8)</Label>
              <Input id="pw" name="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <Button type="submit" className="h-11 w-full bg-gradient-brand text-primary-foreground shadow-md hover:opacity-95" disabled={busy}>
              {busy && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
              Créer le compte admin
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Une fois connecté, créez chauffeurs / bus / routes / enfants depuis la console.
          </p>
        </div>
      </div>
    </div>
  );
}
