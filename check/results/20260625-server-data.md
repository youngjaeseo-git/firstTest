# 서버 데이터 정합성 확인 결과 (2026-06-25)

## D1. CPU 데이터 현황
- HAS_CPU=7, NO_CPU=23
- 30대 중 7대만 CPU 데이터 있음

## D2. CPU 없는 서버 목록 (15건 표시, 총 23대)
| hostname | BMC IP |
|----------|--------|
| g222bx14ae001 | 192.168.10.121 |
| g222bx14ae002 | 192.168.10.122 |
| g222bx14ae004 | 192.168.10.124 |
| s121x13ae103 | 192.168.10.213 |
| s222hax14ae001 | 192.168.10.101 |
| s222hax14ae002 | 192.168.10.102 |
| s222hax14ae003 | 192.168.10.103 |
| s222hax14ae004 | 192.168.10.104 |
| s222hax14ae005 | 192.168.10.105 |
| s222hax14ae006 | 192.168.10.106 |
| s222hax14ae007 | 192.168.10.107 |
| s222hax14ae008 | 192.168.10.108 |
| s222hax14ae009 | 192.168.10.109 |
| s222hx14ae001 | 192.168.10.111 |
| s222hx14ae002 | 192.168.10.112 |

→ 전부 BMC IP 있음. Refresh HW 가능.

## D3. Memory 데이터 현황
- HAS_MEM=10, NO_MEM=20

## D4. biosVersion 분류
| 타입 | 건수 | 의미 |
|------|------|------|
| KERNEL | 1 | 이전 코드 버그로 커널버전 저장됨 (수정완료, DB 정리 필요) |
| NULL | 20 | Redfish refresh 안 된 서버 |
| REAL_BIOS | 2 | 정상 (Redfish에서 가져온 실제 BIOS) |
| V1.0 | 7 | BMC가 반환한 기본값 or 실제값 |

## D5. biosVersion 샘플
- KERNEL: g222bx14ae001 → "kernel 5.14.0-503.35.1.el9_5.x"
- V1.0: s222hx14ae001 → "1.0"
- REAL_BIOS: s222hax14ae011 → "BIOS Date: 11/10/2025 Ver 1.2."

## D6. BMC IP 설정
- HAS_BMC=30, NO_BMC=0
- 전체 30대 모두 BMC IP 있음

## 분석
1. **CPU/Memory 누락 원인**: BMC Redfish refresh가 실행되지 않은 서버 (23/30대)
2. **모든 서버에 BMC IP 있음** → bulk refresh 가능
3. **"kernel ..." biosVersion**: 이전 코드 폴백 버그 (1건). DB 정리 필요
4. **"1.0" biosVersion**: BMC가 실제로 반환하는 값. refresh 후에도 동일하면 해당 서버의 실제 BIOS 버전
5. **해결책**: 전체 서버 bulk HW refresh → CPU/Memory/BIOS 한번에 채움
