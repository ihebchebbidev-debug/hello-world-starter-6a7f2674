import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { AbsencesAPI } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/absences")({ component: AbsencesPage });

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgo = (d: number) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };

const statusVariant = (s?: string) =>
  s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary";

function AbsencesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Opérations"
        title="Absences"
        description="Déclarations d'absence transmises par les parents pour leurs enfants."
      />
      <DataList
        queryKey={["absences"]}
        queryFn={() => AbsencesAPI.list()}
        searchKeys={["childName", "child_name", "reason"]}
        searchPlaceholder="Rechercher enfant, motif…"
        filters={[
          {
            key: "when",
            label: "Période",
            defaultValue: "active",
            options: [
              { label: "À venir / actives", value: "active", predicate: (r: any) => ((r.toDate || r.to_date || "").slice(0, 10) || todayISO()) >= todayISO() },
              { label: "7 derniers jours", value: "7d", predicate: (r: any) => (r.fromDate || r.from_date || "").slice(0, 10) >= daysAgo(7) },
              { label: "30 derniers jours", value: "30d", predicate: (r: any) => (r.fromDate || r.from_date || "").slice(0, 10) >= daysAgo(30) },
            ],
          },
          {
            key: "status",
            label: "Statut",
            options: [
              { label: "Déclarées", value: "pending", predicate: (r: any) => !r.status || r.status === "pending" || r.status === "déclaré" },
              { label: "Approuvées", value: "approved", predicate: (r: any) => r.status === "approved" },
              { label: "Refusées", value: "rejected", predicate: (r: any) => r.status === "rejected" },
            ],
          },
        ]}
        emptyHint="Aucune absence pour ces filtres."
        columns={[
          { key: "child", header: "Enfant", cell: (r) => <span className="font-medium text-foreground">{r.childName || r.child_name || r.childId || "—"}</span> },
          { key: "from", header: "Du", cell: (r) => <span className="tabular-nums">{(r.fromDate || r.from_date)?.slice?.(0, 10) || "—"}</span> },
          { key: "to", header: "Au", cell: (r) => <span className="tabular-nums">{(r.toDate || r.to_date)?.slice?.(0, 10) || "—"}</span> },
          { key: "reason", header: "Motif", cell: (r) => <span className="text-muted-foreground">{r.reason || "—"}</span> },
          { key: "status", header: "Statut", cell: (r) => <Badge variant={statusVariant(r.status)}>{r.status || "déclaré"}</Badge> },
        ]}
      />
    </div>
  );
}
