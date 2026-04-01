const { execSync } = require('child_process');
const out = execSync('node ".agent/get-shit-done/bin/gsd-tools.cjs" init milestone-op', { encoding: 'utf8' });
const d = JSON.parse(out);
delete d.available_skills;
console.log(JSON.stringify(d, null, 2));
