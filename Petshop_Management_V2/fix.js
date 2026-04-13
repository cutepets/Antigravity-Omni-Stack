const fs = require('fs');

const path = 'apps/web/src/app/(dashboard)/pos/page.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
  /<span>[^<]+<\/span>\s*\{item\.itemNotes\}/g,
  "<FileText size={12} className=\"shrink-0 text-amber-500\" />\n                                  {item.itemNotes}"
);
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed itemNotes emoji');
