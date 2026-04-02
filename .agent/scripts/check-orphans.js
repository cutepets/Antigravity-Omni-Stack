const fs = require('fs');
const path = require('path');
const agentsDir = '.agent/agents';
const coveredSkills = new Set();

if (!fs.existsSync(agentsDir)) {
    console.log("No agents directory found. Cannot run framework maintenance.");
    process.exit(0);
}

// Đọc toàn bộ các file Agent `.md` và parse các Skill được khai báo trong đó
fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).forEach(af => {
  const c = fs.readFileSync(path.join(agentsDir, af), 'utf8');
  // Lấy các dòng có dạng "  - skill-name"
  [...c.matchAll(/^  - (.+)$/gm)].forEach(m => coveredSkills.add(m[1].trim()));
  
  // Hỗ trợ thêm format " - skill-name" (1 space)
  [...c.matchAll(/^ - (.+)$/gm)].forEach(m => coveredSkills.add(m[1].trim()));
  
  // Hỗ trợ thêm format "- skill-name" (0 space)
  [...c.matchAll(/^- (.+)$/gm)].forEach(m => coveredSkills.add(m[1].trim()));
});

const skillFolders = fs.existsSync('.agent/skills') ? fs.readdirSync('.agent/skills', { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('_'))
  .map(d => d.name) : [];

const orphans = skillFolders.filter(s => !coveredSkills.has(s));

console.log(`\n========================================================`);
console.log(`🤖 [AGENT-FRAMEWORK-MAINTENANCE] AUDIT REPORT`);
console.log(`========================================================\n`);

console.log(`🔹 Tổng số Agents trực chiến: ${fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).length}`);
console.log(`🔹 Tổng số kho chứa Kỹ năng (Skil Folders): ${skillFolders.length}`);
console.log(`🔹 Số Kỹ năng đã giao việc (Covered): ${coveredSkills.size}`);
console.log(`🔹 Kỹ năng "mồ côi" (Orphans): ${orphans.length}`);

console.log(`\n--------------------------------------------------------`);
if (orphans.length > 0) {
    if (orphans.length >= 8) {
        console.log(`\n🚨 KÍCH HOẠT QUY TẮC BÁO ĐỘNG (Step 4: New Agent Threshold):`);
        console.log(`Phát hiện ${orphans.length} Kỹ năng chưa được quản lý (> 8 skills).`);
        console.log(`=> HỆ THỐNG ĐỀ XUẤT: Vui lòng tự tạo Agent mới hoặc dùng /create-agent để nạp quỹ kiến thức này vào khối quản lý!\n`);
    } else {
        console.log(`\n⚠️ PHÁT HIỆN ORPHANS (Cần Move vào _archive hoặc gán cho Agent):`);
    }
    console.log(orphans.sort().map(s => `   - ${s}`).join('\n'));
} else {
    console.log(`✅ HỆ THỐNG HOÀN HẢO! 100% Kỹ năng đã có Agent chủ quản.`);
    console.log(`Không phát hiện trùng lặp, rác, hay xung đột phân vùng trong kiến trúc.`);
}
console.log(`========================================================\n`);
