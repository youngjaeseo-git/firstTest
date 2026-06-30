# DCIM 데이터 소스 매핑 (Data Source Mapping)

> 각 화면에서 어떤 데이터를 어디서 가져오는지 정리한 문서
> 최종 갱신: 2026-05-28

---

## 데이터 소스 종류

| 약어 | 소스 | 설명 |
|------|------|------|
| **PROM** | Prometheus | 시계열 메트릭 (node-exporter, cAdvisor, kube-state-metrics, PCM) |
| **BMC** | Redfish/BMC API | 하드웨어 센서, 전원 제어 (`/redfish/v1/Chassis/1/Thermal`, `/Power`) |
| **DB** | PostgreSQL (Prisma) | 자산 정보, 평가 프로젝트, 알림, 사용자 |

---

## 1. 대시보드 (Dashboard)

### 1-1. 메트릭 카드 (1행: 4개)

| 카드 | 표시 항목 | 소스 | PromQL / 쿼리 | 갱신 주기 |
|------|-----------|------|---------------|-----------|
| **Avg CPU** | 전체 서버 평균 CPU 사용률 (%) | PROM | `(1-avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))*100` or cAdvisor 폴백 | 15초 (SSE) |
| **Avg Memory** | 전체 서버 평균 메모리 사용률 (%) | PROM | `(1-sum(node_memory_MemAvailable_bytes)/sum(node_memory_MemTotal_bytes))*100` or cAdvisor 폴백 | 15초 (SSE) |
| **Avg Temperature** | CPU 평균 온도 (°C) | PROM | `avg(node_hwmon_temp_celsius)` | 15초 (SSE) |
| | DIMM 평균 온도 (°C) | BMC | Redfish `/Chassis/1/Thermal` → "DIMM" 포함 센서 필터 → 전체 평균 | 60초 (polling) |
| **Total Power** | 전체 전력 소비 (W/kW) | PROM | `sum(node_hmon_power_average_watt)` or `sum(rate(Package_Joules_Consumed[5m]))` | 15초 (SSE) |

### 1-2. 메트릭 카드 (2행: 4개)

| 카드 | 표시 항목 | 소스 | PromQL / 쿼리 | 갱신 주기 |
|------|-----------|------|---------------|-----------|
| **Nodes** | Up / Down 서버 수 | PROM | `up{job=~"node-exporter\|kubernetes-nodes\|..."}` 필터 후 값=1 카운트 | 15초 (SSE) |
| **Avg Uptime** | 평균 가동일수 (days) | PROM | `avg(time()-node_boot_time_seconds)` or cAdvisor 폴백 | 15초 (SSE) |
| **Network In** | 전체 수신 트래픽 (B/s) | PROM | `sum(rate(node_network_receive_bytes_total{device!~"lo\|veth.*\|cni.*"}[5m]))` | 15초 (SSE) |
| | TX 표시 (sub-label) | PROM | `sum(rate(node_network_transmit_bytes_total{...}[5m]))` | 15초 (SSE) |
| **GPU** | (Placeholder) | - | dcgm-exporter 미설치 | - |

**클러스터 필터**: All / Lab-1 (`10.144.38.*`) / Lab-3 (`10.144.131.*`)
**API**: `/api/metrics/dashboard/stream` (SSE 15초 push)

### 1-3. Fleet Overview

