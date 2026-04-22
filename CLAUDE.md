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

## Data-First Development Rule

외부 시스템(Prometheus, BMC/Redfish, K8s API 등)과 연동하는 기능을 구현할 때는 반드시 **실제 데이터 구조를 먼저 확인**한 뒤 코드를 작성한다. 추측으로 코드를 짜지 않는다.

### 절차
1. **확인 스크립트 작성**: `check/` 폴더에 `YYYYMMDD-{내용}.sh` 형식으로 스크립트 생성
   - 예: `check/20260422-prometheus-labels.sh`
   - 스크립트는 서버에서 `bash check/파일명.sh > 결과파일.txt 2>&1` 한 줄로 실행 가능해야 함
2. **사용자에게 실행 요청**: 스크립트를 push하고 실행 결과를 요청
3. **결과 분석 후 구현**: 실제 응답 데이터의 라벨, 필드명, 값 형식을 확인한 뒤에만 코드 작성
4. **검증 범위 명시**: TypeScript/빌드 통과는 문법 검증일 뿐, 실제 데이터 연동 동작은 별도 확인 필요 → 사용자에게 명확히 전달

### 스크립트 작성 원칙
- 사용자가 결과를 **수동 타이핑**해야 하므로, 출력량을 최소화한다
- 중복 데이터 제거: 라벨 구조 확인은 1개 샘플이면 충분, 전체 목록 출력 금지
- 의미 있는 필드만 추출: `boot_id`, `machine_id`, `system_uuid` 등 식별값은 생략 가능
- 개수/존재 여부만 확인할 수 있으면 상세 데이터는 출력하지 않는다

### 적용 대상
- Prometheus 메트릭 쿼리 (라벨 구조, instance 형식)
- BMC/Redfish API 응답 구조
- Kubernetes API 호출
- 기타 외부 데이터 소스 연동

### 확인된 Prometheus 환경 (2026-04-22 기준)

**Instance 형식:**
- 대부분의 job은 **호스트네임**을 instance로 사용 (예: `s131x13ae010`)
- `QRA-SMC-DDR5-Dell` 등 일부 job만 **IP:port** 사용 (예: `110.80.103.100:9200`)

**서버 다양성:**
- CPU: Intel (SRF, SPR, GNR, EMR), AMD (Turin), ARM (Ampere) 등 혼재
- 제조사: SMC(Supermicro), Dell 등 혼재
- 조직: 자체 서버 외에 다른 조직 서버도 포함 (정확한 정보 없을 수 있음)
- 워크로드 라벨: `stress: "stress"` = stressapptest 메모리 에러 검증용

**주요 Job 목록 (305 타겟):**
- `kubernetes-cadvisor` (up:18, down:23) — container_cpu_*, machine_memory_bytes
- `kubernetes-nodes` (up:18, down:23) — 노드 정보
- `QRA-SMC-DDR5-Dell` (up:136) — Package_Joules_Consumed (IP:port)
- `QRA-SMC-DDR5-PCM` (up:49, down:1) — PCM 전력
- `QRA-SMC-EMR-PCM` (down:40) — EMR 서버 PCM
- `AE-SMC_GNRAP_PCM` (up:6, down:3) — GNR-AP PCM
- `AE-SMC_GNRSP_PCM` (up:5, down:10) — GNR-SP PCM
- `PCM` (up:10, down:31) — 기타 PCM
- `server-info` (down:41) — 서버 기본 정보 (모두 down)
- `temperature` (down:1)
- `kube-state-metrics` (up:1), `kubernetes-apiservers` (up:1), `kubernetes-service-endpoints` (up:4)

**메트릭별 instance 형식:**
- `machine_memory_bytes` → 호스트네임 (kubernetes-cadvisor job)
- `container_cpu_usage_seconds_total` → 호스트네임 (kubernetes-cadvisor job)
- `Package_Joules_Consumed` → IP:port (QRA-SMC-DDR5-Dell) 또는 호스트네임 (AE-SMC_* PCM)

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

## Developer Environment

개발자(프로젝트 오너)가 실제로 사용하는 장비와 작업 맥락. 명령어/설치 방법을
안내할 때 이 환경을 전제로 한다.

| 위치 | 장비 | 용도 | 비고 |
|------|------|------|------|
| 집 | **Mac mini M4 (기본형)** | **주 개발 환경** (코드 작성, 빌드, 테스트, git push) | macOS / Apple Silicon (arm64). `darwin` 기준으로 명령어 제시 |
| 회사 | Windows 10 PC | 사내망 업무용 | 보안 정책상 외부 도구 접근 제한. Claude 등 외부 AI 사용 불가 |
| 회사(개인) | iPad M4 13" 셀룰러 | 사내망 우회 보조 (개인 셀룰러 망으로 Claude 등 접근) | 사내 Wi‑Fi 미사용. 개인 소유, 회사 자산 아님 |

### 작업 방식 전제

- **코드 작성/테스트는 Mac mini**에서 수행 → GitHub로 push → 사내망 서버에서 pull
- **사내망은 airgapped** 에 가까움: 외부 npm registry, Docker Hub, GitHub 직접 접근 불가 가능성 있음
  → 오프라인 번들(`node_modules.tar.gz`, `docker save`)이나 사내 미러(Harbor, Nexus 등) 경유 방식을 기본으로 고려
- **회사 PC(Win10)에서는 Claude 세션을 열 수 없음** → 질문/코드 리뷰는 아이패드(셀룰러)로 진행
- 따라서 AI 지원이 필요한 작업은 **집(Mac) 또는 사무실의 아이패드**에서만 가능하다는 제약이 있음

### 명령어/안내 시 주의

- 경로 예시는 macOS(`/Users/<name>/...`) 또는 사내 Linux 서버(`/home/<user>/...`) 기준으로 제시. Win10 경로는 특별히 필요한 경우에만.
- `brew`, `~/.zshrc` 등은 Mac mini 전제
- 사내 Linux 서버 작업 시에는 `docs/runtime-install-guide-20260413.md`에 정리된 "사용자 홈 안에만 설치" 원칙을 따름
- 아이패드에서 확인해야 하는 결과물(예: 긴 로그, 스크린샷)은 복사·공유가 번거로우므로 **요점만 짧게 요약**해서 답변
