# 화면/기능 정리 TODO

> ⚠️ **[이력용 · 아카이브]** 2026-06-02 정리 검토 기록. 최신 화면/기능 현황은 [`features.md`](features.md) 참조.

> 작성일: 2026-06-02
> 목적: 화면(사이드바 메뉴 13개)이 너무 많아 정리 대상을 기록. 내일 회사에서 실제 사용 여부 확인 후 결정.

## 현황

- 사이드바 메뉴: **13개** (Dashboard, Servers, Infrastructure, Racks, Search, Memory, Firmware, Workloads, Evaluations, History, Alerts, Capacity, Reports)
- 전체 페이지 라우트: **33개**
- 설정 하위: Users, Discovery, BMC, Prometheus 진단, 만기 관리

## 정리 후보 (우선순위 순)

### 1순위: Evaluations + Workloads (가장 큰 정리 대상)

| 항목 | 코드량 | 위치 |
|------|--------|------|
| Evaluations | 약 2,160줄 | `src/app/(dashboard)/evaluations/`, `src/components/evaluations/` |
| Workloads | 약 2,970줄 | `src/app/(dashboard)/workloads/`, `src/components/workloads/` |
| **합계** | **약 5,130줄** | 전체 코드에서 큰 비중 |

- **문제점**: "메모리 평가 프로젝트 관리"라는 특수 용도. 핵심 DCIM(자산·랙·모니터링)과 동떨어져 있고 서로 강하게 결합됨.
- **관련 DB 모델**: `EvalProject`, `EvalPhase`, `EvalTask`, `EvalResult`, `EvalNote` (prisma/schema.prisma)
- **관련 API**: `/api/evaluations/*`, `/api/workloads/*`
- **결정 필요**: 실제로 사용하는가?
  - **안 쓰면** → 사이드바에서 메뉴만 숨기기 (코드는 보존, 라우트는 살림) 또는 완전 제거
  - **쓰면** → 별도 모듈로 분리하거나 "평가" 섹션으로 그룹핑
- **추천**: 우선 사이드바에서 두 메뉴를 **숨김** 처리 → 한 달간 안 쓰면 제거

### 2순위: 장비 상세 페이지 중복

| 페이지 | 역할 | 위치 |
|--------|------|------|
| `/servers/[id]` | 서버 상세 (메트릭 중심) | `src/app/(dashboard)/servers/[id]/page.tsx` |
| `/infrastructure/[id]` | 장비 상세 (자산 중심) | `src/app/(dashboard)/infrastructure/[id]/page.tsx` |

- **문제점**: 둘 다 단일 장비 상세를 보여줌. 데이터 겹침.
- **추천**: 하나로 통합하거나, 역할을 명확히 분리 (servers=실시간 메트릭, infrastructure=자산정보). "자산 관리" 버튼이 둘을 오가게 되어 사용자 혼란 유발.
- **주의**: 통합 시 링크 경로 전부 점검 필요 (`/servers/${id}`, `/infrastructure/${id}` 양쪽 참조처 많음)

### 3순위: Firmware 단독 메뉴

| 페이지 | 코드량 | 위치 |
|--------|--------|------|
| `/firmware` | 312줄 | `src/app/(dashboard)/firmware/page.tsx` |

- **문제점**: BIOS/펌웨어 버전 추적만을 위한 단독 메뉴. 사용 빈도 낮을 가능성.
- **추천**: 장비 상세 페이지나 Reports 안의 탭으로 통합 고려. 단독 메뉴 제거.

## 정리 작업 시 주의사항

1. **메뉴만 숨기기**는 `src/components/layout/sidebar.tsx`의 `navigation` 배열에서 항목 제거 — 코드/라우트는 보존되어 안전.
2. **완전 제거**는 라우트 폴더 + 컴포넌트 + API + DB 모델 + i18n 키 + 참조 링크까지 모두 정리 필요. translations.test.ts가 키 패리티를 검사하므로 i18n 키는 en/ko 동시 제거.
3. 제거 전 반드시 **다른 페이지에서의 참조(import, Link href)** 를 grep으로 확인.

## 결정 대기 항목 (회사에서 확인)

- [ ] Evaluations 실제 사용하는가?
- [ ] Workloads 실제 사용하는가?
- [ ] Firmware 페이지 실제 보는가?
- [ ] `/servers/[id]`와 `/infrastructure/[id]` 중 어느 쪽을 메인으로?
