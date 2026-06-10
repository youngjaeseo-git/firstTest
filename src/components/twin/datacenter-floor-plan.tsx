"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Minus, Plus, Maximize2 } from "lucide-react";

interface RoomData {
  id: string;
  name: string;
  racks: Array<{
    name?: string;
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
  const equipmentCount = room.racks.reduce((s, r) => s + r.equipment.length, 0);
  const activeCount = room.racks.reduce(
    (s, r) => s + r.equipment.filter((e) => e.status === "ACTIVE").length, 0,
  );
  const issueCount = room.racks.reduce(
    (s, r) => s + r.equipment.filter((e) => e.status === "FAILED" || e.status === "REPAIR").length, 0,
  );
  const totalU = room.racks.reduce((s, r) => s + r.totalUnits, 0);
  const usedU = room.racks.reduce(
    (s, r) => s + r.equipment.reduce((u, e) => u + (e.rackHeight || 1), 0), 0,
  );
  const utilPct = totalU > 0 ? Math.round((usedU / totalU) * 100) : 0;
  return { rackCount, equipmentCount, activeCount, issueCount, totalU, usedU, utilPct };
}

function utilColor(pct: number): string {
  if (pct >= 85) return "#ef4444";
  if (pct >= 60) return "#f59e0b";
  return "#22c55e";
}

const W = 1400;
const H = 650;
const P = 12;
const GAP = 10;

const MID_Y = 340;
const SPLIT_X = 680;

export function DataCenterFloorPlan({ rooms, onSelectRoom, t }: DataCenterFloorPlanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const isMouseDown = useRef(false);
  const hasDragged = useRef(false);

  const roomMap = useMemo(() => {
    const map = new Map<string, RoomData>();
    for (const r of rooms) {
      const key = r.name.toLowerCase().replace(/[\s-]/g, "");
      const existing = map.get(key);
      if (!existing || r.racks.length > existing.racks.length) {
        map.set(key, r);
      }
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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.max(0.5, Math.min(4, s * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isMouseDown.current = true;
    hasDragged.current = false;
    panStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isMouseDown.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    if (!hasDragged.current && Math.abs(dx) + Math.abs(dy) < 5) return;
    hasDragged.current = true;
    setIsPanning(true);
    setTranslate({ x: panStart.current.tx + dx, y: panStart.current.ty + dy });
  }, []);

  const handleMouseUp = useCallback(() => {
    isMouseDown.current = false;
    setIsPanning(false);
  }, []);

  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.stopPropagation();
      e.preventDefault();
      hasDragged.current = false;
    }
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/20 text-blue-400 text-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/></svg>
          </span>
          <span className="font-medium">{t("twin.floorPlan.title")}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-2 text-xs text-gray-600 tabular-nums">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.max(0.5, s / 1.2))}
            className="rounded-md border border-gray-700 bg-gray-800/80 p-1.5 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
            title="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setScale((s) => Math.min(4, s * 1.2))}
            className="rounded-md border border-gray-700 bg-gray-800/80 p-1.5 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
            title="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={resetView}
            className="rounded-md border border-gray-700 bg-gray-800/80 p-1.5 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
            title="Reset view"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          "relative overflow-hidden rounded-xl border border-gray-600/40 bg-[#060a14] shadow-2xl shadow-black/40 select-none",
          isPanning ? "cursor-grabbing" : "cursor-grab",
        )}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClickCapture={handleClickCapture}
      >
        <div
          className="transition-transform duration-75 origin-center"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          }}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <pattern id="fp-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#111827" strokeWidth="0.5" />
              </pattern>
              <pattern id="fp-grid-fine" width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M 6 0 L 0 0 0 6" fill="none" stroke="#0d1117" strokeWidth="0.3" />
              </pattern>
              <filter id="glow-purple" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feFlood floodColor="#8b5cf6" floodOpacity="0.15" />
                <feComposite in2="blur" operator="in" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-blue" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feFlood floodColor="#3b82f6" floodOpacity="0.15" />
                <feComposite in2="blur" operator="in" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feFlood floodColor="#22d3ee" floodOpacity="0.3" />
                <feComposite in2="blur" operator="in" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <linearGradient id="grad-purple" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#6d28d9" stopOpacity="0.04" />
              </linearGradient>
              <linearGradient id="grad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.04" />
              </linearGradient>
              <linearGradient id="grad-gray" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6b7280" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#374151" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="grad-rack-purple" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#312e81" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.7" />
              </linearGradient>
              <linearGradient id="grad-rack-blue" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#172554" stopOpacity="0.7" />
              </linearGradient>
            </defs>

            {/* Background */}
            <rect width={W} height={H} fill="#060a14" rx="10" />
            <rect width={W} height={H} fill="url(#fp-grid-fine)" rx="10" />
            <rect width={W} height={H} fill="url(#fp-grid)" rx="10" />

            {/* Building outline */}
            <rect x={2} y={2} width={W - 4} height={H - 4} rx="10" fill="none" stroke="#1f2937" strokeWidth="2" />

            {/* DC label */}
            <text x={W / 2} y={H - 4} fill="#1f2937" fontSize="11" textAnchor="middle" fontFamily="system-ui, sans-serif" letterSpacing="4">
              DATA CENTER — BUILDING A
            </text>

            {/* === Lab-3: top === */}
            <RoomBlock
              rect={lab3Rect}
              room={lab3}
              label="Lab-3"
              accent="#8b5cf6"
              gradient="url(#grad-purple)"
              glowFilter="url(#glow-purple)"
              hasServers
              onClick={() => lab3 && onSelectRoom(lab3.id)}
              t={t}
            />
            <Lab3Interior rect={lab3Rect} room={lab3} />

            {/* === Lab-2: bottom-left === */}
            <RoomBlock
              rect={lab2Rect}
              room={lab2}
              label="Lab-2"
              accent="#6b7280"
              gradient="url(#grad-gray)"
              hasServers={false}
              onClick={() => lab2 && onSelectRoom(lab2.id)}
              t={t}
            />
            <Lab2Interior rect={lab2Rect} />

            {/* === Lab-1: bottom-right === */}
            <RoomBlock
              rect={lab1Rect}
              room={lab1}
              label="Lab-1"
              accent="#3b82f6"
              gradient="url(#grad-blue)"
              glowFilter="url(#glow-blue)"
              hasServers
              onClick={() => lab1 && onSelectRoom(lab1.id)}
              t={t}
            />
            <Lab1Interior rect={lab1Rect} room={lab1} />

            {/* Walls */}
            <line x1={P} y1={MID_Y} x2={W - P} y2={MID_Y} stroke="#374151" strokeWidth="3" />
            <line x1={P} y1={MID_Y} x2={W - P} y2={MID_Y} stroke="#6b7280" strokeWidth="1" strokeDasharray="6 3" />
            <line x1={SPLIT_X} y1={MID_Y} x2={SPLIT_X} y2={H - P} stroke="#374151" strokeWidth="3" />
            <line x1={SPLIT_X} y1={MID_Y} x2={SPLIT_X} y2={H - P} stroke="#6b7280" strokeWidth="1" strokeDasharray="6 3" />

            {/* Door markers */}
            <DoorMarker x={W / 2} y={MID_Y} horizontal />
            <DoorMarker x={SPLIT_X} y={MID_Y + (H - MID_Y - P) / 2} />
            <DoorMarker x={W / 2} y={P} horizontal top />
          </svg>
        </div>

        {/* Pan hint */}
        <div className="absolute bottom-2 left-3 text-[10px] text-gray-700 pointer-events-none select-none">
          Drag: Pan &middot; Scroll: Zoom
        </div>
      </div>

      <p className="text-center text-xs text-gray-600">
        {t("twin.floorPlan.clickRoom")}
      </p>
    </div>
  );
}

