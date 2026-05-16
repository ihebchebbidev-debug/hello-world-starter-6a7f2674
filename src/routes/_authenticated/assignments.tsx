import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { EntityFormDialog, ConfirmDialog } from "@/components/entity-form-dialog";
import { DriversAPI, BusesAPI, RoutesAPI } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assignments")({ component: AssignmentsPage });

function AssignmentsPage() {
  const qc = useQueryClient();
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [del, setDel] = useState<any | null>(null);

  const drivers = useQuery({ queryKey: ["drivers"], queryFn: () => DriversAPI.list() });
  const buses = useQuery({ queryKey: ["buses"], queryFn: () => BusesAPI.list() });
  const routes = useQuery({ queryKey: ["routes"], queryFn: () => RoutesAPI.list() });

  const refresh = () => qc.invalidateQueries({ queryKey: ["assignments"] });

  const fields = useMemo(() => ([
    { name: "routeId", label: "Route", required: true, type: "select" as const,
      options: (routes.data || []).map((r: any) => ({ label: r.name, value: r.id })) },
    { name: "driverId", label: "Chauffeur", required: true, type: "select" as const,
      options: (drivers.data || []).map((d: any) => ({
        label: `${d.firstName || ""} ${d.lastName || ""} — ${d.email || ""}`.trim(), value: d.id })) },
    { name: "busId", label: "Bus", required: true, type: "select" as const,
      options: (buses.data || []).map((b: any) => ({ label: `${b.name} (${b.plateNumber || b.plate_number || ""})`, value: b.id })) },
    { name: "startDate", label: "Date début (YYYY-MM-DD)", placeholder: "2026-05-13" },
    { name: "endDate", label: "Date fin (YYYY-MM-DD)" },
  ]), [routes.data, drivers.data, buses.data]);

  return (
    <div>
      <PageHeader title="Affectations" description="Chauffeur · Bus · Route — planning et statut." />
      <DataList
        queryKey={["assignments"]}
        queryFn={async () => (await DriversAPI.assignments()) as any[]}
        searchKeys={["driverName", "busName", "routeName"]}
        toolbar={<Button size="sm" onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Nouvelle affectation</Button>}
        columns={[
          { key: "route", header: "Route", cell: (r) => r.routeName || r.route_name || r.routeId },
          {
            key: "driver",
            header: "Chauffeur",
            cell: (r) => {
              const full =
                r.driverName ||
                r.driver_name ||
                [r.driver_first_name ?? r.driverFirstName, r.driver_last_name ?? r.driverLastName]
                  .filter(Boolean)
                  .join(" ")
                  .trim();
              const email = r.driverEmail || r.driver_email;
              if (!full && !email) return r.driverId || r.driver_id;
              return (
                <div className="leading-tight">
                  <div>{full || email}</div>
                  {full && email ? <div className="text-xs text-muted-foreground">{email}</div> : null}
                </div>
              );
            },
          },
          { key: "bus", header: "Bus", cell: (r) => r.busName || r.bus_name || r.plate_number || r.busPlate || r.busId },
          { key: "start", header: "Début", cell: (r) => r.startDate || r.start_date || "—" },
          { key: "end", header: "Fin", cell: (r) => r.endDate || r.end_date || "—" },
          { key: "active", header: "Statut", cell: (r) => <Badge variant={r.isActive === false ? "secondary" : "default"}>{r.isActive === false ? "inactive" : "active"}</Badge> },
        ]}
        actions={(r) => (
          <>
            <Button size="icon" variant="ghost" title="Désactiver" onClick={async () => {
              try { await DriversAPI.deactivateAssignment(r.id); toast.success("Désactivée"); refresh(); }
              catch (e: any) { toast.error(e?.message || "Erreur"); }
            }}><PowerOff className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </>
        )}
      />
      <EntityFormDialog open={create} onOpenChange={setCreate}
        title="Nouvelle affectation" fields={fields}
        onSubmit={async (v) => { await DriversAPI.createAssignment(v); refresh(); }} />
      <EntityFormDialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}
        title="Modifier l'affectation" fields={fields.filter((f) => f.name !== "routeId")} initial={edit || undefined}
        onSubmit={async (v) => { await DriversAPI.updateAssignment(edit.id, v); refresh(); }} />
      <ConfirmDialog open={!!del} onOpenChange={(v) => !v && setDel(null)}
        title="Supprimer cette affectation ?"
        onConfirm={async () => { await DriversAPI.removeAssignment(del.id); refresh(); }} />
    </div>
  );
}