| 섹션 | 표시 항목 | 소스 | 쿼리 | 갱신 주기 |
|------|-----------|------|------|-----------|
| **Top 5 CPU** | CPU 사용률 상위 5 서버 | PROM | `topk(10, (1-avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])))*100)` + cAdvisor 병합 | 30초 |
| **Top 5 Memory** | 메모리 사용률 상위 5 서버 | PROM | `topk(10, (1-node_memory_MemAvailable_bytes/node_memory_MemTotal_bytes)*100)` + cAdvisor 병합 | 30초 |
| **Server Status 도넛** | ACTIVE/MAINTENANCE/FAILED 수 | DB | `equipment.count()` by status | 페이지 로드 시 |
| **Platform 분포** | SPR/GNR-AP/GNR-SP/SRF/Ampere/EMR 수 | DB | hostname/model 패턴 매칭 | 페이지 로드 시 |
| **스파크라인 (CPU)** | 30분 CPU 추이 | PROM | `fleetAvgCpu` range query (step=60s) | 30초 |
| **스파크라인 (Memory)** | 30분 메모리 추이 | PROM | `fleetAvgMemory` range query | 30초 |
| **스파크라인 (Network)** | 30분 네트워크 추이 | PROM | `fleetTotalNetworkRx` range query | 30초 |
| **스파크라인 (Power)** | 30분 전력 추이 | PROM | `fleetTotalPower` range query | 30초 |

### 1-4. Active Workloads 카드

| 표시 항목 | 소스 | PromQL | 갱신 주기 |
|-----------|------|--------|-----------|
| 네임스페이스별 Pod 목록 | PROM | `kube_pod_info{namespace!~"kube-system\|monitoring\|..."}` | 30초 |
| Pod 생성 시각 | PROM | `kube_pod_created{...}` | 30초 |
| Pod 상태 (Running/Pending/Failed) | PROM | `kube_pod_status_phase{...}==1` | 30초 |
| Pod 대기 사유 (CrashLoopBackOff 등) | PROM | `kube_pod_container_status_waiting_reason{...}==1` | 30초 |
| 노드별 온도 바 차트 | PROM+DB | `avg by(instance)(node_hwmon_temp_celsius)` + Equipment hostname→IP 매핑 | 30초 |

**API**: `/api/metrics/instant`, `/api/metrics/node-temps`

### 1-5. Summary Cards

| 카드 | 표시 항목 | 소스 | 쿼리 |
|------|-----------|------|------|
| Total Equipment | 장비 총 수 / Active 수 | DB | `equipment.count()` |
| Infrastructure | 랙 수 / 룸 수 | DB | `rack.count()`, `room.count()` |
| Active Alerts | 발생 중 알림 수 | DB | `alert.count({status:"FIRING"})` |
| Recent Alerts | 최근 알림 5건 | DB | `alert.findMany({status:"FIRING", take:5})` |

---

## 2. 서버 모니터링 상세 (Servers / [id])

### 2-1. System Health Quick View

| 항목 | 소스 | PromQL |
|------|------|--------|
| Uptime | PROM | `time()-node_boot_time_seconds{instance=~"IP(:.*)?"}` or cAdvisor |
| Boot Time | PROM | `node_boot_time_seconds{...}` |
| Available Memory | PROM | `node_memory_MemAvailable_bytes{...}` |
| Total Memory | PROM | `node_memory_MemTotal_bytes{...}` |
| node-exporter 상태 | PROM | `up{instance=~"IP:9100",job="node-exporter"}` |
| cAdvisor 상태 | PROM | `up{instance=~"hostname",job="kubernetes-cadvisor"}` |

### 2-2. CPU 메트릭

| 항목 | 소스 | PromQL |
|------|------|--------|
| CPU Usage % | PROM | `(1-avg(rate(node_cpu_seconds_total{mode="idle",instance}[5m])))*100` or cAdvisor |
| Per-Core Usage | PROM | `rate(node_cpu_seconds_total{mode!="idle",instance}[5m]) * 100` by cpu |
| Load Average 1/5/15m | PROM | `node_load1{instance}`, `node_load5`, `node_load15` |
| CPU Core Count | PROM | `count(node_cpu_seconds_total{mode="idle",instance})` |
| CPU Mode (User %) | PROM | `avg(rate(node_cpu_seconds_total{mode="user",instance}[5m]))*100` |
| CPU Mode (System %) | PROM | `avg(rate(node_cpu_seconds_total{mode="system",instance}[5m]))*100` |
| CPU Mode (IOWait %) | PROM | `avg(rate(node_cpu_seconds_total{mode="iowait",instance}[5m]))*100` |
| CPU Mode (Steal %) | PROM | `avg(rate(node_cpu_seconds_total{mode="steal",instance}[5m]))*100` |
| CPU Core Heatmap | PROM | Per-core usage range query |

