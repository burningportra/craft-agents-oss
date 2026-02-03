/**
 * Learnings extraction and storage.
 *
 * After each completed turn, extracts key decisions and patterns from the
 * conversation and appends them to a workspace-scoped learnings file.
 * The learnings are then injected into the system prompt for future turns.
 */

import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { debug } from '../utils/debug.ts';

/** Max learnings file size before truncation (8KB) */
const MAX_LEARNINGS_SIZE = 8 * 1024;

/** Max number of learnings entries to keep */
const MAX_LEARNINGS_ENTRIES = 50;

/**
 * Get the path to the workspace learnings file.
 */
export function getLearningsPath(workspaceRootPath: string): string {
  return join(workspaceRootPath, 'learnings.md');
}

/**
 * Read existing learnings from the workspace file.
 * Returns empty string if file doesn't exist.
 */
export function readLearnings(workspaceRootPath: string): string {
  const path = getLearningsPath(workspaceRootPath);
  try {
    if (!existsSync(path)) return '';
    const content = readFileSync(path, 'utf-8');
    // Enforce max size — if file is too large, return last portion
    if (content.length > MAX_LEARNINGS_SIZE) {
      const lines = content.split('\n');
      // Keep the header + last N entries
      const header = lines[0] || '# Learnings';
      const entries: string[] = [];
      let current: string[] = [];
      for (const line of lines.slice(1)) {
        if (line.startsWith('- ') && current.length > 0) {
          entries.push(current.join('\n'));
          current = [line];
        } else {
          current.push(line);
        }
      }
      if (current.length > 0) entries.push(current.join('\n'));
      const kept = entries.slice(-MAX_LEARNINGS_ENTRIES);
      return header + '\n' + kept.join('\n');
    }
    return content;
  } catch (error) {
    debug('[learnings] Failed to read learnings:', error);
    return '';
  }
}

/**
 * Append new learnings to the workspace file.
 * Each learning is a bullet point with a timestamp.
 */
