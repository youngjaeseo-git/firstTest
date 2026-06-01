# 2026-06-01: hostname ↔ IP 매핑 + DaemonSet/IPMI 구조 확인 결과

## 0. monitoring 네임스페이스 DaemonSet 목록

| DaemonSet | Desired | Current | Ready | Up-to-date | Available | Image |
|-----------|---------|---------|-------|------------|-----------|-------|
| ipmi-exporter | 43 | 43 | 22 | 43 | 22 | prometheuscommunity/ipmi-exporter:v1.8.0 |
| node-exporter | 43 | 43 | 22 | 33 | 22 | prom/node-exporter:v1.8.0 |

## 0-1. IPMI 관련 Pod/DaemonSet

- ipmi-exporter Pod 5개 샘플: 4개 Running, 1개 Pending
- DaemonSet: 43 desired, 43 current, 22 ready, 43 up-to-date, 22 available

## 0-2. node-exporter Pod 상태

| Status | Count |
|--------|-------|
| Running | 23 |
| Pending | 14 |
| ImagePullBackOff | 5 |
| Evicted | 1 |

**총 43개 중 23개만 정상 동작 (53.5%)**

## 0-3. Prometheus ConfigMap job 목록 (16개)

1. server-info
2. temperature
3. PCM
4. QRA-SMC-DDR5-PCM
5. AE-SMC-GNRAP_PCM
6. AE-SMC-GNRSP_PCM
7. AE-SMC-SRF_PCM
8. QRA-SMC-EMR_PCM
9. QRA-SMC-DDR5_Dell
10. kubernetes-apiservers
11. kubernetes-nodes
12. kubernetes-pods
13. kube-state-metrics
14. kubernetes-cadvisor
15. kubernetes-service-endpoints
16. node-exporter

## 1. node_uname_info hostname-IP 매핑 (총 49개 엔트리)

### IP 기반 인스턴스 (34개 엔트리, 18개 고유 IP)

| IP | Hostname | 중복 횟수 |
|----|----------|----------|
| 10.144.38.100 | k8-master | 2 |
| 10.144.38.103 | s121x13ae003 | 2 |
| 10.144.38.105 | s121x13ae005 | 2 |
| 10.144.38.106 | s121x13ae006 | 2 |
| 10.144.38.107 | s121x13ae007 | 2 |
| 10.144.38.112 | s121x13ae012 | 1 |
| 10.144.38.113 | s121x13ae013 | 2 |
| 10.144.38.114 | s121x13ae014 | 2 |
| 10.144.38.122 | s121x13ae022 | 1 |
| 10.144.38.125 | s121x13ae025 | 2 |
| 10.144.38.128 | s121x13ae028 | 2 |
| 10.144.38.129 | s121x13ae029 | 2 |
| 10.144.38.131 | s121x13ae031 | 2 |
| 10.144.38.132 | s121x13ae032 | 2 |
| 10.144.38.133 | s121x13ae033 | 2 |
| 10.144.38.134 | s121x13ae034 | 2 |
| 10.144.38.61 | s222hax14ae011 | 2 |
| 10.144.38.81 | s222hx14ae021 | 2 |

### Hostname 기반 인스턴스 (15개 엔트리, hostname=instance)

s121x13ae003, s121x13ae005, s121x13ae006, s121x13ae007, s121x13ae012,
s121x13ae013, s121x13ae014, s121x13ae022, s121x13ae025, s121x13ae028,
s121x13ae029, s121x13ae031, s121x13ae032, s121x13ae033, s121x13ae034

**Note:** hostname 기반 엔트리는 kubernetes-pods 또는 kubernetes-nodes 서비스 디스커버리에서 발생. instance 값이 IP가 아닌 hostname:port 형태.

## 2. server-info job

**결과: 0개** — job이 ConfigMap에 존재하나 활성 타겟 없음

## 3. node-exporter job

**결과: 0개** — job이 ConfigMap에 존재하나 활성 타겟 없음. 실제 node-exporter 메트릭은 kubernetes-pods/kubernetes-service-endpoints 서비스 디스커버리를 통해 수집됨.

## 핵심 발견사항

1. **node-exporter/server-info job 빈 타겟**: ConfigMap에 정의돼 있으나 static_configs가 비어있거나 타겟이 다운. 실제 node-exporter 메트릭은 kubernetes SD(kubernetes-pods 등)를 통해 수집.
2. **중복 스크래핑**: 같은 서버가 IP 기반 + hostname 기반으로 2번 수집됨 (16개 서버 × 2 = 32개, 나머지 2개 서버는 1회)
3. **node-exporter 건강 문제**: 43개 노드 중 23개만 Running (14 Pending, 5 ImagePullBackOff, 1 Evicted)
4. **IPMI exporter 존재 확인**: DaemonSet으로 43개 노드 배포, 22개 Ready
5. **고유 서버 수**: 18대 (k8-master 1 + 서버 15 + s222계열 2)