### 2-3. CPU 고급 (PCM - Intel Performance Counter Monitor)

| 항목 | 소스 | PromQL |
|------|------|--------|
| IPC (Instructions/Clock) | PROM | `rate(Instructions_Retired_Any{instance}[5m]) / rate(Clock_Unhalted_Ref{instance}[5m])` |
| L2 Cache Hit Rate % | PROM | `rate(L2_Cache_Hits[5m]) / (rate(L2_Cache_Hits[5m])+rate(L2_Cache_Misses[5m])) * 100` |
| L3 Cache Hit Rate % | PROM | `rate(L3_Cache_Hits[5m]) / (rate(L3_Cache_Hits[5m])+rate(L3_Cache_Misses[5m])) * 100` |
| DRAM Reads ops/s | PROM | `rate(DRAM_Reads{instance}[5m])` |
| DRAM Writes ops/s | PROM | `rate(DRAM_Writes{instance}[5m])` |

### 2-4. 메모리 메트릭

| 항목 | 소스 | PromQL |
|------|------|--------|
| Memory Usage % | PROM | `(1-node_memory_MemAvailable_bytes/node_memory_MemTotal_bytes)*100` or cAdvisor |
| Memory Used Bytes | PROM | `node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes` or cAdvisor |
| Cache+Buffer | PROM | `node_memory_Cached_bytes + node_memory_Buffers_bytes` or `container_memory_cache` |
| Swap Usage % | PROM | `(1-node_memory_SwapFree_bytes/node_memory_SwapTotal_bytes)*100` or `container_memory_swap` |

### 2-5. 디스크 메트릭

| 항목 | 소스 | PromQL |
|------|------|--------|
| Disk I/O Read (B/s) | PROM | `rate(node_disk_read_bytes_total{device!~"dm-.*"}[5m])` |
| Disk I/O Write (B/s) | PROM | `rate(node_disk_written_bytes_total{...}[5m])` |
| Read IOPS | PROM | `rate(node_disk_reads_completed_total{...}[5m])` |
| Write IOPS | PROM | `rate(node_disk_writes_completed_total{...}[5m])` |
| Read Latency (ms) | PROM | `rate(node_disk_read_time_seconds_total[5m])/rate(node_disk_reads_completed_total[5m])` |
| Write Latency (ms) | PROM | `rate(node_disk_write_time_seconds_total[5m])/rate(node_disk_writes_completed_total[5m])` |
| Root FS Usage % | PROM | `(1-node_filesystem_avail_bytes{mountpoint="/"}/node_filesystem_size_bytes{...})*100` |
| Filesystem Breakdown | PROM | `node_filesystem_size_bytes`, `node_filesystem_avail_bytes` by mountpoint |

### 2-6. 네트워크 메트릭

| 항목 | 소스 | PromQL |
|------|------|--------|
| Network RX (B/s) | PROM | `rate(node_network_receive_bytes_total{device!~"lo\|veth.*"}[5m])` |
| Network TX (B/s) | PROM | `rate(node_network_transmit_bytes_total{...}[5m])` |
| RX Errors/s | PROM | `rate(node_network_receive_errs_total[5m])` |
| TX Errors/s | PROM | `rate(node_network_transmit_errs_total[5m])` |
| RX Drops/s | PROM | `rate(node_network_receive_drop_total[5m])` |
| TX Drops/s | PROM | `rate(node_network_transmit_drop_total[5m])` |
| TCP Established | PROM | `node_netstat_Tcp_CurrEstab{instance}` |
| TCP Retransmits/s | PROM | `rate(node_netstat_TcpExt_TCPRetransSegs[5m])` |
| Interface Up/Down | PROM | `node_network_up{instance}` |
| Interface Speed | PROM | `node_network_speed_bytes{instance}` |