/* ─── Door markers ─── */
function DoorMarker({ x, y, horizontal, top }: { x: number; y: number; horizontal?: boolean; top?: boolean }) {
  if (horizontal) {
    const dy = top ? -1 : 0;
    return (
      <g>
        <rect x={x - 20} y={y - 2 + dy} width={40} height={4} rx={2} fill="#1f2937" />
        <rect x={x - 16} y={y - 1 + dy} width={32} height={2} rx={1} fill="#374151" />
        <text x={x} y={y + (top ? -6 : 14)} fill="#4b5563" fontSize="8" textAnchor="middle" fontFamily="system-ui, sans-serif">DOOR</text>
      </g>
    );
  }
  return (
    <g>
      <rect x={x - 2} y={y - 20} width={4} height={40} rx={2} fill="#1f2937" />
      <rect x={x - 1} y={y - 16} width={2} height={32} rx={1} fill="#374151" />
      <text x={x + 10} y={y + 3} fill="#4b5563" fontSize="8" textAnchor="start" fontFamily="system-ui, sans-serif">DOOR</text>
    </g>
  );
}

/* ─── Rack element inside room ─── */
function RackIcon({
  x, y, w, h, label, accent, gradId, servers, utilPct,
}: {
  x: number; y: number; w: number; h: number;
  label: string; accent: string; gradId: string;
  servers?: number; utilPct?: number;
}) {
  const barH = Math.max(0, (h - 20) * Math.min((utilPct || 0) / 100, 1));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={`url(#${gradId})`} stroke={accent} strokeOpacity={0.5} strokeWidth={1.2} />
      {/* U fill bar */}
      <rect x={x + 2} y={y + h - 2 - barH} width={w - 4} height={barH} rx={1.5} fill={utilColor(utilPct || 0)} fillOpacity={0.3} />
      {/* Label */}
      <text x={x + w / 2} y={y + 12} fill={accent} fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif" fillOpacity={0.9}>
        {label}
      </text>
      {/* Server count */}
      {servers !== undefined && servers > 0 && (
        <text x={x + w / 2} y={y + h - 6} fill="#9ca3af" fontSize="8" textAnchor="middle" fontFamily="system-ui, sans-serif">
          {servers}srv
        </text>
      )}
    </g>
  );
}

