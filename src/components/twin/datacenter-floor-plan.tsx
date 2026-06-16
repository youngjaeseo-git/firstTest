"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Minus, Plus, Maximize2, Pencil, Check, Thermometer, BarChart3, Wind } from "lucide-react";

/* ─── Types ─── */

interface Rect {
  x: number; y: number; w: number; h: number;
}

interface RackData {
  id: string;
  name?: string;
  positionX?: number | null;
  positionY?: number | null;
  width?: number | null;
  height?: number | null;
  equipment: Array<{
    status: string;
    rackHeight: number;
    hostname?: string | null;
    ipAddress?: string | null;
  }>;
  totalUnits: number;
}

interface RoomData {
  id: string;
  name: string;
  racks: RackData[];
  elements?: RoomElementData[];
  layoutX?: number | null;
  layoutY?: number | null;
  layoutW?: number | null;
  layoutH?: number | null;
}

interface RoomElementData {
  id: string;
  roomId?: string;
  type: string;
  name?: string | null;
  positionX: number;
  positionY: number;
  width?: number | null;
  height?: number | null;
  rotation?: number | null;
  metadata?: Record<string, unknown> | null;
}

type OverlayMode = "none" | "temp" | "util" | "airflow";

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

/* ─── Temperature color scale (30°C ~ 80°C) ─── */
function tempColor(celsius: number): string {
  if (celsius <= 30) return "#22c55e";
  if (celsius <= 45) return "#84cc16";
  if (celsius <= 55) return "#eab308";
  if (celsius <= 65) return "#f97316";
  if (celsius <= 75) return "#ef4444";
  return "#dc2626";
}

function tempOpacity(celsius: number): number {
  if (celsius <= 30) return 0.25;
  const t = Math.min((celsius - 30) / 50, 1);
  return 0.25 + t * 0.45;
}

/* ─── Rack average temp from equipment ─── */
function rackAvgTemp(rack: RackData, nodeTemps: Record<string, number>): number | null {
  const temps: number[] = [];
  for (const eq of rack.equipment) {
    if (eq.hostname && nodeTemps[eq.hostname] !== undefined) {
      temps.push(nodeTemps[eq.hostname]);
    } else if (eq.ipAddress && nodeTemps[eq.ipAddress] !== undefined) {
      temps.push(nodeTemps[eq.ipAddress]);
    }
  }
  if (temps.length === 0) return null;
  return Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10;
}