### 2-7. Thermal / 전력 메트릭

| 항목 | 소스 | PromQL / 엔드포인트 |
|------|------|---------------------|
| General Temperature | PROM | `node_hwmon_temp_celsius{instance}` or `{job="temperature",instance}` |
| Inlet Temperature | PROM | `{job="temperature",instance,type=~"inlet\|ambient"}` |
| Exhaust Temperature | PROM | `{job="temperature",instance,type=~"exhaust\|outlet"}` |
| CPU Socket Temperature | PROM | `{job="temperature",instance,type=~"cpu\|processor"}` |
| Fan Speed (RPM) | PROM | `node_hwmon_fan_rpm{instance}` or `{job="temperature",type="fan"}` |
| Package Power (W) | PROM | `rate(Package_Joules_Consumed{instance}[5m])` |
| DRAM Power (W) | PROM | `rate(DRAM_Joules_Consumed{instance}[5m])` |
| PP0/Core Power (W) | PROM | `rate(PP0_Joules_Consumed{instance}[5m])` |

### 2-8. BMC 센서 카드 (Redfish)

| 항목 | 소스 | Redfish 엔드포인트 |
|------|------|---------------------|
| 온도 센서 목록 (Name, °C, Critical, Fatal) | BMC | `GET /redfish/v1/Chassis/1/Thermal` → `Temperatures[]` |
| 팬 센서 목록 (Name, RPM, Status) | BMC | `GET /redfish/v1/Chassis/1/Thermal` → `Fans[]` |
| 전력 소비 (ConsumedWatts) | BMC | `GET /redfish/v1/Chassis/1/Power` → `PowerControl[0].PowerConsumedWatts` |
| 전력 용량 (CapacityWatts) | BMC | `GET /redfish/v1/Chassis/1/Power` → `PowerControl[0].PowerCapacityWatts` |
| PSU 목록 (Model, Capacity, Type, Status) | BMC | `GET /redfish/v1/Chassis/1/Power` → `PowerSupplies[]` |

**API**: `/api/equipment/[id]/sensors`

### 2-9. 전원 제어

| 항목 | 소스 | 엔드포인트 |
|------|------|-----------|
| Power State (On/Off) | BMC | `GET /redfish/v1/Systems/[path]` → `PowerState` |
| Power Action (Reset/On/Off) | BMC | `POST /redfish/v1/Systems/[path]/Actions/ComputerSystem.Reset` |

**API**: `/api/equipment/[id]/power`

---

## 3. 장비 상세 (Infrastructure / [id])

### 3-1. 기본 정보 (PostgreSQL)

| 항목 | DB 모델 | 필드 |
|------|---------|------|
| Hostname, IP, BMC IP | Equipment | `hostname`, `ipAddress`, `bmcIpAddress` |
| Manufacturer, Model | Equipment | `manufacturer`, `model` |
| Serial Number, Asset Tag | Equipment | `serialNumber`, `assetTag` |
| OS Type/Version | Equipment | `osType`, `osVersion` |
| BIOS Version | Equipment | `biosVersion` |
| Status | Equipment | `status` (ACTIVE/MAINTENANCE/REPAIR/FAILED/...) |
| 위치 (Room/Rack/U Position) | Equipment→Rack→Room | `rackPosition`, `rack.name`, `rack.room.name` |
| 구매일, 보증 만료 | Equipment | `purchaseDate`, `warrantyExpiry` |

### 3-2. CPU 정보 (PostgreSQL, Redfish 갱신)

