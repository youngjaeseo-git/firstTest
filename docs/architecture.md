# DCIM Architecture (rev1 - 2026-04-12)

현재까지 구현된 DCIM 시스템의 기술 스택과 호출 흐름 개요.

## 구성 요소 및 호출 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Next.js Client)                        │
│                                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │  Dashboard  │  │ Server Detail│  │  Twin View  │  │ Cmd Palette  │  │
│  │  (RSC+SSE)  │  │  (Recharts)  │  │    (SVG)    │  │    (⌘K)      │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘  │
│         │                │                 │                │          │
│         │    NextAuth JWT Session (cookie)  │                │          │
│         └────────────────┼─────────────────┼────────────────┘          │
│                          │                 │                            │
└──────────────────────────┼─────────────────┼────────────────────────────┘
                           │ HTTPS           │
                           ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   NEXT.JS SERVER (App Router, Node 20)                  │
│                                                                         │
│   ┌──────────────────────┐          ┌────────────────────────────┐      │
│   │  Server Components   │          │     API Routes (REST)      │      │
│   │  (async data fetch)  │          │                            │      │
│   └──────────┬───────────┘          │  /api/search         ──┐   │      │
│              │                      │  /api/equipment      ──┤   │      │
│              │                      │  /api/equipment/[id]/ ─┤   │      │
│              │                      │        power           │   │      │
│              │                      │  /api/equipment/[id]/ ─┤   │      │
│              │                      │        history         │   │      │
│              │                      │  /api/alerts         ──┤   │      │
│              │                      │  /api/metrics/        ─┤   │      │
│              │                      │        dashboard (SSE) │   │      │
│              │                      │  /api/auth/[...next]   │   │      │
│              │                      └───────────┬────────────┘   │      │
│              │                                  │                │      │
│              │    ┌─────────────────────────────┴────┐           │      │
│              │    │                                  │           │      │
│              ▼    ▼                                  ▼           ▼      │
│   ┌──────────────────┐  ┌───────────────┐  ┌──────────────────┐         │
│   │  lib/db.ts       │  │ lib/redfish.ts│  │ lib/prometheus.ts│         │
│   │  (Prisma Client) │  │ (node:https)  │  │  (fetch 3s TO)   │         │
│   │                  │  │               │  │                  │         │
│   │ lib/audit.ts     │  │ lib/bmc-      │  │                  │         │
│   │ (logAudit)       │  │ credentials.ts│  │                  │         │
│   └────────┬─────────┘  └──────┬────────┘  └────────┬─────────┘         │
│            │                   │                    │                   │
└────────────┼───────────────────┼────────────────────┼───────────────────┘
             │                   │                    │
             │ TCP 5432          │ HTTPS (self-signed │ HTTP
             │                   │  cert OK)          │
             ▼                   ▼                    ▼
   ┌─────────────────┐  ┌────────────────┐  ┌─────────────────────┐
   │  PostgreSQL 16  │  │  BMC fleet     │  │  Prometheus         │
   │  (Docker)       │  │  (iDRAC/iLO/…) │  │  10.144.38.100      │
   │                 │  │                │  │       :30004        │
   │  - Equipment    │  │  /redfish/v1/  │  │                     │
   │  - Rack/Room    │  │   Systems      │  │  /api/v1/targets    │
   │  - AuditLog     │  │   /Actions/    │  │  /api/v1/query      │
   │  - Alert        │  │   Reset        │  │                     │
   │  - User         │  │                │  │  (auto-discovery)   │
   └─────────────────┘  └────────────────┘  └─────────────────────┘
```

## 주요 호출 패턴

### 1. 글로벌 검색 (⌘K)

```
User presses ⌘K
   │
   ▼
CommandPalette (client)
   │  debounce 300ms
   ▼
GET /api/search?q=xxx
   │
   ▼
Prisma parallel query ── Equipment / Room / Rack / Alert (FIRING)
   │
   ▼
{ servers, rooms, racks, alerts } (each ≤5)
   │
   ▼
Click result → router.push(href)
```

### 2. 원전 제어 (Redfish)

```
User clicks "GracefulRestart" on PowerConsoleCard
   │
   ▼
