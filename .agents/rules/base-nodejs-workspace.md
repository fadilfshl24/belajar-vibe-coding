---
trigger: manual
---

Buatkan struktur folder hanya untuk project base berikut :
- NodeJs + ExpressJs
- NodeJs + ElysiaJs
- NodeJs + NestJs
- NodeJs + Hono
- NodeJs + AdonisJs

Library wajib yang digunakan yaitu :
- axios         # HTTP client buat bikin request ke API/service lain
- bcrypt        # Library buat hashing password
- cors          # Middleware Express buat ngatur Cross-Origin Resource Sharing kontrol domain mana aja yang boleh akses API kamu dari browser
- dotenv        # Load environment variable dari file .env ke process.env
- drizzle-kit   # CLI tool pasangan drizzle-orm — buat generate migration file dari schema TypeScript
- drizzle-orm   # ORM TypeScript-first, lightweight, query-builder
- jsonwebtoken  # Generate & verify JWT (JSON Web Token) dipakai buat autentikasi stateless.
- multer        # Middleware Express buat handle file upload
- nodemailer    # Library buat kirim email dari support SMTP atau service kayak Mailgun
- nodemon       # Dev-tool yang auto-restart server tiap kali ada perubahan file jadi nggak perlu manual stop-start server pas development
- pg            # Driver resmi PostgreSQL buat koneksi low-level ke database Postgres
- socket.io     # Library buat komunikasi real-time bidirectional antara server-client lewat WebSocket
- zod           # Library schema validation & type inference buat define schema sekali
- pino          # Logger performa tinggi, output-nya JSON structured log cocok banget buat masuk ke stack logging kayak Loki/Elasticsearch

Buatkan untuk struktur foldernya itu modular monolit dan untuk bahasa pemrogramannya dibuat dengan typescript pastikan untuk penamaan variabel atau tipe data tidak ada yang any. Untuk struktur standarisasinya yaitu sebagai berikut :

public :
    - assets
src :
    - core
    - utility
    - config
         - multer.ts
         - postgres.ts
         - contabo-s3.ts
         - mailSender.ts
         - rabbitmq.ts
         - redis.ts
         - socket.ts
    - modules
         - [modules_name]
              - [module_name].types.ts
              - [module_name].controllers.ts
              - [module_name].dtos.ts
              - [module_name].models.ts
              - [module_name].routes.ts
              - [module_name].schemas.ts
              - [module_name].validations.ts
    - utils
           # Tergantung kebutuhan utilitynya jika dia berfungsi untuk mapping data dari thirdparty maka Handler, jika convert kode atau convert response maka Helper.
         - handler
               - [module_name]Handler.ts
         - helper
               - [module_name]Helper.ts
    - app.ts
    - index.ts
package.json
Dockerfile
docker-compose.yaml
drizzle.config.ts