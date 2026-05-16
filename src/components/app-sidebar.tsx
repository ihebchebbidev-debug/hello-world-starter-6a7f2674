import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, School, Bus, IdCard, Route as RouteIcon, MapPin,
  Users, UserCircle2, Navigation, History, ClipboardCheck, CalendarOff,
  Siren, Bell, BarChart3, Hexagon, AlertTriangle, Settings, LogOut, Bus as Logo,
  ClipboardList, ScrollText,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const groups = [
  {
    label: "Vue d'ensemble",
    items: [
      { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard },
      { title: "Analytics", url: "/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Flotte",
    items: [
      { title: "Bus", url: "/buses", icon: Bus },
      { title: "Chauffeurs", url: "/drivers", icon: IdCard },
      { title: "Routes", url: "/routes", icon: RouteIcon },
      { title: "Arrêts", url: "/stops", icon: MapPin },
      { title: "Affectations", url: "/assignments", icon: ClipboardList },
      { title: "Géofences", url: "/geofences", icon: Hexagon },
    ],
  },
  {
    label: "Personnes",
    items: [
      { title: "Enfants", url: "/children", icon: Users },
      { title: "Parents", url: "/parents", icon: UserCircle2 },
      { title: "Utilisateurs", url: "/users", icon: Users },
      { title: "Écoles", url: "/schools", icon: School },
    ],
  },
  {
    label: "Opérations",
    items: [
      { title: "Trajets en cours", url: "/trips/live", icon: Navigation },
      { title: "Historique trajets", url: "/trips/history", icon: History },
      { title: "Check-ins", url: "/checkins", icon: ClipboardCheck },
      { title: "Absences", url: "/absences", icon: CalendarOff },
    ],
  },
  {
    label: "Sécurité & Comm.",
    items: [
      { title: "SOS", url: "/sos", icon: Siren },
      { title: "Alertes", url: "/alerts", icon: AlertTriangle },
      { title: "Notifications", url: "/notifications", icon: Bell },
    ],
  },
];

const superAdminGroup = {
  label: "Super admin",
  items: [
    { title: "Organisations", url: "/organizations", icon: Building2 },
    { title: "Logs serveur", url: "/logs", icon: ScrollText },
  ],
};

const settingsGroup = {
  label: "Système",
  items: [{ title: "Paramètres", url: "/settings", icon: Settings }],
};

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, isSuperAdmin, logout } = useAuth();
  const isActive = (url: string) => path === url || path.startsWith(url + "/");

  // Scope nav for school admins: hide super-admin-only entries (Users, Organizations, Logs).
  const scopedGroups = isSuperAdmin
    ? groups
    : groups.map((g) => ({
        ...g,
        items: g.items.filter((i) => i.url !== "/users"),
      }));

  const allGroups = [
    ...scopedGroups,
    ...(isSuperAdmin ? [superAdminGroup] : []),
    settingsGroup,
  ];

  const initials = (user?.firstName?.[0] || user?.email?.[0] || "?").toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-md ring-soft">
            <Logo className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">EcoBus</span>
              <span className="truncate text-[10.5px] uppercase tracking-[0.16em] text-sidebar-foreground/55">
                Console admin
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {allGroups.map((g) => (
          <SidebarGroup key={g.label} className="px-2 py-1.5">
            {!collapsed && (
              <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
                {g.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className="group relative h-9 rounded-md font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground"
                      >
                        <Link to={item.url} onClick={() => setOpenMobile(false)} className="flex items-center gap-2.5">
                          {active && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sidebar-primary" />
                          )}
                          <item.icon
                            className={`h-4 w-4 shrink-0 ${active ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground/90"}`}
                          />
                          <span className="truncate text-[13px]">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        <div className="flex items-center gap-2.5 px-2 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-semibold text-sidebar-primary-foreground shadow-sm ring-soft">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[13px] font-medium text-sidebar-foreground">
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.email}
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/55">
                {isSuperAdmin ? "Super admin" : "School admin"}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
