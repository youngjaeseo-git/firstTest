#!/bin/bash
# "여기가 어느 서버인가 + DCIM 앱(마스터) 서버가 맞는가 + .next 빌드가 온전한가"
# 재접속(재부팅 후 등)했을 때 헷갈리지 않도록 현재 서버를 자동 식별한다. 읽기 전용.
# 사용: bash check/deploy-state.sh
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
cd "$(cd "$(dirname "$0")/.." && pwd)"

# 알려진 서버 (docs/infrastructure.md 기준)
APP_IP="10.144.38.100"      # Lab-1 = DCIM 앱 서버 (여기서 rebuild 실행)
LAB3_IP="10.144.131.100"    # Lab-3 마스터 (앱 서버 아님)

host=$(hostname)
ips=$(hostname -I 2>/dev/null)
dcim="no"; systemctl is-active dcim >/dev/null 2>&1 && dcim="ACTIVE"
p3000="no"; { ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null; } | grep -q ":3000 " && p3000="LISTEN"
db="no"; docker ps --format '{{.Names}}' 2>/dev/null | grep -q "dcim-db" && db="up"
buildid="none"; [ -s .next/BUILD_ID ] && buildid=$(cat .next/BUILD_ID)
staticn=$(ls -A .next/static 2>/dev/null | wc -l | tr -d ' ')

# 서버 식별: IP 우선, 없으면 서비스 정황으로 추정
env_name="알 수 없는 서버"
is_app="no"
if echo " $ips " | grep -q " $APP_IP "; then
  env_name="Lab-1 (10.144.38.100) = DCIM 앱 서버"; is_app="yes"
elif echo " $ips " | grep -q " $LAB3_IP "; then
  env_name="Lab-3 마스터 (10.144.131.100) — 앱 서버 아님"
elif [ "$dcim" = "ACTIVE" ] || [ "$p3000" = "LISTEN" ]; then
  env_name="DCIM 앱 서버로 추정 (dcim/:3000 감지, IP 미확인)"; is_app="yes"
fi

echo "======================================================"
echo " 현재 서버: $host"
echo " IP: $ips"
echo " 식별: $env_name"
echo "------------------------------------------------------"
echo " dcim서비스=$dcim  :3000=$p3000  dcim-db=$db"
echo " .next: BUILD_ID=$buildid  static파일수=$staticn"
echo "======================================================"

if [ "$is_app" = "yes" ]; then
  if [ "$buildid" != "none" ] && [ "$staticn" -gt 0 ]; then
    echo " ✅ 여기가 DCIM 앱 서버 · 빌드 온전"
    echo "    화면 오류가 계속되면 브라우저 강력 새로고침(Ctrl/Cmd+Shift+R)만 하세요."
  else
    echo " ⚠️  여기가 DCIM 앱 서버인데 .next 빌드가 훼손/미빌드 상태"
    echo "    → 이 서버에서:  sudo bash scripts/rebuild-prod.sh"
  fi
else
  echo " ❌ 여기는 DCIM 앱 서버가 아닙니다."
  echo "    rebuild-prod.sh 를 여기서 실행하지 마세요."
  echo "    앱 서버는 Lab-1(10.144.38.100)입니다. 거기로 접속해서 실행하세요."
fi
