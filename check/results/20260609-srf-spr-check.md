# Lab-3 SRF/SPR 서버 진단 결과 (2026-06-09)

## 실행: Lab-3 마스터(10.144.131.100)에서 bash check/targetExecCmd/20260609-lab3-local.sh (섹션 8~10)

### 8. SRF 4대 (g222bx14ae001~004)
| IP | ping | ssh | node-exporter |
|----|------|-----|---------------|
| 10.144.131.121 | up | fail | no |
| 10.144.131.122 | up | fail | no |
| 10.144.131.123 | down | fail | no |
| 10.144.131.124 | down | fail | no |

- Lab-1에서 이전, hostname 동일(g222bx14ae001~004), IP 변경됨
- 2대 alive (.121, .122), 2대 unreachable (.123, .124)
- SSH 키 미설정으로 hostname 원격 확인 불가

### 9. SPR 3대 (s121x13ae101~103)
| IP | ping | ssh | node-exporter |
|----|------|-----|---------------|
| 10.144.131.211 | up | fail | no |
| 10.144.131.212 | up | fail | no |
| 10.144.131.213 | up | fail | no |

- 3대 모두 alive — IP 범위 확정: .211~.213 (기존 문서는 .211~.212로 2개만 기재)
- hostname/IP 모두 변경되었을 가능성 있음 (확인 필요)
- SSH 키 미설정으로 hostname 원격 확인 불가

### 10. Prometheus에서 SRF/SPR 타겟
- prom-query-failed — Lab-3 Prometheus 자체가 타겟 데이터를 반환하지 못하는 상태

---

## 요약
- SRF: 4대 중 2대(.121, .122)만 네트워크 도달 가능. .123, .124는 전원 또는 네트워크 확인 필요
- SPR: 3대 모두 도달 가능. IP 범위 .211~.213 확정
- 공통: SSH 불가(키 미설정), node-exporter 미설치(K8s 미등록), Prometheus 타겟 미수집
- hostname 확인: SSH 키 설정 또는 BMC/콘솔 접근으로 확인해야 함
