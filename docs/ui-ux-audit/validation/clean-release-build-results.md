# Clean release worktree validation

Validated application/evidence commit: `a2661a0` in a clean detached worktree at `/tmp/cloud-core-member-ui-release.a2661a0`.

| Gate | Result |
| --- | --- |
| Git state before/after validation | Clean |
| `bun install --frozen-lockfile` | Passed; 606 packages installed from lockfile |
| `bun test tests/unit tests/integration` | 1,213 pass, 6 documented DB skips, 0 fail; 14,578 expectations |
| `bun run lint` | Passed, 0 errors; existing warnings only |
| `bun run build` | Passed |
| TypeScript | Nonzero, 70 pre-existing diagnostics; diagnostic header set identical to before/after evidence; no changed-file diagnostic |
| Client bundle QA-leak scan | No fixture email, `.env.qa.local`, service-role identifier, axe, or manual/release harness marker |
| Local credentials | No `.env.qa.local` was copied to the release worktree |

The documentation-inclusive final SHA `371244aee580e56dafd97f5ca6c150c992e767bf` was checked out in the same detached worktree and the frozen install, full 1,213-test suite, lint, build, TypeScript diagnostic-set comparison, and bundle leak scan were repeated successfully. Its deployment identity is recorded in `member-ui-ux-deployment-result.md`.
