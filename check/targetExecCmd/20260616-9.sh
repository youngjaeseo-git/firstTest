#!/bin/bash
# [131.100에서 실행] 8443 방화벽 확인 + 오픈

echo "=== 1. 방화벽 종류 확인 ==="
which firewall-cmd >/dev/null 2>&1 && echo "firewalld" || echo "firewalld 없음"
which ufw >/dev/null 2>&1 && echo "ufw" || echo "ufw 없음"
iptables -L -n 2>/dev/null | head -3 && echo "iptables 있음" || echo "iptables 확인불가"

echo ""
echo "=== 2. 8443 포트 현재 상태 ==="
ss -tlnp | grep 8443

echo ""
echo "=== 3. 방화벽 8443 오픈 ==="
if which firewall-cmd >/dev/null 2>&1; then
  sudo firewall-cmd --add-port=8443/tcp --permanent 2>&1
  sudo firewall-cmd --reload 2>&1
  echo "firewalld: 8443 오픈 완료"
elif which ufw >/dev/null 2>&1; then
  sudo ufw allow 8443/tcp 2>&1
  echo "ufw: 8443 오픈 완료"
else
  sudo iptables -I INPUT -p tcp --dport 8443 -j ACCEPT 2>&1
  echo "iptables: 8443 오픈 완료"
fi

echo ""
echo "=== 4. 로컬 테스트 ==="
curl -s -o /dev/null -w "로컬 HTTP: %{http_code}" --connect-timeout 3 http://127.0.0.1:8443/ 2>/dev/null; echo ""
