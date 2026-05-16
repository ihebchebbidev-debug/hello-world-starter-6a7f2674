import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { BASE_URL } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, isSuperAdmin } = useAuth();
  return (
    <div>
      <PageHeader title="Paramètres" description="Profil et configuration de la console." />
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground">Profil</h2>
          <p className="mt-1 text-sm text-muted-foreground">Vos informations de compte.</p>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email || ""} readOnly />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prénom</Label>
                <Input value={user?.firstName || ""} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Nom</Label>
                <Input value={user?.lastName || ""} readOnly />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <div><Badge>{isSuperAdmin ? "Super admin" : "School admin"}</Badge></div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground">Système</h2>
          <p className="mt-1 text-sm text-muted-foreground">Connexion au backend EcoBus.</p>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label>API endpoint</Label>
              <Input value={BASE_URL} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label>Version console</Label>
              <Input value="v1.0.0" readOnly />
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Recharger l'application
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
