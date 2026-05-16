import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, Plus, Save, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { RoutesAPI } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/routes/$routeId/stops")({
  component: RouteStopsPage,
});

type Stop = {
  id?: string;
  name: string;
  latitude: number | string;
  longitude: number | string;
  stopOrder: number;
  plannedTime?: string;
};

function RouteStopsPage() {
  const { routeId } = Route.useParams();
  const routeQ = useQuery({ queryKey: ["route", routeId], queryFn: () => RoutesAPI.get(routeId) });
  const stopsQ = useQuery({ queryKey: ["route-stops", routeId], queryFn: () => RoutesAPI.stops(routeId) });

  const [stops, setStops] = useState<Stop[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    if (stopsQ.data) {
      const sorted = [...stopsQ.data]
        .map((s: any, i: number) => ({
          id: s.id,
          name: s.name ?? "",
          latitude: s.latitude ?? s.lat ?? "",
          longitude: s.longitude ?? s.lng ?? "",
          stopOrder: s.stopOrder ?? s.stop_order ?? i,
          plannedTime: s.plannedTime ?? s.planned_time ?? "",
        }))
        .sort((a, b) => a.stopOrder - b.stopOrder)
        .map((s, i) => ({ ...s, stopOrder: i }));
      setStops(sorted);
      setDirty(false);
    }
  }, [stopsQ.data]);

  function update(i: number, patch: Partial<Stop>) {
    setStops((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    setDirty(true);
  }
  function add() {
    setStops((arr) => [
      ...arr,
      { name: "", latitude: "", longitude: "", stopOrder: arr.length, plannedTime: "" },
    ]);
    setDirty(true);
  }
  function remove(i: number) {
    setStops((arr) => arr.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, stopOrder: idx })));
    setDirty(true);
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= stops.length || from === to) return;
    setStops((arr) => {
      const next = [...arr];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next.map((s, idx) => ({ ...s, stopOrder: idx }));
    });
    setDirty(true);
  }

  async function save() {
    for (const s of stops) {
      if (!s.name?.trim()) return toast.error("Chaque arrêt doit avoir un nom");
      const lat = Number(s.latitude), lng = Number(s.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return toast.error(`Coordonnées invalides pour ${s.name}`);
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return toast.error(`Coordonnées hors plage pour ${s.name}`);
      if (s.plannedTime && !/^\d{2}:\d{2}(:\d{2})?$/.test(s.plannedTime)) {
        return toast.error(`Heure planifiée invalide pour ${s.name} (HH:MM)`);
      }
    }
    setBusy(true);
    try {
      const payload = stops.map((s, i) => ({
        name: s.name.trim(),
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        stopOrder: i,
        ...(s.plannedTime ? { plannedTime: s.plannedTime } : {}),
      }));
      await RoutesAPI.replaceStops(routeId, payload);
      toast.success("Arrêts enregistrés");
      setDirty(false);
      stopsQ.refetch();
    } catch (e: any) {
      toast.error(e?.message || "Erreur d'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  const route: any = routeQ.data;

  return (
    <div>
      <PageHeader
        title={route?.name ? `Arrêts — ${route.name}` : "Arrêts de la route"}
        description="Réordonnez par glisser-déposer ou avec les flèches. Enregistrez pour remplacer la liste."
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/routes"><ArrowLeft className="h-4 w-4" />Retour</Link>
          </Button>
          <Button size="sm" onClick={add}><Plus className="h-4 w-4" />Ajouter un arrêt</Button>
          <div className="ml-auto flex items-center gap-2">
            {dirty && <span className="text-xs text-muted-foreground">Modifications non enregistrées</span>}
            <Button size="sm" onClick={save} disabled={busy || !dirty || stops.length === 0}>
              <Save className="h-4 w-4" />{busy ? "..." : "Enregistrer"}
            </Button>
          </div>
        </div>

        {stopsQ.isLoading ? (
          <Card className="p-8 text-center text-muted-foreground">Chargement...</Card>
        ) : stops.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Aucun arrêt — cliquez sur "Ajouter un arrêt".</Card>
        ) : (
          <div className="space-y-2">
            {stops.map((s, i) => (
              <Card
                key={i}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragIdx != null) move(dragIdx, i); setDragIdx(null); }}
                className={`p-3 ${dragIdx === i ? "opacity-50" : ""}`}
              >
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex items-center gap-1 self-stretch text-muted-foreground">
                    <GripVertical className="h-4 w-4 cursor-grab" />
                    <span className="w-6 text-center text-xs font-mono">{i + 1}</span>
                  </div>
                  <div className="grid flex-1 min-w-[180px] gap-1">
                    <Label className="text-xs">Nom</Label>
                    <Input value={s.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Ex: Arrêt École" />
                  </div>
                  <div className="grid w-32 gap-1">
                    <Label className="text-xs">Latitude</Label>
                    <Input type="number" step="any" value={s.latitude} onChange={(e) => update(i, { latitude: e.target.value })} />
                  </div>
                  <div className="grid w-32 gap-1">
                    <Label className="text-xs">Longitude</Label>
                    <Input type="number" step="any" value={s.longitude} onChange={(e) => update(i, { longitude: e.target.value })} />
                  </div>
                  <div className="grid w-28 gap-1">
                    <Label className="text-xs">Heure</Label>
                    <Input type="time" value={s.plannedTime || ""} onChange={(e) => update(i, { plannedTime: e.target.value })} />
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => move(i, i - 1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => move(i, i + 1)} disabled={i === stops.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
