import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { SosAPI } from "@/lib/api";
import { toast } from "sonner";
import { Check, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sos")({ component: SosPage });

const isResolved = (r: any) => r.resolvedAt || r.resolved_at || r.status === "resolved";
const isAcked = (r: any) => r.acknowledgedAt || r.acknowledged_at || r.status === "acknowledged";

function SosPage() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["sos"] });

  const ack = async (id: string) => {
    try { await SosAPI.acknowledge(id); toast.success("Pris en compte"); refresh(); }
    catch (e: any) { toast.error(e?.message || "Erreur"); }
  };
  const resolve = async (id: string) => {
    try { await SosAPI.resolve(id); toast.success("Résolu"); refresh(); }
    catch (e: any) { toast.error(e?.message || "Erreur"); }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Sécurité"
        title="Alertes SOS"
        description="Actions urgentes déclenchées par les chauffeurs ou parents — à traiter en priorité."
      />
      <DataList
        queryKey={["sos"]}
        queryFn={() => SosAPI.list()}
        searchKeys={["type", "message", "userName", "user_name"]}
        searchPlaceholder="Rechercher type, source, message…"
        refetchInterval={15_000}
        filters={[{
          key: "status",
          label: "Statut",
          defaultValue: "open",
          options: [
            { label: "Ouverts", value: "open", predicate: (r: any) => !isResolved(r) && !isAcked(r) },
            { label: "Pris en compte", value: "ack", predicate: (r: any) => isAcked(r) && !isResolved(r) },
            { label: "Résolus", value: "resolved", predicate: (r: any) => !!isResolved(r) },
          ],
        }]}
        emptyHint="Aucune alerte SOS — tout va bien."
        columns={[
          { key: "type", header: "Type", cell: (r) => <span className="font-medium text-foreground">{r.type || "SOS"}</span> },
          { key: "from", header: "Source", cell: (r) => r.userName || r.user_name || r.userId || "—" },
          { key: "msg", header: "Message", cell: (r) => <span className="line-clamp-1">{r.message || "—"}</span> },
          { key: "time", header: "Reçu", cell: (r) => (r.createdAt || r.created_at)?.slice?.(0, 16)?.replace("T", " ") || "—" },
          { key: "status", header: "Statut", cell: (r) =>
            isResolved(r) ? <Badge variant="secondary">résolu</Badge>
              : isAcked(r) ? <Badge>pris en compte</Badge>
              : <Badge variant="destructive">ouvert</Badge>,
          },
        ]}
        actions={(r: any) => (
          <>
            {!isAcked(r) && !isResolved(r) && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => ack(r.id)} title="Acquitter">
                <Check className="h-4 w-4" />
              </Button>
            )}
            {!isResolved(r) && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => resolve(r.id)} title="Résoudre">
                <ShieldCheck className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      />
    </div>
  );
}
