# 2026-05-26 온도/전력/워크로드 메트릭 확인

## 출처: check/targetExecCmd/20260526.sh 실행 결과

### 1. 온도 관련 메트릭
존재하는 메트릭:
- `Thermal_Headroom`
- `node_hwmon_temp_celsius` (3634 series)
- `node_hwmon_crit_alarm_celsius`
- `node_hwmon_crit_celsius`
- `node_hwmon_max_celsius`
- `node_thermal_zone_temp`

`node_hwmon_temp_celsius` 라벨 구조 (샘플):
```
instance: 10.144.38.113:9100
job: kubernetes-pods
chip: 0000:15:01_0_0000:16:00_0
sensor: temp1
app: node-exporter
kubernetes_namespace: monitoring
kubernetes_pod_name: node-exporter-58dlz
```

### 2. Package_Joules_Consumed 라벨 구조
```
aggregate: system
instance: 10.80.103.100:9200
job: QRA-SMC-DDR5-Dell
source: uncore
```
- `type` 라벨은 존재하지 않음 → 기존 `{type="thermal"}` 쿼리는 항상 empty → vector(0)으로 0 반환

### 3. 전력 관련 메트릭
- `Package_Joules_Consumed` (CPU RAPL)
- `DRAM_Joules_Consumed`
- `PP0_Joules_Consumed`
- `PP1_Joules_Consumed`
- `machine_nvm_avg_power_budget_watts`
- `node_hmon_power_average_watt` (서버 전체 전력)
- `node_hmon_power_average_interval_seconds`
- `node_hmon_power_average_interval_max_seconds`
- `node_hmon_power_average_interval_min_seconds`
- `node_hmon_power_is_battery_watt`

### 4. 현재 총전력
- `sum(rate(Package_Joules_Consumed[5m]))` = **113490.3 W** (~113.5 kW, CPU RAPL만)
- 서버별 topk 결과: no data (쿼리 timeout 가능성)

### 5. IPMI/BMC 온도
- 관련 메트릭 없음 (ipmi, bmc, inlet, outlet, ambient 모두 no data)

### 6. 워크로드 Pod 정보 (kube_pod_info)
- 총 193 pods

kube_pod_info 라벨 구조:
```
created_by_kind: none
created_by_name: none
host_ip: 10.144.38.112
instance: kube-state-metrics.kube-system.svc.cluster.local:8080
job: kube-state-metrics
namespace: default
node: s121x13ae012
pod: test-pod
pod_ip: 172.16.30.78
uid: (uuid)
```

### 7. 시스템 외 워크로드 Pod (11개)
| namespace | pod | node |
|-----------|-----|------|
| default | test-pod | s121x13ae012 |
| default | hello-world-pod4 | s222hx14ae022 |
| cmx-acc-lc32g-tencent-lrr | sleep-depoly-f4c8d7bc6-zdsgs | s121x13ae015 |
| cmx-smc-lcrprime | stress-prime-85b48d99b7-7jj4t | (unassigned) |
| cmx-smc-lclife | stress-sat-74b5fd7799-mt4ss | (unassigned) |
| cmx-acc-acstress | stress-sat-76d6cb5545-k5bmq | s121x13ae022 |
| cmx-acc-acstress | stress-sat-76d6cb5545-vcxfk | s121x13ae022 |
| (그 외 약 4개 추가) | | |

### 8. kube_pod_created
- 193 series
- labels: __name__, instance, job, namespace, pod
- 값: unix timestamp (예: 1775091802)

### 9. kube_pod_status_phase
- count by(phase) 쿼리: no data (메트릭 구조 확인 필요)
