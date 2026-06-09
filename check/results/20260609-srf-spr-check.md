# Lab-3 SRF/SPR 서버 진단 결과 (2026-06-09)

## 실행: Lab-3 마스터(10.144.131.100)에서 bash check/targetExecCmd/20260609-lab3-local.sh (섹션 8~10)

### 8. SRF 4대 (g222bx14ae001~004)
| IP | ping | hostname (SSH 수동확인) | node-exporter |
|----|------|------------------------|---------------|
| 10.144.131.121 | up | g222bx14ae001 (동일) | no |
| 10.144.131.122 | up | g222bx14ae002 (동일) | no |
| 10.144.131.123 | down | 미확인 | no |
| 10.144.131.124 | down | 미확인 | no |

- Lab-1에서 이전, hostname 동일 확인 (g222bx14ae001, 002)
- 2대 alive (.121, .122), 2대 unreachable (.123, .124) — 전원 또는 네트워크 확인 필요

### 9. SPR 3대 (구: s121x13ae101~103)
| IP | ping | hostname (SSH 수동확인) | 기존 hostname |
|----|------|------------------------|--------------|
| 10.144.131.211 | up | **s222hx14ae001** | s121x13ae101 |
| 10.144.131.212 | up | **s222hx14ae002** | s121x13ae102 |
| 10.144.131.213 | up | **s222hx14ae003** | s121x13ae103 |

- 3대 모두 alive, IP 범위 .211~.213 확정
- hostname이 s121x13ae → s222hx14ae로 변경됨
- **주의**: GNR-SP 서버 s222hx14ae001~010(.111~.120)과 hostname 겹침 (IP로 구분 필요)

### 10. Prometheus에서 SRF/SPR 타겟
- prom-query-failed — Lab-3 Prometheus 자체가 타겟 데이터를 반환하지 못하는 상태

---

## hostname 매핑 확정

| hostname | IP | 타입 | 비고 |
|----------|-----|------|------|
| g222bx14ae001 | 10.144.131.121 | SRF | Lab-1에서 이전, hostname 동일 |
| g222bx14ae002 | 10.144.131.122 | SRF | Lab-1에서 이전, hostname 동일 |
| g222bx14ae003 | 10.144.131.123 | SRF | ping down, 미확인 |
| g222bx14ae004 | 10.144.131.124 | SRF | ping down, 미확인 |
| s222hx14ae001 | 10.144.131.211 | SPR | 구: s121x13ae101 |
| s222hx14ae002 | 10.144.131.212 | SPR | 구: s121x13ae102 |
| s222hx14ae003 | 10.144.131.213 | SPR | 구: s121x13ae103 |

## 주의: hostname 충돌
- GNR-SP: s222hx14ae001(.111) ~ s222hx14ae010(.120) — K8s 등록
- SPR: s222hx14ae001(.211) ~ s222hx14ae003(.213) — K8s 미등록
- **동일 hostname, 다른 IP** → Prometheus hostname 기반 매칭 시 혼동 가능

## 요약
- SRF: 4대 중 2대(.121, .122)만 도달 가능, hostname 동일 확인
- SPR: 3대 모두 도달 가능, hostname s121x13ae→s222hx14ae로 변경 확인
- 공통: node-exporter 미설치(K8s 미등록), Prometheus 타겟 미수집
- SRF .123, .124는 전원/네트워크 확인 필요
