# Multi-Prometheus 구조 (담당자 문서 기반, 2026-06-11)

## 메트릭 구조

- **시각화**: Cluster 1 (k8-master, 10.144.38.x)의 Grafana에서 담당
- **Prometheus**: 클러스터별로 분리
  - Cluster 1: 데이터 → `dsa-monitoring` 저장
  - Cluster 2 (k8s-lab3, 10.144.131.x): 데이터 → `dsq-storage` 저장
- **Cluster 2 전용 모니터링 워커 노드**: 10.144.131.190 (`k8s-monitoring`)
- **Cluster 1, 2 간 Prometheus 설정 차이 없음**

## 핵심 추론

- Grafana가 양쪽 Prometheus를 모두 연결 → Grafana 데이터소스 설정에 Cluster 2 Prometheus URL 존재
- Lab-3 Prometheus가 실제로 동작 중 (이전 확인에서 "비기능"이라 했지만 모니터링 전용 노드에서 운영)
- 10.144.131.190이 모니터링 워커 → 이 노드에서 Prometheus가 실행 중일 가능성 높음
- `dsa-monitoring`, `dsq-storage`는 스토리지 볼륨 또는 노드명

## 확인 필요 사항

1. Grafana 데이터소스 목록 → Cluster 2 Prometheus URL 확인
2. 10.144.131.190에서 Prometheus 포트 확인
3. Lab-1(DCIM 서버)에서 해당 URL 접근 가능 여부
