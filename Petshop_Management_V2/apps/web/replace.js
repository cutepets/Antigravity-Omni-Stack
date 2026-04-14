const fs = require('fs');
const file = 'apps/web/src/app/(dashboard)/inventory/receipts/_components/create-receipt-form.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /} = useReceiptForm({ mode, receiptId })/g,
  '} = (formReturn = useReceiptForm({ mode, receiptId }))'
);

content = content.replace(
  /const {/,
  'let formReturn: any;\n  const {'
);

const imports = [
  "import { ReceiptHeader } from './receipt-header'",
  "import { ReceiptProductTable } from './receipt-product-table'",
  "import { ReceiptSidebar } from './receipt-sidebar'"
].join('\n');
content = content.replace(
  /import { useReceiptForm } from '.\/receipt\/use-receipt-form'/,
  `import { useReceiptForm } from './receipt/use-receipt-form'\n${imports}`
);

const lines = content.split('\n');
const startLineIdx = lines.findIndex(l => l.includes('<div className="shrink-0 border-b border-border bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(255,255,255,0))]">'));
const endLineIdx = lines.findIndex(l => l.includes('</ReceiptWorkspace>')) - 1;

if (startLineIdx !== -1 && endLineIdx !== -1) {
  const newMiddle = [
    '      <ReceiptHeader form={formReturn as any} />',
    '      <div className="flex flex-1 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_420px] max-lg:!block max-lg:[&>aside]:hidden max-lg:[&>div]:!h-full">',
    '        <ReceiptProductTable form={formReturn as any} />',
    '        <ReceiptSidebar form={formReturn as any} />',
    '      </div>'
  ];
  
  lines.splice(startLineIdx, endLineIdx - startLineIdx + 1, ...newMiddle);
  fs.writeFileSync(file, lines.join('\n'));
  console.log('Successfully updated create-receipt-form.tsx');
} else {
  console.log('Failed to find start or end index', startLineIdx, endLineIdx);
}
