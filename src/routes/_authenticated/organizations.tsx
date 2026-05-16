import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { EntityFormDialog, ConfirmDialog } from "@/components/entity-form-dialog";
import { OrganizationsAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/organizations")({ component: OrganizationsPage });

// Backend stores: name, contact_email, phone, address, subscription_plan, subscription_status.
// We expose only those fields so the create/edit form actually persists what the user types.
const PLAN_OPTIONS = [
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

function OrganizationsPage() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["organizations"] });
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<any>(null);
  const [delOpen, setDelOpen] = useState<any>(null);

  if (!isSuperAdmin) return <Navigate to="/dashboard" />;

  const fields = [
    { name: "name", label: "Nom", required: true, placeholder: "Ex. École Primaire des Oliviers" },
    { name: "contactEmail", label: "Email de contact", type: "email", placeholder: "contact@ecole.tn" },
    { name: "phone", label: "Téléphone", placeholder: "+216 …" },
    { name: "address", label: "Adresse", placeholder: "12 Avenue Habib Bourguiba, Tunis" },
    { name: "subscriptionPlan", label: "Formule", type: "select", options: PLAN_OPTIONS },
  ] as const;

  // Backend returns snake_case; the form expects camelCase initial values.
  const toFormValues = (r: any) => ({
    name: r?.name ?? "",
    contactEmail: r?.contactEmail ?? r?.contact_email ?? "",
    phone: r?.phone ?? "",
    address: r?.address ?? "",
    subscriptionPlan: r?.subscriptionPlan ?? r?.subscription_plan ?? "",
  });

  return (
    <div>
      <PageHeader
        eyebrow="Super admin"
        title="Organisations"
        description="Tenants — chaque organisation est isolée par RLS côté backend."
        actions={<Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4" />Nouvelle organisation</Button>}
      />
      <DataList
        queryKey={["organizations"]}
        queryFn={() => OrganizationsAPI.list()}
        searchKeys={["name", "contact_email", "phone", "address"]}
        searchPlaceholder="Rechercher nom, email, adresse…"
        emptyHint="Aucune organisation. Ajoutez la première école pour démarrer."
        emptyAction={<Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4" />Créer une organisation</Button>}
        columns={[
          { key: "name", header: "Nom", cell: (r) => <span className="font-medium text-foreground">{r.name || "—"}</span> },
          { key: "email", header: "Email", cell: (r) => <span className="text-muted-foreground">{r.contactEmail || r.contact_email || "—"}</span> },
          { key: "phone", header: "Téléphone", cell: (r) => r.phone || "—" },
          { key: "address", header: "Adresse", cell: (r) => <span className="text-muted-foreground">{r.address || "—"}</span> },
          {
            key: "plan",
            header: "Formule",
            cell: (r) => {
              const plan = r.subscriptionPlan ?? r.subscription_plan;
              const status = r.subscriptionStatus ?? r.subscription_status;
              if (!plan && !status) return "—";
              return (
                <div className="flex flex-wrap gap-1">
                  {plan ? <Badge variant="outline" className="capitalize">{plan}</Badge> : null}
                  {status ? <Badge variant="secondary" className="capitalize">{status}</Badge> : null}
                </div>
              );
            },
          },
        ]}
        actions={(r) => (
          <>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditOpen(r)} title="Éditer">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDelOpen(r)} title="Supprimer">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      />

      <EntityFormDialog
        open={createOpen} onOpenChange={setCreateOpen}
        title="Nouvelle organisation"
        description="Créez un tenant isolé pour une école ou un opérateur."
        fields={fields as any}
        onSubmit={async (v) => { await OrganizationsAPI.create(v); toast.success("Organisation créée"); refresh(); }}
      />
      <EntityFormDialog
        open={!!editOpen} onOpenChange={(o) => !o && setEditOpen(null)}
        title="Modifier l'organisation"
        fields={fields as any}
        initial={editOpen ? toFormValues(editOpen) : undefined}
        onSubmit={async (v) => { await OrganizationsAPI.update(editOpen.id, v); toast.success("Modifications enregistrées"); refresh(); }}
      />
      <ConfirmDialog
        open={!!delOpen} onOpenChange={(o) => !o && setDelOpen(null)}
        title="Supprimer cette organisation ?"
        description={<>L'organisation <span className="font-medium text-foreground">{delOpen?.name}</span> et toutes ses données associées seront supprimées.</>}
        onConfirm={async () => { await OrganizationsAPI.remove(delOpen.id); toast.success("Supprimé"); refresh(); }}
      />
    </div>
  );
}
