# DCIM 프로젝트 진행 현황

> 마지막 갱신: 2026-06-26
> 총 커밋: 514 | 총 코드: ~44,000줄 | 구현 완료 기능: 134 항목

---

## 완료된 것 (12개 영역, 모두 동작)

| 영역 | 기능 수 | 핵심 |
|------|---------|------|
| 대시보드 | 13 | 서버 현황, CPU/Memory, 전력, PUE, 알림, 만료 위젯 |
| 서버 모니터링 | 18 | CPU/Memory/Disk/Network/Power 차트, BMC 센서, K8s Pod, 서버 비교 |
| 인프라 관리 | 10 | 장비 CRUD, CSV 등록, 메모리 상세, 펌웨어, BMC 전원 제어, **Bulk HW Refresh (23/30 완료)** |
| 랙 관리 | 6 | 랙 시각화, 온도 히트맵, 드래그&드롭 배치 |
| Prometheus Discovery | 4 | 타겟 자동 동기화, 장비 등록, 설정 진단 |
| Digital Twin | 16 | 평면도, 줌/팬, 편집 모드, 히트맵, 리사이즈, 다중 선택 정렬 |
| 워크로드 | 4 | Active Pod, 종료 이력, 달력 타임라인 |
| 알림 관리 | 7 | 규칙 CRUD, 이력, 채널, 에스컬레이션, 유지보수 창 |
| 설정 | 10 | RBAC, BMC 매핑, 감사 로그, 장비 할당, CSV 내보내기 |
| 운영 자동화 | 4 | DB 백업, 로그 로테이션, 장애 복구, 배포 파이프라인 |
| 용량/리포트 | 4 | 용량 현황, 12개월 예측, 리포트 PDF 내보내기 |
| 기타 | 7 | Cmd+K 검색, i18n, 다크모드, API 검증, 사용자 매뉴얼 |

---

## 미완료 — 기능 개발

| 항목 | 상태 | 설명 | 우선순위 |
|------|------|------|----------|
| Multi-Prometheus | ⚠️ 부분 완료 | **node-exporter는 2026-06-15에 연동 완료** (`20260615-lab3-ne-complete.md`: Lab-3 17/22 UP). Lab-1 Prometheus가 Lab-3 `131.x:9100`을 직접 수집 → 웹 코드 `lab3` 필터(`instance=~"10.144.131..*"`)가 무변경으로 동작. **남은 것**: ① 06-15 작업이 재시작 후에도 유지되는지 사무실 확인(`20260622-2.sh`) ② Lab-3 cAdvisor/K8s 컨테이너 메트릭(Lab-3 자체 Prometheus 비기능 → 인프라팀 ConfigMap 수리 필요). **별도 Prometheus URL 동시 쿼리(코드 방식)는 불필요** — 통합 수집이 우월 | 중간 |
| 조직별 접근 제어 | ✅ 완료 | DB(Organization/UserOrganization) + API(CRUD+필터) + UI(설정 페이지) + RBAC(orgIds 기반) 모두 구현 | — |
| DRAM 인증 테스트 관리 | 📋 보류 | 파트넘 기반 테스트 계획/추적. 요건 미확정 | 보류 |
| 워크로드 스텝 정보 | 📋 미착수 | YAML 파싱 기반 실행 단계 표시 | 낮음 |
| 온도 외부 DB 연동 | 📋 보류 | Grafana의 ddr4_temp CSV + PostgreSQL. 요건 미확인 | 보류 |
| 알림 규칙 평가 엔진 | ✅ 완료 | `/api/cron/alert-check` — 활성 AlertRule의 PromQL을 Prometheus에 쿼리, 조건 충족 시 Alert 생성, 해소 시 자동 RESOLVED. CRON_SECRET 인증, 규칙별 독립 에러 처리 | — |
| 파일시스템 표시 누락 서버 | 📋 확인 대기 | 일부 서버에서 파일시스템(디스크 마운트) 현황이 안 보임. 원인: `FilesystemBreakdown`이 node-exporter 전용 쿼리만 쓰고 cAdvisor 폴백 없음. **확인 스크립트**: `check/targetExecCmd/20260622.sh` (사무실에서 실행 → 어떤 서버에 filesystem 메트릭 없는지 확인 후 코드 수정) | 중간 |

## 미완료 — 운영/인프라

| 항목 | 상태 | 설명 | 우선순위 |
|------|------|------|----------|
| Bulk HW Refresh 실패 서버 | ⚠️ 7대 실패 | OK=23/FAIL=7. HTTP 502(4대), EHOSTUNREACH(2대), Timeout(1대). BMC 펌웨어 또는 네트워크 문제 → 사무실에서 물리 점검 예정 | 중간 |
| 프로덕션 빌드 전환 | ✅ 완료 | systemd 서비스(dcim.service) + 모드 전환(switch-prod.sh) + 재빌드(rebuild-prod.sh) 완비. Dockerfile 3-stage 프로덕션 빌드 | — |
| DB 컨테이너 이름 변경 | 📋 미착수 | firsttest-db-1 → dcim-db | 낮음 |
| 로고 디자인 확정 | 📋 미착수 | 사이드바 로고 시안 검토 중 | 낮음 |
| UI/디자인 통일 | 📋 미착수 | 전체 페이지 디자인 토큰 정리 | 낮음 |

