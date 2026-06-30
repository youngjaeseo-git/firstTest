#!/bin/bash
# 대시보드 fleet 메트릭 수치 검증
# 실행: bash check/20260519-dashboard-verify.sh
# 화면에 표시된 값과 비교하여 정확성 확인

PROM=http://10.100.175.248:8080

echo "=== 대시보드 Fleet 메트릭 (Prometheus 직접 조회) ==="
echo ""

echo "1. CPU (%):"
curl -s "$PROM/api/v1/query" --data-urlencode 'query=(1 - avg(rate(node_cpu_seconds_total{mode="idle",job="node-exporter"}[5m]))) * 100' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
print('  node-exporter: ' + (r[0]['value'][1] if r else 'NO_DATA'))
"

echo "2. Memory (%):"
curl -s "$PROM/api/v1/query" --data-urlencode 'query=(1 - sum(node_memory_MemAvailable_bytes{job="node-exporter"}) / sum(node_memory_MemTotal_bytes{job="node-exporter"})) * 100' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
print('  node-exporter: ' + (r[0]['value'][1] if r else 'NO_DATA'))
"

echo "3. Network RX (bytes/s):"
curl -s "$PROM/api/v1/query" --data-urlencode 'query=sum(rate(node_network_receive_bytes_total{job="node-exporter",device!~"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*|tun.*|virbr.*"}[5m]))' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
val = float(r[0]['value'][1]) if r else 0
units = ['B/s','KB/s','MB/s','GB/s']
i = 0
while val >= 1024 and i < 3:
    val /= 1024; i += 1
print(f'  {val:.1f} {units[i]}')
"

echo "4. Network TX (bytes/s):"
curl -s "$PROM/api/v1/query" --data-urlencode 'query=sum(rate(node_network_transmit_bytes_total{job="node-exporter",device!~"lo|veth.*|cni.*|docker.*|br-.*|flannel.*|cali.*|tun.*|virbr.*"}[5m]))' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
val = float(r[0]['value'][1]) if r else 0
units = ['B/s','KB/s','MB/s','GB/s']
i = 0
while val >= 1024 and i < 3:
    val /= 1024; i += 1
print(f'  {val:.1f} {units[i]}')
"

echo "5. Power (Watts):"
curl -s "$PROM/api/v1/query" --data-urlencode 'query=sum(rate(Package_Joules_Consumed[5m]))' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
val = float(r[0]['value'][1]) if r else 0
print(f'  {val:.0f} W' if val < 1000 else f'  {val/1000:.1f} kW')
"

echo "6. Uptime (avg seconds):"
curl -s "$PROM/api/v1/query" --data-urlencode 'query=avg(time() - node_boot_time_seconds{job="node-exporter"})' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
if r:
    secs = float(r[0]['value'][1])
    days = secs / 86400
    print(f'  {days:.1f} days ({secs:.0f}s)')
else:
    print('  NO_DATA')
"

echo "7. Nodes UP/DOWN:"
curl -s "$PROM/api/v1/query" --data-urlencode 'query=up{job!~"kube-state-metrics|kubernetes-apiservers|kubernetes-cadvisor|kubernetes-service-endpoints"}' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
up = sum(1 for x in r if x['value'][1] == '1')
down = sum(1 for x in r if x['value'][1] == '0')
print(f'  up={up} down={down} total={up+down}')
"

echo "8. Top 5 CPU:"
curl -s "$PROM/api/v1/query" --data-urlencode 'query=topk(5, (1 - avg by(instance)(rate(node_cpu_seconds_total{mode="idle",job="node-exporter"}[5m]))) * 100)' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
if not r:
    print('  NO_DATA')
for item in r:
    inst = item['metric'].get('instance','?')
    val = float(item['value'][1])
    print(f'  {inst}: {val:.1f}%')
"
