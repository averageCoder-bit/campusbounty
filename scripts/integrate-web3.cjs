/** Safe idempotent integration of Web3 UI and protected backend router.
 * Usage: node scripts/integrate-web3.cjs (from CampusBounty repository root)
 * Does not touch QuestFinding, other game modes, or env files.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const main = path.join(root, 'backend/app/main.py');
const app = path.join(root, 'src/App.tsx');
const req = path.join(root, 'backend/requirements.txt');
for (const p of [main, app, req]) {
  if (!fs.existsSync(p)) throw new Error(`Missing ${p}. Run from CampusBounty repo root, after copying patch files.`);
}
const changes = [];
let py = fs.readFileSync(main, 'utf8');
if (!py.includes('from .web3_achievements import router as web3_router')) {
  const anchor = 'from .auth import current_user_id';
  if (!py.includes(anchor)) throw new Error('Unexpected backend/app/main.py; integrate the Web3 router manually.');
  py = py.replace(anchor, `${anchor}\nfrom .web3_achievements import router as web3_router`);
  const appMatch = py.match(/^app = FastAPI\([^\n]+\)/m);
  if (!appMatch) throw new Error('No one-line app = FastAPI(...) found; integrate web3 router manually.');
  py = py.replace(appMatch[0], `${appMatch[0]}\napp.include_router(web3_router)`);
  changes.push([main, py]);
}
let tsx = fs.readFileSync(app, 'utf8');
if (!tsx.includes('Web3AchievementPanel')) {
  if (!tsx.includes('<PhaserGame />')) throw new Error('Expected <PhaserGame /> in src/App.tsx. Add <Web3AchievementPanel /> manually.');
  tsx = `import { Web3AchievementPanel } from './components/Web3AchievementPanel';\n${tsx}`;
  tsx = tsx.replace('<PhaserGame />', '<PhaserGame />\n                <Web3AchievementPanel />');
  changes.push([app, tsx]);
}
let requirements = fs.readFileSync(req, 'utf8');
if (!/^web3\s*[>=<]/m.test(requirements)) {
  requirements += `${requirements.endsWith('\n') ? '' : '\n'}web3>=7.0,<8.0\n`;
  changes.push([req, requirements]);
}
for (const [file, contents] of changes) {
  fs.copyFileSync(file, file + '.pre-web3-backup');
  fs.writeFileSync(file, contents, 'utf8');
  console.log('Updated:', path.relative(root, file));
}
console.log(changes.length ? 'Patch applied. Review git diff.' : 'Already integrated. No changes.');
