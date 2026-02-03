/**
 * Relationship graph storage for planning decisions, files, and risks.
 *
 * Stores decision→file and file→risk relationships extracted from handoff reviews
 * in a workspace-scoped JSON file. Used for context injection in future planning sessions.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { debug } from '../utils/debug.ts';

/**
 * Relationship types for decision/file/risk graph
 */
export type RelationshipType = 'decision_file' | 'file_risk' | 'decision_risk';

/**
 * Relationship entry linking decisions, files, and risks
 */
export interface Relationship {
  type: RelationshipType;
  source: string;       // Decision ID or file path
  target: string;       // File path or risk category
  label?: string;       // Optional relationship description
  sessionId: string;    // Session that created this relationship
  createdAt: string;    // ISO timestamp
}

/** Max relationships to keep (FIFO eviction) */
const MAX_RELATIONSHIPS = 500;

/**
 * Get the path to the workspace relationships file.
 */
export function getRelationshipsPath(workspaceRootPath: string): string {
  return join(workspaceRootPath, 'relationships.json');
}

/**
 * Read all relationships from workspace file.
 * Returns empty array if file doesn't exist.
 */
export function readRelationships(workspaceRootPath: string): Relationship[] {
  const path = getRelationshipsPath(workspaceRootPath);
  try {
    if (!existsSync(path)) return [];
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    debug('[relationships] Failed to read relationships:', error);
    return [];
  }
}

/**
 * Append new relationships to workspace file.
 * Enforces max size via FIFO eviction.
 */
export function appendRelationships(
  workspaceRootPath: string,
  newRelationships: Relationship[]
): void {
  if (newRelationships.length === 0) return;

  const path = getRelationshipsPath(workspaceRootPath);
  try {
    const existing = readRelationships(workspaceRootPath);
    const combined = [...existing, ...newRelationships];

    // Enforce max size (FIFO eviction)
    const kept = combined.slice(-MAX_RELATIONSHIPS);

    writeFileSync(path, JSON.stringify(kept, null, 2), 'utf-8');
    debug(`[relationships] Appended ${newRelationships.length} relationships (total: ${kept.length})`);
  } catch (error) {
    debug('[relationships] Failed to append relationships:', error);
  }
}

/**
 * Query relationships by filters.
 */
export function queryRelationships(
  workspaceRootPath: string,
  filters: { type?: RelationshipType; source?: string; target?: string }
): Relationship[] {
  const all = readRelationships(workspaceRootPath);
  return all.filter(rel => {
    if (filters.type && rel.type !== filters.type) return false;
    if (filters.source && rel.source !== filters.source) return false;
    if (filters.target && rel.target !== filters.target) return false;
    return true;
  });
}

/**
 * Extract relationships from handoff payload.
 * Creates decision→file and file→risk edges.
 */
export function extractRelationshipsFromHandoff(
  handoffPayload: {
    decisions?: Array<{ id: string; content: string; confidence: string }>;
    files?: Array<{ path: string; reason: string }>;
    risks?: Array<{ category: string; description: string }>;
  },
  sessionId: string
): Relationship[] {
  const relationships: Relationship[] = [];
  const timestamp = new Date().toISOString();

  const decisions = handoffPayload.decisions || [];
  const files = handoffPayload.files || [];
  const risks = handoffPayload.risks || [];

  // Create decision→file relationships
  for (const decision of decisions) {
    for (const file of files) {
      relationships.push({
        type: 'decision_file',
        source: decision.id,
        target: file.path,
        label: decision.content,
        sessionId,
        createdAt: timestamp,
      });
    }
  }

  // Create file→risk relationships
  for (const file of files) {
    for (const risk of risks) {
      relationships.push({
        type: 'file_risk',
        source: file.path,
        target: risk.category,
        label: risk.description,
        sessionId,
        createdAt: timestamp,
      });
    }
  }

  return relationships;
}
