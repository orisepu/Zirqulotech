# Repository Guidelines

## Project Structure & Module Organization
- `tenant-frontend/` houses the Next.js app. Keep UI logic in `src/components`, data clients in `src/services`, and shared hooks/state under `src/hooks`. Static files live in `public/`.
- `tenants-backend/` contains the Django/Poetry workspace that packages `tenant_users` plus sample apps (for example `django_test_app`). Tests and fixtures reside in `tests/` and mirror the tenant scenarios.
- Top-level `_media`, `media`, and `_static` folders back uploaded assets; avoid committing large binaries and prefer referencing them through storage adapters.

## Build, Test, and Development Commands
- Frontend: `pnpm install` to sync deps, `pnpm dev` for the local server, `pnpm build` for production bundles, `pnpm lint`/`pnpm lint:fix` to enforce ESLint, and `pnpm typecheck` before shipping TypeScript changes.
- Backend: `poetry install` (or `pip install -r requirements.txt` if Poetry is unavailable) prepares the environment. Use `poetry run pytest` for the full suite with coverage, and `poetry run python manage.py check`/`poetry run python manage.py migrate` when touching Django apps.

## Coding Style & Naming Conventions
- Frontend uses TypeScript, React 19, and Material UI. Match the prevailing two-space indentation, prefer PascalCase for components, camelCase for hooks/utilities, and colocate styling choices with the component. ESLint is preconfigured (Next.js core rules plus TanStack Query) and tolerates underscore-prefixed unused vars.
- Backend code targets Python 3.9+. Format with Black (line length 88) and rely on Ruff + wemake-flake8 for linting; snake_case modules and descriptive fixture names keep the suite readable.

## Testing Guidelines
- Pytest discovers specs via `tests/` (see `tenants-backend/tests/test_tenants`). Reuse fixtures from `tests/fixtures` and mark multi-tenant cases explicitly; the default config enforces branch coverage and produces HTML/XML reports.
- Frontend currently has no automated UI suite; at minimum, run `pnpm lint` and `pnpm typecheck` before opening a PR. When adding tests, follow React Testing Library patterns under `src/__tests__` and mirror the folder being exercised.

## Commit & Pull Request Guidelines
- Git history favours Conventional Commit prefixes (`feat:`, `fix:`, etc.). Scope messages by feature or module (e.g., `feat: add tenant impersonation audit`). Keep bodies under 72 chars per line and mention related ticket IDs.
- PRs should describe the change, outline manual QA (commands run, screenshots for UI), and link tenant-specific issues. Request review from both frontend and backend owners when a change spans directories, and wait for green lint/test checks before merging.
