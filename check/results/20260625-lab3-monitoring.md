# Lab-3 모니터링 검증 결과 (2026-06-25)

> `check/targetExecCmd/20260624.sh` 실행 결과

## Organization 스키마 적용

- Prisma Client 생성: 성공
- 스크립트 실행: 성공

## B4: Lab-3 장비 DB ipAddress 확인

- **결과**: `error no such container: dcim-db`
- **원인**: 서버에 아직 소스 반영 안 됨 (컨테이너 이름 변경 `firsttest-db-1` → `dcim-db` 미적용)
- **조치**: 다음 배포 시 자동 해결

## B5-1: Lab-3 PCM UP/DOWN

| Job | up | down | 이전(infrastructure.md) |
|-----|-----|------|----------------------|
| AE-SMC-GNRAP_PCM | 8 | 3 | up=7 down=4 |
| AE-SMC-GNRSP_PCM | 10 | 0 | up=10 down=0 (변동 없음) |

- GNR-AP PCM: 1대 추가 복구 (7→8)

## B5-2: kube_pod_info node 라벨 형식

- `node=s222hax14ae006` — **hostname 형식** (IP 아님)
- Lab-3 Prometheus의 kube_pod_info는 hostname 기반으로 Pod-to-Node 매핑

## B5-3: Lab-3 NE instance 형식

- `instance=10.144.131.100:9100` — **IP:port 형식**
- `total=22` — Lab-3 node-exporter 타겟 22개 (이전 문서: 17 UP + 5 DOWN = 22개, UP 수 증가 가능성)

## 요약

- Lab-3 PCM: GNR-AP 1대 추가 복구, GNR-SP 전원 정상
- Lab-3 NE: 22대 타겟 확인 (IP:port 형식)
- kube_pod_info: hostname 형식 (IP 아님)
- B4(DB 확인)는 컨테이너 이름 미반영으로 실패 — 다음 배포 시 재확인
