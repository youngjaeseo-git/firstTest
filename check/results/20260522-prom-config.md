# 2026-05-22 Prometheus 설정 및 node-exporter DaemonSet 확인

## 출처: check/targetExecCmd/20260522-prom-config.sh 실행 결과

### Prometheus ConfigMap
- 이름: `prometheus-server-conf`
- namespace: `monitoring`

### Prometheus Deployment
- 이름: `prometheus-deployment`
- namespace: `monitoring`

### node-exporter DaemonSet
- namespace: `monitoring`
- Pod 총 43개

| 상태 | 수 |
|------|-----|
| Running | 18 |
| Pending | 13 |
| ImagePullBackOff | 6 |
| Evicted | 2 |
| 기타 | 4 |

### 이중 설정
- K8s DaemonSet (monitoring ns) + Prometheus static_configs (수동 IP) 공존
- 사용자가 별도 YAML로 NE를 배포한 것과 DaemonSet이 별개로 존재
- 정리 필요 (TODO)
