"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

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

const W = 800;
const H = 520;
const P = 8;
const GAP = 6;
const WALL = 2;

const MID_Y = 280;
const SPLIT_X = 460;

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

  const lab3Rect = { x: P, y: P, w: W - P * 2, h: MID_Y - P - GAP / 2 };
  const lab2Rect = {
    x: P,
    y: MID_Y + GAP / 2,
    w: SPLIT_X - P - GAP / 2,
    h: H - MID_Y - P - GAP / 2,
  };
  const lab1Rect = {
    x: SPLIT_X + GAP / 2,
    y: MID_Y + GAP / 2,
    w: W - SPLIT_X - P - GAP / 2,
    h: H - MID_Y - P - GAP / 2,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-500/20 text-blue-400 text-xs">&#9633;</span>
        <span>{t("twin.floorPlan.title")}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-600/60 bg-gray-900/90 shadow-lg shadow-black/20">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: "520px" }}
        >
          <defs>
            <pattern
              id="floor-grid"
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

          <rect width={W} height={H} fill="#0a0f1a" rx="8" />
          <rect width={W} height={H} fill="url(#floor-grid)" rx="8" />

          {/* Lab-3: top */}
          <RoomBlock
            rect={lab3Rect}
            room={lab3}
            label="Lab-3"
            accent="#8b5cf6"
            hasServers
            onClick={() => lab3 && onSelectRoom(lab3.id)}
            t={t}
          />

          {/* Lab-3 rack layout sketch */}
          <Lab3Interior rect={lab3Rect} />

          {/* Lab-2: bottom-left (empty) */}
          <RoomBlock
            rect={lab2Rect}
            room={lab2}
            label="Lab-2"
            accent="#6b7280"
            hasServers={false}
            onClick={() => lab2 && onSelectRoom(lab2.id)}
            t={t}
          />

          {/* Lab-1: bottom-right */}
          <RoomBlock
            rect={lab1Rect}
            room={lab1}
            label="Lab-1"
            accent="#3b82f6"
            hasServers
            onClick={() => lab1 && onSelectRoom(lab1.id)}
            t={t}
          />

          {/* Lab-1 rack layout sketch */}
          <Lab1Interior rect={lab1Rect} />

          {/* Walls */}
          <line
            x1={P}
            y1={MID_Y}
            x2={W - P}
            y2={MID_Y}
            stroke="#6b7280"
            strokeWidth={WALL + 1}
            strokeDasharray="8 4"
          />
          <line
            x1={SPLIT_X}
            y1={MID_Y}
            x2={SPLIT_X}
            y2={H - P}
            stroke="#6b7280"
            strokeWidth={WALL + 1}
            strokeDasharray="8 4"
          />
        </svg>
      </div>

      <p className="text-center text-xs text-gray-600">
        {t("twin.floorPlan.clickRoom")}
      </p>
    </div>
  );
}

function Lab3Interior({ rect }: { rect: { x: number; y: number; w: number; h: number } }) {
  const rw = 70;
  const rh = 30;
  const gap = 6;
  const ox = rect.x + 20;
  const oy = rect.y + 40;

  const racks = [
    { label: "Rack #3-4", col: 0, row: 0 },
    { label: "Rack #3-3", col: 0, row: 1 },
    { label: "Rack #3-2", col: 0, row: 2 },
    { label: "Rack #3-1", col: 0, row: 3 },
  ];

  const coolX = rect.x + rect.w * 0.3;
  const coolY = rect.y + rect.h - 42;

  return (
    <g>
      {racks.map((r) => (
        <g key={r.label}>
          <rect
            x={ox + r.col * (rw + gap)}
            y={oy + r.row * (rh + gap)}
            width={rw}
            height={rh}
            rx={4}
            fill="#1e1b4b"
            fillOpacity={0.6}
            stroke="#a78bfa"
            strokeOpacity={0.5}
            strokeWidth={1.2}
          />
          <text
            x={ox + r.col * (rw + gap) + rw / 2}
            y={oy + r.row * (rh + gap) + rh / 2 + 4}
            fill="#c4b5fd"
            fontSize="10"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            {r.label}
          </text>
        </g>
      ))}
      {[0, 1].map((col) => (
        <g key={`grp-${col}`}>
          {[0, 1, 2].map((row) => (
            <rect
              key={row}
              x={ox + (col + 2) * (rw + gap) + 60}
              y={oy + row * (rh + gap)}
              width={rw + 20}
              height={rh}
              rx={4}
              fill="#1e1b4b"
              fillOpacity={0.3}
              stroke="#7c3aed"
              strokeOpacity={0.25}
              strokeWidth={1}
              strokeDasharray="4 2"
            />
          ))}
        </g>
      ))}
      {[0, 1, 2].map((i) => (
        <g key={`cool-${i}`}>
          <rect
            x={coolX + i * 90}
            y={coolY}
            width={72}
            height={28}
            rx={5}
            fill="#083344"
            fillOpacity={0.7}
            stroke="#22d3ee"
            strokeOpacity={0.6}
            strokeWidth={1.2}
          />
          <text
            x={coolX + i * 90 + 36}
            y={coolY + 18}
            fill="#67e8f9"
            fontSize="10"
            fontWeight="600"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            AC
          </text>
        </g>
      ))}
    </g>
  );
}

