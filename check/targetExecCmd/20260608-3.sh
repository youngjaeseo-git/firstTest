#!/bin/bash
# 소스 파일 무결성 확인

echo "=== 핵심 파일 줄수/크기 ==="
for f in \
  src/lib/prometheus.ts \
  src/lib/prometheus-queries.ts \
  src/app/api/metrics/range/route.ts \
  src/app/api/metrics/instant/route.ts \
  src/components/metrics/metric-chart.tsx \
  src/components/metrics/server-detail-client.tsx \
  src/middleware.ts; do
  if [ -f "$f" ]; then
    L=$(wc -l < "$f")
    S=$(wc -c < "$f")
    echo "$L lines ${S}B  $f"
  else
    echo "MISSING  $f"
  fi
done

echo ""
echo "=== prometheus.ts 핵심 내용 ==="
grep -n "10.100.175.248" src/lib/prometheus.ts 2>/dev/null | head -2
grep -n "FETCH_TIMEOUT" src/lib/prometheus.ts 2>/dev/null | head -1
grep -n "rangeQuery" src/lib/prometheus.ts 2>/dev/null | head -2

echo ""
echo "=== range/route.ts 핵심 ==="
grep -n "502" src/app/api/metrics/range/route.ts 2>/dev/null | head -1
grep -n "rangeQuery" src/app/api/metrics/range/route.ts 2>/dev/null | head -1

echo ""
echo "=== middleware.ts 전체 ==="
cat src/middleware.ts 2>/dev/null

echo ""
echo "=== health API 존재 여부 ==="
ls -la src/app/api/metrics/health/route.ts 2>/dev/null || echo "MISSING"
