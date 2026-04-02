#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// CLI args parsing
const args = process.argv.slice(2);
let scope = 'repo';
let format = 'text';
let targetRoot = process.cwd();

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--format') {
    format = args[++i];
  } else if (args[i] === '--root') {
    targetRoot = args[++i];
  } else if (!args[i].startsWith('--')) {
    scope = args[i];
  }
}

// Rubric version
const RUBRIC_VERSION = '2026-03-30';

function checkExists(relPath) {
  return fs.existsSync(path.join(targetRoot, relPath));
}

function audit() {
  const result = {
    overview: `Harness Audit (${scope})`,
    max_score: 70,
    overall_score: 0,
    categories: [],
    failed_checks: [],
    top_actions: []
  };

  // 1. Tool Coverage
  let toolScore = 0;
  if (checkExists('.agent/skills')) toolScore += 5;
  if (checkExists('.agent/workflows') || checkExists('.agent/commands')) toolScore += 5;
  result.categories.push({ name: 'Tool Coverage', score: toolScore, text: `${toolScore}/10 pts` });
  if (toolScore < 10) {
    result.failed_checks.push({ path: '.agent/skills or .agent/workflows', msg: 'Chưa phủ đủ thư mục Tools (Skills/Workflows).' });
    result.top_actions.push('[Tool Coverage] Bổ sung thư mục skills và workflows cho hệ thống.');
  }

  // 2. Context Efficiency
  let ctxScore = 0;
  if (checkExists('.agent/workflows/context.md') || checkExists('.agent/workflows/compact.md')) ctxScore += 5;
  if (checkExists('.agent/rules')) ctxScore += 5;
  result.categories.push({ name: 'Context Efficiency', score: ctxScore, text: `${ctxScore}/10 pts` });
  if (ctxScore < 10) {
    result.failed_checks.push({ path: '.agent/workflows/compact.md', msg: 'Thiếu compact workflow để quản lý kích thước context.' });
    result.top_actions.push('[Context Efficiency] Tích hợp compact.md và context.md.');
  }

  // 3. Quality Gates
  let qualityScore = 0;
  if (checkExists('package.json')) qualityScore += 3;
  if (checkExists('.husky') || checkExists('.github/workflows')) qualityScore += 7;
  result.categories.push({ name: 'Quality Gates', score: qualityScore, text: `${qualityScore}/10 pts` });
  if (qualityScore < 10) {
    result.failed_checks.push({ path: '.github/workflows hoặc .husky', msg: 'Không tìm thấy hệ thống CI/CD hay Pre-commit hooks.' });
    result.top_actions.push('[Quality Gates] Cài đặt Husky hook hoặc cấu hình Github Actions.');
  }

  // 4. Memory Persistence
  let memScore = 0;
  if (checkExists('.agent/knowledge') || checkExists('.claude/session-data') || checkExists('.agent/memory')) memScore += 10;
  result.categories.push({ name: 'Memory Persistence', score: memScore, text: `${memScore}/10 pts` });
  if (memScore < 10) {
    result.failed_checks.push({ path: '.agent/knowledge', msg: 'Hệ thống chưa có Knowledge Base lưu trữ dài hạn.' });
    result.top_actions.push('[Memory Persistence] Khởi tạo hệ thống Persistence Memory (.agent/knowledge).');
  }

  // 5. Eval Coverage
  let evalScore = 0;
  let missingEvalPath = '';
  let evalMsg = '';
  if (checkExists('.agent/workflows/eval.md')) {
    evalScore += 5;
  } else {
    missingEvalPath += '.agent/workflows/eval.md ';
    evalMsg += 'Thiếu file khai báo eval.md. ';
  }
  
  if (checkExists('tests') || checkExists('__tests__') || checkExists('.claude/evals')) {
    evalScore += 5;
  } else {
    missingEvalPath += '.claude/evals ';
    evalMsg += 'Chưa thể hiện cấu trúc Test hoặc Eval (không thấy tests/ hay .claude/evals).';
  }
  
  result.categories.push({ name: 'Eval Coverage', score: evalScore, text: `${evalScore}/10 pts` });
  if (evalScore < 10) {
    result.failed_checks.push({ path: missingEvalPath.trim(), msg: evalMsg.trim() });
    result.top_actions.push('[Eval Coverage] Áp dụng phương thức kiểm duyệt Eval EDD qua .claude/evals hoặc thư mục test.');
  }

  // 6. Security Guardrails
  let secScore = 0;
  // Fallback to checking specific rule files if a general check fails
  if (checkExists('.agent/rules/security.md')) {
    secScore += 10;
  } else if (checkExists('.agent/rules/runtime-watchdog.md')) {
    secScore += 5; // Partial points
  }
  result.categories.push({ name: 'Security Guardrails', score: secScore, text: `${secScore}/10 pts` });
  if (secScore < 10) {
    result.failed_checks.push({ path: '.agent/rules/security.md', msg: 'Security rules chưa hoàn thiện hoặc bị thiếu.' });
    result.top_actions.push('[Security] Cung cấp preflight guards cho Prompts và Tool calls (*security.md*).');
  }

  // 7. Cost Efficiency
  let costScore = 0;
  if (checkExists('.agent/workflows/context-budget.md')) costScore += 10;
  else if (checkExists('.agent/workflows/context.md')) costScore += 5;
  result.categories.push({ name: 'Cost Efficiency', score: costScore, text: `${costScore}/10 pts` });
  if (costScore < 10) {
    result.failed_checks.push({ path: '.agent/workflows/context-budget.md', msg: 'Không tìm thấy ngân sách Token Budget cost.' });
    result.top_actions.push('[Cost Efficiency] Bổ sung context-budget bounds để tối ưu hóa context.');
  }

  result.overall_score = toolScore + ctxScore + qualityScore + memScore + evalScore + secScore + costScore;

  return result;
}

const auditResult = audit();

if (format === 'json') {
  console.log(JSON.stringify(auditResult, null, 2));
} else {
  console.log(`\n===========================================`);
  console.log(`${auditResult.overview}: ${auditResult.overall_score}/${auditResult.max_score}`);
  console.log(`===========================================\n`);
  
  auditResult.categories.forEach(cat => {
    console.log(`- ${cat.name}: ${cat.score}/10 (${cat.text})`);
  });

  if (auditResult.failed_checks.length > 0) {
    console.log('\n❌ Failed Checks:');
    auditResult.failed_checks.forEach(check => {
      console.log(` - [${check.path}] => ${check.msg}`);
    });
  }

  if (auditResult.top_actions.length > 0) {
    console.log('\n🔥 Top Actions (Prioritized):');
    const top3 = auditResult.top_actions.slice(0, 3);
    top3.forEach((action, idx) => {
      console.log(` ${idx + 1}) ${action}`);
    });
  } else {
    console.log('\n✅ Top Actions: All systems compliant. No critical actions needed.');
  }

  console.log(`\n(Rubric Version: ${RUBRIC_VERSION})\n`);
}
