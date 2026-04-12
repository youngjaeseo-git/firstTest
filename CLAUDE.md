# DCIM Management System

## Project Overview

기존 Grafana 기반의 서버 모니터링(온도, PCIe bandwidth, 전력 등)을 대체하는
전문적인 DCIM(Data Center Infrastructure Management) 웹 애플리케이션.

데이터센터 수준의 인프라 관리, Observability, 자산 관리를 통합 제공한다.

## Confirmed Decisions

- **Prometheus URL**: `http://10.144.38.100:30004`
- **인증 방식**: 자체 인증 (NextAuth.js CredentialsProvider + JWT)
- **배포 환경**: Docker (docker-compose: Next.js app + PostgreSQL)
- **서버 탐지**: Prometheus auto-discovery (`/api/v1/targets`)
- **DC 구조**: 1개 DataCenter + 2개 Room (DataCenter → Room → Rack → Equipment)
- **메모리 입력**: 수동 입력 (장비 등록/수정 시 DIMM 슬롯 정보 직접 입력)

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **UI Components**: shadcn/ui (Radix 기반) + Accordion/Collapsible 패턴
- **Charts/Visualization**: Recharts + D3.js (랙 다이어그램) + SVG (Digital Twin)
- **State Management**: Zustand
- **Backend**: Next.js API Routes + Prisma ORM
- **Database**: PostgreSQL (자산/설정), Prometheus (시계열 메트릭)
- **Real-time**: WebSocket (Socket.io) for live metric updates
- **Auth**: NextAuth.js (CredentialsProvider, JWT strategy)
- **Deployment**: Docker (multi-stage build) + docker-compose
- **Testing**: Vitest + Playwright (E2E)
- **Linting**: ESLint + Prettier

## Architecture Principles

- 모노레포 구조 (Next.js fullstack)
- Server Components 우선, 인터랙티브 부분만 Client Components
- API는 RESTful, 실시간 데이터는 WebSocket
- 모든 메트릭 데이터는 Prometheus에서 가져오고, 자산 데이터는 PostgreSQL
- 물리 계층: DataCenter → Room → Rack → U Position
- 접기/펼치기 UI 패턴으로 정보 밀도 관리
- 다국어 지원 (한국어/영어)

## Key Features

1. **Dashboard**: 전체 인프라 상태 요약 (서버 수, 알림, PUE, 온도 분포)
2. **Server Monitoring**: 개별 서버 상세 메트릭 (CPU, Memory, Disk, Network, 온도, PCIe)
3. **Memory Detail Page** (HIGH PRIORITY): DIMM 슬롯별 상세 정보, 제조사, 타입, 속도, 채널 다이어그램
4. **Infrastructure Management**: 장비 CRUD, 라이프사이클 관리 (등록→운영→수리→퇴역→폐기)
5. **Digital Twin View**: Room → Rack → Equipment 물리적 탐색 뷰 (SVG 기반)
6. **Rack View**: 물리적 랙 배치도 시각화 + 열지도(heatmap)
7. **Alert Management**: 알림 규칙 설정, 날짜별 접기/카테고리 필터, 이력 조회
8. **Capacity Planning**: 전력/공간/냉각 용량 현황 및 예측
9. **Reports**: 커스텀 리포트 생성, PDF 내보내기

## Commands

### Quick Start (권장)

```bash
./dev.sh   # git pull → npm install → Docker DB 확인 → 개발 서버 시작 (http://localhost:3001)
```

`dev.sh`는 코드 수정 후 테스트할 때 한 번에 실행하기 위한 스크립트다.
수행 단계:
1. `git pull origin <current-branch>`로 최신 코드 동기화
2. `npm install`로 새 패키지 반영
3. Docker 데몬 확인 + PostgreSQL 컨테이너 healthy 체크 (필요 시 자동 시작)
4. `npm run dev -- -p 3001`로 개발 서버 실행

수동으로 각 단계를 실행할 때만 아래 개별 명령들을 사용한다.

### Manual Commands