/* ─── Cooling unit element ─── */
function CoolingUnit({ x, y, w, h }: { x: number; y: number; w?: number; h?: number }) {
  const cw = w || 72;
  const ch = h || 32;
  return (
    <g filter="url(#glow-cyan)">
      <rect x={x} y={y} width={cw} height={ch} rx={5} fill="#062c3a" stroke="#22d3ee" strokeOpacity={0.5} strokeWidth={1} />
      <text x={x + cw / 2} y={y + ch / 2 + 1} fill="#67e8f9" fontSize="10" fontWeight="700" textAnchor="middle" dominantBaseline="middle" fontFamily="system-ui, sans-serif">
        AC
      </text>
      {/* Fan circles */}
      <circle cx={x + 10} cy={y + ch / 2} r={4} fill="none" stroke="#22d3ee" strokeOpacity={0.3} strokeWidth={0.8} />
      <circle cx={x + cw - 10} cy={y + ch / 2} r={4} fill="none" stroke="#22d3ee" strokeOpacity={0.3} strokeWidth={0.8} />
    </g>
  );
}

/* ─── Raised floor tile pattern ─── */
function FloorTiles({ x, y, w, h, accent }: { x: number; y: number; w: number; h: number; accent: string }) {
  const tileSize = 30;
  const tiles: Array<{ tx: number; ty: number }> = [];
  for (let ty = y + 4; ty < y + h - 4; ty += tileSize) {
    for (let tx = x + 4; tx < x + w - 4; tx += tileSize) {
      if (tx + tileSize <= x + w - 4 && ty + tileSize <= y + h - 4) {
        tiles.push({ tx, ty });
      }
    }
  }
  return (
    <g>
      {tiles.map((t, i) => (
        <rect key={i} x={t.tx} y={t.ty} width={tileSize - 1} height={tileSize - 1} rx={1} fill={accent} fillOpacity={0.015} stroke={accent} strokeOpacity={0.04} strokeWidth={0.5} />
      ))}
    </g>
  );
}

