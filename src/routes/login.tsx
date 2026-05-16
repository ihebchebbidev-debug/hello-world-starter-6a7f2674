import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Bus, Loader2, Lock, MapPin, ShieldCheck, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import ecobusLogo from "@/assets/ecobus-logo-full.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — EcoBus" },
      { name: "description", content: "Accédez à la console d'administration EcoBus." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!loading && isAuthenticated) return <Navigate to="/dashboard" />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    
    if (!email || !password) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setBusy(true);
    try {
      await login(email, password);
      toast.success("Connexion réussie");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message || "Échec de la connexion");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* HERO */}
      <div className="relative hidden overflow-hidden bg-gradient-ink text-secondary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pattern-dots absolute inset-0 opacity-60" aria-hidden />
        <div
          className="absolute -right-32 -top-32 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(closest-side, oklch(0.60 0.105 200 / 0.45), transparent)" }}
          aria-hidden
        />
        <div
          className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(closest-side, oklch(0.74 0.10 200 / 0.30), transparent)" }}
          aria-hidden
        />

        <div className="relative flex items-center">
          <img src={ecobusLogo} alt="EcoBus" className="h-12 w-auto object-contain" />
        </div>

        <div className="relative max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-secondary-foreground/80 backdrop-blur">
            <span className="live-dot" /> Suivi temps réel actif
          </div>
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            Le transport scolaire,{" "}
            <span className="bg-gradient-to-r from-[oklch(0.85_0.10_200)] to-[oklch(0.95_0.05_200)] bg-clip-text text-transparent">
              sans angle mort.
            </span>
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-secondary-foreground/70">
            Pilotez votre flotte, vos chauffeurs et les trajets quotidiens depuis une seule
            console. Les parents et chauffeurs reçoivent les bonnes informations, au bon moment.
          </p>

          <ul className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
            {[
              { icon: MapPin, label: "Trajets en direct sur carte" },
              { icon: ShieldCheck, label: "SOS et géofences sécurisés" },
              { icon: Activity, label: "Analytique opérationnelle" },
              { icon: Lock, label: "Multi-écoles & rôles" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-secondary-foreground/85">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 ring-soft">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-secondary-foreground/50">
          © {new Date().getFullYear()} EcoBus — Transport scolaire connecté.
        </p>
      </div>

      {/* FORM */}
      <div className="flex items-center justify-center bg-gradient-surface p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-md">
              <Bus className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-base font-semibold text-foreground">EcoBus</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-8 shadow-elevated">
            <div className="mb-7 space-y-1.5">
              <h1 className="text-[26px] font-semibold tracking-tight text-foreground">Bon retour</h1>
              <p className="text-sm text-muted-foreground">Connectez-vous à votre console administrateur.</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="admin@ecole.tn"
                  className="h-11"
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Mot de passe
                  </Label>
                  <button
                    type="button"
                    onClick={() => toast.info("Contactez votre super administrateur pour réinitialiser votre mot de passe.")}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="h-11"
                  disabled={busy}
                />
              </div>
              <Button
                type="submit"
                className="h-11 w-full bg-gradient-brand text-primary-foreground shadow-md hover:opacity-95"
                disabled={busy}
              >
                {busy && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                Se connecter
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Protégé par chiffrement TLS · accès réservé aux administrateurs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
