#!/bin/bash
# s121x13ae013 (SPR, Supermicro) 서버의 모든 정보를 한번에 수집
# 사용법: bash check/20260429-full-server-info.sh > full-server-result.txt 2>&1

PROM="${PROMETHEUS_URL:-http://10.100.175.248:8080}"
INST="s121x13ae013"

echo "============================================"
echo " 서버 전체 정보 수집: $INST"
echo " (Intel Sapphire Rapids / Supermicro)"
echo "============================================"
echo ""

# ─── A. Prometheus Targets API (스크래핑 설정 정보) ───
echo "=== A. Targets API (scrapeUrl, __address__, 라벨) ==="
curl -s --connect-timeout 5 "$PROM/api/v1/targets" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for t in d.get('data',{}).get('activeTargets',[]):
  inst=t.get('labels',{}).get('instance','')
  if '${INST}' not in inst: continue
  job=t.get('labels',{}).get('job','?')
  health=t.get('health','?')
  scrape=t.get('scrapeUrl','?')
  dl=t.get('discoveredLabels',{})
  addr=dl.get('__address__','?')
  print(f'job={job} health={health}')
  print(f'  scrapeUrl={scrape}')
  print(f'  __address__={addr}')
  # 모든 라벨 출력 (중요한 것만)
  labs=t.get('labels',{})
  skip={'__name__','job','instance'}
  extra=[f'{k}={v}' for k,v in sorted(labs.items()) if k not in skip]
  if extra: print(f'  labels: {\"  \".join(extra)}')
  print()
" 2>/dev/null

