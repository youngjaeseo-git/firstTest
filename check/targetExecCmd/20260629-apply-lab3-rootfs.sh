#!/bin/bash
# Lab-3 node-exporter: 호스트 루트 마운트 + --path.rootfs 추가 (파일시스템 현황 노출)
# Lab-1과 동일 설정 복제. 이미지/selector는 건드리지 않음.
# 실행 위치: Lab-3 마스터 (10.144.131.100), Lab-3 kubectl 컨텍스트에서
# 실행: bash check/targetExecCmd/20260629-apply-lab3-rootfs.sh
set -u
NS=monitoring
NAME=node-exporter

echo "=== APPLY_LAB3_ROOTFS ==="

# 0) 안전장치: 잘못된 클러스터에서 실행 방지 (Lab-3 DS는 desired 18 근처)
DES=$(kubectl get ds "$NAME" -n "$NS" -o jsonpath='{.status.desiredNumberScheduled}' 2>/dev/null)
echo "DS_DESIRED=$DES (Lab-3는 18 근처여야 함. Lab-1(46)이면 중단)"
if [ -z "$DES" ]; then echo "ERR: DS 없음/컨텍스트 확인"; exit 1; fi
if [ "$DES" -gt 30 ]; then echo "ERR: Lab-1 클러스터로 보임(desired=$DES). 중단."; exit 1; fi

# 1) 현재 args 보존 + 필요한 path args 추가 (중복 제거)
mapfile -t CUR < <(kubectl get ds "$NAME" -n "$NS" -o jsonpath='{range .spec.template.spec.containers[0].args[*]}{@}{"\n"}{end}' 2>/dev/null)
echo "CUR_ARGS(${#CUR[@]})=${CUR[*]}"
NEED=("--path.rootfs=/host" "--path.procfs=/host/proc" "--path.sysfs=/host/sys")
ARGS=("${CUR[@]}")
for n in "${NEED[@]}"; do
  f=0; for c in "${CUR[@]}"; do [ "$c" = "$n" ] && f=1; done
  [ "$f" -eq 0 ] && ARGS+=("$n")
done
# JSON 배열 생성 (node-exporter args는 단순 문자열 → 따옴표만 감쌈)
JSON_ARGS=$(printf '"%s",' "${ARGS[@]}"); JSON_ARGS="[${JSON_ARGS%,}]"
echo "NEW_ARGS=$JSON_ARGS"

# 2) strategic-merge patch: args(전체교체) + volumeMounts/volumes(name 머지) + maxUnavailable 상향
#    image는 patch에 없음 → 기존 로컬 레지스트리 이미지 유지
PATCH="{\"spec\":{\"updateStrategy\":{\"rollingUpdate\":{\"maxUnavailable\":\"50%\"}},\"template\":{\"spec\":{\"containers\":[{\"name\":\"node-exporter\",\"args\":$JSON_ARGS,\"volumeMounts\":[{\"name\":\"rootfs\",\"mountPath\":\"/host\",\"readOnly\":true,\"mountPropagation\":\"HostToContainer\"}]}],\"volumes\":[{\"name\":\"rootfs\",\"hostPath\":{\"path\":\"/\"}}]}}}}"

echo "-- patch 적용 --"
kubectl patch ds "$NAME" -n "$NS" --type=strategic -p "$PATCH" || { echo "ERR: patch 실패"; exit 1; }

# 3) 롤아웃 (정체 시 120초 후 살아있는 Pod 수동 삭제)
echo "-- rollout (최대 120s 대기) --"
if ! kubectl rollout status ds/"$NAME" -n "$NS" --timeout=120s; then
  echo "-- 롤아웃 정체: 살아있는 Pod 수동 재생성 시도 --"
  SEL=$(kubectl get ds "$NAME" -n "$NS" -o jsonpath='{range .spec.selector.matchLabels}{@}{"\n"}{end}' 2>/dev/null)
  # selector 라벨 key=value 한 개 추출 (k8s-app 또는 app)
  LK=$(kubectl get ds "$NAME" -n "$NS" -o go-template='{{range $k,$v := .spec.selector.matchLabels}}{{$k}}={{$v}}{{"\n"}}{{end}}' 2>/dev/null | head -1)
  echo "selector=$LK → 오래된(비-rootfs) Pod 삭제"
  kubectl delete pod -n "$NS" -l "$LK" --field-selector status.phase=Running 2>/dev/null
  kubectl rollout status ds/"$NAME" -n "$NS" --timeout=120s
fi

# 4) 검증: 마스터 노드(hostNetwork)에서 node-exporter가 호스트 마운트를 노출하는지
echo "-- 검증: localhost:9100 마운트포인트 (/, /home 등 보이면 성공) --"
sleep 5
curl -s --max-time 5 http://localhost:9100/metrics 2>/dev/null \
  | grep '^node_filesystem_size_bytes' \
  | grep -oE 'mountpoint="[^"]*"' | sort -u | paste -sd' ' -

echo "=== END ==="
