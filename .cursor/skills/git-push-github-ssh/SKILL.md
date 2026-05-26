---
name: git-push-github-ssh
description: >-
  Push Echo to GitHub via SSH only (CMD, not Git Bash). Use when the user asks to
  upload, push, sync to GitHub, or publish commits to yth-pass/Echo.
---

# Git push to GitHub (SSH, Windows CMD)

## When to apply

- User asks to **push**, **upload**, **sync to GitHub**, or **publish** commits for this repo.
- After you create a **git commit** and the user wants it on remote.
- **Do not** use bare `git push origin main` over HTTPS from the agent shell (often fails or uses wrong SSH paths for Chinese Windows usernames).

## Prerequisites (user machine)

1. SSH key added at https://github.com/settings/keys
2. Recommended `%USERPROFILE%\.ssh\config` (port 443 if port 22 is blocked):

```text
Host github.com
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile C:/Users/天昊/.ssh/id_ed25519
  UserKnownHostsFile C:/Users/天昊/.ssh/known_hosts
```

Adjust `IdentityFile` if the key lives elsewhere.

## Canonical push workflow

Run from **CMD** (not Git Bash). Repo root:

```cmd
cd /d C:\Users\天昊\Desktop\Echo
ssh -T git@github.com
```

Wait until output contains **`Hi <username>! You've successfully authenticated`** (GitHub may still exit code 1; that is OK).

Then:

```cmd
git remote set-url origin git@github.com:yth-pass/Echo.git
git push origin main
```

## Preferred: project script

After commit, you may run one shot:

```cmd
cd /d C:\Users\天昊\Desktop\Echo
.cursor\scripts\git-push-echo.cmd
```

The script sets SSH remote and pushes `main`. It runs `ssh -T` first; read output before assuming push will work.

## Agent rules

1. **Commit** as usual (`git add`, `git commit`) when the user asks.
2. **Push** only via the workflow above or `git-push-echo.cmd` — never only `git push` over `https://github.com/...` from the agent.
3. Use **CMD** shell commands (`cd /d ...`), not PowerShell `&&` chains if they fail in the environment.
4. If push times out in the agent environment, tell the user to run `.cursor\scripts\git-push-echo.cmd` locally (network may block the agent).
5. Do **not** run `git push --force` to `main` unless the user explicitly requests it.

## Remote

| Item | Value |
|------|--------|
| Repository | `git@github.com:yth-pass/Echo.git` |
| Default branch | `main` |

## Related

- Hook `.cursor/hooks/git-push-github.py` blocks naive `git push` from the agent and reminds after `git commit`.
- [AGENTS.md](../../AGENTS.md) — project agent instructions.
