#!/bin/bash
# 38.100 → 131.100 네트워크 진단 (38.100에서 실행)

echo "=== 131.100 포트 접근 확인 ==="
curl -s -o /dev/null -w "8443(프록시): HTTP %{http_code}" --connect-timeout 5 http://10.144.131.100:8443/ 2>/dev/null; echo ""
nc -z -w3 10.144.131.100 22 && echo "22(SSH): OK" || echo "22(SSH): FAIL"
nc -z -w3 10.144.131.100 9100 && echo "9100(node-exporter): OK" || echo "9100(node-exporter): FAIL"