function Lab1Interior({ rect }: { rect: { x: number; y: number; w: number; h: number } }) {
  const rw = 70;
  const rh = 30;
  const gap = 6;
  const ox = rect.x + rect.w - rw - 30;
  const oy = rect.y + 70;

  const racks = [
    { label: "Rack #1-1", row: 0 },
    { label: "Rack #1-2", row: 1 },
    { label: "Rack #1-3", row: 2 },
    { label: "Rack #1-4", row: 3 },
  ];

  return (
    <g>
      {/* Cooling unit */}
      <rect
        x={ox - 5}
        y={rect.y + 32}
        width={72}
        height={28}
        rx={5}
        fill="#083344"
        fillOpacity={0.7}
        stroke="#22d3ee"
        strokeOpacity={0.6}
        strokeWidth={1.2}
      />
      <text
        x={ox - 5 + 36}
        y={rect.y + 32 + 18}
        fill="#67e8f9"
        fontSize="10"
        fontWeight="600"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
      >
        AC
      </text>

      {/* Racks */}
      {racks.map((r) => (
        <g key={r.label}>
          <rect
            x={ox}
            y={oy + r.row * (rh + gap)}
            width={rw}
            height={rh}
            rx={4}
            fill="#172554"
            fillOpacity={0.6}
            stroke="#60a5fa"
            strokeOpacity={0.5}
            strokeWidth={1.2}
          />
          <text
            x={ox + rw / 2}
            y={oy + r.row * (rh + gap) + rh / 2 + 4}
            fill="#93c5fd"
            fontSize="10"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            {r.label}
          </text>
        </g>
      ))}
    </g>
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

  const fillOpacity = hasServers ? 0.12 : 0.04;
  const borderOpacity = hasServers ? 0.5 : 0.2;

  return (
    <g
      onClick={isClickable ? onClick : undefined}
      className={cn(isClickable && "cursor-pointer")}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
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
          <g transform={`translate(${rect.x + 16}, ${rect.y + 46})`}>
            <StatItem
              x={0}
              value={stats.rackCount}
              label={t("twin.statRacks")}
              color="#9ca3af"
            />
            <StatItem
              x={80}
              value={stats.equipmentCount}
              label={t("twin.statEquipment")}
              color="#9ca3af"
            />
            <StatItem
              x={160}
              value={stats.activeCount}
              label={t("twin.statActive")}
              color="#22c55e"
            />
            {stats.issueCount > 0 && (
              <StatItem
                x={240}
                value={stats.issueCount}
                label={t("twin.statIssues")}
                color="#ef4444"
              />
            )}
          </g>

          {/* Utilization bar */}
          <g
            transform={`translate(${rect.x + 16}, ${rect.y + rect.h - 28})`}
          >
            <text
              x={0}
              y={0}
              fill="#6b7280"
              fontSize="10"
              fontFamily="system-ui, sans-serif"
            >
              {stats.usedU}/{stats.totalU}U ({stats.utilPct}%)
            </text>
            <rect
              x={0}
              y={6}
              width={Math.min(rect.w - 32, 260)}
              height={5}
              rx={2.5}
              fill="#1f2937"
            />
            <rect
              x={0}
              y={6}
              width={
                Math.min(rect.w - 32, 260) *
                Math.min(stats.utilPct / 100, 1)
              }
              height={5}
              rx={2.5}
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
  value,
  label,
  color,
}: {
  x: number;
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