export function appendLearnings(workspaceRootPath: string, entries: string[]): void {
  if (entries.length === 0) return;

  const path = getLearningsPath(workspaceRootPath);
  try {
    // Create file with header if it doesn't exist
    if (!existsSync(path)) {
      writeFileSync(path, '# Learnings\n\n', 'utf-8');
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const formatted = entries.map(e => `- [${timestamp}] ${e}`).join('\n') + '\n';
    appendFileSync(path, formatted, 'utf-8');
    debug(`[learnings] Appended ${entries.length} learnings`);
  } catch (error) {
    debug('[learnings] Failed to append learnings:', error);
  }
}

/**
 * Distill raw learnings into structured AGENTS.md sections.
 *
 * Groups learnings by type (files modified, fixes, patterns) and
 * formats them as markdown sections suitable for AGENTS.md.
 * Returns empty string if no meaningful learnings to distill.
 */
export function distillLearnings(workspaceRootPath: string): string {
  const raw = readLearnings(workspaceRootPath);
  if (!raw || raw.trim() === '# Learnings') return '';

  const lines = raw.split('\n').filter(l => l.startsWith('- '));
  if (lines.length === 0) return '';

  const fixes: string[] = [];
  const decisions: string[] = [];
  const risks: string[] = [];
  const fileGroups = new Map<string, number>();

  for (const line of lines) {
    // Strip timestamp prefix: "- [2026-02-01] "
    const content = line.replace(/^- \[\d{4}-\d{2}-\d{2}\]\s*/, '');

    if (content.startsWith('Fixed:')) {
      fixes.push(content.replace('Fixed: ', '').trim());
    } else if (content.startsWith('Decision')) {
      decisions.push(content);
    } else if (content.startsWith('Risk')) {
      risks.push(content);
    } else if (content.startsWith('Modified files:')) {
      const files = content.replace('Modified files: ', '').split(', ');
      for (const f of files) {
        fileGroups.set(f.trim(), (fileGroups.get(f.trim()) || 0) + 1);
      }
    } else if (content.startsWith('Scope:')) {
      // Extract file path from "Scope: path — reason"
      const scopeMatch = content.match(/^Scope:\s*(.+?)\s*—/);
      if (scopeMatch && scopeMatch[1]) {
        const file = scopeMatch[1].trim();
        fileGroups.set(file, (fileGroups.get(file) || 0) + 1);
      }
    }
  }

  const sections: string[] = [];

  // Hot files — frequently modified
  const hotFiles = [...fileGroups.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (hotFiles.length > 0) {
    sections.push('### Frequently Modified Files\n' +
      hotFiles.map(([f, c]) => `- \`${f}\` (${c}x)`).join('\n'));
  }

  // Fixes as gotchas
  if (fixes.length > 0) {
    const unique = [...new Set(fixes)].slice(0, 10);
    sections.push('### Gotchas & Fixes\n' +
      unique.map(f => `- ${f}`).join('\n'));
  }

  // Key decisions
  if (decisions.length > 0) {
    const unique = [...new Set(decisions)].slice(0, 10);
    sections.push('### Key Decisions\n' +
      unique.map(d => `- ${d}`).join('\n'));
  }

  // Known risks
  if (risks.length > 0) {
    const unique = [...new Set(risks)].slice(0, 10);
    sections.push('### Known Risks\n' +
      unique.map(r => `- ${r}`).join('\n'));
  }

  return sections.join('\n\n');
}

/**
 * Extract learnings from a completed conversation.
 *
 * Looks at the last assistant message for decisions, patterns, or
 * notable outcomes. Returns bullet-point strings to append.
 *
 * This is a heuristic extraction — not LLM-based — to keep it fast
 * and dependency-free. It extracts:
 * - Files that were modified (from tool results)
 * - Key decisions mentioned in assistant text
 * - Errors encountered and fixed
 */
/**
 * Extract learnings from handoff review payloads.
 * Converts decisions/files/risks into structured learning entries.
 */
export function extractLearningsFromHandoff(
  handoffPayload: {
    decisions?: Array<{ id: string; content: string; confidence: 'high' | 'medium' | 'low' }>;
    files?: Array<{ path: string; reason: string }>;
    risks?: Array<{ category: string; description: string; mitigation: string }>;
  }
): string[] {
  const learnings: string[] = [];

  // Extract high/medium confidence decisions (skip low confidence)
  for (const decision of handoffPayload.decisions || []) {
    if (decision.confidence !== 'low') {
      learnings.push(`Decision (${decision.confidence}): ${decision.content}`);
    }
  }

  // Extract file scopes with reasons
  for (const file of handoffPayload.files || []) {
    learnings.push(`Scope: ${file.path} — ${file.reason}`);
  }

  // Extract risks with mitigations
  for (const risk of handoffPayload.risks || []) {
    learnings.push(`Risk (${risk.category}): ${risk.mitigation}`);
  }

  return learnings;
}

export function extractLearningsFromMessages(messages: any[]): string[] {
  const learnings: string[] = [];

  if (messages.length === 0) return learnings;

  // Look at the last few messages for context
  const recent = messages.slice(-6);
  const filesModified = new Set<string>();
  const errorsFixed: string[] = [];

  // Debug: log message roles to understand structure
  debug(`[extractLearnings] Examining ${recent.length} messages:`, recent.map(m => ({ role: m.role, type: m.type, hasContent: !!m.content })));

  for (const msg of recent) {
    // Extract file paths from tool results (Edit, Write operations)
    // Messages have role: 'tool' for tool results
    if (msg.role === 'tool') {
      const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? '');
      // Match file paths from edit/write results
      const fileMatch = text.match(/(?:Updated|Created|Written to|Modified)\s+(.+?)(?:\s|$)/i);
      if (fileMatch) filesModified.add(fileMatch[1]);
    }

    // Extract from assistant messages
    if (msg.role === 'assistant') {
      const text = typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ')
          : '';

      // Look for error-fix patterns
      const errorMatch = text.match(/(?:fixed|resolved|the (?:issue|error|bug) was)\s+(.{10,80})/i);
      if (errorMatch) errorsFixed.push(errorMatch[1].trim());
    }
  }

  if (filesModified.size > 0) {
    learnings.push(`Modified files: ${[...filesModified].slice(0, 5).join(', ')}`);
  }

  for (const fix of errorsFixed.slice(0, 2)) {
    learnings.push(`Fixed: ${fix}`);
  }

  return learnings;
}
