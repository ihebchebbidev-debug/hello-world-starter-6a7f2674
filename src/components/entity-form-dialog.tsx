import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "password" | "number" | "select" | "date" | "textarea";
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: { regex: RegExp; message: string };
  defaultValue?: any;
  /** Group fields into sections. Fields with the same `section` render together under the section title. */
  section?: string;
  /** Span 1 (default) or 2 columns. */
  colSpan?: 1 | 2;
};

function validate(field: FieldDef, value: any): string | null {
  const empty = value === "" || value == null;
  if (field.required && empty) return `${field.label} est requis`;
  if (empty) return null;
  if (field.type === "email") {
    if (!/^\S+@\S+\.\S+$/.test(String(value))) return "Adresse e-mail invalide";
  }
  if (field.type === "tel") {
    if (!/^[\d+\-\s().]{6,}$/.test(String(value))) return "Numéro de téléphone invalide";
  }
  if (field.type === "number") {
    const n = Number(value);
    if (Number.isNaN(n)) return "Doit être un nombre";
    if (field.min != null && n < field.min) return `Doit être ≥ ${field.min}`;
    if (field.max != null && n > field.max) return `Doit être ≤ ${field.max}`;
  }
  if (field.minLength != null && String(value).length < field.minLength)
    return `Au moins ${field.minLength} caractères`;
  if (field.maxLength != null && String(value).length > field.maxLength)
    return `Au plus ${field.maxLength} caractères`;
  if (field.pattern && !field.pattern.regex.test(String(value)))
    return field.pattern.message;
  return null;
}

export function EntityFormDialog({
  open, onOpenChange, title, description, fields, initial, submitLabel = "Enregistrer",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef[];
  initial?: Record<string, any>;
  submitLabel?: string;
  onSubmit: (values: Record<string, any>) => Promise<any>;
}) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, any> = {};
    fields.forEach((f) => { init[f.name] = initial?.[f.name] ?? f.defaultValue ?? ""; });
    setValues(init);
    setTouched({});
  }, [open]); // eslint-disable-line

  const errors = useMemo(() => {
    const out: Record<string, string | null> = {};
    fields.forEach((f) => { out[f.name] = validate(f, values[f.name]); });
    return out;
  }, [fields, values]);

  const sections = useMemo(() => {
    const map = new Map<string, FieldDef[]>();
    fields.forEach((f) => {
      const k = f.section || "";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(f);
    });
    return Array.from(map.entries());
  }, [fields]);

  async function handleSave() {
    // Mark all touched and re-validate
    setTouched(Object.fromEntries(fields.map((f) => [f.name, true])));
    const firstError = fields.map((f) => errors[f.name]).find((e) => !!e);
    if (firstError) {
      toast.error(firstError);
      return;
    }
    const payload: Record<string, any> = {};
    fields.forEach((f) => {
      let v = values[f.name];
      if (v === "" || v == null) return;
      if (f.type === "number") v = Number(v);
      payload[f.name] = v;
    });
    setBusy(true);
    try {
      await onSubmit(payload);
      toast.success("Enregistré");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  function renderField(f: FieldDef) {
    const err = touched[f.name] ? errors[f.name] : null;
    const span = f.colSpan === 2 ? "sm:col-span-2" : "sm:col-span-1";
    return (
      <div key={f.name} className={`grid gap-1.5 ${span}`}>
        <Label htmlFor={f.name} className="text-xs font-medium">
          {f.label}{f.required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
        {f.type === "select" ? (
          <Select
            value={String(values[f.name] ?? "")}
            onValueChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
          >
            <SelectTrigger id={f.name} aria-invalid={!!err}>
              <SelectValue placeholder={f.placeholder || "Sélectionner..."} />
            </SelectTrigger>
            <SelectContent>
              {(f.options || []).map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : f.type === "textarea" ? (
          <textarea
            id={f.name}
            placeholder={f.placeholder}
            aria-invalid={!!err}
            className={
              "flex min-h-[80px] w-full rounded-md border bg-card px-3 py-2 text-sm shadow-xs " +
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 " +
              (err ? "border-destructive" : "border-border")
            }
            value={values[f.name] ?? ""}
            onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, [f.name]: true }))}
          />
        ) : (
          <Input
            id={f.name}
            type={f.type === "number" ? "number" : f.type || "text"}
            placeholder={f.placeholder}
            min={f.min} max={f.max}
            aria-invalid={!!err}
            className={err ? "border-destructive focus-visible:ring-destructive/40" : ""}
            value={values[f.name] ?? ""}
            onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, [f.name]: true }))}
          />
        )}
        {err ? (
          <div className="flex items-center gap-1 text-[11px] font-medium text-destructive">
            <AlertCircle className="h-3 w-3" />{err}
          </div>
        ) : f.helpText ? (
          <p className="text-[11px] text-muted-foreground">{f.helpText}</p>
        ) : null}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); if (!busy) handleSave(); }}
          className="space-y-5 py-1"
        >
          {sections.map(([section, fs]) => (
            <div key={section || "_default"} className="space-y-3">
              {section ? (
                <div className="flex items-center gap-3">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {section}
                  </h4>
                  <div className="h-px flex-1 bg-border" />
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {fs.map(renderField)}
              </div>
            </div>
          ))}
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Annuler</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  open, onOpenChange, title, description, onConfirm, confirmLabel = "Supprimer",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: ReactNode;
  onConfirm: () => Promise<void> | void;
  confirmLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Annuler</Button>
          <Button variant="destructive" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await onConfirm(); onOpenChange(false); }
            catch (e: any) { toast.error(e?.message || "Erreur"); }
            finally { setBusy(false); }
          }}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />…</> : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
