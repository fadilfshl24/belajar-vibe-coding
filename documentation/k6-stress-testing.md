# 📈 Panduan Stress Testing (Load Testing) dengan K6

Dokumen ini menjelaskan cara menggunakan alat bantu **K6** untuk melakukan pengujian kinerja (stress test / load test) pada endpoint API sistem. Pengujian ini bertujuan memastikan bahwa server dapat melayani banyak koneksi secara bersamaan dengan performa dan latency yang wajar.

Semua script pengujian tersedia di dalam folder `/stresstest`.

---

## 📋 Prasyarat

### 1. Install K6

Anda harus menginstal K6 terlebih dahulu di komputer Anda. K6 merupakan tool open-source buatan Grafana.
- **Windows (menggunakan Winget atau Chocolatey):**
  ```bash
  winget install k6
  # atau
  choco install k6
  ```
- **MacOS (menggunakan Homebrew):**
  ```bash
  brew install k6
  ```
- **Download Langsung:**
  Kunjungi [https://k6.io/docs/get-started/installation/](https://k6.io/docs/get-started/installation/)

### 2. Siapkan Server Lokal & Database

Pastikan server berjalan dan database telah tersedia (migration dan seed selesai dijalankan).
```bash
# Jalankan server API di port 3000
bun run dev
```

> K6 akan menembak langsung ke `http://localhost:3000/api`. Jika URL atau port berbeda, Anda bisa mengaturnya menggunakan environment variable saat menjalankan K6.

---

## 🚀 Cara Menjalankan Stress Test

Buka terminal dan navigasikan ke root folder project (sejajar dengan package.json), lalu eksekusi script dengan `k6 run`.

### 1. Test Endpoint Auth
Menguji kecepatan response saat simulasi banyak user yang melakukan login secara bersamaan.
```bash
k6 run stresstest/auth.js
```

### 2. Test Endpoint Warehouse
Menguji list warehouse, pencarian, dan pagination. 
```bash
k6 run stresstest/warehouse.js
```

### 3. Test Endpoint Category
Menguji endpoint Category dengan load test moderat.
```bash
k6 run stresstest/category.js
```

### 4. Test Endpoint UOM
Menguji request yang relatif ringan (UOM table). Memiliki ekspektasi latency yang lebih ketat (<400ms).
```bash
k6 run stresstest/uom.js
```

### 5. Test Endpoint Item (Single & Package)
Ini adalah endpoint paling berat karena melakukan filtering berdasarkan enum dan join table jika data berupa *package*. Ekspektasi target latency diset agak longgar (<600ms).
```bash
k6 run stresstest/item.js
```

---

## 🛠 Mengatur Konfigurasi K6 (Custom Options)

### Mengubah Base URL
Jika server berada di host lain (misal production atau staging), kirimkan argumen `BASE_URL`:
```bash
k6 run -e BASE_URL=https://api.domainanda.com/api stresstest/item.js
```

### Mengesampingkan Durasi dan Target (VU)
Anda dapat mem-bypass opsi yang ada di dalam script dengan argumen CLI. Misalnya, untuk menguji batas maksimum 100 Virtual Users (VU) selama 30 detik:
```bash
k6 run --vus 100 --duration 30s stresstest/item.js
```

---

## 📊 Cara Membaca Output K6

Setelah K6 selesai berjalan, ia akan mencetak rangkuman di konsol. Berikut adalah bagian terpenting:

```text
    ✓ login status is 200
    ✓ login has access token

    checks.........................: 100.00% ✓ 2400      ✗ 0
    data_received..................: 1.5 MB  17 kB/s
    data_sent......................: 600 kB  6.8 kB/s
    http_req_duration..............: avg=45.3ms   min=10.2ms   med=42ms     max=350ms    p(90)=80ms     p(95)=120ms
      { expected_response:true }...: avg=45.3ms   min=10.2ms   med=42ms     max=350ms    p(90)=80ms     p(95)=120ms
    http_reqs......................: 2400    27.118983/s
```

### Poin Penting:
1. **`checks`**: Menampilkan persentase assertion yang sukses (ex. apakah status code = 200). Usahakan selalu 100%.
2. **`http_req_duration`**: Ini adalah latency/response time server Anda.
   - **avg**: Rata-rata response time.
   - **p(95)**: Persentil ke-95. Artinya 95% request selesai di bawah waktu ini. (Standar industri sering berpatokan pada p95 atau p99). Jika threshold terlampaui, baris ini akan berwarna merah dan ditandai gagal (`✗`).
3. **`http_req_failed`**: Rasio kegagalan HTTP request (kode 4xx atau 5xx). Targetnya harus di bawah toleransi (contoh `<0.01` atau kurang dari 1%).
4. **`http_reqs`**: Jumlah total request yang ditembakkan.

### Threshold Gagal
Jika Anda melihat tulisan merah:
```text
✗ thresholds on http_req_duration (p(95)<500) have been crossed
```
Artinya 95% response dari server butuh waktu *lebih lama* dari 500ms, sehingga server mulai kepayahan (bottleneck) di jumlah traffic tersebut. Pertimbangkan untuk mengecek ulang query DB (indexing) atau meningkatkan spec hardware jika hal ini terjadi.
