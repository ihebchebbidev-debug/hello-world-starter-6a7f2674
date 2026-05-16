import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Menu, Bus as Logo } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  head: () => ({
    meta: [
      { title: "Console — EcoBus" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppHeader() {
  const { isMobile, openMobile, setOpenMobile, toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/85 px-3 backdrop-blur-md sm:gap-3 sm:px-4">
      {isMobile ? (
        <button
          type="button"
          onClick={() => setOpenMobile(!openMobile)}
          aria-label="Ouvrir le menu"
          aria-expanded={openMobile}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-background px-3 text-[13px] font-medium text-foreground shadow-sm transition hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-95"
        >
          <Menu className="h-4.5 w-4.5" />
          <span>Menu</span>
        </button>
      ) : (
        <SidebarTrigger className="h-9 w-9 rounded-xl border border-border/70 bg-background text-foreground shadow-sm transition hover:bg-primary hover:text-primary-foreground hover:border-primary [&_svg]:h-4 [&_svg]:w-4" />
      )}

      <div className="hidden h-5 w-px bg-border sm:block" />

      <div className="flex items-center gap-2 text-[13px]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand shadow-sm sm:hidden">
          <Logo className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="font-semibold text-foreground">EcoBus</span>
        <span className="hidden text-muted-foreground/60 sm:inline">/</span>
        <span className="hidden text-muted-foreground sm:inline">Console</span>
      </div>

      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          <span className="live-dot" />
          Backend en ligne
        </span>
        <span className="inline-flex items-center sm:hidden" aria-label="Backend en ligne">
          <span className="live-dot" />
        </span>
      </div>
    </header>
  );
}
