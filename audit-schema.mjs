// Comprehensive schema audit. For each table, pull live columns from PostgREST,
// then grep src/ and supabase/functions/ for .update({...}) / .insert({...}) /
// .eq('field', ...) calls on that table, extract field names, and report any
// that don't exist as columns.
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = 'https://dbvsnzppevytanoxzgwj.supabase.co';
const SRK = process.env.SRK;
const REPO = '/Users/tonyt/Projects/caddie-ai-golf-coach';

// 1) Fetch live schema
const spec = await fetch(`${SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
}).then((r) => r.json());

const tables = {};
for (const [name, info] of Object.entries(spec.definitions || {})) {
  tables[name] = new Set(Object.keys(info.properties || {}));
}
console.log(`live schema: ${Object.keys(tables).length} tables`);

// 2) Walk source files
const walk = (dir, files = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(jsx?|tsx?|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
};

const srcFiles = [
  ...walk(path.join(REPO, 'src')),
  ...walk(path.join(REPO, 'supabase/functions')),
];
console.log(`source files to scan: ${srcFiles.length}`);

// 3) For each table, find .from('table'). … calls, then extract fields
const findings = {}; // table -> { field -> [{file, line, kind, snippet}] }

const recordField = (table, field, location, kind) => {
  if (!tables[table]) return;
  if (tables[table].has(field)) return; // exists — fine
  if (/^id$/.test(field)) return; // primary key always exists
  findings[table] ||= {};
  findings[table][field] ||= [];
  findings[table][field].push({ ...location, kind });
};

// Patterns we look for — table is captured first, then we extract field names
// from the nearest object literal or eq() / select() call.
for (const file of srcFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');

  // For each .from('TABLE') occurrence, capture only the chain attached to THAT
  // .from() — bounded by the next .from( or by paren-balancing back to zero.
  const re = /\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const table = m[1];
    if (!tables[table]) continue;
    const start = m.index;
    const linePrefix = text.slice(0, start).split('\n').length;
    const baseLoc = { file: file.replace(REPO + '/', ''), line: linePrefix };

    // Determine the chain boundary: scan from end of this .from() match
    // until paren-depth (relative to this .from's parent expression) goes
    // back to zero, OR we hit the next .from( or top-level ;
    const startInChain = m.index + m[0].length;
    // Track the paren depth of the *parent* call (the chain). Each '(' increments,
    // ')' decrements. We stop when we see a ')' that closes a balance lower than 0
    // (i.e. we've escaped the chain's parent), or hit a ';' at depth 0, or hit
    // the next ".from(" at depth 0.
    let depth = 0;
    let end = text.length;
    for (let i = startInChain; i < text.length; i++) {
      const c = text[i];
      if (c === '(') depth++;
      else if (c === ')') { if (depth === 0) { end = i; break; } depth--; }
      else if (depth === 0) {
        if (c === ';' || c === '\n' && text.slice(i, i + 100).match(/^\n\s*(const|let|var|return|await|if|for|while|}|\))/)) {
          end = i; break;
        }
        if (text.startsWith('.from(', i)) { end = i; break; }
      }
    }
    const chain = text.slice(startInChain, end);

    // Inside the chain, scan for the relevant call patterns
    for (const em of chain.matchAll(/\.eq\(\s*['"]([a-z_][a-z0-9_]*)['"]/g)) recordField(table, em[1], baseLoc, 'eq');
    for (const em of chain.matchAll(/\.ilike\(\s*['"]([a-z_][a-z0-9_]*)['"]/g)) recordField(table, em[1], baseLoc, 'ilike');
    for (const om of chain.matchAll(/\.order\(\s*['"]([a-z_][a-z0-9_]*)['"]/g)) recordField(table, om[1], baseLoc, 'order');
    for (const mm of chain.matchAll(/\.match\(\s*\{([^}]*)\}/g)) {
      for (const fm of mm[1].matchAll(/(['"]?)([a-z_][a-z0-9_]*)\1\s*:/g)) recordField(table, fm[2], baseLoc, 'match');
    }
    for (const um of chain.matchAll(/\.(update|insert)\(\s*\{([\s\S]*?)\}\s*\)?\s*(?:\.select|;|$)/g)) {
      const inner = um[2];
      for (const fm of inner.matchAll(/(?:^|[,\s])([a-z_][a-z0-9_]*)\s*:/g)) recordField(table, fm[1], baseLoc, um[1]);
    }
  }
}

// 4) Report
let totalMissing = 0;
const grouped = {};
for (const table of Object.keys(findings).sort()) {
  for (const field of Object.keys(findings[table]).sort()) {
    grouped[`${table}.${field}`] = findings[table][field];
    totalMissing++;
  }
}

if (totalMissing === 0) {
  console.log('\n✅ No missing column references found.');
} else {
  console.log(`\n⚠️  ${totalMissing} missing column references across ${Object.keys(findings).length} tables:\n`);
  for (const [key, refs] of Object.entries(grouped)) {
    console.log(`  ${key}`);
    for (const r of refs.slice(0, 3)) {
      console.log(`    ${r.kind.padEnd(8)} ${r.file}:${r.line}`);
    }
    if (refs.length > 3) console.log(`    + ${refs.length - 3} more`);
  }
}

// Output a per-table summary too
console.log('\n--- per-table column counts ---');
for (const [name, cols] of Object.entries(tables)) {
  console.log(`  ${name}: ${cols.size} cols`);
}
