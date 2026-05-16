import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { EntityFormDialog, ConfirmDialog } from "@/components/entity-form-dialog";
import { RoutesAPI } from "@/lib/api";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/routes")({ component: RoutesPage });

const fields = [
  { name: "name", label: "Nom", required: true, placeholder: "Ex: Ligne Nord" },
  { name: "description", label: "Description" },
];

function RoutesPage() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any | null>(null);
  const [del, setDel] = useState<any | null>(null);
  const [create, setCreate] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["routes"] });

  return (
    <div>
      <PageHeader title="Routes" description="Itinéraires définis pour les trajets quotidiens." />
      <DataList
        queryKey={["routes"]}
        queryFn={() => RoutesAPI.list()}
        searchKeys={["name", "description"]}
        toolbar={<Button size="sm" onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Nouvelle route</Button>}
        columns={[
          { key: "name", header: "Nom", cell: (r) => <span className="font-medium text-foreground">{r.name || "—"}</span> },
          { key: "desc", header: "Description", cell: (r) => r.description || "—" },
          { key: "active", header: "Active", cell: (r) => (r.is_active === false ? "Non" : "Oui") },
          { key: "stops", header: "Arrêts", cell: (r) => (
            <Link to="/routes/$routeId/stops" params={{ routeId: r.id }} className="text-primary underline-offset-4 hover:underline">Éditer</Link>
          ) },
        ]}
        actions={(r) => (
          <>
            <Button size="icon" variant="ghost" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </>
        )}
      />
      <EntityFormDialog open={create} onOpenChange={setCreate}
        title="Nouvelle route" fields={fields}
        onSubmit={async (v) => { await RoutesAPI.create(v); refresh(); }} />
      <EntityFormDialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}
        title="Modifier la route" fields={fields} initial={edit || undefined}
        onSubmit={async (v) => { await RoutesAPI.update(edit.id, v); refresh(); }} />
      <ConfirmDialog open={!!del} onOpenChange={(v) => !v && setDel(null)}
        title="Supprimer cette route ?" description={del?.name}
        onConfirm={async () => { await RoutesAPI.remove(del.id); refresh(); }} />
    </div>
  );
}
