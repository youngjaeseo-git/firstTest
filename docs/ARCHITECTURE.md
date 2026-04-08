# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │  Dashboard   │ │  Server View │ │   Rack Viewer    │  │
│  │  (SSR+CSR)  │ │  (CSR+WS)   │ │   (Canvas/SVG)   │  │
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
│  │  REST endpoints + WebSocket upgrade               │   │
│  └─────────┬──────────────┬─────────────┬───────────┘   │
│            │              │             │                 │
│  ┌─────────▼────┐ ┌──────▼──────┐ ┌───▼────────────┐   │
│  │ Prisma ORM   │ │ Prom Client │ │ WebSocket Srv  │   │
│  └─────────┬────┘ └──────┬──────┘ └───┬────────────┘   │
└────────────┼─────────────┼─────────────┼────────────────┘
             │             │             │
    ┌────────▼───┐  ┌──────▼──────┐     │
    │ PostgreSQL │  │ Prometheus  │     │
    │ (Assets,   │  │ (Time-      │     │
    │  Config,   │  │  series     │     │
    │  Users)    │  │  Metrics)   │     │
    └────────────┘  └─────────────┘     │
                                        │
    ┌───────────────────────────────────┘
    │  Real-time metric push
    ▼
    Clients subscribed to server/rack channels
```

## Key Design Decisions

### 1. Next.js Fullstack Monolith
- **Why**: 하나의 코드베이스로 프론트/백엔드 관리, 배포 단순화
- **Trade-off**: 스케일링 시 분리 필요할 수 있음 → Phase 4에서 검토

### 2. Dual Database Strategy
- **PostgreSQL**: 자산, 사용자, 설정, 알림 규칙 등 관계형 데이터
- **Prometheus**: 시계열 메트릭 (기존 인프라 활용)
- **Why**: 각 DB의 강점을 활용, 기존 Prometheus 인프라 재사용

### 3. Server Components + Client Components 하이브리드
- 목록/상세 페이지의 초기 데이터: Server Components (SEO, 빠른 초기 로드)
- 실시간 차트/메트릭: Client Components (WebSocket 구독)

### 4. WebSocket for Real-time
- 서버 상세 페이지에서 메트릭 실시간 스트리밍
- 알림 실시간 푸시
- 대시보드 위젯 자동 갱신

## Data Flow

### Metric Query Flow
```
User opens server detail page
  → Server Component fetches initial data from Prometheus (PromQL)
  → Client Component mounts, subscribes to WebSocket channel
  → Backend periodically queries Prometheus, pushes to subscribed clients
  → Charts update in real-time
```

### Asset Management Flow
```
User creates/updates asset
  → API Route validates input
  → Prisma writes to PostgreSQL
  → Audit log entry created
  → Response returned to client
  → UI optimistically updated via Zustand
```

### Alert Flow
```
Prometheus evaluates alert rules (Alertmanager)
  → Webhook fires to our API (/api/webhooks/alertmanager)
  → Alert stored in PostgreSQL
  → WebSocket pushes to connected clients
  → Notification sent via configured channels (Slack/Email)
```

## Security Model

```
┌──────────────┐
│   Request     │
└──────┬───────┘
       ▼
┌──────────────┐
│  NextAuth.js  │ ← JWT validation
│  Middleware    │ ← Route protection
└──────┬───────┘
       ▼
┌──────────────┐
│  RBAC Check   │ ← Role: admin / operator / viewer
└──────┬───────┘
       ▼
┌──────────────┐
│  API Handler  │
└──────────────┘
```

### Roles
| Role | Dashboard | Server Detail | Alerts | Assets | Settings |
|------|-----------|---------------|--------|--------|----------|
| Viewer | Read | Read | Read | Read | - |
| Operator | Read | Read | Read/Ack | Read | - |
| Admin | Read | Read | Full | Full | Full |
