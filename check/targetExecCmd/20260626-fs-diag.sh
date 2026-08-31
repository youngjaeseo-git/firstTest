#!/bin/bash
# 파일시스템 현황 진단 — 전체 서버별 node_filesystem 데이터 유무 확인
# 실행: bash check/targetExecCmd/20260626-fs-diag.sh
# 출력: 서버당 1줄 (hostname IP FS건수 마운트샘플)
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || exit 1

PROM="http://10.100.175.248:8080"

echo "=== FS_DIAG ==="

# 1) DB에서 서버 목록 (hostname, ipAddress, prometheusInstance)
DC=$(docker compose ps -q db 2>/dev/null)
if [ -n "$DC" ]; then
  P="docker exec $DC psql -U dcim -d dcim -t -A"
elif command -v psql &>/dev/null; then
  P="psql -U dcim -d dcim -t -A"
else
  echo "ERR:DB접근불가"
  exit 1
fi

# hostname|ipAddress|prometheusInstance 형식으로 추출
SERVERS=$($P -c "SELECT hostname || '|' || COALESCE(\"ipAddress\",'') || '|' || COALESCE(\"prometheusInstance\",'') FROM \"Equipment\" WHERE type='SERVER' ORDER BY hostname;" 2>/dev/null)

if [ -z "$SERVERS" ]; then
  echo "ERR:서버없음"
  exit 1
fi

echo "TOT=$(echo "$SERVERS" | wc -l | tr -d ' ')"

# 2) 서버별 node_filesystem_size_bytes 데이터 확인
echo ""
echo "HOST|IP|NE_FS|CA_FS|MOUNTS"
while IFS='|' read -r HN IP PINST; do
  [ -z "$HN" ] && continue

  # node-exporter 쿼리 (IP 기반)
  NE_CNT=0
  NE_MOUNTS="-"
  if [ -n "$IP" ]; then
    NE_RAW=$(curl -s --max-time 5 "$PROM/api/v1/query?query=node_filesystem_size_bytes%7Binstance%3D~%22${IP}(:.*)%3F%22%2Cjob%3D%22node-exporter%22%2Cfstype!~%22tmpfs%7Cdevtmpfs%7Coverlay%7Csquashfs%22%7D" 2>/dev/null)
    NE_CNT=$(echo "$NE_RAW" | grep -o '"mountpoint"' | wc -l | tr -d ' ')
    if [ "$NE_CNT" -gt 0 ]; then
      NE_MOUNTS=$(echo "$NE_RAW" | grep -oP '"mountpoint"\s*:\s*"[^"]*"' | head -3 | sed 's/"mountpoint"\s*:\s*"//;s/"//' | paste -sd, -)
    fi
  fi

  # cAdvisor 쿼리 (hostname 기반)
  CA_CNT=0
  CA_RAW=$(curl -s --max-time 5 "$PROM/api/v1/query?query=container_fs_limit_bytes%7Binstance%3D~%22${HN}(:.*)%3F%22%7D" 2>/dev/null)
  CA_CNT=$(echo "$CA_RAW" | grep -o '"__name__"' | wc -l | tr -d ' ')

  echo "${HN}|${IP}|${NE_CNT}|${CA_CNT}|${NE_MOUNTS}"
done <<< "$SERVERS"

# 3) 샘플 1개: s222hx14ae010의 cAdvisor fs 라벨 구조 확인
echo ""
echo "=== SAMPLE:s222hx14ae010 CA_FS ==="
SAMPLE=$(curl -s --max-time 5 "$PROM/api/v1/query?query=container_fs_limit_bytes%7Binstance%3D~%22s222hx14ae010(:.*)%3F%22%7D" 2>/dev/null)
S_CNT=$(echo "$SAMPLE" | grep -o '"__name__"' | wc -l | tr -d ' ')
echo "CNT=$S_CNT"
if [ "$S_CNT" -gt 0 ]; then
  # 라벨 키만 추출 (첫 1개 시리즈)
  echo "KEYS=$(echo "$SAMPLE" | grep -oP '"[a-z_]+"(?=\s*:)' | sort -u | head -15 | tr '\n' ',' | sed 's/,$//')"
  # device/mountpoint 값 샘플 (있으면)
  echo "DEV=$(echo "$SAMPLE" | grep -oP '"device"\s*:\s*"[^"]*"' | head -2 | sed 's/"device"\s*:\s*"//;s/"//' | paste -sd, -)"
  echo "MNT=$(echo "$SAMPLE" | grep -oP '"mountpoint"\s*:\s*"[^"]*"' | head -2 | sed 's/"mountpoint"\s*:\s*"//;s/"//' | paste -sd, -)"
fi

# 4) 비교: s121x13ae003 node-exporter fs 라벨 구조 (정상 동작 서버)
echo ""
echo "=== SAMPLE:s121x13ae003 NE_FS ==="
REF=$(curl -s --max-time 5 "$PROM/api/v1/query?query=node_filesystem_size_bytes%7Binstance%3D~%2210.144.38.103(:.*)%3F%22%2Cjob%3D%22node-exporter%22%2Cfstype!~%22tmpfs%7Cdevtmpfs%7Coverlay%7Csquashfs%22%7D" 2>/dev/null)
R_CNT=$(echo "$REF" | grep -o '"mountpoint"' | wc -l | tr -d ' ')
echo "CNT=$R_CNT"
if [ "$R_CNT" -gt 0 ]; then
  echo "MNT=$(echo "$REF" | grep -oP '"mountpoint"\s*:\s*"[^"]*"' | sed 's/"mountpoint"\s*:\s*"//;s/"//' | paste -sd, -)"
  echo "DEV=$(echo "$REF" | grep -oP '"device"\s*:\s*"[^"]*"' | sed 's/"device"\s*:\s*"//;s/"//' | paste -sd, -)"
  echo "FST=$(echo "$REF" | grep -oP '"fstype"\s*:\s*"[^"]*"' | sed 's/"fstype"\s*:\s*"//;s/"//' | paste -sd, -)"
fi

echo ""
echo "=== END ==="
