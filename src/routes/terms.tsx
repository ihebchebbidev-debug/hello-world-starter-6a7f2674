import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing-shell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of service — EcoBus" },
      { name: "description", content: "EcoBus terms of service governing use of the platform and mobile applications." },
      { property: "og:title", content: "Terms of service — EcoBus" },
      { property: "og:description", content: "Read the EcoBus terms of service." },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

const SECTIONS = [
  ["1. Acceptance", "By accessing or using EcoBus you agree to these Terms. If you are using the service on behalf of a school or organization, you confirm you have authority to bind it."],
  ["2. The service", "EcoBus is a school transport platform providing live GPS tracking, route planning, alerts, parent and driver applications, and an administration console. Features evolve and may change with notice."],
  ["3. Accounts & roles", "Schools provision their own users (admins, drivers, parents). Each user is responsible for the confidentiality of their credentials and for activity under their account."],
  ["4. Acceptable use", "You agree not to misuse the service, disrupt operations, attempt unauthorized access, or use the platform for any unlawful purpose. Driver location data must only be used for legitimate operational purposes."],
  ["5. Data & children", "EcoBus processes data on behalf of schools, including limited information about minors strictly required for transport operations. Schools remain the data controllers; we act as processor under a DPA."],
  ["6. Availability", "We target high availability but do not guarantee uninterrupted service. Maintenance and outages may occur. Mission-critical decisions should not depend on a single signal."],
  ["7. Liability", "To the maximum extent permitted by law, EcoBus is not liable for indirect or consequential damages. Total liability is capped at fees paid for the service in the 12 months preceding the claim."],
  ["8. Termination", "Either party may terminate with notice. Upon termination, access ceases and customer data is exported or deleted per the DPA."],
  ["9. Changes", "We may update these Terms; material changes will be notified in-app or by email."],
  ["10. Contact", "Questions about these Terms: hello@ecobus.app."],
];

function TermsPage() {
  const { t } = useI18n();
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("footer.col.legal")}</span>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{t("terms.title")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("terms.updated")}</p>

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
