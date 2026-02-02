# Craft Agents - Agent Context

This file provides context for AI agents working on this codebase.

## Project Overview

Craft Agent is a Claude Code-like desktop application (Electron) that helps users connect and work across their data sources. It's a monorepo with:
- **packages/core** - Core agent logic
- **packages/shared** - Shared types and utilities
- **apps/electron** - Electron desktop app
- **apps/viewer** - Viewer application
- **apps/marketing** - Marketing site

## Development Rules

### Package Management

**NEVER modify `package.json` directly.** Always use npm/bun commands:
- ✅ `npm install <package>` or `bun add <package>`
- ✅ `npm uninstall <package>` or `bun remove <package>`
- ✅ `npm version <version>` for version updates
- ❌ Direct edits to `package.json`

**Why:** Direct edits can cause lock file desync, missing transitive dependencies, and broken installations.

## Architecture Notes

This is a **monorepo** using npm/bun workspaces. When making changes:
- Check if changes belong in core, shared, or app-specific packages
- Consider subsystem-specific AGENTS.md files in subdirectories if needed
- Read `packages/core/CLAUDE.md` and `packages/shared/CLAUDE.md` for package-specific context
