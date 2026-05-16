import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, RefreshCw, Inbox, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

export type FilterDef<T> = {
  key: string;
  label: string;
  options: { label: string; value: string; predicate: (row: T) => boolean }[];
  defaultValue?: string; // option value, defaults to "__all"
};

export function DataList<T extends Record<string, any>>({
  queryKey,
  queryFn,
  columns,
  searchKeys = [],
  searchPlaceholder = "Rechercher…",
  emptyHint = "Aucun élément à afficher",
  emptyAction,
  rowKey = (r: T) => r.id ?? JSON.stringify(r),
  onRowClick,
  toolbar,
  actions,
  filters = [],
  pageSize = 25,
  refetchInterval,
  density = "comfortable",
}: {
  queryKey: any[];
  queryFn: () => Promise<T[]>;
  columns: Column<T>[];
  searchKeys?: string[];
  searchPlaceholder?: string;
  emptyHint?: string;
  emptyAction?: React.ReactNode;
  rowKey?: (row: T) => string;
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;
  actions?: (row: T) => React.ReactNode;
  filters?: FilterDef<T>[];
  pageSize?: number;
  refetchInterval?: number;
  density?: "comfortable" | "compact";
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(
    () => Object.fromEntries(filters.map((f) => [f.key, f.defaultValue ?? "__all"])),
  );
  const { data = [], isLoading, isFetching, refetch } = useQuery({
    queryKey, queryFn, refetchInterval,
  });

  const filtered = useMemo(() => {
    let rows: T[] = data;
    for (const f of filters) {
      const v = activeFilters[f.key];
      if (v && v !== "__all") {
        const opt = f.options.find((o) => o.value === v);
        if (opt) rows = rows.filter(opt.predicate);
      }
    }
    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter((r) =>
        searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(needle)),
      );
    }
    return rows;
  }, [data, q, searchKeys, filters, activeFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);
  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const rowPad = density === "compact" ? "py-2.5" : "py-3.5";

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder={searchPlaceholder}
            className="h-10 pl-9"
          />
        </div>
        {filters.map((f) => (
          <div
            key={f.key}
            role="group"
            aria-label={f.label}
            className="flex h-10 items-center gap-0.5 rounded-md border border-border bg-card p-0.5 shadow-xs"
          >
            {[{ label: "Tous", value: "__all" }, ...f.options.map((o) => ({ label: o.label, value: o.value }))].map((o) => {
              const active = (activeFilters[f.key] ?? "__all") === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { setActiveFilters((s) => ({ ...s, [f.key]: o.value })); setPage(1); }}
                  className={
                    "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors " +
                    (active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted")
                  }
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-10"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
        {toolbar}
        <div className="ml-auto text-xs tabular-nums text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "résultat" : "résultats"}
        </div>
      </div>

      <Card className="overflow-hidden p-0 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-4 py-3 text-left ${c.className ?? ""}`}
                  >
                    {c.header}
                  </th>
                ))}
                {actions ? (
                  <th className="px-4 py-3 text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className={`px-4 ${rowPad}`}>
                        <Skeleton className="h-3.5 w-full max-w-[180px]" />
                      </td>
                    ))}
                    {actions ? <td className={`px-4 ${rowPad}`} /> : null}
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (actions ? 1 : 0)}
                    className="px-4 py-16 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Inbox className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-foreground">
                          {q.trim() ? "Aucun résultat" : "Liste vide"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {q.trim()
                            ? "Essayez une autre recherche."
                            : emptyHint}
                        </p>
                      </div>
                      {!q.trim() && emptyAction}
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={
                      "transition-colors " +
                      (onRowClick
                        ? "cursor-pointer hover:bg-muted/40"
                        : "hover:bg-muted/25")
                    }
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 ${rowPad} align-middle ${c.className ?? ""}`}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                    {actions ? (
                      <td
                        className={`px-4 ${density === "compact" ? "py-1.5" : "py-2"} align-middle text-right`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-0.5">
                          {actions(row)}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > pageSize && (
          <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} sur {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="sm" className="h-7 w-7 p-0"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost" size="sm" className="h-7 w-7 p-0"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Page suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
