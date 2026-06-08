"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Building2, Server, HardDrive, Activity } from "lucide-react";

interface RoomData {
  id: string;
  name: string;
  racks: Array<{
    equipment: Array<{
      status: string;
      rackHeight: number;
    }>;
    totalUnits: number;
  }>;
}

interface DataCenterFloorPlanProps {
  rooms: RoomData[];
  onSelectRoom: (roomId: string) => void;
  t: (key: string) => string;
}

interface RoomStats {
  rackCount: number;
  equipmentCount: number;
  activeCount: number;
  issueCount: number;
  totalU: number;
  usedU: number;
  utilPct: number;
}

function computeStats(room: RoomData): RoomStats {
  const rackCount = room.racks.length;
  const equipmentCount = room.racks.reduce(
    (s, r) => s + r.equipment.length,
    0,
  );
  const activeCount = room.racks.reduce(
    (s, r) => s + r.equipment.filter((e) => e.status === "ACTIVE").length,
    0,
  );
  const issueCount = room.racks.reduce(
    (s, r) =>
      s +
      r.equipment.filter(
        (e) => e.status === "FAILED" || e.status === "REPAIR",
      ).length,
    0,
  );
  const totalU = room.racks.reduce((s, r) => s + r.totalUnits, 0);
  const usedU = room.racks.reduce(
    (s, r) => s + r.equipment.reduce((u, e) => u + (e.rackHeight || 1), 0),
    0,
  );
  const utilPct = totalU > 0 ? Math.round((usedU / totalU) * 100) : 0;
  return { rackCount, equipmentCount, activeCount, issueCount, totalU, usedU, utilPct };
}

function utilColor(pct: number): string {
  if (pct >= 85) return "#ef4444";
  if (pct >= 60) return "#f59e0b";
  return "#22c55e";
}

const LAYOUT = {
  width: 600,
  height: 400,
  padding: 2,
  gap: 4,
  midY: 200,
  lab2SplitX: 420,
};

export function DataCenterFloorPlan({
  rooms,
  onSelectRoom,
  t,
}: DataCenterFloorPlanProps) {
  const roomMap = useMemo(() => {
    const map = new Map<string, RoomData>();
    for (const r of rooms) {
      const key = r.name.toLowerCase().replace(/[\s-]/g, "");
      map.set(key, r);
    }
    return map;
  }, [rooms]);

  const findRoom = (pattern: string): RoomData | undefined => {
    const entries = Array.from(roomMap.entries());
    for (let i = 0; i < entries.length; i++) {
      if (entries[i][0].includes(pattern)) return entries[i][1];
    }
    return undefined;
  };

  const lab1 = findRoom("lab1") || findRoom("1");
  const lab2 = findRoom("lab2") || findRoom("2");
  const lab3 = findRoom("lab3") || findRoom("3");

  const { width, height, padding: p, gap, midY, lab2SplitX } = LAYOUT;

  const lab1Rect = { x: p, y: p, w: width - p * 2, h: midY - p - gap / 2 };
  const lab2Rect = {
    x: p,
    y: midY + gap / 2,
    w: lab2SplitX - p - gap / 2,
    h: height - midY - p - gap / 2,
  };
  const lab3Rect = {
    x: lab2SplitX + gap / 2,
    y: midY + gap / 2,
    w: width - lab2SplitX - p - gap / 2,
    h: height - midY - p - gap / 2,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Building2 className="h-4 w-4" />
        <span>{t("twin.floorPlan.title")}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900/80">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ maxHeight: "480px" }}
        >
          <defs>
            <pattern
              id="grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="#1f2937"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>

          <rect width={width} height={height} fill="url(#grid)" rx="8" />

          <RoomBlock
            rect={lab1Rect}
            room={lab1}
            label="Lab-1"
            accent="#3b82f6"
            hasServers
            onClick={() => lab1 && onSelectRoom(lab1.id)}
            t={t}
          />
          <RoomBlock
            rect={lab2Rect}
            room={lab2}
            label="Lab-2"
            accent="#6b7280"
            hasServers={false}
            onClick={() => lab2 && onSelectRoom(lab2.id)}
            t={t}
          />
          <RoomBlock
            rect={lab3Rect}
            room={lab3}
            label="Lab-3"
            accent="#8b5cf6"
            hasServers
            onClick={() => lab3 && onSelectRoom(lab3.id)}
            t={t}
          />

          {/* Dividing walls */}
          <line
            x1={p}
            y1={midY}
            x2={width - p}
            y2={midY}
            stroke="#374151"
            strokeWidth="2"
            strokeDasharray="6 3"
          />
          <line
            x1={lab2SplitX}
            y1={midY}
            x2={lab2SplitX}
            y2={height - p}
            stroke="#374151"
            strokeWidth="2"
            strokeDasharray="6 3"
          />
        </svg>
      </div>

      <p className="text-center text-xs text-gray-600">
        {t("twin.floorPlan.clickRoom")}
      </p>
    </div>
  );
}

