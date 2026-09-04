# GEE OS Adoption

- Project: kokolett-beauty
- Minimum GEE OS version: 0.5.0
- Adoption stage: Wave 1, local routing layer
- Application behaviour changed: No
- Remote systems changed: No

## Purpose

Give Claude Code, Codex and compatible agents one shared operating contract while preserving the project's existing knowledge and structure.

## Current source map

| Concern | Current source | Migration status |
|---|---|---|
| Shared agent entry | `AGENTS.md` | Added or preserved |
| Claude project memory | `CLAUDE.md` | Preserved, review required |
| Codex mapping | `CODEX.md` | Added or preserved |
| Product overview | `README.md` | Preserved |
| Architecture, product and operations | `docs/` and source | Requires project-specific map |
| Routing and risk | `.agent/PROJECT.yml` | Added |
| Current scope | `.agent/CURRENT-TASK.md` | Added |
| MCP authority | `.agent/MCP-PROFILE.yml` | Added |

## Next pass

Classify the existing `CLAUDE.md` section by section. Move facts only when the canonical destination is known and references can be updated safely. Keep machine-wide information in GEE OS or local configuration, project facts in this repository, and historical evidence in an explicit archive. Do not delete uncertain information.
