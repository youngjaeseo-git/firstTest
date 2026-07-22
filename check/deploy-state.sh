#!/bin/bash
# 배포 상태 점검 (읽기 전용) — "여기가 앱(마스터) 서버인지 + .next 빌드가 온전한지" 확인.
# 각 서버에서 실행해 결과를 비교. 아무것도 바꾸지 않음.
# 사용: bash check/deploy-state.sh
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
cd "$(cd "$(dirname "$0")/.." && pwd)"

host=$(hostname)
dcim="no"; systemctl is-active dcim >/dev/null 2>&1 && dcim="ACTIVE"
p3000="no"; { ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null; } | grep -q ":3000 " && p3000="LISTEN"
db="no"; docker ps --format '{{.Names}}' 2>/dev/null | grep -q "dcim-db" && db="up"
buildid="none"; [ -s .next/BUILD_ID ] && buildid=$(cat .next/BUILD_ID)
staticn=$(ls -A .next/static 2>/dev/null | wc -l | tr -d ' ')
nodev=$(node -v 2>/dev/null || echo "none")

# 판정: 앱서버 = dcim ACTIVE 또는 :3000 LISTEN. 빌드온전 = BUILD_ID 있고 static>0.
verdict="이 서버는 앱서버 아님(무관)"
[ "$dcim" = "ACTIVE" ] || [ "$p3000" = "LISTEN" ] && {
  if [ "$buildid" != "none" ] && [ "$staticn" -gt 0 ]; then verdict="앱서버 · 빌드 온전"; else verdict="앱서버 · [빌드 훼손/미빌드] → rebuild 필요"; fi
}

echo "host=$host | dcim=$dcim :3000=$p3000 dcim-db=$db node=$nodev"
echo ".next: BUILD_ID=$buildid static파일수=$staticn"
echo "==> $verdict"