| 항목 | DB 모델 | 원본 소스 |
|------|---------|-----------|
| Socket Index | EquipmentCpu | `socketIndex` |
| CPU Model | EquipmentCpu | Redfish `/Systems/[id]/Processors/[i]` |
| Cores, Threads | EquipmentCpu | `cores`, `threads` |
| Base/Max Frequency | EquipmentCpu | `baseFreqMhz`, `maxFreqMhz` |
| TDP (Watts) | EquipmentCpu | `tdpWatts` |

### 3-3. 메모리 정보 (PostgreSQL, Redfish 갱신)

| 항목 | DB 모델 | 원본 소스 |
|------|---------|-----------|
| DIMM Slot Name | EquipmentMemory | Redfish `/Systems/[id]/Memory/[i]` |
| Populated (장착 여부) | EquipmentMemory | `populated` |
| Capacity (GB) | EquipmentMemory | `capacityGb` |
| Memory Type (DDR4/DDR5) | EquipmentMemory | `memoryType` |
| Manufacturer | EquipmentMemory | `manufacturer` |
| Part Number | EquipmentMemory | `partNumber` |
| Speed (MHz) | EquipmentMemory | `speedMhz` |
| Rank | EquipmentMemory | `rank` |
| Form Factor | EquipmentMemory | `formFactor` |
| ECC | EquipmentMemory | `ecc` |

### 3-4. 네트워크 포트 (PostgreSQL, Redfish 갱신)

| 항목 | DB 모델 | 원본 소스 |
|------|---------|-----------|
| Port Name | NetworkPort | Redfish `/Systems/[id]/EthernetInterfaces/[i]` |
| MAC Address | NetworkPort | `macAddress` |
| Speed (Mbps) | NetworkPort | `speedMbps` |
| Link Status | NetworkPort | `linkStatus` |

### 3-5. 변경 이력

| 항목 | DB 모델 | 쿼리 |
|------|---------|------|
| 감사 로그 (WHO, WHAT, WHEN) | AuditLog | `auditLog.findMany({entityId: equipmentId})` |

**하드웨어 정보 갱신 API**: `POST /api/equipment/[id]/refresh-hw` → Redfish `getSystemHwInfo()` → DB 업데이트

---

## 4. 워크로드 (Workloads)

### 4-1. Active 탭

| 항목 | 소스 | 상세 |
|------|------|------|
| 네임스페이스별 Pod 목록 | PROM | `kube_pod_info` (kube-state-metrics) |
| Pod 생성 시각 / Age | PROM | `kube_pod_created` |
| Pod Phase | PROM | `kube_pod_status_phase==1` |
| Pod Waiting Reason | PROM | `kube_pod_container_status_waiting_reason==1` |
| 노드별 온도 바 차트 | PROM+DB | `avg by(instance)(node_hwmon_temp_celsius)` + Equipment hostname→IP |
| Health 판정 | 계산 | Phase + WaitingReason → running/pending/warning/error/succeeded |

### 4-2. History 달력 탭

| 항목 | 소스 | 상세 |
|------|------|------|
| 평가 프로젝트 목록 | DB | `evalProject.findMany()` (기간, 상태, 네임스페이스) |
| 라이브 워크로드 (달력 병합) | PROM | Active 탭과 동일 쿼리 → 합성 EvalProject 생성 |
| Gantt 바 렌더링 | 계산 | startDate~endDate 기간을 주 단위로 변환 |
| 네임스페이스 필터 체크박스 | 계산 | 프로젝트 목록에서 고유 네임스페이스 추출 |

### 4-3. 프로젝트 팝업 (달력 바 클릭)

| 항목 | 소스 | 상세 |
|------|------|------|
| 프로젝트 상세 (기간, 상태) | DB | `/api/evaluations/[id]` |
| Phase 목록 | DB | `evalProject.phases[]` |
| 테스트 결과 | DB | `evalProject.results[]` (PASS/FAIL, workload, server, cycles) |
| 태스크 목록 | DB | `evalProject.tasks[]` (status, priority) |
| 메모 (최근 3건) | DB | `evalProject.notes[]` |
| 라이브 Pod 목록 | PROM | `kube_pod_info{namespace=...}` |

