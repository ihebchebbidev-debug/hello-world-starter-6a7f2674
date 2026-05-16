import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { EntityFormDialog, ConfirmDialog } from "@/components/entity-form-dialog";
import { ChildrenAPI, ParentsAPI, RoutesAPI } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/children")({ component: ChildrenPage });

function ChildrenPage() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any | null>(null);
  const [del, setDel] = useState<any | null>(null);
  const [create, setCreate] = useState(false);
  const [assign, setAssign] = useState<any | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["children"] });

  const parents = useQuery({ queryKey: ["parents"], queryFn: () => ParentsAPI.list() });
  const routes = useQuery({ queryKey: ["routes"], queryFn: () => RoutesAPI.list() });

  const fields = useMemo(() => ([
    { name: "firstName", label: "Prénom", required: true },
    { name: "lastName", label: "Nom", required: true },
    { name: "dateOfBirth", label: "Date de naissance (YYYY-MM-DD)", placeholder: "2015-04-12" },
    { name: "parentId", label: "Parent", type: "select" as const, options: (parents.data || []).map((p: any) => ({
      label: `${p.firstName || ""} ${p.lastName || ""} — ${p.email || ""}`.trim(), value: p.id,
    })) },
  ]), [parents.data]);

  const assignFields = useMemo(() => ([
    { name: "routeId", label: "Route", required: true, type: "select" as const, options: (routes.data || []).map((r: any) => ({ label: r.name, value: r.id })) },
  ]), [routes.data]);

  return (
    <div>
      <PageHeader title="Enfants" description="Élèves enregistrés et leurs affectations à des routes." />
      <DataList
        queryKey={["children"]}
        queryFn={() => ChildrenAPI.list()}
        searchKeys={["firstName", "lastName"]}
        toolbar={<Button size="sm" onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Nouvel enfant</Button>}
        columns={[
          { key: "name", header: "Nom", cell: (r) => <span className="font-medium text-foreground">{[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}</span> },
          {
            key: "dob",
            header: "Naissance",
            cell: (r) => {
              const raw = r.dateOfBirth || r.date_of_birth;
              if (!raw) return "—";
              const s = String(raw);
              return s.length >= 10 ? s.slice(0, 10) : s;
            },
          },
          {
            key: "parent",
            header: "Parent",
            cell: (r) => {
              const direct =
                r.parentName ||
                r.parent_name ||
                [r.parent_first_name ?? r.parentFirstName, r.parent_last_name ?? r.parentLastName]
                  .filter(Boolean)
                  .join(" ")
                  .trim();
              if (direct) return direct;
              const pid = r.parentId || r.parent_id;
              if (pid && parents.data) {
                const p = (parents.data as any[]).find((x: any) => x.id === pid);
                if (p) {
                  const name = `${p.firstName || p.first_name || ""} ${p.lastName || p.last_name || ""}`.trim();
                  return name || p.email || p.phone || "—";
                }
              }
              return r.parentEmail || r.parent_email || "—";
            },
          },
          { key: "route", header: "Route", cell: (r) => r.routeName || r.route_name || "—" },
        ]}
        actions={(r) => (
          <>
            <Button size="icon" variant="ghost" title="Affecter à une route" onClick={() => setAssign(r)}><RouteIcon className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </>
        )}
      />
      <EntityFormDialog open={create} onOpenChange={setCreate}
        title="Nouvel enfant" fields={fields}
        onSubmit={async (v) => { await ChildrenAPI.create(v); refresh(); }} />
      <EntityFormDialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}
        title="Modifier l'enfant" fields={fields} initial={edit || undefined}
        onSubmit={async (v) => { await ChildrenAPI.update(edit.id, v); refresh(); }} />
      <EntityFormDialog open={!!assign} onOpenChange={(v) => !v && setAssign(null)}
        title="Affecter à une route" fields={assignFields}
        onSubmit={async (v) => { await ChildrenAPI.assignRoute(assign.id, v); refresh(); }} />
      <ConfirmDialog open={!!del} onOpenChange={(v) => !v && setDel(null)}
        title="Supprimer cet enfant ?" description={[del?.firstName, del?.lastName].filter(Boolean).join(" ")}
        onConfirm={async () => { await ChildrenAPI.remove(del.id); refresh(); }} />
    </div>
  );
}
