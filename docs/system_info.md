# System Info — Server & IP Mapping

## Lab-1 (10.144.38.x)

K8s Master: 10.144.38.100

| 항목 | Intel GNR-AP | Intel GNR-SP | Ampere | Intel SPR |
|---|---|---|---|---|
| Product SKU | SYS-222HA-TN | SYS-222H-TN | ARS-211M-NR | SYS-121H-TNR |
| MotherBoard | Super X14DBM-AP | Super X14DBM-SP | Super R13SPD | Super X13DEM |
| Hostname | s222hax14ae011~012 | s222hax14ae021~024 | s211mr13ae001~007 | s121x13ae001~040 |
| Host IP | 10.144.38.61~62 | 10.144.38.81~84 | 10.144.38.91~97 | 10.144.38.101~140 |
| BMC IP | 192.168.10.61~62 | 192.168.10.81~84 | 192.168.10.91~97 | 192.168.10.101~140 |
| 대수 | 2 | 4 | 7 | 40 |

## Lab-3 (10.144.131.x)

K8s Master: 10.144.131.100

| 항목 | Intel GNR-AP | Intel GNR-SP | Intel SRF | Intel SPR |
|---|---|---|---|---|
| Product SKU | SYS-222HA-TN | SYS-222H-TN | SSG-222B-NE3X24R | SYS-121H-TNR |
| MotherBoard | Super X14DBM-AP | Super X14DBM-SP | Super X14DBHM | Super X13DEM |
| Hostname | s222hax14ae001~009 | s222hx14ae001~010 | g222bx14ae001~004 | s121x13ae101~103 |
| Host IP | 10.144.131.101~109 | 10.144.131.111~120 | 10.144.131.121~124 | 10.144.131.211~212 |
| BMC IP | 192.168.10.101~109 | 192.168.10.111~120 | 192.168.10.121~124 | 192.168.10.211~212 |
| 대수 | 9 | 10 | 4 | 3 |

## BMC IP 충돌 문제

Lab-1과 Lab-3의 BMC IP 대역이 동일한 `192.168.10.x`를 사용하므로,
DCIM 앱에서 BMC에 접속할 때 어느 Lab의 BMC인지 구분이 필요하다.

### 충돌하는 범위
| BMC IP | Lab-1 서버 | Lab-3 서버 |
|---|---|---|
| 192.168.10.101~109 | SPR (s121x13ae001~009) | GNR-AP (s222hax14ae001~009) |
| 192.168.10.111~120 | SPR (s121x13ae011~020) | GNR-SP (s222hx14ae001~010) |
| 192.168.10.121~124 | SPR (s121x13ae021~024) | SRF (g222bx14ae001~004) |
| 192.168.10.211~212 | — | SPR (s121x13ae101~103) |

→ DCIM 앱 서버(10.144.38.100)에서 `192.168.10.101`에 접속하면
  Lab-1 SPR BMC에 연결됨 (Lab-3 GNR-AP BMC가 아님).
  Lab-3 BMC 접근에는 별도 네트워크 경로 또는 게이트웨이가 필요할 수 있음.

## Redfish 엔드포인트 지원 현황 (2026-05-12 확인)

| 엔드포인트 | SPR (v1.9.0) | GNR-AP (v1.21.1) | GNR-SP (v1.21.1) | Ampere (v1.17.0) | SRF |
|---|---|---|---|---|---|
| Thermal (구형) | OK (24 temp, 8 fan) | OK (21 temp, 9 fan) | OK (21 temp, 9 fan) | OK (33 temp, 8 fan) | 미확인 |
| ThermalSubsystem (신형) | 404 | OK | OK | OK | 미확인 |
| Power (구형) | OK (768W/2400W) | OK (331W) | OK (322W) | OK (PSU만, 소비량 None) | 미확인 |
| PowerSubsystem (신형) | 404 | OK | OK | OK | 미확인 |
| Sensors | OK (1개) | OK (58개) | OK (57개) | OK (92개) | 미확인 |
| Memory | OK (32 DIMM) | OK (8 DIMM) | OK (32 DIMM) | OK (16 DIMM) | 미확인 |
| Processors | OK | OK (6952P, 96c/192t) | OK (6767P, 64c/128t) | OK (파싱 불완전) | 미확인 |
| EthernetInterfaces | OK (3) | OK (3) | OK (3) | OK (5) | 미확인 |

### 참고사항
- 구형 Thermal/Power: 모든 서버 타입에서 동작 → 현재 DCIM 구현 호환
- Ampere: PowerConsumedWatts = None (전력 소비량 미제공), Processor 상세 파싱 불완전
- SPR: Redfish v1.9.0으로 ThermalSubsystem/PowerSubsystem 미지원
- SRF: 서버 부팅 불가로 미확인 (TODO)