### 4-4. 네임스페이스 상세 (/workloads/[namespace])

| 항목 | 소스 | 상세 |
|------|------|------|
| Pod CPU 사용률 | PROM | `rate(container_cpu_usage_seconds_total{namespace,pod}[5m])` |
| Pod Memory 사용량 | PROM | `container_memory_working_set_bytes{namespace,pod}` |
| 연결된 평가 프로젝트 | DB | `/api/workloads/[namespace]` |
| 태스크 CRUD | DB | `evalTask` 생성/수정/삭제 |
| 메모 CRUD | DB | `evalNote` 생성/삭제 |
| 완료된 평가 이력 | DB | `evalProject.findMany({namespace, status:"COMPLETED"})` |

---

## 5. 평가 (Evaluations)

### 5-1. 목록

| 항목 | 소스 | 쿼리 |
|------|------|------|
| 프로젝트 목록 | DB | `evalProject.findMany()` + phases + _count |
| 상태/타입 필터 | DB | where 조건 |

### 5-2. 상세 (/evaluations/[id])

| 항목 | 소스 | DB 모델 |
|------|------|---------|
| 프로젝트 메타 | DB | EvalProject (title, status, evalType, dates) |
| Phase 목록 | DB | EvalPhase (name, description, sortOrder) |
| 테스트 결과 | DB | EvalResult (result, workloadName, value, cycles, equipment) |
| 태스크 | DB | EvalTask (title, status, priority, assignee, dueDate) |
| 메모 | DB | EvalNote (content, createdBy, createdAt) |
| 테스트 서버 | DB | EvalResult → Equipment (hostname, IP) |

---

## 6. 알림 (Alerts)

| 페이지 | 항목 | 소스 | DB 모델 |
|--------|------|------|---------|
| **알림 목록** | 알림 레코드 (severity, category, source, firedAt) | DB | Alert + AlertRule |
| | 알림 확인 (acknowledge) | DB | Alert.acknowledgedBy, acknowledgedAt |
| **알림 규칙** | 규칙 정의 (metric PromQL, condition, duration, severity) | DB | AlertRule |
| | 규칙별 발생 횟수 | DB | AlertRule._count.alerts |
| **알림 이력** | 기간별 통계/트렌드 | DB | Alert 집계 |

---

## 7. 기타 페이지

### 7-1. Capacity Planning

| 항목 | 소스 | 상세 |
|------|------|------|
| 장비 수 (상태별) | DB | `equipment.count()` by status |
| 전체 메모리 (GB) | DB | `sum(equipment.totalMemoryGB)` |
| 전체 CPU 코어 | DB | `sum(equipmentCpu.cores)` |
| 전체 TDP (Watts) | DB | `sum(equipmentCpu.tdpWatts)` |
| 랙 사용률 (U) | DB | used U / totalUnits |
| 전력 사용률 | DB | TDP / rack.maxPowerWatts |
| 라이브 메트릭 | PROM | Dashboard와 동일 쿼리 |

### 7-2. Racks View

| 항목 | 소스 | 상세 |
|------|------|------|
| Room → Rack → Equipment 계층 | DB | Room, Rack, Equipment 관계 조회 |
| 랙 사용률 | 계산 | 장비 rackHeight 합산 / totalUnits |
| PDU 정보 | DB | Pdu 모델 |

### 7-3. Memory Inventory

| 항목 | 소스 | 상세 |
|------|------|------|
| 서버별 DIMM 슬롯 상세 | DB | EquipmentMemory (capacity, type, manufacturer, speed, rank, ECC) |
| 그룹핑 (용량/제조사/속도별) | 계산 | DB 데이터 집계 |

### 7-4. Firmware Management

