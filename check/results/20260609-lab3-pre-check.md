# Lab-3 확장 사전 확인 결과 (2026-06-09)

## 실행: bash check/targetExecCmd/20260609.sh

### 1. Lab-3 node-exporter 타겟
- count: 2 (모두 down)
- 10.144.131.121:9100 job=kubernetes-pods health=down
- 10.144.131.122:9100 job=kubernetes-pods health=down
- **참고**: job이 `node-exporter`가 아니라 `kubernetes-pods` → node-exporter DaemonSet이 Lab-3에 미배포이거나, scrape config가 다름

### 2. Lab-3 cAdvisor 타겟
- count: 0
- **Lab-3 cAdvisor가 Lab-1 Prometheus에 전혀 안 보임**

### 3. Lab-3 PCM 타겟
- count: 1 (down)
- s121x13qra131 job=QRA-SMC-EMR_PCM health=down
- **사용자 확인 필요**: 이 서버가 실제로 존재하는지 불확실 (없는 것으로 추정)

### 4. Lab-3 CPU 메트릭
- NO DATA

### 5. Lab-3 up 상태
- NO DATA (Lab-3에서 up인 타겟이 하나도 없음)

### 6. DB 등록 현황
- Lab-1: 6대, Lab-3: 3대, no-ip: 0, total: 9

## 분석

Lab-3 메트릭이 Lab-1 Prometheus에 거의 들어오지 않는 상태.
- node-exporter: 2개 타겟만 보이고 모두 down (job이 kubernetes-pods)
- cAdvisor: 0개
- PCM: 1개, down, 서버 존재 여부 미확인

→ Lab-3 → Lab-1 federation 설정이 불완전하거나, Lab-3 K8s 모니터링 스택(node-exporter/cAdvisor)이 미배포 가능성 높음
→ Lab-3 마스터(10.144.131.100)에서 직접 확인 필요
