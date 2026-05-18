#!/bin/bash
# Prometheus config 전수 조사: 모든 job의 타겟 형식(IP vs hostname) 파악
# 실행: bash check/20260519-prometheus-config-audit.sh

PROM=http://10.100.175.248:8080

echo "=== 1. 전체 job별 타겟 형식 분류 (IP:port vs hostname) ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys, json, re
d = json.loads(sys.stdin.read())
targets = d.get('data',{}).get('activeTargets',[])

jobs = {}
for t in targets:
    job = t['labels'].get('job','?')
    inst = t['labels'].get('instance','?')
    health = t['health']
    if job not in jobs:
        jobs[job] = {'ip':[], 'hostname':[], 'up':0, 'down':0}
    is_ip = bool(re.match(r'^\d+\.\d+\.\d+\.\d+', inst))
    if is_ip:
        jobs[job]['ip'].append(inst)
    else:
        jobs[job]['hostname'].append(inst)
    if health == 'up':
        jobs[job]['up'] += 1
    else:
        jobs[job]['down'] += 1

for job in sorted(jobs.keys()):
    j = jobs[job]
    ip_cnt = len(j['ip'])
    hn_cnt = len(j['hostname'])
    fmt = 'IP' if ip_cnt > 0 and hn_cnt == 0 else 'HOSTNAME' if hn_cnt > 0 and ip_cnt == 0 else 'MIXED'
    print(f'  {job}: {fmt} (ip={ip_cnt}, hostname={hn_cnt}) up={j[\"up\"]} down={j[\"down\"]}')
    if fmt == 'MIXED':
        print(f'    IP samples: {j[\"ip\"][:2]}')
        print(f'    Hostname samples: {j[\"hostname\"][:2]}')
"

echo ""
echo "=== 2. node-exporter 전체 타겟 목록 ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
targets = [t for t in d['data']['activeTargets'] if t['labels'].get('job')=='node-exporter']
targets.sort(key=lambda t: t['labels'].get('instance',''))
for t in targets:
    inst = t['labels'].get('instance','?')
    health = t['health']
    print(f'  {inst} {health}')
print(f'  TOTAL: {len(targets)}')
"

echo ""
echo "=== 3. kubernetes-cadvisor 타겟 (up만) ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
targets = [t for t in d['data']['activeTargets'] if t['labels'].get('job')=='kubernetes-cadvisor' and t['health']=='up']
targets.sort(key=lambda t: t['labels'].get('instance',''))
for t in targets:
    inst = t['labels'].get('instance','?')
    print(f'  {inst}')
print(f'  TOTAL: {len(targets)}')
"

echo ""
echo "=== 4. node-exporter IP와 cadvisor hostname 매핑 가능 여부 ==="
echo "  (같은 서버인데 instance 형식이 다른 경우 찾기)"
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys, json, re
d = json.loads(sys.stdin.read())
targets = d['data']['activeTargets']

ne_ips = set()
for t in targets:
    if t['labels'].get('job') == 'node-exporter':
        inst = t['labels'].get('instance','')
        ip = inst.split(':')[0]
        ne_ips.add(ip)

ca_hosts = set()
for t in targets:
    if t['labels'].get('job') == 'kubernetes-cadvisor' and t['health'] == 'up':
        inst = t['labels'].get('instance','')
        if not re.match(r'^\d+\.\d+\.\d+\.\d+', inst):
            ca_hosts.add(inst)

print(f'  node-exporter IPs: {len(ne_ips)}')
print(f'  cadvisor hostnames: {len(ca_hosts)}')
print(f'  (매핑하려면 DNS/hosts 조회 또는 node_network_address 메트릭 필요)')
"

echo ""
echo "=== 5. s222hax14ae011 vs s222hax14ae012 상세 비교 ==="
curl -s "$PROM/api/v1/targets" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
for name in ['s222hax14ae011','s222hax14ae012']:
    matches = [t for t in d['data']['activeTargets'] if name in str(t.get('labels',{})) or name in str(t.get('discoveredLabels',{}))]
    print(f'  {name}: {len(matches)} targets')
    for t in matches:
        job = t['labels'].get('job','?')
        inst = t['labels'].get('instance','?')
        health = t['health']
        addr = t.get('discoveredLabels',{}).get('__address__','?')
        print(f'    job={job} instance={inst} __address__={addr} health={health}')
"

echo ""
echo "=== 6. node-exporter에 없는 cadvisor 서버 (누락 후보) ==="
curl -s "$PROM/api/v1/query" --data-urlencode 'query=count by(instance)(up{job="kubernetes-cadvisor"} == 1)' | python3 -c "
import sys, json, re
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
ca_instances = set()
for item in r:
    ca_instances.add(item['metric']['instance'])
print(f'  cadvisor up instances: {len(ca_instances)}')
" 2>/dev/null

curl -s "$PROM/api/v1/query" --data-urlencode 'query=count by(instance)(up{job="node-exporter"} == 1)' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
ne_instances = set()
for item in r:
    ne_instances.add(item['metric']['instance'])
print(f'  node-exporter up instances: {len(ne_instances)}')
"
