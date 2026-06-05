# Shell Command Safety Rules

## Prevent Multi-line Input Mode (> prompt hang)

When running shell commands, NEVER use syntax that triggers multi-line/continuation mode in Git Bash, Zsh, or PowerShell. The `>` prompt (or `>>` in PowerShell) means the shell is waiting for more input — this causes the command to hang indefinitely.

### Rules to prevent hanging:

1. **Never use heredoc syntax** (`<<`, `<<'EOF'`, `<< EOF`) — always use `fs_write` tool to create files instead.

2. **Never use unclosed quotes or brackets** in shell commands. Always verify quotes are balanced before running.

3. **Never use backslash line continuation** (`\` at end of line in Bash/Zsh, or backtick `` ` `` in PowerShell) in multi-line shell commands — put everything on one line or use a script file.

4. **Never use a trailing backslash inside quoted paths** in Git Bash or Zsh — it escapes the closing quote and causes a hang. Use forward slashes without a trailing slash: `ls "/path/to/dir"`.

5. **For file creation**, always use the `fs_write` tool — never `cat`, `echo`, or `tee` with redirection for multi-line content.

6. **For directory listing**:
   - Git Bash / Zsh: `ls -la /path/to/dir`
   - PowerShell: `Get-ChildItem /path/to/dir`

7. **Test commands mentally** for unclosed delimiters before executing.

---

## Examples

### Git Bash / Zsh

```bash
# ❌ BAD — heredoc causes > hang
cat << 'EOF'
content
EOF

# ✅ GOOD — use fs_write tool instead

# ❌ BAD — trailing backslash inside quotes causes hang
ls "/home/user/project\"

# ✅ GOOD — forward slashes, no trailing slash
ls -la "/home/user/project"

# ❌ BAD — unclosed quote hangs the shell
echo "hello

# ✅ GOOD — balanced quotes
echo "hello"

# ❌ BAD — backslash line continuation can cause issues
ls -la /some/path \
  --option

# ✅ GOOD — single line
ls -la /some/path --option
```

### PowerShell

```powershell
# ❌ BAD — backtick line continuation can cause hang if misplaced
Get-ChildItem C:\Users\project `
  -Recurse

# ✅ GOOD — single line
Get-ChildItem C:\Users\project -Recurse

# ❌ BAD — unclosed string literal
Write-Host "hello

# ✅ GOOD — balanced quotes
Write-Host "hello"

# ❌ BAD — trailing backslash in path string
Get-ChildItem "C:\Users\project\"

# ✅ GOOD — no trailing backslash
Get-ChildItem "C:\Users\project"
```
