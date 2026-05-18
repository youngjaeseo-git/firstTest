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

## Infrastructure (인프라 주소 정리)

### Cluster 1 — Lab-1 (10.144.38.100)
- **역할**: K8s master node, 모든 모니터링 데이터 수집 중심
- **Grafana**: `http://10.144.38.100:30004` (대시보드 예: `/d/nDyQuG9Hk/ae-d-c-server-status`)
- **Prometheus**: K8s Service `prometheus-service` (namespace: monitoring)
  - ClusterIP: `http://10.100.175.248:8080` (클러스터 내부 — 앱 코드 + check 스크립트 모두 이 주소 사용)
  - NodePort: `8080:30003/TCP` (외부 접근용이나 `/api/v1/status/build` 404 확인됨, 추가 검증 필요)
- **DCIM 앱**: `http://10.144.38.100:3000` (Next.js + PostgreSQL)

### Cluster 2 — Lab-3 (10.144.131.100)
- **역할**: K8s master-lab3 node
- **Prometheus**: k8s-monitoring → Cluster 1으로 메트릭 federation/전송
- **작업 순서**: Lab-1 서버 메트릭 완성 후 Lab-3 확장 (TODO)

### 앱 코드에서의 Prometheus 접속
- `src/lib/prometheus.ts`의 `PROMETHEUS_URL` 환경변수
- Docker 내부: ClusterIP `http://10.100.175.248:8080` 사용
- check 스크립트: NodePort `http://10.144.38.100:30003` 사용
- **중요**: 두 URL은 같은 Prometheus 서비스를 가리킴. 접근 경로만 다름

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
1. **확인 스크립트 작성**: `check/` 폴더에 `YYYYMMDD-{내용}.sh` 형식으로 스크립트 생성
   - 예: `check/20260422-prometheus-labels.sh`
   - 스크립트는 서버에서 `bash check/파일명.sh > 결과파일.txt 2>&1` 한 줄로 실행 가능해야 함
2. **사용자에게 실행 요청**: 스크립트를 push하고 실행 결과를 요청
3. **결과 분석 후 구현**: 실제 응답 데이터의 라벨, 필드명, 값 형식을 확인한 뒤에만 코드 작성
4. **검증 범위 명시**: TypeScript/빌드 통과는 문법 검증일 뿐, 실제 데이터 연동 동작은 별도 확인 필요 → 사용자에게 명확히 전달

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

### 확인된 Prometheus 환경 (2026-05-19 기준)

**메트릭 소스:**
- **node_exporter 사용 가능** — DaemonSet 배포, bare-metal 수준 메트릭 제공 (21 타겟)
  - instance 형식: IP:port (예: `10.144.38.103:9100`)
  - job 이름: `node-exporter` (+ `kubernetes-pods` 중복 수집)
  - 수집 메트릭: node_cpu_seconds_total, node_memory_*, node_filesystem_*, node_disk_*, node_network_*, node_load*, node_hwmon_*, node_boot_time_seconds 등
- **cAdvisor**: CPU, Memory, Disk, Network (컨테이너 레벨 합산, node-exporter 폴백용)
- **Intel PCM**: Power (Package_Joules_Consumed)
- **DCIM 앱 쿼리 전략**: node-exporter 우선, cAdvisor 폴백 (`queries.*` 함수에서 PromQL `or` 사용)

**cAdvisor 쿼리 규칙 (K8s 환경):**
- `id="/"` 사용 금지 — K8s cAdvisor에서 root cgroup이 존재하지 않음
- `container!=""` 사용 — 실제 컨테이너만 선택, cgroup 계층 중복 방지
- `machine_*` 메트릭은 `container` 라벨 없음, 필터 불필요

