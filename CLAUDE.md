# DCIM Management System

## Important Rules

- **명령어나 플레이스홀더에 꺽쇠 괄호(`<>`)를 절대 사용하지 않는다.** 실제 값을 넣거나, 설명으로 대체한다.

## Project Overview

기존 Grafana 기반의 서버 모니터링(온도, PCIe bandwidth, 전력 등)을 대체하는
전문적인 DCIM(Data Center Infrastructure Management) 웹 애플리케이션.

데이터센터 수준의 인프라 관리, Observability, 자산 관리를 통합 제공한다.

## Confirmed Decisions

- **인증 방식**: 자체 인증 (NextAuth.js CredentialsProvider + JWT)
- **배포 환경**: Docker (docker-compose: Next.js app + PostgreSQL)
- **서버 탐지**: Prometheus auto-discovery (`/api/v1/targets`)
- **DC 구조**: 1개 DataCenter + 2개 Room (DataCenter → Room → Rack → Equipment)
- **메모리 입력**: 수동 입력 (장비 등록/수정 시 DIMM 슬롯 정보 직접 입력)

## Infrastructure

→ **[docs/infrastructure.md](docs/infrastructure.md)** 참조 (Prometheus 접속 정보, Job/타겟 목록, hostname→IP 매핑 등)

**핵심 요약:**
- Prometheus ClusterIP: `http://10.100.175.248:8080`
- DCIM 앱: `http://10.144.38.100:3000`
- 쿼리 전략: node-exporter 우선, cAdvisor 폴백 (PromQL `or`)

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
1. **확인 스크립트 작성**: `check/targetExecCmd/YYYYMMDD.sh` 날짜별 파일에 명령어 추가
   - 같은 날짜 내 추가 확인 사항은 기존 파일에 항목 추가
   - 날짜가 바뀌면 새 파일 생성
   - 스크립트는 서버에서 `bash check/targetExecCmd/YYYYMMDD.sh` 한 줄로 실행 가능해야 함
   - 단발성이 아닌 범용 확인 스크립트는 `check/` 폴더에 `YYYYMMDD-{내용}.sh` 형식으로 별도 생성
2. **사용자에게 실행 요청**: 스크립트를 push하고 실행 결과를 요청
3. **결과를 파일로 저장**: `check/results/YYYYMMDD-항목.md`에 확인 결과를 영구 저장
   - 사용자가 수동 타이핑으로 전달하므로, 한 번 받은 데이터는 반드시 파일로 저장
   - 동일 데이터를 다시 요청하지 않는다 — 저장된 파일을 참조
   - 새로운 기능 구현 시 관련 결과 파일이 있는지 먼저 확인
4. **결과 분석 후 구현**: 실제 응답 데이터의 라벨, 필드명, 값 형식을 확인한 뒤에만 코드 작성
5. **검증 범위 명시**: TypeScript/빌드 통과는 문법 검증일 뿐, 실제 데이터 연동 동작은 별도 확인 필요 → 사용자에게 명확히 전달
6. **명령어를 직접 타이핑하라고 안내하지 않는다** — 항상 스크립트 파일로 만들어서 push

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

### Prometheus 쿼리 규칙 (요약)

- `id="/"` 사용 금지 — K8s cAdvisor에서 root cgroup이 존재하지 않음
- `container!=""` 사용 — 실제 컨테이너만 선택
- node-exporter: IP:port 형식 instance, cAdvisor: hostname 형식 instance
- 세부 Job/타겟 목록 → **[docs/infrastructure.md](docs/infrastructure.md)** 참조

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

## Commands / Directory / Conventions / Dev Environment

→ **[docs/cmd_usage.md](docs/cmd_usage.md)** 참조
