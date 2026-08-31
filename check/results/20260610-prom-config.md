# Lab-1 Prometheus Config 정밀 분석 결과 (2026-06-10)

## 실행: Lab-1(10.144.38.100)에서 bash check/targetExecCmd/20260610-prom-config.sh

### 1. job 전체 목록 (16개)
| job_name | SD 방식 | metrics_path |
|----------|---------|-------------|
| server-info | static | /metrics |
| temperature | static | /metrics |
| PCM | static | /metrics |
| QRA-SMC-DDR5-PCM | static | /metrics |
| AE-SMC-GNRAP_PCM | static | /metrics |
| AE-SMC-GNRSP_PCM | static | /metrics |
| AE-SMC-SRF_PCM | static | /metrics |
| QRA-SMC-EMR_PCM | static | /metrics |
| QRA-SMC-DDR5-Dell | static | /metrics |
| kubernetes-apiservers | k8s_sd | /metrics |
| kubernetes-nodes | k8s_sd | /metrics |
| kubernetes-pods | k8s_sd | /metrics |
| kube-state-metrics | static | /metrics |
| kubernetes-cadvisor | k8s_sd | /metrics |
| kubernetes-service-endpoints | k8s_sd | /metrics |
| node-exporter | static | /metrics |

### 2. :9200 포트 사용 job
- **QRA-SMC-DDR5-Dell만** :9200 사용
- count=136, sample=10.80.103.102:9200, health=down
- Lab-3 서버와 무관 (10.80.x 대역)

### 3. :9200 메트릭 종류
- node_cpu_seconds_total on :9200 = NO
- :9200 metric count=0 — 전부 down이라 메트릭 수집 안 됨

### 4. federation 확인
- federate-path jobs: "node" (파싱 결과) — 하지만 raw에 "/federate" 문자열 없음
- honor_labels=true: 없음
- match[]: 없음
- **결론**: federation 설정은 사실상 없는 것으로 보이나, 파싱 불일치 있어 원본 config 대조 필요

### 5. Lab-3 IP(131) 대역 타겟 — job별
| job | up | down | sample |
|-----|-----|------|--------|
| QRA-SMC-DDR5-Dell | 0 | 1 | 10.80.103.131:9200 |
| QRA-SMC-EMR_PCM | 0 | 1 | s121x13qra131 (hostname) |
| kubernetes-pods | 1 | 2 | 10.144.131.121:9100 |
| node-exporter | 1 | 0 | 10.144.38.131:9100 |

**주의**: Lab-3 GNR-AP/SP 서버는 hostname 기반(s222hax14ae*, s222hx14ae*)으로 수집되어 "131" IP grep에 안 잡힘. 실제로는 AE-SMC-GNRAP_PCM, AE-SMC-GNRSP_PCM job에서 수집 중.

### 6. config 크기
- 전체 1348줄, 16개 scrape job

---

## 이전 분석 정정

| 항목 | 이전 추론 (오류) | 실제 |
|------|----------------|------|
| :9200 | Lab-3 서버 PCM/server-info | QRA-SMC-DDR5-Dell (10.80.x, Lab-3 무관) |
| Lab-3 수집 방식 | :9200으로 직접 IP scrape | hostname 기반 PCM job (AE-SMC-GNRAP_PCM 등) |
| 이전 섹션8 "131 포함 줄" | Lab-3 직접 scrape 증거 | grep 결과의 맥락 부족으로 오해 |

## 대조 필요 사항 (사용자 직접 config 확인)
1. 섹션 4에서 `federate-path jobs: node` 결과의 의미 — 원본 config에 /federate path가 있는 job이 있는지
2. Lab-3 GNR-AP/SP가 AE-SMC-GNRAP_PCM, AE-SMC-GNRSP_PCM에서 실제로 hostname 기반으로 수집되는지
3. Lab-3 node-exporter(:9100)가 Lab-1 config에 포함되어 있는지
