import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { StopsAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/stops")({ component: StopsPage });

function StopsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Flotte"
        title="Arrêts"
        description="Tous les arrêts agrégés depuis vos routes actives."
      />
      <DataList
        queryKey={["stops"]}
        queryFn={() => StopsAPI.list()}
        searchKeys={["name", "address", "routeName"]}
        searchPlaceholder="Rechercher arrêt, route, adresse…"
        emptyHint="Aucun arrêt. Ajoutez d'abord des routes et leurs arrêts."
        columns={[
          { key: "name", header: "Nom", cell: (r) => <span className="font-medium text-foreground">{r.name || "—"}</span> },
          { key: "route", header: "Route", cell: (r) => r.routeName ? <Badge variant="outline">{r.routeName}</Badge> : "—" },
          { key: "address", header: "Adresse", cell: (r) => <span className="text-muted-foreground">{r.address || "—"}</span> },
          { key: "lat", header: "Latitude", cell: (r) => <span className="font-mono text-xs tabular-nums">{(r.latitude ?? r.lat)?.toFixed?.(5) ?? "—"}</span> },
          { key: "lng", header: "Longitude", cell: (r) => <span className="font-mono text-xs tabular-nums">{(r.longitude ?? r.lng)?.toFixed?.(5) ?? "—"}</span> },
        ]}
        actions={(r: any) => (
          r.routeId ? (
            <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0" title="Éditer la route">
              <Link to="/routes/$routeId/stops" params={{ routeId: r.routeId }}>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          ) : null
        ) as any}
      />
    </div>
  );
}
