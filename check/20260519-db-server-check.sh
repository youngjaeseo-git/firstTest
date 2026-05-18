#!/bin/bash
# DB 서버 목록 조회 - hostname, ipAddress, prometheusInstance 매핑 확인
# Docker DB 컨테이너에서 직접 조회
# 실행: bash check/20260519-db-server-check.sh

echo "=== DB 서버 데이터 (instance 매핑 확인) ==="
docker exec firsttest-db-1 psql -U dcim -d dcim -t -A -F '|' -c "
SELECT hostname, \"ipAddress\", \"prometheusInstance\", status
FROM \"Equipment\"
WHERE type = 'SERVER'
ORDER BY hostname;
" | python3 -c "
import sys
lines = [l.strip() for l in sys.stdin if l.strip()]
print(f'Total: {len(lines)}')
print(f'{\"hostname\":<25} {\"ipAddress\":<18} {\"promInstance\":<25} {\"status\":<10}')
print('-' * 80)
missing_ip = 0
for l in lines:
    parts = l.split('|')
    h = parts[0] or '?'
    ip = parts[1] if len(parts) > 1 else ''
    pi = parts[2] if len(parts) > 2 else ''
    st = parts[3] if len(parts) > 3 else ''
    mark = ' <-- REF' if '13ae013' in h or ip == '10.144.38.113' else ''
    if not ip: missing_ip += 1
    print(f'{h:<25} {ip:<18} {pi:<25} {st:<10}{mark}')
print(f'\nipAddress 없는 서버: {missing_ip}개')
"
