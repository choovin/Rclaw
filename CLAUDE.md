# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClawX is a desktop application that provides a graphical interface for OpenClaw AI agents. Built with Electron 40+, React 19, and TypeScript.

## Architecture

Dual-process architecture:
- **Electron Main Process**: Window management, gateway process supervision, system integration (tray, notifications, auto-update)
- **React Renderer Process**: UI components, Zustand state management, talks to main process via IPC
- **OpenClaw Gateway**: AI agent runtime, runs as separate process managed by main

Communication: Renderer → Main (IPC) → Gateway (WS/HTTP)

## Common Commands

```bash
# Development
pnpm run init       # Install dependencies + download uv
pnpm dev            # Start with hot reload

# Quality
pnpm lint           # Run ESLint
pnpm typecheck      # TypeScript validation
pnpm test           # Run unit tests

# Build & Package
pnpm run build:vite # Build frontend only
pnpm build          # Full production build
pnpm package:win    # Package for Windows
```

## Key Directories

- `electron/main/` - Electron main process entry
- `electron/gateway/` - OpenClaw Gateway process manager
- `electron/api/` - Main-side API routes and handlers
- `src/` - React renderer (pages, components, stores)
- `scripts/` - Build and utility scripts

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /retro, /investigate, /document-release, /codex, /cso, /autoplan, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade