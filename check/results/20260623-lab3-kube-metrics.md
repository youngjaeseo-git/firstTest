# Lab-3 Prometheus kube 메트릭 확인 결과 (2026-06-23)

## 결과 요약

| 항목 | 결과 |
|------|------|
| Lab-3 Prometheus 접근 | ✅ HTTP 200 |
| kube_pod_info 총 건수 | **80개** |
| kube_node_info 노드 수 | **22개** |
| dcim-test Pod | **3개 보임** |
| Lab-1에서 Lab-3 Pod | **0개 (전혀 안 보임)** |

## 네임스페이스별 Pod 수
- kube-system: 52
- monitoring: 22
- dcim-test: 3
- cmx-accel-sp16g-vrt: 1
- cmx-ber-sp32gb: 1

## dcim-test Pod 상세
| Pod | Node |
|-----|------|
| test-pod-3 | s222hax14ae006 |
| test-pod-2 | s222hax14ae007 |
| test-pod-1 | s222hx14ae001-devel |

## kube_node_info 특이사항
- 22개 노드 존재
- **internal_ip 라벨 없음** (모든 노드 ip=?)
- 노드명: s222hx14ae006, s222hax14ae001~004, ...외 17개

## 핵심 결론
1. Lab-3 Prometheus(131.190:30003)에 kube 데이터 **정상 존재**
2. Lab-1 Prometheus에는 Lab-3 Pod 데이터 **전혀 없음** (federation 없음)
3. kube_node_info에 internal_ip가 없어서 IP 기반 필터링 불가
4. → DCIM 앱에서 Lab-3 Prometheus를 **직접 조회해야** Lab-3 Pod를 볼 수 있음
5. Lab-3 Prometheus에서 오는 Pod는 **전부 Lab-3** → 별도 IP 필터링 불필요
