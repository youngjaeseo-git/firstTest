#!/bin/bash
# 대시보드 파일시스템 경고: 70% 초과 서버가 진짜 줄었는지 / 중복이었는지 / job필터가 숨긴건지
# Prometheus 직접 조회(앱 코드 무관). 실행: Prometheus 도달 가능한 곳(Lab-1/앱서버)
PROM="http://10.100.175.248:8080"
Q='(1 - node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs|devtmpfs|overlay"} / node_filesystem_size_bytes{mountpoint="/",fstype!~"tmpfs|devtmpfs|overlay"}) * 100 > 70'
QJ='(1 - node_filesystem_avail_bytes{job="node-exporter",mountpoint="/",fstype!~"tmpfs|devtmpfs|overlay"} / node_filesystem_size_bytes{job="node-exporter",mountpoint="/",fstype!~"tmpfs|devtmpfs|overlay"}) * 100 > 70'

parse() {
  grep -oE '"metric":\{[^}]*\},"value":\[[^]]*\]' | while read -r s; do
    inst=$(echo "$s" | grep -oE '"instance":"[^"]*"' | head -1 | cut -d'"' -f4)
    job=$(echo  "$s" | grep -oE '"job":"[^"]*"' | head -1 | cut -d'"' -f4)
    val=$(echo  "$s" | grep -oE ',"[0-9.]+"\]$' | tr -dc '0-9.')
    printf '  %s | job=%s | %.0f%%\n' "$inst" "$job" "${val:-0}"
  done
}

echo "=== FSWARN_CHECK ==="
echo "-- [A] job 필터 없음 (어제 옛 코드가 보던 것) --"
RA=$(curl -s -G "$PROM/api/v1/query" --data-urlencode "query=$Q" 2>/dev/null)
echo "$RA" | parse
echo "  건수=$(echo "$RA" | grep -oE '"instance":"[^"]*"' | wc -l | tr -d ' ')  고유서버(IP/host)=$(echo "$RA" | grep -oE '"instance":"[^"]*"' | sed 's/:.*//' | sort -u | wc -l | tr -d ' ')"

echo "-- [B] job=\"node-exporter\" (어제 수정한 새 코드가 보는 것) --"
RB=$(curl -s -G "$PROM/api/v1/query" --data-urlencode "query=$QJ" 2>/dev/null)
echo "$RB" | parse
echo "  건수=$(echo "$RB" | grep -oE '"instance":"[^"]*"' | wc -l | tr -d ' ')"

echo "=== END ==="
# 해석:
#  [A]건수=3,[A]고유서버=1 → 어제 3개는 같은 서버 중복. 새 코드(dedup)가 1로 정리한 것(데이터 정상).
#  [A]고유서버=3, [B]건수=1 → job필터가 실서버 2대를 숨김(그 2대는 node-exporter로 fs 미수집). 데이터는 있음.
#  [A]건수=1 → 실제로 2대가 70% 밑으로 내려감(용량 정리됨).
