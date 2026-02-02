# Claude Code Tips from Boris Cherny (Creator)

> **Source:** @bcherny Twitter thread (2026-01-31)  
> **Engagement:** 36K+ likes, 74K+ bookmarks

## The Tips

### 1. Do More in Parallel
- Spin up 3-5 git worktrees, each with its own Claude session
- **Single biggest productivity unlock**
- Shell aliases (za, zb, zc) for one-keystroke switching
- Dedicated "analysis" worktree for logs/BigQuery

### 2. Start Complex Tasks in Plan Mode
- Pour energy into the plan → Claude 1-shots implementation
- Have second Claude review plan as "staff engineer"
- **Moment something goes sideways → switch back to plan mode**
- Use plan mode for verification steps too, not just builds

### 3. Invest in Your CLAUDE.md
- After every correction: "Update your CLAUDE.md so you don't make that mistake again"
- **Claude is eerily good at writing rules for itself**
- Ruthlessly edit over time

### 4. Create Your Own Skills
- If you do something more than once a day → skill or command
- `/techdebt` slash command at end of every session
- Auto-generate unit tests skill
- Keep a "debugging" skill for when things go sideways
- Commit to git for version control

### 5. Claude Fixes Most Bugs by Itself
- Slack MCP → paste bug thread → "fix"
- "Go fix the failing CI tests" - don't micromanage
- Point at docker logs for prod issues
- Screenshot error messages, paste in chat
- For hard bugs: interactive mode with pdb

### 6. Level Up Your Prompting
- Challenge Claude: "Grill me on these changes"
- "Prove to me this works" - diff main vs feature branch
- After mediocre response: "Try that again, you can do better"
- **Don't settle**

### 7. Terminal & Environment Setup
- Team loves Ghostty (synchronized rendering, 24-bit color)
- `/statusline` for context usage + git branch
- Worktree and model name in prompt

### 8. Regular Codebase Cleanups
- Cleanup pass at start of every day
- Or: .git/hooks/pre-commit
- "Find dead code, duplicated logic, unused imports and clean up"

### 9. MCP Server for Your Tools
- Linear, Jira, whatever
- "Write an e2e test for LINEAR-123"
- "Close this ticket, create new one for tech debt"

### 10. Be Opinionated in Prompts
- "Performance matters more than elegance"
- "Write tests first, then implementation"
- "Be terse. I read code faster than prose"
- Add preferences to CLAUDE.md

---

## Mapping to Our System

| Boris Tip | FloatPrompt Equivalent |
|-----------|----------------------|
| Invest in CLAUDE.md | `agents.md` as Intent Node |
| Plan mode first | Opening State → Brainstorm → Handoff |
| Skills & commands | `.float/skills/`, `/float-*` commands |
| "Fix the failing CI" | MCPs for issue tracking |
| Regular cleanups | `/float-log` extracting tech debt |
| Parallel worktrees | Multiple `float.db` sessions |
| Don't settle | Iterative brainstorm rhythm |

## Key Insights for Our UI

### Plan Mode First
> "The moment something goes sideways, switch back to plan mode"

This validates our Opening State → Plan → Execute flow. Users should be able to **re-enter planning** at any time.

### Self-Updating Rules
> "Claude is eerily good at writing rules for itself"

Our Review → Compound phase should **auto-update agents.md** with new learnings. Don't just store in DB - update the Intent Node!

### Skills as First-Class Citizens
> "If you do something more than once a day, turn it into a skill"

`.float/skills/` should be surfaced in UI, auto-suggested based on context.

### Don't Settle
> "Try that again, you can do better"

Brainstorm phase should make it **easy to push back** without starting over.

## Changes to Implement

1. **Add "back to planning" escape hatch** in every phase
2. **Auto-update agents.md** during `/float-log`
3. **Surface skills** in Opening State
4. **"Try again" button** in brainstorm
5. **Cleanup mode** (`/float cleanup`)
