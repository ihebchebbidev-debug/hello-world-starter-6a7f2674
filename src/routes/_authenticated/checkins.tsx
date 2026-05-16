import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { CheckinsAPI } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/checkins")({ component: CheckinsPage });

const statusVariant: Record<string, any> = {
  boarded: "default", left: "secondary", absent: "destructive",
};
const statusLabel: Record<string, string> = {
  boarded: "monté", left: "descendu", absent: "absent",
};

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(d: number) { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); }

function CheckinsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Opérations"
        title="Check-ins"
        description="Historique des embarquements et descentes des enfants à bord."
      />
      <DataList
        queryKey={["checkins"]}
        queryFn={() => CheckinsAPI.list()}
        searchKeys={["childName", "child_name", "tripId"]}
        searchPlaceholder="Rechercher enfant, trajet…"
        refetchInterval={20_000}
        filters={[
          {
            key: "status",
            label: "Statut",
            options: [
              { label: "Montés", value: "boarded", predicate: (r: any) => r.status === "boarded" },
              { label: "Descendus", value: "left", predicate: (r: any) => r.status === "left" },
              { label: "Absents", value: "absent", predicate: (r: any) => r.status === "absent" },
            ],
          },
          {
            key: "when",
            label: "Période",
            defaultValue: "today",
            options: [
              { label: "Aujourd'hui", value: "today", predicate: (r: any) => (r.createdAt || r.timestamp || "").startsWith(todayISO()) },
              { label: "7 jours", value: "7d", predicate: (r: any) => (r.createdAt || r.timestamp || "") >= daysAgoISO(7) },
              { label: "30 jours", value: "30d", predicate: (r: any) => (r.createdAt || r.timestamp || "") >= daysAgoISO(30) },
            ],
          },
        ]}
        emptyHint="Aucun check-in pour cette période."
        columns={[
          { key: "child", header: "Enfant", cell: (r) => <span className="font-medium text-foreground">{r.childName || r.child_name || r.childId || "—"}</span> },
          { key: "trip", header: "Trajet", cell: (r) => <span className="font-mono text-xs">{r.tripId?.slice?.(0, 8) || "—"}</span> },
          { key: "method", header: "Méthode", cell: (r) => <Badge variant="outline">{r.method || "—"}</Badge> },
          { key: "time", header: "Heure", cell: (r) => <span className="tabular-nums">{(r.createdAt || r.timestamp)?.slice?.(11, 19) || "—"}</span> },
          { key: "status", header: "Statut", cell: (r) => <Badge variant={statusVariant[r.status] || "secondary"}>{statusLabel[r.status] || r.status}</Badge> },
        ]}
      />
    </div>
  );
}
