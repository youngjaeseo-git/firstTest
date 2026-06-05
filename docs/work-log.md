# DCIM 프로젝트 작업 일지

---

## 2026-04-10 (목)
### 완료
- 장비 일괄 등록 기능 추가 (CSV 업로드, 미리보기, 유효성 검증)

---

## 2026-04-11 (금)
### 완료
- Phase 1 Observability 메트릭 추가 (Load Avg, IOPS, Latency, Network errors)
- 서버 비교 뷰 및 CPU 코어 히트맵 추가
- UI 전반 개선 (애니메이션, glassmorphism, UX 향상)
- 글로벌 커맨드 팔레트 (⌘K) 및 Twin view 브레드크럼 추가
- NextAuth 인증 설정 수정 (NEXTAUTH_SECRET)

---

## 2026-04-12 (토)
### 완료
- Prometheus fetch timeout 3초로 단축
- dev.sh 스타트업 스크립트 추가
- 알림 벨 드롭다운 z-index 및 대시보드 로딩 플래시 수정
- Vitest + Playwright 테스트 인프라 구축
- SSE 스트림 방식 대시보드 메트릭 (폴링 대체)
- 한국어/영어 i18n 및 언어 전환기 추가
- Prometheus 상태 인디케이터 및 대시보드 에러 바운더리
- Redfish 전원 제어, BMC 콘솔 링크, 장비 히스토리
- 아키텍처 문서 정리 (todo.md 백로그, 다이어그램)

---

## 2026-04-13 (일)
### 완료
- 사내 배포 가이드 작성 (office-setup-guide, runtime-install-guide, troubleshooting)
- .env.example 사내 환경 값 반영
- 개발자 환경 섹션 CLAUDE.md 추가
- 멀티 Prometheus 백로그 문서화 (Lab1/Lab3)

---

## 2026-04-14 (월)
### 완료
- Prisma binaryTargets 크로스 플랫폼 설정 (`debian-openssl-3.0.x`, `debian-openssl-1.1.x`)
- Mac → GitHub → 사무실 PC → NFS → 리눅스 서버 파일 전송 파이프라인 확립

---

## 2026-04-17 (목)
### 완료
- 리눅스 서버 배포 성공 (PostgreSQL 5433, 앱 3000)
- server-start.sh 편의 스크립트 작성
- Prometheus 연결 확인 (K8s ClusterIP `10.100.175.248:8080` / NodePort `10.144.38.100:30003`)
- Prometheus job 필터 수정 (node-exporter → 실제 서비스 기반 exclusion 필터)
- 메트릭 시스템 전환: node-exporter → Intel PCM → **cAdvisor** (최종 확정)
- 대시보드 fleet 쿼리 cAdvisor 변환 완료

### 확인된 사항
- 온도 데이터는 Prometheus가 아닌 외부 SQL DB에 있음 (Grafana PDU monitoring 패널)
- cAdvisor 메트릭: `container_*`, `machine_*` 계열 사용
- 노드 UP 174대 / DOWN 204대 확인

---

## 2026-04-20 (일)
### 완료
- Per-server 메트릭 쿼리 전체 cAdvisor 변환 (CPU, Memory, Disk, Network, Power 등)
- 시드 데이터 삭제 API 생성 (`POST /api/admin/cleanup-seed`)
- Prometheus Discovery 페이지 전면 재작성
  - 타겟 목록 표시 (Job/Health/Linked 필터)
  - 타겟 → 장비 등록 기능 (Register 버튼)
- `GET /api/discovery/targets` 엔드포인트 생성
- `POST /api/discovery/register` 엔드포인트 생성
- Discovery sync API 응답 포맷 수정 (프론트엔드와 필드명 일치)
- IP/호스트명 검색 + 50개 단위 페이지네이션 추가
- Unregister 버튼 + API 추가 (장비 삭제 및 타겟 연결 해제)
- socketIndex 버그 수정 (CPU 등록 시 DB 에러 해결)
- 서버 목록에서 미배치 서버(rackId=null) 표시 ("미배치")
- Infrastructure 상세 페이지에 Prometheus 메트릭 차트 추가
- **IP 기반 매칭으로 전체 PromQL 쿼리 개선** (cross-job instance 불일치 해결)
  - 동일 서버가 job별로 다른 포트를 가져도 IP로 매칭
  - Load Average → 실제 CPU 사용률 (1m/5m/15m rate) 표시
  - 가짜 Processes 차트 제거, CFS Throttled로 대체
  - CPU Mode에서 iowait/steal 플레이스홀더 제거
