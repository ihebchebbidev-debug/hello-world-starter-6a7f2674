import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { TripsAPI } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/trips/history")({ component: TripsHistoryPage });

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgo = (d: number) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };

function TripsHistoryPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Opérations · Historique"
        title="Historique des trajets"
        description="Trajets terminés avec durée, statut et chauffeur affecté."
      />
      <DataList
        queryKey={["trips", "history"]}
        queryFn={() => TripsAPI.history()}
        searchKeys={["routeName", "route_name", "busNumber", "driverName"]}
        searchPlaceholder="Rechercher route, bus, chauffeur…"
        filters={[
          {
            key: "when",
            label: "Période",
            defaultValue: "7d",
            options: [
              { label: "Aujourd'hui", value: "today", predicate: (r: any) => (r.startedAt || "").startsWith(todayISO()) },
              { label: "7 jours", value: "7d", predicate: (r: any) => (r.startedAt || "").slice(0, 10) >= daysAgo(7) },
              { label: "30 jours", value: "30d", predicate: (r: any) => (r.startedAt || "").slice(0, 10) >= daysAgo(30) },
            ],
          },
          {
            key: "status",
            label: "Statut",
            options: [
              { label: "Terminés", value: "done", predicate: (r: any) => (r.status || "completed") === "completed" || r.status === "done" || r.status === "terminé" },
              { label: "Annulés", value: "cancel", predicate: (r: any) => r.status === "cancelled" || r.status === "annulé" },
            ],
          },
        ]}
        emptyHint="Aucun trajet pour cette période."
        columns={[
          { key: "route", header: "Route", cell: (r) => <span className="font-medium text-foreground">{r.routeName || r.route_name || "—"}</span> },
          { key: "bus", header: "Bus", cell: (r) => <Badge variant="outline">{r.busNumber || r.bus_number || "—"}</Badge> },
          { key: "driver", header: "Chauffeur", cell: (r) => r.driverName || r.driver_name || "—" },
          { key: "date", header: "Date", cell: (r) => <span className="tabular-nums">{r.startedAt?.slice?.(0, 10) || "—"}</span> },
          { key: "duration", header: "Durée", cell: (r) => <span className="tabular-nums">{r.durationMinutes ? `${r.durationMinutes} min` : "—"}</span> },
          { key: "status", header: "Statut", cell: (r) => <Badge variant="secondary">{r.status || "terminé"}</Badge> },
        ]}
      />
    </div>
  );
}
