#!/bin/bash
# Lab-3 node-exporter 패치 적용 상태 정밀 점검 (2026-06-29)
# 실행: Lab-3 마스터, bash check/targetExecCmd/20260629-inspect.sh
# 목적: DS spec과 "실제 실행 중인 워커 Pod"의 args/마운트/노출 마운트포인트 확인
NS=monitoring; NAME=node-exporter
echo "=== NE_INSPECT ==="
echo "DESIRED=$(kubectl get ds $NAME -n $NS -o jsonpath='{.status.desiredNumberScheduled}') READY=$(kubectl get ds $NAME -n $NS -o jsonpath='{.status.numberReady}') UPD=$(kubectl get ds $NAME -n $NS -o jsonpath='{.status.updatedNumberScheduled}')"

# 1) DS spec 실제 값 (패치가 들어갔는지)
echo "DS_ARGS=$(kubectl get ds $NAME -n $NS -o jsonpath='{.spec.template.spec.containers[0].args}')"
echo "DS_VOLS=$(kubectl get ds $NAME -n $NS -o jsonpath='{range .spec.template.spec.volumes[*]}{.name}={.hostPath.path}{" "}{end}')"
echo "DS_VMNT=$(kubectl get ds $NAME -n $NS -o jsonpath='{range .spec.template.spec.containers[0].volumeMounts[*]}{.name}@{.mountPath}{" "}{end}')"

# 2) 실행 중인 워커 Pod 1개 선택 (라벨 k8s-app 우선, 없으면 이름매칭)
POD=$(kubectl get pod -n $NS -l k8s-app=node-exporter --field-selector status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -z "$POD" ] && POD=$(kubectl get pod -n $NS -l app=node-exporter --field-selector status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -z "$POD" ] && POD=$(kubectl get pod -n $NS -o name 2>/dev/null | grep node-exporter | head -1 | sed 's|pod/||')
echo "POD=$POD"

if [ -n "$POD" ]; then
  # 3) 실제 실행 중인 Pod의 args (DS와 다르면 롤아웃 안 된 것)
  echo "POD_ARGS=$(kubectl get pod $POD -n $NS -o jsonpath='{.spec.containers[0].args}')"
  # 4) /host 가 실제로 호스트 루트로 마운트됐는지 (디렉토리 목록)
  echo "POD_HOST_LS=$(kubectl exec $POD -n $NS -- ls /host 2>/dev/null | tr '\n' ',' | head -c 200)"
  # 5) 그 노드에서 노출되는 마운트포인트 (/, /home 등 나오면 성공)
  NODEIP=$(kubectl get pod $POD -n $NS -o jsonpath='{.status.hostIP}')
  echo "NODEIP=$NODEIP"
  echo "MNTS=$(curl -s --max-time 5 http://$NODEIP:9100/metrics 2>/dev/null | grep '^node_filesystem_size_bytes' | grep -oE 'mountpoint=\"[^\"]*\"' | sort -u | tr '\n' ' ')"
fi
echo "=== END ==="