- 장비 등록 시 Prometheus에서 CPU 코어수/메모리 자동 감지

---

## 2026-04-22 (화)
### 완료
- Data-First Development Rule 확립 — `check/` 폴더에 확인 스크립트 작성 후 실제 데이터 확인 → 코드 작성 순서
- Prometheus 실제 라벨 구조 확인 완료 (instance=호스트네임, job별 메트릭 차이)
- 서버별 메트릭 가용성 차이 확인:
  - cadvisor 서버 (s131x13ae013): 4개 job, CPU 144코어 / 메모리 2015GB 확인
  - PCM 전용 서버 (s222hax14ae005): 전력만, CPU/메모리 메트릭 없음
- Register 라우트 정리: 불필요한 IP 변환 로직 제거, 호스트네임 직접 쿼리
- CLAUDE.md 정리: Commands/Directory 등 `docs/cmd_usage.md`로 분리
- Cross-origin 경고 해결 (next.config.js allowedDevOrigins 추가)

---

## 2026-04-23 ~ 04-27: 서버 상세 차트 디버깅

### 근본 원인 2가지 발견 및 해결
1. **PromQL 쿼리 문제 (04-27 해결)**
   - K8s cAdvisor에서 `id="/"` (root cgroup)이 존재하지 않음 → 모든 쿼리가 빈 결과
   - 해결: 전체 쿼리를 `container!=""` 필터로 교체 (30+ 쿼리)
   - Grafana 기존 쿼리(`id="/"`)보다 커버리지 넓음

2. **멀티 시리즈 차트 렌더링 문제 (04-28 해결)**
   - 3개 시리즈 차트에서 각 API 호출의 ms 단위 시간차로 타임스탬프 불일치
   - pts=363 (121×3)인데 각 포인트에 시리즈 1개만 존재 → Recharts 선 미표시
   - 해결: `Math.round(ts / stepSec) * stepSec * 1000` 타임스탬프 정렬

### 기타 해결
- ChartSkeleton `Math.random()` → 결정적 수식으로 변경 (hydration 에러 해결)
- useEffect `series` 의존성 → `seriesKey` 문자열로 안정화 (무한 재요청 방지)
- 차트 애니메이션 비활성화 (`isAnimationActive={false}`) — 재렌더 시 선 사라짐 방지

---

## 2026-04-28 (월)
### 완료
- node_exporter 미존재 확인 — cAdvisor + PCM만 사용 가능
- 대안 데이터 소스 탐색:
  - kube-state-metrics: CPU/Memory/Disk 노드 용량 확인 (144cores, 2015GB, 70GB)
  - kubelet: running pods 수
  - cAdvisor device: `/dev/mapper/rhel-root` 호스트 디스크
- **Node Resources 카드 신규 구현** — kube-state-metrics 기반 CPU/Memory/Disk 용량 + 사용률 게이지
- **Pod 목록 표시** — `kube_pod_info`에서 Pod 이름/namespace 가져와 리스트로 표시
- **디스크 쿼리 개선** — `device=~"/dev/.*"` 필터로 실제 블록 디바이스만 선택
- 디스크 용량 fallback: kube-state-metrics → cAdvisor `container_fs_limit_bytes`

---

## 2026-04-29 (화)
### 완료
- **Discovery health 수정** — 동일 instance의 여러 job 중 하나라도 up이면 "up"으로 표시
- **IP 자동 감지 시도** — `kube_node_status_addresses`, `kube_node_info` 조회했으나 해당 환경에서 IP 라벨 없음. 수동 입력 필요
- **서버/인프라 페이지 통일** — 양쪽 상세 페이지 info bar를 동일 6개 항목으로 통일
- **Status 색상 배지** — ACTIVE=초록, FAILED=빨강, MAINTENANCE=보라 등 `StatusBadge` 적용
- **CPU Core Heatmap 완전 재작성** — 가짜 데이터(전체 평균 복사) → `sum by(cpu)` 코어별 실제 사용률 표시

