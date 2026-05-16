import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingShell } from "@/components/marketing-shell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — EcoBus" },
      { name: "description", content: "Talk to the EcoBus team about your school transport project." },
      { property: "og:title", content: "Contact — EcoBus" },
      { property: "og:description", content: "Reach the EcoBus team for demos, pilots and multi-school rollouts." },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);

  return (
    <MarketingShell>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("footer.link.contact")}</span>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{t("contact.title")}</h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">{t("contact.subtitle")}</p>

          <ul className="mt-10 space-y-5 text-sm">
            <ContactRow icon={Mail} label={t("contact.email.label")} value="hello@ecobus.app" />
            <ContactRow icon={Phone} label={t("contact.phone.label")} value="+216 70 000 000" />
            <ContactRow icon={MapPin} label={t("contact.address.label")} value="Tunis · Casablanca · Paris" />
          </ul>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); setSent(true); }}
          className="rounded-2xl border border-border/70 bg-card p-7 shadow-sm sm:p-9"
        >
          <div className="grid gap-5">
            <Field label={t("contact.name")}><input required className="form-field" /></Field>
            <Field label={t("contact.email")}><input required type="email" className="form-field" /></Field>
            <Field label={t("contact.org")}><input className="form-field" /></Field>
            <Field label={t("contact.message")}>
              <textarea required rows={5} className="form-field resize-none" />
            </Field>
            <Button type="submit" size="lg" className="h-12 bg-gradient-brand text-primary-foreground hover:opacity-95">
              {t("contact.send")}<ArrowRight className="rtl-flip ms-1.5 h-4 w-4" />
            </Button>
            {sent && <div className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">{t("contact.sent")}</div>}
          </div>
        </form>
      </section>

      <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← {t("legal.back")}</Link>
      </div>

      <style>{`.form-field { display:block; width:100%; border-radius:0.6rem; border:1px solid var(--color-border); background: var(--color-background); padding:0.65rem 0.85rem; font-size: 14px; outline:none; transition: border-color .15s, box-shadow .15s; } .form-field:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-ring); }`}</style>
    </MarketingShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-foreground/70">{label}</span>
      {children}
    </label>
  );
}

function ContactRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-foreground/90">{value}</div>
      </div>
    </li>
  );
}
