import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { EntityFormDialog, ConfirmDialog } from "@/components/entity-form-dialog";
import { ParentsAPI, UsersAPI } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/parents")({ component: ParentsPage });

const createFields = [
  { name: "firstName", label: "Prénom", required: true },
  { name: "lastName", label: "Nom", required: true },
  { name: "email", label: "Email", type: "email" as const, required: true },
  { name: "phone", label: "Téléphone", type: "tel" as const, required: true, placeholder: "+216 ..." },
  { name: "password", label: "Mot de passe initial", type: "password" as const, required: true, placeholder: "Min. 8 caractères" },
];

const editFields = [
  { name: "firstName", label: "Prénom", required: true },
  { name: "lastName", label: "Nom", required: true },
  { name: "email", label: "Email", type: "email" as const, required: true },
  { name: "phone", label: "Téléphone", type: "tel" as const, required: true },
];

function ParentsPage() {
  const qc = useQueryClient();
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [reset, setReset] = useState<any | null>(null);
  const [del, setDel] = useState<any | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["parents"] });

  return (
    <div>
      <PageHeader title="Parents" description="Comptes parents associés aux enfants." />
      <DataList
        queryKey={["parents"]}
        queryFn={() => ParentsAPI.list()}
        searchKeys={["firstName", "lastName", "email", "phone"]}
        toolbar={<Button size="sm" onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Ajouter parent</Button>}
        columns={[
          { key: "name", header: "Nom", cell: (r) => <span className="font-medium text-foreground">{[r.firstName, r.lastName].filter(Boolean).join(" ") || r.name || "—"}</span> },
          { key: "email", header: "Email", cell: (r) => r.email || "—" },
          { key: "phone", header: "Téléphone", cell: (r) => r.phone || "—" },
          { key: "active", header: "Actif", cell: (r) => (r.is_active === false ? "Non" : "Oui") },
        ]}
        actions={(r) => (
          <>
            <Button size="icon" variant="ghost" onClick={() => setEdit(r)} title="Modifier"><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setReset(r)} title="Réinitialiser le mot de passe"><KeyRound className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setDel(r)} title="Supprimer"><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </>
        )}
      />
      <EntityFormDialog open={create} onOpenChange={setCreate}
        title="Nouveau parent" description="Le parent recevra ces identifiants pour se connecter à l'app mobile."
        fields={createFields}
        onSubmit={async (v) => { await ParentsAPI.create(v as any); refresh(); }} />
      <EntityFormDialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}
        title="Modifier le parent" fields={editFields} initial={edit || undefined}
        onSubmit={async (v) => { await UsersAPI.update(edit.id, v); refresh(); }} />
      <EntityFormDialog open={!!reset} onOpenChange={(v) => !v && setReset(null)}
        title="Réinitialiser le mot de passe"
        description={`Nouveau mot de passe pour ${[reset?.firstName, reset?.lastName].filter(Boolean).join(" ") || reset?.email || ""}`}
        fields={[{ name: "newPassword", label: "Nouveau mot de passe", type: "password", required: true, placeholder: "Min. 8 caractères" }]}
        onSubmit={async (v) => { await UsersAPI.resetPassword(reset.id, v.newPassword); }} />
      <ConfirmDialog open={!!del} onOpenChange={(v) => !v && setDel(null)}
        title="Supprimer ce parent ?" description={[del?.firstName, del?.lastName].filter(Boolean).join(" ") || del?.email}
        onConfirm={async () => { await UsersAPI.remove(del.id); refresh(); }} />
    </div>
  );
}
