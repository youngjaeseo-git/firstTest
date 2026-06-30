#!/bin/bash
# Reports metric-chart 모듈 에러 진단

echo "=== 1. metric-chart 파일 존재 확인 ==="
ls -la src/components/metrics/metric-chart.tsx 2>/dev/null && echo "OK" || echo "MISSING"

echo "=== 2. metrics 디렉토리 파일 목록 ==="
ls src/components/metrics/*.tsx 2>/dev/null | while read f; do echo "$(wc -l < "$f") $f"; done

echo "=== 3. .next 캐시 상태 ==="
du -sh .next 2>/dev/null || echo ".next 없음"

echo "=== 4. jspdf/html2canvas 모듈 ==="
ls node_modules/jspdf/package.json node_modules/html2canvas/package.json 2>/dev/null && echo "OK" || echo "MISSING"

echo "=== 5. metric-chart export 확인 ==="
head -1 src/components/metrics/metric-chart.tsx 2>/dev/null
grep -n "export function\|export const\|export default" src/components/metrics/metric-chart.tsx 2>/dev/null | head -3

echo "=== 6. 해결: .next 삭제 후 재시작 ==="
echo "아래 명령 실행 (서버 중지 후):"
echo "  rm -rf .next"
echo "  bash server-start.sh"
