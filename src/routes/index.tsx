import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ComponentType, type FormEvent } from "react";
import {
  ArrowRight, MapPin, ShieldCheck, Bell, Smartphone, BarChart3, Route as RouteIcon,
  Users, Star, CheckCircle2, Apple, PlayCircle, Mail, Phone, MapPin as Pin,
  ChevronLeft, ChevronRight, ChevronDown, Facebook, Instagram, Linkedin, Bus, GraduationCap, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";
import { useReveal } from "@/hooks/useReveal";
import heroBus from "@/assets/landing-hero-bus.jpg";
import heroBg from "@/assets/landing-hero-bg.jpg";
import heroBgMobile from "@/assets/landing-hero-bg-mobile.jpg";
import busFleet from "@/assets/landing-bus-fleet.jpg";
import featRealtime from "@/assets/feature-realtime.jpg";
import featRoutes from "@/assets/feature-routes.jpg";
import featAlerts from "@/assets/feature-alerts.jpg";
import featSafety from "@/assets/feature-safety.jpg";
import featAnalytics from "@/assets/feature-analytics.jpg";
import featRoles from "@/assets/feature-roles.jpg";
import appParent from "@/assets/landing-app-parent.jpg";
import appDriver from "@/assets/landing-app-driver.jpg";
import appAdmin from "@/assets/landing-app-admin.jpg";
import forParents from "@/assets/landing-for-parents.jpg";
import forSchools from "@/assets/landing-for-schools.jpg";
import forDrivers from "@/assets/landing-for-drivers.jpg";
import testimonial1 from "@/assets/landing-testimonial-1.jpg";
import logoMark from "@/assets/ecobus-mark.png";
import statBus from "@/assets/stat-bus.png";
import statSchool from "@/assets/stat-school.png";
import statStudents from "@/assets/stat-students.png";
import statOntime from "@/assets/stat-ontime.png";

import roleParents from "@/assets/role-parents.png";
import roleSchools from "@/assets/role-schools.png";
import roleDrivers from "@/assets/role-drivers.png";
import badgeGooglePlay from "@/assets/badge-google-play.png";
import badgeAppStore from "@/assets/badge-app-store.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EcoBus — Smart school bus tracking for parents, schools & drivers" },
      { name: "description", content: "EcoBus is the all-in-one school transportation platform: live GPS bus tracking, instant pickup & drop-off alerts, safe routes, and dedicated apps for parents, schools and drivers." },
      { name: "keywords", content: "school bus tracking, GPS bus app, parent bus alerts, school transportation software, fleet management for schools, real-time bus tracker, EcoBus" },
      { name: "author", content: "EcoBus" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { property: "og:title", content: "EcoBus — Track the school bus in real time" },
      { property: "og:description", content: "Live GPS tracking, instant alerts and safe transportation for every child. One platform, three apps." },
      { property: "og:url", content: "/" },
      { property: "og:image", content: "/og-cover.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "EcoBus — Smart school bus tracking" },
      { name: "twitter:title", content: "EcoBus — Track the school bus in real time" },
      { name: "twitter:description", content: "Live GPS tracking, instant alerts and safe transportation for every child." },
      { name: "twitter:image", content: "/og-cover.jpg" },
    ],
    links: [
      { rel: "canonical", href: "/" },
      { rel: "preload", as: "image", href: heroBgMobile, fetchPriority: "high", media: "(max-width: 639px)" },
      { rel: "preload", as: "image", href: heroBg, fetchPriority: "high", media: "(min-width: 640px)" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "EcoBus",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          description:
            "Real-time school-bus tracking platform with parent, driver and admin apps.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
          aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", ratingCount: "1240" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "How does EcoBus track school buses in real time?",
              acceptedAnswer: { "@type": "Answer", text: "EcoBus uses GPS-enabled driver apps and on-board devices to stream the bus location every few seconds to parents and school admins." } },
            { "@type": "Question", name: "Is EcoBus free for parents?",
              acceptedAnswer: { "@type": "Answer", text: "Yes — the parent app is free. Schools and operators subscribe to manage fleets, routes and reporting." } },
            { "@type": "Question", name: "Which apps does EcoBus include?",
              acceptedAnswer: { "@type": "Answer", text: "Three apps: Parent (track & alerts), Driver (route & check-ins) and Admin (fleet, routes and analytics)." } },
            { "@type": "Question", name: "Does EcoBus work on iOS and Android?",
              acceptedAnswer: { "@type": "Answer", text: "Yes, EcoBus is available on the web, iOS and Android." } },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "EcoBus",
          url: "/",
          potentialAction: { "@type": "SearchAction", target: "/?q={query}", "query-input": "required name=query" },
        }),
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <SiteHeader />
      <Hero />
      <SmartTransport />
      <StatsBar />
      <ForEveryone />
      <EverythingYouNeed />
      <Testimonials />
      <Subscribe />
      <Footer />
    </div>
  );
}

