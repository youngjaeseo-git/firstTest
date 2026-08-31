# Lab-3 Prometheus 상세 진단 결과 (2026-06-09)

## Lab-1에서 실행 (섹션 7~8)

### 7. Lab-1 → Lab-3 Prometheus 직접 접근
- unreachable or parse-fail
- **Lab-1에서 Lab-3 Prometheus(10.144.131.100:30003)에 접근 불가**

### 8. Lab-1 Prometheus 설정에서 Lab-3 관련 내용
- contains 131: True
- contains federate: **False** — federation 설정 없음!
- Lab-1이 Lab-3 서버를 **직접 scrape**하는 구조:
  - 10.144.38.131:9100, :9200
  - 10.144.131.101~109:9200 (GNR-AP 9대)
  - 10.144.131.111~120:9200 (GNR-SP 10대)
  - s121x13qra131 (hostname)
  - 10.80.103.131:9200
- **포트 9200** — node-exporter(9100)가 아님. PCM 또는 server-info exporter 추정

---

## Lab-3 마스터에서 실행 (섹션 11~13)

### 11. Prometheus Pod 상태 + 로그
- prometheus-deployment-848fd5f5d-qcslg 1/1 Running (63일)
- 로그: **전부 에러** — K8s API 서버(10.96.0.1:443) 접근 실패
  - `i/o timeout`
  - `connect: no route to host`
- **원인**: Prometheus Pod가 K8s API에 도달 불가 → service discovery 전부 실패

### 12. Prometheus ConfigMap scrape 설정
- file=prometheus.yml, jobs=6:
  - kubernetes-apiservers targets=0
  - kubernetes-nodes targets=0
  - kubernetes-pods targets=0
  - kubernetes-metrics targets=1
  - kubernetes-cadvisor targets=0
  - kubernetes-service-endpoints targets=0
- **모든 job이 kubernetes service discovery 기반** → K8s API 불통이면 타겟 0개

### 13. Prometheus 직접 curl 테스트
- /api/v1/status/config: http=000 (연결 불가)
- /api/v1/targets: empty response
- **Lab-3 Prometheus는 사실상 죽어있는 상태** (Pod는 Running이지만 HTTP 응답 불가)

---

## 핵심 발견

### 아키텍처 (실제 구조)
- **federation 없음** — Lab-1 Prometheus가 Lab-3 서버를 직접 scrape
- Lab-1 → Lab-3 서버 :9200 직접 접근 (PCM/server-info)
- Lab-3 Prometheus는 K8s API 불통으로 완전 비기능 상태

### Lab-3 메트릭 가용성
| 메트릭 소스 | 포트 | Lab-1에서 수집 | 비고 |
|------------|------|---------------|------|
| PCM/server-info | 9200 | O (직접 scrape) | GNR-AP, GNR-SP |
| node-exporter | 9100 | X | DaemonSet 동작 중이나 Lab-1이 scrape 안 함 |
| cAdvisor | - | X | Lab-3 Prometheus 비기능 |

### 즉, Lab-3 서버에서 현재 수집 가능한 것
- :9200 통한 메트릭 (PCM 전력, server-info 등) — Lab-1 Prometheus에서 직접 수집 중
- node-exporter(CPU, Memory, Disk, Network)는 Lab-3에서 돌고 있지만 아무도 수집 안 함
