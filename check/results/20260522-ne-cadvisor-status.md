# 2026-05-22 node-exporter / cAdvisor 상태 확인

## 출처: check/targetExecCmd/20260522.sh 실행 결과

### node-exporter UP 서버 (18대)
- instance 형식: IP:9100
- 10.80.103.100:9100 ~ 10.80.103.124:9100 (일부 제외)
- 10.144.38.100:9100 (k8-master)
- 10.144.38.111~115:9100

### node-exporter DOWN 서버 (7대)
| instance | 원인 |
|----------|------|
| 10.144.38.105:9100 | context deadline exceeded (timeout) |
| 10.144.38.113:9100 | context deadline exceeded (013서버) |
| 10.80.103.61:9100 | context deadline exceeded (timeout) |
| 10.80.103.62:9100 | context deadline exceeded (timeout) |
| 10.80.103.82:9100 | dial tcp connection refused |
| 10.80.103.83:9100 | dial tcp connection refused |
| 10.80.103.84:9100 | dial tcp connection refused |

### cAdvisor UP 서버 (16대)
- instance 형식: hostname (포트 없음)
- s121x13ae003, s121x13ae012~015
- s222hax14ae005~007, 011, 012, 022
- k8-master, s222hax14ae062, 082~084, 등

### cAdvisor DOWN 서버 (2대)
- s222hax14ae061: context deadline exceeded
- s222hax14ae062: context deadline exceeded (일부 job)

### instance 형식 요약
- node-exporter: IP:port (static_configs)
- cAdvisor/kubernetes-nodes: hostname (K8s service discovery)
- PCM: hostname
- server-info: hostname

### 중복 scrape 발견
- kubernetes-pods job이 9100 포트로 node-exporter Pod도 수집 → NE와 중복
- 동일 서버가 hostname(DaemonSet) + IP:port(static_configs)로 이중 scrape

### 015 서버 job 목록 (s121x13ae015)
- kubernetes-cadvisor (hostname)
- kubernetes-nodes (hostname)
- PCM (hostname)
- server-info (hostname)

### timeout 서버 curl 테스트 (마스터에서 직접)
- 013 (10.144.38.113:9100): timeout
- 061 (10.80.103.61:9100): timeout
- 나머지 DOWN 서버: connection refused (NE 미설치 또는 서버 OFF)
