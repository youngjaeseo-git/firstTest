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

## TODO (해야 할 일)

### 이번 주 — 서버별 메트릭 세부 검증
> node-exporter가 정상 배포된 상태. 대시보드 fleet 쿼리를 node-exporter 우선으로 전환 완료.
> 이제 서버 유형별 1대씩 세부 수치를 화면과 비교하여 정확성 검증 필요.

- [ ] **서버 유형별 1대씩 세부 비교** — 각 시스템 군에서 대표 서버 1대를 선정, 화면에 표시되는 수치와 실제 Prometheus 값을 비교하여 정확성 검증
- [ ] **대시보드 fleet 메트릭 값 검증** — node-exporter 전환 후 CPU/Memory/Network/Uptime 수치가 화면에 정상 표시되는지 확인

### 다음 주 — Prometheus config 정리 (hostname/IP 불일치)
> Prometheus scrape config에서 타겟을 IP로 쓴 곳과 호스트네임으로 쓴 곳이 혼재.
> 같은 서버 군(예: s222hax14ae011 vs s222hax14ae012)인데 하나는 히트맵이 나오고 하나는 안 나오는 등 불일치 발생.

- [ ] **Prometheus ConfigMap 전수 조사** — 모든 job의 타겟 목록을 추출하여 IP/호스트네임 형식 불일치 파악
- [ ] **node-exporter 타겟 누락 확인** — 21개 타겟 중 어떤 서버가 빠져있는지 확인, 필요시 추가
- [ ] **instance 라벨 통일 방안 수립** — relabeling 또는 config 수정으로 일관된 instance 형식 확보
- [ ] **히트맵 표시 누락 서버 수정** — config 정리 후 동일 스펙 서버군 전체에서 히트맵 정상 표시 확인

### 진행 중 — Lab-1 서버 메트릭 완성
> 클러스터1(Lab-1, 10.144.38.100) 서버의 모든 차트가 정상 표시되도록 완성한다.
> node-exporter 우선, cAdvisor 폴백 전략 적용 완료.
> 완료 후 Lab-3(10.144.131.100) 서버로 확장.

- [x] ~~1단계: node-exporter 배포 및 데이터 수집 확인~~ (2026-05-15 완료)
- [x] ~~대시보드 fleet 쿼리 node-exporter 전환~~ (2026-05-15 완료, `id="/"` 제거)
- [ ] **2단계: 서버별 세부 메트릭 정확성 검증** — 서버 유형별 대표 1대씩 비교
- [ ] **3단계: Lab-3 서버 확장** — 클러스터2(Lab-3, 10.144.131.100) 서버 메트릭 확인 및 지원

### 인프라 구조 (확인됨)
- **Cluster 1 (Lab-1)**: 10.144.38.100 — K8s master, Grafana(30004) + Prometheus
- **Cluster 2 (Lab-3)**: 10.144.131.100 — K8s master-lab3, k8s-monitoring(prometheus) → Cluster 1으로 메트릭 전송

### 우선순위 높음
- [ ] **전체 시스템 메모리 현황 조회 기능** — 서버별 장착된 DIMM 개수와 총 메모리 용량을 한눈에 확인하는 기능. 대시보드 또는 별도 페이지에서 전체 서버의 메모리 장착 현황(슬롯 수, 용량, 타입) 집계 표시
- [ ] **DRAM 인증 테스트 구성 관리** — 파트넘 기반으로 테스트 계획 생성, 서버별 DIMM 할당, 진행 상태 추적 (PLANNED→LOADED→TESTING→DONE). 3단계 워크플로우: 파트넘 입력 → 서버 선택 → 수량 지정
- [ ] **DRAM 파트넘 자동 조회 + 워크로드 기반 일괄 지정** — dmidecode로 서버별 DIMM 파트넘 자동 수집 (textfile collector 또는 SSH), Prometheus stress 라벨로 동일 워크로드 서버 감지, 같은 DRAM 제품군 서버를 자동 그룹핑하여 테스트 구성에 일괄 할당. 사전 확인: dmidecode 출력 구조 확인 스크립트 필요

### 우선순위 중간
- [ ] 메트릭 없는 서버의 상세 페이지 처리 — "이 서버에서 지원하지 않는 메트릭입니다" 안내
- [ ] 온도 데이터 연동 — 외부 SQL DB 연결 (Grafana PDU monitoring 데이터소스)
- [ ] 서버 상세 페이지 실시간 WebSocket 메트릭

### 우선순위 낮음
- [ ] 장비 등록 시 Rack/U position 자동 할당
- [ ] PDF 리포트 내보내기
- [ ] E2E 테스트 (Discovery → Register → Monitor 플로우)
