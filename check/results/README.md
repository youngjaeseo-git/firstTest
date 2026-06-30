# 확인 결과 저장소

스크립트 실행 결과를 `check/results/YYYYMMDD-항목.md` 형식으로 저장한다.
한번 확인한 데이터는 다시 요청하지 않고 이 파일들을 참조한다.

## 파일 목록

| 파일 | 내용 |
|------|------|
| 20260522-ne-cadvisor-status.md | node-exporter/cAdvisor UP/DOWN, 인스턴스 형식, 스크랩 에러 |
| 20260522-prom-config.md | Prometheus ConfigMap, DaemonSet, node-exporter Pod 상태 |
| 20260526-temp-power-workload.md | 온도/전력 메트릭 구조, 워크로드 Pod 정보 |
