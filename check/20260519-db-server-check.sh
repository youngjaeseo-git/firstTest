#!/bin/bash
# DB 서버 목록 조회 - hostname, ipAddress, prometheusInstance 매핑 확인
# 실행: bash check/20260519-db-server-check.sh

APP=http://localhost:3000

echo "=== DB 서버 데이터 (instance 매핑 확인) ==="
RAW=$(curl -s "${APP}/api/equipment?type=SERVER&limit=100")

echo "$RAW" | python3 -c "
import sys, json
raw = sys.stdin.read()
try:
    d = json.loads(raw)
except:
    print('JSON 파싱 실패. 응답 첫 200자:')
    print(raw[:200])
    sys.exit(1)

items = d.get('items', d) if isinstance(d, dict) else d
if not isinstance(items, list):
    print('items가 리스트가 아님:', type(items))
    print(str(d)[:200])
    sys.exit(1)

print(f'Total: {len(items)}')
print(f'{\"hostname\":<25} {\"ipAddress\":<18} {\"promInstance\":<25} {\"status\":<10}')
print('-' * 80)
for s in sorted(items, key=lambda x: x.get('hostname','') or ''):
    h = s.get('hostname','') or '?'
    ip = s.get('ipAddress','') or ''
    pi = s.get('prometheusInstance','') or ''
    st = s.get('status','') or ''
    mark = ' <-- REF' if '13ae013' in h or ip == '10.144.38.113' else ''
    print(f'{h:<25} {ip:<18} {pi:<25} {st:<10}{mark}')
"
