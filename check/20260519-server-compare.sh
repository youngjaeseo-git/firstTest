#!/bin/bash
# 기준 서버(s121x13ae013) vs 전체 서버 데이터 비교
# 각 서버의 데이터 소스(NE, cAdvisor, PCM) 가용성 한눈에 확인
# 실행: bash check/20260519-server-compare.sh

PROM=http://10.100.175.248:8080

echo "=== 기준 서버: s121x13ae013 (10.144.38.113) ==="
echo ""

echo "=== 전체 node-exporter 서버 상태 ==="
curl -s "$PROM/api/v1/query" --data-urlencode 'query=up{job="node-exporter"}' | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
ups = []
downs = []
for item in r:
    ip = item['metric'].get('instance','').split(':')[0]
    val = item['value'][1]
    if val == '1': ups.append(ip)
    else: downs.append(ip)
print(f'UP({len(ups)}): {\" \".join(sorted(ups))}')
print(f'DOWN({len(downs)}): {\" \".join(sorted(downs))}')
" 2>/dev/null

echo ""
echo "=== 서버별 데이터 소스 비교 (UP 서버만) ==="
echo "IP | hostname | NE | cAdvisor | PCM_job | cores | mem | heatmap"
echo "---"

curl -s "$PROM/api/v1/query" --data-urlencode 'query=up{job="node-exporter"} == 1' | python3 -c "
import sys, json, urllib.request, urllib.parse

prom = 'http://10.100.175.248:8080'

def pq(query):
    url = f'{prom}/api/v1/query'
    data = urllib.parse.urlencode({'query': query}).encode()
    req = urllib.request.Request(url, data=data)
    resp = urllib.request.urlopen(req, timeout=5)
    d = json.loads(resp.read())
    return d.get('data',{}).get('result',[])

d = json.loads(sys.stdin.read())
r = d.get('data',{}).get('result',[])
ips = sorted(set(item['metric'].get('instance','').split(':')[0] for item in r))

for ip in ips:
    ne = f'instance=~\"{ip}(:.*)?\"'
    ne_job = f'{ne},job=\"node-exporter\"'

    # hostname
    hr = pq(f'node_uname_info{{{ne_job}}}')
    host = hr[0]['metric'].get('nodename','?') if hr else '?'

    # cAdvisor UP
    ca_r = pq(f'up{{instance=~\"{host}(:.*)?\",job=\"kubernetes-cadvisor\"}}')
    ca = 'Y' if ca_r and ca_r[0]['value'][1] == '1' else 'N'

    # PCM job
    pcm_r = pq(f'up{{instance=~\"{host}(:.*)?\",job!~\"kubernetes.*|node-exporter|kube.*\"}}')
    pcm_jobs = [item['metric'].get('job','') for item in pcm_r if item['value'][1] == '1']
    pcm = ','.join(pcm_jobs) if pcm_jobs else 'N'

    # core count
    cr = pq(f'count(node_cpu_seconds_total{{mode=\"idle\",{ne_job}}})')
    cores = cr[0]['value'][1] if cr else '?'

    # mem total
    mr = pq(f'node_memory_MemTotal_bytes{{{ne_job}}}')
    if mr:
        mem_gb = f'{float(mr[0][\"value\"][1]) / (1024**3):.0f}G'
    else:
        mem_gb = '?'

    # heatmap (per-core data exists?)
    hm = pq(f'count(sum by(cpu)(rate(node_cpu_seconds_total{{mode!=\"idle\",{ne_job}}}[5m])))')
    heatmap = 'Y' if hm and int(float(hm[0]['value'][1])) > 1 else 'N'

    ref = ' <-- REF' if ip == '10.144.38.113' else ''
    print(f'{ip} | {host} | Y | {ca} | {pcm} | {cores} | {mem_gb} | {heatmap}{ref}')
" 2>/dev/null
