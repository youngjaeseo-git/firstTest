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

export function DashboardClusterView({
  statusCounts,
  hostnameIpMap = {},
}: {
  statusCounts: ClusterStatusCounts;
  hostnameIpMap?: Record<string, string>;
}) {
  const [cluster, setCluster] = useState<Cluster>("all");

  return (
    <>
      <PrometheusMetrics cluster={cluster} onClusterChange={setCluster} />
      <FleetOverview
        statusCounts={statusCounts[cluster]}
        cluster={cluster}
        hostnameIpMap={hostnameIpMap}
      />
    </>
  );
}
