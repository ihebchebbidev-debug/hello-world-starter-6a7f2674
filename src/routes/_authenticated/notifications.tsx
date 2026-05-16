import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { NotificationsAPI, type NotificationBroadcastInput } from "@/lib/api";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({ component: NotificationsPage });

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgo = (d: number) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };

const typeVariant = (t?: string) =>
  t === "alert" || t === "sos" ? "destructive" : t === "warning" ? "default" : "secondary";

type Audience = "all_org" | "parents" | "drivers" | "managers";

function BroadcastDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NonNullable<NotificationBroadcastInput["type"]>>("info");
  const [audience, setAudience] = useState<Audience>("all_org");

  const m = useMutation({
    mutationFn: () => {
      const target: NotificationBroadcastInput["target"] =
        audience === "all_org" ? {} :
        audience === "parents" ? { roles: ["parent"] } :
        audience === "drivers" ? { roles: ["driver"] } :
        { roles: ["admin", "school_manager"] };
      return NotificationsAPI.broadcast({ title, message, type, target });
    },
    onSuccess: (r) => {
      toast.success(`Notification envoyée à ${r.recipients} utilisateur(s) — push: ${r.push.sent}/${r.push.devices}`);
      qc.invalidateQueries({ queryKey: ["notifications"] });
      setOpen(false);
      setTitle(""); setMessage(""); setType("info"); setAudience("all_org");
    },
    onError: (e: any) => toast.error(e?.message || "Échec de l'envoi"),
  });

  const canSend = title.trim().length > 0 && message.trim().length > 0 && !m.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Send className="mr-2 h-4 w-4" />Envoyer une notification</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Diffuser une notification</DialogTitle>
          <DialogDescription>Envoyée en temps réel et par push (FCM) aux destinataires choisis.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Audience</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_org">Toute l'organisation</SelectItem>
                <SelectItem value="parents">Parents</SelectItem>
                <SelectItem value="drivers">Chauffeurs</SelectItem>
                <SelectItem value="managers">Admins / responsables</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Succès</SelectItem>
                <SelectItem value="warning">Avertissement</SelectItem>
                <SelectItem value="alert">Alerte</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="n-title">Titre</Label>
            <Input id="n-title" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Retard du bus 12" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="n-msg">Message</Label>
            <Textarea id="n-msg" maxLength={2000} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Détails de la notification…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={m.isPending}>Annuler</Button>
          <Button onClick={() => m.mutate()} disabled={!canSend}>
            {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotificationsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Communication"
        title="Notifications"
        description="Historique des notifications envoyées aux parents et chauffeurs."
        actions={<BroadcastDialog />}
      />
      <DataList
        queryKey={["notifications"]}
        queryFn={() => NotificationsAPI.list()}
        searchKeys={["title", "body", "message", "type", "userEmail"]}
        searchPlaceholder="Rechercher titre, contenu, destinataire…"
        filters={[
          {
            key: "when",
            label: "Période",
            defaultValue: "7d",
            options: [
              { label: "Aujourd'hui", value: "today", predicate: (r: any) => (r.createdAt || r.created_at || "").startsWith(todayISO()) },
              { label: "7 jours", value: "7d", predicate: (r: any) => (r.createdAt || r.created_at || "").slice(0, 10) >= daysAgo(7) },
              { label: "30 jours", value: "30d", predicate: (r: any) => (r.createdAt || r.created_at || "").slice(0, 10) >= daysAgo(30) },
            ],
          },
        ]}
        emptyHint="Aucune notification envoyée."
        columns={[
          { key: "type", header: "Type", cell: (r) => <Badge variant={typeVariant(r.type)}>{r.type || "info"}</Badge> },
          { key: "title", header: "Titre", cell: (r) => <span className="font-medium text-foreground">{r.title || "—"}</span> },
          { key: "body", header: "Contenu", cell: (r) => <span className="line-clamp-1 text-muted-foreground">{r.body || r.message || "—"}</span> },
          { key: "to", header: "Destinataire", cell: (r) => r.userEmail || r.user_email || r.userId || <span className="text-muted-foreground">tous</span> },
          { key: "time", header: "Envoyé", cell: (r) => <span className="tabular-nums">{(r.createdAt || r.created_at)?.slice?.(0, 16)?.replace("T", " ") || "—"}</span> },
        ]}
      />
    </div>
  );
}