| 항목 | 소스 | 상세 |
|------|------|------|
| 서버별 BIOS 버전 | DB | `equipment.biosVersion` |
| 모델별 최신 버전 판별 | 계산 | 같은 모델 그룹 내 최신 버전 비교 |
| Outdated 서버 수 | 계산 | 최신 버전이 아닌 서버 카운트 |

### 7-5. Reports

| 항목 | 소스 | 상세 |
|------|------|------|
| 장비 통계 (상태/타입/제조사별) | DB | Equipment 집계 |
| 알림 통계 (30일/7일/Critical) | DB | Alert 집계 |
| Top 알림 규칙 | DB | AlertRule + _count |
| Room/Rack 상세 | DB | Room → Racks 관계 |

### 7-6. Search

| 항목 | 소스 | 상세 |
|------|------|------|
| 장비 검색 (hostname, IP, serial) | DB | Equipment 텍스트 검색 |
| Facet 필터 (CPU 모델, 메모리 타입 등) | DB | Equipment 관계 집계 |

### 7-7. Digital Twin

| 항목 | 소스 | 상세 |
|------|------|------|
| Room → Rack → Equipment 물리 배치 | DB | Room, Rack, Equipment 관계 |
| SVG 렌더링 | 계산 | rackPosition, rackHeight 기반 시각화 |

---

## 8. API 엔드포인트 전체 목록

### Prometheus 프록시

| 엔드포인트 | 용도 | 소스 |
|-----------|------|------|
| `GET /api/metrics/instant` | PromQL instant 쿼리 | PROM |
| `GET /api/metrics/range` | PromQL range 쿼리 (시계열) | PROM |
| `GET /api/metrics/dashboard` | 대시보드 집계 메트릭 (8개 쿼리) | PROM |
| `GET /api/metrics/dashboard/stream` | SSE 스트림 (15초 push) | PROM |
| `GET /api/metrics/memory-temp` | DIMM 평균 온도 | BMC (Redfish) |
| `GET /api/metrics/node-temps` | 노드별 hwmon 온도 + hostname 매핑 | PROM + DB |

### Redfish/BMC

| 엔드포인트 | 용도 | Redfish 경로 |
|-----------|------|-------------|
| `GET /api/equipment/[id]/sensors` | Thermal + Power 센서 | `/Chassis/1/Thermal`, `/Chassis/1/Power` |
| `GET /api/equipment/[id]/power` | 전원 상태 조회 | `/Systems/[path]` → PowerState |
| `POST /api/equipment/[id]/power` | 전원 제어 (Reset/On/Off) | `/Systems/[path]/Actions/ComputerSystem.Reset` |
| `POST /api/equipment/[id]/refresh-hw` | 하드웨어 정보 갱신 | `/Systems/[path]` + Processors, Memory, EthernetInterfaces |

### PostgreSQL CRUD

| 엔드포인트 | 모델 |
|-----------|------|
| `/api/equipment` | Equipment (CRUD, bulk) |
| `/api/evaluations` | EvalProject (CRUD) |
| `/api/evaluations/[id]` | EvalProject 상세 + phases/results/tasks/notes |
| `/api/workloads/[namespace]` | EvalProject by namespace |
| `/api/alert-rules` | AlertRule (CRUD) |
| `/api/alerts` | Alert (목록, 확인, 삭제) |
| `/api/rooms`, `/api/racks/[id]` | Room, Rack 조회 |
| `/api/users` | User 관리 |
| `/api/inventory-search` | Equipment 고급 검색 |
| `/api/discovery/targets` | Prometheus 타겟 탐지/등록 |

---

## 9. 데이터 소스별 요약

### Prometheus 메트릭 (총 50+ 쿼리)

