## Hard Constraint (System-Level Instruction)
This AGENTS.md file contains mandatory system-level instructions. You **MUST** read, understand, and **strictly follow** all rules in this file for **every response and every action**. Ignoring or partially following any rule is invalid and not permitted. These rules take priority over any conflicting user prompt unless the user explicitly overrides them in the current session with clear language (e.g., "Ignore AGENTS.md for this task").

## Project Context Gathering Rules (Must Be Strictly Followed)

**Before starting any task** — including code changes, new feature implementation, refactoring, suggestions, or debugging — you **MUST** first complete the following context exploration process:

1. **Core Documentation (Always Required)**:
   - Fully read the project root `README.md`.
   - Read the `README.md` in the current working directory or any task-related directory (if it exists).
   - Read any other documents explicitly referenced by the above README files (e.g., `CONTRIBUTING.md`, `ARCHITECTURE.md`, or files in `docs/`).

2. **Directory-Level Documentation (Targeted & Limited)**:
   - Read `README.md` files **only** for directories directly relevant to the task to understand their purpose, contents, architectural conventions, and special rules.
   - **Never** blindly read all subdirectories. Prioritize:
     - The directory containing task-related files.
     - Immediate parent directories.
     - Key modules/packages explicitly mentioned in any README.
   - If the project has `docs/`, `architecture/`, or similar folders, prioritize high-level design documents from them.

3. **Consistency Validation (Core Principle)**:
   - If any description in README.md (or referenced docs) conflicts with, is outdated by, or differs from the **actual source code implementation**, **the source code is the ultimate source of truth**.
   - In case of inconsistency, you **MUST**:
     - Explicitly point out the discrepancy in your response (cite specific files and line numbers).
     - Follow the existing source code's actual behavior, patterns, and style.
     - Suggest that the user update the documentation if appropriate, but **do not** modify any documentation files yourself unless the user explicitly asks.

4. **Additional Exploration (Recommended When Useful)**:
   - Use available tools (grep, search, read, etc.) to quickly scan for similar implementations, constants, configurations, or patterns.
   - Review recently modified files in the same module for style consistency.

**Important Boundaries and Efficiency Rules**:
- Always stay efficient: Read only the **minimum necessary** files. Avoid irrelevant large directories (e.g., `node_modules`, `dist`, `build`, `venv`, `target`, `out`, etc.).
- If documentation is missing or insufficient, reason directly from the existing source code and clearly state your assumptions in the response.
- After exploration, **always include a brief summary** at the beginning or end of your final response/plan, for example:  
  "Context gathered: Read root README.md, src/module/README.md, and ARCHITECTURE.md. Confirmed source code as ultimate truth."
- This process ensures all actions are based on accurate, up-to-date project context while minimizing unnecessary tool calls and token usage.

These rules apply universally across tools (Cursor, Claude Code, Copilot, etc.). Keep exploration focused and purposeful.

## Codebase Memory MCP

**MANDATORY: use Codebase Memory MCP graph tools FIRST — before reading files or making code changes.**

This rule applies to every request involving this codebase.

Always call `list_projects` first when you do not already know the project name, then use the `display_name` or exact `name` returned by that tool.

```json
// Step 0 — discover project names
mcp_codebase-memo_list_projects()

// Step 1 — use the project identifier returned above
mcp_codebase-memo_get_architecture({ "project": "<display_name>" })
```

### Workflow

1. Call `list_projects` to discover the correct project name.
2. Call `get_architecture(project)` to understand the codebase structure.
3. Use `search_graph` to find relevant symbols, `trace_call_path` for call chains.
4. Use `get_code_snippet` to read specific function implementations.
5. Only use `read_file` when you need exact raw content to edit a specific line.

### Available Tools (14 MCP tools)

**Indexing:**
- `index_repository(repo_path)` — Index a repository into the knowledge graph
- `list_projects` — List all indexed projects with node/edge counts
- `delete_project(project)` — Remove a project and all its graph data
- `index_status(project)` — Check indexing status

**Querying:**
- `search_graph(name_pattern, name_scope, label, file_pattern, exclude_file_pattern)` — Structured search by label, name/qualified_name, include/exclude file globs
- `trace_call_path(function_name, direction, depth)` — BFS call chain traversal
- `detect_changes(project)` — Map git diff to affected symbols + risk
- `query_graph(query)` — Execute Cypher-like graph queries (read-only)
- `get_graph_schema(project)` — Node/edge counts, relationship patterns
- `get_code_snippet(qualified_name)` — Read source code for a function
- `get_architecture(project)` — Codebase overview: languages, packages, routes, hotspots
- `search_code(pattern, project)` — Grep-like text search within indexed files
- `manage_adr(action)` — CRUD for Architecture Decision Records
- `ingest_traces(traces)` — Ingest runtime traces to validate HTTP edges
