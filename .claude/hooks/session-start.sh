#!/bin/bash
# SessionStart 훅:
#  (1) 직전 작업 브리핑 — CLAUDE.md "능동 제안 규칙"(세션 시작 시 1회) 자동화.
#      stdout이 세션 컨텍스트에 주입되므로, Claude가 세션 시작 때 직전 작업을 보고
#      반복·수동 패턴이 보이면 자동화를 먼저 제안하게 된다.
#  (2) 원격(web) 환경 준비 — 의존성 설치 + Prisma client 생성.
set -uo pipefail   # -e 없음: 브리핑이 세션 시작을 중단시키지 않도록

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# ── (1) 직전 작업 브리핑 (git 기반 — clone 깊이와 무관하게 동작) ──
{
  echo "=== 세션 시작 브리핑 (능동 제안 규칙) ==="
  echo "브랜치: $(git branch --show-current 2>/dev/null || echo '?')"
  echo "▶ 최근 커밋:"
  git log --oneline -8 2>/dev/null | sed 's/^/   /'

  dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [ "${dirty:-0}" -gt 0 ]; then
    echo "▶ 미커밋 변경 ${dirty}건 — 직전 세션에서 마무리 안 된 작업일 수 있음"
  fi

  echo "→ 위 최근 작업에서 반복·수동 패턴이나 비효율이 보이면, 착수 전에 자동화·단축을 먼저 제안할 것."
  echo "→ 산출물 숫자 보고/발표 전에는 'node scripts/project-stats.mjs'로 SSOT 갱신 + '--check'로 드리프트 점검."
  echo "==========================================="
} 2>/dev/null || true

# ── (2) 원격(web) 환경 준비 ──
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if [ -f package.json ]; then
    npm install --prefer-offline --no-audit --no-fund 2>&1 || echo "⚠️ npm install 비정상 종료 (세션은 계속)"
  fi
  if [ -f prisma/schema.prisma ]; then
    npx prisma generate 2>&1 || echo "⚠️ prisma generate 비정상 종료 (세션은 계속)"
  fi
fi

exit 0
