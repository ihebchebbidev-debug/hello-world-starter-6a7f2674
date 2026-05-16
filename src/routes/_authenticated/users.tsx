import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search, RefreshCw, Inbox } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { UsersAPI } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/users")({ component: UsersPage });

const ROLES = [
  { value: "parent", label: "Parents" },
  { value: "driver", label: "Chauffeurs" },
  { value: "school_manager", label: "Gestionnaires d'école" },
  { value: "admin", label: "Admins" },
  { value: "super_admin", label: "Super admins" },
  { value: "all", label: "Tous les rôles" },
];

const roleVariant: Record<string, string> = {
  parent: "bg-primary/10 text-primary border-primary/20",
  driver: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  admin: "bg-rose-500/10 text-rose-700 border-rose-500/20",
  super_admin: "bg-violet-500/10 text-violet-700 border-violet-500/20",
  school_manager: "bg-sky-500/10 text-sky-700 border-sky-500/20",
};

function UsersPage() {
  const [role, setRole] = useState<string>("parent");
  const [q, setQ] = useState("");

  const { data = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["users", role],
    queryFn: () => UsersAPI.list(role === "all" ? {} : { role }),
  });

  const rows = useMemo(() => {
    if (!q.trim()) return data;
    const n = q.toLowerCase();
    return data.filter((r: any) =>
      ["firstName", "lastName", "email", "phone", "name"].some((k) =>
        String(r[k] ?? "").toLowerCase().includes(n),
      ),
    );
  }, [data, q]);

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        description="Tous les comptes — filtrés par rôle (parent par défaut via /users?role=parent)."
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Rôle" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher nom, email, téléphone..."
              className="pl-9"
            />
          </div>

          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Actualiser
          </Button>

          <div className="ml-auto text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "utilisateur" : "utilisateurs"}
          </div>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Nom</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Téléphone</th>
                  <th className="px-4 py-3 text-left font-medium">Rôle</th>
                  <th className="px-4 py-3 text-left font-medium">Statut</th>
                  <th className="px-4 py-3 text-left font-medium">Créé le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Inbox className="h-8 w-8" />
                        <span className="text-sm">Aucun utilisateur trouvé.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((u: any) => {
                    const roles: string[] = Array.isArray(u.roles)
                      ? u.roles.map((r: any) => (typeof r === "string" ? r : r.name))
                      : u.role ? [u.role] : [];
                    const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || "—";
                    const created = u.createdAt || u.created_at;
                    const active = u.isActive ?? u.is_active ?? true;
                    return (
                      <tr key={u.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-foreground">{fullName}</td>
                        <td className="px-4 py-3">{u.email || "—"}</td>
                        <td className="px-4 py-3">{u.phone || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {roles.length === 0 ? "—" : roles.map((r) => (
                              <Badge key={r} variant="outline" className={roleVariant[r] ?? ""}>
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={active ? "default" : "secondary"}>
                            {active ? "Actif" : "Désactivé"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {created ? new Date(created).toLocaleDateString("fr-FR") : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
