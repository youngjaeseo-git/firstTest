# 테스트 현황 (DC Express — DCIM)

> 2026-07-02 기준. `src` 하위 실제 테스트 파일과 `package.json`, `playwright.config.ts`를 직접 읽어 작성. 추측 없이 파일 내용에 근거한다.
> 검증 루틴 자체는 `CLAUDE.md` "검증 루틴" 참조.

## 1. 요약 집계

| 항목 | 값 |
| --- | --- |
| 테스트 프레임워크 (단위) | Vitest `^1.6.0` |
| 테스트 프레임워크 (E2E) | Playwright `@playwright/test ^1.44.0` |
| 단위/통합 테스트 파일 수 (`src` 하위) | 8개 |
| 단위/통합 테스트 케이스 수 (`it` 총합) | 62개 |
| E2E 스펙 파일 수 (`tests/e2e`) | 1개 |
| E2E 테스트 케이스 수 | 6개 |
| React 컴포넌트/페이지 렌더링 테스트 | 0개 |

`@testing-library/react ^15.0.0`가 devDependency에 설치되어 있으나, 이를 사용하는 렌더링 테스트 파일은 존재하지 않는다.

### 실행 명령 (`package.json` scripts)

- `npm run test` → `vitest` (watch 모드)
- `npm run test:run` → `vitest run` (1회 실행, CI용)
- `npm run test:e2e` → `playwright test` (별도, `verify`에 미포함)
- `npm run verify` → `typecheck && lint && test:run` (DB 불필요)
- `npm run verify:full` → `verify && build` (DATABASE_URL 필요)

E2E는 `verify`/`verify:full` 어디에도 포함되지 않으며, `playwright.config.ts`상 `http://localhost:3001` 개발 서버가 사전 기동되어 있어야 한다.

## 2. 파일별 상세

### 2.1 `src/lib/utils.test.ts` — 25 케이스
- 대상: `src/lib/utils.ts`의 포매팅/유틸 함수 (`cn`, `formatBytes`, `formatBandwidth`, `formatPower`, `formatUptime`, `getSeverityColor`, `getTemperatureColor`).
- 핵심 검증: Tailwind 클래스 병합/충돌 제거(`px-2 px-4`→`px-4`), 바이트/대역폭/전력/업타임 단위 변환, 임계값별 색상 매핑(온도 85/70/50°C 경계).

### 2.2 `src/lib/audit.test.ts` — 6 케이스
- 대상: `src/lib/audit.ts`의 `logAudit`, `diffShallow` (Prisma 모킹).
- 핵심 검증: 완전한 입력을 `auditLog.create`에 전달, **Prisma reject 시에도 예외 미발생(감사 로그가 호출자를 절대 깨지 않음)**, `diffShallow`가 변경/추가/삭제 키만 from/to로 추출.

### 2.3 `src/lib/bmc-credentials.test.ts` — 5 케이스
- 대상: `getBmcCredentials`, `bmcCredentialsConfigured`, `MissingBmcCredentialsError`.
- 핵심 검증: `BMC_USERNAME`/`BMC_PASSWORD` 존재 시 자격증명 반환, 하나라도 없으면 `MissingBmcCredentialsError` throw.

### 2.4 `src/lib/prometheus-queries.test.ts` — 4 케이스
- 대상: `src/lib/prometheus.ts`의 `queries` 쿼리 빌더.
- 핵심 검증: IPv4 instance 매처의 점(.) 정규식 이스케이프(`10.144.38.1`이 교차 매칭되지 않음), 포트 접미사 매칭, `allNodesUp`의 job 오타 부재.

### 2.5 `src/lib/redfish.test.ts` — 5 케이스
- 대상: `pickFirstSystemPath`, `RedfishError`.
- 핵심 검증: Members 배열 첫 `@odata.id` 추출, Members 누락/빈 배열 시 null, status code 보존.

### 2.6 `src/lib/i18n/translations.test.ts` — 6 케이스
- 대상: `translate`, `translations`, `LANGUAGES`.
- 핵심 검증: en/ko 반환·한국어 누락 시 영어 폴백, **ko 키 집합 == en 키 집합(번역 누락 회귀 방지)**.

### 2.7 `src/app/api/metrics/dashboard/fetch-metrics.test.ts` — 3 케이스
- 대상: `fetchDashboardMetrics` (`instantQuery` 모킹) — 라우트가 사용하는 추출 로직.
- 핵심 검증: Prometheus 결과 8종 매핑(nodesUp/Down 카운트), 개별 쿼리 reject 시 해당 필드만 null, `instantQuery` 정확히 8회 병렬 호출.

