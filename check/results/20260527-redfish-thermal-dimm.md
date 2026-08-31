# 2026-05-27 Redfish Thermal DIMM 센서 확인

## 출처: check/targetExecCmd/20260527.sh 항목 6 실행 결과

### 대상: BMC 192.168.10.103

### 결과
- Total temperature sensors: 24
- DIMM/Memory sensors: 4

### DIMM 센서 이름 패턴
| Name | ReadingCelsius |
|------|---------------|
| P1_DIMMA~D Temp | 30 |
| P1_DIMME~H Temp | 29 |
| P2_DIMMA~D Temp | 32 |
| P2_DIMME~H Temp | 29 |

### 분석
- 소켓별(P1/P2) × 채널그룹별(A~D, E~H) = 4개 그룹 센서
- 이름에 "DIMM" 키워드 포함 → 필터 조건: `Name`에 "DIMM" 포함
- Supermicro 서버 기준 (다른 벤더도 DIMM 키워드 사용 가능성 높음)
- 평균 온도: ~30°C