ConfirmModal (hostname 입력 + reason ≥3자)
   │
   ▼
POST /api/equipment/[id]/power
 body: { action, reason, ticketRef? }
   │
   ├─ RBAC check (canControlPower)
   ├─ Zod validate
   ├─ prisma.equipment.findUnique → bmcIpAddress
   ├─ getBmcCredentials(equipment) ← env
   │
   ▼
redfish.resetSystem()
   │  node:https, Basic Auth, rejectUnauthorized:false
   │  GET  /redfish/v1/Systems       (discoverSystemPath)
   │  POST {systemPath}/Actions/ComputerSystem.Reset
   │        { ResetType: "GracefulRestart" }
   │
   ▼
logAudit({action:"POWER_ACTION", changes:{resetType,success,error?}, reason, ticketRef})
   │
   ▼
response: { ok, error? }
```

### 3. 대시보드 실시간 메트릭

```
Dashboard page (RSC)
   │
   ▼
<DashboardMetricsStream /> (client)
   │
   ▼
EventSource /api/metrics/dashboard
   │
   ├─ Prometheus query (CPU, mem, temp, PCIe …)
   └─ emit SSE every N초
   │
   ▼
setState → Recharts re-render
```

### 4. Twin 뷰 탐색 (3단계 + 브레드크럼)

```
Level 1: Room 목록 (카드)
   └─ click → setSelectedRoom(id)
         │
         ▼
Level 2: RoomFloorPlan
   Breadcrumb: [Servers › RoomName]
   └─ click rack → setSelectedRack(id)
         │
         ▼
Level 3: RackElevation (SVG)
   Breadcrumb: [Servers › RoomName › RackName]
   └─ click equipment → /servers/[id] (라우팅)
```

## 기술 스택 요약

| 계층 | 기술 |
|------|------|
| **프레임워크** | Next.js 14 App Router, TypeScript |
| **UI** | Tailwind CSS, shadcn/ui (Radix), Framer Motion, Lucide icons |
| **차트** | Recharts, D3.js, SVG |
| **상태** | React state (+ Zustand 준비) |
| **데이터 페칭** | RSC async, fetch, EventSource (SSE) |
| **인증** | NextAuth.js (JWT strategy, CredentialsProvider) |
| **권한** | lib/rbac.ts (ADMIN / OPERATOR / VIEWER) |
| **ORM** | Prisma 5.15 |
| **DB** | PostgreSQL 16 (Docker) |
| **시계열** | Prometheus (외부) — `/api/v1/targets` 기반 자동 탐색 |
| **하드웨어 제어** | Redfish over HTTPS (node:https, 자가서명 인증서 허용) |
| **감사** | lib/audit.ts → `AuditLog` 테이블 (fire-and-forget) |
| **테스트** | Vitest (unit, 60 tests), Playwright (E2E 인프라만) |
| **배포** | Docker multi-stage + docker-compose |

## 보안 경계

```
  외부 인터넷  ┃ 사내망                       ┃ 관리망 (BMC)
 ─────────────┃──────────────────────────────┃─────────────────
              ┃                              ┃
              ┃  ┌─────────┐                 ┃
   (없음)      ┃  │ Next.js │                ┃
              ┃  │  App    │── Prisma ──────▶┃ (없음)
              ┃  └────┬────┘                 ┃
              ┃       │                      ┃
              ┃       ├── Prometheus HTTP ──▶┃
              ┃       │                      ┃
              ┃       └── Redfish HTTPS ─────▶ iDRAC/iLO
              ┃          (Basic Auth,        ┃
              ┃           self-signed OK)     ┃
              ┃                              ┃
```

- BMC는 관리망에 있고, 앱 서버만 접근 가능해야 함
- 자가서명 인증서는 redfish.ts에서 per-request로 허용 (`NODE_TLS_REJECT_UNAUTHORIZED=0`으로 글로벌 오염 안 함)
- BMC 자격증명은 현재 함대 공유 (`.env`), 추후 per-equipment 오버라이드 예정 (todo.md §4)