/* ─── Lab-3 interior ─── */
function Lab3Interior({ rect, room }: { rect: { x: number; y: number; w: number; h: number }; room?: RoomData }) {
  const rw = 54;
  const rh = 50;
  const gap = 8;
  const oy = rect.y + 80;

  const rackNames = room?.racks.map((r) => r.name || "") || [];
  const stats = room ? computeStats(room) : null;

  const rackRows = [
    { label: rackNames[3] || "Rack 3-4", col: 0, row: 0 },
    { label: rackNames[2] || "Rack 3-3", col: 0, row: 1 },
    { label: rackNames[1] || "Rack 3-2", col: 0, row: 2 },
    { label: rackNames[0] || "Rack 3-1", col: 0, row: 3 },
  ];

  const ox1 = rect.x + 30;
  const ox2 = rect.x + rect.w * 0.18;
  const ox3 = rect.x + rect.w * 0.36;
  const ox4 = rect.x + rect.w * 0.50;

  const rackUtil = stats ? stats.utilPct : 0;

  return (
    <g>
      <FloorTiles x={rect.x} y={rect.y} w={rect.w} h={rect.h} accent="#8b5cf6" />

      {/* Primary rack column */}
      {rackRows.map((r) => (
        <RackIcon
          key={r.label}
          x={ox1 + r.col * (rw + gap)}
          y={oy + r.row * (rh + gap)}
          w={rw} h={rh}
          label={r.label}
          accent="#a78bfa"
          gradId="grad-rack-purple"
          servers={room ? Math.ceil((stats?.equipmentCount || 0) / Math.max(stats?.rackCount || 1, 1)) : undefined}
          utilPct={rackUtil}
        />
      ))}

      {/* Future expansion zones */}
      {[0, 1].map((col) => (
        <g key={`exp-${col}`}>
          {[0, 1, 2, 3].map((row) => {
            const ex = (col === 0 ? ox2 : ox3) + col * 30;
            return (
              <g key={row}>
                <rect
                  x={ex} y={oy + row * (rh + gap)}
                  width={rw + 8} height={rh} rx={3}
                  fill="#1e1b4b" fillOpacity={0.15}
                  stroke="#7c3aed" strokeOpacity={0.12} strokeWidth={0.8} strokeDasharray="4 3"
                />
                <text x={ex + (rw + 8) / 2} y={oy + row * (rh + gap) + rh / 2 + 3} fill="#4c1d95" fillOpacity={0.4} fontSize="8" textAnchor="middle" fontFamily="system-ui, sans-serif">
                  RESERVED
                </text>
              </g>
            );
          })}
        </g>
      ))}

      {/* Network switch area */}
      <g>
        <rect x={ox4 + 140} y={oy} width={90} height={40} rx={4} fill="#1a1a2e" stroke="#6366f1" strokeOpacity={0.3} strokeWidth={1} />
        <text x={ox4 + 185} y={oy + 16} fill="#818cf8" fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif">NET SWITCH</text>
        <text x={ox4 + 185} y={oy + 30} fill="#4f46e5" fontSize="8" textAnchor="middle" fontFamily="system-ui, sans-serif">ToR / Spine</text>
      </g>

      {/* K8s Master marker */}
      <g>
        <rect x={ox4 + 140} y={oy + 52} width={100} height={36} rx={4} fill="#0a1628" stroke="#22c55e" strokeOpacity={0.4} strokeWidth={1} />
        <circle cx={ox4 + 154} cy={oy + 70} r={4} fill="#22c55e" fillOpacity={0.6} />
        <text x={ox4 + 166} y={oy + 66} fill="#4ade80" fontSize="9" fontWeight="600" fontFamily="system-ui, sans-serif">K8s Master</text>
        <text x={ox4 + 166} y={oy + 78} fill="#166534" fontSize="7" fontFamily="system-ui, sans-serif">master-lab3</text>
      </g>

      {/* Cooling units */}
      <CoolingUnit x={rect.x + rect.w * 0.55} y={rect.y + rect.h - 52} />
      <CoolingUnit x={rect.x + rect.w * 0.55 + 90} y={rect.y + rect.h - 52} />
      <CoolingUnit x={rect.x + rect.w * 0.55 + 180} y={rect.y + rect.h - 52} />

      {/* Animated airflow from AC units */}
      {[0, 1, 2].map((i) => {
        const acCx = rect.x + rect.w * 0.55 + 36 + i * 90;
        const acTop = rect.y + rect.h - 54;
        return (
          <g key={`airflow-${i}`}>
            <AirflowStream cx={acCx - 14} startY={acTop} direction="up" />
            <AirflowStream cx={acCx} startY={acTop} direction="up" />
            <AirflowStream cx={acCx + 14} startY={acTop} direction="up" />
          </g>
        );
      })}

      {/* PDU markers */}
      <rect x={rect.x + rect.w - 60} y={rect.y + rect.h - 52} width={44} height={34} rx={3} fill="#1a0a0a" stroke="#f59e0b" strokeOpacity={0.3} strokeWidth={0.8} />
      <text x={rect.x + rect.w - 38} y={rect.y + rect.h - 37} fill="#f59e0b" fillOpacity={0.6} fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif">PDU</text>
      <text x={rect.x + rect.w - 38} y={rect.y + rect.h - 25} fill="#92400e" fontSize="7" textAnchor="middle" fontFamily="system-ui, sans-serif">3-Phase</text>
    </g>
  );
}

/* ─── Lab-2 interior (empty room) ─── */
function Lab2Interior({ rect }: { rect: { x: number; y: number; w: number; h: number } }) {
  return (
    <g>
      <FloorTiles x={rect.x} y={rect.y} w={rect.w} h={rect.h} accent="#6b7280" />
      <text x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 - 6} fill="#374151" fontSize="13" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif">
        AVAILABLE SPACE
      </text>
      <text x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 + 12} fill="#1f2937" fontSize="10" textAnchor="middle" fontFamily="system-ui, sans-serif">
        Future Expansion
      </text>
    </g>
  );
}

