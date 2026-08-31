#!/bin/bash
# Lab-3 더미 Pod 생성/삭제 스크립트 (Air-Gapped Safe)
# 실행: bash check/targetExecCmd/20260623-1.sh [create|delete|status]
# Lab-3 마스터(10.144.131.100)에서 실행

ACTION="${1:-status}"
NS="dcim-test"

find_local_image() {
  # 1) crictl (containerd)
  if command -v crictl &>/dev/null; then
    IMG=$(crictl images 2>/dev/null | grep pause | head -1 | awk '{print $1":"$2}')
    [ -n "$IMG" ] && echo "$IMG" && return
  fi
  # 2) docker
  if command -v docker &>/dev/null; then
    IMG=$(docker images 2>/dev/null | grep pause | head -1 | awk '{print $1":"$2}')
    [ -n "$IMG" ] && echo "$IMG" && return
  fi
  # 3) kube-system 파드에서 추출
  IMG=$(kubectl get pods -n kube-system -o jsonpath='{.items[0].spec.containers[0].image}' 2>/dev/null)
  [ -n "$IMG" ] && echo "$IMG" && return
  echo "registry.k8s.io/pause:3.9"
}

case "$ACTION" in
  create)
    echo "=== 로컬 이미지 탐색 ==="
    IMAGE=$(find_local_image)
    echo "사용 이미지: $IMAGE"
    echo ""
    echo "=== 테스트 Pod 생성 ==="
    kubectl create namespace $NS 2>/dev/null || true
    for i in 1 2 3; do
      kubectl apply -f - <<EOF 2>/dev/null && echo "  test-pod-$i OK" || echo "  test-pod-$i FAIL"
apiVersion: v1
kind: Pod
metadata:
  name: test-pod-$i
  namespace: $NS
spec:
  restartPolicy: Never
  containers:
  - name: pause
    image: $IMAGE
    imagePullPolicy: Never
EOF
    done
    sleep 3
    echo ""
    kubectl get pods -n $NS -o wide 2>/dev/null | head -10
    echo "노드: $(kubectl get pods -n $NS -o jsonpath='{range .items[*]}{.spec.nodeName}{" "}{end}' 2>/dev/null)"
    ;;

  delete)
    echo "=== 삭제 ==="
    kubectl delete namespace $NS --grace-period=5 2>/dev/null && echo "완료" || echo "없음"
    ;;

  status)
    kubectl get pods -n $NS -o wide 2>/dev/null || echo "$NS 없음. bash $0 create"
    ;;

  *)
    echo "bash $0 [create|delete|status]"
    ;;
esac
