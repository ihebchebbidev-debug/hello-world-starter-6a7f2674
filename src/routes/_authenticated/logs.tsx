import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogsAPI } from "@/lib/api";
import { RefreshCw, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/logs")({ component: LogsPage });

function LogsPage() {
  const [token, setToken] = useState(LogsAPI.getToken());
  const [level, setLevel] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(200);

  useEffect(() => { LogsAPI.setToken(token); }, [token]);

  const q = useQuery({
    queryKey: ["logs", level, search, limit, token],
    queryFn: () => LogsAPI.tail({ level: level === "all" ? undefined : level, search: search || undefined, limit }),
    enabled: !!token,
    refetchInterval: 10_000,
  });

  const entries: any[] = (q.data as any)?.entries || [];

  return (
    <div>
      <PageHeader title="Logs serveur" description="Flux des logs backend (super admin)." />
      <div className="space-y-4 p-6">
        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="grid gap-1.5">
              <Label htmlFor="tok">Jeton X-Log-Token</Label>
              <Input id="tok" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Coller le LOG_VIEWER_TOKEN" />
            </div>
            <div className="flex items-end"><Button onClick={() => LogsAPI.setToken(token)}><Save className="h-4 w-4" />Enregistrer</Button></div>
          </div>
        </Card>

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>Niveau</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all", "error", "warn", "info", "http", "verbose", "debug"].map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 flex-1 min-w-[200px]">
            <Label>Recherche</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex: error, /api/..." />
          </div>
          <div className="grid gap-1.5">
            <Label>Limite</Label>
            <Input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value) || 200)} className="w-28" />
          </div>
          <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />Actualiser
          </Button>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="max-h-[60vh] overflow-auto">
            {!token ? (
              <div className="p-6 text-sm text-muted-foreground">Renseignez votre jeton de logs ci-dessus pour afficher les entrées.</div>
            ) : entries.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">Aucune entrée.</div>
            ) : (
              <ul className="divide-y divide-border font-mono text-xs">
                {entries.map((e, i) => (
                  <li key={i} className="grid grid-cols-[auto_auto_1fr] gap-3 px-4 py-2">
                    <span className="text-muted-foreground">{(e.timestamp || e.time || "").slice(0, 19).replace("T", " ")}</span>
                    <Badge variant={e.level === "error" ? "destructive" : e.level === "warn" ? "secondary" : "default"}>{e.level || "info"}</Badge>
                    <span className="break-all">{e.message || JSON.stringify(e)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
