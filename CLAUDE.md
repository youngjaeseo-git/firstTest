# DCIM Management System

## Project Overview

기존 Grafana 기반의 서버 모니터링(온도, PCIe bandwidth, 전력 등)을 대체하는
전문적인 DCIM(Data Center Infrastructure Management) 웹 애플리케이션.

데이터센터 수준의 인프라 관리, Observability, 자산 관리를 통합 제공한다.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **UI Components**: shadcn/ui (Radix 기반)
- **Charts/Visualization**: Recharts + D3.js (랙 다이어그램)
- **State Management**: Zustand
- **Backend**: Next.js API Routes + Prisma ORM
- **Database**: PostgreSQL (자산/설정), Prometheus (시계열 메트릭)
- **Real-time**: WebSocket (Socket.io) for live metric updates
- **Auth**: NextAuth.js
- **Testing**: Vitest + Playwright (E2E)
- **Linting**: ESLint + Prettier

## Architecture Principles

- 모노레포 구조 (Next.js fullstack)
- Server Components 우선, 인터랙티브 부분만 Client Components
- API는 RESTful, 실시간 데이터는 WebSocket
- 모든 메트릭 데이터는 Prometheus에서 가져오고, 자산 데이터는 PostgreSQL
- 다국어 지원 (한국어/영어)

## Key Features

1. **Dashboard**: 전체 인프라 상태 요약 (서버 수, 알림, PUE, 온도 분포)
2. **Server Monitoring**: 개별 서버 상세 메트릭 (CPU, Memory, Disk, Network, 온도, PCIe)
3. **Rack View**: 물리적 랙 배치도 시각화 + 열지도(heatmap)
4. **Alert Management**: 알림 규칙 설정, 이력 조회, 에스컬레이션
5. **Asset Management**: 서버/네트워크 장비 CRUD, 라이프사이클 관리
6. **Capacity Planning**: 전력/공간/냉각 용량 현황 및 예측
7. **Reports**: 커스텀 리포트 생성, PDF 내보내기

## Commands

```bash
# Development
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server

# Testing
npm run test         # Unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright)

# Code Quality
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # TypeScript type check

# Database
npx prisma migrate dev   # Run migrations
npx prisma generate      # Generate Prisma client
npx prisma studio        # Open Prisma Studio
```

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Auth pages (login, register)
│   ├── (dashboard)/        # Main app layout
│   │   ├── page.tsx        # Dashboard overview
│   │   ├── servers/        # Server monitoring
│   │   ├── racks/          # Rack visualization
│   │   ├── alerts/         # Alert management
│   │   ├── assets/         # Asset management
│   │   ├── capacity/       # Capacity planning
│   │   └── reports/        # Reports
│   ├── api/                # API routes
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # shadcn/ui base components
│   ├── dashboard/          # Dashboard-specific components
│   ├── server/             # Server monitoring components
│   ├── rack/               # Rack visualization components
│   ├── alerts/             # Alert components
│   └── layout/             # Layout components (sidebar, header)
├── lib/
│   ├── db.ts               # Prisma client
│   ├── prometheus.ts       # Prometheus query client
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
