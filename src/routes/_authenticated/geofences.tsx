import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { EntityFormDialog, ConfirmDialog } from "@/components/entity-form-dialog";
import { GeofencesAPI } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/geofences")({ component: GeofencesPage });

const fields = [
  { name: "name", label: "Nom", required: true, placeholder: "Ex: École centre-ville" },
  { name: "latitude", label: "Latitude", type: "number" as const, required: true, placeholder: "36.8" },
  { name: "longitude", label: "Longitude", type: "number" as const, required: true, placeholder: "10.1" },
  { name: "radius", label: "Rayon (mètres)", type: "number" as const, required: true, min: 10, max: 100000, placeholder: "200" },
];

const fmtCoord = (r: any) => {
  const lat = r.lat ?? r.latitude;
  const lng = r.lng ?? r.longitude;
  return lat != null && lng != null ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : "—";
};

function GeofencesPage() {
  const qc = useQueryClient();
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [del, setDel] = useState<any | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["geofences"] });

  return (
    <div>
      <PageHeader title="Géofences" description="Zones géographiques surveillées (école, dépôt, etc.)." />
      <DataList
        queryKey={["geofences"]}
        queryFn={() => GeofencesAPI.list()}
        searchKeys={["name", "type"]}
        toolbar={<Button size="sm" onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Nouvelle géofence</Button>}
        columns={[
          { key: "name", header: "Nom", cell: (r) => <span className="font-medium text-foreground">{r.name || "—"}</span> },
          { key: "radius", header: "Rayon", cell: (r) => r.radius ? `${r.radius} m` : "—" },
          { key: "center", header: "Centre", cell: fmtCoord },
        ]}
        actions={(r) => (
          <>
            <Button size="icon" variant="ghost" onClick={() => setEdit({
              ...r,
              latitude: r.latitude ?? r.lat,
              longitude: r.longitude ?? r.lng,
            })}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </>
        )}
      />
      <EntityFormDialog open={create} onOpenChange={setCreate}
        title="Nouvelle géofence" fields={fields}
        onSubmit={async (v) => { await GeofencesAPI.create(v); refresh(); }} />
      <EntityFormDialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}
        title="Modifier la géofence" fields={fields} initial={edit || undefined}
        onSubmit={async (v) => { await GeofencesAPI.update(edit.id, v); refresh(); }} />
      <ConfirmDialog open={!!del} onOpenChange={(v) => !v && setDel(null)}
        title="Supprimer cette géofence ?" description={del?.name}
        onConfirm={async () => { await GeofencesAPI.remove(del.id); refresh(); }} />
    </div>
  );
}
