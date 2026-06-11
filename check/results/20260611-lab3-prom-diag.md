# Lab-3 Prometheus 진단 결과 (2026-06-11)

## A. Lab-3 Prometheus Job 목록 (6개, 전부 k8s_sd)
- kubernetes-apiservers
- kubernetes-nodes
- kubernetes-pods
- kubernetes-metrics
- kubernetes-cadvisor
- kubernetes-service-endpoints

**node-exporter job 없음!** (Lab-1에는 static targets로 있음)

## B. Down 타겟 에러 원인
모두 `context deadline exceeded` (타임아웃)

| Job | 타겟 URL 예시 | 에러 |
|-----|-------------|------|
| kubernetes-cadvisor | https://kubernetes.default.svc:443/api/v1/nodes/s222hax14ae007/proxy/metrics/cadvisor | context deadline exceeded |
| kubernetes-nodes | https://kubernetes.default.svc:443/api/v1/nodes/s222hax14ae001/proxy/metrics | context deadline exceeded |
| kubernetes-service-endpoints | http://172.16.65.33:9153/metrics | context deadline exceeded |

### 핵심 발견
- 타겟 노드명에 `s222hax14ae` 포함 → **이건 Lab-1 호스트명!**
- Lab-3 Prometheus가 k8s_sd로 전체 클러스터 노드를 발견하지만, Lab-1 노드에는 네트워크 도달 불가 → 타임아웃
- Lab-3 노드(131.x)도 같은 API proxy 경로로 접근 시도 → 동일하게 타임아웃 가능성
- 결론: **K8s API proxy 경유 방식이 Lab-3 네트워크에서 동작 안 함**

## C. Lab-1 node-exporter 설정
- job: node-exporter
- type: static targets (21개)
- 포트: 9100
- 샘플: 10.144.38.61:9100, 10.144.38.62:9100 ...
- interval: 5s

## 수정 방향
1. **node-exporter**: Lab-3 노드 IP:9100을 static targets로 추가 (Lab-1과 동일 방식)
   - 전제: Lab-3 노드에 node-exporter가 실행 중이어야 함
2. **cadvisor/nodes**: K8s API proxy 타임아웃 → 직접 kubelet 접근 또는 relabel로 Lab-3 노드만 필터
