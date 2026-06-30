#!/bin/bash
# 1) 003 vs 013 메트릭 값 비교
# 2) s222hax node-exporter 스크랩 실패 원인
# 실행: bash check/20260519-diagnose.sh

PROM=http://10.100.175.248:8080

q() {
  curl -s "$PROM/api/v1/query" --data-urlencode "query=$1" | python3 -c "
import sys,json; d=json.loads(sys.stdin.read()); r=d.get('data',{}).get('result',[])
print(r[0]['value'][1] if r else '-')" 2>/dev/null
}

echo "=== 1. s121x13ae003 vs s121x13ae013 비교 ==="
echo ""
printf "%-20s %-15s %-15s\n" "metric" "003(.103)" "013(.113)"
printf "%-20s %-15s %-15s\n" "---" "---" "---"
for METRIC in \
  "CPU(%)||(1-avg(rate(node_cpu_seconds_total{mode=\"idle\",instance=~\"IP(:.*)?\",job=\"node-exporter\"}[5m])))*100" \
  "Load1m||node_load1{instance=~\"IP(:.*)?\",job=\"node-exporter\"}" \
  "MemUsage(%)||(1-node_memory_MemAvailable_bytes{instance=~\"IP(:.*)?\",job=\"node-exporter\"}/node_memory_MemTotal_bytes{instance=~\"IP(:.*)?\",job=\"node-exporter\"})*100" \
  "DiskRead(B/s)||sum(rate(node_disk_read_bytes_total{instance=~\"IP(:.*)?\",job=\"node-exporter\"}[5m]))" \
  "NetRX(B/s)||sum(rate(node_network_receive_bytes_total{instance=~\"IP(:.*)?\",job=\"node-exporter\",device!~\"lo|veth.*\"}[5m]))" \
  "TCP||node_netstat_Tcp_CurrEstab{instance=~\"IP(:.*)?\",job=\"node-exporter\"}" \
  "Temp(C)||node_hwmon_temp_celsius{instance=~\"IP(:.*)?\",job=\"node-exporter\"}" \
  "Cores||count(node_cpu_seconds_total{mode=\"idle\",instance=~\"IP(:.*)?\",job=\"node-exporter\"})"
do
  NAME="${METRIC%%||*}"
  QUERY="${METRIC##*||}"
  Q3=$(echo "$QUERY" | sed 's/IP/10.144.38.103/g')
  Q13=$(echo "$QUERY" | sed 's/IP/10.144.38.113/g')
  V3=$(q "$Q3")
  V13=$(q "$Q13")
  printf "%-20s %-15s %-15s\n" "$NAME" "$V3" "$V13"
done

echo ""
echo "=== 2. node-exporter 스크랩 실패 원인 (s222hax) ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
targets = d.get('data',{}).get('activeTargets',[])
for t in targets:
    job = t.get('labels',{}).get('job','')
    inst = t.get('labels',{}).get('instance','')
    if job == 'node-exporter' and ('38.61' in inst or '38.62' in inst):
        print(f'instance: {inst}')
        print(f'  health: {t.get(\"health\",\"?\")}')
        print(f'  scrapeUrl: {t.get(\"scrapeUrl\",\"?\")}')
        print(f'  lastError: {t.get(\"lastError\",\"none\")}')
        print(f'  lastScrape: {t.get(\"lastScrape\",\"?\")}')
        print()
" 2>/dev/null
