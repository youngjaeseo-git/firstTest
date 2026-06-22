"use client";

import { useState } from "react";
import { PrometheusMetrics } from "@/components/dashboard/prometheus-metrics";
import { FleetOverview } from "@/components/dashboard/fleet-overview";
import type { Cluster } from "@/lib/prometheus";

interface StatusCounts {
  active: number;
  maintenance: number;
  failed: number;
}

interface ClusterStatusCounts {
  all: StatusCounts;
  lab1: StatusCounts;
  lab3: StatusCounts;
}

export interface PlatformStat {
  platform: string;
  total: number;
  active: number;
}

export function DashboardClusterView({
  statusCounts,
  hostnameIpMap = {},
  platformStats = [],
  totalRacks = 0,
  totalRooms = 0,
}: {
  statusCounts: ClusterStatusCounts;
  hostnameIpMap?: Record<string, string>;
  platformStats?: PlatformStat[];
  totalRacks?: number;
  totalRooms?: number;
}) {
  const [cluster, setCluster] = useState<Cluster>("all");

  return (
    <>
      <PrometheusMetrics cluster={cluster} onClusterChange={setCluster} />
      <FleetOverview
        statusCounts={statusCounts[cluster]}
        cluster={cluster}
        hostnameIpMap={hostnameIpMap}
        platformStats={platformStats}
        totalRacks={totalRacks}
        totalRooms={totalRooms}
      />
    </>
  );
}
