# 2026-06-01: node-exporter 실제 job 라벨 확인 결과

## 출처: check/targetExecCmd/20260601.sh 실행

## 1. node_uname_info의 job 라벨 분포

| Job | 엔트리 수 |
|-----|----------|
| kubernetes-pods | 18 |
| node-exporter | 16 |
| server-info | 15 |

**결론: `job="node-exporter"` 는 동작함 (16대). 0529 결과와 불일치 — 당시 일시적 문제였거나 스크립트 이슈.**

## 2. node_cpu_seconds_total

"no data" — URL 인코딩 문제이거나 결과가 너무 커서 파싱 실패 가능성. 16대 UP이면 이 메트릭은 존재해야 정상.

## 3. 전체 job별 타겟 수

| Job | UP | DOWN | Total |
|-----|-----|------|-------|
| node-exporter | 16 | 5 | 21 |
| kubernetes-pods | 18 | 10 | 28 |
| kubernetes-cadvisor | 25 | 18 | 43 |
| kubernetes-nodes | 25 | 18 | 43 |
| server-info | 15 | 26 | 41 |
| PCM | 16 | 25 | 41 |
| QRA-SMC-DDR5-DELL | 136 | 0 | 136 |
| QRA-SMC-DDR5-PCM | 1 | 49 | 50 |
| QRA-SMC-EMR_PCM | 0 | 40 | 40 |
| AE-SMC-GNRAP_PCM | ~17 | ~9 | ~26 |
| kube-state-metrics | 1 | 0 | 1 |
| kubernetes-apiservers | 1 | 0 | 1 |
| kubernetes-service-endpoints | 4 | 0 | 4 |
| temperature | 0 | 1 | 1 |

## 4. 10.80.103.* 대역

**타겟 수: 0** — 완전히 제거됨. 5/22에는 존재했던 서버들.

## 5. IPMI exporter

**ipmi_up 메트릭: 0개** — DaemonSet(43 pods, 22 ready)이 있으나 Prometheus에서 메트릭 수집 안 됨.
가능 원인:
- Prometheus에 ipmi-exporter scrape config 미설정
- IPMI exporter pod가 실행되지만 target으로 등록 안 됨
- 노드에 IPMI 인터페이스 미설정

## 핵심 결론

1. **코드 정상 동작**: `job="node-exporter"`가 16대 UP → 현재 코드의 NE 쿼리 동작함
2. **중복 스크래핑 확인**: kubernetes-pods(18) + node-exporter(16) → 동일 서버가 2번 수집
3. **IPMI 미동작**: DaemonSet만 있고 Prometheus 수집 안 됨 → BMC 기능 보류
4. **10.80.103.* 제거**: 이전 lab 서버 폐기된 것으로 보임
5. **temperature job DOWN**: 1개 타겟, up=0 → 온도 메트릭 소스 문제
