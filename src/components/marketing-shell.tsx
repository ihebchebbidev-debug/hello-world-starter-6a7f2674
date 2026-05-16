import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import logoMark from "@/assets/ecobus-mark.png";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";
import type { ReactNode } from "react";

export function MarketingShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoMark} alt="EcoBus" width={36} height={36} className="h-9 w-9 object-contain" />
            <span className="text-[17px] font-semibold tracking-tight">EcoBus</span>
          </Link>
          <nav className="hidden items-center gap-8 text-[14px] font-medium text-foreground/70 md:flex">
            <Link to="/" hash="features" className="transition hover:text-foreground">{t("nav.features")}</Link>
            <Link to="/" hash="apps" className="transition hover:text-foreground">{t("nav.apps")}</Link>
            <Link to="/" hash="pricing" className="transition hover:text-foreground">{t("nav.pricing")}</Link>
            <Link to="/contact" className="transition hover:text-foreground">{t("footer.link.contact")}</Link>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link to="/login">
              <Button className="h-10 rounded-full bg-secondary px-5 text-secondary-foreground hover:bg-secondary/90">
                {t("nav.signin")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="flex flex-col gap-4">
              <Link to="/" className="flex items-center gap-2.5">
                <img src={logoMark} alt="EcoBus" width={32} height={32} className="h-8 w-8 object-contain" />
                <span className="text-[15px] font-semibold tracking-tight">EcoBus</span>
              </Link>
              <p className="text-sm leading-relaxed text-muted-foreground">{t("footer.tagline")}</p>
            </div>

            {/* Product */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{t("footer.col.product")}</h4>
              <div className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                <Link to="/" hash="features" className="transition hover:text-foreground">{t("footer.link.features")}</Link>
                <Link to="/" hash="pricing" className="transition hover:text-foreground">{t("footer.link.pricing")}</Link>
                <Link to="/" hash="apps" className="transition hover:text-foreground">{t("footer.link.apps")}</Link>
              </div>
            </div>

            {/* Company */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{t("footer.col.company")}</h4>
              <div className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                <Link to="/contact" className="transition hover:text-foreground">{t("footer.link.contact")}</Link>
              </div>
            </div>

            {/* Legal */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{t("footer.col.legal")}</h4>
              <div className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                <Link to="/terms" className="transition hover:text-foreground">{t("footer.link.terms")}</Link>
                <Link to="/privacy" className="transition hover:text-foreground">{t("footer.link.privacy")}</Link>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border/40 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <div>© {new Date().getFullYear()} EcoBus. {t("footer.rights")}</div>
            <div className="flex items-center gap-5">
              <Link to="/terms" className="hover:text-foreground">{t("footer.link.terms")}</Link>
              <Link to="/privacy" className="hover:text-foreground">{t("footer.link.privacy")}</Link>
              <Link to="/contact" className="hover:text-foreground">{t("footer.link.contact")}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