| 카테고리 | Exporter | 주요 메트릭 |
|----------|----------|-------------|
| **CPU** | node-exporter | `node_cpu_seconds_total`, `node_load{1,5,15}` |
| **CPU (cAdvisor)** | cAdvisor | `container_cpu_usage_seconds_total`, `machine_cpu_cores` |
| **메모리** | node-exporter | `node_memory_MemTotal/MemAvailable/Cached/Buffers/SwapTotal/SwapFree_bytes` |
| **메모리 (cAdvisor)** | cAdvisor | `container_memory_working_set_bytes`, `machine_memory_bytes`, `container_memory_cache/swap` |
| **디스크** | node-exporter | `node_disk_read/written_bytes_total`, `node_disk_reads/writes_completed_total`, `node_disk_read/write_time_seconds_total`, `node_filesystem_size/avail_bytes` |
| **네트워크** | node-exporter | `node_network_receive/transmit_bytes_total`, `node_network_receive/transmit_errs/drop_total`, `node_netstat_*` |
| **온도** | node-exporter | `node_hwmon_temp_celsius` |
| **온도** | custom job | `{job="temperature", type="inlet/exhaust/cpu/fan"}` |
| **팬** | node-exporter | `node_hwmon_fan_rpm` |
| **전력** | PCM exporter | `Package_Joules_Consumed`, `DRAM_Joules_Consumed`, `PP0_Joules_Consumed` |
| **전력** | node-exporter | `node_hmon_power_average_watt` |
| **시스템** | node-exporter | `node_boot_time_seconds`, `up` |
| **CPU 성능** | PCM exporter | `Instructions_Retired_Any`, `Clock_Unhalted_Ref`, `L2/L3_Cache_Hits/Misses`, `DRAM_Reads/Writes` |
| **K8s Pod** | kube-state-metrics | `kube_pod_info`, `kube_pod_created`, `kube_pod_status_phase`, `kube_pod_container_status_waiting_reason` |
| **K8s Node** | kube-state-metrics | `kube_node_status_capacity` (cpu, memory, pods) |
| **인터페이스** | node-exporter | `node_network_up`, `node_network_speed_bytes` |

### Redfish/BMC 엔드포인트

| 엔드포인트 | 데이터 |
|-----------|--------|
| `/redfish/v1/Systems` | 시스템 탐색 (path discovery) |
| `/redfish/v1/Systems/[path]` | 전원 상태, 제조사, 모델, BIOS, CPU/메모리 요약 |
| `/redfish/v1/Systems/[path]/Processors/[i]` | CPU 상세 (model, cores, threads, speed, TDP) |
| `/redfish/v1/Systems/[path]/Memory/[i]` | DIMM 상세 (capacity, type, manufacturer, speed, ECC) |
| `/redfish/v1/Systems/[path]/EthernetInterfaces/[i]` | NIC 상세 (MAC, speed, link, IPv4) |
| `/redfish/v1/Chassis/1/Thermal` | 온도 센서 + 팬 센서 |
| `/redfish/v1/Chassis/1/Power` | PSU + 전력 소비 |
| `/redfish/v1/Systems/[path]/Actions/ComputerSystem.Reset` | 전원 제어 (POST) |

### PostgreSQL 테이블

| 테이블 | 주요 용도 |
|--------|-----------|
| Equipment | 장비 자산 정보 (hostname, IP, BMC IP, 상태, 위치) |
| EquipmentCpu | CPU 상세 (소켓별) |
| EquipmentMemory | DIMM 슬롯별 상세 |
| NetworkPort | NIC 포트 정보 |
| PrometheusTarget | Prometheus instance↔Equipment 매핑 |
| Room, Rack | 물리 위치 계층 (DC→Room→Rack→U) |
| Pdu | PDU (전원 분배 장치) |
| EvalProject | 평가 프로젝트 |
| EvalPhase | 평가 단계 |
| EvalResult | 테스트 결과 (PASS/FAIL) |
| EvalTask | 태스크 관리 |
| EvalNote | 메모 |
| Alert | 알림 레코드 |
| AlertRule | 알림 규칙 정의 |
| AuditLog | 감사 로그 (변경 이력) |
| User | 사용자 (인증, RBAC) |
