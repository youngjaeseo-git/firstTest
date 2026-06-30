#!/bin/bash
# Inlet 온도 센서 확인 - BMC Redfish Thermal 엔드포인트
# 실행: bash check/targetExecCmd/20260622-3.sh

BMC_IP="192.168.10.103"
USER="admin"
PASS="admin"

echo "=== Inlet/Ambient 센서 확인 ==="
curl -sk -u "$USER:$PASS" \
  "https://${BMC_IP}/redfish/v1/Chassis/1/Thermal" 2>/dev/null \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
names=[t['Name'] for t in d.get('Temperatures',[])]
kw=['inlet','ambient','intake','front']
hits=[n for n in names if any(k in n.lower() for k in kw)]
print('Inlet sensors:', len(hits))
for h in hits: print(' ',h)
if not hits:
  print('No inlet sensor found. All sensor names:')
  for n in names[:10]: print(' ',n)
  if len(names)>10: print('  ...and',len(names)-10,'more')
"