```bash
# Development
npm run dev          # Start dev server (localhost:3000)
npm run dev -- -p 3001  # 포트 지정해서 시작 (로컬 테스트 기본값)
npm run build        # Production build
npm run start        # Start production server

# Testing
npm run test          # Unit tests (Vitest, watch mode)
npx vitest run        # Unit tests (one-shot, for CI)
npm run test:e2e      # E2E tests (Playwright) - requires dev server running on :3001
npx playwright test --list  # List all E2E tests without running
npx playwright install      # Install browsers (first-time setup only)

# 테스트 파일 위치:
#   Vitest:     src/**/*.{test,spec}.{ts,tsx}  (컴포넌트/유틸/API 라우트 옆에 배치)
#   Playwright: tests/e2e/**/*.spec.ts          (로그인/내비게이션 등 통합 플로우)

# Code Quality
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # TypeScript type check

# Database
npx prisma migrate dev   # Run migrations
npx prisma generate      # Generate Prisma client
npx prisma studio        # Open Prisma Studio
npx prisma validate      # Validate schema

# Docker
docker compose up -d     # Start all services
docker compose build     # Build images
docker compose down      # Stop all services
```

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Auth pages (login)
│   │   └── login/page.tsx
│   ├── (dashboard)/        # Main app layout
│   │   ├── page.tsx        # Dashboard overview
│   │   ├── servers/        # Server monitoring (list + twin view)
│   │   ├── infrastructure/ # Equipment management
│   │   │   ├── page.tsx           # Equipment list
│   │   │   ├── new/page.tsx       # Add equipment
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Equipment detail
│   │   │       ├── memory/page.tsx # Memory detail (HIGH PRIORITY)
│   │   │       └── edit/page.tsx  # Edit equipment
│   │   ├── racks/          # Rack visualization
│   │   ├── alerts/         # Alert management
│   │   │   ├── page.tsx           # Active alerts
│   │   │   └── history/page.tsx   # Alert history (collapsible by date)
│   │   ├── capacity/       # Capacity planning
│   │   ├── reports/        # Reports
│   │   └── settings/       # Settings (admin)
│   │       ├── users/page.tsx     # User management
│   │       └── discovery/page.tsx # Prometheus discovery
│   ├── api/                # API routes
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── equipment/
│   │   ├── rooms/
│   │   ├── racks/
│   │   ├── alerts/
│   │   └── discovery/
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # shadcn/ui base (accordion, collapsible, button, card, badge, data-table)
│   ├── dashboard/          # Dashboard-specific components
│   ├── memory/             # Memory detail components (summary, dimm-table, channel-diagram)
│   ├── server/             # Server monitoring components
│   ├── twin/               # Digital twin components (room-layout, rack-elevation, equipment-popover)
│   ├── rack/               # Rack visualization components
│   ├── alerts/             # Alert components (history-group, filter-bar)
│   └── layout/             # Layout components (sidebar, header)
├── lib/
│   ├── auth.ts             # NextAuth configuration
│   ├── rbac.ts             # Role-based access control helpers
│   ├── db.ts               # Prisma client
│   ├── prometheus.ts       # Prometheus query client + auto-discovery
│   ├── discovery.ts        # Prometheus target sync logic
│   ├── websocket.ts        # WebSocket setup
│   └── utils.ts            # Utility functions
├── hooks/                  # Custom React hooks
├── stores/                 # Zustand stores
├── types/                  # TypeScript type definitions
└── styles/                 # Global styles
prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Seed data
```

## Coding Conventions

- 컴포넌트: PascalCase (e.g., `ServerDetail.tsx`)
- 유틸/훅: camelCase (e.g., `useServerMetrics.ts`)
- 타입: PascalCase with `interface` 우선 (e.g., `interface ServerInfo`)
- API 응답: camelCase JSON
- 커밋 메시지: Conventional Commits (feat:, fix:, docs:, etc.)
- 한 파일에 한 컴포넌트 원칙
- 접기/펼치기 UI: Radix Accordion/Collapsible 사용

## Data Model Hierarchy

```
DataCenter (1개)
├── Room (2개: e.g., "Server Room A", "Server Room B")
│   ├── Rack (여러 개, rowLabel로 그룹핑, sortOrder로 순서)
│   │   ├── Equipment (rackPosition: U위치, rackHeight: 높이)
│   │   │   ├── EquipmentCpu (소켓별 CPU 정보)
│   │   │   └── EquipmentMemory (슬롯별 DIMM 정보) ★ HIGH PRIORITY
│   │   └── PDU (전원 분배 장치)
│   └── ...
└── ...
```
