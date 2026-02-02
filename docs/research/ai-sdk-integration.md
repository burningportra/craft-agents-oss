# Research: Vercel AI SDK for Intelligent Planning Layer

> **Status:** Research Complete  
> **Date:** 2026-02-01  
> **Source:** https://ai-sdk.dev/docs/introduction

## Summary

The Vercel AI SDK is highly relevant for our intelligent planning layer. It provides:

1. **AI SDK Core** - Unified API for text generation, tool calls, and agents
2. **AI SDK UI** - Framework-agnostic hooks for chat interfaces (React supported)

## Key Features for Our Use Case

### useChat Hook

```javascript
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
});
```

**Benefits:**
- Message streaming in real-time
- Managed states for input, messages, loading, errors
- Easy integration with any UI design

### ToolLoopAgent Class

```javascript
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

const planningAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  tools: {
    scanCodebase: tool({
      description: 'Scan the codebase for structure and patterns',
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => {
        // Scan implementation
      },
    }),
  },
});
```

**Benefits:**
- LLMs use tools in a loop to accomplish tasks
- Automatic context management
- Configurable stopping conditions

### Three Types of Tools

| Type | Description | Our Use |
|------|-------------|---------|
| Server-side auto | Executed server-side automatically | Codebase scanning |
| Client-side auto | Executed client-side via `onToolCall` | File tree updates |
| User interaction | Require confirmation dialogs | Destructive actions |

### DirectChatTransport

```javascript
import { DirectChatTransport, ToolLoopAgent } from 'ai';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  instructions: 'You are a planning assistant.',
});

const { messages, sendMessage, status } = useChat({
  transport: new DirectChatTransport({ agent }),
});
```

**Benefits:**
- No HTTP required
- Direct agent communication
- Great for single-process applications

## Mapping to Our Features

| Our Feature | AI SDK Component |
|-------------|------------------|
| Brainstorm dialogue | `useChat` + streaming |
| Codebase scanning | `ToolLoopAgent` + tools |
| Research integration | Tools with web fetch |
| User confirmations | Tool approval flow |
| Session persistence | Message history |

## Recommended Architecture

```
┌─────────────────────────────────────────────────┐
│                    React UI                      │
│  (useChat hook + Wise Design System)            │
└────────────────────┬────────────────────────────┘
                     │
           DirectChatTransport
                     │
┌────────────────────▼────────────────────────────┐
│              Planning Agent                      │
│  (ToolLoopAgent with scanning, research tools)  │
└─────────────────────────────────────────────────┘
```

## Next Steps

1. **Install AI SDK** - `npm install ai @ai-sdk/react @ai-sdk/anthropic`
2. **Refactor App.jsx** - Replace mock scanning with `useChat`
3. **Create Planning Agent** - Build `ToolLoopAgent` with codebase tools
4. **Integrate Tools** - Add scanning, research, and relationship graph tools
5. **Test Integration** - Verify streaming and tool execution

## Provider Support

AI SDK supports multiple providers. We'd use Anthropic:

```javascript
import { anthropic } from '@ai-sdk/anthropic';

const model = anthropic("claude-sonnet-4-20250514");
```

## Questions to Resolve

1. **Next.js vs Vite** - AI SDK examples use Next.js. Should we migrate?
2. **Server Required?** - `DirectChatTransport` avoids HTTP, but API keys need server
3. **Session Storage** - Where to persist conversation history?

## Resources

- [AI SDK Docs](https://ai-sdk.dev/docs)
- [useChat Reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [ToolLoopAgent](https://ai-sdk.dev/docs/agents/overview)
- [GitHub Examples](https://github.com/vercel/ai/tree/main/examples)
