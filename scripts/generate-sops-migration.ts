/**
 * Generates migrations/0006_update_sops_v2.sql from the v2 source file.
 * Run: npx tsx scripts/generate-sops-migration.ts
 * Output: scripts/proposed_0006_update_sops_v2.sql  (review before moving to migrations/)
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Category map: v2 title → category
// ---------------------------------------------------------------------------
const CATEGORY_MAP: Record<string, string> = {
  'PU (Polyurethane) Polish Application':           'Polishing & Finishing',
  'Veneer Application on Plywood':                  'Carpentry & Joinery',
  'Wall Surface Preparation Before Painting':       'Painting',
  'Waterproofing in Wet Areas':                     'Civil & Masonry',
  'Marble & Natural Stone Installation':            'Civil & Masonry',
  'Concealed Electrical Wiring Installation':       'Electrical',
  'Air Conditioning Indoor Unit Installation':      'HVAC',
  'Sanitary Fixture Installation':                  'Plumbing & Sanitary',
  'Aluminium Window & Door Installation':           'Glass & Aluminium',
  'Sofa & Upholstery Manufacturing Standards':      'Soft Furnishings',
  'Plywood Selection & Grading':                    'Carpentry & Joinery',
  'Cabinet Carcass Construction':                   'Carpentry & Joinery',
  'Melamine Polish Application':                    'Polishing & Finishing',
  'Veneer Polish Finishing':                        'Polishing & Finishing',
  'Emulsion Paint Application':                     'Painting',
  'Enamel Paint on Wood & Metal':                   'Painting',
  'Plaster of Paris False Ceiling':                 'Civil & Masonry',
  'Floor Tile Laying':                              'Civil & Masonry',
  'CPVC Pipe Installation':                         'Plumbing & Sanitary',
  'Toughened Glass Installation':                   'Glass & Aluminium',
  'Drawing Issue & Revision Control':               'Studio Operations',
  'Switch & Socket Installation':                   'Electrical',
  'Curtain & Drape Installation':                   'Soft Furnishings',
  'Site Cleanliness & Safety':                      'Studio Operations',
  'Project Handover':                               'Studio Operations',
};

// ---------------------------------------------------------------------------
// Titles that exist in both old DB and v2 (UPDATE by old title)
// Key = old title in production DB, value = new v2 title (same for exact matches)
// ---------------------------------------------------------------------------
const UPDATE_TITLE_MAP: Record<string, string> = {
  // title unchanged — just UPDATE content + category
  'Veneer Application on Plywood':                  'Veneer Application on Plywood',
  'Wall Surface Preparation Before Painting':       'Wall Surface Preparation Before Painting',
  'Waterproofing in Wet Areas':                     'Waterproofing in Wet Areas',
  'Sanitary Fixture Installation':                  'Sanitary Fixture Installation',
  'Aluminium Window & Door Installation':           'Aluminium Window & Door Installation',
  'Toughened Glass Installation':                   'Toughened Glass Installation',
  'Emulsion Paint Application':                     'Emulsion Paint Application',
  'Enamel Paint on Wood & Metal':                   'Enamel Paint on Wood & Metal',
  'Plywood Selection & Grading':                    'Plywood Selection & Grading',
  'Cabinet Carcass Construction':                   'Cabinet Carcass Construction',
  'Melamine Polish Application':                    'Melamine Polish Application',
  'Veneer Polish Finishing':                        'Veneer Polish Finishing',
  'Switch & Socket Installation':                   'Switch & Socket Installation',
  'Curtain & Drape Installation':                   'Curtain & Drape Installation',
  'Drawing Issue & Revision Control':               'Drawing Issue & Revision Control',
  'Site Cleanliness & Safety':                      'Site Cleanliness & Safety',
};

// Titles to DELETE from production (replaced by different v2 titles)
const DELETE_TITLES = [
  'AC Indoor Unit Installation',
  'CPVC & UPVC Pipe Installation',
  'Concealed Wiring Installation',
  'Marble & Stone Installation',
  'PU Polish (Polyurethane) Application',
  'Plaster of Paris (POP) False Ceiling',
  'Project Handover Checklist',
  'Sofa Upholstery Standards',
  'Tile Laying - Floor',
];

// New titles to INSERT (not present in production under any old name)
const INSERT_TITLES = [
  'PU (Polyurethane) Polish Application',
  'Marble & Natural Stone Installation',
  'Concealed Electrical Wiring Installation',
  'Air Conditioning Indoor Unit Installation',
  'Sofa & Upholstery Manufacturing Standards',
  'Plaster of Paris False Ceiling',
  'Floor Tile Laying',
  'CPVC Pipe Installation',
  'Project Handover',
];

const CREATED_BY = '46833846';

// ---------------------------------------------------------------------------
// Parse the v2 markdown file into a map of title → { content, description }
// ---------------------------------------------------------------------------
function parseV2File(filePath: string): Map<string, { content: string; description: string }> {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const result = new Map<string, { content: string; description: string }>();

  // Split on ## SOP N — headings
  const sopRegex = /^## SOP \d+ — (.+)$/gm;
  const matches = [...raw.matchAll(sopRegex)];

  for (let i = 0; i < matches.length; i++) {
    const title = matches[i][1].trim();
    const startIdx = (matches[i].index ?? 0) + matches[i][0].length;
    const endIdx = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;

    let content = raw.slice(startIdx, endIdx).trim();
    // Remove trailing "---" separator and tier headings
    content = content.replace(/\n---\s*\n?$/g, '').replace(/\n# TIER \d+ —.*$/gm, '').trim();

    // Extract description from the Purpose line
    // Looks for: **Purpose:** Some sentence here.
    const purposeMatch = content.match(/\*\*Purpose:\*\*\s*(.+?)(?:\n|$)/);
    let description = '';
    if (purposeMatch) {
      description = purposeMatch[1].trim();
      // Truncate to first sentence if very long
      const dotIdx = description.indexOf('.');
      if (dotIdx > 0 && dotIdx < 200) {
        description = description.slice(0, dotIdx + 1);
      } else if (description.length > 250) {
        description = description.slice(0, 250) + '...';
      }
    }

    result.set(title, { content, description });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Escape a string for use inside a PostgreSQL dollar-quoted string.
// Dollar-quoted strings need unique tags if the content could contain $$.
// We use per-SOP unique tags: $sop_N$ where N is an index.
// ---------------------------------------------------------------------------
function dollarTag(idx: number): string {
  return `$sop${idx}$`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const v2Path = path.resolve('attached_assets/sops_v2_1779473180866.md');
  const sopMap = parseV2File(v2Path);

  // Verify we found all 25
  console.log(`Parsed ${sopMap.size} SOPs from v2 file.`);
  const allTitles = [...Object.keys(UPDATE_TITLE_MAP), ...INSERT_TITLES];
  for (const title of allTitles) {
    if (!sopMap.has(title)) {
      console.error(`  MISSING v2 SOP: "${title}"`);
    }
  }

  const lines: string[] = [];

  lines.push(`-- Migration 0006: Update 25 SOPs to v2 deep-content versions`);
  lines.push(`-- Generated from: attached_assets/sops_v2_1779473180866.md`);
  lines.push(`-- Operations: 16 UPDATEs (title unchanged, content replaced),`);
  lines.push(`--             9 DELETEs (old title replaced by renamed v2 title),`);
  lines.push(`--             9 INSERTs (new v2 titles)`);
  lines.push(`-- Idempotent: UPDATE/DELETE are safe to re-run; INSERTs use WHERE NOT EXISTS.`);
  lines.push(`-- All within a single transaction — full rollback on any error.`);
  lines.push(``);
  lines.push(`BEGIN;`);
  lines.push(``);

  // -------------------------------------------------------------------------
  // 1. DELETE old titles (9 rows)
  // -------------------------------------------------------------------------
  lines.push(`-- Step 1: Delete 9 old titles replaced by v2 renames`);
  for (const title of DELETE_TITLES) {
    lines.push(`DELETE FROM sops WHERE title = '${title.replace(/'/g, "''")}';`);
  }
  lines.push(``);

  // -------------------------------------------------------------------------
  // 2. UPDATE 16 rows that keep the same title
  // -------------------------------------------------------------------------
  lines.push(`-- Step 2: Update 16 existing rows with v2 content`);
  let idx = 0;
  for (const [oldTitle, newTitle] of Object.entries(UPDATE_TITLE_MAP)) {
    const sop = sopMap.get(newTitle);
    if (!sop) {
      console.error(`  Cannot find v2 data for UPDATE title: "${newTitle}"`);
      continue;
    }
    const tag = dollarTag(idx++);
    const cat = CATEGORY_MAP[newTitle];
    const desc = sop.description.replace(/'/g, "''");
    lines.push(`UPDATE sops`);
    lines.push(`  SET category    = '${cat}',`);
    lines.push(`      description = '${desc}',`);
    lines.push(`      content     = ${tag}${sop.content}${tag},`);
    lines.push(`      updated_at  = NOW()`);
    lines.push(`  WHERE title = '${oldTitle.replace(/'/g, "''")}';`);
    lines.push(``);
  }

  // -------------------------------------------------------------------------
  // 3. INSERT 9 new rows (only if they don't already exist by title)
  // -------------------------------------------------------------------------
  lines.push(`-- Step 3: Insert 9 new v2 titles (idempotent: WHERE NOT EXISTS)`);
  for (const title of INSERT_TITLES) {
    const sop = sopMap.get(title);
    if (!sop) {
      console.error(`  Cannot find v2 data for INSERT title: "${title}"`);
      continue;
    }
    const tag = dollarTag(idx++);
    const cat = CATEGORY_MAP[title];
    const desc = sop.description.replace(/'/g, "''");
    lines.push(`INSERT INTO sops (id, title, category, description, content, created_by, org_id, created_at, updated_at)`);
    lines.push(`SELECT gen_random_uuid(),`);
    lines.push(`       '${title.replace(/'/g, "''")}',`);
    lines.push(`       '${cat}',`);
    lines.push(`       '${desc}',`);
    lines.push(`       ${tag}${sop.content}${tag},`);
    lines.push(`       '${CREATED_BY}',`);
    lines.push(`       NULL,`);
    lines.push(`       NOW(),`);
    lines.push(`       NOW()`);
    lines.push(`WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = '${title.replace(/'/g, "''")}');`);
    lines.push(``);
  }

  lines.push(`COMMIT;`);

  const sql = lines.join('\n');
  const outPath = path.resolve('scripts/proposed_0006_update_sops_v2.sql');
  fs.writeFileSync(outPath, sql, 'utf-8');

  console.log(`\nWrote ${sql.length.toLocaleString()} bytes to: ${outPath}`);
  console.log(`Line count: ${lines.length}`);
}

main();