/* ───────── HEADER ───────── */
function SiteHeader() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const links: Array<{ href?: string; to?: string; label: string; chevron?: boolean }> = [
    { href: "#home",     label: t("nav.home")     },
    { href: "#smart",    label: t("nav.about") ?? "About" },
    { href: "#features", label: t("nav.pro")      },
    { href: "#testimonials", label: t("nav.clients")  },
    { to:   "/contact",  label: t("nav.contact")  },
  ];
  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logoMark} alt="EcoBus" width={36} height={36} className="h-9 w-9 object-contain" />
          <span className="text-[18px] font-semibold tracking-tight text-white">EcoBus</span>
        </Link>
        <nav className="hidden items-center gap-7 text-[13.5px] font-medium text-white/80 lg:flex">
          {links.map((l) =>
            l.to ? (
              <Link key={l.label} to={l.to} className="transition hover:text-white">{l.label}</Link>
            ) : (
              <a key={l.label} href={l.href} className="inline-flex items-center gap-1 transition hover:text-white">
                {l.label}
                {l.chevron && <ChevronDown className="h-3.5 w-3.5 opacity-70" />}
              </a>
            )
          )}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block"><LanguageSwitcher /></div>
          <Link to="/login" className="hidden sm:block">
            <Button variant="outline" className="h-10 rounded-full border-white/30 bg-transparent px-5 text-white hover:bg-white/10">
              {t("nav.signinShort") || t("nav.signin")}
            </Button>
          </Link>
          <button
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white"
            onClick={() => setOpen((v) => !v)}
            aria-label="menu"
          >
            <span className="space-y-1">
              <span className="block h-0.5 w-5 bg-white" />
              <span className="block h-0.5 w-5 bg-white" />
              <span className="block h-0.5 w-5 bg-white" />
            </span>
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden mx-5 mt-2 rounded-2xl border border-white/15 bg-secondary/95 p-4 text-secondary-foreground backdrop-blur">
          <div className="flex flex-col gap-2 text-sm">
            {links.map((l) =>
              l.to ? (
                <Link key={l.label} to={l.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-white/5">{l.label}</Link>
              ) : (
                <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-white/5">{l.label}</a>
              )
            )}
            <Link to="/login" onClick={() => setOpen(false)}>
              <Button className="mt-1 h-10 w-full rounded-full bg-primary text-primary-foreground">{t("nav.signin")}</Button>
            </Link>
            <div className="pt-2"><LanguageSwitcher /></div>
          </div>
        </div>
      )}
    </header>
  );
}

