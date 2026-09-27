#!/usr/bin/env bash
# dev-harness 仓库自检 — 本地与 CI 共用同一入口
# 覆盖：清单 JSON 合法性与关键字段 / hook 脚本语法与可执行位 / workflow JS 语法（运行时等效包裹）/ 干跑回归
set -euo pipefail
cd "$(dirname "$0")/.."
FAIL=0

echo "── 1/4 清单 JSON 合法性 ──"
for f in .claude-plugin/marketplace.json plugin/.claude-plugin/plugin.json plugin/hooks/hooks.json; do
  if node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" 2>/dev/null; then
    echo "  ✅ $f"
  else
    echo "  ❌ $f 解析失败"; node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || true; FAIL=1
  fi
done
# 关键字段：marketplace 声明 plugins[].source，plugin.json 声明 name/version
node -e '
const fs = require("fs");
const mp = JSON.parse(fs.readFileSync(".claude-plugin/marketplace.json", "utf8"));
if (!mp.name || !Array.isArray(mp.plugins) || !mp.plugins.length || !mp.plugins[0].source) { console.error("  ❌ marketplace.json 缺 name/plugins[].source"); process.exit(1); }
const pl = JSON.parse(fs.readFileSync("plugin/.claude-plugin/plugin.json", "utf8"));
if (!pl.name || !pl.version) { console.error("  ❌ plugin.json 缺 name/version"); process.exit(1); }
const semi = /^\d+\.\d+\.\d+$/;
if (!semi.test(pl.version)) { console.error("  ❌ plugin.json version 非 semver:", pl.version); process.exit(1); }
console.log("  ✅ 清单关键字段（name/plugins[].source/version-semver）");
' || FAIL=1

echo "── 2/4 hooks 脚本语法 + 可执行位 ──"
for s in plugin/hooks/scripts/*.sh; do
  if bash -n "$s" 2>/dev/null; then echo "  ✅ bash -n $s"; else echo "  ❌ $s 语法错误"; FAIL=1; fi
  [ -x "$s" ] || { echo "  ❌ $s 缺可执行位"; FAIL=1; }
done
# hooks.json 内引用的脚本必须存在
node -e '
const fs = require("fs");
const h = JSON.parse(fs.readFileSync("plugin/hooks/hooks.json", "utf8"));
const refs = JSON.stringify(h).match(/\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/scripts\/[\w.-]+/g) || [];
let bad = 0;
for (const r of new Set(refs)) {
  const p = "plugin/" + r.replace("${CLAUDE_PLUGIN_ROOT}/", "");
  if (!fs.existsSync(p)) { console.error("  ❌ hooks.json 引用缺失脚本:", p); bad = 1; }
}
if (!bad) console.log("  ✅ hooks.json 引用的 " + new Set(refs).size + " 个脚本均存在");
process.exit(bad);
' || FAIL=1

echo "── 3/4 workflow JS 语法（运行时等效：async 函数体包裹）──"
node -e '
const fs = require("fs");
let bad = 0;
for (const f of fs.readdirSync("plugin/workflows").filter(x => x.endsWith(".js"))) {
  const src = fs.readFileSync("plugin/workflows/" + f, "utf8").replace(/^export\s+const/gm, "const");
  try { new Function("args", "agent", "parallel", "pipeline", "phase", "log", "(async function(){\n" + src + "\n})"); console.log("  ✅ " + f); }
  catch (e) { console.log("  ❌ " + f + " - " + e.message); bad = 1; }
}
process.exit(bad);
' || FAIL=1

echo "── 4/4 干跑回归（profile 解析 / 按栈 agent 路由 / fail-closed）──"
if node verify/dry-run.mjs | tail -1 | grep -q "全部断言通过"; then
  echo "  ✅ dry-run 全部断言通过"
else
  echo "  ❌ dry-run 存在失败断言"; node verify/dry-run.mjs >/dev/null || true; FAIL=1
fi

echo
if [ "$FAIL" -eq 0 ]; then echo "✅ check.sh 全部通过"; else echo "❌ check.sh 存在失败项"; exit 1; fi
