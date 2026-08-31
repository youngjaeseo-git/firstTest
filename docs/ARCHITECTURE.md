# Architecture Overview

> 이 문서가 시스템 구조(정적 아키텍처)의 단일 문서다. (구 `architecture.md` rev1을 이 문서로 통합)

## 쉽게 풀어쓴 설명 (비개발자용)

이 시스템은 한마디로 **"데이터센터를 웹 브라우저로 관리하는 관제 콘솔"** 입니다.
기존에 Grafana로 따로따로 보던 서버 온도, 전력, 네트워크 지표를 한 화면에
모으고, 거기에 **"장비 대장"** 과 **"물리적 위치"** 까지 같이 보여주는 것이 목표예요.

전체 구조를 건물에 비유하면 이렇게 됩니다:

- **1층 — 브라우저 (사용자 화면)**
  사용자는 노트북/PC에서 웹 브라우저로 접속만 하면 됩니다. 별도 프로그램
  설치 불필요. 화면은 Next.js로 만들었고, 대시보드·서버 목록·디지털 트윈(Room/Rack 뷰)·알림·⌘K 검색 같은 페이지들이 있어요.

- **2층 — 앱 서버 (Next.js)**
  브라우저 요청을 받아서 "누가 로그인했는지", "이 사람이 이 작업을 해도
  되는지(권한)" 를 체크하고, 필요한 데이터를 DB나 외부 장비에서 가져와
  화면에 꽂아줍니다. 로그인 검증은 NextAuth가, DB 접근은 Prisma가 대신해줘요.

- **3층 — 데이터 저장소와 외부 시스템 3군데**
  앱 서버는 3곳으로 말을 걸어요:

  1. **PostgreSQL (우리 DB)** — 장비 정보, 랙 위치, 사용자, 감사로그
     같은 "변하지 않는 자산 데이터"를 저장합니다. Docker로 띄워져 있어요.
  2. **Prometheus (메트릭 서버)** — CPU/메모리/온도 같은 "시시각각
     변하는 수치"는 여기서 가져옵니다. 이미 사내망 Prometheus
     (예: `10.100.175.248:8080`)에서 돌고 있어 우리는 읽기만 해요.
  3. **BMC 카드들 (iDRAC/iLO)** — 서버 본체와 별개로 박힌 작은
     관리용 칩입니다. 여기에 Redfish 표준 프로토콜로 "재부팅해줘"
     같은 명령을 보낼 수 있어요. 전원 제어는 전부 이 경로입니다.

### 주요 기능 동작 흐름 (3개 예시)

1. **⌘K 눌러서 서버 검색** → 브라우저가 앱 서버의 `/api/search`에 물어봄
   → 앱 서버가 DB에서 서버/랙/알림을 한 번에 찾아서 돌려줌 → 결과를 클릭하면 해당 페이지로 이동.

2. **"서버 재부팅" 버튼** → 호스트명 재입력 + 사유 입력 2단계 확인창 → 권한
   체크 → 앱 서버가 BMC에 Redfish 명령 전송 → 성공/실패를 감사로그에 기록
   (누가/언제/왜 눌렀는지 다 남음) → 결과를 브라우저에 알림.

3. **실시간 CPU 그래프** → 브라우저가 앱 서버와 "끊어지지 않는 연결(SSE)"을
   유지 → 앱 서버가 Prometheus에 주기적으로 묻고 → 새 수치를 브라우저로 계속 밀어넣음 → 그래프가 저절로 움직임.

### 보안상 알아둘 점

- BMC(재부팅 권한을 쥔 카드들)는 아주 민감한 자원입니다. 이 앱 서버만
  BMC에 접근하도록 사내 관리망에 격리되어야 해요.
- BMC 카드들은 자가서명 SSL 인증서를 쓰는 경우가 많아, 앱 서버는 이 검증을
  **"딱 BMC 호출할 때만"** 느슨하게 풀어둡니다(전역 설정 아님).
- BMC 로그인 비밀번호는 현재 `.env` 하나로 함대(전체 서버) 공유 방식이며,
  서버별 저장으로 확장하는 계획은 백로그에 있습니다.

아래부터는 개발자용 상세 다이어그램과 호출 흐름입니다.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │  Dashboard   │ │  Server View │ │  Digital Twin    │  │
│  │  (SSR+CSR)  │ │ (CSR+SSE)   │ │  (SVG+React)     │  │
│  └─────────────┘ └──────────────┘ └──────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS (REST + SSE)
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
- **Prometheus** (외부, 사내망: Lab-1 `http://10.100.175.248:8080`, Lab-3 `http://10.144.131.190:30003`): 시계열 메트릭. ※ `10.144.38.100:30004`는 Grafana이며 Prometheus 아님
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

> ⚠️ 실제 운영은 **하이브리드**다: 앱 = systemd 서비스(`dcim`, :3000), DB = Docker 컨테이너(`dcim-db`, 호스트 **:5433**, 볼륨 `firsttest_pgdata`). `docker compose up -d app` 금지. 상세: `project-handover.md §3-1`. 아래는 원 설계(참조).

```
┌─────────── 앱=systemd / DB=Docker (하이브리드) ────────────┐
│                                        │
│  ┌────────────┐    ┌────────────────┐  │
│  │  Next.js   │    │  PostgreSQL    │  │
│  │  systemd   │───▶│  16-alpine     │  │
│  │  :3000     │    │  Docker :5433  │  │
│  └─────┬──────┘    └────────────────┘  │
│        │                                │
└────────┼────────────────────────────────┘
         │ HTTP (읽기)
         ▼
┌────────────────────┐
│  Prometheus (외부)  │ (사내망, 기존 인프라)
│  10.100.175.248     │
│  :8080 (Lab-1)      │
└────────────────────┘
```
