#!/bin/bash
# Lab-3 node-exporter 전체 Pod 교체 (131.100에서 실행)
# 살아있는 노드의 구버전 Pod(IP가 172.x)를 1개씩 삭제 → hostNetwork:true로 재생성

echo "=== node-exporter 전체 Pod 교체 시작 ==="
echo ""

# 현재 node-exporter Pod 목록 (NotReady 노드 제외)
NOTREADY=$(kubectl get nodes --no-headers | awk '$2!="Ready"{print $1}')

kubectl get pods -n monitoring -o wide --no-headers | grep node-exporter | while read -r line; do
  POD=$(echo "$line" | awk '{print $1}')
  STATUS=$(echo "$line" | awk '{print $3}')
  POD_IP=$(echo "$line" | awk '{print $6}')
  NODE=$(echo "$line" | awk '{print $7}')

  # NotReady 노드 스킵
  SKIP=false
  for NR in $NOTREADY; do
    [ "$NODE" = "$NR" ] && SKIP=true
  done
  if [ "$SKIP" = "true" ]; then
    echo "SKIP: $POD (노드 $NODE NotReady)"
    continue
  fi

  # 이미 hostNetwork 적용된 Pod 스킵 (IP가 10.x)
  if echo "$POD_IP" | grep -q "^10\."; then
    echo "OK: $POD (IP=$POD_IP, 이미 적용됨)"
    continue
  fi

  echo -n "교체: $POD (노드=$NODE, 구IP=$POD_IP) ... "
  kubectl delete pod "$POD" -n monitoring --wait=false > /dev/null 2>&1
  sleep 15

  # 새 Pod 확인
  NEW_IP=$(kubectl get pods -n monitoring -o wide --no-headers | grep node-exporter | grep "$NODE" | awk '{print $6}')
  if echo "$NEW_IP" | grep -q "^10\."; then
    echo "OK (새IP=$NEW_IP)"
  else
    echo "대기중 (IP=$NEW_IP), 10초 추가 대기..."
    sleep 10
    NEW_IP=$(kubectl get pods -n monitoring -o wide --no-headers | grep node-exporter | grep "$NODE" | awk '{print $6}')
    echo "  → IP=$NEW_IP"
  fi
done

echo ""
echo "=== 교체 완료. 9100 접근 테스트 ==="
for IP in 103 104 105 107 109 111 112 113 114 115 116 117 118 119 120 190; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://10.144.131.${IP}:9100/metrics" 2>/dev/null)
  echo "131.${IP}:9100 → $CODE"
done
