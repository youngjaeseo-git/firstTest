# DCIM 프로젝트 인수인계서 (전체 한눈에 보기)

> 최종 갱신: 2026-06-29 | 브랜치: `claude/dcim-management-system-6oyFy` | PR #1
> 이 문서는 프로젝트 전체를 한 페이지로 요약한다. 세부는 각 섹션의 링크 문서 참조.

---

## 1. 프로젝트 개요

기존 Grafana 기반 서버 모니터링을 대체하는 **DCIM(Data Center Infrastructure Management) 웹 앱**.
데이터센터 인프라 관리 + Observability + 자산 관리를 통합 제공. 폐쇄망(air-gapped) 사내 운영.

- **규모**: 530+ 커밋, ~44,000줄, 구현 기능 136항목, 단위테스트 8파일 62개
- **물리 계층**: DataCenter → Room → Rack → Equipment(U 위치)
- **다국어**: 한국어/영어 (i18n 키 en/ko 각 511개, parity 유지)

## 2. 기술 스택 / 아키텍처

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind |
| UI | shadcn/ui(Radix: accordion/dialog/slot) + Recharts + D3 + SVG |
| 상태관리 | React Context + useState (전역 store 미사용) |
| Backend | Next.js API Routes + Prisma ORM |
| DB | PostgreSQL(자산/설정) + Prometheus(시계열) |
| 실시간 | **SSE(Server-Sent Events, EventSource)** — `/api/metrics/dashboard/stream` |
| 인증 | NextAuth.js (CredentialsProvider, JWT). 미들웨어가 api/cron 제외 전 라우트 JWT 강제 |
| 배포 | Docker (multi-stage) + docker-compose (app + db) |
| 리포트 | 브라우저 `window.print` + CSS print, CSV 다운로드 |

원칙: Server Components 우선, 메트릭은 Prometheus·자산은 PostgreSQL, 접기/펼치기 UI로 정보 밀도 관리.

## 3. 인프라 (→ docs/infrastructure.md)

- **Lab-1 Prometheus**: `10.100.175.248:8080` (ClusterIP) — Lab-1·Lab-3 둘 다 직접 수집
- **DCIM 앱**: `10.144.38.100:3000`
- **클러스터 2개(분리)**: Lab-1(10.144.38.x), Lab-3(10.144.131.x, master .100, monitoring .190)
- node-exporter는 **두 클러스터 모두 monitoring/node-exporter DaemonSet**으로 운영
  - hostNetwork:true + hostPath:/ → /host + `--path.rootfs=/host` → 호스트 파일시스템(NFS 포함) 노출
  - 쿼리 전략: node-exporter(IP instance, `job="node-exporter"`) 우선, cAdvisor(hostname) 폴백
- **Lab-3 cAdvisor**: 비기능 — 인프라팀 ConfigMap 영역

## 3-1. ⚠️ 실제 운영 배포 구조 (반드시 숙지 — 2026-06-30 사고로 확정)

운영은 **하이브리드**다. docker-compose로 앱 전체를 띄우는 구조가 **아니다.**

| 구성 | 실제 |
|------|------|
| **앱** | **systemd 서비스 `dcim`** → `scripts/service-start.sh` → `npm run dev`(또는 prod 시 build→start). 포트 3000. |
| **DB** | **docker 컨테이너 `dcim-db`** (postgres:16-alpine), 호스트 포트 **5433** 으로 publish (`DB_PORT=5433` in `.env`). 데이터 볼륨 `firsttest_pgdata`. |
| 앱→DB 연결 | `service-start.sh`가 `docker compose port db 5432`로 5433을 읽어 `DATABASE_URL=...@localhost:5433` 조립 |
| 호스트 postgres 12 (:5432) | **운영과 무관한 별도 설치**. 앱은 5432가 아니라 **5433**을 쓴다. |

**하면 안 되는 것 / 주의:**
- ❌ `docker compose up -d app` 금지 — 앱은 systemd라 docker app은 불필요하고, db를 기본 5432로 재생성하려다 호스트 postgres와 충돌해 **운영 db를 멈춘다**(2026-06-30 실제 사고). db만 다룰 땐 반드시 `DB_PORT=5433 docker compose up -d db`.
- ❌ `docker compose down -v` 절대 금지 (볼륨 `firsttest_pgdata` 삭제 = 데이터 손실).
- **재시작**: env만 바뀌면 `systemctl restart dcim`(가벼움, .env 재로드). 코드 바뀌면 `sudo bash scripts/rebuild-prod.sh`(풀 빌드).
- **cron**: 운영이 systemd이므로 `.env`에 `CRON_SECRET` 추가 후 `systemctl restart dcim` 으로 주입(next dev가 .env 자동 로드). docker용 `20260629-cron-setup.sh`/`cron-fix.sh`는 **이 배포에 안 맞음** — `20260629-cron-restart.sh` 사용.
- **리네이밍 주의**: 디렉토리명이 firstTest라 compose 프로젝트명=firsttest → 볼륨/이미지가 `firsttest_*`. container_name만 dcim으로 바뀐 절반-적용 상태이나 **운영 무영향**(앱·db 접근이 이 prefix에 의존 안 함). 프로젝트명을 dcim으로 강제하면 빈 `dcim_pgdata`가 생겨 데이터 단절되니 손대지 말 것.

