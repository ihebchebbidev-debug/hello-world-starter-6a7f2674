import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing-shell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — EcoBus" },
      { name: "description", content: "How EcoBus collects, processes and protects personal data for schools, drivers and parents." },
      { property: "og:title", content: "Privacy policy — EcoBus" },
      { property: "og:description", content: "Read the EcoBus privacy policy." },
      { property: "og:url", content: "/privacy" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

const SECTIONS = [
  ["1. Who we are", "EcoBus is a SaaS platform for school transport. The school is the data controller for its users, drivers and children; EcoBus acts as a processor under a Data Processing Agreement."],
  ["2. Data we process", "Account data (name, email, phone, role), operational data (routes, stops, vehicle assignments, GPS positions during trips), check-in/out events, alerts and SOS events, and device push tokens for notifications."],
  ["3. Children's data", "We process the minimum required: name, school, parent contact, route assignment, and check-in/out timestamps. We never sell data and never use children's data for advertising."],
  ["4. Legal basis", "Performance of the contract with the school, legitimate interest in operating the service safely, and consent for push notifications."],
  ["5. Retention", "Operational data is retained for the duration of the contract plus statutory periods. Raw GPS pings are retained for a limited period and aggregated thereafter."],
  ["6. Security", "Encryption in transit (TLS), encryption at rest, role-based access control, audit logs, periodic backups, and incident response procedures."],
  ["7. Sharing", "We share data with sub-processors strictly as necessary (cloud hosting, push delivery via Firebase Cloud Messaging, SMS OTP). A current list is available on request."],
  ["8. Your rights", "Users may exercise access, rectification, deletion, restriction, portability and objection rights via their school admin or by contacting privacy@ecobus.app."],
  ["9. International transfers", "Where data is transferred outside the EEA, we rely on Standard Contractual Clauses or equivalent safeguards."],
  ["10. Contact", "Privacy questions: privacy@ecobus.app."],
];

function PrivacyPage() {
  const { t } = useI18n();
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("footer.col.legal")}</span>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{t("privacy.title")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("privacy.updated")}</p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map(([h, p]) => (
            <section key={h}>
              <h2 className="text-lg font-semibold tracking-tight">{h}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{p}</p>
            </section>
          ))}
        </div>

        <div className="mt-12">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← {t("legal.back")}</Link>
        </div>
      </article>
    </MarketingShell>
  );
}
