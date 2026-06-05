# Git & GitHub CLI Knowledge

Learnings, gotchas, and best practices discovered while working with Git and GitHub CLI (`gh`).

---

## [2026-06-05] cmd `&` Menjalankan Perintah sebagai Background Process Terpisah

**Type:** Gotcha
**Context:** Menjalankan `git add` diikuti `git status` dalam satu baris menggunakan separator `&` di cmd Windows.

**Problem:**
Di cmd Windows, `&` memisahkan dua perintah tapi keduanya berjalan secara paralel (background), bukan sekuensial. Akibatnya `git status` bisa berjalan sebelum `git add` selesai, sehingga output status tidak mencerminkan hasil add. Terlihat dari output `[1]` dan `[2]` yang menunjukkan background job.

**Solution / Lesson:**
Gunakan PowerShell dengan `;` sebagai separator untuk menjalankan perintah secara sekuensial:
```powershell
Set-Location "path\to\repo"; git add .; git status
```
Atau jalankan setiap perintah dalam panggilan `execute_pwsh` terpisah.

**Avoid:**
Jangan gunakan `cmd /c "cmd1 & cmd2"` untuk operasi git yang harus sekuensial — gunakan PowerShell dengan `;`.

---

## [2026-06-05] git push Ditolak Jika Remote Ada Commit Lebih Baru

**Type:** Learning
**Context:** Push ke branch `dev/fadil` setelah commit lokal, tapi remote sudah ada commit baru yang belum di-pull.

**Problem:**
`git push` ditolak dengan error `rejected (fetch first)` karena remote branch memiliki commit yang tidak ada di lokal. Ini terjadi ketika ada perubahan langsung di GitHub (misalnya edit via web UI atau push dari device lain).

**Solution / Lesson:**
Jalankan `git pull --rebase origin <branch>` sebelum push. Rebase lebih bersih daripada merge karena tidak membuat extra merge commit:
```bash
git pull --rebase origin dev/fadil
git push -u origin dev/fadil
```

**Avoid:**
Jangan gunakan `git push --force` untuk mengatasi rejected push kecuali memang disengaja overwrite remote — selalu pull/rebase dulu.

---

## [2026-06-05] gh issue create dengan --body-file untuk Isi dari File Markdown

**Type:** Best Practice
**Context:** Membuat GitHub Issue dengan konten dari file `issue.md` yang sudah ada di repo.

**Solution / Lesson:**
Gunakan flag `--body-file` untuk membaca body issue langsung dari file markdown:
```bash
gh issue create --title "judul issue" --body-file issue.md --repo owner/repo
```
Lebih praktis dan aman daripada meng-escape konten panjang di command line. Output akan menampilkan URL issue yang baru dibuat.