---

## 2026-05-15 (목)
### 완료
- **node-exporter 정상 수집 확인** — DaemonSet 배포 완료, 21 타겟 (18 up, 3 down), instance=IP:port
- **대시보드 fleet 쿼리 node-exporter 전환** — `id="/"` 하드코딩 제거, `queries.fleetAvgCpu()` 등 중앙화된 함수 사용
  - CPU, Memory, Network, Uptime 4개 쿼리: node-exporter 우선, cAdvisor 폴백 (`or`)
  - `fetch-metrics.ts`, `fleet-overview.tsx` 하드코딩 → `prometheus.ts` 함수 호출로 통일
- **CLAUDE.md 업데이트** — "node_exporter 없음" → "node_exporter 사용 가능 (21 타겟)" 반영
- **CPU 코어 히트맵 누락 원인 분석** — Prometheus config의 hostname/IP 혼재가 원인. 다음 주 정리 작업으로 등록

### 확인된 사항
- node-exporter scrape_duration=0s이지만 데이터 정상 수집 (표시 이슈)
- 동일 서버 군(s222hax14ae011/012)에서 히트맵 차이: Prometheus config에 IP/호스트네임 혼재 → 일부 서버 매칭 실패
- 대시보드에 기존에 안 나오던 CPU/Memory/Uptime이 이제 표시됨

---

## 2026-05-18 ~ 05-19 (일~월)
### 완료
- **대시보드 Lab-1/Lab-3 클러스터 필터 추가** — 메트릭 카드 8개 + Fleet Top-5 + 서버 상태 도넛을 All/Lab-1/Lab-3로 분리 표시. SSE 스트림도 클러스터별 동작
- **인프라 문서 분리** — CLAUDE.md에서 Prometheus 환경, Job/타겟 목록, hostname→IP 매핑 등을 `docs/infrastructure.md`로 추출. CLAUDE.md 180줄→100줄로 축소
- **Prometheus 환경 전수 조사 기록** — Job 15개, 타겟 현황, node-exporter UP/DOWN IP 목록, cAdvisor hostname 목록, 라벨 구조 등 영구 기록
- **PCM 메트릭 탐색 완료** — `AE-SMC-GNRAP_PCM` job: 66개 메트릭 확인. 카테고리별 분류 (CPU 3, Memory 14, Cache 9, Power 4, Interconnect 24, Other 12)
- **PCM 차트 기존 섹션 통합** — CPU 섹션에 IPC/캐시 적중률, Memory 섹션에 DRAM 대역폭, Hardware 전력 차트에 PP0 추가. 별도 섹션 아닌 기존 차트 확장 방식
- **서버 상세 페이지 메트릭 검증** — 전체 차트 1:1 대응 검증 스크립트 작성. k8-master(10.144.38.100) 기준 38/41 항목 정상 확인 (Fan/Power 3개는 해당 서버에 없음)
- **DB vs Prometheus 진단** — DB 6대 서버 데이터 정합성 확인 (ipAddress 모두 정상). s121x13ae003/013은 NE+cA 모두 정상, s222hax14ae011/012는 NE 스크랩 실패 확인
- **s222hax node-exporter 스크랩 실패 원인 확인** — Pod 정상 가동 + 9100 리스닝 중이나 Prometheus→서버 간 `context deadline exceeded`. Calico 삭제 후 호스트 네트워크 정상이나 Prometheus Pod 네트워크 캐시 미갱신 가능성