**확인된 라벨 구조 (2026-04-27 s121x13ae013):**
- `container_cpu_usage_seconds_total`: container=`POD`, id=`/kubepod.slice/...` (count=21)
- `container` 라벨 값: `POD` (pause container), 또는 실제 컨테이너 이름
- `id` 라벨 값: `/kubepods.slice/kubepods-besteffort.slice/...` (root cgroup `/` 없음)
- labels: `__name__`, `container`, `cpu`, `group`, `id`, `image`, `instance`, `job`, `namespace`, `pod`, `stress` 등

**Job별 instance 형식 (2026-05-19 확인):**

| Job | 형식 | 타겟 수 | up | down |
|-----|------|---------|-----|------|
| node-exporter | IP:port | 21 | 17 | 4 |
| kubernetes-pods | IP:port | 23 | 17 | 6 |
| kubernetes-cadvisor | HOSTNAME | 43 | 24 | 19 |
| kubernetes-nodes | HOSTNAME | 43 | 24 | 19 |
| QRA-SMC-DDR5-Dell | IP:port | 136 | 136 | 0 |
| QRA-SMC-DDR5-PCM | HOSTNAME | 50 | 1 | 49 |
| QRA-SMC-DDR5-EMR_PCM | HOSTNAME | 40 | 0 | 40 |
| AE-SMC-GNRAP_PCM | HOSTNAME | 11 | 7 | 4 |
| AE-SMC-GNRSP_PCM | HOSTNAME | 10 | 10 | 0 |
| AE-SMC-SRF_PCM | HOSTNAME | 5 | 0 | 5 |
| PCM | HOSTNAME | 41 | 15 | 26 |
| server-info | HOSTNAME | 41 | 14 | 27 |
| kube-state-metrics | HOSTNAME | 1 | 1 | 0 |
| kubernetes-apiservers | IP:port | 1 | 1 | 0 |
| kubernetes-service-endpoints | IP:port | 4 | 4 | 0 |
| temperature | IP:port | 1 | 0 | 1 |

**node-exporter 타겟 전체 목록 (21개):**
- 10.144.38.61, .62, .81, .82, .83, .84
- 10.144.38.100, .103, .105, .106, .107
- 10.144.38.113, .114, .115
- 10.144.38.125, .128, .129, .131, .132, .133, .134
- 포트: 모두 :9100

**kubernetes-cadvisor 타겟 (up 24개, hostname):**
- g222bx14ae001 (2개 중복), k8-master
- s121x13ae003, 005, 006, 007, 008, 013, 014, 015, 025, 028, 029, 031, 032, 033, 034
- s222hax14ae011, 012
- s222hx14ae021, 022, 023, 024

**hostname→IP 매핑 (확인된 것):**
- s222hax14ae011 → 10.144.38.61
- s222hax14ae012 → 10.144.38.62

**서버 다양성:**
- CPU: Intel (SRF, SPR, GNR, EMR), AMD (Turin), ARM (Ampere) 등 혼재
- 제조사: SMC(Supermicro), Dell 등 혼재
- 조직: 자체 서버 외에 다른 조직 서버도 포함 (정확한 정보 없을 수 있음)
- 워크로드 라벨: `stress: "stress"` = stressapptest 메모리 에러 검증용

**서버별 메트릭 가용성 예시:**
- `s222hax14ae011` → AE-SMC-GNRAP_PCM + kubernetes-cadvisor + kubernetes-nodes + kubernetes-pods(IP:10.144.38.61:9100) — 4 job
- `s222hax14ae012` → AE-SMC-GNRAP_PCM + kubernetes-cadvisor + kubernetes-nodes + kubernetes-pods(IP:10.144.38.62:9100) — 4 job (동일 구성)
- 두 서버 모두 node-exporter 타겟에 IP로 포함됨 (61, 62)

**히트맵 차이 원인 (2026-05-19 확인):**
- node-exporter는 IP:port 형식, cadvisor는 hostname 형식
- 앱에서 hostIp(DB의 ipAddress 필드)가 있어야 node-exporter 매칭 가능
- DB에 ipAddress가 누락된 서버는 hostname으로 node-exporter를 찾아 실패 → 히트맵 안 나옴

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