/* ───────── HERO ───────── */
function Hero() {
  const { t } = useI18n();
  return (
    <section id="home" className="relative isolate overflow-hidden bg-secondary text-secondary-foreground">
      {/* Full-bleed background image */}
      <div aria-hidden className="absolute inset-0 -z-10">
        {/* Mobile: portrait composition with the bus on the right, sky on the left */}
        <img
          src={heroBgMobile}
          alt=""
          width={832}
          height={1216}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover [object-position:right_center] sm:hidden"
        />
        {/* Tablet & desktop */}
        <img
          src={heroBg}
          alt=""
          width={1920}
          height={1080}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 hidden h-full w-full object-cover [object-position:right_70%] sm:block"
        />
        {/* Darkening for text legibility — stronger vertical fade on mobile, side fade on desktop */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,oklch(0.16_0.03_258/0.85)_0%,oklch(0.16_0.03_258/0.55)_45%,oklch(0.16_0.03_258/0.85)_100%)] sm:bg-[linear-gradient(90deg,oklch(0.16_0.03_258)_0%,oklch(0.16_0.03_258/0.92)_30%,oklch(0.16_0.03_258/0.55)_55%,transparent_80%)]" />
        {/* Top fade under header */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-secondary/80 to-transparent" />
        {/* Bottom fade into next section */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-secondary to-transparent" />
        {/* Soft teal glow accent */}
        <div
          className="orb-drift absolute -left-24 top-40 h-[420px] w-[420px] rounded-full"
          style={{ background: "radial-gradient(closest-side, oklch(0.74 0.095 195 / 0.18), transparent 70%)" }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-5 pt-20 pb-8 text-left sm:px-8 sm:pt-24 sm:pb-10 lg:pt-28 lg:pb-12">
        <h1
          className="max-w-3xl text-[32px] leading-[1.08] font-semibold tracking-tight text-white sm:text-[46px] lg:text-[56px]"
        >
          <span className="block">{t("hero.titleA") || "Track the School Bus."}</span>
          <span className="block">
            <span className="bg-gradient-to-r from-primary via-[oklch(0.82_0.13_180)] to-primary bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_6s_linear_infinite]">
              {t("hero.titleC")}
            </span>{" "}
            {t("hero.titleD")}
          </span>
        </h1>

        <p
          className="mt-3 max-w-2xl text-[14px] leading-[1.6] text-white/75 sm:mt-4 sm:text-[15.5px]"
        >
          {t("hero.subtitle2")}
        </p>

        {/* CTA group */}
        <div
          className="mt-6 flex flex-col gap-3 sm:mt-7"
        >
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
              <StoreBadge href="#" src={badgeAppStore} alt="Download on the App Store" size="lg" eager />
              <StoreBadge href="#" src={badgeGooglePlay} alt="Get it on Google Play" size="lg" eager />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-white/55 sm:text-[12px]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Encrypted end-to-end
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-primary" />
              Real-time alerts
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Live GPS tracking
            </span>
          </div>
        </div>
      </div>


    </section>
  );
}

function HeroPill({ icon: Icon, title, desc, delay }: { icon: ComponentType<{ className?: string }>; title: string; desc: string; delay: 1|2|3|4 }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal reveal-delay-${delay} flex flex-col items-center text-center px-1 sm:px-2`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 text-primary">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="mt-3 text-[13px] font-semibold tracking-tight text-white sm:text-[13.5px]">{title}</div>
      <div className="mt-1 max-w-[160px] text-[11.5px] leading-relaxed text-white/55 sm:max-w-[180px]">{desc}</div>
    </div>
  );
}

function StoreBadge({
  href,
  src,
  alt,
  size = "md",
  eager = false,
}: {
  href: string;
  src: string;
  alt: string;
  size?: "md" | "lg";
  eager?: boolean;
}) {
  const sizeClass =
    size === "lg" ? "h-16 sm:h-20 md:h-24 lg:h-28" : "h-11 sm:h-12";
  return (
    <a
      href={href}
      aria-label={alt}
      className="group inline-flex items-center shrink-0 transition-transform duration-200 hover:-translate-y-0.5 hover:drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-xl"
    >
      <img
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        width={540}
        height={160}
        className={`${sizeClass} w-auto block object-contain select-none`}
        draggable={false}
      />
    </a>
  );
}

/* ───────── SMART TRANSPORT (admin dashboard + phone) ───────── */
function SmartTransport() {
  const { t } = useI18n();
  return (
    <section id="smart" className="relative bg-background py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.15fr]">
        <div ref={useReveal<HTMLDivElement>()} className="reveal">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("smart.kicker")}</span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.1]">
            <span className="block">{t("smart.titleA")}</span>
            <span className="block">{t("smart.titleB")}</span>
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-[1.7] text-muted-foreground">{t("smart.body")}</p>
          <Link to="/login" className="mt-8 inline-block">
            <Button className="h-11 rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90">
              {t("smart.cta")} <ArrowRight className="rtl-flip ms-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Right: Admin dashboard with phone overlay */}
        <div ref={useReveal<HTMLDivElement>()} className="reveal reveal-delay-2 relative mx-auto w-full max-w-[640px]">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
            {/* Faux browser title bar */}
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-success" />
            </div>
            <img
              src={appAdmin}
              alt="EcoBus admin console — dashboard with live tracking"
              width={1600}
              height={1024}
              loading="lazy" decoding="async"
              className="block h-full w-full"
            />
          </div>
          <div className="float-y-soft absolute -bottom-8 -right-2 hidden w-[170px] sm:block lg:w-[200px]">
            <PhoneFrame src={appParent} alt="EcoBus parent app — today's trip" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── EVERYTHING YOU NEED — 6 FEATURES (image-led editorial grid) ───────── */
function EverythingYouNeed() {
  const { t } = useI18n();
  const items: Array<{
    icon: ComponentType<{ className?: string }>;
    title: string;
    desc: string;
    image: string;
    eyebrow: string;
  }> = [
    { icon: MapPin,      title: t("ev1.t"), desc: t("ev1.d"), image: featRealtime,  eyebrow: "01 — Live" },
    { icon: RouteIcon,   title: t("ev2.t"), desc: t("ev2.d"), image: featRoutes,    eyebrow: "02 — Plan" },
    { icon: Bell,        title: t("ev3.t"), desc: t("ev3.d"), image: featAlerts,    eyebrow: "03 — Alert" },
    { icon: ShieldCheck, title: t("ev4.t"), desc: t("ev4.d"), image: featSafety,    eyebrow: "04 — Safe" },
    { icon: BarChart3,   title: t("ev5.t"), desc: t("ev5.d"), image: featAnalytics, eyebrow: "05 — Insight" },
    { icon: Users,       title: t("ev6.t"), desc: t("ev6.d"), image: featRoles,     eyebrow: "06 — Roles" },
  ];
  return (
    <section id="features" className="relative overflow-hidden bg-secondary py-24 text-secondary-foreground sm:py-32">
      <div className="pattern-dots absolute inset-0 opacity-20" aria-hidden />
      {/* Soft brand glow */}
      <div
        aria-hidden
        className="absolute left-1/2 top-0 -z-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, oklch(0.74 0.095 195 / 0.12), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {items.map((it, i) => (
            <FeatureCard key={it.title} {...it} delay={(i % 4) + 1 as 1|2|3|4} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon, title, desc, image, eyebrow, delay,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string; desc: string; image: string; eyebrow: string;
  delay: 1|2|3|4;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <article
      ref={ref}
      className={`reveal reveal-delay-${delay} group relative flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-sm transition duration-500 hover:border-primary/30 hover:bg-white/[0.05]`}
    >
      <div className="relative aspect-[5/4] overflow-hidden">
        <img
          src={image}
          alt={title}
          width={1024}
          height={1024}
          loading="lazy" decoding="async"
          className="h-full w-full object-cover transition duration-[900ms] ease-out group-hover:scale-[1.04]"
        />
        {/* Bottom gradient for legibility */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-secondary/95 via-secondary/40 to-transparent" />
        {/* Eyebrow chip */}
        <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 backdrop-blur-md">
          <span className="h-1 w-1 rounded-full bg-primary" />
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/85">{eyebrow}</span>
        </div>
        {/* Floating icon medallion */}
        <div className="absolute bottom-4 left-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-secondary/85 text-primary shadow-elevated backdrop-blur">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <h3 className="text-[17px] font-semibold tracking-tight text-white">{title}</h3>
        <p className="mt-2.5 text-[13.5px] leading-[1.65] text-white/60">{desc}</p>
      </div>

      {/* Hover hairline accent */}
      <span className="pointer-events-none absolute inset-x-6 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-primary/0 via-primary/70 to-primary/0 transition-transform duration-500 group-hover:scale-x-100" />
    </article>
  );
}

/* ───────── HOW IT WORKS — 4 STEPS ───────── */
function HowItWorks() {
  const { t } = useI18n();
  const steps: Array<{ icon: ComponentType<{ className?: string }>; t: string; d: string }> = [
    { icon: Bus,         t: t("howit.s1.t"), d: t("howit.s1.d") },
    { icon: MapPin,      t: t("howit.s2.t"), d: t("howit.s2.d") },
    { icon: Bell,        t: t("howit.s3.t"), d: t("howit.s3.d") },
    { icon: ShieldCheck, t: t("howit.s4.t"), d: t("howit.s4.d") },
  ];
  return (
    <section id="how" className="relative bg-background py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-center" ref={useReveal<HTMLDivElement>()}>
          <span className="reveal text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("howit.kicker")}</span>
        </div>

        <div className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Connector line (lg+) */}
          <div aria-hidden className="pointer-events-none absolute left-[12%] right-[12%] top-[34px] hidden h-px border-t-2 border-dashed border-primary/30 lg:block" />
          {steps.map((s, i) => (
            <Step key={s.t} index={i + 1} icon={s.icon} title={s.t} desc={s.d} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Step({ index, icon: Icon, title, desc }: { index: number; icon: ComponentType<{ className?: string }>; title: string; desc: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal reveal-delay-${(index % 4) + 1 as 1|2|3|4} relative flex flex-col items-center text-center`}>
      <div className="relative">
        <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-2 border-primary/30 bg-card text-primary shadow-sm">
          <Icon className="h-7 w-7" />
        </span>
        <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground tabular-nums shadow-md">
          {index}
        </span>
      </div>
      <h3 className="mt-5 text-[16px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-[220px] text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

/* ───────── STATS BAR (5 items) ───────── */
function StatsBar() {
  const { t } = useI18n();
  const items = [
    { img: statBus,      v: "48+",    l: t("stats2.activeBuses") },
    { img: statSchool,   v: "12+",    l: t("stats2.schools")     },
    { img: statStudents, v: "1,500+", l: t("stats2.students")    },
    { img: statOntime,   v: "98%",    l: t("stats2.ontime")      },
  ];
  return (
    <section className="relative overflow-hidden bg-secondary py-16 text-secondary-foreground sm:py-20">
      {/* Soft brand glow, no photo overlay */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -z-0 h-[520px] w-[920px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, oklch(0.74 0.095 195 / 0.16), transparent 70%)" }}
      />
      <div className="pattern-dots absolute inset-0 -z-0 opacity-15" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        {items.map((s, i) => (
          <StatCell key={s.l} img={s.img} value={s.v} label={s.l} index={i} />
        ))}
      </div>
    </section>
  );
}

function StatCell({ img, value, label, index }: { img: string; value: string; label: string; index: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal reveal-delay-${(index % 4) + 1 as 1|2|3|4} flex flex-col items-center text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left`}>
      <div className="relative shrink-0">
        <span
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full blur-xl"
          style={{ background: "radial-gradient(closest-side, oklch(0.74 0.095 195 / 0.35), transparent 70%)" }}
        />
        <img
          src={img}
          alt=""
          width={96}
          height={96}
          loading="lazy" decoding="async"
          className="h-16 w-16 object-contain drop-shadow-[0_8px_18px_rgba(45,212,191,0.25)] sm:h-[72px] sm:w-[72px]"
        />
      </div>
      <div className="mt-3 min-w-0 sm:mt-0">
        <div className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-white sm:text-[30px]">{value}</div>
        <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.2em] text-white/55">{label}</div>
      </div>
    </div>
  );
}

/* ───────── FOR PARENTS / SCHOOLS / DRIVERS ───────── */
function ForEveryone() {
  const { t } = useI18n();
  const cards = [
    {
      img: roleParents,
      eyebrow: "01 — Parents",
      title: t("for.parents.t"),
      bullets: [t("for.parents.b1"), t("for.parents.b2"), t("for.parents.b3"), t("for.parents.b4")],
    },
    {
      img: roleSchools,
      eyebrow: "02 — Écoles",
      title: t("for.schools.t"),
      bullets: [t("for.schools.b1"), t("for.schools.b2"), t("for.schools.b3"), t("for.schools.b4")],
    },
    {
      img: roleDrivers,
      eyebrow: "03 — Chauffeurs",
      title: t("for.drivers.t"),
      bullets: [t("for.drivers.b1"), t("for.drivers.b2"), t("for.drivers.b3"), t("for.drivers.b4")],
    },
  ];
  return (
    <section id="benefits" className="relative overflow-hidden bg-background py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[480px] w-[920px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, oklch(0.74 0.095 195 / 0.10), transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
          {cards.map((c, i) => (
            <RoleCard key={c.title} {...c} delay={(i % 4) + 1 as 1|2|3|4} learn={t("for.learn")} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RoleCard({
  img, eyebrow, title, bullets, delay, learn,
}: {
  img: string; eyebrow: string; title: string; bullets: string[]; delay: 1|2|3|4; learn: string;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <article
      ref={ref}
      className={`reveal reveal-delay-${delay} group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated sm:p-7`}
    >
      {/* hover hairline */}
      <span aria-hidden className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition group-hover:opacity-100" />

      {/* illustration */}
      <div className="relative flex h-32 items-end justify-center">
        <span
          aria-hidden
          className="absolute inset-x-6 bottom-2 h-20 rounded-full blur-2xl"
          style={{ background: "radial-gradient(closest-side, oklch(0.74 0.095 195 / 0.28), transparent 70%)" }}
        />
        <img
          src={img}
          alt=""
          width={256}
          height={256}
          loading="lazy" decoding="async"
          className="relative h-32 w-32 object-contain transition duration-500 group-hover:-translate-y-1 group-hover:scale-[1.04]"
        />
      </div>

      <div className="mt-5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-primary">{eyebrow}</div>
        <h3 className="mt-2 text-[18px] font-semibold tracking-tight text-foreground">{title}</h3>
      </div>

      <ul className="mt-4 space-y-2.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-[13px] leading-snug text-foreground/75">
            <span className="mt-1 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-primary-soft text-primary">
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            {b}
          </li>
        ))}
      </ul>

      <Link
        to="/login"
        className="mt-6 inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-primary transition hover:gap-2.5"
      >
        {learn} <ArrowRight className="rtl-flip h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

/* ───────── TESTIMONIALS ───────── */
function Testimonials() {
  const { t } = useI18n();
  const items = [
    { name: "Sara Ahmed", role: t("testimonial.role"),  body: t("testimonial.body1"), avatar: testimonial1 },
    { name: "Sami K.",    role: t("testimonial.role2"), body: t("testimonial.body2"), avatar: testimonial1 },
    { name: "Lina B.",    role: t("testimonial.role"),  body: t("testimonial.body3"), avatar: testimonial1 },
  ];
  const [i, setI] = useState(0);
  const item = items[i];
  return (
    <section id="clients" className="bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">{t("section.what")}</h2>

        <div ref={useReveal<HTMLDivElement>()} className="reveal mt-10 rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <img src={item.avatar} alt={item.name} width={80} height={80} loading="lazy" decoding="async"
              className="h-16 w-16 flex-none rounded-full object-cover ring-2 ring-primary-soft" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-warning">
                {Array.from({ length: 5 }).map((_, k) => (<Star key={k} className="h-4 w-4 fill-current" />))}
              </div>
              <p className="mt-2 text-[14.5px] leading-relaxed text-foreground/85">"{item.body}"</p>
              <div className="mt-3 text-[13px] font-semibold">{item.name}</div>
              <div className="text-[12px] text-muted-foreground">{item.role}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button onClick={() => setI((v) => (v - 1 + items.length) % items.length)} aria-label="prev"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-primary">
            <ChevronLeft className="rtl-flip h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            {items.map((_, k) => (
              <button key={k} onClick={() => setI(k)} aria-label={`slide ${k + 1}`}
                className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-primary" : "w-2.5 bg-border"}`} />
            ))}
          </div>
          <button onClick={() => setI((v) => (v + 1) % items.length)} aria-label="next"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-primary">
            <ChevronRight className="rtl-flip h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ───────── SUBSCRIBE ───────── */
function Subscribe() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim().slice(0, 100);
    const trimmedEmail = email.trim().toLowerCase().slice(0, 254);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail);
    if (!emailOk) {
      setStatus("err");
      setError(t("subscribe.error") || "Please enter a valid email address.");
      return;
    }
    setStatus("loading");
    // Simulated success — wire to backend later.
    await new Promise((r) => setTimeout(r, 500));
    setStatus("ok");
    setName("");
    setEmail("");
  };

  return (
    <section id="newsletter" className="relative bg-background pb-20 sm:pb-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-[28px] bg-secondary text-secondary-foreground shadow-elevated ring-1 ring-white/10">
          {/* Decorative accents */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full"
              style={{ background: "radial-gradient(closest-side, oklch(0.74 0.095 195 / 0.35), transparent 70%)" }} />
            <div className="absolute -right-24 bottom-[-60px] h-80 w-80 rounded-full"
              style={{ background: "radial-gradient(closest-side, oklch(0.62 0.13 200 / 0.30), transparent 70%)" }} />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>

          <div className="relative grid items-center gap-10 p-8 sm:p-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            {/* Left — copy & socials */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                <Mail className="h-3.5 w-3.5" /> {t("subscribe.kicker") || "Newsletter"}
              </span>
              <h3 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("subscribe.title")}
              </h3>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
                {t("subscribe.body")}
              </p>

              <ul className="mt-6 space-y-2.5 text-[13px] text-white/75">
                {[
                  t("subscribe.perk1") || "Product updates & new features",
                  t("subscribe.perk2") || "Safety tips for school transport",
                  t("subscribe.perk3") || "No spam — unsubscribe in one click",
                ].map((perk) => (
                  <li key={perk} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" /> {perk}
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex items-center gap-3 text-white/85">
                <SocialIcon Icon={Facebook} label="Facebook" />
                <SocialIcon Icon={Linkedin} label="LinkedIn" />
                <SocialIcon Icon={Instagram} label="Instagram" />
              </div>
            </div>

            {/* Right — form card */}
            <form
              onSubmit={submit}
              className="relative rounded-2xl bg-card/95 p-6 text-foreground shadow-elevated ring-1 ring-black/5 sm:p-7"
              noValidate
            >
              <label htmlFor="nl-name" className="block text-[12px] font-medium text-muted-foreground">
                {t("subscribe.name")}
              </label>
              <input
                id="nl-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                autoComplete="name"
                placeholder={t("subscribe.name")}
                className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />

              <label htmlFor="nl-email" className="mt-4 block text-[12px] font-medium text-muted-foreground">
                {t("subscribe.email")}
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="nl-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <Button
                type="submit"
                disabled={status === "loading"}
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {status === "loading" ? (t("subscribe.sending") || "Subscribing…") : t("subscribe.cta")}
                <ArrowRight className="rtl-flip h-4 w-4" />
              </Button>

              <div aria-live="polite" className="mt-3 min-h-[18px] text-[12px]">
                {status === "ok" && (
                  <span className="inline-flex items-center gap-1.5 text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("subscribe.success") || "Thanks! Please check your inbox to confirm."}
                  </span>
                )}
                {status === "err" && error && <span className="text-destructive">{error}</span>}
                {status !== "ok" && status !== "err" && (
                  <span className="text-muted-foreground">
                    {t("subscribe.privacy") || "We respect your privacy. No spam, ever."}
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function SocialIcon({ Icon, label }: { Icon: ComponentType<{ className?: string }>; label: string }) {
  return (
    <a
      href="#"
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-white/20 hover:text-primary"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

/* ───────── FOOTER ───────── */
function Footer() {
  const { t } = useI18n();
  return (
    <footer className="relative overflow-hidden bg-secondary text-secondary-foreground">
      {/* Decorative top divider with glow */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[60%] -translate-x-1/2 rounded-full opacity-40"
        style={{ background: "radial-gradient(closest-side, oklch(0.74 0.095 195 / 0.18), transparent 70%)" }} />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.1fr]">
        <div>
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoMark} alt="EcoBus" width={36} height={36} loading="lazy" decoding="async" className="h-9 w-9 object-contain" />
            <span className="text-[18px] font-semibold tracking-tight">EcoBus</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">{t("footer.tagline")}.</p>

          <ul className="mt-5 space-y-2 text-[13px] text-white/70">
            <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> {t("footer.trust1") || "GDPR-ready & encrypted"}</li>
            <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 text-primary" /> {t("footer.trust2") || "Trusted by 200+ schools"}</li>
          </ul>

          <div className="mt-6"><LanguageSwitcher /></div>
        </div>

        <FooterCol title={t("footer.col.nav")} links={[
          { href: "#home",     label: t("nav.home")     },
          { href: "#smart",    label: t("nav.benefits") },
          { href: "#features", label: t("nav.pro")      },
          { href: "#clients",  label: t("nav.clients")  },
        ]} />

        <FooterCol title={t("footer.col.quick")} links={[
          { href: "#features",   label: t("nav.pro")      },
          { href: "#newsletter", label: t("subscribe.cta") },
          { to:   "/privacy",    label: t("footer.link.privacy") },
          { to:   "/terms",      label: t("footer.link.terms")   },
        ]} />

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{t("footer.col.contact")}</div>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            <li>
              <a href="mailto:info@ecobus.com" className="group flex items-center gap-2 transition hover:text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10 group-hover:bg-primary/20"><Mail className="h-3.5 w-3.5 text-primary" /></span>
                info@ecobus.com
              </a>
            </li>
            <li>
              <a href="tel:+21670000000" className="group flex items-center gap-2 transition hover:text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10 group-hover:bg-primary/20"><Phone className="h-3.5 w-3.5 text-primary" /></span>
                +216 70 000 000
              </a>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10"><Pin className="h-3.5 w-3.5 text-primary" /></span>
              Tunis, Tunisia
            </li>
          </ul>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{t("footer.col.download")}</div>
          <div className="mt-4 flex flex-col gap-2.5">
            <StoreBadge href="#" src={badgeGooglePlay} alt="Get it on Google Play" />
            <StoreBadge href="#" src={badgeAppStore} alt="Download on the App Store" />
          </div>
          <div className="mt-5 flex items-center gap-2.5 text-white/85">
            <SocialIcon Icon={Facebook} label="Facebook" />
            <SocialIcon Icon={Linkedin} label="LinkedIn" />
            <SocialIcon Icon={Instagram} label="Instagram" />
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-white/55 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_oklch(0.74_0.095_195)]" />
            © {new Date().getFullYear()} EcoBus. {t("footer.rights")}
          </div>
          <div className="flex items-center gap-5">
            <Link to="/terms" className="transition hover:text-white">{t("footer.link.terms")}</Link>
            <Link to="/privacy" className="transition hover:text-white">{t("footer.link.privacy")}</Link>
            <Link to="/contact" className="transition hover:text-white">{t("footer.link.contact")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<{ href?: string; to?: string; label: string }> }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{title}</div>
      <ul className="mt-4 space-y-2.5 text-sm text-white/65">
        {links.map((l) => (
          <li key={l.label}>
            {l.to ? (
              <Link to={l.to} className="transition hover:text-white">{l.label}</Link>
            ) : (
              <a href={l.href} className="transition hover:text-white">{l.label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Used currently only for completeness — driver app screenshot can also be embedded in EcoBus Pro variant */
export function _DriverPreview() {
  return <PhoneFrame src={appDriver} alt="EcoBus driver app — boarding screen" />;
}

/* ───────── PHONE FRAME ───────── */
function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-auto aspect-[10/20] w-full rounded-[40px] border border-white/15 bg-secondary p-1.5 shadow-elevated">
      <div className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-b-2xl bg-secondary" aria-hidden />
      <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-card">
        <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </div>
    </div>
  );
}
