# Lab-1 Prometheus ConfigMap 최종 확인 (2026-06-10)

## 실행: Lab-1(10.144.38.100)에서 bash check/targetExecCmd/20260610-config-extract.sh

### 1. Federation
- prometheus.yml: no /federate
- **확정: federation 설정 없음**

### 2. Lab-3 node-exporter(:9100)
- config.yaml: no 131:9100
- prometheus.rules: no 131:9100
- prometheus.yml: no 131:9100
- **확정: Lab-3 node-exporter는 Lab-1 config에 미포함**

### 3. Grafana 확인 (사용자 직접)
- Grafana: http://10.144.38.100:30004
- "Processor Count Monitor (AE GNR)" 대시보드에서 Lab-3 서버 데이터 정상 표시
- **확정: PCM 메트릭(hostname 기반)은 Lab-1 Prometheus에서 정상 수집 중**

---

## Lab-3 메트릭 수집 최종 현황

| 메트릭 소스 | 수집 여부 | job | 방식 |
|------------|----------|-----|------|
| PCM (전력/프로세서) | O | AE-SMC-GNRAP_PCM, AE-SMC-GNRSP_PCM | hostname 기반 static |
| node-exporter (CPU/Mem/Disk/Net) | X | 미설정 | Lab-3 DaemonSet 동작 중이나 Lab-1이 수집 안 함 |
| cAdvisor (컨테이너) | X | - | Lab-3 Prometheus 비기능 |
| server-info | 확인 필요 | server-info | hostname 기반일 가능성 |