function RoomBlock({
  rect,
  room,
  label,
  accent,
  hasServers,
  onClick,
  t,
}: {
  rect: { x: number; y: number; w: number; h: number };
  room: RoomData | undefined;
  label: string;
  accent: string;
  hasServers: boolean;
  onClick: () => void;
  t: (key: string) => string;
}) {
  const stats = room ? computeStats(room) : null;
  const isClickable = !!room;
  const r = 6;

  const fillOpacity = hasServers ? 0.12 : 0.05;
  const borderOpacity = hasServers ? 0.5 : 0.2;

  return (
    <g
      onClick={isClickable ? onClick : undefined}
      className={cn(isClickable && "cursor-pointer")}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {/* Background */}
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        rx={r}
        fill={accent}
        fillOpacity={fillOpacity}
        stroke={accent}
        strokeOpacity={borderOpacity}
        strokeWidth="1.5"
      />

      {/* Hover overlay */}
      {isClickable && (
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.w}
          height={rect.h}
          rx={r}
          fill={accent}
          fillOpacity={0}
          className="transition-all duration-200 hover:fill-opacity-[0.08]"
        />
      )}

      {/* Room label */}
      <text
        x={rect.x + 16}
        y={rect.y + 26}
        fill={accent}
        fontSize="18"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>

      {stats && hasServers ? (
        <>
          {/* Stats row */}
          <g transform={`translate(${rect.x + 16}, ${rect.y + 46})`}>
            <StatItem
              x={0}
              icon="rack"
              value={stats.rackCount}
              label={t("twin.statRacks")}
              color="#9ca3af"
            />
            <StatItem
              x={rect.w > 200 ? 80 : 65}
              icon="server"
              value={stats.equipmentCount}
              label={t("twin.statEquipment")}
              color="#9ca3af"
            />
            <StatItem
              x={rect.w > 200 ? 160 : 130}
              icon="active"
              value={stats.activeCount}
              label={t("twin.statActive")}
              color="#22c55e"
            />
            {stats.issueCount > 0 && (
              <StatItem
                x={rect.w > 200 ? 240 : 195}
                icon="issue"
                value={stats.issueCount}
                label={t("twin.statIssues")}
                color="#ef4444"
              />
            )}
          </g>

          {/* Utilization bar */}
          <g
            transform={`translate(${rect.x + 16}, ${rect.y + rect.h - 36})`}
          >
            <text
              x={0}
              y={0}
              fill="#6b7280"
              fontSize="11"
              fontFamily="system-ui, sans-serif"
            >
              {t("twin.statUtil")}: {stats.usedU}/{stats.totalU}U (
              {stats.utilPct}%)
            </text>
            <rect
              x={0}
              y={6}
              width={Math.min(rect.w - 32, 280)}
              height={6}
              rx={3}
              fill="#1f2937"
            />
            <rect
              x={0}
              y={6}
              width={
                Math.min(rect.w - 32, 280) *
                Math.min(stats.utilPct / 100, 1)
              }
              height={6}
              rx={3}
              fill={utilColor(stats.utilPct)}
            />
          </g>
        </>
      ) : (
        <text
          x={rect.x + 16}
          y={rect.y + 50}
          fill="#4b5563"
          fontSize="12"
          fontFamily="system-ui, sans-serif"
        >
          {room
            ? t("twin.floorPlan.noManagedServers")
            : t("twin.floorPlan.noData")}
        </text>
      )}
    </g>
  );
}

function StatItem({
  x,
  icon,
  value,
  label,
  color,
}: {
  x: number;
  icon: "rack" | "server" | "active" | "issue";
  value: number;
  label: string;
  color: string;
}) {
  return (
    <g transform={`translate(${x}, 0)`}>
      <text
        x={0}
        y={0}
        fill={color}
        fontSize="20"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {value}
      </text>
      <text
        x={0}
        y={16}
        fill="#6b7280"
        fontSize="10"
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}
