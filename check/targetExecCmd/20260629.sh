#!/bin/bash
# node-exporter 파일시스템 노출 진단 (2026-06-29)
# 목적: node-exporter가 호스트 루트(/)+--path.rootfs로 설정됐는지, 배포/관리 방식 확인
# !! Lab-1 클러스터와 Lab-3 클러스터는 별도다. 각 클러스터 컨텍스트에서 1번씩 실행해서
#    두 출력을 비교해야 한다 (CTX_NOW로 어느 클러스터인지 구분).
# 실행: bash check/targetExecCmd/20260629.sh
# 출력: 약 12줄 (타이핑 최소화)
echo "=== NE_DIAG ==="

# 1) 클러스터 컨텍스트 (Lab-3가 별도 클러스터/컨텍스트면 여기서 드러남)
echo "CTX_NOW=$(kubectl config current-context 2>/dev/null)"
echo "CTX_ALL=$(kubectl config get-contexts -o name 2>/dev/null | paste -sd, -)"

# 2) node-exporter DaemonSet 위치/상태 (전체 네임스페이스)
DSLINE=$(kubectl get ds -A 2>/dev/null | grep -i node-exporter | head -1)
NS=$(echo "$DSLINE" | awk '{print $1}')
NAME=$(echo "$DSLINE" | awk '{print $2}')
echo "DS=$(echo "$DSLINE" | awk '{print $1"/"$2" desired="$3" ready="$4}')"

if [ -n "$NS" ] && [ -n "$NAME" ]; then
  # 3) 관리 주체: Helm/Operator면 DS 직접 패치가 원복됨 → 이게 핵심
  MGR=$(kubectl get ds "$NAME" -n "$NS" -o jsonpath='{.metadata.labels.app\.kubernetes\.io/managed-by}' 2>/dev/null)
  OWNER=$(kubectl get ds "$NAME" -n "$NS" -o jsonpath='{.metadata.ownerReferences[0].kind}' 2>/dev/null)
  echo "MGR=${MGR:-none} OWNER=${OWNER:-none}"

  # 4) 호스트 루트 마운트 여부 (volumes의 hostPath 경로들) — 핵심
  echo "HOSTPATHS=$(kubectl get ds "$NAME" -n "$NS" -o jsonpath='{.spec.template.spec.volumes[*].hostPath.path}' 2>/dev/null)"

  # 5) path.* 인자 여부 (--path.rootfs 있으면 이미 호스트 fs 인식 설정됨)
  echo "PATHARGS=$(kubectl get ds "$NAME" -n "$NS" -o jsonpath='{.spec.template.spec.containers[0].args}' 2>/dev/null | grep -oE 'path\.[a-z]+=[^",]*' | paste -sd' ' -)"

  # 6) 컨테이너 마운트 경로 + 권한 컨텍스트
  echo "VMOUNTS=$(kubectl get ds "$NAME" -n "$NS" -o jsonpath='{range .spec.template.spec.containers[0].volumeMounts[*]}{.mountPath}{";"}{end}' 2>/dev/null)"
  echo "HOSTNET=$(kubectl get ds "$NAME" -n "$NS" -o jsonpath='{.spec.template.spec.hostNetwork}' 2>/dev/null) PID=$(kubectl get ds "$NAME" -n "$NS" -o jsonpath='{.spec.template.spec.hostPID}' 2>/dev/null)"
  echo "IMAGE=$(kubectl get ds "$NAME" -n "$NS" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null)"
fi

# 6b) 롤링 재시작 예산: NotReady 노드 수 (06-15처럼 롤아웃 정체 위험 판단)
echo "NOTREADY=$(kubectl get nodes --no-headers 2>/dev/null | grep -c ' NotReady') / NODES=$(kubectl get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ')"

# 7) Prometheus로 Lab-1(정상) vs Lab-3 마운트 개수 비교
PROM="http://10.100.175.248:8080"
nefs(){ curl -s --max-time 5 "$PROM/api/v1/query?query=node_filesystem_size_bytes%7Binstance%3D~%22$1%22%7D" 2>/dev/null | grep -o '"mountpoint"' | wc -l | tr -d ' '; }
echo "L1_38.103_mounts=$(nefs '10.144.38.103.*')"
echo "L3_131_mounts=$(nefs '10.144.131..*')"

# 8) Lab-1 정상 서버가 어떤 mountpoint를 노출하는지 (배포 방식 추정 단서)
echo "L1_sample=$(curl -s --max-time 5 "$PROM/api/v1/query?query=node_filesystem_size_bytes%7Binstance%3D~%2210.144.38.103.*%22%7D" 2>/dev/null | grep -oP '"mountpoint"\s*:\s*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/' | head -8 | paste -sd, -)"

echo "=== END ==="
