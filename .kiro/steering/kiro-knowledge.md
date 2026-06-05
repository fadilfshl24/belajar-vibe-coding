# Kiro Knowledge

Learnings, gotchas, and best practices discovered while working with Kiro IDE and FKS artifacts.

---

## [2026-06-05] FKS install_steering workspace_path untuk global install menghasilkan double `.kiro` path

**Type:** Gotcha
**Context:** Mencoba install FKS steering artifact ke level global (user-level) menggunakan `mcp_fks_mcp_server_fks_install_steering` dengan `workspace_path` di-set ke `c:\Users\{user}\.kiro`

**Problem:**
Saat `workspace_path` di-set ke `c:\Users\{user}\.kiro`, tool FKS menambahkan `.kiro/steering/` di dalamnya sehingga file ter-install di path double: `c:\Users\{user}\.kiro\.kiro\steering\{file}.md` — bukan di `c:\Users\{user}\.kiro\steering\{file}.md` yang merupakan lokasi global steering yang benar.

**Solution / Lesson:**
Untuk install global steering, `workspace_path` harus di-set ke folder **parent** dari `.kiro`, yaitu home directory user: `c:\Users\{user}` (bukan `c:\Users\{user}\.kiro`). FKS tool akan otomatis menambahkan `.kiro/steering/` ke path tersebut.

Setelah install dengan path yang salah, file harus dipindahkan manual:
```cmd
move "C:\Users\{user}\.kiro\.kiro\steering\{file}.md" "C:\Users\{user}\.kiro\steering\{file}.md"
```

**Avoid:**
Jangan gunakan `~/.kiro` atau `C:\Users\{user}\.kiro` sebagai `workspace_path` — gunakan `C:\Users\{user}` (home directory langsung).
