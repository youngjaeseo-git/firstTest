# node-exporter 응답 불가 이슈 (GNR-AP / GNR-SP)

## 환경
- K8s master: 10.144.38.100
- Prometheus: http://10.100.175.248:8080
- node-exporter DaemonSet: namespace monitoring, hostNetwork:true, port 9100

## 문제 상황
- SPR (10.144.38.103): 정상 (200 OK)
- GNR-AP (10.144.38.61), GNR-SP (10.144.38.81): HTTP 000 (타임아웃 또는 connection refused)
- localhost:9100/metrics 에서도 응답 없음

## 진단 및 해결 단계

1. **node-exporter pod 재시작**
```bash
kubectl -n monitoring delete pod -l app=node-exporter --field-selector=spec.nodeName=문제노드이름 --grace-period=0 --force
```

2. **localhost 테스트**
```bash
timeout 10 curl -v http://localhost:9100/metrics
```

3. **DaemonSet 수정 (filesystem collector 문제 의심 시)**
DaemonSet edit 후 args에 `--no-collector.filesystem` 추가

자세한 내용은 이전 가이드 참조.