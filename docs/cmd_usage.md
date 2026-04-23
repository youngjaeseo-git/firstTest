# DCIM 프로젝트 명령어 및 참조 가이드

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

### 사내 서버 배포 (server-start.sh)

```bash
bash server-start.sh       # Docker DB 확인 + npm run dev (port 3000)
bash server-start.sh 8080  # 포트 지정
```

**코드 업데이트 후 반드시 서버 재시작 필요:**
```bash
kill $(lsof -t -i:3000)        # 기존 서버 중지
rm -rf .next                    # 빌드 캐시 삭제 (중요!)
bash server-start.sh            # 재시작
```
> `.next` 폴더를 삭제하지 않으면 이전 빌드 캐시가 사용되어 코드 변경이 반영되지 않을 수 있음

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
