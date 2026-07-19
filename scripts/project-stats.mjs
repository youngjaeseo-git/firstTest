#!/usr/bin/env node
/**
 * 프로젝트 핵심 수치의 단일 권위(SSOT).
 *
 * 문제: 커밋 수·LOC·API 수 같은 숫자가 여러 문서·PPT에 하드코딩되어,
 *       바뀔 때마다 손으로 전수 수정(sed)해야 했다.
 * 해결: 이 스크립트가 git·파일시스템에서 실측해 docs/stats.json + docs/stats.md
 *       (= 단일 권위)를 생성한다. 문서/PPT는 이 값을 따른다.
 *
 * 사용:
 *   node scripts/project-stats.mjs           # 실측 → stats.json + stats.md 갱신, 표 출력
 *   node scripts/project-stats.mjs --check    # 문서에 박힌 숫자 중 실측과 어긋난 후보를 보고(수정 안 함), 드리프트 있으면 exit 1
 *
 * 개발 환경(git 이력 존재)에서 실행한다. 폐쇄망 운영 서버용 진단 스크립트가 아니다.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => join(ROOT, p);

const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
const shList = (cmd) => sh(cmd).split("\n").filter(Boolean);

function countLoc(files) {
  let total = 0;
  for (const f of files) {
    // wc -l 와 동일하게 개행 문자 수를 센다 (기존 문서 수치와 정합).
    try { total += (readFileSync(R(f), "utf8").match(/\n/g) || []).length; } catch {}
  }
  return total;
}

function grepCount(file, re) {
  if (!existsSync(R(file))) return 0;
  return (readFileSync(R(file), "utf8").match(re) || []).length;
}

// ── 실측 ─────────────────────────────────────────────────────────
const srcFiles = shList(`find src -type f \\( -name '*.ts' -o -name '*.tsx' \\)`);
const testFiles = shList(`find src tests -type f \\( -name '*.test.ts' -o -name '*.test.tsx' \\)`).filter((f) => !f.includes("node_modules"));
const e2eSpecs = existsSync(R("tests/e2e")) ? shList(`find tests/e2e -name '*.spec.ts'`) : [];

let testCases = 0;
for (const f of testFiles) testCases += grepCount(f, /\b(it|test)\(/g);
let e2eCases = 0;
for (const f of e2eSpecs) e2eCases += grepCount(f, /\b(it|test)\(/g);

// 번역 키: translations.ts의 "key": 출현수를 언어 수(2)로 나눈 근사값
const translationsFile = "src/lib/i18n/translations.ts";
const translationTokens = grepCount(translationsFile, /['"][a-zA-Z0-9_.]+['"]\s*:/g);

const stats = {
  generatedAt: new Date().toISOString().slice(0, 10),
  commits: parseInt(sh(`git rev-list --count HEAD`), 10),
  loc: countLoc(srcFiles),
  srcFiles: srcFiles.length,
  pages: shList(`find src/app -name page.tsx`).length,
  apiRoutes: shList(`find src/app/api -name route.ts`).length,
  components: shList(`find src/components -name '*.tsx'`).length,
  models: grepCount("prisma/schema.prisma", /^model /gm),
  enums: grepCount("prisma/schema.prisma", /^enum /gm),
  schemaLines: readFileSync(R("prisma/schema.prisma"), "utf8").split("\n").length,
  featuresDone: grepCount("docs/features.md", /✅/g),
  featureCategories: grepCount("docs/features.md", /^## [0-9]/gm),
  checkScripts: shList(`find check -name '*.sh'`).length,
  checkResults: existsSync(R("check/results")) ? readdirSync(R("check/results")).filter((f) => f.endsWith(".md")).length : 0,
  testFiles: testFiles.length,
  testCases,
  e2eSpecs: e2eSpecs.length,
  e2eCases,
  translationKeysPerLang: Math.round(translationTokens / 2),
};

// 문서에서 자주 인용하는 파생값
const fmt = (n) => n.toLocaleString("en-US");

// ── --check: 문서에 박힌 숫자 드리프트 후보 탐지 ────────────────────
if (process.argv.includes("--check")) {
  // (실측값, 그 값이 인접해야 하는 키워드 패턴) — 캡처그룹의 숫자를 실측과 대조
  // 오탐을 줄이려 고유 형태를 갖는 지표만, 자릿수/콤마로 조인다.
  //  - 커밋: 3자리+ (또는 '+' 접미) → "39커밋"(단계 설명) 같은 2자리 문맥값 제외
  //  - LOC: 콤마 형식 강제(44,xxx) → 소수 문맥값 제외
  //  - 기능: 1~3자리만 → "44,211줄" 오매칭 제외
  //  - 페이지/컴포넌트/모델은 문맥 인용(예: "31개 페이지 통일")이 많아 스캔 제외(값은 stats.md에)
  const checks = [
    { label: "commits", value: stats.commits, pats: [/([\d,]{3,})\+?\s*커밋/g, /커밋[:\s]+([\d,]{3,})/g] },
    { label: "loc", value: stats.loc, pats: [/([\d]{2,3},[\d]{3})\s*줄/g, /([\d]{2,3},[\d]{3})\s*LOC/g] },
    { label: "apiRoutes", value: stats.apiRoutes, pats: [/([\d]{1,3})\s*개\s*API/g, /API\s*(?:라우트|엔드포인트)\s*[:(]?\s*([\d]{1,3})\s*개/g] },
    { label: "featuresDone", value: stats.featuresDone, pats: [/([\d]{1,3})\s*개\s*(?:구현\s*)?기능/g, /구현\s*(?:완료\s*)?기능\s*[|:]?\s*([\d]{1,3})\s*개/g] },
  ];
  // 날짜가 박힌 기록물은 "그 시점 수치"로 의도적 동결 → 드리프트 아님. 스캔 제외.
  const FROZEN = /(weekly-report|work-log|monthly-progress|handoff|stats)\b|\d{8}/;
  const docFiles = shList(`find docs -name '*.md'`)
    .concat(shList(`find scripts -name 'generate-*.py'`))
    .filter((f) => !FROZEN.test(f));
  const findings = [];
  for (const file of docFiles) {
    const lines = readFileSync(R(file), "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const chk of checks) {
        for (const pat of chk.pats) {
          pat.lastIndex = 0;
          let m;
          while ((m = pat.exec(line)) !== null) {
            const found = parseInt(m[1].replace(/,/g, ""), 10);
            if (!Number.isNaN(found) && found !== chk.value) {
              findings.push({ file, line: i + 1, label: chk.label, found, expected: chk.value, text: line.trim().slice(0, 90) });
            }
          }
        }
      }
    });
  }
  console.log(`\n[project-stats --check]  실측 기준: 커밋 ${stats.commits} · LOC ${fmt(stats.loc)} · API ${stats.apiRoutes} · 기능 ${stats.featuresDone}\n`);
  if (findings.length === 0) {
    console.log("✅ 드리프트 후보 없음 (검사한 지표 한정).");
    process.exit(0);
  }
  console.log(`⚠️  드리프트 후보 ${findings.length}건 (지표=발견값→실측값):\n`);
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}  [${f.label}] ${f.found} → ${f.expected}`);
    console.log(`      "${f.text}"`);
  }
  console.log(`\n※ 후보 목록이다(문맥상 무관한 숫자일 수 있음). 실제 지표 언급만 골라 stats.md 값으로 수정할 것.`);
  process.exit(1);
}

// ── 기본 모드: stats.json + stats.md 생성 ──────────────────────────
writeFileSync(R("docs/stats.json"), JSON.stringify(stats, null, 2) + "\n");

const md = `# 프로젝트 핵심 수치 (SSOT)

> ⚙️ **자동 생성** — \`node scripts/project-stats.mjs\`. 손으로 고치지 말 것.
> 이 표가 커밋 수·LOC 등 숫자의 **단일 권위**다. 문서·PPT는 이 값을 따른다.
> 실측일: ${stats.generatedAt}

| 항목 | 값 | 항목 | 값 |
|------|----|------|----|
| 총 커밋 | ${fmt(stats.commits)} | 소스 코드 | ${fmt(stats.loc)}줄 |
| 소스 파일(.ts/.tsx) | ${stats.srcFiles} | 페이지 | ${stats.pages} |
| API 라우트 | ${stats.apiRoutes} | 컴포넌트 | ${stats.components} |
| DB 모델 | ${stats.models} | enum | ${stats.enums} |
| schema 줄수 | ${stats.schemaLines} | 번역 키(언어당, 근사) | ${stats.translationKeysPerLang} |
| 구현 완료 기능(✅) | ${stats.featuresDone} | 기능 카테고리 | ${stats.featureCategories} |
| 확인 스크립트 | ${stats.checkScripts} | 확인 결과 기록 | ${stats.checkResults} |
| 단위 테스트 파일 | ${stats.testFiles} | 단위 테스트 케이스 | ${stats.testCases} |
| E2E 스펙 | ${stats.e2eSpecs} | E2E 케이스 | ${stats.e2eCases} |

> 발표·보고 직전: \`node scripts/project-stats.mjs\`로 이 표를 갱신하고,
> \`node scripts/project-stats.mjs --check\`로 다른 문서의 드리프트를 점검한다.
`;
writeFileSync(R("docs/stats.md"), md);

console.log("생성: docs/stats.json, docs/stats.md");
console.log(`커밋 ${stats.commits} · LOC ${fmt(stats.loc)} · API ${stats.apiRoutes} · 페이지 ${stats.pages} · 기능 ${stats.featuresDone} · 테스트 ${stats.testFiles}파일/${stats.testCases}케이스`);
