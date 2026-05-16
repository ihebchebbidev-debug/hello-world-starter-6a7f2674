import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { AlertsAPI } from "@/lib/api";
import { Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/alerts")({ component: AlertsPage });

const sevVariant = (s: string) =>
  s === "critical" || s === "high" ? "destructive" : s === "medium" ? "default" : "secondary";

function AlertsPage() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["alerts"] });

  const ack = async (id: string) => {
    try { await AlertsAPI.acknowledge(id); toast.success("Pris en compte"); refresh(); }
    catch (e: any) { toast.error(e?.message || "Erreur"); }
  };
  const resolve = async (id: string) => {
    try { await AlertsAPI.resolve(id); toast.success("Résolu"); refresh(); }
    catch (e: any) { toast.error(e?.message || "Erreur"); }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Sécurité"
        title="Alertes"
        description="Alertes système : retards, déviations de route, géofences, anomalies de capteur."
      />
      <DataList
        queryKey={["alerts"]}
        queryFn={() => AlertsAPI.list()}
        searchKeys={["type", "message", "severity", "busNumber", "bus_number"]}
        searchPlaceholder="Rechercher type, message, bus…"
        refetchInterval={30_000}
        filters={[
          {
            key: "status",
            label: "Statut",
            defaultValue: "open",
            options: [
              { label: "Ouvertes", value: "open", predicate: (r: any) => !r.resolved && r.status !== "resolved" },
              { label: "Résolues", value: "resolved", predicate: (r: any) => r.resolved || r.status === "resolved" },
            ],
          },
          {
            key: "sev",
            label: "Sévérité",
            options: [
              { label: "Critique", value: "critical", predicate: (r: any) => r.severity === "critical" || r.severity === "high" },
              { label: "Moyenne", value: "medium", predicate: (r: any) => r.severity === "medium" },
              { label: "Info", value: "info", predicate: (r: any) => !r.severity || r.severity === "info" || r.severity === "low" },
            ],
          },
        ]}
        emptyHint="Aucune alerte enregistrée."
        columns={[
          { key: "sev", header: "Sévérité", cell: (r) => <Badge variant={sevVariant(r.severity)}>{r.severity || "info"}</Badge> },
          { key: "type", header: "Type", cell: (r) => <span className="font-medium text-foreground">{r.type || "—"}</span> },
          { key: "msg", header: "Message", cell: (r) => <span className="line-clamp-1">{r.message || "—"}</span> },
          { key: "bus", header: "Bus", cell: (r) => r.busNumber || r.bus_number || "—" },
          { key: "time", header: "Reçu", cell: (r) => (r.createdAt || r.created_at)?.slice?.(0, 16)?.replace("T", " ") || "—" },
          { key: "status", header: "Statut", cell: (r) => <Badge variant={r.resolved ? "secondary" : "default"}>{r.resolved ? "résolu" : "actif"}</Badge> },
        ]}
        actions={(r: any) => (r.resolved || r.status === "resolved" ? null : (
          <>
            {!r.acknowledged && !r.acknowledgedAt && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => ack(r.id)} title="Acquitter">
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => resolve(r.id)} title="Résoudre">
              <ShieldCheck className="h-4 w-4" />
            </Button>
          </>
        )) as any}
      />
    </div>
  );
}
