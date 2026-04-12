# DCIM Architecture (rev1 - 2026-04-12)

현재까지 구현된 DCIM 시스템의 기술 스택과 호출 흐름 개요.

## 쉽게 풀어쓴 설명 (비개발자용)

이 시스템은 한마디로 **"데이터센터를 웹 브라우저로 관리하는 관제 콘솔"** 입니다.
기존에 Grafana로 따로따로 보던 서버 온도, 전력, 네트워크 지표를 한 화면에
모으고, 거기에 **"장비 대장"** 과 **"물리적 위치"** 까지 같이 보여주는 것이
목표예요.

전체 구조를 건물에 비유하면 이렇게 됩니다:

- **1층 — 브라우저 (사용자 화면)**
  사용자는 노트북/PC에서 웹 브라우저로 접속만 하면 됩니다. 별도 프로그램
  설치 불필요. 화면은 Next.js라는 도구로 만들었고, 대시보드·서버 목록·
  디지털 트윈(Room/Rack 3D 뷰)·알림·⌘K 검색 같은 페이지들이 있어요.

- **2층 — 앱 서버 (Next.js)**
  브라우저 요청을 받아서 "누가 로그인했는지", "이 사람이 이 작업을 해도
  되는지(권한)" 를 체크하고, 필요한 데이터를 DB나 외부 장비에서 가져와
  화면에 꽂아줍니다. 로그인 검증은 NextAuth라는 라이브러리가, DB 접근은
  Prisma라는 라이브러리가 대신해줘요.

- **3층 — 데이터 저장소와 외부 시스템 3군데**
  앱 서버는 3곳으로 말을 걸어요:

  1. **PostgreSQL (우리 DB)** — 장비 정보, 랙 위치, 사용자, 감사로그
     같은 "변하지 않는 자산 데이터"를 저장합니다. Docker로 띄워져 있어요.
  2. **Prometheus (메트릭 서버)** — CPU/메모리/온도 같은 "시시각각
     변하는 수치"는 여기서 가져옵니다. 이 시스템은 이미 사내망
     (10.144.38.100:30004)에 돌고 있어서, 우리는 읽기만 해요.
  3. **BMC 카드들 (iDRAC/iLO)** — 서버 본체와 별개로 박힌 작은
     관리용 칩입니다. 여기에 Redfish라는 표준 프로토콜로 "재부팅해줘"
     같은 명령을 보낼 수 있어요. 전원 제어는 전부 이 경로입니다.

### 주요 기능 동작 흐름 (3개만 예시)

1. **⌘K 눌러서 서버 검색** → 브라우저가 앱 서버의 `/api/search`에 물어봄
   → 앱 서버가 DB에서 서버/랙/알림을 한 번에 찾아서 돌려줌 → 결과를
   클릭하면 해당 페이지로 이동.

2. **"서버 재부팅" 버튼 누르기** → 호스트명 재입력 + 사유 입력하는
   2단계 확인창이 뜸 → 권한 체크 → 앱 서버가 BMC에게 Redfish 명령
   전송 → 성공/실패를 감사로그 테이블에 기록 (누가/언제/왜 눌렀는지
   다 남음) → 결과를 브라우저에 알림.

3. **대시보드에서 실시간 CPU 그래프 보기** → 브라우저가 앱 서버와
   "끊어지지 않는 연결(SSE)"을 하나 유지 → 앱 서버가 Prometheus에
   주기적으로 묻고 → 새 수치를 브라우저로 계속 밀어넣음 → 그래프가
   저절로 움직임.

### 보안상 알아둘 점

- BMC(장비의 재부팅 권한을 쥔 카드들)는 **아주 민감한 자원**입니다.
  이 앱 서버만 BMC에 접근할 수 있도록 사내 관리망에 격리되어야 해요.
- BMC 카드들은 자가서명 SSL 인증서를 쓰는 경우가 많아서, 앱 서버는
  이 인증서 검증을 **"딱 BMC 호출할 때만"** 느슨하게 풀어둡니다
  (전역 설정 아님).
- BMC 로그인 비밀번호는 지금은 `.env` 파일 하나로 함대(전체 서버) 공유
  방식이에요. 나중에 서버별로 따로 저장하도록 확장할 계획은 todo.md에
  적혀있습니다.

아래부터는 실제 개발자가 보는 상세 다이어그램과 호출 흐름입니다.

---

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