## 미완료 — 서버 실행 대기 스크립트

| 스크립트 | 내용 | 실행 환경 |
|----------|------|-----------|
| 20260616-11.sh | rackHeight 일괄 변경 (SPR 제외 전부 2U) | 38.100 서버 |
| 20260616-12.sh | Lab-2 Room 존재 확인 + 없으면 생성 | 38.100 서버 |

## 미완료 — 문서

| 항목 | 상태 | 설명 |
|------|------|------|
| 결과보고서 | ✅ 완료 | [docs/final-report.md](final-report.md). 8개 섹션 + 부록. 스크린샷만 추후 삽입 |
| PowerPoint 매뉴얼 | ✅ 완료 | 56슬라이드, 흰색 테마 |
| 기술 데이터 흐름 | ✅ 완료 | technical-data-flow.md + data-flow-diagram.html |
| 회고 준비 | ✅ 완료 | retrospective-prep.md |

---

## 결정 필요 사항

| 항목 | 질문 | 배경 |
|------|------|------|
| Evaluations/Workloads 메뉴 | 실제로 사용하는가? 사이드바에서 숨길까? | 5,130줄 분량. 핵심 DCIM과 동떨어진 특수 용도 (TODO-cleanup.md 참조). **team-a/team-b 분석 완료**: Evaluations는 이미 사이드바에서 빠져있음. Workloads는 sidebar.tsx 1줄 삭제로 숨김 가능하나, **Dashboard의 ActiveWorkloads 위젯이 /workloads 링크를 계속 렌더링** → 사이드바만 숨기면 반쪽짜리. 이 위젯이 실제로 유용한지 회사에서 확인 필요 |
| 장비 상세 페이지 중복 | /servers/[id]와 /infrastructure/[id] 중 어느 쪽을 메인으로? | 둘 다 단일 장비 상세를 보여줌. 데이터 겹침 |
| Firmware 단독 메뉴 | 별도 메뉴 유지? 장비 상세에 통합? | 사용 빈도 낮을 가능성 |
| Lab-3 cAdvisor 메트릭 | Lab-3 컨테이너 메트릭을 보려면 인프라팀에 ConfigMap 수리를 요청할 것인가? | **node-exporter(CPU/Mem/Disk/Net)는 06-15에 통합 완료**. 남은 cAdvisor/K8s 메트릭은 Lab-3 자체 Prometheus 복구 필요(인프라팀 권한). 4-에이전트 분석 결과 코드 우회(별도 URL)는 불필요·비권장 |
| 온도 외부 DB | Grafana의 ddr4_temp 데이터를 연동할 것인가? | 구체적 요건 미확인 상태 |
| 알림 규칙 평가 엔진 | ✅ 구현 완료 | `/api/cron/alert-check` 엔드포인트 구현. crontab에 5분 간격 등록 필요 |

---

## Prometheus 연동 현황

> ⚠️ 아래는 수집 경로별 현황. Lab-3 데이터는 **Lab-3 자체 Prometheus가 아니라 Lab-1 Prometheus가 직접 수집**하는 구조 (PCM·node-exporter 모두 hostname/IP 기반 직접 스크래이프).

| 항목 | Lab-1 | Lab-3 |
|------|-------|-------|
| Prometheus 주소 | 10.100.175.248:8080 (ClusterIP) | 10.144.131.190:30003 |
| Lab-3 자체 Prometheus | — | ❌ 비기능 (K8s API 접근 불가, 타겟 0) — 인프라팀 영역 |
| PCM(전력, :9200) | ✅ 정상 | ✅ Lab-1이 직접 수집 (`AE-SMC-GNRSP_PCM` 10/10) |
| node-exporter(:9100) | ✅ 정상 | ⚠️ **06-15 연동 완료(17/22 UP)** — 재시작 후 유지 여부 사무실 확인 필요 |
| cAdvisor/K8s 컨테이너 | ✅ 정상 | ❌ Lab-3 자체 Prometheus 필요 → 인프라팀 ConfigMap 수리 대기 |
| 웹 코드 연동 | ✅ 단일 URL | ✅ `lab3` 필터 완성 — 통합 수집되면 무변경 동작 |

---

## 참고 문서 인덱스

| 문서 | 경로 | 용도 |
|------|------|------|
| 기능 목록 (단일 진실 원천) | docs/features.md | 구현 현황 |
| 결과보고서 기획 | docs/final-report-plan.md | 보고서 작성 가이드 |
| 회고 준비 | docs/retrospective-prep.md | 바이브 코딩 경험 공유 |
| 기술 데이터 흐름 | docs/technical-data-flow.md | 화면별 데이터 소스 매핑 |
| 인터랙티브 다이어그램 | docs/data-flow-diagram.html | 시각적 아키텍처 |
| 인프라 정보 | docs/infrastructure.md | Prometheus, 네트워크, 서버 목록 |
| 화면 정리 TODO | docs/TODO-cleanup.md | 메뉴 통합/제거 검토 |
| Prometheus 설정 TODO | check/TODO-prom-config-cleanup.sh | ConfigMap 정리 |