### 확인된 사항
- s121x13ae003과 s121x13ae013: 동일 스펙(144코어), 데이터 모두 정상. 003은 idle, 013은 워크로드 실행 중 — 화면 차이는 사용률 차이
- s222hax14ae011/012: node-exporter DOWN → cAdvisor 폴백만 동작 → 호스트 레벨 CPU/Memory/Disk 미표시. Prometheus Pod 재시작으로 복구 시도 필요
- PCM job 차이: s121 계열은 `PCM` job, s222hax 계열은 `AE-SMC-GNRAP_PCM` job. 쿼리는 job 무관하게 sum()으로 통합
- Docker DB 컨테이너: `firsttest-db-1`, API는 인증 필요하여 check 스크립트는 docker exec로 직접 조회
- hostname→IP 매핑 추가: k8-master→.100, s121x13ae013→.113

---

## 2026-05-22 (목)
### 완료
- **Infrastructure vs Servers 페이지 역할 분리** — Infrastructure=자산관리(CRUD/스펙/이력), Servers=운영모니터링(메트릭/비교). Infrastructure에서 Prometheus 차트 제거, "모니터링 →" 링크 추가
- **서버 상세에 메모리 요약 섹션 추가** — 슬롯 다이어그램 + 요약 카드 (용량/슬롯/타입/제조사/속도), "상세/편집 →" 링크
- **Power State (Running/Idle/OFF) 표시** — 서버 목록 + 서버 상세 + 인프라 상세에 실시간 가동 상태 배지 추가. Prometheus `up` + CPU 사용률로 판단, 30초 갱신
- **서버 목록 Power 필터** — Running/Idle/OFF 드롭다운 필터 + 헤더 카운트 요약
- **Load Average 차트에 CPU Cores 기준선** — 코어 수 시리즈 추가로 load 대비 비교 가능
- **CPU 히트맵 쿼리 안정화** — `sum(non-idle)` → `1 - avg(idle rate)` 변경. idle 모드는 항상 값이 있어 워크로드 0에서도 데이터 반환
- **Fleet TOP 중복 해결** — NE/cAdvisor 쿼리 분리, NE(IP:port) 우선 사용 후 cAdvisor(hostname) fallback. `instance=~".+:[0-9]+"` 필터로 hostname 중복 방지
- **Fleet 집계 수치 정확도 개선** — CPU 평균, 메모리 합계, 코어 카운트에 IP:port 필터 적용하여 double-counting 방지
- **메모리 슬롯 다이어그램 개선** — 16개/줄, Node(소켓)별 그룹, 사이즈 확대
- **서버 상세 페이지 loading skeleton** — 페이지 진입 시 빈 화면 대신 skeleton 표시
- **메모리 현황 페이지** — `/memory` 경로, 전체 서버 DIMM 현황 요약 + 필터 + 확장 테이블
- **check/ 스크립트 규칙 확립** — `check/targetExecCmd/YYYYMMDD.sh` 날짜별 파일, CLAUDE.md에 규칙 문서화
- **PowerStateIndicator 컴포넌트** — 재사용 가능한 클라이언트 컴포넌트, hostname/IP로 Prometheus 조회

### 확인된 사항
- **013 NE DOWN 원인**: `context deadline exceeded` — 마스터에서 curl도 timeout. 네트워크 경로 문제
- **node-exporter 이중 설정 발견**: DaemonSet(monitoring) + Prometheus static_configs(IP) 공존. 같은 서버가 hostname(DaemonSet)과 IP:port(static_configs)로 이중 scrape → 메트릭 중복
- **node-exporter DaemonSet 상태**: 43 Pod 중 Running 18, Pending 13, ImagePullBackOff 6, Evicted 2
- **NE DOWN 서버**: 105,113(013),61,62,82-84 — timeout 3대(네트워크), dial fail 4대(NE 미설치 또는 서버 OFF)
- **015만 메모리 데이터 있는 이유**: 5/21 최근 등록 시 BMC Redfish로 자동 수집. 나머지 서버는 HW Refresh 미실행
- **kubernetes-pods job이 9100 포트 중복 scrape**: node-exporter Pod를 K8s Pod 자동발견으로도 수집 → 자원 낭비 (기능 문제 아님)

