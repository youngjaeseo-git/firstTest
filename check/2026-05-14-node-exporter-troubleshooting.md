# Prometheus node-exporter Troubleshooting (2026-05-14)

## 현재 문제
- SPR (10.144.38.103:9100): HTTP 200 OK (정상)
- GNR-AP (10.144.38.61:9100): HTTP 000 (연결 실패)
- GNR-SP (10.144.38.81:9100): HTTP 000 (연결 실패)

## 진행 상황
- 방화벽 9100 포트 허용 확인됨
- node-exporter DaemonSet (hostNetwork: true)
- Prometheus에서 일부 노드만 scrape 성공

## 진단 명령어
1. Prometheus pod 내부 curl 테스트
2. 문제 노드에서 `ss -tlnp | grep 9100` 또는 `netstat -tlnp | grep 9100`
3. node-exporter pod 로그 확인

## 다음 액션
- Prometheus pod에서 직접 curl 테스트 결과 공유
- 문제 노드의 node-exporter pod 상태 및 로그 확인

---
작성일: 2026-05-14