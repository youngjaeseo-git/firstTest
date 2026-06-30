#!/bin/bash
# 재부팅 자동복구 설정 확인 (읽기 전용) — db 재시작정책 + dcim 부팅시작 여부
# 실행: bash check/targetExecCmd/20260630-reboot-check.sh
echo "=== REBOOT_CHECK (read-only) ==="
echo "DB_RESTART_POLICY=$(docker inspect dcim-db --format '{{.HostConfig.RestartPolicy.Name}}' 2>/dev/null)"
echo "DCIM_ENABLED=$(systemctl is-enabled dcim 2>/dev/null)"
echo "=== END ==="
# 이상적: DB_RESTART_POLICY=always(또는 unless-stopped) + DCIM_ENABLED=enabled
#  → 재부팅해도 db와 앱이 자동 복구.
