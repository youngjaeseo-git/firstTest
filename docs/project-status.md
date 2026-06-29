# DCIM 프로젝트 진행 현황

> 마지막 갱신: 2026-06-29
> 총 커밋: 530+ | 총 코드: ~44,000줄 | 구현 완료 기능: 136 항목

---

## 완료된 것 (12개 영역, 모두 동작)

| 영역 | 기능 수 | 핵심 |
|------|---------|------|
| 대시보드 | 13 | 서버 현황, CPU/Memory, 전력, PUE, 알림, 만료 위젯 |
| 서버 모니터링 | 18 | CPU/Memory/Disk/Network/Power 차트, BMC 센서, K8s Pod, 서버 비교 |
| 인프라 관리 | 11 | 장비 CRUD, CSV 등록, 메모리 상세, 펌웨어, BMC 전원 제어, Bulk HW Refresh (23/30) |
| 랙 관리 | 6 | 랙 시각화, 온도 히트맵, 드래그&드롭 배치 |
| Prometheus Discovery | 4 | 타겟 자동 동기화, 장비 등록, 설정 진단 |
| Digital Twin | 16 | 평면도, 줌/팬, 편집 모드, 히트맵, 리사이즈, 다중 선택 정렬 |
| 워크로드 | 5 | Active Pod, 종료 이력, 달력 타임라인, 스텝 설정 표시 |
| 알림 관리 | 8 | 규칙 CRUD, **규칙 평가 엔진**, 이력, 채널, 에스컬레이션, 유지보수 창 |
| 설정 | 11 | RBAC, BMC 매핑, 감사 로그, 장비 할당, CSV 내보내기, **조직별 접근 제어** |
| 운영 자동화 | 5 | DB 백업, 로그 로테이션, 장애 복구, 배포 파이프라인, **프로덕션 빌드(systemd)** |
| 용량/리포트 | 4 | 용량 현황, 12개월 예측, 리포트 PDF 내보내기 |
| 기타 | 8 | Cmd+K 검색, i18n, 다크모드, API 검증, 사용자 매뉴얼, **로고(인라인 SVG)** |

---

## 미완료 — 인프라/사무실 확인 필요 (코드 작업 없음)

| 항목 | 상태 | 설명 | 우선순위 |
|------|------|------|----------|
| Bulk HW Refresh 실패 7대 | ⚠️ 물리 점검 예정 | HTTP 502(4대), EHOSTUNREACH(2대), Timeout(1대). BMC 펌웨어/네트워크 문제 | 중간 |
| Multi-Prometheus Lab-3 | ⚠️ 일부 완료 | node-exporter **파일시스템 노출 완료**(2026-06-29, DS에 hostPath:/ + --path.rootfs 패치, NFS 포함 131.115 확인). 남은 것: cAdvisor는 인프라팀 ConfigMap 수리 | 낮음 |
| 미실행 스크립트: rackHeight | 📋 대기 | 20260616-11.sh — SPR 제외 전부 2U로 변경 (38.100 서버) | 낮음 |
| 미실행 스크립트: Lab-2 Room | 📋 대기 | 20260616-12.sh — Lab-2 Room 없으면 생성 (38.100 서버) | 낮음 |

## 미완료 — 보류 (요건 미확정)

| 항목 | 상태 | 설명 |
|------|------|------|
| DRAM 인증 테스트 관리 | 📋 보류 | 파트넘 기반 테스트 계획/추적. 요건 미확정 |
| 온도 외부 DB 연동 | 📋 보류 | Grafana ddr4_temp CSV + PostgreSQL. 요건 미확인. Prometheus에서 이미 온도 수집 중 |

## 완료된 문서

| 항목 | 상태 | 설명 |
|------|------|------|
| 결과보고서 | ✅ 완료 | [docs/final-report.md](final-report.md). 8개 섹션 + 부록. 스크린샷만 추후 삽입 |
| PowerPoint 매뉴얼 | ✅ 완료 | 56슬라이드, 흰색 테마 |
| 기술 데이터 흐름 | ✅ 완료 | technical-data-flow.md + data-flow-diagram.html |
| 회고 준비 | ✅ 완료 | retrospective-prep.md + 회고 PPT 26슬라이드 |

---

## 결정 필요 사항 (회사 확인)

| 항목 | 질문 | 8-agent 권장 |
|------|------|-------------|
| Evaluations/Workloads 메뉴 | 실제로 사용하는가? | Evaluations 이미 사이드바 제거됨. Workloads는 Dashboard 위젯이 링크 사용 중 → 사용 확인 후 결정. 5,685줄 |
| Lab-3 cAdvisor 메트릭 | 인프라팀에 ConfigMap 수리 요청? | node-exporter는 통합 완료. cAdvisor는 인프라팀 영역 |

## 결정 완료 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 장비 상세 페이지 중복 | **현행 유지** | /servers/[id]=실시간 모니터링, /infrastructure/[id]=자산 관리. 의도적 역할 분리 |
| Firmware 단독 메뉴 | **유지** | fleet-wide BIOS 버전 비교 기능. 개별 장비 통합 시 전체 비교 관점 상실 |
| 알림 규칙 평가 엔진 | **구현 완료** | `/api/cron/alert-check` — crontab 5분 간격 등록 필요 |
| 조직별 접근 제어 | **구현 완료** | DB + API + UI + RBAC 모두 구현 |
| DB 컨테이너 이름 | **변경 불필요** | docker-compose에 이미 `dcim-db`로 적절한 네이밍 |
| 로고 디자인 | **구현 완료** | 인라인 SVG (SK hynix 로고 + DC Express 텍스트) |
| UI/디자인 통일 | **기본 완료** | CSS 변수 gray ramp, 다크모드, severity/rack 색상. PageHeader 30/39 페이지 적용 |
| 워크로드 스텝 정보 | **구현 완료** | StepConfig + StepConfigBadges 컴포넌트 존재 |

---

## Prometheus 연동 현황

> Lab-3 데이터는 Lab-1 Prometheus가 직접 수집하는 구조.

| 항목 | Lab-1 | Lab-3 |
|------|-------|-------|
| Prometheus 주소 | 10.100.175.248:8080 (ClusterIP) | 10.144.131.190:30003 |
| Lab-3 자체 Prometheus | — | ❌ 비기능 — 인프라팀 영역 |
| PCM(전력, :9200) | ✅ 정상 | ✅ Lab-1이 직접 수집 |
| node-exporter(:9100) | ✅ 정상 | ⚠️ 06-15 연동 완료(17/22 UP) — 재시작 유지 확인 필요 |
| cAdvisor/K8s 컨테이너 | ✅ 정상 | ❌ Lab-3 자체 Prometheus 필요 |
| 웹 코드 연동 | ✅ 단일 URL | ✅ lab3 필터 완성 |

---

## 참고 문서 인덱스

| 문서 | 경로 | 용도 |
|------|------|------|
| 기능 목록 (단일 진실 원천) | docs/features.md | 구현 현황 |
| 결과보고서 | docs/final-report.md | 8개 섹션 + 부록 |
| 회고 준비 | docs/retrospective-prep.md | 바이브 코딩 경험 공유 |
| 기술 데이터 흐름 | docs/technical-data-flow.md | 화면별 데이터 소스 매핑 |
| 인터랙티브 다이어그램 | docs/data-flow-diagram.html | 시각적 아키텍처 |
| 인프라 정보 | docs/infrastructure.md | Prometheus, 네트워크, 서버 목록 |
| 벌크 리프레시 기록 | check/results/20260625-bulk-refresh-status.md | 6회 시도 트러블슈팅 |
