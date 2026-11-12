/** Regenerate backend grading manifest from the authored Quest Academy source.
 * Run from the CampusBounty repo root: node backend/scripts/export_curriculum.cjs
 * Requires the project's existing TypeScript dev dependency.
 * Commit backend's generated manifest with any curriculum changes.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const input = path.resolve(__dirname, '../../src/game/data/curriculum/academyLessons.ts');
const output = path.resolve(__dirname, '../app/content/academy_manifest.json');
const compiled = ts.transpileModule(fs.readFileSync(input, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS }
}).outputText;
const ctx = { exports: {}, module: { exports: {} } };
ctx.exports = ctx.module.exports;
vm.runInNewContext(compiled, ctx, { filename: input, timeout: 5000 });
const lessons = ctx.module.exports.ACADEMY_LESSONS;
if (!lessons || Object.keys(lessons).length < 1) throw new Error('No Academy lessons found');
const seen = new Set();
for (const [id, lesson] of Object.entries(lessons)) {
    if (id !== lesson.id || !Array.isArray(lesson.assessment)) throw new Error(`Invalid lesson: ${id}`);
    for (const q of lesson.assessment) {
        if (seen.has(q.id)) throw new Error(`Duplicate assessment ID: ${q.id}`);
        seen.add(q.id);
    }
}
fs.writeFileSync(output, JSON.stringify({ version: 'g3.8.1', lessons }, null, 2) + '\n');
console.log(`Exported ${Object.keys(lessons).length} lessons and ${seen.size} graded questions to ${output}`);