/* ─── Lab-1 interior ─── */
function Lab1Interior({ rect, room }: { rect: { x: number; y: number; w: number; h: number }; room?: RoomData }) {
  const rw = 52;
  const rh = 46;
  const gap = 6;
  const ox = rect.x + rect.w - rw - 40;
  const oy = rect.y + 72;

  const rackNames = room?.racks.map((r) => r.name || "") || [];
  const stats = room ? computeStats(room) : null;

  const racks = [
    { label: rackNames[0] || "Rack 1-1", row: 0 },
    { label: rackNames[1] || "Rack 1-2", row: 1 },
    { label: rackNames[2] || "Rack 1-3", row: 2 },
    { label: rackNames[3] || "Rack 1-4", row: 3 },
  ];

  const rackUtil = stats ? stats.utilPct : 0;
  const perRackServers = room ? Math.ceil((stats?.equipmentCount || 0) / Math.max(stats?.rackCount || 1, 1)) : undefined;

  return (
    <g>
      <FloorTiles x={rect.x} y={rect.y} w={rect.w} h={rect.h} accent="#3b82f6" />

      {/* Cooling unit + airflow (duct → ceiling) */}
      <CoolingUnit x={ox - 10} y={rect.y + 36} />
      <AirflowStream cx={ox + 12} startY={rect.y + 34} direction="up" length={30} />
      <AirflowStream cx={ox + 26} startY={rect.y + 34} direction="up" length={30} />
      <AirflowStream cx={ox + 40} startY={rect.y + 34} direction="up" length={30} />

      {/* Main racks */}
      {racks.map((r) => (
        <RackIcon
          key={r.label}
          x={ox} y={oy + r.row * (rh + gap)}
          w={rw} h={rh}
          label={r.label}
          accent="#60a5fa"
          gradId="grad-rack-blue"
          servers={perRackServers}
          utilPct={rackUtil}
        />
      ))}

      {/* Network switch area */}
      <g>
        <rect x={rect.x + 30} y={oy} width={90} height={40} rx={4} fill="#0c1929" stroke="#3b82f6" strokeOpacity={0.3} strokeWidth={1} />
        <text x={rect.x + 75} y={oy + 16} fill="#60a5fa" fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif">NET SWITCH</text>
        <text x={rect.x + 75} y={oy + 30} fill="#1d4ed8" fontSize="8" textAnchor="middle" fontFamily="system-ui, sans-serif">ToR / Spine</text>
      </g>

      {/* PDU */}
      <rect x={rect.x + 30} y={oy + 60} width={44} height={34} rx={3} fill="#1a0a0a" stroke="#f59e0b" strokeOpacity={0.3} strokeWidth={0.8} />
      <text x={rect.x + 52} y={oy + 75} fill="#f59e0b" fillOpacity={0.6} fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif">PDU</text>
      <text x={rect.x + 52} y={oy + 87} fill="#92400e" fontSize="7" textAnchor="middle" fontFamily="system-ui, sans-serif">3-Phase</text>

      {/* K8s Master / DCIM Server marker */}
      <g>
        <rect x={rect.x + 30} y={oy + 120} width={100} height={36} rx={4} fill="#0a1628" stroke="#22c55e" strokeOpacity={0.4} strokeWidth={1} />
        <circle cx={rect.x + 44} cy={oy + 138} r={4} fill="#22c55e" fillOpacity={0.6} />
        <text x={rect.x + 56} y={oy + 134} fill="#4ade80" fontSize="9" fontWeight="600" fontFamily="system-ui, sans-serif">K8s Master</text>
        <text x={rect.x + 56} y={oy + 146} fill="#166534" fontSize="7" fontFamily="system-ui, sans-serif">k8-master (DCIM)</text>
      </g>
    </g>
  );
}

