#!/bin/bash
# 기존 Grafana 대시보드에서 사용 중인 PromQL 쿼리 추출
# 용도: 실제 동작하는 쿼리를 확인해서 그대로 따라가기
#
# 사용법: GRAFANA_URL을 실제 Grafana 주소로 변경 후 실행
# bash check/20260423-grafana-queries.sh > grafana-queries-result.txt 2>&1

GRAFANA_URL="${GRAFANA_URL:-http://10.144.38.100:30004}"
# Prometheus는 별도 포트: http://10.144.38.100:30003

echo "=== Grafana 대시보드 쿼리 추출 ==="
echo "Grafana URL: $GRAFANA_URL"
echo ""

# 1) Grafana 접근 가능 여부
echo "--- 1. Grafana 접근 확인 ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$GRAFANA_URL/api/health")
echo "HTTP: $HTTP_CODE"
if [ "$HTTP_CODE" != "200" ]; then
  echo "Grafana 접근 불가. URL을 확인하세요."
  echo "시도: GRAFANA_URL=http://실제주소:포트 bash check/20260423-grafana-queries.sh"
  exit 1
fi
echo ""

# 2) 대시보드 목록 (이름+uid만)
echo "--- 2. 대시보드 목록 ---"
curl -s "$GRAFANA_URL/api/search?type=dash-db" | python3 -c "
import json,sys
data=json.load(sys.stdin)
for d in data[:20]:
    print(f\"uid={d.get('uid','')} title={d.get('title','')}\")
print(f'총 {len(data)}개')
" 2>/dev/null || echo "python3 파싱 실패. jq 시도..."

echo ""

# 3) 첫 번째 대시보드의 PromQL 쿼리만 추출
echo "--- 3. 첫번째 대시보드 쿼리 ---"
FIRST_UID=$(curl -s "$GRAFANA_URL/api/search?type=dash-db&limit=1" | python3 -c "
import json,sys
data=json.load(sys.stdin)
if data: print(data[0].get('uid',''))
" 2>/dev/null)

if [ -n "$FIRST_UID" ]; then
  echo "UID: $FIRST_UID"
  curl -s "$GRAFANA_URL/api/dashboards/uid/$FIRST_UID" | python3 -c "
import json,sys
data=json.load(sys.stdin)
dash=data.get('dashboard',{})
print(f\"Title: {dash.get('title','')}\")
panels=dash.get('panels',[])
for p in panels:
    title=p.get('title','')
    targets=p.get('targets',[])
    for t in targets:
        expr=t.get('expr','')
        if expr:
            print(f'  Panel: {title}')
            print(f'  Query: {expr}')
            print()
" 2>/dev/null
fi

echo ""
echo "=== 완료 ==="
echo "참고: 특정 대시보드 쿼리를 보려면:"
echo "curl -s \$GRAFANA_URL/api/dashboards/uid/<UID> | python3 -c \"...\""
