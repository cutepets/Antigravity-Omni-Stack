const { execSync } = require('child_process');
function run(cmd) { return execSync(cmd, { encoding: 'utf8' }).trim(); }
const initRaw = run('node ".agent/get-shit-done/bin/gsd-tools.cjs" init milestone-op');
const init = JSON.parse(initRaw);
const roadmapRaw = run('node ".agent/get-shit-done/bin/gsd-tools.cjs" roadmap analyze');
const roadmap = JSON.parse(roadmapRaw);
const incomplete = roadmap.phases
  .filter(p => p.disk_status !== 'complete')
  .sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
const result = {
  milestone_version: init.milestone_version,
  phase_count: init.phase_count,
  completed_phases: init.completed_phases,
  roadmap_exists: init.roadmap_exists,
  state_exists: init.state_exists,
  incomplete_phases: incomplete.map(p => ({ number: p.number, name: p.name, disk_status: p.disk_status }))
};
require('fs').writeFileSync('.planning/gsd-state.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