/* ─── Room block ─── */
function RoomBlock({
  rect, room, label, accent, gradient, glowFilter, hasServers, onClick, t,
}: {
  rect: { x: number; y: number; w: number; h: number };
  room: RoomData | undefined;
  label: string;
  accent: string;
  gradient: string;
  glowFilter?: string;
  hasServers: boolean;
  onClick: () => void;
  t: (key: string) => string;
}) {
  const stats = room ? computeStats(room) : null;
  const isClickable = !!room;

  return (
    <g
      onClick={isClickable ? onClick : undefined}
      className={cn(isClickable && "cursor-pointer")}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {/* Room background */}
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={6} fill={gradient} stroke={accent} strokeOpacity={hasServers ? 0.4 : 0.15} strokeWidth={hasServers ? 1.5 : 1} />

      {/* Hover overlay */}
      {isClickable && (
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={6} fill={accent} fillOpacity={0} className="transition-all duration-200 hover:fill-opacity-[0.06]" />
      )}

      {/* Room label with accent bar */}
      <rect x={rect.x + 12} y={rect.y + 12} width={4} height={24} rx={2} fill={accent} fillOpacity={0.7} />
      <text x={rect.x + 24} y={rect.y + 30} fill={accent} fontSize="20" fontWeight="800" fontFamily="system-ui, sans-serif" letterSpacing="0.5">
        {label}
      </text>

      {/* Status badge */}
      {stats && hasServers && (
        <g transform={`translate(${rect.x + rect.w - 90}, ${rect.y + 14})`}>
          <rect width={76} height={22} rx={11} fill={stats.issueCount > 0 ? "#7f1d1d" : "#052e16"} fillOpacity={0.6} stroke={stats.issueCount > 0 ? "#ef4444" : "#22c55e"} strokeOpacity={0.3} strokeWidth={0.8} />
          <circle cx={12} cy={11} r={3} fill={stats.issueCount > 0 ? "#ef4444" : "#22c55e"} />
          <text x={22} y={15} fill={stats.issueCount > 0 ? "#fca5a5" : "#86efac"} fontSize="9" fontWeight="600" fontFamily="system-ui, sans-serif">
            {stats.issueCount > 0 ? `${stats.issueCount} Issues` : "Healthy"}
          </text>
        </g>
      )}

      {/* Stats */}
      {stats && hasServers ? (
        <>
          <text x={rect.x + 24} y={rect.y + 52} fontSize="11" fontFamily="system-ui, sans-serif">
            <tspan fill={accent} fontWeight="700">{stats.rackCount}</tspan>
            <tspan fill="#4b5563"> Racks  </tspan>
            <tspan fill="#374151">·</tspan>
            <tspan fill="#4b5563">  </tspan>
            <tspan fill={accent} fontWeight="700">{stats.equipmentCount}</tspan>
            <tspan fill="#4b5563"> Servers  </tspan>
            <tspan fill="#374151">·</tspan>
            <tspan fill="#4b5563">  </tspan>
            <tspan fill="#22c55e" fontWeight="700">{stats.activeCount}</tspan>
            <tspan fill="#4b5563"> Active</tspan>
          </text>
          <g transform={`translate(${rect.x + 24}, ${rect.y + 60})`}>
            <rect x={0} y={0} width={180} height={4} rx={2} fill="#1f2937" />
            <rect x={0} y={0} width={180 * Math.min(stats.utilPct / 100, 1)} height={4} rx={2} fill={utilColor(stats.utilPct)} />
            <text x={188} y={5} fill="#4b5563" fontSize="9" fontFamily="system-ui, sans-serif">
              {stats.utilPct}% ({stats.usedU}/{stats.totalU}U)
            </text>
          </g>
        </>
      ) : (
        <text x={rect.x + 24} y={rect.y + 56} fill="#4b5563" fontSize="12" fontFamily="system-ui, sans-serif">
          {room ? t("twin.floorPlan.noManagedServers") : t("twin.floorPlan.noData")}
        </text>
      )}
    </g>
  );
}

/* ─── Animated cooling airflow ─── */
function AirflowStream({ cx, startY, direction, length = 45 }: {
  cx: number; startY: number; direction: "up" | "down"; length?: number;
}) {
  const sign = direction === "up" ? -1 : 1;
  return (
    <g>
      {[0, 1, 2].map((i) => {
        const delay = `${i * 0.7}s`;
        const tipY = startY;
        const d = direction === "up"
          ? `M${cx - 4},${tipY + 5} L${cx},${tipY} L${cx + 4},${tipY + 5}`
          : `M${cx - 4},${tipY - 5} L${cx},${tipY} L${cx + 4},${tipY - 5}`;
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeOpacity="0"
          >
            <animate attributeName="stroke-opacity" values="0;0.55;0.25;0" dur="2.1s" begin={delay} repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="translate" from="0 0" to={`0 ${sign * length}`} dur="2.1s" begin={delay} repeatCount="indefinite" />
          </path>
        );
      })}
    </g>
  );
}