### 2.8 `src/app/api/search/route.test.ts` — 8 케이스
- 대상: `search/route.ts`의 `GET` 핸들러 (`@/lib/db`, `@/lib/rbac` 모킹).
- 핵심 검증: 쿼리 2자 미만/공백 트림 시 빈 그룹 + DB 미조회, 유효 시 equipment/room/rack/alert 4테이블 병렬 조회(카테고리별 `take:5`), alert는 `FIRING`만.

### 2.9 `tests/e2e/auth.spec.ts` — 6 케이스 (Playwright, `src` 외부)
- 대상: 인증 플로우 및 인증 후 네비게이션 (실 서버 기동 필요).
- 핵심 검증: 미인증 시 `/login` 리다이렉트, 잘못된 자격증명 거부, 시드 admin 로그인 성공, 사이드바 이동(Servers/Infrastructure), ⌘K 팔레트 열기/닫기.

## 3. 커버리지 공백 (Gap) 분석

### 3.1 API 라우트
- `src/app/api/**/route.ts` 총 **74개** 중 테스트된 라우트는 **1개**(`search/route.ts`)뿐 (약 **1.4%**).
- `fetch-metrics.ts`는 헬퍼일 뿐, 라우트 핸들러(HTTP 계층·권한 체크·에러 응답)는 미검증.
- **테스트 전무한 대표 라우트군**: 장비 변경/일괄(`equipment/**`), 전원 제어(`power`, `refresh-hw`, `bulk-bmc`), 알림 엔진/크론(`cron/*`, `alerts/*`, `alert-rules`), 권한/사용자/조직(`users/**`, `organizations/**`, `auth/signup`), 디스커버리(`discovery/**`), 메트릭/SSE(`metrics/range|instant|stream`), 용량/평가/자산(`capacity/forecast`, `evaluations/**`, `expiry-tracker/**`, `audit-logs/**` 등).

### 3.2 React 컴포넌트 / 페이지
- `src/app/**/page.tsx` **39개** 페이지 중 렌더링 테스트 **0개**.
- 공통 UI(`Card`, `Badge`, `PageHeader`, `StatusBadge` 등) 단위 테스트 **0개**. `@testing-library/react`는 설치만 되고 미사용.
- Server/Client 경계, 폼 검증, 상태 관리, 차트·랙 다이어그램·Digital Twin SVG 렌더는 `next build`의 컴파일 검증에만 의존.

### 3.3 E2E (Playwright)
- 스펙 **1개**(6 케이스)로 로그인·기본 네비게이션·커맨드 팔레트만 커버.
- 핵심 업무 플로우(장비 CRUD, 랙 배치, 알림 설정, 리포트 PDF, 디스커버리 등록) E2E 없음.
- `verify`/`verify:full`에 미포함 → 일상 검증 루프에서 자동 실행되지 않음.

## 4. 위험도 평가 — 테스트되지 않은 영역 Top 3

1. **RBAC / 인증·인가 로직** (`src/lib/rbac.ts` + 74개 라우트 권한 게이트)
   `getSessionUser`는 모킹만 될 뿐 권한 판정 로직 자체의 단위 테스트가 없다. 거의 모든 mutation 라우트가 의존하므로 회귀 시 **권한 우회 또는 정상 사용자 차단**으로 직결 — 영향 범위·보안 영향 최대. (이번 사이클의 S1/S2 우회도 이 공백에서 나옴)
2. **알림 엔진 / 크론 평가** (`cron/alert-check`, `alerts/*`, `alert-rules/*`)
   임계값 평가·FIRING/해제 상태 전이·채널/에스컬레이션 전송에 테스트가 없다. 오탐/미탐을 잡을 회귀 방어막이 없어 모니터링 신뢰성을 직접 훼손.
3. **전원 제어 / BMC·Redfish 연동** (`equipment/[id]/power`, `refresh-hw`, `bulk-bmc`)
   하위 헬퍼(`pickFirstSystemPath`·`getBmcCredentials`)는 테스트되나, 전원 액션 수행 흐름(자격증명→Redfish→감사→응답)은 미검증. 폐쇄망 특성상 롤백이 어려워 **의도치 않은 장비 정지** 위험.

---

> 검증 범위 주의: 위 집계는 파일 내용 기준의 정적 산출이다. 케이스 수는 소스의 `it` 선언을 센 값이며, 실제 통과 여부·데이터 연동 동작은 `npm run test:run` 및 회사망 배포 후 별도 확인이 필요하다.
