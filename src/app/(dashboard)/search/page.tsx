"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Search, Filter, X, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { QuickPlaceModal } from "@/components/racks/quick-place-modal";

interface Facet {
  value: string;
  count: number;
}

interface Facets {
  cpuModels: Facet[];
  memoryTypes: Facet[];
  memoryManufacturers: Facet[];
  manufacturers: Facet[];
  biosVersions: Facet[];
}

interface EquipmentResult {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  bmcIpAddress: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  status: string;
  biosVersion: string | null;
  totalMemoryGB: number | null;
  cpus: Array<{ model: string | null; cores: number | null; threads: number | null }>;
  memories: Array<{ manufacturer: string | null; memoryType: string | null; capacityGb: number | null }>;
  rack: { name: string; room: { name: string } } | null;
  _count: { memories: number; networkPorts: number };
}

interface SearchResponse {
  items: EquipmentResult[];
  total: number;
  facets: Facets;
}

const FILTER_LABELS: Record<string, string> = {
  cpuModel: "CPU Model",
  memoryType: "Memory Type",
  memoryMfr: "Memory Manufacturer",
  manufacturer: "System Manufacturer",
  biosVersion: "BIOS Version",
  status: "Status",
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [placing, setPlacing] = useState<{ id: string; label: string } | null>(null);

  const doSearch = useCallback(async (q: string, f: Record<string, string>) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    Object.entries(f).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });

    try {
      const res = await fetch(`/api/inventory-search?${params}`);
      const json: SearchResponse = await res.json();
      setResults(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    doSearch("", {});
  }, [doSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, filters);
  };

  const setFilter = (key: string, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    doSearch(query, next);
  };

  const removeFilter = (key: string) => {
    const next = { ...filters };
    delete next[key];
    setFilters(next);
    doSearch(query, next);
  };

  const clearAll = () => {
    setQuery("");
    setFilters({});
    doSearch("", {});
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Search}
        title="Inventory Search"
        subtitle="장비, CPU, 메모리, 펌웨어를 통합 검색합니다."
        accent="gray"
      />

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="hostname, IP, serial, CPU model, memory manufacturer, part number..."
            className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <Button type="submit" disabled={loading}>
          Search
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={activeFilterCount > 0 ? "border-blue-500/50 text-blue-400" : ""}
        >
          <Filter className="mr-1.5 h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px]">{activeFilterCount}</span>
          )}
          {showFilters ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
        </Button>
      </form>

      {/* Active filters */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(filters).map(([key, val]) =>
            val ? (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full bg-blue-900/30 px-2.5 py-1 text-xs text-blue-300"
              >
                {FILTER_LABELS[key] || key}: {val}
                <button onClick={() => removeFilter(key)} className="hover:text-gray-50">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : null,
          )}
          <button onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-300">
            Clear all
          </button>
        </div>
      )}

      {/* Filter panel */}
      {showFilters && results?.facets && (
        <Card>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {/* CPU Model facet */}
            <FacetSection
              title="CPU Model"
              items={results.facets.cpuModels}
              active={filters.cpuModel}
              onSelect={(v) => setFilter("cpuModel", v)}
            />
            {/* Memory Type facet */}
            <FacetSection
              title="Memory Type"
              items={results.facets.memoryTypes}
              active={filters.memoryType}
              onSelect={(v) => setFilter("memoryType", v)}
            />
            {/* Memory Manufacturer facet */}
            <FacetSection
              title="Memory Manufacturer"
              items={results.facets.memoryManufacturers}
              active={filters.memoryMfr}
              onSelect={(v) => setFilter("memoryMfr", v)}
            />
            {/* System Manufacturer facet */}
            <FacetSection
              title="System Manufacturer"
              items={results.facets.manufacturers}
              active={filters.manufacturer}
              onSelect={(v) => setFilter("manufacturer", v)}
            />
            {/* BIOS Version facet */}
            <FacetSection
              title="BIOS Version"
              items={results.facets.biosVersions}
              active={filters.biosVersion}
              onSelect={(v) => setFilter("biosVersion", v)}
            />
          </div>
        </Card>
      )}

      {/* Results */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {loading
            ? "Searching..."
            : initialLoad
              ? ""
              : `${results?.total || 0} results found`}
        </p>
      </div>

      {results && results.items.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase">
                  <th className="pb-2 pr-3">Hostname</th>
                  <th className="pb-2 pr-3">IP</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Manufacturer / Model</th>
                  <th className="pb-2 pr-3">CPU</th>
                  <th className="pb-2 pr-3">Memory</th>
                  <th className="pb-2 pr-3">BIOS</th>
                  <th className="pb-2 pr-3">Location</th>
                </tr>
              </thead>
              <tbody>
                {results.items.map((eq) => (
                  <tr key={eq.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/servers/${eq.id}`}
                        className="font-mono text-blue-400 hover:underline"
                      >
                        {eq.hostname || "-"}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 font-mono text-gray-400">{eq.ipAddress || "-"}</td>
                    <td className="py-2 pr-3"><StatusBadge status={eq.status} /></td>
                    <td className="py-2 pr-3 text-gray-300 max-w-[180px] truncate">
                      {eq.manufacturer || ""} {eq.model || "-"}
                    </td>
                    <td className="py-2 pr-3 text-gray-400 max-w-[200px] truncate">
                      {eq.cpus.length > 0
                        ? `${eq.cpus.length}x ${eq.cpus[0].model || "?"} (${eq.cpus[0].cores || "?"}C)`
                        : "-"}
                    </td>
                    <td className="py-2 pr-3 text-gray-400">
                      {eq.totalMemoryGB
                        ? `${eq.totalMemoryGB}GB`
                        : "-"}
                      {eq.memories.length > 0 && (
                        <span className="ml-1 text-xs text-gray-600">
                          {eq.memories[0].memoryType} {eq.memories[0].manufacturer}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-gray-500 max-w-[120px] truncate">
                      {eq.biosVersion || "-"}
                    </td>
                    <td className="py-2 pr-3 text-gray-500 text-xs">
                      {eq.rack ? (
                        `${eq.rack.room.name} / ${eq.rack.name}`
                      ) : (
                        <button
                          onClick={() =>
                            setPlacing({
                              id: eq.id,
                              label: eq.hostname || eq.ipAddress || eq.id,
                            })
                          }
                          className="flex items-center gap-1 rounded border border-blue-700/50 bg-blue-600/10 px-2 py-1 text-xs text-blue-300 transition-colors hover:bg-blue-600/20"
                        >
                          <MapPin className="h-3 w-3" />
                          배치
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {results && results.items.length === 0 && !loading && !initialLoad && (
        <Card>
          <p className="text-center text-gray-500 py-8">검색 결과가 없습니다.</p>
        </Card>
      )}

      {placing && (
        <QuickPlaceModal
          equipmentId={placing.id}
          equipmentLabel={placing.label}
          onClose={() => setPlacing(null)}
          onPlaced={() => doSearch(query, filters)}
        />
      )}
    </div>
  );
}

function FacetSection({
  title,
  items,
  active,
  onSelect,
}: {
  title: string;
  items: Facet[];
  active?: string;
  onSelect: (v: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 mb-2">{title}</p>
      <div className="space-y-0.5 max-h-40 overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.value}
            onClick={() => onSelect(item.value)}
            className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs transition-colors ${
              active === item.value
                ? "bg-blue-600/20 text-blue-300"
                : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            <span className="truncate mr-2">{item.value}</span>
            <span className="text-gray-600 shrink-0">{item.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
