import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { SchoolsAPI } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/schools")({ component: SchoolsPage });

function SchoolsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Personnes"
        title="Écoles"
        description="Établissements scolaires desservis par votre flotte (dérivés des organisations)."
      />
      <DataList
        queryKey={["schools"]}
        queryFn={() => SchoolsAPI.list()}
        searchKeys={["name", "address", "contactEmail", "phone"]}
        searchPlaceholder="Rechercher école, email, adresse…"
        emptyHint="Aucune école enregistrée. Créez d'abord une organisation."
        columns={[
          { key: "name", header: "Nom", cell: (r) => <span className="font-medium text-foreground">{r.name || "—"}</span> },
          { key: "email", header: "Email", cell: (r) => <span className="text-muted-foreground">{r.contactEmail || "—"}</span> },
          { key: "phone", header: "Téléphone", cell: (r) => r.phone || "—" },
          { key: "address", header: "Adresse", cell: (r) => <span className="text-muted-foreground">{r.address || "—"}</span> },
          { key: "plan", header: "Formule", cell: (r) => r.subscriptionPlan ? <Badge variant="outline" className="capitalize">{r.subscriptionPlan}</Badge> : "—" },
        ]}
      />
    </div>
  );
}
