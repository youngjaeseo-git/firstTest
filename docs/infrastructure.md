# 인프라 환경 정보

> 이 파일은 Prometheus 환경, 서버 타겟, hostname/IP 매핑 등 실제 인프라 구성 정보를 기록한다.
> 코드 작성 시 이 파일을 참조하여 실제 데이터 구조에 맞춘다.

## Prometheus 접속 정보

### Cluster 1 — Lab-1 (10.144.38.100)
- **역할**: K8s master node, 모든 모니터링 데이터 수집 중심
- **Grafana**: `http://10.144.38.100:30004`
- **Prometheus**: K8s Service `prometheus-service` (namespace: monitoring)
  - ClusterIP: `http://10.100.175.248:8080` (클러스터 내부 — 앱 코드 + check 스크립트 모두 이 주소 사용)
  - NodePort: `8080:30003/TCP` (외부 접근용)
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

---

## Prometheus 메트릭 소스 (2026-05-19 기준)

- **node_exporter** — DaemonSet 배포, bare-metal 수준 메트릭 (21 타겟)
  - instance 형식: IP:port (예: `10.144.38.103:9100`)
  - job 이름: `node-exporter` (+ `kubernetes-pods` 중복 수집)
  - 수집 메트릭: node_cpu_seconds_total, node_memory_*, node_filesystem_*, node_disk_*, node_network_*, node_load*, node_hwmon_*, node_boot_time_seconds 등
- **cAdvisor** — CPU, Memory, Disk, Network (컨테이너 레벨 합산, node-exporter 폴백용)
- **Intel PCM** — Power (Package_Joules_Consumed)

---

## Job별 타겟 현황 (2026-05-19 확인)

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

---

## node-exporter 타겟 (21개, up=17 down=4)

- **UP**: 10.144.38.61, .81, .100, .103, .105, .106, .107, .113, .114, .115, .125, .128, .129, .131, .132, .133, .134
- **DOWN**: 10.144.38.62, .82, .83, .84
- 포트: 모두 :9100

---

## kubernetes-cadvisor 타겟 (up 24개, hostname)

- g222bx14ae001 (2개 중복), k8-master
- s121x13ae003, 005, 006, 007, 008, 013, 014, 015, 025, 028, 029, 031, 032, 033, 034
- s222hax14ae011, 012
- s222hx14ae021, 022, 023, 024

---

## hostname → IP 매핑 (확인된 것)

| hostname | IP | 확인 방법 |
|----------|-----|-----------|
| k8-master | 10.144.38.100 | DCIM 마스터 서버 |
| s222hax14ae011 | 10.144.38.61 | Prometheus __address__ 라벨 |
| s222hax14ae012 | 10.144.38.62 | Prometheus __address__ 라벨 |

> 나머지 서버의 매핑은 미확인. Prometheus config 정리 시 전수 조사 예정.

---

## 서버별 메트릭 가용성 예시

| 서버 | Job 목록 | 사용 가능 메트릭 |
|------|----------|-----------------|
| s222hax14ae011 | AE-SMC-GNRAP_PCM, kubernetes-cadvisor, kubernetes-nodes, kubernetes-pods(10.144.38.61:9100) | CPU, Memory, Disk, Network, Power |
| s222hax14ae012 | AE-SMC-GNRAP_PCM, kubernetes-cadvisor, kubernetes-nodes, kubernetes-pods(10.144.38.62:9100) | CPU, Memory, Disk, Network, Power |

---

## cAdvisor 쿼리 규칙

- `id="/"` 사용 금지 — K8s cAdvisor에서 root cgroup이 존재하지 않음
- `container!=""` 사용 — 실제 컨테이너만 선택, cgroup 계층 중복 방지
- `machine_*` 메트릭은 `container` 라벨 없음, 필터 불필요

---

## 라벨 구조 (2026-04-27 s121x13ae013에서 확인)

- `container_cpu_usage_seconds_total`: container=`POD`, id=`/kubepod.slice/...` (count=21)
- `container` 라벨 값: `POD` (pause container), 또는 실제 컨테이너 이름
- `id` 라벨 값: `/kubepods.slice/kubepods-besteffort.slice/...` (root cgroup `/` 없음)
- labels: `__name__`, `container`, `cpu`, `group`, `id`, `image`, `instance`, `job`, `namespace`, `pod`, `stress` 등

---

## 서버 다양성

- CPU: Intel (SRF, SPR, GNR, EMR), AMD (Turin), ARM (Ampere) 등 혼재
- 제조사: SMC(Supermicro), Dell 등 혼재
- 조직: 자체 서버 외에 다른 조직 서버도 포함 (정확한 정보 없을 수 있음)
- 워크로드 라벨: `stress: "stress"` = stressapptest 메모리 에러 검증용

---

## 알려진 이슈

**히트맵 차이 (2026-05-19 확인):**
- node-exporter는 IP:port 형식, cadvisor는 hostname 형식
- 앱에서 hostIp(DB의 ipAddress 필드)가 있어야 node-exporter 매칭 가능
- DB에 ipAddress가 누락된 서버는 hostname으로 node-exporter를 찾아 실패 → 히트맵 안 나옴
- 해결 방안: Prometheus config 정리 (hostname/IP 통일) 또는 DB에 ipAddress 채우기

---

## PCM Metrics (job: AE-SMC-GNRAP_PCM)

Total: 66 metrics

| Category | Count | Examples |
|----------|-------|----------|
| CPU | 3 | CStateResidency, Instructions_Retired_Any |
| Memory | 14 | CXL_Write_Cache, CXL_Write_Mem |
| Cache | 9 | L2_Cache_Hits, L2_Cache_Misses |
| Power | 4 | DRAM_Joules_Consumed, PP0_Joules_Consumed |
| Interconnect | 24 | Incoming_Data_Traffic_On_Link_0, Incomming_Data_Traffic_On_Link_1 |
| Other | 12 | Clock_unhalted_ref, Invariant_TSC |

Labels: aggregate, socket, source
