# DC Express 기술 데이터 플로우 문서

> 엔지니어 관점에서 모든 화면의 데이터 소스, 프로토콜, 기술 스택을 정리한 문서
> 작성일: 2026-06-17

---

## 1. 시스템 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                                │
│  React (Next.js App Router) + Zustand + Recharts + D3.js          │
└───────────┬───────────────────┬───────────────────┬─────────────────┘
            │ HTTP/SSE          │ HTTP REST          │ Next.js RSC
            ▼                   ▼                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                    Next.js API Routes (74개)                      │
│  /api/metrics/*  /api/equipment/*  /api/alerts/*  /api/racks/*   │
│  /api/discovery/*  /api/workloads/*  /api/capacity/*  ...        │
└───┬──────────┬──────────────┬─────────────┬──────────────────────┘
    │          │              │             │
    ▼          ▼              ▼             ▼
┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐
│Promethe│ │PostgreSQL│ │BMC/IPMI  │ │kube-state-metrics    │
│us      │ │(Prisma)  │ │(Redfish) │ │(Prometheus 경유)     │
│        │ │          │ │          │ │                      │
│시계열   │ │자산/설정  │ │전원/센서  │ │K8s 파드/노드 정보     │
│메트릭   │ │데이터     │ │HW 정보   │ │                      │
└────────┘ └──────────┘ └──────────┘ └──────────────────────┘
```

### 데이터 소스 요약

| 데이터 소스 | 접속 정보 | 용도 | 프로토콜 |
|-------------|-----------|------|----------|
| **Prometheus** | `http://10.100.175.248:8080` (K8s ClusterIP) | 시계열 메트릭 (CPU, 메모리, 온도, 전력, 네트워크) | HTTP (PromQL) |
| **PostgreSQL** | Docker 내부 (`DATABASE_URL`) | 자산 관리, 설정, 알림 규칙, 사용자, 감사로그 | Prisma ORM |
| **BMC/Redfish** | 각 서버 BMC IP (예: `192.168.10.x`) | 전원 제어, HW 인벤토리, 센서 데이터 | HTTPS (Redfish REST API) |
| **BMC Proxy** | `http://10.144.131.100:8443` (Lab-3) | Lab-3 BMC 접근용 리버스 프록시 | HTTP → HTTPS 변환 |
| **kube-state-metrics** | Prometheus 경유 | K8s 파드/노드 상태 | PromQL (kube_pod_info 등) |

---

## 2. 페이지별 데이터 플로우 상세

### 2.1 대시보드 (`/`)

| UI 위젯 | API 엔드포인트 | 데이터 소스 | PromQL / Prisma 쿼리 | 프로토콜 |
|---------|---------------|-------------|----------------------|----------|
| 서버 가동 현황 (UP/DOWN) | `/api/metrics/dashboard/stream` | Prometheus | `up{job!~"kube-state-metrics\|..."}` | SSE (15초 간격) |
| 평균 CPU 사용률 | `/api/metrics/dashboard/stream` | Prometheus | `(1 - avg(rate(node_cpu_seconds_total{mode="idle",job="node-exporter"}[5m]))) * 100 or cAdvisor 폴백` | SSE |
| 평균 메모리 사용률 | `/api/metrics/dashboard/stream` | Prometheus | `(1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes)) * 100 or cAdvisor` | SSE |
| 총 전력 소비량 | `/api/metrics/dashboard/stream` | Prometheus | `sum(rate(Package_Joules_Consumed[5m]))` (Intel PCM) | SSE |
| 평균 온도 | `/api/metrics/dashboard/stream` | Prometheus | `avg(node_hwmon_temp_celsius)` | SSE |
| 네트워크 트래픽 | `/api/metrics/dashboard/stream` | Prometheus | `sum(rate(node_network_receive_bytes_total{device!~"lo\|veth.*\|..."}[5m]))` | SSE |
| 평균 업타임 | `/api/metrics/dashboard/stream` | Prometheus | `avg(time() - node_boot_time_seconds)` | SSE |
| 클러스터 필터 (All/Lab-1/Lab-3) | `/api/metrics/dashboard/stream?cluster=lab1` | Prometheus | 쿼리에 `instance=~"10.144.38..*"` 필터 추가 | SSE |
| Fleet Top 5 CPU | `/api/metrics/instant` | Prometheus | `topk(10, (1 - avg by(instance)(...)) * 100)` | HTTP GET |
| Fleet Top 5 Memory | `/api/metrics/instant` | Prometheus | `topk(10, (1 - node_memory_MemAvailable/MemTotal) * 100)` | HTTP GET |
| Trend Sparkline | `/api/metrics/range` | Prometheus | 위 쿼리들의 range 버전 (시간 범위 지정) | HTTP GET |
| PUE 위젯 | `/api/metrics/instant` | Prometheus | `dcim_pue or (sum(power) * 1.35) / sum(power)` | HTTP GET |
| Platform 분포 | Server Component | PostgreSQL | `prisma.equipment.groupBy({ by: ['manufacturer'] })` | 직접 쿼리 |
| 만료 임박 위젯 | Server Component | PostgreSQL | `prisma.expiryTracker.findMany({ where: { status: 'ACTIVE' } })` | 직접 쿼리 |
| 알림 심각도 위젯 | Server Component | PostgreSQL | `prisma.alert.groupBy({ by: ['severity'], where: { status: 'FIRING' } })` | 직접 쿼리 |
| Prometheus 연결 상태 | `/api/metrics/health` | Prometheus | `up{}` 응답 가능 여부 | HTTP GET |

**SSE 스트림 구조**: `/api/metrics/dashboard/stream` → `fetchDashboardMetrics()` → 8개 PromQL 쿼리를 `Promise.allSettled`로 병렬 실행 → 15초마다 `text/event-stream`으로 push

---

### 2.2 서버 모니터링 (`/servers`, `/servers/[id]`)

#### 서버 목록 (`/servers`)

| UI 항목 | 데이터 소스 | 쿼리 |
|---------|-------------|------|
| 서버 목록 테이블 | PostgreSQL | `prisma.equipment.findMany({ where: { type: 'SERVER' } })` |
| UP/DOWN 상태 | Prometheus | `up{instance=~"IP(:.*)?"}` |

#### 서버 상세 (`/servers/[id]`)

| UI 섹션 | API | 데이터 소스 | PromQL 메트릭 | 프로토콜 |
|---------|-----|-------------|---------------|----------|
| **CPU 사용률** | `/api/metrics/range` | Prometheus | `node_cpu_seconds_total{mode="idle"}` (node-exporter) or `container_cpu_usage_seconds_total` (cAdvisor) | HTTP |
| **CPU 코어별 히트맵** | `/api/metrics/instant` | Prometheus | `(1 - avg by(cpu)(rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100` | HTTP |
| **CPU 모드 분석** (user/system/iowait/steal) | `/api/metrics/range` | Prometheus | `avg(rate(node_cpu_seconds_total{mode="user"}[5m])) * 100` 등 | HTTP |
| **Load Average** (1/5/15) | `/api/metrics/instant` | Prometheus | `node_load1`, `node_load5`, `node_load15` | HTTP |
| **메모리 사용률** | `/api/metrics/range` | Prometheus | `node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes` or `container_memory_working_set_bytes / machine_memory_bytes` | HTTP |
| **메모리 상세** (Used/Cached/Swap) | `/api/metrics/instant` | Prometheus | `node_memory_Cached_bytes + node_memory_Buffers_bytes`, `node_memory_SwapTotal_bytes - node_memory_SwapFree_bytes` | HTTP |
| **디스크 사용률** | `/api/metrics/range` | Prometheus | `node_filesystem_avail_bytes / node_filesystem_size_bytes` | HTTP |
| **디스크 I/O** (Read/Write Throughput) | `/api/metrics/range` | Prometheus | `rate(node_disk_read_bytes_total[5m])`, `rate(node_disk_written_bytes_total[5m])` | HTTP |
| **디스크 IOPS/Latency** | `/api/metrics/range` | Prometheus | `rate(node_disk_reads_completed_total[5m])`, read/write latency 계산 | HTTP |
| **파일시스템 마운트 목록** | `/api/metrics/instant` | Prometheus | `node_filesystem_size_bytes{fstype!~"tmpfs\|..."}` | HTTP |
| **네트워크 Rx/Tx** | `/api/metrics/range` | Prometheus | `rate(node_network_receive_bytes_total{device!~"lo\|veth.*"}[5m])` | HTTP |
| **네트워크 에러/드롭** | `/api/metrics/range` | Prometheus | `rate(node_network_receive_errs_total[5m])` 등 | HTTP |
| **네트워크 인터페이스 목록** | `/api/metrics/instant` | Prometheus | `node_network_info`, `node_network_speed_bytes`, `node_network_up` | HTTP |
| **TCP 연결** | `/api/metrics/instant` | Prometheus | `node_netstat_Tcp_CurrEstab`, `rate(node_netstat_TcpExt_TCPRetransSegs[5m])` | HTTP |
| **온도** (Inlet/Exhaust/CPU) | `/api/metrics/range` | Prometheus | `node_hwmon_temp_celsius` or `{job="temperature",type=~"inlet\|cpu"}` | HTTP |
| **팬 속도** | `/api/metrics/instant` | Prometheus | `node_hwmon_fan_rpm` or `{job="temperature",type="fan"}` | HTTP |
| **전력** (Package/DRAM/PP0) | `/api/metrics/range` | Prometheus | `rate(Package_Joules_Consumed[5m])`, `rate(DRAM_Joules_Consumed[5m])`, `rate(PP0_Joules_Consumed[5m])` (Intel PCM) | HTTP |
| **PCIe/PCM 성능** | `/api/metrics/range` | Prometheus | `Instructions_Retired_Any / Clock_Unhalted_Ref` (IPC), `L2_Cache_Hits / (Hits+Misses)`, `DRAM_Reads`, `DRAM_Writes` (Intel PCM) | HTTP |
| **프로세스** (Running/Blocked) | `/api/metrics/instant` | Prometheus | `node_procs_running`, `node_procs_blocked` | HTTP |
| **파일 디스크립터** | `/api/metrics/instant` | Prometheus | `node_filefd_allocated / node_filefd_maximum * 100` | HTTP |
| **업타임** | `/api/metrics/instant` | Prometheus | `time() - node_boot_time_seconds` | HTTP |
| **K8s 노드 정보** | `/api/metrics/instant` | Prometheus (kube-state-metrics) | `kube_node_status_capacity{resource="cpu\|memory"}`, `kubelet_running_pods`, `kube_pod_info{node=~"IP.*"}` | HTTP |
| **CPU/Memory 파드별 사용** | `/api/metrics/instant` | Prometheus (cAdvisor) | `sum by(pod, namespace)(rate(container_cpu_usage_seconds_total[5m]))` | HTTP |
| **서버 기본 정보** | Server Component | PostgreSQL | `prisma.equipment.findUnique()` with cpus, memories, networkPorts, rack.room | 직접 쿼리 |
| **전원 상태** | `/api/equipment/[id]/power` | BMC/Redfish | `GET /redfish/v1/Systems/1` → `PowerState` | HTTPS |
| **BMC 센서** | `/api/equipment/[id]/sensors` | BMC/Redfish | `GET /redfish/v1/Chassis/1/Thermal`, `GET /redfish/v1/Chassis/1/Power` | HTTPS |

**메트릭 쿼리 전략**: 모든 쿼리는 `node-exporter 우선 or cAdvisor 폴백` 패턴을 사용. node-exporter는 `IP:port` 형식의 instance 라벨, cAdvisor는 `hostname` 형식.

**시간 범위**: 사용자 선택 가능 (15분, 1시간, 6시간, 24시간). range query에 start/end/step 파라미터로 전달.

---

### 2.3 랙 뷰 (`/racks`, `/racks/manage`)

| UI 기능 | API | 데이터 소스 | 쿼리/모델 | 프로토콜 |
|---------|-----|-------------|-----------|----------|
| 랙 목록 (Room별 그룹) | Server Component (ISR 30초) | PostgreSQL | `prisma.rack.findMany({ include: { room, equipment, pdus } })` | 직접 쿼리 |
| 랙 엘리베이션 다이어그램 | 위 데이터에서 계산 | PostgreSQL | Equipment의 rackPosition/rackHeight로 U 슬롯 계산 | - |
| 온도 히트맵 오버레이 | `GET /api/metrics/node-temps` | Prometheus + PostgreSQL | `avg by(instance)(node_hwmon_temp_celsius)` + hostname-resolver | HTTP |
| 장비 드래그앤드롭 이동 | `PUT /api/equipment/[id]` | PostgreSQL | `prisma.equipment.update({ rackPosition })` + `checkRackPlacement()` 검증 | HTTP |
| 미배치 장비 추가 | `GET /api/equipment?unracked=true` | PostgreSQL | `prisma.equipment.findMany({ where: { rackId: null } })` | HTTP |
| 장비 랙 제거 | `PUT /api/equipment/[id]` | PostgreSQL | `rackId: null, rackPosition: null` | HTTP |
| 일괄 배치 | `POST /api/equipment/bulk-place` | PostgreSQL | 트랜잭션으로 다수 장비 배치 + 충돌 검증 | HTTP |
| Room CRUD | `POST/PATCH/DELETE /api/rooms` | PostgreSQL | `prisma.room.create/update/delete` | HTTP |
| Rack CRUD | `POST/PATCH/DELETE /api/racks` | PostgreSQL | `prisma.rack.create/update/delete` | HTTP |

**배치 검증 로직** (`src/lib/rack-placement.ts`):
- U 위치 >= 1, 랙 총 유닛 초과 불가
- 같은 랙 내 다른 장비와 겹침 불가
- 벌크 배치 시 배치 간 충돌도 사전 검증

---

### 2.4 디지털 트윈 (`/digital-twin`)

| UI 기능 | API | 데이터 소스 | 쿼리 | 프로토콜 |
|---------|-----|-------------|------|----------|
| 바닥평면도 (SVG) | Server Component | PostgreSQL | `prisma.room.findMany({ include: { racks: { include: { equipment } }, elements } })` | 직접 쿼리 |
| 서버 UP/DOWN 상태 | `GET /api/metrics/instant` | Prometheus | `up{job!~"kube-state-metrics\|..."}` | HTTP (30초 폴링) |
| 서버 CPU 활동 (Running/Idle) | `GET /api/metrics/instant` | Prometheus | `(1-avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])))*100` | HTTP (30초 폴링) |
| 온도 오버레이 | `GET /api/metrics/node-temps` | Prometheus | `avg by(instance)(node_hwmon_temp_celsius)` | HTTP (30초 폴링) |
| 공간 사용률 오버레이 | 로컬 계산 | PostgreSQL 데이터 | equipment.length / rack.totalUnits * 100 | - |
| 에어플로우 오버레이 | 로컬 렌더링 | - | RoomElement.metadata.airflowDirection | - |
| 랙/요소 위치 편집 | `PATCH /api/racks/[id]`, `PATCH /api/room-elements/[id]` | PostgreSQL | positionX/Y, width/height 업데이트 | HTTP |
| Room 요소 CRUD | `POST/DELETE /api/room-elements` | PostgreSQL | `RoomElement` (COOLING, PDU, SWITCH, DOOR 등) | HTTP |
| Room 레이아웃 편집 | `PATCH /api/rooms/[id]` | PostgreSQL | layoutX/Y/W/H 업데이트 | HTTP |

**3단계 드릴다운**: DataCenter 전체 → Room 바닥평면도 → Rack 엘리베이션 (클라이언트 사이드 상태 전환)

---

### 2.5 인프라 관리 (`/infrastructure/*`)

| UI 기능 | API | 데이터 소스 | 모델/쿼리 | 프로토콜 |
|---------|-----|-------------|-----------|----------|
| 장비 목록 테이블 | Server Component | PostgreSQL | `prisma.equipment.findMany({ include: { rack: { include: { room } }, cpus } })` | 직접 쿼리 |
| 장비 등록 | `POST /api/equipment` | PostgreSQL | `prisma.equipment.create()` + CPU/Memory/Network 관계 | HTTP |
| 장비 수정 | `PUT /api/equipment/[id]` | PostgreSQL | `prisma.equipment.update()` + Zod 검증 | HTTP |
| 장비 삭제 | `DELETE /api/equipment/[id]` | PostgreSQL | 감사 로그 기록 후 삭제 | HTTP |
| 장비 상태 변경 | `PATCH /api/equipment/[id]/status` | PostgreSQL | ACTIVE↔MAINTENANCE↔REPAIR↔DECOMMISSIONED↔DISPOSED | HTTP |
| HW 정보 새로고침 | `POST /api/equipment/[id]/refresh-hw` | BMC/Redfish | `getSystemHwInfo()` → CPU/Memory/NIC 자동 갱신 | HTTPS |
| BMC 센서 보기 | `GET /api/equipment/[id]/sensors` | BMC/Redfish | `getSensorsData()` → Thermal + Power | HTTPS |
| 전원 제어 | `POST /api/equipment/[id]/power` | BMC/Redfish | `resetSystem(On\|ForceOff\|GracefulShutdown\|...)` | HTTPS |
| 메모리 DIMM 슬롯 정보 | Server Component | PostgreSQL | `prisma.equipmentMemory.findMany({ where: { equipmentId } })` | 직접 쿼리 |
| DIMM 슬롯 편집 | `PUT /api/equipment/[id]/memory` | PostgreSQL | `EquipmentMemory` 모델 CRUD | HTTP |
| CSV 벌크 임포트 | `POST /api/equipment/bulk` | PostgreSQL | Zod 검증 → 트랜잭션으로 다수 장비 생성 | HTTP |
| 장비 히스토리 | `GET /api/equipment/[id]/history` | PostgreSQL | `prisma.auditLog.findMany({ where: { entityId } })` | HTTP |
| 변경 이력 조회 | Server Component | PostgreSQL | `prisma.auditLog.findMany()` | 직접 쿼리 |
| 장비 할당 관리 | `POST/DELETE /api/equipment/[id]/assignments` | PostgreSQL | `EquipmentAssignment` 모델 | HTTP |

**장비 라이프사이클**: PLANNED → RECEIVING → INSTALLED → ACTIVE → MAINTENANCE/REPAIR → DECOMMISSIONED → DISPOSED

---

### 2.6 BMC/Redfish 연동 상세

```
┌──────────────┐     HTTPS (Basic Auth)      ┌──────────────┐
│ DCIM App     │ ──────────────────────────→  │ BMC (Lab-1)  │
│ (Lab-1)      │     /redfish/v1/Systems/1    │ 192.168.x.x  │
│ 10.144.38.100│                              └──────────────┘
│              │
│              │     HTTP                     ┌──────────────┐     HTTPS
│              │ ─→ BMC Proxy (Lab-3 Master)  │              │ ──→ │ BMC (Lab-3) │
│              │    10.144.131.100:8443        │ bmc-proxy.py │     │ 192.168.10.x│
└──────────────┘    /bmc-proxy/{bmcIp}/path   └──────────────┘     └─────────────┘
```

| Redfish 엔드포인트 | 용도 | DCIM API |
|-------------------|------|----------|
| `GET /redfish/v1/Systems` | 시스템 목록 조회 (Members 배열) | 내부 사용 (discoverSystemPath) |
| `GET /redfish/v1/Systems/1` | 전원 상태, 제조사, 모델, BIOS, CPU/Memory 요약 | `/api/equipment/[id]/power` (GET), `/api/equipment/[id]/refresh-hw` |
| `POST /redfish/v1/Systems/1/Actions/ComputerSystem.Reset` | 전원 제어 (On/ForceOff/GracefulShutdown/GracefulRestart/ForceRestart) | `/api/equipment/[id]/power` (POST) |
| `GET /redfish/v1/Systems/1/Processors` | CPU 컬렉션 | `/api/equipment/[id]/refresh-hw` |
| `GET /redfish/v1/Systems/1/Processors/{id}` | CPU 상세 (모델, 코어수, 스레드, 클럭, TDP) | `/api/equipment/[id]/refresh-hw` |
| `GET /redfish/v1/Systems/1/Memory` | 메모리 컬렉션 | `/api/equipment/[id]/refresh-hw` |
| `GET /redfish/v1/Systems/1/Memory/{id}` | DIMM 상세 (용량, 타입, 제조사, 파트넘, 속도, ECC) | `/api/equipment/[id]/refresh-hw` |
| `GET /redfish/v1/Systems/1/EthernetInterfaces` | NIC 컬렉션 | `/api/equipment/[id]/refresh-hw` |
| `GET /redfish/v1/Systems/1/EthernetInterfaces/{id}` | NIC 상세 (MAC, 속도, IP) | `/api/equipment/[id]/refresh-hw` |
| `GET /redfish/v1/Chassis/1/Thermal` | 온도 센서 + 팬 속도 | `/api/equipment/[id]/sensors` |
| `GET /redfish/v1/Chassis/1/Power` | 전원 공급 장치 + 소비 전력 | `/api/equipment/[id]/sensors` |

**인증**: HTTP Basic Auth (base64 인코딩). BMC 자격증명은 `Equipment.bmcIpAddress` + DB 저장 또는 기본값 사용.

**TLS**: BMC 자체 서명 인증서 → `rejectUnauthorized: false`로 무시.

**BMC Proxy** (`k8s/bmc-proxy/bmc-proxy.py`): Lab-3 마스터 노드에서 systemd 서비스로 실행. DCIM 앱(Lab-1)에서 직접 접근 불가능한 Lab-3 BMC(192.168.10.x 대역)에 대한 리버스 프록시.

---

### 2.7 K8s/워크로드 관리 (`/workloads`, `/workloads/[namespace]`)

| UI 기능 | API | 데이터 소스 | PromQL / Prisma 쿼리 | 프로토콜 |
|---------|-----|-------------|----------------------|----------|
| **파드 목록** (네임스페이스별) | `/api/metrics/instant` | Prometheus (kube-state-metrics) | `kube_pod_info{namespace!~"kube-system\|monitoring\|calico-*"}` | HTTP |
| **파드 생성 시간** | `/api/metrics/instant` | Prometheus (kube-state-metrics) | `kube_pod_created{namespace!~"kube-system\|..."}` | HTTP |
| **파드 상태** (Running/Pending/Succeeded/Failed) | `/api/metrics/instant` | Prometheus (kube-state-metrics) | `kube_pod_status_phase{namespace!~"kube-system\|..."}==1` | HTTP |
| **파드 대기 이유** (CrashLoopBackOff 등) | `/api/metrics/instant` | Prometheus (kube-state-metrics) | `kube_pod_container_status_waiting_reason{...}==1` | HTTP |
| **K8s 노드 정보** | `/api/metrics/instant` | Prometheus (kube-state-metrics) | `kube_node_info` | HTTP |
| **평가 프로젝트 목록** | `GET /api/evaluations` | PostgreSQL | `prisma.evalProject.findMany()` | HTTP |
| **평가 프로젝트 상세** | `GET /api/evaluations/[id]` | PostgreSQL | `prisma.evalProject.findUnique({ include: { phases, results, tasks, notes } })` | HTTP |
| **네임스페이스별 평가** | `GET /api/workloads/[namespace]` | PostgreSQL | `prisma.evalProject.findMany({ where: { namespace } })` | HTTP |
| **평가 생성/삭제** | `POST/DELETE /api/evaluations` | PostgreSQL | `EvalProject, EvalPhase, EvalResult, EvalTask, EvalNote` 모델 | HTTP |

**K8s 데이터 흐름**: K8s API → kube-state-metrics (Prometheus exporter) → Prometheus 수집 → DCIM 앱이 PromQL로 조회. 직접 K8s API 호출은 없음.

**워크로드 = K8s 파드 + DRAM 인증 평가**: 워크로드 페이지는 K8s 파드 정보(Prometheus)와 DRAM 인증 테스트 평가(PostgreSQL)를 함께 표시.

---

### 2.8 알림 관리 (`/alerts/*`)

| UI 기능 | API | 데이터 소스 | 모델/쿼리 | 프로토콜 |
|---------|-----|-------------|-----------|----------|
| **활성 알림 목록** | Server Component | PostgreSQL | `prisma.alert.findMany({ where: { status: 'FIRING' }, include: { rule, acknowledgement } })` | 직접 쿼리 |
| **알림 히스토리** (날짜별 접기) | Server Component | PostgreSQL | `prisma.alert.findMany({ orderBy: { firedAt: 'desc' } })` | 직접 쿼리 |
| **알림 확인 (Acknowledge)** | `POST /api/alerts/[id]/ack` | PostgreSQL | `prisma.alertAcknowledgement.create()` | HTTP |
| **알림 삭제** | `DELETE /api/alerts/delete` | PostgreSQL | `prisma.alert.deleteMany()` | HTTP |
| **알림 규칙 CRUD** | `GET/POST /api/alert-rules`, `GET/PUT/DELETE /api/alert-rules/[id]` | PostgreSQL | `prisma.alertRule.create/update/delete()` | HTTP |
| **알림 규칙 평가** | `GET /api/cron/alert-check` | Prometheus + PostgreSQL | 각 AlertRule의 PromQL 실행 → 임계값 비교 → Alert 생성 | HTTP |
| **알림 채널 설정** | `GET/POST /api/notification-channels` | PostgreSQL | `NotificationChannel` 모델 (EMAIL, SLACK, TEAMS, WEBHOOK) | HTTP |
| **에스컬레이션 정책** | `GET/POST /api/escalation-policies` | PostgreSQL | `EscalationPolicy` 모델 (미확인 N분 후 에스컬레이션) | HTTP |
| **유지보수 윈도우** | `GET/POST /api/maintenance-windows` | PostgreSQL | `MaintenanceWindow` 모델 (알림 억제 기간 설정) | HTTP |

**알림 플로우**:
```
AlertRule (DB에 저장된 PromQL + 임계값)
  → /api/cron/alert-check (주기적 실행)
  → Prometheus에 PromQL 쿼리
  → 결과가 임계값 초과 시 Alert 레코드 생성
  → MaintenanceWindow 체크 (억제 기간이면 무시)
  → NotificationChannel로 알림 발송 (설정된 경우)
  → 미확인 시 EscalationPolicy에 따라 에스컬레이션
```

---

### 2.9 용량 계획 (`/capacity`)

| UI 기능 | API | 데이터 소스 | 쿼리 | 프로토콜 |
|---------|-----|-------------|------|----------|
| 공간 사용률 (U 슬롯) | Server Component + API | PostgreSQL | `prisma.equipment` + `prisma.rack` → usedU / totalU 계산 | 직접 쿼리 |
| 전력 사용률 | `/api/metrics/instant` | Prometheus | `sum(rate(Package_Joules_Consumed[5m]))` | HTTP |
| 메모리 사용률 | `/api/metrics/instant` | Prometheus | `fleetAvgMemory()` 쿼리 | HTTP |
| CPU 사용률 | `/api/metrics/instant` | Prometheus | `fleetAvgCpu()` 쿼리 | HTTP |
| 월별 증가 추이 | `GET /api/capacity/forecast` | PostgreSQL | `equipment.createdAt`별 그룹핑 → 월별 누적 장비 수 | HTTP |
| 고갈 예측 | `GET /api/capacity/forecast` | PostgreSQL | 선형 회귀로 space/power/memory/cpu 고갈 일자 예측 | HTTP |
| What-if 시나리오 | 클라이언트 계산 | - | 사용자 입력값으로 예측 차트 재계산 | - |

---

### 2.10 리포트 (`/reports`)

| UI 기능 | 데이터 소스 | 기술 |
|---------|-------------|------|
| 리포트 템플릿 선택 | 클라이언트 UI | 정적 템플릿 목록 |
| 날짜 범위 선택 | 클라이언트 UI | - |
| PDF 내보내기 | 브라우저 | `window.print()` 기반 (CSS @media print) |
| 리포트 데이터 | PostgreSQL + Prometheus | 선택한 템플릿에 따라 각 데이터 소스에서 집계 |

---

### 2.11 설정 (`/settings/*`)

| 설정 페이지 | API | 데이터 소스 | 기능 |
|------------|-----|-------------|------|
| **Prometheus 진단** (`/settings/prometheus-diagnostic`) | `/api/discovery/diagnostic` | Prometheus | Prometheus 연결 테스트, 타겟 목록 조회 |
| **서버 자동 탐지** (`/settings/discovery`) | `/api/discovery/sync`, `/api/discovery/register` | Prometheus + PostgreSQL | Prometheus 타겟 → Equipment 자동 등록 |
| **BMC 설정** (`/settings/bmc`) | `/api/equipment/bulk-bmc` | PostgreSQL | 다수 장비에 BMC IP/자격증명 일괄 설정 |
| **사용자 관리** (`/settings/users`) | `/api/users` | PostgreSQL | User 모델 CRUD, 역할(ADMIN/OPERATOR/VIEWER) 변경 |
| **만료 추적** (`/settings/expiry-tracker`) | `/api/expiry-tracker` | PostgreSQL | 인증서/라이선스/보증 만료일 관리 |

---

### 2.12 인증 & 보안

| 기능 | 기술 | 상세 |
|------|------|------|
| 로그인 | NextAuth.js CredentialsProvider | email + bcrypt 비밀번호 검증 |
| 세션 관리 | JWT Strategy | `next-auth` JWT 토큰, 쿠키 저장 |
| 라우트 보호 | `src/middleware.ts` | 미인증 → `/login` 리다이렉트, API → 401 |
| RBAC | `src/lib/rbac.ts` | ADMIN: 전체 권한, OPERATOR: CRUD, VIEWER: 읽기 전용 |
| 감사 로그 | `src/lib/audit.ts` | 모든 CUD 작업에 AuditLog 기록 (누가, 무엇을, 왜) |

---

### 2.13 실시간 데이터 & 폴링

| 기능 | 방식 | 간격 | 엔드포인트 |
|------|------|------|-----------|
| 대시보드 메트릭 | SSE (Server-Sent Events) | 15초 | `/api/metrics/dashboard/stream` |
| 디지털 트윈 서버 상태 | setInterval 폴링 | 30초 | `/api/metrics/instant` |
| 디지털 트윈 온도 | setInterval 폴링 | 30초 | `/api/metrics/node-temps` |
| 서버 상세 메트릭 | 사용자 요청 시 | - | `/api/metrics/range`, `/api/metrics/instant` |
| 알림 확인 (cron) | 서버 cron 호출 | 설정에 따름 | `/api/cron/alert-check` |

---

### 2.14 공유 라이브러리 (src/lib/)

| 라이브러리 | 파일 | 용도 | 의존 대상 |
|-----------|------|------|-----------|
| `prometheus.ts` | 573줄 | Prometheus HTTP 클라이언트 + 60+ PromQL 쿼리 정의 | Prometheus API |
| `redfish.ts` | 698줄 | BMC/Redfish REST 클라이언트 (전원/센서/HW인벤토리) | BMC HTTPS + node:https |
| `hostname-resolver.ts` | - | hostname↔IP 매핑 통합 (Equipment + PrometheusTarget + Prometheus node_uname_info) | PostgreSQL + Prometheus |
| `audit.ts` | - | 감사 로그 기록 (`logAudit()`) | PostgreSQL |
| `rbac.ts` | - | 역할 기반 접근 제어 (`getSessionUser()`, `requireRole()`) | NextAuth + PostgreSQL |
| `alert-suppression.ts` | - | 유지보수 윈도우 기간 알림 억제 | PostgreSQL |
| `rack-placement.ts` | - | 랙 배치 검증 (U 위치/겹침 체크) | PostgreSQL |
| `platform-mapper.ts` | - | CPU 모델명 → 플랫폼(GNR-AP/GNR-SP/SPR 등) 매핑 | 정적 매핑 테이블 |
| `bmc-credentials.ts` | - | BMC 자격증명 관리 (기본값 + 장비별 설정) | PostgreSQL |
| `expiry-check.ts` | - | 만료 임박 항목 조회 | PostgreSQL |
| `api-validation.ts` | - | API 요청 본문 Zod 검증 헬퍼 | Zod |
| `db.ts` | - | Prisma 클라이언트 싱글턴 | PostgreSQL |
| `auth.ts` | - | NextAuth 설정 (CredentialsProvider + JWT) | PostgreSQL (User 모델) |

---

## 3. Prisma 모델 → 화면 매핑

| Prisma 모델 | 관련 화면 | CRUD |
|-------------|----------|------|
| `User` | 로그인, 사용자 관리 | R/U/D |
| `DataCenter` | 디지털 트윈 (최상위) | R |
| `Room` | 디지털 트윈, 랙 관리 | C/R/U/D |
| `RoomElement` | 디지털 트윈 편집 모드 | C/R/U/D |
| `Rack` | 랙 뷰, 디지털 트윈, 인프라 | C/R/U/D |
| `Equipment` | 인프라 관리, 서버 모니터링, 랙 뷰, 디지털 트윈 | C/R/U/D |
| `EquipmentCpu` | 인프라 상세, 서버 모니터링 | C/R/U (refresh-hw로 자동) |
| `EquipmentMemory` | 메모리 DIMM 상세 페이지 | C/R/U/D |
| `NetworkPort` | 인프라 상세 | C/R |
| `PDU` | 랙 상세 | R |
| `PrometheusTarget` | 서버 탐지, 호스트네임 리졸버 | C/R/U |
| `AlertRule` | 알림 규칙 설정 | C/R/U/D |
| `Alert` | 알림 목록, 히스토리 | C/R/U/D |
| `AlertAcknowledgement` | 알림 확인 | C/R |
| `NotificationChannel` | 알림 채널 설정 | C/R/U/D |
| `EscalationPolicy` | 에스컬레이션 설정 | C/R/U/D |
| `MaintenanceWindow` | 유지보수 윈도우 | C/R/U/D |
| `AuditLog` | 감사 로그, 변경 이력 | C/R |
| `EvalProject` | 워크로드/평가 관리 | C/R/U/D |
| `EvalPhase` | 평가 단계 | C/R/U |
| `EvalResult` | 평가 결과 | C/R |
| `EvalTask` | 평가 작업 | C/R/U |
| `EvalNote` | 평가 노트 | C/R |
| `EquipmentAssignment` | 장비 할당 | C/R/D |
| `ExpiryTracker` | 만료 추적, 대시보드 위젯 | C/R/U/D |

---

## 4. Prometheus 메트릭 전체 목록

### 4.1 node-exporter 메트릭 (주요)

| 메트릭명 | 용도 | 사용 화면 |
|---------|------|----------|
| `node_cpu_seconds_total` | CPU 사용률 (mode별: idle, user, system, iowait, steal) | 대시보드, 서버 상세, CPU 히트맵 |
| `node_memory_MemTotal_bytes` | 총 메모리 | 대시보드, 서버 상세 |
| `node_memory_MemAvailable_bytes` | 가용 메모리 | 대시보드, 서버 상세 |
| `node_memory_Cached_bytes` | 캐시 메모리 | 서버 상세 |
| `node_memory_Buffers_bytes` | 버퍼 메모리 | 서버 상세 |
| `node_memory_SwapTotal_bytes` | 스왑 총량 | 서버 상세 |
| `node_memory_SwapFree_bytes` | 스왑 가용 | 서버 상세 |
| `node_load1/5/15` | 로드 평균 | 서버 상세 |
| `node_disk_read_bytes_total` | 디스크 읽기 처리량 | 서버 상세 |
| `node_disk_written_bytes_total` | 디스크 쓰기 처리량 | 서버 상세 |
| `node_disk_reads_completed_total` | 디스크 읽기 IOPS | 서버 상세 |
| `node_disk_writes_completed_total` | 디스크 쓰기 IOPS | 서버 상세 |
| `node_disk_read_time_seconds_total` | 디스크 읽기 레이턴시 | 서버 상세 |
| `node_disk_write_time_seconds_total` | 디스크 쓰기 레이턴시 | 서버 상세 |
| `node_filesystem_size_bytes` | 파일시스템 크기 | 서버 상세 |
| `node_filesystem_avail_bytes` | 파일시스템 가용 | 서버 상세 |
| `node_network_receive_bytes_total` | 네트워크 수신 | 대시보드, 서버 상세 |
| `node_network_transmit_bytes_total` | 네트워크 송신 | 대시보드, 서버 상세 |
| `node_network_receive_errs_total` | 네트워크 수신 에러 | 서버 상세 |
| `node_network_transmit_errs_total` | 네트워크 송신 에러 | 서버 상세 |
| `node_network_receive_drop_total` | 네트워크 수신 드롭 | 서버 상세 |
| `node_network_transmit_drop_total` | 네트워크 송신 드롭 | 서버 상세 |
| `node_network_info` | NIC 정보 (라벨) | 서버 상세 |
| `node_network_speed_bytes` | NIC 속도 | 서버 상세 |
| `node_network_up` | NIC 상태 | 서버 상세 |
| `node_hwmon_temp_celsius` | 하드웨어 온도 | 서버 상세, 랙 히트맵, 디지털 트윈 |
| `node_hwmon_fan_rpm` | 팬 속도 | 서버 상세 |
| `node_boot_time_seconds` | 부팅 시간 (→ 업타임 계산) | 대시보드, 서버 상세 |
| `node_netstat_Tcp_CurrEstab` | TCP 연결 수 | 서버 상세 |
| `node_netstat_TcpExt_TCPRetransSegs` | TCP 재전송 | 서버 상세 |
| `node_procs_running` | 실행 중 프로세스 | 서버 상세 |
| `node_procs_blocked` | 블록된 프로세스 | 서버 상세 |
| `node_filefd_allocated/maximum` | 파일 디스크립터 사용률 | 서버 상세 |
| `node_uname_info` | 호스트네임 → IP 매핑 (라벨) | hostname-resolver |
| `up` | 타겟 가용 여부 | 대시보드, 서버 목록, 디지털 트윈 |

### 4.2 cAdvisor 메트릭 (폴백)

| 메트릭명 | node-exporter 대응 | 필터 |
|---------|-------------------|------|
| `container_cpu_usage_seconds_total` | `node_cpu_seconds_total` | `container!=""` |
| `container_memory_working_set_bytes` | `node_memory_MemAvailable_bytes` | `container!=""` |
| `machine_memory_bytes` | `node_memory_MemTotal_bytes` | - |
| `machine_cpu_cores` | `count(node_cpu_seconds_total{mode="idle"})` | - |
| `container_fs_usage_bytes` | `node_filesystem` | - |
| `container_network_receive_bytes_total` | `node_network_receive_bytes_total` | - |

### 4.3 Intel PCM 메트릭

| 메트릭명 | 용도 | 사용 화면 |
|---------|------|----------|
| `Package_Joules_Consumed` | CPU 패키지 전력 (와트 = rate) | 대시보드, 서버 상세 |
| `DRAM_Joules_Consumed` | DRAM 전력 | 서버 상세 |
| `PP0_Joules_Consumed` | PP0 전력 | 서버 상세 |
| `Instructions_Retired_Any` | IPC 계산 (분자) | 서버 상세 PCIe 탭 |
| `Clock_Unhalted_Ref` | IPC 계산 (분모) | 서버 상세 PCIe 탭 |
| `L2_Cache_Hits/Misses` | L2 캐시 히트율 | 서버 상세 PCIe 탭 |
| `L3_Cache_Hits/Misses` | L3 캐시 히트율 | 서버 상세 PCIe 탭 |
| `DRAM_Reads/Writes` | DRAM 대역폭 | 서버 상세 PCIe 탭 |

### 4.4 kube-state-metrics

| 메트릭명 | 용도 | 사용 화면 |
|---------|------|----------|
| `kube_pod_info` | 파드 목록 (이름, 네임스페이스, 노드) | 워크로드, 서버 상세 |
| `kube_pod_created` | 파드 생성 시간 | 워크로드 |
| `kube_pod_status_phase` | 파드 상태 (Running/Pending/Succeeded/Failed) | 워크로드 |
| `kube_pod_container_status_waiting_reason` | 대기 이유 (CrashLoopBackOff 등) | 워크로드 |
| `kube_node_info` | K8s 노드 정보 | 워크로드, 서버 상세 |
| `kube_node_status_capacity` | 노드 리소스 용량 (cpu/memory/storage) | 서버 상세 |
| `kube_node_status_allocatable` | 할당 가능 리소스 | 서버 상세 |
| `kubelet_running_pods` | 노드별 실행 중 파드 수 | 서버 상세 |

---

## 5. 인터랙티브 아키텍처 다이어그램

별도 파일로 제공: `docs/data-flow-diagram.html`
브라우저에서 열면 전체 데이터 플로우를 시각적으로 확인 가능.
