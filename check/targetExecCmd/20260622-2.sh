#!/bin/bash
# Lab-3 메트릭 우회경로 검증 (A~E) — 화면 출력 최소화, 한 줄 요약 위주
# 사무실(폐쇄망)에서 1회 실행. 결과를 손으로 타이핑해 전달.
PROM="http://10.100.175.248:8080"   # Lab-1 Prometheus (DCIM이 쿼리하는 곳)
L3PROM="http://10.144.131.190:30003" # Lab-3 Prometheus (비기능 추정)

py() { python3 -c "$1" 2>/dev/null; }

# === A. Lab-1에 Lab-3 node-exporter가 실제로 들어와 있나 (가장 중요) ===
# 기대: Lab-3(131.x:9100) node-exporter UP 개수 + DOWN instance 목록
echo -n "A.up131="
curl -s "$PROM/api/v1/query?query=up{job=\"node-exporter\",instance=~\"10.144.131..*\"}" | \
  py "import sys,json;r=json.load(sys.stdin)['data']['result'];u=[x['metric']['instance'] for x in r if x['value'][1]=='1'];d=[x['metric']['instance'] for x in r if x['value'][1]!='1'];print(f'{len(u)}up/{len(r)}tot DOWN={\",\".join(sorted(d)) or \"none\"}')"

# A2. Lab-3 노드에 실제 메트릭 4종이 다 들어오나 (CPU/Mem/Disk/Net 각 1개씩 instance 수)
echo -n "A.metrics131="
for q in 'node_cpu_seconds_total' 'node_memory_MemTotal_bytes' 'node_filesystem_size_bytes' 'node_network_receive_bytes_total'; do
  n=$(curl -s "$PROM/api/v1/query?query=count(count(${q}{instance=~\"10.144.131..*\"})by(instance))" | py "import sys,json;r=json.load(sys.stdin)['data']['result'];print(r[0]['value'][1] if r else 0)")
  echo -n "${q%%_*}:${n} "
done; echo

# === B/E 전제: Lab-3 Prometheus가 살아있나 + /federate 응답하나 ===
echo -n "B.lab3prom_reach="
curl -s -o /dev/null -w "http=%{http_code} t=%{time_total}s\n" --max-time 5 "$L3PROM/-/healthy" || echo "UNREACH"
echo -n "B.lab3_targets_up="
curl -s --max-time 5 "$L3PROM/api/v1/query?query=count(up==1)" | py "import sys,json;r=json.load(sys.stdin)['data']['result'];print(r[0]['value'][1] if r else 'NO_RESP')" || echo "NO_RESP"
echo -n "B.federate_ok="
curl -s --max-time 5 -o /dev/null -w "http=%{http_code}\n" "$L3PROM/federate?match[]=up" || echo "UNREACH"

# === C 전제: Lab-1 Prometheus가 remote_write receiver를 켜뒀나 ===
# (--web.enable-remote-write-receiver 없으면 404/405)
echo -n "C.lab1_remote_write_recv="
curl -s -o /dev/null -w "http=%{http_code}\n" --max-time 5 -X POST "$PROM/api/v1/write" --data-binary "x"

# === D 전제: 웹앱이 Lab-3 Prometheus URL에 직접 닿나 (동시쿼리 가능성) ===
echo -n "D.app_to_lab3prom="
curl -s -o /dev/null -w "http=%{http_code} t=%{time_total}s\n" --max-time 5 "$L3PROM/api/v1/query?query=up" || echo "UNREACH"

# === PCM 대조군: 이미 수집되는 9200이 살아있는지(경로 열림 재확인) ===
echo -n "REF.pcm131_up="
curl -s "$PROM/api/v1/query?query=count(up{instance=~\"10.144.131..*:9200\"}==1)" | py "import sys,json;r=json.load(sys.stdin)['data']['result'];print(r[0]['value'][1] if r else 0)"
