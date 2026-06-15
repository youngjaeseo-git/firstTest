# DCIM Management System

## Important Rules

- **명령어나 플레이스홀더에 꺽쇠 괄호(`<>`)를 절대 사용하지 않는다.** 실제 값을 넣거나, 설명으로 대체한다.

## 팀 토론 프로세스 (필수)

모든 작업(기능 구현, 버그 수정, 설계 결정, 인프라 변경 등)을 시작하기 전에 **팀A와 팀B 두 관점으로 분석**한다.

### 절차

1. **팀A 에이전트 생성**: 해당 작업에 대해 한 가지 접근 방식/관점을 조사하고 제안
2. **팀B 에이전트 생성**: 팀A와 다른 접근 방식/관점을 조사하고 제안 (반대 의견, 대안, 리스크 지적 등)
3. **종합 판단**: 두 팀의 결과를 비교하여 최선의 방안을 결정하고 사용자에게 보고
4. **실행**: 결정된 방안으로 구현 진행

### 원칙
- 팀A/팀B는 같은 문제를 **다른 각도**에서 본다 (찬성/반대, 방식A/방식B, 단순/복잡 등)
- 사소한 작업(오타 수정, 단순 파일 읽기 등)에는 적용하지 않는다 — 설계 판단이 필요한 작업에 적용
- 두 팀 모두 **구체적 근거**(코드, 문서, 데이터)를 기반으로 주장해야 한다

## 기능 제안·구현 전 중복 확인 (필수)

새 기능을 **제안하거나 구현하기 전에 반드시 기존 구현 여부를 먼저 확인**한다. 기억·대화 요약에 의존하지 않는다 (세션이 요약본으로 이어질 때 구현 현황이 누락될 수 있음).

### 절차

1. **`docs/features.md` 확인** — 이 문서가 구현 현황의 단일 권위(single source of truth). 기능 제안/구현 전 반드시 먼저 읽는다.
2. **코드 직접 확인** — `Grep`/`Glob`으로 관련 페이지(`src/app/(dashboard)/**/page.tsx`)·컴포넌트·API 라우트가 이미 있는지 확인.
3. **이미 있으면 재구현하지 않는다** — 검증·보강만 하고, 사용자에게 "이미 구현됨"을 명확히 알린다.
4. **features.md 갱신** — 새 기능을 구현하면 같은 커밋에서 features.md에 항목을 추가한다 (구현과 문서를 항상 동기화).

## 변경 영향 분석 (필수)

코드를 추가하거나 수정할 때마다 **영향 받는 모든 부분을 점검**한다. 기능이 많고 연관관계가 복잡하므로 한 곳 수정이 다른 곳을 깨뜨릴 수 있다.

### 점검 항목

1. **데이터 흐름 추적**: 변경한 API의 응답 구조가 바뀌면, 해당 API를 호출하는 **모든 프론트엔드 페이지와 컴포넌트**를 확인
2. **DB 스키마 의존**: Prisma 모델 변경 시 해당 모델을 사용하는 **모든 API 라우트 + 페이지**를 확인. 새 테이블 추가 시 테이블이 없어도 기존 기능이 동작하는지 확인 (try-catch 등)
3. **공유 컴포넌트**: `Card`, `Badge`, `PageHeader`, `StatusBadge` 등 공통 UI 수정 시 사용처 전수 확인
4. **import/export 체인**: 함수 시그니처, export 이름, 타입 변경 시 import하는 모든 파일 확인
5. **사이드바/네비게이션**: 메뉴 항목 추가/제거 시 해당 페이지 라우트 존재 여부, i18n 키 정합성 확인
6. **상태 관리**: zustand store나 컨텍스트 수정 시 구독하는 모든 컴포넌트 확인

### 절차

1. 수정 전: 변경 파일이 어디서 사용되는지 `Grep`으로 확인
2. 수정 후: 영향 범위 파일들을 읽어서 깨진 부분이 없는지 확인
3. `npm run verify` 실행 (typecheck + lint + test)
4. 영향 범위가 넓은 경우 (페이지 추가, 스키마 변경, 공통 컴포넌트 수정): `npm run verify:full` 실행
5. 보고 시 **점검한 영향 범위**를 명시

## 검증 루틴 (코드 작성 후 필수)

코드를 변경하면 작업 완료를 보고하기 전에 **반드시 전체 소스를 검증**한다. `tsc`와 단위 테스트만으로는 부족하다 — 이유와 절차는 아래와 같다.

### 왜 tsc/test 통과 후에도 런타임 에러가 나는가

- `npm run typecheck` (tsc): **타입/문법만** 검사. 런타임 동작은 모름.
- `npm run test:run` (vitest): 존재하는 단위 테스트 7개 파일(약 58개)만 실행. 새 기능·React 렌더링·DB·Prometheus 연동은 **커버하지 않음**.
- `npm run build` (next build): **컴파일 + Server/Client 경계 + import + RSC 직렬화**까지 검사 → tsc가 못 잡는 오류를 잡는다. 단, ISR 페이지(`/racks`, `/reports`)는 빌드 시 DB 프리렌더를 시도하므로 `DATABASE_URL`이 필요.
- 그래도 못 잡는 것: 실제 데이터 형식 불일치, DB 마이그레이션 누락(`prisma db push`), Prometheus 응답 구조 → 회사망 배포 후 별도 확인 필요(아래 "검증 범위 명시" 참조).

### 절차

1. `npm run verify` — typecheck + lint + test:run. **DB 없이 항상 실행 가능**. 매 작업 후 기본.
2. `npm run verify:full` — 위 + `next build`. **DATABASE_URL 필요**(회사 Docker 환경 또는 더미 값). 페이지/라우트 추가·구조 변경 시 실행.
3. 스키마 변경 시: 서버에서 `npx prisma db push` 안내.
4. 보고 시 "검증 통과 = 문법/빌드 통과"이며 **실제 데이터 연동은 회사망 확인 필요**임을 명시.

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

### ⚠️ 실행 환경 제약 (절대 잊지 말 것)
- **사용자의 실행 환경은 사내 폐쇄망(air-gapped)이다.**
- **파일 반출 불가**: 결과 파일을 외부로 복사하거나 git push로 전달하는 것이 **불가능**하다.
- **복사-붙여넣기 불가**: 화면 출력을 클립보드로 복사할 수 없다.
- **따라서 사용자는 화면에 출력된 결과를 눈으로 보고 직접 손으로 타이핑해서 전달한다.**
- 결론: "결과를 파일로 저장하고 push하세요"라는 방식은 **쓸 수 없다**. 오직 **화면 출력을 최소화**하는 것만이 사용자의 타이핑 부담을 줄이는 유일한 방법이다.

### 스크립트 작성 원칙
- 사용자가 결과를 **직접 손으로 타이핑**해야 하므로, **화면 출력량을 극단적으로 최소화**한다
- 한 줄로 압축 가능한 것은 한 줄로 (예: 테이블 목록을 콤마로 join)
- 중복 데이터 제거: 라벨 구조 확인은 1개 샘플이면 충분, 전체 목록 출력 금지
- 의미 있는 필드만 추출: `boot_id`, `machine_id`, `system_uuid` 등 식별값은 생략 가능
- 개수/존재 여부만 확인할 수 있으면 상세 데이터는 출력하지 않는다
- 긴 문자열(JSON, YAML 등)은 길이/키 이름만 보여주고 전체 값은 생략하거나 잘라서 표시

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