# ─── B. 하드웨어 기본 정보 (cAdvisor machine_*) ───
echo "=== B. 하드웨어 (machine_* 메트릭) ==="
for metric in machine_cpu_cores machine_memory_bytes machine_swap_bytes; do
  val=$(curl -s --connect-timeout 5 --get --data-urlencode "query=${metric}{instance=~\"${INST}(:.*)?\"}" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if r: print(r[0].get('value',['',''])[1])
else: print('X')
" 2>/dev/null)
  printf "  %-30s %s\n" "$metric" "$val"
done
echo ""

# ─── C. kube-state-metrics (노드 정보) ───
echo "=== C. kube-state-metrics ==="

echo "  --- kube_node_info 전체 라벨 ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=kube_node_info{node=~\"${INST}.*\"}" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if not r: print('    X empty')
for x in r:
  m=x.get('metric',{})
  for k in sorted(m.keys()):
    v=m[k]
    if k in ('boot_id','machine_id','system_uuid'): v=v[:12]+'...'
    print(f'    {k} = {v}')
" 2>/dev/null
echo ""

echo "  --- kube_node_status_capacity ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=kube_node_status_capacity{node=~\"${INST}.*\"}" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for x in d.get('data',{}).get('result',[]):
  res=x.get('metric',{}).get('resource','?')
  val=x.get('value',['',''])[1]
  print(f'    {res} = {val}')
" 2>/dev/null
echo ""

echo "  --- kube_node_status_addresses ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=kube_node_status_addresses{node=~\"${INST}.*\"}" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if not r: print('    X empty')
for x in r:
  m=x.get('metric',{})
  print(f'    type={m.get(\"type\",\"?\")} address={m.get(\"address\",\"?\")}')
" 2>/dev/null
echo ""

echo "  --- kube_node_status_condition ---"
curl -s --connect-timeout 5 --get --data-urlencode "query=kube_node_status_condition{node=~\"${INST}.*\",status=\"true\"}" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for x in d.get('data',{}).get('result',[]):
  cond=x.get('metric',{}).get('condition','?')
  print(f'    condition={cond}')
" 2>/dev/null
echo ""

# ─── D. cAdvisor 메트릭 존재 확인 ───
echo "=== D. cAdvisor 메트릭 (존재 여부 + 샘플값) ==="
for metric in \
  container_cpu_usage_seconds_total \
  container_cpu_user_seconds_total \
  container_cpu_system_seconds_total \
  container_cpu_cfs_throttled_seconds_total \
  container_memory_working_set_bytes \
  container_memory_cache \
  container_memory_swap \
  container_fs_usage_bytes \
  container_fs_limit_bytes \
  container_fs_reads_bytes_total \
  container_fs_writes_bytes_total \
  container_network_receive_bytes_total \
  container_network_transmit_bytes_total \
  container_file_descriptors \
  container_start_time_seconds; do
  res=$(curl -s --connect-timeout 3 --get --data-urlencode "query=count(${metric}{instance=~\"${INST}(:.*)?\",container!=\"\"})" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if r: print(f'O count={r[0].get(\"value\",[\"\",\"\"])[1]}')
else: print('X')
" 2>/dev/null)
  printf "  %-45s %s\n" "$metric" "$res"
done
echo ""

# ─── E. PCM (Intel 전력) ───
echo "=== E. PCM 전력 메트릭 ==="
for metric in Package_Joules_Consumed DRAM_Joules_Consumed; do
  res=$(curl -s --connect-timeout 3 --get --data-urlencode "query=count(${metric}{instance=~\"${INST}(:.*)?\"})" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if r: print(f'O count={r[0].get(\"value\",[\"\",\"\"])[1]}')
else: print('X')
" 2>/dev/null)
  printf "  %-45s %s\n" "$metric" "$res"
done
echo ""

# ─── F. server-info job (서버 HW 정보) ───
echo "=== F. server-info job 메트릭 ==="
curl -s --connect-timeout 5 --get --data-urlencode "query={job=\"server-info\",instance=~\"${INST}(:.*)?\"}" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',[])
if not r:
  print('  X empty (server-info may be down)')
else:
  names=set()
  for x in r:
    names.add(x.get('metric',{}).get('__name__','?'))
  for n in sorted(names):
    print(f'  metric: {n}')
  # 첫번째 메트릭의 전체 라벨 출력
  if r:
    m=r[0].get('metric',{})
    print(f'  --- sample labels ---')
    for k,v in sorted(m.items()):
      print(f'    {k} = {v}')
" 2>/dev/null
echo ""

# ─── G. 디스크 device 목록 ───
echo "=== G. 디스크 device 목록 ==="
curl -s --connect-timeout 5 --get --data-urlencode "query=count by(device)(container_fs_usage_bytes{instance=~\"${INST}(:.*)?\"})" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d.get('data',{}).get('result',[]):
  dev=r['metric'].get('device','?')
  cnt=r['value'][1]
  print(f'  device={dev} count={cnt}')
" 2>/dev/null
echo ""

# ─── H. 네트워크 인터페이스 목록 ───
echo "=== H. 네트워크 인터페이스 ==="
curl -s --connect-timeout 5 --get --data-urlencode "query=count by(interface)(container_network_receive_bytes_total{instance=~\"${INST}(:.*)?\"})" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d.get('data',{}).get('result',[]):
  iface=r['metric'].get('interface','?')
  cnt=r['value'][1]
  print(f'  interface={iface} count={cnt}')
" 2>/dev/null
echo ""

# ─── I. Pod/Container 목록 ───
echo "=== I. 실행 중인 Pod 목록 ==="
curl -s --connect-timeout 5 --get --data-urlencode "query=count by(namespace, pod)(container_cpu_usage_seconds_total{instance=~\"${INST}(:.*)?\",container!=\"\"})" "$PROM/api/v1/query" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in sorted(d.get('data',{}).get('result',[]), key=lambda x: x['metric'].get('namespace','')):
  ns=r['metric'].get('namespace','?')
  pod=r['metric'].get('pod','?')
  print(f'  {ns}/{pod}')
" 2>/dev/null
echo ""

echo "============================================"
echo " 수집 완료"
echo "============================================"
