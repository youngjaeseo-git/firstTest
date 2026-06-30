# Lab-3 node-exporter 네트워크 진단 결과 (2026-06-12)

## node-exporter Pod 설정
- hostNetwork: 미설정 (false)
- podIP: 172.16.204.65 (클러스터 내부 네트워크)
- hostIP: 10.144.131.116
- containerPort: 9100
- DaemonSet: 16/16 ready

## node-exporter Service
- 타입: NodePort
- ClusterIP: 10.103.17.81
- Port: 9100:31672/TCP

## 접근 테스트 결과 (131.100에서)
- 노드IP:9100 → 불가 (hostNetwork 미사용)
- 노드IP:31672 (NodePort) → 불가 (FAIL/000)
- PodIP:9100 → 불가 (마스터→Pod 네트워크 불통)

## Prometheus ConfigMap
- 이름: prometheus-server-conf
- 데이터 키: 확인 필요 (jsonpath 실패, "no data")

## Lab-3 전체 노드 IP (22개, kubectl get nodes 기준)
10.144.131.100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
111, 112, 113, 114, 115, 116, 117, 118, 119, 120,
151, 190

※ 이전 Prometheus targets(21개)에 없던 신규: 10.144.131.151
※ Lab-1 클러스터에만 있는 131.x: 131.121, 131.122, 131.213

## 수정 방향
1. node-exporter DaemonSet → hostNetwork: true 패치
2. Prometheus ConfigMap → node-exporter static_configs job 추가
