#!/bin/bash
# Lab-3 더미 Pod 생성/삭제 스크립트
# 실행: bash check/targetExecCmd/20260623-1.sh [create|delete|status]
# Lab-3 마스터(10.144.131.100)에서 실행하거나 kubeconfig가 설정된 곳에서 실행

ACTION="${1:-status}"
NS="dcim-test"

case "$ACTION" in
  create)
    echo "=== 테스트 네임스페이스+Pod 생성 ==="
    kubectl create namespace $NS 2>/dev/null
    for i in 1 2 3; do
      kubectl run test-pod-$i -n $NS --image=busybox --restart=Never \
        --command -- sleep 3600 2>/dev/null && echo "  test-pod-$i 생성" || echo "  test-pod-$i 이미 존재"
    done
    sleep 3
    echo ""
    echo "=== 결과 ==="
    kubectl get pods -n $NS -o wide 2>/dev/null | head -10
    echo ""
    echo "노드 수: $(kubectl get pods -n $NS -o jsonpath='{range .items[*]}{.spec.nodeName}{"\n"}{end}' 2>/dev/null | sort -u | wc -l)"
    ;;

  delete)
    echo "=== 테스트 리소스 삭제 ==="
    kubectl delete namespace $NS --grace-period=5 2>/dev/null && echo "삭제 완료" || echo "네임스페이스 없음"
    ;;

  status)
    echo "=== 현재 상태 ==="
    kubectl get pods -n $NS -o wide 2>/dev/null | head -10
    if [ $? -ne 0 ]; then
      echo "네임스페이스 $NS 없음. 생성하려면: bash $0 create"
    fi
    ;;

  *)
    echo "사용법: bash $0 [create|delete|status]"
    ;;
esac