## 4. 기능 영역 (→ docs/features.md, 단일 권위)

대시보드 · 서버 모니터링(CPU/Mem/Disk/Net/온도/PCIe/BMC) · 메모리 상세(DIMM) · 인프라 관리(장비 CRUD/CSV/펌웨어/BMC전원) · 랙 관리(시각화/히트맵/DnD) · Digital Twin(평면도/줌·팬/편집) · 워크로드 · 알림 관리(규칙 평가 엔진/이력/채널/에스컬레이션/유지보수창) · 설정(RBAC/감사로그/조직별 접근제어) · 용량/리포트 · 운영 자동화(백업/cron)

## 5. 산출물 목록

| 산출물 | 경로 | 상태 |
|--------|------|------|
| 기능 목록(단일 권위) | docs/features.md | ✅ |
| 진행 현황 | docs/project-status.md | ✅ |
| 결과보고서 | docs/final-report.md | ✅ (스크린샷 추후) |
| PowerPoint 매뉴얼 | (56슬라이드) | ✅ |
| 기술 데이터 흐름 | docs/technical-data-flow.md + data-flow-diagram.html | ✅ |
| 회고 준비 | docs/retrospective-prep.md (26슬라이드) | ✅ |
| 인프라 정보 | docs/infrastructure.md | ✅ |
| 세션 인계 | docs/handoff-20260629.md | ✅ |
| **본 인수인계서** | docs/project-handover.md | ✅ |

## 6. 배포 / 운영

- **빌드/배포**: docker-compose (app `dcim-app`, db `dcim-db`). 환경변수는 `.env`(`${VAR:-default}`).
- **스키마 변경 시**: 서버에서 `npx prisma db push`.
- **알림 cron 등록(필수, 미완)**: `bash check/targetExecCmd/20260629-cron-setup.sh`
  - CRON_SECRET 생성/주입 + app 재기동 + crontab(alert-check 5분, expiry-check 일 08시) + 검증
- **검증 루틴**: `npm run verify`(typecheck+lint+test, DB 불필요) / `npm run verify:full`(+build, DATABASE_URL 필요)

## 7. 남은 일 / 결정 필요 (→ docs/project-status.md)

### 운영 (서버 실행)
- **[높음] 알림/만료 cron 등록** — 위 cron-setup 스크립트

### 인프라/물리 (인프라팀·현장)
- Bulk HW Refresh 실패 7대 (BMC 펌웨어/네트워크)
- Lab-3 cAdvisor (인프라팀 ConfigMap)

### 결정 완료 (2026-06-29 감사)
- **Digital Twin 평면도**: 현행 유지 (운영 DB 방 이름 매핑돼 화면 정상)
- **NodeOverview CPU 표기**: 수정 완료 (load average → cpuUsage 기반 사용 코어/%)
- **조직 접근 정책**: 수정 완료 (비ADMIN org null/미소속 차단 통일 + POST org 검증)
- **evaluations 라우트**: 현행 유지 — 고립 아님(Workloads의 Evaluation 탭이 사용 중)

### 후속 작업 (데이터 확인 선행)
- **클러스터 매처(cAdvisor/up)**: lab1/lab3 hostname 오집계 가능 — `check/targetExecCmd/20260629-cadvisor-labels.sh` 실행 → 결과로 CLUSTER_CA+UP 매처 수정 (node-exporter 살아있으면 증상 가려짐, 우선순위 중간)

### 결정: 현행 유지
- **죽은 의존성 16개**(socket.io/jspdf/html2canvas/zustand/@dnd-kit×3/date-fns/react-table/radix 일부): import 0회지만 폐쇄망 리스크 > 정리 이득 → 그냥 둠 (기능 영향 없음)

### 보류 (요건 미확정)
- DRAM 인증 테스트 관리 / 온도 외부 DB 연동

## 8. 2026-06-29 소스 감사 요약 (8 에이전트 + 종합 비평)

- 8개 영역 전수 점검 → 40여 이슈 도출, 종합 비평으로 교차 검증.
- **즉시 수정 완료(안전·명확)**: 알림 중복/미해소, refresh-hw 반올림, DELETE 404, 대시보드 데드 쿼리 제거, 온도 라우트 인증, memory-editor 데드코드, colSpan, i18n 누락 키, health escapeRe 통일, 헤더 로케일, 다수 문서 정합성.
- **결정 보류(위 7절)**: 설계/정책/토폴로지 판단이 필요한 항목.

## 9. 다음 담당자 빠른 시작

1. `docs/project-handover.md`(본 문서) → `docs/project-status.md` → `docs/features.md` 순으로 읽기.
2. 앱 띄우기: docker-compose. 메트릭은 회사망에서만 실데이터 확인 가능.
3. 새 작업 전 CLAUDE.md 규칙: 기존 구현 확인 → 팀A/팀B 분석 → 변경 영향 분석 → `npm run verify`.
4. 외부 데이터 연동(Prometheus/BMC/K8s)은 Data-First: `check/targetExecCmd/`에 확인 스크립트 작성 → 결과를 `check/results/`에 저장.
