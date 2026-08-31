#!/bin/bash
# Bulk Refresh 실패 원인 진단 (첫 3대만, 에러 상세 출력)
# 실행: bash check/targetExecCmd/20260625-debug-refresh.sh
cd /home/dcim/firstTest 2>/dev/null || cd "$(dirname "$0")/../.." || exit 1

set -a; source .env 2>/dev/null; set +a

echo "=== D1. 환경 확인 ==="
echo "DB=$([ -n "$DATABASE_URL" ] && echo 'SET' || echo 'UNSET')"
echo "BMC_U=$([ -n "$BMC_USERNAME" ] && echo 'SET' || echo 'UNSET')"
echo "NODE=$(node --version 2>/dev/null || echo 'NONE')"
echo "TSX=$(npx tsx --version 2>/dev/null || echo 'NONE')"

echo "=== D2. Prisma 연결 + 첫 3대 Redfish 테스트 ==="
npx tsx -e '
import { PrismaClient } from "@prisma/client";
import { getSystemHwInfo } from "./src/lib/redfish";

const prisma = new PrismaClient();

async function main() {
  const servers = await prisma.equipment.findMany({
    where: { type: "SERVER", bmcIpAddress: { not: null } },
    select: { id: true, hostname: true, bmcIpAddress: true },
    orderBy: { hostname: "asc" },
    take: 3,
  });
  console.log("SERVERS=" + servers.length);
  servers.forEach(s => console.log("  " + s.hostname + " → " + s.bmcIpAddress));

  const user = process.env.BMC_USERNAME!;
  const pass = process.env.BMC_PASSWORD!;

  for (const s of servers) {
    console.log("\n--- " + s.hostname + " (" + s.bmcIpAddress + ") ---");
    try {
      const hw = await getSystemHwInfo({
        host: s.bmcIpAddress!,
        username: user,
        password: pass,
        timeoutMs: 15000,
      });
      console.log("OK mfr=" + (hw.manufacturer || "null") + " cpu=" + hw.cpus.length + " mem=" + hw.memories.length);
    } catch (e: any) {
      console.log("ERR_NAME=" + (e.name || "unknown"));
      console.log("ERR_MSG=" + (e.message || "none").substring(0, 120));
      if (e.statusCode) console.log("ERR_HTTP=" + e.statusCode);
      if (e.code) console.log("ERR_CODE=" + e.code);
    }
  }

  await prisma.$disconnect();
}
main().catch(e => { console.log("FATAL: " + e.message); process.exit(1); });
'

echo "=== 완료 ==="
