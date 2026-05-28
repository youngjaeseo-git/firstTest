#!/bin/bash
# s121x13ae030 온도 미표시 디버깅
PROM="http://10.144.38.100:30003"

echo "=== 1. node_uname_info에서 s121x13ae030 검색 ==="
curl -s "$PROM/api/v1/query?query=node_uname_info" | python3 -c "
import sys,json
data=json.load(sys.stdin)
for r in data.get('data',{}).get('result',[]):
    m=r['metric']
    nn=m.get('nodename','')
    if '030' in nn or '030' in m.get('instance',''):
        print(f\"instance={m.get('instance','')} nodename={nn}\")
" 2>/dev/null || echo "(python3 not available)"

echo ""
echo "=== 2. node_hwmon_temp_celsius에서 030 서버 검색 ==="
curl -s "$PROM/api/v1/query?query=node_hwmon_temp_celsius" | python3 -c "
import sys,json
data=json.load(sys.stdin)
results=data.get('data',{}).get('result',[])
found=set()
for r in results:
    inst=r['metric'].get('instance','')
    found.add(inst)
print(f'Total instances with hwmon temp: {len(found)}')
for inst in sorted(found):
    print(f'  {inst}')
" 2>/dev/null || echo "(python3 not available)"

echo ""
echo "=== 3. kube_pod_info에서 cmx-acc-vrt 파드의 node 값 ==="
curl -s "$PROM/api/v1/query?query=kube_pod_info%7Bnamespace%3D%22cmx-acc-vrt%22%7D" | python3 -c "
import sys,json
data=json.load(sys.stdin)
for r in data.get('data',{}).get('result',[]):
    m=r['metric']
    print(f\"pod={m.get('pod','')} node={m.get('node','')} host_ip={m.get('host_ip','')}\")
" 2>/dev/null | head -5

echo ""
echo "=== 4. DB Equipment 테이블에서 030 서버 확인 ==="
docker exec firsttest-db-1 psql -U dcim -d dcim -t -c \
  "SELECT hostname, \"ipAddress\" FROM \"Equipment\" WHERE hostname LIKE '%030%';"