### 이번 주 TODO
- [ ] **node-exporter 이중 설정 정리** — DaemonSet vs static_configs 중 하나로 통일. 현재 DaemonSet이 있지만 별도 YAML 배포한 NE도 있음 → 확인 후 결정
- [ ] **Prometheus ConfigMap 정리** — kubernetes-pods job에서 NE 중복 scrape 제거, hostname/IP 통일
- [ ] **node-exporter DaemonSet 정상화** — Pending/ImagePullBackOff Pod 원인 파악 및 복구
- [ ] **timeout 서버 네트워크 복구** — 013, 061, 062 서버의 Prometheus→NE 경로 점검
- [ ] **전체 서버 HW Refresh** — BMC가 있는 서버 메모리 정보 일괄 수집

### 다음 — Prometheus config 정리 + Lab-3 확장

- [ ] **PCM 차트 화면 검증** — 배포 후 013 서버에서 IPC/캐시/DRAM 차트 표시 확인. 빈 차트는 메트릭 이름 수정
- [ ] **s222hax node-exporter 복구** — Prometheus Pod 재시작 (`kubectl rollout restart`) 후 .61/.62 스크랩 정상화 확인
- [ ] **대시보드 fleet 메트릭 값 검증** — Lab-1/Lab-3 필터 적용 후 수치 정상 표시 확인

### 다음 — Prometheus config 정리 + Lab-3 확장

- [ ] **Prometheus ConfigMap hostname/IP 통일** — 모든 job 타겟의 instance 형식 불일치 파악 및 정리
- [ ] **Lab-3 서버 확장** — 클러스터2(10.144.131.100) 서버 메트릭 확인 및 지원

### 진행 중 — Lab-1 서버 메트릭 완성

- [x] ~~1단계: node-exporter 배포 및 데이터 수집 확인~~ (2026-05-15 완료)
- [x] ~~대시보드 fleet 쿼리 node-exporter 전환~~ (2026-05-15 완료)
- [x] ~~대시보드 Lab-1/Lab-3 클러스터 필터~~ (2026-05-19 완료)
- [x] ~~서버 상세 페이지 메트릭 검증 (s121x13ae013 기준)~~ (2026-05-19 완료)
- [x] ~~PCM 차트 기존 섹션 통합~~ (2026-05-19 완료)
- [ ] **PCM 메트릭 이름 검증 및 수정** — 실제 화면 배포 후 빈 차트 확인/수정
- [ ] **s222hax NE 복구 후 전체 서버 확인** — 6대 모두 정상 데이터 표시

### 인프라 구조 (확인됨)
- **Cluster 1 (Lab-1)**: 10.144.38.100 — K8s master, Grafana(30004) + Prometheus
- **Cluster 2 (Lab-3)**: 10.144.131.100 — K8s master-lab3, k8s-monitoring(prometheus) → Cluster 1으로 메트릭 전송

### 우선순위 높음
- [ ] **전체 시스템 메모리 현황 조회 기능** — 서버별 장착된 DIMM 개수와 총 메모리 용량을 한눈에 확인하는 기능. 대시보드 또는 별도 페이지에서 전체 서버의 메모리 장착 현황(슬롯 수, 용량, 타입) 집계 표시
- [ ] **DRAM 인증 테스트 구성 관리** — 파트넘 기반으로 테스트 계획 생성, 서버별 DIMM 할당, 진행 상태 추적 (PLANNED→LOADED→TESTING→DONE). 3단계 워크플로우: 파트넘 입력 → 서버 선택 → 수량 지정
- [ ] **DRAM 파트넘 자동 조회 + 워크로드 기반 일괄 지정** — dmidecode로 서버별 DIMM 파트넘 자동 수집 (textfile collector 또는 SSH), Prometheus stress 라벨로 동일 워크로드 서버 감지, 같은 DRAM 제품군 서버를 자동 그룹핑하여 테스트 구성에 일괄 할당. 사전 확인: dmidecode 출력 구조 확인 스크립트 필요