/* ─── Rack utilization (per-rack) ─── */
function rackUtilPct(rack: RackData): number {
  const usedU = rack.equipment.reduce((u, e) => u + (e.rackHeight || 1), 0);
  return rack.totalUnits > 0 ? Math.round((usedU / rack.totalUnits) * 100) : 0;
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [posOverrides, setPosOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [sizeOverrides, setSizeOverrides] = useState<Record<string, { w: number; h: number }>>({});
  const [dragState, setDragState] = useState<{ id: string; kind: "rack" | "element" | "room"; x: number; y: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ id: string; w: number; h: number } | null>(null);
  const [roomRectOverrides, setRoomRectOverrides] = useState<Record<string, Rect>>({});
  const [contextMenu, setContextMenu] = useState<{
    svgX: number; svgY: number;
    id: string; kind: "rack" | "element";
    elemType: string;
    w: number; h: number;
    meta?: Record<string, unknown>;
  } | null>(null);
  const rightDragged = useRef(false);
  const dragRef = useRef<{
    id: string;
    kind: "rack" | "element" | "room";
    roomRect: Rect;
    w: number;
    h: number;
    offsetX: number;
    offsetY: number;
    mode: "move" | "resize";
    origW: number;
    origH: number;
    startSvgX: number;
    startSvgY: number;
  } | null>(null);

  /* ─── Overlay state ─── */
  const [overlay, setOverlay] = useState<OverlayMode>("none");
  const [nodeTemps, setNodeTemps] = useState<Record<string, number>>({});

  /* ─── Tooltip state ─── */
  const [tooltip, setTooltip] = useState<{
    x: number; y: number;
    rack: RackData;
    avgTemp: number | null;
  } | null>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Fetch temperature data ─── */
  useEffect(() => {
    if (overlay !== "temp") return;
    let cancelled = false;
    const fetchTemps = async () => {
      try {
        const res = await fetch("/api/metrics/node-temps");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setNodeTemps(data);
      } catch { /* ignore */ }
    };
    fetchTemps();
    const timer = setInterval(fetchTemps, 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [overlay]);

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

  /* ─── Room rects: DB-driven if available, hardcoded fallback ─── */
  const lab3RectBase = useMemo(() => {
    if (lab3?.layoutX != null && lab3?.layoutY != null && lab3?.layoutW != null && lab3?.layoutH != null) {
      return { x: lab3.layoutX, y: lab3.layoutY, w: lab3.layoutW, h: lab3.layoutH };
    }
    return { x: P, y: P, w: W - P * 2, h: MID_Y - P - GAP / 2 };
  }, [lab3]);

  const lab2RectBase = useMemo(() => {
    if (lab2?.layoutX != null && lab2?.layoutY != null && lab2?.layoutW != null && lab2?.layoutH != null) {
      return { x: lab2.layoutX, y: lab2.layoutY, w: lab2.layoutW, h: lab2.layoutH };
    }
    return { x: P, y: MID_Y + GAP / 2, w: SPLIT_X - P - GAP / 2, h: H - MID_Y - P - GAP / 2 };
  }, [lab2]);

  const lab1RectBase = useMemo(() => {
    if (lab1?.layoutX != null && lab1?.layoutY != null && lab1?.layoutW != null && lab1?.layoutH != null) {
      return { x: lab1.layoutX, y: lab1.layoutY, w: lab1.layoutW, h: lab1.layoutH };
    }
    return { x: SPLIT_X + GAP / 2, y: MID_Y + GAP / 2, w: W - SPLIT_X - P - GAP / 2, h: H - MID_Y - P - GAP / 2 };
  }, [lab1]);

  const applyRoomDragState = useCallback((roomId: string | undefined, base: Rect): Rect => {
    if (!roomId) return base;
    const ov = roomRectOverrides[roomId] || base;
    if (dragState?.kind === "room" && dragState.id === roomId) {
      return { x: dragState.x, y: dragState.y, w: ov.w, h: ov.h };
    }
    if (resizeState?.id === roomId) {
      return { x: ov.x, y: ov.y, w: resizeState.w, h: resizeState.h };
    }
    return ov;
  }, [roomRectOverrides, dragState, resizeState]);

  const lab3Rect = applyRoomDragState(lab3?.id, lab3RectBase);
  const lab2Rect = applyRoomDragState(lab2?.id, lab2RectBase);
  const lab1Rect = applyRoomDragState(lab1?.id, lab1RectBase);

  const clientToSVG = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const r = pt.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  }, []);

  const getRackPos = useCallback((
    rackId: string, defaultX: number, defaultY: number,
    rack?: { positionX?: number | null; positionY?: number | null },
    roomRect?: Rect,
  ) => {
    if (dragState?.id === rackId) return { x: dragState.x, y: dragState.y };
    const ov = posOverrides[rackId];
    if (ov && roomRect) return { x: roomRect.x + ov.x, y: roomRect.y + ov.y };
    if (rack?.positionX != null && rack?.positionY != null && roomRect) {
      return { x: roomRect.x + rack.positionX, y: roomRect.y + rack.positionY };
    }
    return { x: defaultX, y: defaultY };
  }, [dragState, posOverrides]);

  const getElemPos = useCallback((elem: RoomElementData, roomRect: Rect) => {
    if (dragState?.id === elem.id) return { x: dragState.x, y: dragState.y };
    const ov = posOverrides[elem.id];
    if (ov) return { x: roomRect.x + ov.x, y: roomRect.y + ov.y };
    return { x: roomRect.x + elem.positionX, y: roomRect.y + elem.positionY };
  }, [dragState, posOverrides]);

  const handleRoomDragStart = useCallback((
    roomId: string, rect: Rect, e: React.MouseEvent,
    mode: "move" | "resize",
  ) => {
    if (!isEditMode) return;
    e.stopPropagation();
    e.preventDefault();
    const svgPt = clientToSVG(e.clientX, e.clientY);
    const bldgRect: Rect = { x: 2, y: 2, w: W - 4, h: H - 4 };
    if (mode === "resize") {
      dragRef.current = {
        id: roomId, kind: "room", roomRect: bldgRect,
        w: rect.w, h: rect.h,
        offsetX: 0, offsetY: 0,
        mode: "resize", origW: rect.w, origH: rect.h,
        startSvgX: svgPt.x, startSvgY: svgPt.y,
      };
      isMouseDown.current = true;
      setResizeState({ id: roomId, w: rect.w, h: rect.h });
    } else {
      dragRef.current = {
        id: roomId, kind: "room", roomRect: bldgRect,
        w: rect.w, h: rect.h,
        offsetX: svgPt.x - rect.x, offsetY: svgPt.y - rect.y,
        mode: "move", origW: rect.w, origH: rect.h,
        startSvgX: svgPt.x, startSvgY: svgPt.y,
      };
      isMouseDown.current = true;
      rightDragged.current = false;
      setDragState({ id: roomId, kind: "room", x: rect.x, y: rect.y });
    }
  }, [isEditMode, clientToSVG]);

  const handleItemDragStart = useCallback((
    kind: "rack" | "element",
    id: string, x: number, y: number,
    w: number, h: number, roomRect: Rect, e: React.MouseEvent,
    mode: "move" | "resize" = "move",
  ) => {
    if (!isEditMode) return;
    e.stopPropagation();
    e.preventDefault();
    const svgPt = clientToSVG(e.clientX, e.clientY);
    if (mode === "resize") {
      dragRef.current = {
        id, kind, roomRect, w, h,
        offsetX: 0, offsetY: 0,
        mode: "resize", origW: w, origH: h,
        startSvgX: svgPt.x, startSvgY: svgPt.y,
      };
      isMouseDown.current = true;
      setResizeState({ id, w, h });
    } else {
      dragRef.current = {
        id, kind, roomRect, w, h,
        offsetX: svgPt.x - x, offsetY: svgPt.y - y,
        mode: "move", origW: w, origH: h,
        startSvgX: svgPt.x, startSvgY: svgPt.y,
      };
      isMouseDown.current = true;
      rightDragged.current = false;
      setDragState({ id, kind, x, y });
    }
  }, [isEditMode, clientToSVG]);

  const savePosition = useCallback(async (url: string, posX: number, posY: number) => {
    try {
      await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionX: Math.round(posX), positionY: Math.round(posY) }),
      });
    } catch { /* optimistic update stays */ }
  }, []);

  /* ─── Right-click tap toggle for elements (fires after mouseup) ─── */
  const pendingToggle = useRef<string | null>(null);
  const [elemMetaOverrides, setElemMetaOverrides] = useState<Record<string, Record<string, unknown>>>({});

  const handleElementContextMenu = useCallback((
    e: React.MouseEvent, elemId: string, elemType: string,
    currentMeta: Record<string, unknown>, w: number, h: number,
  ) => {
    if (!isEditMode) return;
    if (rightDragged.current) return;
    const svgPt = clientToSVG(e.clientX, e.clientY);
    setContextMenu({
      svgX: svgPt.x, svgY: svgPt.y,
      id: elemId, kind: "element", elemType, w, h, meta: currentMeta,
    });
  }, [isEditMode, clientToSVG]);

  const handleRackContextMenu = useCallback((
    e: React.MouseEvent, rackId: string, w: number, h: number,
  ) => {
    if (!isEditMode) return;
    if (rightDragged.current) return;
    const svgPt = clientToSVG(e.clientX, e.clientY);
    setContextMenu({
      svgX: svgPt.x, svgY: svgPt.y,
      id: rackId, kind: "rack", elemType: "RACK", w, h,
    });
  }, [isEditMode, clientToSVG]);

  /* ─── Toggle airflow direction (edit mode right-click on COOLING) ─── */

  const handleToggleDirection = useCallback(async (elemId: string, currentMeta: Record<string, unknown>) => {
    if (!isEditMode) return;
    const cur = String(currentMeta.airflowDirection || "up");
    const cycle = ["up", "right", "down", "left"];
    const next = cycle[(cycle.indexOf(cur) + 1) % 4];
    const newMeta = { ...currentMeta, airflowDirection: next };
    setElemMetaOverrides((prev) => ({ ...prev, [elemId]: newMeta }));
    try {
      await fetch(`/api/room-elements/${elemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: newMeta }),
      });
    } catch { /* optimistic */ }
  }, [isEditMode]);

  /* ─── Toggle door orientation (edit mode right-click on DOOR) ─── */
  const handleToggleOrientation = useCallback(async (elemId: string, currentMeta: Record<string, unknown>) => {
    if (!isEditMode) return;
    const cur = String(currentMeta.orientation || "horizontal");
    const next = cur === "horizontal" ? "vertical" : "horizontal";
    const newMeta = { ...currentMeta, orientation: next };
    setElemMetaOverrides((prev) => ({ ...prev, [elemId]: newMeta }));
    try {
      await fetch(`/api/room-elements/${elemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: newMeta }),
      });
    } catch { /* optimistic */ }
  }, [isEditMode]);

  /* ─── Add / Delete elements ─── */
  const [addedElems, setAddedElems] = useState<RoomElementData[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [addMenuRoom, setAddMenuRoom] = useState<string | null>(null);

  /* ─── Context menu actions ─── */
  const handleApplySizeToAll = useCallback(async () => {
    if (!contextMenu) return;
    const { id, kind, elemType, w: tw, h: th } = contextMenu;
    if (kind === "rack") {
      let targetRoom: RoomData | undefined;
      for (const room of rooms) {
        if (room.racks.some(r => r.id === id)) { targetRoom = room; break; }
      }
      if (!targetRoom) { setContextMenu(null); return; }
      const targets = targetRoom.racks.filter(r => r.id !== id);
      const ov: Record<string, { w: number; h: number }> = {};
      for (const t of targets) ov[t.id] = { w: tw, h: th };
      setSizeOverrides(prev => ({ ...prev, ...ov }));
      for (const t of targets) {
        fetch(`/api/racks/${t.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ width: tw, height: th }),
        }).catch(() => {});
      }
    } else {
      let targetRoom: RoomData | undefined;
      for (const room of rooms) {
        if (room.elements?.some(e => e.id === id)) { targetRoom = room; break; }
      }
      if (!targetRoom) {
        const added = addedElems.find(e => e.id === id);
        if (added?.roomId) targetRoom = rooms.find(r => r.id === added.roomId);
      }
      if (!targetRoom) { setContextMenu(null); return; }
      const targets = [
        ...(targetRoom.elements || []),
        ...addedElems.filter(e => e.roomId === targetRoom!.id),
      ].filter(e => e.type === elemType && e.id !== id && !removedIds.has(e.id));
      const ov: Record<string, { w: number; h: number }> = {};
      for (const t of targets) ov[t.id] = { w: tw, h: th };
      setSizeOverrides(prev => ({ ...prev, ...ov }));
      for (const t of targets) {
        fetch(`/api/room-elements/${t.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ width: tw, height: th }),
        }).catch(() => {});
      }
    }
    setContextMenu(null);
  }, [contextMenu, rooms, addedElems, removedIds]);

  const handleContextMenuToggle = useCallback(() => {
    if (!contextMenu?.meta) { setContextMenu(null); return; }
    if (contextMenu.elemType === "COOLING") {
      handleToggleDirection(contextMenu.id, contextMenu.meta);
    } else if (contextMenu.elemType === "DOOR") {
      handleToggleOrientation(contextMenu.id, contextMenu.meta);
    }
    setContextMenu(null);
  }, [contextMenu, handleToggleDirection, handleToggleOrientation]);

  const buildingRect: Rect = { x: 2, y: 2, w: W - 4, h: H - 4 };

  const handleAddElement = useCallback(async (roomId: string, type: string) => {
    setAddMenuRoom(null);
    const defaults: Record<string, { w: number; h: number; meta: Record<string, unknown> }> = {
      COOLING: { w: 72, h: 32, meta: { airflowDirection: "up", airflowLength: 45 } },
      PDU: { w: 44, h: 34, meta: { subLabel: "3-Phase" } },
      SWITCH: { w: 90, h: 40, meta: { subLabel: "ToR / Spine" } },
      MASTER_SERVER: { w: 100, h: 36, meta: { hostname: "master" } },
      DOOR: { w: 40, h: 4, meta: { orientation: "horizontal" } },
    };
    const d = defaults[type] || { w: 60, h: 30, meta: {} };
    const body = {
      roomId, type,
      name: type === "DOOR" ? "DOOR" : type === "COOLING" ? "AC" : type,
      positionX: 50, positionY: 50,
      width: d.w, height: d.h,
      metadata: d.meta,
    };
    try {
      const res = await fetch("/api/room-elements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const elem = await res.json();
        setAddedElems((prev) => [...prev, elem]);
      }
    } catch { /* ignore */ }
  }, []);

  const handleDeleteElement = useCallback(async (elemId: string) => {
    setRemovedIds((prev) => new Set(prev).add(elemId));
    try {
      await fetch(`/api/room-elements/${elemId}`, { method: "DELETE" });
    } catch {
      setRemovedIds((prev) => { const s = new Set(prev); s.delete(elemId); return s; });
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (isEditMode) return;
    isMouseDown.current = true;
    hasDragged.current = false;
    panStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
  }, [translate, isEditMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current && isMouseDown.current) {
      const svgPt = clientToSVG(e.clientX, e.clientY);
      const dr = dragRef.current;

      if (dr.mode === "resize") {
        const deltaX = svgPt.x - dr.startSvgX;
        const deltaY = svgPt.y - dr.startSvgY;
        if (dr.kind === "room") {
          const newW = Math.max(100, Math.round(dr.origW + deltaX));
          const newH = Math.max(80, Math.round(dr.origH + deltaY));
          setResizeState({ id: dr.id, w: newW, h: newH });
        } else {
          const newW = Math.max(10, Math.round(dr.origW + deltaX));
          const newH = Math.max(4, Math.round(dr.origH + deltaY));
          setResizeState({ id: dr.id, w: newW, h: newH });
        }
        return;
      }

      rightDragged.current = true;
      if (dr.kind === "room") {
        const nx = Math.max(2, Math.min(W - dr.w - 2, svgPt.x - dr.offsetX));
        const ny = Math.max(2, Math.min(H - dr.h - 2, svgPt.y - dr.offsetY));
        setDragState({ id: dr.id, kind: "room", x: nx, y: ny });
      } else {
        const nx = Math.max(dr.roomRect.x + 4, Math.min(dr.roomRect.x + dr.roomRect.w - dr.w - 4, svgPt.x - dr.offsetX));
        const ny = Math.max(dr.roomRect.y + 4, Math.min(dr.roomRect.y + dr.roomRect.h - dr.h - 4, svgPt.y - dr.offsetY));
        setDragState({ id: dr.id, kind: dr.kind, x: nx, y: ny });
      }
      return;
    }
    if (!isMouseDown.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    if (!hasDragged.current && Math.abs(dx) + Math.abs(dy) < 5) return;
    hasDragged.current = true;
    setIsPanning(true);
    setTranslate({ x: panStart.current.tx + dx, y: panStart.current.ty + dy });
  }, [clientToSVG]);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      const dr = dragRef.current;
      if (dr.mode === "resize" && resizeState) {
        if (dr.kind === "room") {
          const prev = roomRectOverrides[dr.id] || (() => {
            const r = [lab3, lab2, lab1].find(rm => rm?.id === dr.id);
            if (!r) return { x: 0, y: 0, w: resizeState.w, h: resizeState.h };
            const base = r === lab3 ? lab3RectBase : r === lab2 ? lab2RectBase : lab1RectBase;
            return base;
          })();
          const newRect = { x: prev.x, y: prev.y, w: resizeState.w, h: resizeState.h };
          setRoomRectOverrides((p) => ({ ...p, [dr.id]: newRect }));
          fetch(`/api/rooms/${dr.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ layoutX: Math.round(newRect.x), layoutY: Math.round(newRect.y), layoutW: Math.round(newRect.w), layoutH: Math.round(newRect.h) }),
          }).catch(() => {});
        } else {
          setSizeOverrides((prev) => ({ ...prev, [dr.id]: { w: resizeState.w, h: resizeState.h } }));
          const url = dr.kind === "rack" ? `/api/racks/${dr.id}` : `/api/room-elements/${dr.id}`;
          fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ width: resizeState.w, height: resizeState.h }),
          }).catch(() => {});
        }
        setResizeState(null);
        dragRef.current = null;
      } else if (dr.mode === "move" && dragState) {
        if (dr.kind === "room" && rightDragged.current) {
          const newRect = { x: dragState.x, y: dragState.y, w: dr.w, h: dr.h };
          setRoomRectOverrides((p) => ({ ...p, [dr.id]: newRect }));
          fetch(`/api/rooms/${dr.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ layoutX: Math.round(newRect.x), layoutY: Math.round(newRect.y), layoutW: Math.round(newRect.w), layoutH: Math.round(newRect.h) }),
          }).catch(() => {});
        } else if (rightDragged.current) {
          const rx = dragState.x - dr.roomRect.x;
          const ry = dragState.y - dr.roomRect.y;
          setPosOverrides((prev) => ({ ...prev, [dr.id]: { x: rx, y: ry } }));
          const url = dr.kind === "rack" ? `/api/racks/${dr.id}` : `/api/room-elements/${dr.id}`;
          savePosition(url, rx, ry);
        } else if (dr.kind === "element") {
          pendingToggle.current = dr.id;
        }
        setDragState(null);
        dragRef.current = null;
      }
    }
    isMouseDown.current = false;
    setIsPanning(false);
  }, [dragState, resizeState, savePosition, roomRectOverrides, lab1, lab2, lab3, lab1RectBase, lab2RectBase, lab3RectBase]);

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

  /* ─── Tooltip handlers ─── */
  const handleRackHover = useCallback((e: React.MouseEvent, rack: RackData) => {
    if (isEditMode) return;
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    const svgPt = clientToSVG(e.clientX, e.clientY);
    const avgTemp = rackAvgTemp(rack, nodeTemps);
    setTooltip({ x: svgPt.x, y: svgPt.y, rack, avgTemp });
  }, [isEditMode, clientToSVG, nodeTemps]);

  const handleRackLeave = useCallback(() => {
    tooltipTimeout.current = setTimeout(() => setTooltip(null), 100);
  }, []);

  const toggleOverlay = useCallback((mode: OverlayMode) => {
    setOverlay((prev) => prev === mode ? "none" : mode);
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
          {/* Overlay buttons */}
          <button
            onClick={() => toggleOverlay("temp")}
            className={cn(
              "mr-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5",
              overlay === "temp"
                ? "border-orange-500/50 bg-orange-500/20 text-orange-300 hover:bg-orange-500/30"
                : "border-gray-700 bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-gray-200",
            )}
            title={t("twin.overlay.temp")}
          >
            <Thermometer className="h-3.5 w-3.5" />
            {t("twin.overlay.temp")}
          </button>
          <button
            onClick={() => toggleOverlay("util")}
            className={cn(
              "mr-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5",
              overlay === "util"
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                : "border-gray-700 bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-gray-200",
            )}
            title={t("twin.overlay.util")}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {t("twin.overlay.util")}
          </button>
          <button
            onClick={() => toggleOverlay("airflow")}
            className={cn(
              "mr-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5",
              overlay === "airflow"
                ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
                : "border-gray-700 bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-gray-200",
            )}
            title="Airflow"
          >
            <Wind className="h-3.5 w-3.5" />
            Airflow
          </button>

          <div className="mx-1 h-5 w-px bg-gray-700" />

          {/* Edit mode */}
          <button
            onClick={() => { setIsEditMode((p) => !p); dragRef.current = null; setDragState(null); }}
            className={cn(
              "mr-2 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5",
              isEditMode
                ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
                : "border-gray-700 bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-gray-200",
            )}
          >
            {isEditMode ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {isEditMode ? t("twin.editModeDone") : t("twin.editMode")}
          </button>
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
          "relative overflow-hidden rounded-xl shadow-2xl shadow-black/40 select-none",
          isEditMode
            ? "border-2 border-dashed border-cyan-500/40 bg-[#060a14]"
            : "border border-gray-600/40 bg-[#060a14]",
          isPanning ? "cursor-grabbing" : isEditMode ? "cursor-default" : "cursor-grab",
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setTooltip(null); }}
        onClickCapture={handleClickCapture}
      >
        <div
          className="transition-transform duration-75 origin-center"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          }}
        >
          <svg
            ref={svgRef}
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
              <linearGradient id="grad-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.04" />
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
            <rect width={W} height={H} fill="#060a14" rx="10" onClick={() => { if (addMenuRoom) setAddMenuRoom(null); if (contextMenu) setContextMenu(null); }} />
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
              onClick={() => !isEditMode && lab3 && onSelectRoom(lab3.id)}
              t={t}
              isEditMode={isEditMode}
              onRoomDragStart={handleRoomDragStart}
            />
            <Lab3Interior rect={lab3Rect} room={lab3} isEditMode={isEditMode} getRackPos={getRackPos} getElemPos={getElemPos} onDragStart={handleItemDragStart} overlay={overlay} nodeTemps={nodeTemps} onRackHover={handleRackHover} onRackLeave={handleRackLeave} elemMetaOverrides={elemMetaOverrides} onDeleteElement={handleDeleteElement} sizeOverrides={sizeOverrides} resizeState={resizeState} onElementContextMenu={handleElementContextMenu} onRackContextMenu={handleRackContextMenu} addedElems={lab3 ? addedElems.filter(e => e.type !== "DOOR" && e.roomId === lab3.id) : []} removedIds={removedIds} />

            {/* === Lab-2: bottom-left === */}
            <RoomBlock
              rect={lab2Rect}
              room={lab2}
              label="Lab-2"
              accent="#10b981"
              gradient="url(#grad-emerald)"
              hasServers={false}
              onClick={() => !isEditMode && lab2 && onSelectRoom(lab2.id)}
              t={t}
              isEditMode={isEditMode}
              onRoomDragStart={handleRoomDragStart}
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
              onClick={() => !isEditMode && lab1 && onSelectRoom(lab1.id)}
              t={t}
              isEditMode={isEditMode}
              onRoomDragStart={handleRoomDragStart}
            />
            <Lab1Interior rect={lab1Rect} room={lab1} isEditMode={isEditMode} getRackPos={getRackPos} getElemPos={getElemPos} onDragStart={handleItemDragStart} overlay={overlay} nodeTemps={nodeTemps} onRackHover={handleRackHover} onRackLeave={handleRackLeave} elemMetaOverrides={elemMetaOverrides} onDeleteElement={handleDeleteElement} sizeOverrides={sizeOverrides} resizeState={resizeState} onElementContextMenu={handleElementContextMenu} onRackContextMenu={handleRackContextMenu} addedElems={lab1 ? addedElems.filter(e => e.type !== "DOOR" && e.roomId === lab1.id) : []} removedIds={removedIds} />

            {/* Walls */}
            <line x1={P} y1={MID_Y} x2={W - P} y2={MID_Y} stroke="#374151" strokeWidth="3" />
            <line x1={P} y1={MID_Y} x2={W - P} y2={MID_Y} stroke="#6b7280" strokeWidth="1" strokeDasharray="6 3" />
            <line x1={SPLIT_X} y1={MID_Y} x2={SPLIT_X} y2={H - P} stroke="#374151" strokeWidth="3" />
            <line x1={SPLIT_X} y1={MID_Y} x2={SPLIT_X} y2={H - P} stroke="#6b7280" strokeWidth="1" strokeDasharray="6 3" />

            {/* Door markers — DB elements (building-wide drag), hardcoded fallback */}
            {(() => {
              const dbDoors = rooms.flatMap((r) => (r.elements || []).filter((e) => e.type === "DOOR" && !removedIds.has(e.id)));
              const addedDoors = addedElems.filter((e) => e.type === "DOOR" && !removedIds.has(e.id));
              const allDoors = [...dbDoors, ...addedDoors];
              if (allDoors.length > 0) {
                return allDoors.map((elem) => {
                  const pos = getElemPos(elem, buildingRect);
                  return <ElementIcon key={elem.id} elem={elem} pos={pos} rect={buildingRect} isEditMode={isEditMode} onDragStart={handleItemDragStart} onDelete={isEditMode ? handleDeleteElement : undefined} elemMetaOverrides={elemMetaOverrides} sizeOverrides={sizeOverrides} resizeState={resizeState} onElementContextMenu={handleElementContextMenu} />;
                });
              }
              return (
                <>
                  <DoorMarker x={W / 2} y={MID_Y} horizontal />
                  <DoorMarker x={SPLIT_X} y={MID_Y + (H - MID_Y - P) / 2} />
                  <DoorMarker x={W / 2} y={P} horizontal top />
                </>
              );
            })()}

            {/* Edit mode: "+" add element buttons per room */}
            {isEditMode && [
              { room: lab3, rect: lab3Rect },
              { room: lab1, rect: lab1Rect },
              { room: lab2, rect: lab2Rect },
            ].map(({ room: r, rect: rr }) => r && (
              <g key={`add-${r.id}`}>
                <g style={{ cursor: "pointer" }} onClick={() => setAddMenuRoom(addMenuRoom === r.id ? null : r.id)}>
                  <circle cx={rr.x + rr.w - 24} cy={rr.y + 24} r={12} fill="#062c3a" stroke="#22d3ee" strokeOpacity={0.6} strokeWidth={1.2} />
                  <text x={rr.x + rr.w - 24} y={rr.y + 29} fill="#22d3ee" fontSize="16" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">+</text>
                </g>
                {addMenuRoom === r.id && (() => {
                  const types = ["COOLING", "PDU", "SWITCH", "MASTER_SERVER", "DOOR"];
                  const mx = rr.x + rr.w - 140;
                  const my = rr.y + 42;
                  return (
                    <g>
                      <rect x={mx - 6} y={my - 6} width={132} height={types.length * 24 + 12} rx={6} fill="#111827" fillOpacity={0.97} stroke="#374151" strokeWidth={1} />
                      <text x={mx + 4} y={my + 10} fill="#6b7280" fontSize="8" fontWeight="600" fontFamily="system-ui, sans-serif">ADD ELEMENT</text>
                      {types.map((type, i) => (
                        <g key={type} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); handleAddElement(r.id, type); }}>
                          <rect x={mx} y={my + 16 + i * 24} width={120} height={20} rx={3} fill="transparent" className="hover:fill-[#1f2937]" />
                          <text x={mx + 8} y={my + 16 + i * 24 + 14} fill="#d1d5db" fontSize="10" fontFamily="system-ui, sans-serif">
                            {type === "MASTER_SERVER" ? "MASTER SERVER" : type}
                          </text>
                        </g>
                      ))}
                    </g>
                  );
                })()}
              </g>
            ))}

            {/* Tooltip */}
            {tooltip && <RackTooltip x={tooltip.x} y={tooltip.y} rack={tooltip.rack} avgTemp={tooltip.avgTemp} />}

            {/* Context menu (edit mode right-click) */}
            {contextMenu && isEditMode && (() => {
              const mx = Math.min(contextMenu.svgX, W - 160);
              const my = Math.min(contextMenu.svgY, H - 60);
              const canToggle = contextMenu.elemType === "COOLING" || contextMenu.elemType === "DOOR";
              const menuH = canToggle ? 62 : 38;
              const typeLabel = contextMenu.kind === "rack" ? "랙" : contextMenu.elemType;
              return (
                <g>
                  <rect x={mx - 4} y={my - 4} width={156} height={menuH} rx={6} fill="#111827" fillOpacity={0.97} stroke="#374151" strokeWidth={1} />
                  <g style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); handleApplySizeToAll(); }}>
                    <rect x={mx} y={my} width={148} height={22} rx={3} fill="transparent" className="hover:fill-[#1f2937]" />
                    <text x={mx + 8} y={my + 15} fill="#d1d5db" fontSize="10" fontFamily="system-ui, sans-serif">
                      이 크기로 통일 ({typeLabel})
                    </text>
                  </g>
                  {canToggle && (
                    <g style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); handleContextMenuToggle(); }}>
                      <rect x={mx} y={my + 24} width={148} height={22} rx={3} fill="transparent" className="hover:fill-[#1f2937]" />
                      <text x={mx + 8} y={my + 39} fill="#d1d5db" fontSize="10" fontFamily="system-ui, sans-serif">
                        방향 전환
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Airflow overlay: room-level flow arrows */}
            {overlay === "airflow" && (
              <g>
                {[
                  { rect: lab3Rect, accent: "#8b5cf6" },
                  { rect: lab1Rect, accent: "#3b82f6" },
                  { rect: lab2Rect, accent: "#10b981" },
                ].map(({ rect: rr, accent }, ri) => {
                  const cols = Math.floor(rr.w / 80);
                  const rows = Math.floor(rr.h / 60);
                  return (
                    <g key={ri}>
                      {Array.from({ length: cols }).map((_, ci) => {
                        const cx = rr.x + 40 + ci * (rr.w / cols);
                        return Array.from({ length: rows }).map((_, rowi) => {
                          const cy = rr.y + 30 + rowi * (rr.h / rows);
                          return (
                            <g key={`${ci}-${rowi}`}>
                              <line
                                x1={cx} y1={cy + 8} x2={cx} y2={cy - 12}
                                stroke={accent} strokeOpacity={0.25} strokeWidth={1.5}
                              />
                              <polygon
                                points={`${cx},${cy - 16} ${cx - 4},${cy - 10} ${cx + 4},${cy - 10}`}
                                fill={accent} fillOpacity={0.3}
                              />
                            </g>
                          );
                        });
                      })}
                      <text
                        x={rr.x + rr.w / 2} y={rr.y + rr.h - 8}
                        fill={accent} fillOpacity={0.5} fontSize="9" textAnchor="middle"
                        fontFamily="system-ui, sans-serif" fontWeight="600"
                      >
                        COLD → HOT ↑
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Overlay legend */}
            {overlay !== "none" && <OverlayLegend mode={overlay} />}
          </svg>
        </div>

        {/* Pan hint */}
        <div className="absolute bottom-2 left-3 text-[10px] pointer-events-none select-none" style={{ color: isEditMode ? "#22d3ee" : "#374151" }}>
          {isEditMode ? "L-drag: Resize · R-drag: Move · R-tap: Menu · +: Add · ×: Delete" : "Drag: Pan · Zoom: +/- buttons"}
        </div>
      </div>

      <p className="text-center text-xs text-gray-600">
        {t("twin.floorPlan.clickRoom")}
      </p>
    </div>
  );
}

/* ─── Overlay legend ─── */
function OverlayLegend({ mode }: { mode: OverlayMode }) {
  const lx = W - 200;
  const ly = H - 40;
  if (mode === "airflow") {
    return (
      <g>
        <rect x={lx + 40} y={ly - 6} width={148} height={28} rx={4} fill="#0a0a0a" fillOpacity={0.85} stroke="#374151" strokeWidth={0.5} />
        <text x={lx + 48} y={ly + 12} fill="#9ca3af" fontSize="8" fontFamily="system-ui, sans-serif">AIRFLOW</text>
        <polygon points={`${lx + 100},${ly + 12} ${lx + 96},${ly + 6} ${lx + 104},${ly + 6}`} fill="#22d3ee" fillOpacity={0.7} />
        <line x1={lx + 100} y1={ly + 14} x2={lx + 100} y2={ly + 6} stroke="#22d3ee" strokeOpacity={0.5} strokeWidth={1.5} />
        <text x={lx + 114} y={ly + 12} fill="#67e8f9" fontSize="8" fontFamily="system-ui, sans-serif">Cold→Hot</text>
      </g>
    );
  }
  if (mode === "temp") {
    const stops = [
      { c: "#22c55e", label: "≤30°C" },
      { c: "#84cc16", label: "45°C" },
      { c: "#eab308", label: "55°C" },
      { c: "#f97316", label: "65°C" },
      { c: "#ef4444", label: "≥75°C" },
    ];
    return (
      <g>
        <rect x={lx - 8} y={ly - 6} width={196} height={28} rx={4} fill="#0a0a0a" fillOpacity={0.85} stroke="#374151" strokeWidth={0.5} />
        <text x={lx} y={ly + 12} fill="#9ca3af" fontSize="8" fontFamily="system-ui, sans-serif">TEMP</text>
        {stops.map((s, i) => (
          <g key={i}>
            <rect x={lx + 34 + i * 32} y={ly} width={26} height={8} rx={2} fill={s.c} fillOpacity={0.7} />
            <text x={lx + 34 + i * 32 + 13} y={ly + 18} fill="#6b7280" fontSize="7" textAnchor="middle" fontFamily="system-ui, sans-serif">{s.label}</text>
          </g>
        ))}
      </g>
    );
  }
  const stops = [
    { c: "#22c55e", label: "<60%" },
    { c: "#f59e0b", label: "60-85%" },
    { c: "#ef4444", label: ">85%" },
  ];
  return (
    <g>
      <rect x={lx + 40} y={ly - 6} width={148} height={28} rx={4} fill="#0a0a0a" fillOpacity={0.85} stroke="#374151" strokeWidth={0.5} />
      <text x={lx + 48} y={ly + 12} fill="#9ca3af" fontSize="8" fontFamily="system-ui, sans-serif">UTIL</text>
      {stops.map((s, i) => (
        <g key={i}>
          <rect x={lx + 76 + i * 36} y={ly} width={30} height={8} rx={2} fill={s.c} fillOpacity={0.7} />
          <text x={lx + 76 + i * 36 + 15} y={ly + 18} fill="#6b7280" fontSize="7" textAnchor="middle" fontFamily="system-ui, sans-serif">{s.label}</text>
        </g>
      ))}
    </g>
  );
}

/* ─── Rack hover tooltip ─── */
function RackTooltip({ x, y, rack, avgTemp }: {
  x: number; y: number; rack: RackData; avgTemp: number | null;
}) {
  const pct = rackUtilPct(rack);
  const tw = 140;
  const th = avgTemp !== null ? 68 : 54;
  const tx = Math.min(x + 12, W - tw - 8);
  const ty = Math.max(8, y - th - 8);
  const activeCount = rack.equipment.filter((e) => e.status === "ACTIVE").length;
  const totalEq = rack.equipment.length;

  return (
    <g>
      <rect x={tx} y={ty} width={tw} height={th} rx={5} fill="#111827" fillOpacity={0.95} stroke="#374151" strokeWidth={1} />
      <text x={tx + 8} y={ty + 14} fill="#e5e7eb" fontSize="10" fontWeight="700" fontFamily="system-ui, sans-serif">
        {rack.name || "Rack"}
      </text>
      <text x={tx + 8} y={ty + 28} fill="#9ca3af" fontSize="9" fontFamily="system-ui, sans-serif">
        Servers: {activeCount}/{totalEq}
      </text>
      <text x={tx + 8} y={ty + 42} fontSize="9" fontFamily="system-ui, sans-serif">
        <tspan fill="#9ca3af">U: </tspan>
        <tspan fill={utilColor(pct)} fontWeight="600">{pct}%</tspan>
        <tspan fill="#6b7280"> ({rack.equipment.reduce((u, e) => u + (e.rackHeight || 1), 0)}/{rack.totalUnits}U)</tspan>
      </text>
      {avgTemp !== null && (
        <text x={tx + 8} y={ty + 56} fontSize="9" fontFamily="system-ui, sans-serif">
          <tspan fill="#9ca3af">Temp: </tspan>
          <tspan fill={tempColor(avgTemp)} fontWeight="600">{avgTemp}°C</tspan>
        </text>
      )}
    </g>
  );
}

/* ─── Door markers ─── */
function DoorMarker({ x, y, horizontal, top }: { x: number; y: number; horizontal?: boolean; top?: boolean }) {
  if (horizontal) {
    const dy = top ? -1 : 0;
    const arcY = top ? y - 2 + dy - 18 : y + 4 + dy;
    const arcDir = top ? 1 : 0;
    return (
      <g>
        <rect x={x - 20} y={y - 3 + dy} width={40} height={6} rx={2} fill="#78350f" stroke="#d97706" strokeOpacity={0.6} strokeWidth={0.8} />
        <rect x={x - 16} y={y - 1 + dy} width={32} height={2} rx={1} fill="#a16207" fillOpacity={0.7} />
        <path d={`M ${x - 18} ${y + (top ? -3 : 3) + dy} A 18 18 0 0 ${arcDir} ${x + 18} ${y + (top ? -3 : 3) + dy}`} fill="none" stroke="#d97706" strokeOpacity={0.3} strokeWidth={0.8} strokeDasharray="3 2" />
        <circle cx={x + 12} cy={y + dy} r={1.5} fill="#fbbf24" fillOpacity={0.7} />
        <text x={x} y={y + (top ? -22 : 20)} fill="#d97706" fillOpacity={0.8} fontSize="8" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif">DOOR</text>
      </g>
    );
  }
  const arcX = x + 4;
  return (
    <g>
      <rect x={x - 3} y={y - 20} width={6} height={40} rx={2} fill="#78350f" stroke="#d97706" strokeOpacity={0.6} strokeWidth={0.8} />
      <rect x={x - 1} y={y - 16} width={2} height={32} rx={1} fill="#a16207" fillOpacity={0.7} />
      <path d={`M ${arcX} ${y - 18} A 18 18 0 0 1 ${arcX} ${y + 18}`} fill="none" stroke="#d97706" strokeOpacity={0.3} strokeWidth={0.8} strokeDasharray="3 2" />
      <circle cx={x} cy={y - 8} r={1.5} fill="#fbbf24" fillOpacity={0.7} />
      <text x={x + 14} y={y + 3} fill="#d97706" fillOpacity={0.8} fontSize="8" fontWeight="600" textAnchor="start" fontFamily="system-ui, sans-serif">DOOR</text>
    </g>
  );
}

/* ─── Rack element inside room ─── */
function RackIcon({
  x, y, w, h, label, accent, gradId, servers, utilPct,
  isEditMode, onLeftDrag, onRightDrag,
  overlayColor, overlayOpacity,
  onMouseEnter, onMouseLeave,
  resizing, onContextMenuTap,
}: {
  x: number; y: number; w: number; h: number;
  label: string; accent: string; gradId: string;
  servers?: number; utilPct?: number;
  isEditMode?: boolean;
  onLeftDrag?: (e: React.MouseEvent) => void;
  onRightDrag?: (e: React.MouseEvent) => void;
  overlayColor?: string;
  overlayOpacity?: number;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  resizing?: boolean;
  onContextMenuTap?: (e: React.MouseEvent) => void;
}) {
  const barH = Math.max(0, (h - 20) * Math.min((utilPct || 0) / 100, 1));
  const handleMouseDown = isEditMode ? (e: React.MouseEvent) => {
    if (e.button === 0) onLeftDrag?.(e);
    else if (e.button === 2) onRightDrag?.(e);
  } : undefined;
  const handleContextMenu = isEditMode ? (e: React.MouseEvent) => { e.preventDefault(); onContextMenuTap?.(e); } : undefined;
  return (
    <g
      style={{ cursor: isEditMode ? "nwse-resize" : "pointer" }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <rect x={x} y={y} width={w} height={h} rx={3} fill={`url(#${gradId})`} stroke={accent} strokeOpacity={0.5} strokeWidth={1.2} />
      {overlayColor && (
        <rect x={x} y={y} width={w} height={h} rx={3} fill={overlayColor} fillOpacity={overlayOpacity ?? 0.3} />
      )}
      {!overlayColor && (
        <rect x={x + 2} y={y + h - 2 - barH} width={w - 4} height={barH} rx={1.5} fill={utilColor(utilPct || 0)} fillOpacity={0.3} />
      )}
      <text x={x + w / 2} y={y + 12} fill={overlayColor || accent} fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif" fillOpacity={0.9}>
        {label}
      </text>
      {servers !== undefined && servers > 0 && (
        <text x={x + w / 2} y={y + h - 6} fill="#9ca3af" fontSize="8" textAnchor="middle" fontFamily="system-ui, sans-serif">
          {servers}srv
        </text>
      )}
      {overlayColor && utilPct !== undefined && !overlayColor.startsWith("#22c5") && (
        <text x={x + w / 2} y={y + h / 2 + 4} fill="#ffffff" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif" fillOpacity={0.9}>
        </text>
      )}
      {isEditMode && (
        <>
          <rect x={x} y={y} width={w} height={h} rx={3} fill="transparent" stroke="#22d3ee" strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="4 2" />
          <rect x={x + w - 6} y={y + h - 6} width={8} height={8} rx={1} fill="#22d3ee" fillOpacity={0.4} stroke="#22d3ee" strokeOpacity={0.7} strokeWidth={0.8} style={{ cursor: "nwse-resize" }} />
          {resizing && (
            <text x={x + w + 6} y={y + h + 4} fill="#22d3ee" fillOpacity={0.7} fontSize="8" fontFamily="system-ui, sans-serif">
              {w}×{h}
            </text>
          )}
        </>
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

/* ─── Shared interior props ─── */
interface InteriorProps {
  rect: Rect;
  room?: RoomData;
  isEditMode?: boolean;
  getRackPos?: (id: string, dx: number, dy: number, rack?: RackData, rect?: Rect) => { x: number; y: number };
  getElemPos?: (elem: RoomElementData, rect: Rect) => { x: number; y: number };
  onDragStart?: (kind: "rack" | "element", id: string, x: number, y: number, w: number, h: number, r: Rect, e: React.MouseEvent, mode?: "move" | "resize") => void;
  overlay?: OverlayMode;
  nodeTemps?: Record<string, number>;
  onRackHover?: (e: React.MouseEvent, rack: RackData) => void;
  onRackLeave?: () => void;
  onDeleteElement?: (elemId: string) => void;
  elemMetaOverrides?: Record<string, Record<string, unknown>>;
  sizeOverrides?: Record<string, { w: number; h: number }>;
  resizeState?: { id: string; w: number; h: number } | null;
  addedElems?: RoomElementData[];
  removedIds?: Set<string>;
  onElementContextMenu?: (e: React.MouseEvent, elemId: string, elemType: string, meta: Record<string, unknown>, w: number, h: number) => void;
  onRackContextMenu?: (e: React.MouseEvent, rackId: string, w: number, h: number) => void;
}

/* ─── Compute overlay props for a rack ─── */
function overlayProps(rack: RackData, overlay?: OverlayMode, nodeTemps?: Record<string, number>): { overlayColor?: string; overlayOpacity?: number } {
  if (!overlay || overlay === "none") return {};
  if (overlay === "temp") {
    const avg = rackAvgTemp(rack, nodeTemps || {});
    if (avg === null) return {};
    return { overlayColor: tempColor(avg), overlayOpacity: tempOpacity(avg) };
  }
  // util overlay
  const pct = rackUtilPct(rack);
  return { overlayColor: utilColor(pct), overlayOpacity: 0.3 + Math.min(pct / 100, 1) * 0.25 };
}

/* ─── Lab-3 interior ─── */
function Lab3Interior({ rect, room, isEditMode, getRackPos, getElemPos, onDragStart, overlay, nodeTemps, onRackHover, onRackLeave, elemMetaOverrides, onDeleteElement, addedElems, removedIds, sizeOverrides, resizeState, onElementContextMenu, onRackContextMenu }: InteriorProps) {
  const defaultRw = 54;
  const defaultRh = 50;
  const gap = 8;
  const oy = rect.y + 80;

  const stats = room ? computeStats(room) : null;

  const displayOrder = [3, 2, 1, 0];

  const ox1 = rect.x + 30;

  const rackUtil = stats ? stats.utilPct : 0;
  const perRackServers = room ? Math.ceil((stats?.equipmentCount || 0) / Math.max(stats?.rackCount || 1, 1)) : undefined;

  return (
    <g>
      <FloorTiles x={rect.x} y={rect.y} w={rect.w} h={rect.h} accent="#8b5cf6" />

      {/* Primary rack column */}
      {displayOrder.map((rackIdx, row) => {
        const rack = room?.racks[rackIdx];
        if (!rack) return null;
        const rs = resizeState?.id === rack.id ? resizeState : null;
        const so = sizeOverrides?.[rack.id];
        const rw = rs?.w ?? so?.w ?? rack.width ?? defaultRw;
        const rh = rs?.h ?? so?.h ?? rack.height ?? defaultRh;
        const defaultX = ox1;
        const defaultY = oy + row * (defaultRh + gap);
        const pos = getRackPos?.(rack.id, defaultX, defaultY, rack, rect) ?? { x: defaultX, y: defaultY };
        const op = overlayProps(rack, overlay, nodeTemps);
        return (
          <RackIcon
            key={rack.id}
            x={pos.x} y={pos.y}
            w={rw} h={rh}
            label={rack.name || `Rack 3-${rackIdx + 1}`}
            accent="#a78bfa"
            gradId="grad-rack-purple"
            servers={perRackServers}
            utilPct={rackUtil}
            isEditMode={isEditMode}
            onLeftDrag={isEditMode ? (e) => onDragStart?.("rack", rack.id, pos.x, pos.y, rw, rh, rect, e, "resize") : undefined}
            onRightDrag={isEditMode ? (e) => onDragStart?.("rack", rack.id, pos.x, pos.y, rw, rh, rect, e, "move") : undefined}
            overlayColor={op.overlayColor}
            overlayOpacity={op.overlayOpacity}
            onMouseEnter={onRackHover ? (e) => onRackHover(e, rack) : undefined}
            onMouseLeave={onRackLeave}
            resizing={!!rs}
            onContextMenuTap={isEditMode ? (e) => onRackContextMenu?.(e, rack.id, rw, rh) : undefined}
          />
        );
      })}

      {/* Future expansion zones */}
      {[0, 1].map((col) => {
        const ox2 = rect.x + rect.w * 0.18;
        const ox3 = rect.x + rect.w * 0.36;
        return (
          <g key={`exp-${col}`}>
            {[0, 1, 2, 3].map((row) => {
              const ex = (col === 0 ? ox2 : ox3) + col * 30;
              return (
                <g key={row}>
                  <rect
                    x={ex} y={oy + row * (defaultRh + gap)}
                    width={defaultRw + 8} height={defaultRh} rx={3}
                    fill="#1e1b4b" fillOpacity={0.15}
                    stroke="#7c3aed" strokeOpacity={0.12} strokeWidth={0.8} strokeDasharray="4 3"
                  />
                  <text x={ex + (defaultRw + 8) / 2} y={oy + row * (defaultRh + gap) + defaultRh / 2 + 3} fill="#4c1d95" fillOpacity={0.4} fontSize="8" textAnchor="middle" fontFamily="system-ui, sans-serif">
                    RESERVED
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Infrastructure elements (DOOR rendered at building level) */}
      {(() => {
        const dbElems = (room?.elements || []).filter((e) => e.type !== "DOOR" && !removedIds?.has(e.id));
        const added = (addedElems || []).filter((e) => e.type !== "DOOR" && !removedIds?.has(e.id));
        const allElems = [...dbElems, ...added];
        if (allElems.length > 0 || (room?.elements && room.elements.length > 0)) {
          return allElems.map((elem) => {
            const pos = getElemPos?.(elem, rect) ?? { x: rect.x + elem.positionX, y: rect.y + elem.positionY };
            return <ElementIcon key={elem.id} elem={elem} pos={pos} rect={rect} isEditMode={isEditMode} onDragStart={onDragStart} onDelete={isEditMode ? onDeleteElement : undefined} elemMetaOverrides={elemMetaOverrides} sizeOverrides={sizeOverrides} resizeState={resizeState} onElementContextMenu={onElementContextMenu} />;
          });
        }
        return null;
      })()}
      {!(room?.elements && room.elements.length > 0) && (
        <>
          {(() => { const ox4 = rect.x + rect.w * 0.50; return (
            <>
              <g><rect x={ox4 + 140} y={oy} width={90} height={40} rx={4} fill="#1a1a2e" stroke="#6366f1" strokeOpacity={0.3} strokeWidth={1} /><text x={ox4 + 185} y={oy + 16} fill="#818cf8" fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif">NET SWITCH</text><text x={ox4 + 185} y={oy + 30} fill="#4f46e5" fontSize="8" textAnchor="middle" fontFamily="system-ui, sans-serif">ToR / Spine</text></g>
              <g><rect x={ox4 + 140} y={oy + 52} width={100} height={36} rx={4} fill="#0a1628" stroke="#22c55e" strokeOpacity={0.4} strokeWidth={1} /><circle cx={ox4 + 154} cy={oy + 70} r={4} fill="#22c55e" fillOpacity={0.6} /><text x={ox4 + 166} y={oy + 66} fill="#4ade80" fontSize="9" fontWeight="600" fontFamily="system-ui, sans-serif">K8s Master</text><text x={ox4 + 166} y={oy + 78} fill="#166534" fontSize="7" fontFamily="system-ui, sans-serif">master-lab3</text></g>
              <CoolingUnit x={rect.x + rect.w * 0.55} y={rect.y + rect.h - 52} />
              <CoolingUnit x={rect.x + rect.w * 0.55 + 90} y={rect.y + rect.h - 52} />
              <CoolingUnit x={rect.x + rect.w * 0.55 + 180} y={rect.y + rect.h - 52} />
              {[0, 1, 2].map((i) => { const cx = rect.x + rect.w * 0.55 + 36 + i * 90; const top = rect.y + rect.h - 54; return (<g key={`af-${i}`}><AirflowStream cx={cx - 14} startY={top} direction="up" /><AirflowStream cx={cx} startY={top} direction="up" /><AirflowStream cx={cx + 14} startY={top} direction="up" /></g>); })}
              <rect x={rect.x + rect.w - 60} y={rect.y + rect.h - 52} width={44} height={34} rx={3} fill="#1a0a0a" stroke="#f59e0b" strokeOpacity={0.3} strokeWidth={0.8} />
              <text x={rect.x + rect.w - 38} y={rect.y + rect.h - 37} fill="#f59e0b" fillOpacity={0.6} fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif">PDU</text>
              <text x={rect.x + rect.w - 38} y={rect.y + rect.h - 25} fill="#92400e" fontSize="7" textAnchor="middle" fontFamily="system-ui, sans-serif">3-Phase</text>
            </>
          ); })()}
        </>
      )}
    </g>
  );
}

/* ─── Lab-2 interior (empty room) ─── */
function Lab2Interior({ rect }: { rect: { x: number; y: number; w: number; h: number } }) {
  return (
    <g>
      <FloorTiles x={rect.x} y={rect.y} w={rect.w} h={rect.h} accent="#10b981" />
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
function Lab1Interior({ rect, room, isEditMode, getRackPos, getElemPos, onDragStart, overlay, nodeTemps, onRackHover, onRackLeave, elemMetaOverrides, onDeleteElement, addedElems, removedIds, sizeOverrides, resizeState, onElementContextMenu, onRackContextMenu }: InteriorProps) {
  const defaultRw = 52;
  const defaultRh = 46;
  const gap = 6;
  const ox = rect.x + rect.w - defaultRw - 40;
  const oy = rect.y + 72;

  const stats = room ? computeStats(room) : null;

  const rackUtil = stats ? stats.utilPct : 0;
  const perRackServers = room ? Math.ceil((stats?.equipmentCount || 0) / Math.max(stats?.rackCount || 1, 1)) : undefined;

  return (
    <g>
      <FloorTiles x={rect.x} y={rect.y} w={rect.w} h={rect.h} accent="#3b82f6" />

      {/* Cooling unit + airflow — only when no DB elements */}
      {!(room?.elements && room.elements.length > 0) && (
        <>
          <CoolingUnit x={ox - 10} y={rect.y + 36} />
          <AirflowStream cx={ox + 12} startY={rect.y + 34} direction="up" length={30} />
          <AirflowStream cx={ox + 26} startY={rect.y + 34} direction="up" length={30} />
          <AirflowStream cx={ox + 40} startY={rect.y + 34} direction="up" length={30} />
        </>
      )}

      {/* Main racks */}
      {[0, 1, 2, 3].map((rackIdx) => {
        const rack = room?.racks[rackIdx];
        if (!rack) return null;
        const rs = resizeState?.id === rack.id ? resizeState : null;
        const so = sizeOverrides?.[rack.id];
        const rw = rs?.w ?? so?.w ?? rack.width ?? defaultRw;
        const rh = rs?.h ?? so?.h ?? rack.height ?? defaultRh;
        const defaultX = ox;
        const defaultY = oy + rackIdx * (defaultRh + gap);
        const pos = getRackPos?.(rack.id, defaultX, defaultY, rack, rect) ?? { x: defaultX, y: defaultY };
        const op = overlayProps(rack, overlay, nodeTemps);
        return (
          <RackIcon
            key={rack.id}
            x={pos.x} y={pos.y}
            w={rw} h={rh}
            label={rack.name || `Rack 1-${rackIdx + 1}`}
            accent="#60a5fa"
            gradId="grad-rack-blue"
            servers={perRackServers}
            utilPct={rackUtil}
            isEditMode={isEditMode}
            onLeftDrag={isEditMode ? (e) => onDragStart?.("rack", rack.id, pos.x, pos.y, rw, rh, rect, e, "resize") : undefined}
            onRightDrag={isEditMode ? (e) => onDragStart?.("rack", rack.id, pos.x, pos.y, rw, rh, rect, e, "move") : undefined}
            overlayColor={op.overlayColor}
            overlayOpacity={op.overlayOpacity}
            onMouseEnter={onRackHover ? (e) => onRackHover(e, rack) : undefined}
            onMouseLeave={onRackLeave}
            resizing={!!rs}
            onContextMenuTap={isEditMode ? (e) => onRackContextMenu?.(e, rack.id, rw, rh) : undefined}
          />
        );
      })}

      {/* Infrastructure elements (DOOR rendered at building level) */}
      {(() => {
        const dbElems = (room?.elements || []).filter((e) => e.type !== "DOOR" && !removedIds?.has(e.id));
        const added = (addedElems || []).filter((e) => e.type !== "DOOR" && !removedIds?.has(e.id));
        const allElems = [...dbElems, ...added];
        if (allElems.length > 0 || (room?.elements && room.elements.length > 0)) {
          return allElems.map((elem) => {
            const pos = getElemPos?.(elem, rect) ?? { x: rect.x + elem.positionX, y: rect.y + elem.positionY };
            return <ElementIcon key={elem.id} elem={elem} pos={pos} rect={rect} isEditMode={isEditMode} onDragStart={onDragStart} onDelete={isEditMode ? onDeleteElement : undefined} elemMetaOverrides={elemMetaOverrides} sizeOverrides={sizeOverrides} resizeState={resizeState} onElementContextMenu={onElementContextMenu} />;
          });
        }
        return null;
      })()}
      {!(room?.elements && room.elements.length > 0) && (
        <>
          <g><rect x={rect.x + 30} y={oy} width={90} height={40} rx={4} fill="#0c1929" stroke="#3b82f6" strokeOpacity={0.3} strokeWidth={1} /><text x={rect.x + 75} y={oy + 16} fill="#60a5fa" fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif">NET SWITCH</text><text x={rect.x + 75} y={oy + 30} fill="#1d4ed8" fontSize="8" textAnchor="middle" fontFamily="system-ui, sans-serif">ToR / Spine</text></g>
          <rect x={rect.x + 30} y={oy + 60} width={44} height={34} rx={3} fill="#1a0a0a" stroke="#f59e0b" strokeOpacity={0.3} strokeWidth={0.8} />
          <text x={rect.x + 52} y={oy + 75} fill="#f59e0b" fillOpacity={0.6} fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif">PDU</text>
          <text x={rect.x + 52} y={oy + 87} fill="#92400e" fontSize="7" textAnchor="middle" fontFamily="system-ui, sans-serif">3-Phase</text>
          <g><rect x={rect.x + 30} y={oy + 120} width={100} height={36} rx={4} fill="#0a1628" stroke="#22c55e" strokeOpacity={0.4} strokeWidth={1} /><circle cx={rect.x + 44} cy={oy + 138} r={4} fill="#22c55e" fillOpacity={0.6} /><text x={rect.x + 56} y={oy + 134} fill="#4ade80" fontSize="9" fontWeight="600" fontFamily="system-ui, sans-serif">K8s Master</text><text x={rect.x + 56} y={oy + 146} fill="#166534" fontSize="7" fontFamily="system-ui, sans-serif">k8-master (DCIM)</text></g>
        </>
      )}
    </g>
  );
}

/* ─── Room block ─── */
function RoomBlock({
  rect, room, label, accent, gradient, glowFilter, hasServers, onClick, t,
  isEditMode, onRoomDragStart,
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
  isEditMode?: boolean;
  onRoomDragStart?: (roomId: string, rect: Rect, e: React.MouseEvent, mode: "move" | "resize") => void;
}) {
  const stats = room ? computeStats(room) : null;
  const isClickable = !!room && !isEditMode;
  const HANDLE = 10;

  return (
    <g
      onClick={isClickable ? onClick : undefined}
      className={cn(isClickable && "cursor-pointer")}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {/* Room background */}
      <rect
        x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={6}
        fill={gradient} stroke={accent}
        strokeOpacity={hasServers ? 0.4 : 0.3}
        strokeWidth={isEditMode ? 2 : 1.5}
        strokeDasharray={isEditMode ? "6 3" : undefined}
        onMouseDown={isEditMode && room ? (e) => {
          if (e.button === 2) onRoomDragStart?.(room.id, rect, e, "move");
        } : undefined}
        onContextMenu={isEditMode ? (e) => e.preventDefault() : undefined}
      />

      {/* Hover overlay */}
      {isClickable && (
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={6} fill={accent} fillOpacity={0} className="transition-all duration-200 hover:fill-opacity-[0.06]" />
      )}

      {/* Resize handle (bottom-right corner) — edit mode only */}
      {isEditMode && room && (
        <g>
          <rect
            x={rect.x + rect.w - HANDLE} y={rect.y + rect.h - HANDLE}
            width={HANDLE} height={HANDLE}
            fill={accent} fillOpacity={0.6} rx={2}
            className="cursor-nwse-resize"
            onMouseDown={(e) => { if (e.button === 0) onRoomDragStart?.(room.id, rect, e, "resize"); }}
          />
          <line x1={rect.x + rect.w - 7} y1={rect.y + rect.h - 2} x2={rect.x + rect.w - 2} y2={rect.y + rect.h - 7} stroke="white" strokeWidth={1} strokeOpacity={0.7} />
          <line x1={rect.x + rect.w - 4} y1={rect.y + rect.h - 2} x2={rect.x + rect.w - 2} y2={rect.y + rect.h - 4} stroke="white" strokeWidth={1} strokeOpacity={0.7} />
        </g>
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

/* ─── Element icon (DB-driven infrastructure elements) ─── */
function ElementIcon({ elem, pos, rect, isEditMode, onDragStart, onDelete, elemMetaOverrides, sizeOverrides, resizeState, onElementContextMenu }: {
  elem: RoomElementData;
  pos: { x: number; y: number };
  rect: Rect;
  isEditMode?: boolean;
  onDragStart?: (kind: "element", id: string, x: number, y: number, w: number, h: number, r: Rect, e: React.MouseEvent, mode?: "move" | "resize") => void;
  onDelete?: (elemId: string) => void;
  elemMetaOverrides?: Record<string, Record<string, unknown>>;
  sizeOverrides?: Record<string, { w: number; h: number }>;
  resizeState?: { id: string; w: number; h: number } | null;
  onElementContextMenu?: (e: React.MouseEvent, elemId: string, elemType: string, meta: Record<string, unknown>, w: number, h: number) => void;
}) {
  const rs = resizeState?.id === elem.id ? resizeState : null;
  const so = sizeOverrides?.[elem.id];
  const baseW = elem.width || (elem.type === "DOOR" ? 40 : 72);
  const baseH = elem.height || (elem.type === "DOOR" ? 4 : 32);
  const w = rs?.w ?? so?.w ?? baseW;
  const h = rs?.h ?? so?.h ?? baseH;
  const overriddenMeta = elemMetaOverrides?.[elem.id];
  const meta = (overriddenMeta || elem.metadata || {}) as Record<string, string | number>;

  const handleMouseDown = isEditMode ? (e: React.MouseEvent) => {
    if (e.button === 0) {
      onDragStart?.("element", elem.id, pos.x, pos.y, w, h, rect, e, "resize");
    } else if (e.button === 2) {
      onDragStart?.("element", elem.id, pos.x, pos.y, w, h, rect, e, "move");
    }
  } : undefined;

  const elemContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onElementContextMenu?.(e, elem.id, elem.type, overriddenMeta || (elem.metadata as Record<string, unknown>) || {}, w, h);
  };

  const editOverlay = isEditMode && (
    <>
      <rect x={pos.x} y={pos.y} width={w} height={h} rx={3} fill="transparent" stroke="#22d3ee" strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="4 2" />
      {/* Resize handle (bottom-right corner) */}
      <rect x={pos.x + w - 6} y={pos.y + h - 6} width={8} height={8} rx={1} fill="#22d3ee" fillOpacity={0.4} stroke="#22d3ee" strokeOpacity={0.7} strokeWidth={0.8} style={{ cursor: "nwse-resize" }} />
      {onDelete && (
        <g style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onDelete(elem.id); }}>
          <circle cx={pos.x + w - 2} cy={pos.y - 2} r={7} fill="#7f1d1d" stroke="#ef4444" strokeWidth={1} />
          <text x={pos.x + w - 2} y={pos.y + 2} fill="#fca5a5" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">×</text>
        </g>
      )}
      {rs && (
        <text x={pos.x + w + 6} y={pos.y + h + 4} fill="#22d3ee" fillOpacity={0.7} fontSize="8" fontFamily="system-ui, sans-serif">
          {rs.w}×{rs.h}
        </text>
      )}
    </>
  );

  if (elem.type === "COOLING") {
    const dir = String(meta.airflowDirection || "up") as "up" | "down" | "left" | "right";
    const len = Number(meta.airflowLength) || 45;
    const isVert = dir === "up" || dir === "down";

    const airflows = isVert ? (
      <>
        <AirflowStream cx={pos.x + w * 0.25} startY={dir === "up" ? pos.y - 2 : pos.y + h + 2} direction={dir} length={len} />
        <AirflowStream cx={pos.x + w * 0.5} startY={dir === "up" ? pos.y - 2 : pos.y + h + 2} direction={dir} length={len} />
        <AirflowStream cx={pos.x + w * 0.75} startY={dir === "up" ? pos.y - 2 : pos.y + h + 2} direction={dir} length={len} />
      </>
    ) : (
      <>
        <AirflowStream cx={dir === "left" ? pos.x - 2 : pos.x + w + 2} startY={pos.y + h * 0.25} direction={dir} length={len} />
        <AirflowStream cx={dir === "left" ? pos.x - 2 : pos.x + w + 2} startY={pos.y + h * 0.5} direction={dir} length={len} />
        <AirflowStream cx={dir === "left" ? pos.x - 2 : pos.x + w + 2} startY={pos.y + h * 0.75} direction={dir} length={len} />
      </>
    );

    const dirLabel = { up: "↑", right: "→", down: "↓", left: "←" }[dir];
    return (
      <g style={{ cursor: isEditMode ? "nwse-resize" : undefined }} onMouseDown={handleMouseDown} onContextMenu={elemContextMenu}>
        <CoolingUnit x={pos.x} y={pos.y} w={w} h={h} />
        {airflows}
        {isEditMode && (
          <text x={pos.x + w / 2} y={pos.y - 6} fill="#22d3ee" fillOpacity={0.5} fontSize="7" textAnchor="middle" fontFamily="system-ui, sans-serif">
            L-drag: resize · R-drag: move · R-tap: {dirLabel} rotate
          </text>
        )}
        {editOverlay}
      </g>
    );
  }

  if (elem.type === "SWITCH") {
    return (
      <g style={{ cursor: isEditMode ? "nwse-resize" : undefined }} onMouseDown={handleMouseDown} onContextMenu={elemContextMenu}>
        <rect x={pos.x} y={pos.y} width={w} height={h} rx={4} fill="#1a1a2e" stroke="#6366f1" strokeOpacity={0.3} strokeWidth={1} />
        <text x={pos.x + w / 2} y={pos.y + 16} fill="#818cf8" fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif">{elem.name || "NET SWITCH"}</text>
        {meta.subLabel && <text x={pos.x + w / 2} y={pos.y + 30} fill="#4f46e5" fontSize="8" textAnchor="middle" fontFamily="system-ui, sans-serif">{String(meta.subLabel)}</text>}
        {editOverlay}
      </g>
    );
  }

  if (elem.type === "PDU") {
    return (
      <g style={{ cursor: isEditMode ? "nwse-resize" : undefined }} onMouseDown={handleMouseDown} onContextMenu={elemContextMenu}>
        <rect x={pos.x} y={pos.y} width={w} height={h} rx={3} fill="#1a0a0a" stroke="#f59e0b" strokeOpacity={0.3} strokeWidth={0.8} />
        <text x={pos.x + w / 2} y={pos.y + h * 0.42} fill="#f59e0b" fillOpacity={0.6} fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="system-ui, sans-serif">{elem.name || "PDU"}</text>
        {meta.subLabel && <text x={pos.x + w / 2} y={pos.y + h * 0.78} fill="#92400e" fontSize="7" textAnchor="middle" fontFamily="system-ui, sans-serif">{String(meta.subLabel)}</text>}
        {editOverlay}
      </g>
    );
  }

  if (elem.type === "MASTER_SERVER") {
    return (
      <g style={{ cursor: isEditMode ? "nwse-resize" : undefined }} onMouseDown={handleMouseDown} onContextMenu={elemContextMenu}>
        <rect x={pos.x} y={pos.y} width={w} height={h} rx={4} fill="#0a1628" stroke="#22c55e" strokeOpacity={0.4} strokeWidth={1} />
        <circle cx={pos.x + 14} cy={pos.y + h / 2} r={4} fill="#22c55e" fillOpacity={0.6} />
        <text x={pos.x + 26} y={pos.y + h * 0.42} fill="#4ade80" fontSize="9" fontWeight="600" fontFamily="system-ui, sans-serif">K8s Master</text>
        {meta.hostname && (
          <text x={pos.x + 26} y={pos.y + h * 0.78} fill="#166534" fontSize="7" fontFamily="system-ui, sans-serif">
            {String(meta.hostname)}{meta.role ? ` (${meta.role})` : ""}
          </text>
        )}
        {editOverlay}
      </g>
    );
  }

  if (elem.type === "DOOR") {
    const orientation = String(meta.orientation || "horizontal");
    const isH = orientation === "horizontal";
    const longSide = Math.max(w, h);
    const shortSide = Math.min(w, h, 6);
    const dw = isH ? longSide : shortSide;
    const dh = isH ? shortSide : longSide;
    const handleDoorMouseDown = isEditMode ? (e: React.MouseEvent) => {
      if (e.button === 0) {
        onDragStart?.("element", elem.id, pos.x, pos.y, dw, dh, rect, e, "resize");
      } else if (e.button === 2) {
        onDragStart?.("element", elem.id, pos.x, pos.y, dw, dh, rect, e, "move");
      }
    } : undefined;
    const arcRadius = Math.max(dw, dh) * 0.45;
    return (
      <g style={{ cursor: isEditMode ? "nwse-resize" : undefined }} onMouseDown={handleDoorMouseDown} onContextMenu={elemContextMenu}>
        <rect x={pos.x} y={pos.y} width={dw} height={dh} rx={2} fill="#78350f" stroke="#d97706" strokeOpacity={0.6} strokeWidth={0.8} />
        <rect x={pos.x + (isH ? 4 : 1)} y={pos.y + (isH ? 1 : 4)} width={isH ? dw - 8 : 2} height={isH ? 2 : dh - 8} rx={1} fill="#a16207" fillOpacity={0.7} />
        {isH ? (
          <path d={`M ${pos.x + 2} ${pos.y + dh} A ${arcRadius} ${arcRadius} 0 0 0 ${pos.x + dw - 2} ${pos.y + dh}`} fill="none" stroke="#d97706" strokeOpacity={0.3} strokeWidth={0.8} strokeDasharray="3 2" />
        ) : (
          <path d={`M ${pos.x + dw} ${pos.y + 2} A ${arcRadius} ${arcRadius} 0 0 1 ${pos.x + dw} ${pos.y + dh - 2}`} fill="none" stroke="#d97706" strokeOpacity={0.3} strokeWidth={0.8} strokeDasharray="3 2" />
        )}
        <circle cx={isH ? pos.x + dw * 0.7 : pos.x + dw / 2} cy={isH ? pos.y + dh / 2 : pos.y + dh * 0.3} r={1.5} fill="#fbbf24" fillOpacity={0.7} />
        <text x={isH ? pos.x + dw / 2 : pos.x + dw + 8} y={isH ? pos.y + dh + 12 : pos.y + dh / 2 + 3} fill="#d97706" fillOpacity={0.8} fontSize="8" fontWeight="600" textAnchor={isH ? "middle" : "start"} fontFamily="system-ui, sans-serif">
          {elem.name || "DOOR"}
        </text>
        {isEditMode && (
          <>
            <rect x={pos.x - 2} y={pos.y - 2} width={dw + 4} height={dh + 4} rx={3} fill="transparent" stroke="#22d3ee" strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="4 2" />
            <rect x={pos.x + dw - 4} y={pos.y + dh - 4} width={8} height={8} rx={1} fill="#22d3ee" fillOpacity={0.4} stroke="#22d3ee" strokeOpacity={0.7} strokeWidth={0.8} />
            {onDelete && (
              <g style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onDelete(elem.id); }}>
                <circle cx={pos.x + dw + 4} cy={pos.y - 4} r={7} fill="#7f1d1d" stroke="#ef4444" strokeWidth={1} />
                <text x={pos.x + dw + 4} y={pos.y} fill="#fca5a5" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">×</text>
              </g>
            )}
            <text x={pos.x + dw / 2} y={pos.y + (isH ? 24 : dh + 14)} fill="#22d3ee" fillOpacity={0.5} fontSize="7" textAnchor="middle" fontFamily="system-ui, sans-serif">
              L: resize · R: move/rotate
            </text>
            {rs && (
              <text x={pos.x + dw + 12} y={pos.y + dh + 4} fill="#22d3ee" fillOpacity={0.7} fontSize="8" fontFamily="system-ui, sans-serif">
                {rs.w}×{rs.h}
              </text>
            )}
          </>
        )}
      </g>
    );
  }

  return null;
}

/* ─── Animated cooling airflow ─── */
function AirflowStream({ cx, startY, direction, length = 45 }: {
  cx: number; startY: number; direction: "up" | "down" | "left" | "right"; length?: number;
}) {
  const isVert = direction === "up" || direction === "down";
  return (
    <g>
      {[0, 1, 2].map((i) => {
        const delay = `${i * 0.7}s`;
        let d: string;
        let translateTo: string;
        if (direction === "up") {
          d = `M${cx - 4},${startY + 5} L${cx},${startY} L${cx + 4},${startY + 5}`;
          translateTo = `0 ${-length}`;
        } else if (direction === "down") {
          d = `M${cx - 4},${startY - 5} L${cx},${startY} L${cx + 4},${startY - 5}`;
          translateTo = `0 ${length}`;
        } else if (direction === "left") {
          d = `M${cx + 5},${startY - 4} L${cx},${startY} L${cx + 5},${startY + 4}`;
          translateTo = `${-length} 0`;
        } else {
          d = `M${cx - 5},${startY - 4} L${cx},${startY} L${cx - 5},${startY + 4}`;
          translateTo = `${length} 0`;
        }
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
            <animateTransform attributeName="transform" type="translate" from="0 0" to={translateTo} dur="2.1s" begin={delay} repeatCount="indefinite" />
          </path>
        );
      })}
    </g>
  );
}
