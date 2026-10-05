# Project instructions

- Keep infrastructure separate from business features. Current user-authorized scope is event-centric: editable event details and finances, mapped Drive documents by income/expense, media and permits, PDF previews, creation of new events with their Drive folder structure, One.com CSV orders and basic finance analytics. Check-in is a placeholder. Tasks and AI are not in current focus. Preserve existing records and mappings; never describe a scaffold as a finished integration.
- For all future Google Drive operations in this project, use only lightsignal.dj@gmail.com. Verify the connected identity before accessing Drive. If it cannot be verified, do not access Drive.
- Run npm run lint, npm run typecheck, npm run test, and npm run build after relevant changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
