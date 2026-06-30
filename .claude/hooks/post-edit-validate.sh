#!/bin/bash
# PostToolUse(Edit|Write) 훅: 빠른 검증만 자동 수행.
# 무거운 전체 typecheck/build는 /verify 스킬로 (이 훅은 1초 미만 검증만).
set -uo pipefail

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# 작업 트리에서 변경된 파일 목록
changed=$(git diff --name-only 2>/dev/null; git diff --staged --name-only 2>/dev/null)

# Prisma 스키마가 변경됐으면 validate (이 프로젝트에서 잦았던 마이그레이션 오류 조기 차단)
if echo "$changed" | grep -q 'prisma/schema.prisma'; then
  if ! npx prisma validate >/tmp/prisma-validate.log 2>&1; then
    echo "⚠️ Prisma schema validation 실패:" >&2
    cat /tmp/prisma-validate.log >&2
    exit 2  # exit 2 → Claude에게 피드백 전달
  fi
fi

exit 0