### 우선순위 중간
- [ ] **Capacity 용량 예측 (Forecast)** — /capacity 현황 페이지에 추세 기반 예측 추가. 데이터 소스는 DB 기반(장비 증가/랙 사용률)으로 설계해 로컬 검증 가능하게. (B유형: 구현 후 서버 확인)
- [ ] **장애 시나리오 매뉴얼** — recovery.sh와 짝이 되는 장애 대응 절차 문서. 서버 무관, 문서 작업. (B유형)
- [ ] **UI/디자인 개선** — 전체 페이지 디자인 통일, 색상/간격/타이포 토큰 정리, 반응형 개선, 빈 상태(EmptyState) UX 향상, 테이블/카드 레이아웃 일관성. 마지막 단계에서 진행
- [ ] **to-prd 적용** — DRAM 인증 테스트 관리 등 큰 기능 구현 전 기획서(PRD) 작성. `/to-prd` 커맨드로 합의 내용을 기획서로 정리
- [ ] **to-issues 적용** — TODO 항목을 GitHub Issue로 분리. `/to-issues` 커맨드로 작업 단위 쪼개기
- [ ] **improve-codebase 적용** — check/ 스크립트 정리, 되돌린 코드 잔재 제거, 중복 코드 정리. `/improve-codebase` 커맨드로 주기적 정리
- [ ] 메트릭 없는 서버의 상세 페이지 처리 — "이 서버에서 지원하지 않는 메트릭입니다" 안내
- [ ] 온도 데이터 연동 — 외부 SQL DB 연결 (Grafana PDU monitoring 데이터소스)
- [ ] 서버 상세 페이지 실시간 WebSocket 메트릭

### 우선순위 낮음
- [ ] 장비 등록 시 Rack/U position 자동 할당
- [ ] PDF 리포트 내보내기
- [ ] E2E 테스트 (Discovery → Register → Monitor 플로우)

---

## 2026-06-05 (목)
### 완료
- **Fleet Top CPU/Memory 중복 표시 수정** — dedupTopResults에서 canonical IP 키 기반 dedup + PrometheusTarget 테이블 hostname-IP 매핑 활용. 같은 서버가 IP+hostname으로 이중 표시되던 문제 해결
- **운영 자동화 4종 구현 (Phase 4)**
  - `scripts/backup-db.sh` — DB 백업 자동화 (pg_dump + gzip, 7일 보관, cron 매일 03:00, 복원 기능)
  - `scripts/setup-logrotate.sh` — 앱 로그 로테이션 (50MB 또는 매일, 7일 보관 + 압축, cron 매일 04:00)
  - `scripts/recovery.sh` — 대화형 장애 복구 메뉴 (시스템 상태 진단, 앱/DB 재시작, 백업 복원, 에러 로그 조회)
  - `deploy-update.sh` 개선 — DB 확인 + 배포 전 자동 백업 + git pull + 마이그레이션 + 서버 시작 후 헬스체크 + 배포 로그 기록
- **대시보드 ExpiryTracker crash 수정** — try-catch로 분리 + migration 파일 추가
- **Evaluations 사이드바 제거** — 미사용 메뉴 숨김
- **종료된 워크로드 Active 탭 표시** — Prometheus에서 사라진 namespace의 EvalProject를 Active 탭 하단에 표시
- **CLAUDE.md 영향 분석 규칙 추가** — 코드 수정 시 영향 범위 전수 점검 필수화
- **Prometheus 진단 orphan 오탐 보강** — IP↔hostname 이중성으로 인한 prometheusOrphans/dbOrphans 오탐을 모든 주소 형태(ipAddress + prometheusInstance host + hostname) 검사로 수정
- **신규 기능 3종 구현**
  - 메트릭 없는 서버 안내 — 서버 상세 페이지에서 Prometheus 시계열이 전혀 없으면 안내 배너 표시 (빈 차트 대신)
  - Audit Log 확장 — users(POST/PATCH), alert-rules(POST/PATCH/DELETE), discovery(register/unregister) 6개 라우트에 logAudit 추가. /history 페이지에서 자동 표시
  - 알림 심각도별 대시보드 위젯 — 심각도별 현재 firing 수(주) + 24시간 발생 수(보조) 타일
  - (확인) 메모리 현황 / 서버 비교 오버레이 / 장비 타임라인은 이미 구현되어 있어 재구현 없이 검증만 수행
