#!/bin/bash
# cAdvisor instance 라벨 진단 — 클러스터(lab1/lab3) 매처 수정용 (2026-06-29)
# 목적: cAdvisor 메트릭의 instance/라벨이 IP인지 hostname인지, lab1/lab3를
#       구분할 수 있는 라벨이 있는지 확인 (CLUSTER_CA/CLUSTER_UP 수정 근거)
# 실행: Prometheus(10.100.175.248:8080) 도달 가능한 곳, bash check/targetExecCmd/20260629-cadvisor-labels.sh
PROM="http://10.100.175.248:8080"
echo "=== CA_DIAG ==="

# node 단위 cAdvisor 메트릭(컨테이너 폭증 없이 노드당 1개). 없으면 폴백.
M="machine_cpu_cores"
RAW=$(curl -s --max-time 8 "$PROM/api/v1/query?query=$M" 2>/dev/null)
CNT=$(echo "$RAW" | grep -o '"instance"' | wc -l | tr -d ' ')
if [ "$CNT" = "0" ]; then
  M="container_last_seen"
  RAW=$(curl -s --max-time 8 "$PROM/api/v1/query?query=count+by+(instance)($M)" 2>/dev/null)
  CNT=$(echo "$RAW" | grep -o '"instance"' | wc -l | tr -d ' ')
fi
echo "METRIC=$M  SERIES=$CNT"

# 1) 한 시리즈의 전체 라벨(키+값) — lab 구분 가능한 라벨(node/IP/zone 등) 확인용
echo "FIRST_LABELS=$(echo "$RAW" | grep -oP '"metric":\{[^}]*\}' | head -1 | cut -c1-260)"

# 2) instance 값 샘플 3개 (IP 형식인지 hostname 형식인지)
echo "SAMPLES=$(echo "$RAW" | grep -oP '"instance":"[^"]*"' | sed 's/"instance":"//;s/"$//' | sort -u | head -3 | paste -sd' | ' -)"

# 3) instance가 IP면 대역별 개수
echo "IP_38=$(echo "$RAW" | grep -oP '"instance":"[^"]*"' | grep -c '10\.144\.38')  IP_131=$(echo "$RAW" | grep -oP '"instance":"[^"]*"' | grep -c '10\.144\.131')"

# 4) instance가 hostname이면 토큰 분포 (13ae=lab1추정, 14ae=양쪽혼재, 131=lab3 IP)
echo "H_13ae=$(echo "$RAW" | grep -oP '"instance":"[^"]*"' | grep -c '13ae')  H_14ae=$(echo "$RAW" | grep -oP '"instance":"[^"]*"' | grep -c '14ae')  H_s222=$(echo "$RAW" | grep -oP '"instance":"[^"]*"' | grep -c 's222')"

echo "=== END ==="
# 해석: FIRST_LABELS에 IP나 node 라벨이 있으면 그걸로 lab1/lab3 구분.
#       instance가 hostname뿐이면 hostname→IP 매핑(node_uname_info) 기반 수정 필요.
