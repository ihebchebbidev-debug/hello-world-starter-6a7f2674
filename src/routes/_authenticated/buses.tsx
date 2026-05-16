import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { EntityFormDialog, ConfirmDialog } from "@/components/entity-form-dialog";
import { BusesAPI } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/buses")({ component: BusesPage });

const fields = [
  { name: "name", label: "Nom", required: true, placeholder: "Ex: Bus 12" },
  { name: "plateNumber", label: "Plaque d'immatriculation", required: true },
  { name: "capacity", label: "Capacité", type: "number" as const, required: true, min: 1, max: 200 },
  { name: "status", label: "Statut", type: "select" as const, options: [
    { label: "Actif", value: "active" },
    { label: "Inactif", value: "inactive" },
    { label: "Maintenance", value: "maintenance" },
  ], defaultValue: "active" },
];

function BusesPage() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any | null>(null);
  const [del, setDel] = useState<any | null>(null);
  const [create, setCreate] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["buses"] });

  return (
    <div>
      <PageHeader title="Bus" description="Tous les véhicules de la flotte." />
      <DataList
        queryKey={["buses"]}
        queryFn={() => BusesAPI.list()}
        searchKeys={["name", "plateNumber", "plate_number"]}
        toolbar={<Button size="sm" onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Nouveau bus</Button>}
        columns={[
          { key: "name", header: "Nom", cell: (r) => <span className="font-medium text-foreground">{r.name || "—"}</span> },
          { key: "plate", header: "Plaque", cell: (r) => r.plateNumber || r.plate_number || "—" },
          { key: "cap", header: "Capacité", cell: (r) => r.capacity ?? "—" },
          { key: "status", header: "Statut", cell: (r) => <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status || "—"}</Badge> },
        ]}
        actions={(r) => (
          <>
            <Button size="icon" variant="ghost" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </>
        )}
      />
      <EntityFormDialog
        open={create} onOpenChange={setCreate}
        title="Nouveau bus" fields={fields}
        onSubmit={async (v) => { await BusesAPI.create(v); refresh(); }}
      />
      <EntityFormDialog
        open={!!edit} onOpenChange={(v) => !v && setEdit(null)}
        title="Modifier le bus" fields={fields} initial={edit || undefined}
        onSubmit={async (v) => { await BusesAPI.update(edit.id, v); refresh(); }}
      />
      <ConfirmDialog
        open={!!del} onOpenChange={(v) => !v && setDel(null)}
        title="Supprimer ce bus ?" description={del?.name}
        onConfirm={async () => { await BusesAPI.remove(del.id); refresh(); }}
      />
    </div>
  );
}
