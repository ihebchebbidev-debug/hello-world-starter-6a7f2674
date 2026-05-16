import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { Bus, IdCard, Users, Navigation } from "lucide-react";
import { AnalyticsAPI, BusesAPI, DriversAPI, ChildrenAPI, TripsAPI } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/analytics")({ component: AnalyticsPage });

const fallbackTrend = Array.from({ length: 7 }).map((_, i) => ({
  day: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][i],
  trips: 0, kids: 0,
}));

function AnalyticsPage() {
  const overview = useQuery({ queryKey: ["analytics", "overview", 14], queryFn: () => AnalyticsAPI.overview(14) });
  const attendance = useQuery({ queryKey: ["analytics", "attendance", 14], queryFn: () => AnalyticsAPI.attendance(14) });
  const buses = useQuery({ queryKey: ["buses"], queryFn: () => BusesAPI.list() });
  const drivers = useQuery({ queryKey: ["drivers"], queryFn: () => DriversAPI.list() });
  const children = useQuery({ queryKey: ["children"], queryFn: () => ChildrenAPI.list() });
  const trips = useQuery({ queryKey: ["trips", "history"], queryFn: () => TripsAPI.history() });

  const dau = (overview.data?.dailyActiveUsers || []) as { day: string; users: number }[];
  const trend = dau.length
    ? dau.map((d) => ({ day: String(d.day).slice(5), trips: d.users, kids: d.users }))
    : fallbackTrend;

  // Source de vérité = liste réelle des bus (la valeur `fleet.total` du backend
  // peut être incohérente — voir analytics/overview qui renvoyait total:0/active:1).
  // On retombe sur fleet.total uniquement si la liste est encore en cours de chargement.
  const totalBuses = buses.data?.length ?? overview.data?.fleet?.total ?? 0;
  const activeBuses = Math.min(
    overview.data?.fleet?.active ?? totalBuses,
    totalBuses,
  );
  const busLabel = buses.data || overview.data ? `${activeBuses}/${totalBuses}` : "—";

  return (
    <div>
      <PageHeader title="Analytics" description="Indicateurs de performance et statistiques d'usage." />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Bus actifs"
            value={busLabel}
            icon={Bus}
            hint={totalBuses ? `${Math.round((activeBuses / totalBuses) * 100)}% en service` : undefined}
          />
          <StatCard label="Chauffeurs" value={drivers.data?.length ?? "—"} icon={IdCard} />
          <StatCard label="Enfants" value={children.data?.length ?? "—"} icon={Users} />
          <StatCard label="Trajets (14j)" value={overview.data?.trips?.completedInWindow ?? trips.data?.length ?? "—"} icon={Navigation} />
        </div>

        {attendance.data?.totals && (
          <Card className="p-5">
            <h2 className="mb-2 text-base font-semibold text-foreground">Présence (14 derniers jours)</h2>
            <p className="text-sm text-muted-foreground">
              {attendance.data.totals.boarded ?? 0} embarquements · {attendance.data.totals.left ?? 0} descentes ·{" "}
              {attendance.data.totals.absent ?? 0} absences.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground">Trajets par jour</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="trips" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground">Embarquements / jour</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="kids" fill="var(--primary-accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
