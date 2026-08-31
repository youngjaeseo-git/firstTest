#!/bin/bash
# Lab-1 Prometheus node-exporter job에 Lab-3 타겟 추가 (38.100에서 실행)
# ★★★ 이 스크립트는 38.100 (k8s-master)에서 실행하세요 ★★★
#
# 기존 node-exporter job의 static_configs targets에 Lab-3 IP를 추가합니다.

set -e

echo "=== Lab-3 타겟 → 기존 node-exporter job에 추가 ==="

CM_NAME="prometheus-server-conf"
NS="monitoring"

# 1. ConfigMap 확인
echo "-- ConfigMap 확인 --"
if ! kubectl get cm "$CM_NAME" -n "$NS" > /dev/null 2>&1; then
  echo "ConfigMap '$CM_NAME' 없음. 이름 검색:"
  kubectl get cm -n "$NS" | grep -i prom
  echo "CM_NAME 변수를 수정 후 다시 실행하세요."
  exit 1
fi

# 2. 이미 추가됐는지 확인
if kubectl get cm "$CM_NAME" -n "$NS" -o yaml | grep -q '10.144.131.103:9100'; then
  echo "Lab-3 타겟이 이미 등록되어 있습니다."
  exit 0
fi

# 3. 현재 설정 백업
echo "-- 설정 백업 --"
kubectl get cm "$CM_NAME" -n "$NS" -o jsonpath='{.data.prometheus\.yml}' > /tmp/prometheus-backup.yml
cp /tmp/prometheus-backup.yml /tmp/prometheus-new.yml
echo "백업: /tmp/prometheus-backup.yml ($(wc -l < /tmp/prometheus-backup.yml)줄)"

# 4. 기존 node-exporter job의 targets 끝에 Lab-3 IP 삽입
# 기존 마지막 Lab-1 타겟 라인을 찾아서 그 뒤에 Lab-3 타겟 추가
# 패턴: 기존 node-exporter job에서 마지막 '10.144.38.x:9100' 타겟 라인
echo ""
echo "-- 기존 node-exporter targets 확인 --"
grep "9100" /tmp/prometheus-backup.yml | tail -3
echo ""

# 기존 node-exporter의 마지막 38.x:9100 타겟 라인 뒤에 Lab-3 추가
# sed: 마지막으로 나오는 38.*:9100 패턴 라인 뒤에 삽입
LAST_LAB1=$(grep -n '10\.144\.38\.[0-9]*:9100' /tmp/prometheus-backup.yml | tail -1 | cut -d: -f1)

if [ -z "$LAST_LAB1" ]; then
  echo "기존 node-exporter의 38.x:9100 타겟을 찾지 못했습니다."
  echo "현재 설정에서 node-exporter 관련 라인:"
  grep -n -i "node.exporter\|9100" /tmp/prometheus-backup.yml | head -10
  echo ""
  echo "수동으로 추가해야 합니다. 아래 내용을 기존 node-exporter targets에 추가:"
  echo "        - '10.144.131.103:9100'"
  echo "        ... (아래 전체 목록 참조)"
  exit 1
fi

echo "기존 마지막 Lab-1 타겟: 라인 $LAST_LAB1"
echo "이 뒤에 Lab-3 타겟 삽입..."

sed -i "${LAST_LAB1}a\\
        - '10.144.131.100:9100'\\
        - '10.144.131.103:9100'\\
        - '10.144.131.104:9100'\\
        - '10.144.131.105:9100'\\
        - '10.144.131.107:9100'\\
        - '10.144.131.109:9100'\\
        - '10.144.131.111:9100'\\
        - '10.144.131.112:9100'\\
        - '10.144.131.113:9100'\\
        - '10.144.131.114:9100'\\
        - '10.144.131.115:9100'\\
        - '10.144.131.116:9100'\\
        - '10.144.131.117:9100'\\
        - '10.144.131.118:9100'\\
        - '10.144.131.119:9100'\\
        - '10.144.131.120:9100'\\
        - '10.144.131.151:9100'\\
        - '10.144.131.190:9100'" /tmp/prometheus-new.yml

echo "-- 추가 후 확인 --"
grep "131\." /tmp/prometheus-new.yml | head -5
echo "... (총 $(grep -c '131\.' /tmp/prometheus-new.yml)개 Lab-3 타겟)"

# 5. ConfigMap 업데이트
echo ""
echo "-- ConfigMap 적용 --"
kubectl create cm "$CM_NAME" -n "$NS" \
  --from-file=prometheus.yml=/tmp/prometheus-new.yml \
  --dry-run=client -o yaml | kubectl apply -f -

# 6. Prometheus 재시작
echo ""
echo "=== Prometheus Pod 재시작 ==="
kubectl delete pod -n "$NS" -l app=prometheus-server
echo "30초 대기..."
sleep 30

# 7. 검증
echo ""
echo "=== 검증: Lab-3 타겟 상태 ==="
curl -s "http://10.100.175.248:8080/api/v1/targets?state=active" 2>/dev/null \
  | grep -o '"10\.144\.131\.[0-9]*:9100[^}]*health":"[^"]*"' | head -5
echo "(Lab-3 타겟 일부 표시)"

echo ""
echo "=== 완료 ==="
echo "꺼진 서버 4대(101,102,106,108)는 제외. DCIM 대시보드에서 Lab-3 메트릭을 확인하세요."
