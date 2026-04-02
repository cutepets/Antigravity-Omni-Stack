const fs = require('fs');
const path = require('path');

const agentsDir = '.agent/agents';
const skillsDir = '.agent/skills';

if (!fs.existsSync(agentsDir) || !fs.existsSync(skillsDir)) {
    console.error("Thư mục lõi (Agents/Skills) bị thất lạc. Vui lòng kiểm tra lại cấu trúc.");
    process.exit(1);
}

// 1. Quét kho (Inventory Physical Skills)
const physicalSkills = new Set(
    fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_'))
      .map(d => d.name)
);

let totalGhostsDeleted = 0;
let modifiedAgentsCount = 0;

console.log(`\n========================================================`);
console.log(`👻 BẮT ĐẦU KẾT GIỚI THANH TẨY KỸ NĂNG MA (GHOST SKILLS) 👻`);
console.log(`========================================================\n`);

// 2. Chỉnh sửa não bộ từng Agent
fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).forEach(file => {
    const filePath = path.join(agentsDir, file);
    let originalContent = fs.readFileSync(filePath, 'utf8');
    let content = originalContent;
    
    // Tìm Frontmatter YAML (khu vực định nghĩa cấu hình Array)
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!yamlMatch) return;
    
    let yamlPart = yamlMatch[1];
    
    let inSkills = false;
    let newYamlLines = [];
    let preservedSkillCount = 0;
    let localGhosts = 0;
    
    const lines = yamlPart.split('\n');
    for (const line of lines) {
        if (line.match(/^skills:\s*$/)) {
            inSkills = true;
            newYamlLines.push(line);
            continue;
        }
        
        if (inSkills) {
            // Nếu thoát khỏi block skills
            if (line.match(/^[a-zA-Z0-9_-]+:/)) {
                inSkills = false;
                newYamlLines.push(line);
                continue;
            }
            
            // Xử lý dòng danh sách Kỹ năng (VD: `  - abc-xyz`)
            const skillMatch = line.match(/^\s*-\s+(.+)$/);
            if (skillMatch) {
                const skillName = skillMatch[1].trim();
                
                // Nếu Kỹ năng không tồn tại ngoài đời thức -> Diệt ma (Ignore)
                if (!physicalSkills.has(skillName)) {
                    totalGhostsDeleted++;
                    localGhosts++;
                    continue; // Skip push = Delete line
                } else {
                    preservedSkillCount++;
                }
            }
        }
        
        // Include properties, valid skills, and yaml keys
        newYamlLines.push(line);
    }
    
    const newYaml = newYamlLines.join('\n');
    content = content.replace(yamlMatch[1], newYaml);
    
    // 3. Tự động nhận thức lại Toán Học (Xoá câu văn dối lừa)
    content = content.replace(
        /You are granted access to \d+ deep methodologies/, 
        `You are granted access to ${preservedSkillCount} deep methodologies`
    );
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[+] Đã tịnh tiến tệp: ${file.padEnd(30, ' ')} -> Giữ: ${String(preservedSkillCount).padEnd(3, ' ')} | Tiêu diệt: ${localGhosts} ma`);
        modifiedAgentsCount++;
    }
});

console.log(`\n--------------------------------------------------------`);
console.log(`🔥 TỔNG KẾT LAU DỌN:`);
console.log(`- Vừa phẫu thuật: ${modifiedAgentsCount} Agents`);
console.log(`- Tổng số Kỹ năng Ma (Ghost) bị gạch tên: ${totalGhostsDeleted}`);
console.log(`========================================================\n`);
