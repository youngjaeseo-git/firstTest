#!/bin/bash
# DB 서버 데이터 vs Prometheus 데이터 대조
# 각 서버가 화면에 데이터가 나올 수 있는지 진단
# 실행: bash check/20260519-db-vs-prom.sh

PROM=http://10.100.175.248:8080

echo "=== DB vs Prometheus 대조 ==="
docker exec firsttest-db-1 psql -U dcim -d dcim -t -A -F '|' -c "
SELECT hostname, \"ipAddress\", \"prometheusInstance\" FROM \"Equipment\" WHERE type = 'SERVER' ORDER BY hostname;
" | while IFS='|' read -r HOST IP PROM_INST; do
  # node-exporter UP check
  NE_UP=$(curl -s "$PROM/api/v1/query" --data-urlencode "query=up{instance=~\"${IP}(:.*)?\",job=\"node-exporter\"}" | python3 -c "
import sys,json; d=json.loads(sys.stdin.read()); r=d.get('data',{}).get('result',[]); print(r[0]['value'][1] if r else '-')" 2>/dev/null)

  # cAdvisor UP check (hostname or prometheusInstance)
  LOOKUP="${PROM_INST:-$HOST}"
  CA_UP=$(curl -s "$PROM/api/v1/query" --data-urlencode "query=up{instance=~\"${LOOKUP}(:.*)?\",job=\"kubernetes-cadvisor\"}" | python3 -c "
import sys,json; d=json.loads(sys.stdin.read()); r=d.get('data',{}).get('result',[]); print(r[0]['value'][1] if r else '-')" 2>/dev/null)

  # CPU data check (node-exporter)
  CPU=$(curl -s "$PROM/api/v1/query" --data-urlencode "query=count(node_cpu_seconds_total{mode=\"idle\",instance=~\"${IP}(:.*)?\",job=\"node-exporter\"})" | python3 -c "
import sys,json; d=json.loads(sys.stdin.read()); r=d.get('data',{}).get('result',[]); print(r[0]['value'][1] if r else '-')" 2>/dev/null)

  # PCM check
  PCM=$(curl -s "$PROM/api/v1/query" --data-urlencode "query=up{instance=~\"${LOOKUP}(:.*)?\",job=~\".*PCM.*\"}" | python3 -c "
import sys,json; d=json.loads(sys.stdin.read()); r=d.get('data',{}).get('result',[]);
jobs=[i['metric'].get('job','') for i in r if i['value'][1]=='1']
print(','.join(jobs) if jobs else '-')" 2>/dev/null)

  REF=""
  if [ "$IP" = "10.144.38.113" ]; then REF=" <-- REF"; fi
  echo "${HOST} | ip=${IP} | prom=${PROM_INST} | NE=${NE_UP} | cA=${CA_UP} | cores=${CPU} | PCM=${PCM}${REF}"
done
