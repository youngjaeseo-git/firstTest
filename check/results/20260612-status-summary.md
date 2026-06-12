# Lab-3 node-exporter 작업 현황 (2026-06-12 퇴근 시점)

## 목표
Lab-3 서버의 CPU/메모리/디스크/네트워크 메트릭을 DCIM에서 볼 수 있게 하기

## 확정된 전략
Lab-1 Prometheus 하나로 Lab-3 node-exporter도 수집 (Multi-Prometheus 불필요)

```
Lab-1 Prometheus (10.100.175.248:8080)
├── Lab-1 node-exporter (38.x:9100) ✅ 정상
├── Lab-1 PCM (38.x:9200) ✅ 정상
├── Lab-3 PCM (131.x:9200) ✅ 정상
└── Lab-3 node-exporter (131.x:9100) ← 작업 중
```

## 완료된 작업
- [x] Lab-3 Prometheus URL 확인: 10.144.131.190:30003
- [x] Lab-3 노드 목록 확인 (22대): 131.100-109, 111-120, 151, 190
- [x] Lab-1 Prometheus가 Lab-3 PCM을 이미 수집 중임을 확인
- [x] node-exporter DaemonSet 존재 확인 (16/16 ready)
- [x] hostNetwork 미사용 확인 → 패치 필요

## 현재 진행 상태 (여기서 중단)

### 필요한 작업 3개
| 단계 | 내용 | 실행 위치 | 상태 |
|------|------|----------|------|
| ① 방화벽 9100 개방 | `firewall-cmd --add-port=9100/tcp` | Lab-3 각 노드 | s222hx14ae010(131.120) 1대만 실행 |
| ② hostNetwork 패치 | `20260612-3.sh` STEP 1 | 131.100 | 실행 여부 미확인 |
| ③ Lab-1 Prometheus ConfigMap | node-exporter-lab3 job 추가 | 38.100 | 미실행 |

### 현재 막힌 곳
38.100 → 131.120:9100 접근 시 **"No route to host"** 발생

### 다음주 확인 사항 (131.120 노드에서 직접)
```
firewall-cmd --list-ports        # 9100/tcp가 보이는지?
ss -tlnp | grep 9100             # node-exporter가 9100에서 수신 중인지?
```

### 예상 원인과 대응
| firewall-cmd 결과 | ss 결과 | 의미 | 조치 |
|-------------------|---------|------|------|
| 9100 있음 | 9100 수신 중 | 네트워크 경로 문제 | 서브넷 간 라우팅 확인 |
| 9100 있음 | 9100 없음 | hostNetwork 패치 안 됨 | 131.100에서 STEP 1 실행 |
| 9100 없음 | - | 방화벽 미적용 | firewall-cmd 재실행 + reload |

## 전체 완료 후 추가 작업
- [ ] 나머지 21대 노드에도 방화벽 9100 개방 (기존 세팅 스크립트에 9100 추가)
- [ ] BMC IP 중복 문제 → Lab-3 마스터(131.100) 프록시 구현
- [ ] DB 컨테이너 이름 변경 (firsttest-db-1 → dcim-db)

## 관련 파일
- 스크립트: `check/targetExecCmd/20260612-3.sh` (hostNetwork 패치 + 안내)
- 결과 기록: `check/results/20260612-*`, `check/results/20260611-*`
