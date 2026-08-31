# Lab-3 node-exporter 연동 완료 (2026-06-15)

## 최종 결과
- Lab-3 node-exporter: **17/22 UP** (꺼진 서버 5대 제외 전부 정상)
- Lab-1 node-exporter: **21대 정상** (기존 모니터링 영향 없음)

## 해결한 문제들

### 1. hostNetwork 미적용
- **원인**: DaemonSet spec에 hostNetwork:true 패치는 됐지만, RollingUpdate가 진행 안 됨 (UP-TO-DATE=0)
- **근본원인**: 꺼진 노드 4대 때문에 maxUnavailable 예산 소진 → 롤아웃 정체
- **해결**: 살아있는 노드의 Pod를 1개씩 수동 삭제 → hostNetwork:true로 재생성
- **실제 라벨**: `k8s-app: node-exporter` (app이 아님)

### 2. Prometheus ConfigMap 미반영
- **원인**: ver6 apply 후 Pod 재시작했지만 시작 시점에 이전 ConfigMap 캐시를 읽음
- **해결**: `kubectl exec POD -- kill -HUP 1` (SIGHUP)으로 안전하게 config 재로드
- **참고**: `/-/reload`는 403 (--web.enable-lifecycle 비활성)

### 3. 스크립트 카운트 버그
- `grep -c`는 라인 수를 세므로 단일 라인 JSON에서 항상 1 반환
- `grep -o | wc -l`로 수정하여 정확한 매칭 수 확인

## 현재 아키텍처
```
Lab-1 Prometheus (10.100.175.248:8080)
├── Lab-1 node-exporter (38.x:9100) → 21대 UP ✅
├── Lab-1 PCM (38.x:9200) ✅
├── Lab-3 PCM (131.x:9200) ✅
└── Lab-3 node-exporter (131.x:9100) → 17대 UP ✅  ← 오늘 완료
```

## DOWN 타겟 (5대)
- 10.144.131.101 (s222hax14ae001) — NotReady
- 10.144.131.102 (s222hax14ae002) — NotReady
- 10.144.131.106 (s222hax14ae006) — NotReady
- 10.144.131.108 (s222hax14ae008) — NotReady
- 1대 추가 (100번 마스터 또는 151 확인 필요)
