# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │  Dashboard   │ │  Server View │ │  Digital Twin    │  │
│  │  (SSR+CSR)  │ │  (CSR+WS)   │ │  (SVG+React)     │  │
│  └─────────────┘ └──────────────┘ └──────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / WSS
┌──────────────────────▼──────────────────────────────────┐
│                  Next.js Application                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │              App Router (Pages)                    │   │
│  │  Server Components ←→ Client Components           │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │              API Routes (/api/*)                   │   │
│  │  REST endpoints + SSE (Server-Sent Events)        │   │
│  └─────────┬──────────────┬─────────────┬───────────┘   │
│            │              │             │                 │
│  ┌─────────▼────┐ ┌──────▼──────┐ ┌───▼────────────┐   │
│  │ Prisma ORM   │ │ Prom Client │ │ SSE Stream     │   │
│  └─────────┬────┘ └──────┬──────┘ └───┬────────────┘   │
└────────────┼─────────────┼─────────────┼────────────────┘
             │             │             │
    ┌────────▼───┐  ┌──────▼──────┐     │
    │ PostgreSQL │  │ Prometheus  │     │
    │ (Assets,   │  │ (External)  │     │
    │  Config,   │  │ 10.100.175. │     │
    │  Users)    │  │ 248:8080    │     │
    └────────────┘  └─────────────┘     │
                                        │
    ┌───────────────────────────────────┘
    │  Real-time metric push
    ▼
    Clients subscribed to server/rack channels
```

## Physical Hierarchy

```
DataCenter (1개)
├── Room "Server Room A"
│   ├── Rack A-01 (sortOrder=0, rowLabel="A")
│   │   ├── U1-U2: Server-001 (2U)
│   │   ├── U3: Switch-01 (1U)
│   │   └── U4-U42: ...
│   ├── Rack A-02 (sortOrder=1, rowLabel="A")
│   └── ...
├── Room "Server Room B"
│   ├── Rack B-01
│   └── ...
└── (PDU, UPS per rack)
```

## Key Design Decisions

### 1. Next.js Fullstack Monolith
- **Why**: 하나의 코드베이스로 프론트/백엔드 관리, Docker 배포 단순화
- **Trade-off**: 스케일링 시 분리 필요할 수 있음 → Phase 4에서 검토

### 2. Dual Database Strategy
- **PostgreSQL**: 자산, 사용자, 설정, 알림 규칙, DIMM/CPU 상세정보
- **Prometheus** (외부: `http://10.144.38.100:30004`): 시계열 메트릭
- **Why**: 각 DB의 강점을 활용, 기존 Prometheus 인프라 재사용

### 3. Self-Authentication (NextAuth.js)
- **Provider**: CredentialsProvider (이메일 + 비밀번호)
- **Strategy**: JWT (stateless, API route에서 검증 간편)
- **Why**: LDAP/SSO 불필요, 자체 인증으로 충분, 구현 단순

### 4. Room-based Hierarchy (Floor/Row 제거)
- **이전**: DataCenter → Floor → Row → Rack
- **현재**: DataCenter → Room → Rack (rowLabel로 그룹핑)
- **Why**: 사용자 환경이 1개 DC + 2개 Room 구조, 불필요한 계층 제거

### 5. Collapsible/Accordion UI Pattern
- **라이브러리**: Radix UI (Accordion + Collapsible)
- **적용 대상**: Memory Detail, Alert History, Equipment Detail, Dense 데이터 페이지
- **Why**: 정보 밀도가 높은 DCIM에서 사용자가 필요한 정보만 펼쳐서 확인

### 6. Digital Twin = SVG (not Canvas/WebGL)
- **기술**: React + SVG 직접 렌더링
- **Why**: DOM 기반이라 이벤트 처리 간편, 접근성 우수, 직사각형 레이아웃에 최적
- **구조**: 3-level drill-down (Room 선택 → 평면도 → Rack Elevation)

## Data Flow

### Auth Flow
```
User submits login form
  → POST /api/auth/callback/credentials
  → NextAuth validates email/password (bcrypt compare)
  → JWT token issued (includes role: admin/operator/viewer)
  → Middleware checks JWT on every /(dashboard) request
  → Unauthorized → redirect to /login
```

### Metric Query Flow
```
User opens server detail page
  → Server Component fetches initial data from Prometheus (PromQL)
  → Client Component mounts, subscribes to SSE stream (EventSource)
  → Backend periodically queries Prometheus, pushes to subscribed clients
  → Charts update in real-time
```

### Equipment Lifecycle Flow
```
Admin creates equipment
  → POST /api/equipment (validate: RBAC, Zod schema)
  → Prisma creates Equipment + EquipmentCpu[] + EquipmentMemory[]
  → Status: PLANNED → RECEIVING → INSTALLED → ACTIVE
  → Each transition: audit log entry, optional notification

Status transitions:
  ACTIVE → MAINTENANCE (정기 유지보수)
  ACTIVE → REPAIR (수리 의뢰)
  ACTIVE → FAILED (장애)
  REPAIR → ACTIVE (복귀)
  FAILED → REPAIR or DECOMMISSIONED
  DECOMMISSIONED → DISPOSED
```

### Prometheus Auto-Discovery Flow
```
Admin clicks "Sync Now" in Settings > Discovery
  → POST /api/discovery/sync
  → Fetch http://10.100.175.248:8080/api/v1/targets
  → Parse activeTargets (instance, job, labels, health)
  → Upsert into PrometheusTarget table
  → Admin maps unlinked targets to Equipment records
  → Linked targets: equipment.prometheusTarget = instance label
```

### Alert Flow
```
Cron scheduler calls /api/cron/alert-check (CRON_SECRET auth)
  → Engine loads active AlertRule records, queries Prometheus per rule (PromQL)
  → parseCondition/evaluateCondition compares series against thresholds
  → New breach → Alert stored in PostgreSQL (FIRING, severity, source, timestamp)
  → Alert History page: grouped by date (Accordion), filtered by category
  → Operator acknowledges alert → status FIRING → ACKNOWLEDGED
  → Condition clears (series present, below threshold) → status → RESOLVED
```

### Memory Detail Page Flow
```
User navigates to /infrastructure/[id]/memory
  → Server Component fetches Equipment with EquipmentMemory[] from Prisma
  → Groups DIMM slots by CPU socket
  → Renders MemorySummary (total slots, capacity, types)
  → Renders collapsible sections per CPU socket
  → Each section: DIMM slot table + visual slot diagram
  → Real-time memory utilization: Client Component queries Prometheus
```

## Digital Twin Architecture

```
/servers?view=twin

Level 1: Room Selector
┌──────────────┐ ┌──────────────┐
│ Server Room A│ │ Server Room B│
│  12 Racks    │ │  8 Racks     │
│  156 Servers │ │  98 Servers  │
└──────┬───────┘ └──────────────┘
       │ click
Level 2: Room Floor Plan (SVG)
┌──────▼──────────────────────┐
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐       │
│  │A1│ │A2│ │A3│ │A4│ Row A  │
│  └──┘ └──┘ └──┘ └──┘       │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐       │
│  │B1│ │B2│ │B3│ │B4│ Row B  │
│  └──┘ └──┘ └──┘ └──┘       │
│  (color = temperature)       │
└──────┬──────────────────────┘
       │ click rack
Level 3: Rack Elevation (SVG)
┌──────▼──────────────┐
│ U42 ░░░░░░░░░░░░░░░ │ empty
│ U41 ░░░░░░░░░░░░░░░ │ empty
│ U40 ████████████████ │ server-gpu-01 (4U)
│ U39 ████████████████ │
│ U38 ████████████████ │
│ U37 ████████████████ │
│ U36 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ server-app-05 (2U)
│ U35 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ...                  │
│ U1  ████████████████ │ switch-01 (1U)
└─────────────────────┘
 ██ active  ▓▓ warning  ░░ empty
```

## Security Model

```
┌──────────────┐
│   Request     │
└──────┬───────┘
       ▼
┌──────────────┐
│  NextAuth.js  │ ← JWT validation (CredentialsProvider)
│  Middleware    │ ← Protect /(dashboard) routes
└──────┬───────┘
       ▼
┌──────────────┐
│  RBAC Check   │ ← Role: admin / operator / viewer
│  (lib/rbac.ts)│
└──────┬───────┘
       ▼
┌──────────────┐
│  API Handler  │
└──────────────┘
```

### Role Permissions

| Action | Viewer | Operator | Admin |
|--------|--------|----------|-------|
| Dashboard / Monitoring | Read | Read | Read |
| Server Detail + Memory | Read | Read | Read |
| Alert 조회 | Read | Read | Read |
| Alert 승인 (Acknowledge) | - | Yes | Yes |
| 장비 등록/수정 | - | - | Yes |
| 장비 상태 변경 | - | Limited | Yes |
| 사용자 관리 | - | - | Yes |
| Prometheus 탐지 | - | - | Yes |
| 설정 변경 | - | - | Yes |

## Deployment Architecture

```
┌─────────── Docker Compose ────────────┐
│                                        │
│  ┌────────────┐    ┌────────────────┐  │
│  │  Next.js   │    │  PostgreSQL    │  │
│  │  App       │───▶│  16-alpine     │  │
│  │  :3000     │    │  :5432         │  │
│  └─────┬──────┘    └────────────────┘  │
│        │                                │
└────────┼────────────────────────────────┘
         │ HTTP
         ▼
┌────────────────┐
│  Prometheus    │ (외부, 기존 인프라)
│  10.144.38.100 │
│  :30004        │
└────────────────┘
```
