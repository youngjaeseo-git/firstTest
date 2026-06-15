#!/bin/bash
# Lab-3 node-exporter 스크래핑 최종 확인 (38.100에서 실행) - 읽기전용

PROM="http://10.100.175.248:8080"

echo "=== Lab-3 node-exporter 수집 현황 ==="

echo ""
echo "-- Lab-3 타겟 수 (up 쿼리) --"
RESULT=$(curl -s "$PROM/api/v1/query?query=up%7Bjob%3D%22node-exporter%22%2Cinstance%3D~%2210.144.131.*%22%7D" 2>/dev/null)
TOTAL=$(echo "$RESULT" | grep -c '"instance"')
UP=$(echo "$RESULT" | grep -c '"1"')
echo "Lab-3 node-exporter: UP=$UP / TOTAL=$TOTAL"

echo ""
echo "-- Lab-3 타겟 상세 (IP + 상태) --"
echo "$RESULT" | grep -o '"instance":"[^"]*"[^}]*"value":\[[^]]*\]' | sed 's/.*"instance":"\([^"]*\)".*\[\([^,]*\),"\([^"]*\)"\].*/\1 → up=\3/' | head -20

echo ""
echo "-- Lab-1 기존 타겟 수 (비교용) --"
LAB1=$(curl -s "$PROM/api/v1/query?query=up%7Bjob%3D%22node-exporter%22%2Cinstance%3D~%2210.144.38.*%22%7D" 2>/dev/null | grep -c '"instance"')
echo "Lab-1 node-exporter: $LAB1 개"
