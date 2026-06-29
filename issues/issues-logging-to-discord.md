# Perencanaan Integrasi Logging Error Backend ke Discord Webhook

Dokumen ini berisi spesifikasi teknis untuk mengimplementasikan pencatatan error internal server (HTTP 500) di backend secara otomatis dan mengirimkannya ke channel Discord via Webhook.

---

## 1. Konfigurasi Environment Variable

Simpan URL webhook Discord berikut ke dalam file `.env` backend Anda dengan nama kunci `DISCORD_WEBHOOK_URL`. Jangan melakukan *hardcode* pada file kode untuk menjaga keamanan.

```env
DISCORD_WEBHOOK_URL=https://discordapp.com/api/webhooks/1521042585173626891/qLDG8XRDqTluJHox0AdiX2h2TDwdrdMtBEB3foLrB91ekFNTBrW9QdutW6LXwouF3tfO
```

---

## 2. Pembuatan Utilitas Discord Logger

Buat file utilitas baru di **`src/core/utils/discordLogger.ts`**. Utilitas ini bertugas mem-parsing `error.stack` untuk mendapatkan nama file/fungsi, lalu menyusun payload **Discord Rich Embed** dan mengirimkannya menggunakan `fetch` bawaan Bun.

### Spesifikasi Kode `discordLogger.ts`

```typescript
import { Context } from "elysia";

interface ErrorMetadata {
  correlationId?: string;
  path?: string;
  method?: string;
}

/**
 * Mem-parsing stack trace Error untuk mendapatkan nama file dan fungsi tempat error terjadi.
 */
function parseStackTrace(stack?: string): { fileName: string; functionName: string } {
  if (!stack) {
    return { fileName: "Unknown File", functionName: "Unknown Function" };
  }

  // Pisahkan baris stack trace
  const lines = stack.split("\n");
  
  // Baris ke-0 biasanya nama error ("Error: ...")
  // Baris ke-1 biasanya tempat sendErrorToDiscord dipanggil (jika dibuat instansiasinya di response.ts)
  // Baris ke-2 adalah lokasi error sebenarnya
  const targetLine = lines[2] || lines[1] || "";
  
  // Regex untuk mencocokkan pattern: "at functionName (path/to/file.ts:line:col)"
  // atau "at path/to/file.ts:line:col"
  const regex = /at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)|at\s+(.+?):(\d+):(\d+)/;
  const match = targetLine.match(regex);

  if (match) {
    if (match[2]) {
      // Format dengan nama fungsi
      const functionName = match[1] ?? "anonymous";
      const fullPath = match[2];
      const fileName = fullPath.split("/").pop()?.split("\\").pop() || fullPath;
      const line = match[3];
      const col = match[4];
      return { fileName: `${fileName}:${line}:${col}`, functionName };
    } else {
      // Format tanpa nama fungsi
      const fullPath = match[5] ?? "";
      const fileName = fullPath.split("/").pop()?.split("\\").pop() || fullPath;
      const line = match[6];
      const col = match[7];
      return { fileName: `${fileName}:${line}:${col}`, functionName: "anonymous" };
    }
  }

  return { fileName: "Unknown File", functionName: "Unknown Function" };
}

/**
 * Mengirim pesan detail error ke Discord Webhook
 */
export async function sendErrorToDiscord(error: Error, metadata: ErrorMetadata) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[DiscordLogger] DISCORD_WEBHOOK_URL is not configured in .env");
    return;
  }

  const { fileName, functionName } = parseStackTrace(error.stack);
  const stackTrace = error.stack ? error.stack.slice(0, 1800) : "No stack trace available";

  const payload = {
    embeds: [
      {
        title: "💥 [Error 500] - Internal Server Error",
        color: 16711680, // Warna Merah (Hex: #FF0000)
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: "🆔 Correlation ID",
            value: metadata.correlationId || "N/A",
            inline: true,
          },
          {
            name: "🛣️ Route",
            value: metadata.method && metadata.path ? `${metadata.method} ${metadata.path}` : "N/A",
            inline: true,
          },
          {
            name: "📂 File Location",
            value: fileName,
            inline: false,
          },
          {
            name: "⚙️ Function",
            value: functionName,
            inline: true,
          },
          {
            name: "💬 Error Message",
            value: error.message || "Unknown error",
            inline: false,
          },
        ],
        description: `**Stack Trace:**\n\`\`\`js\n${stackTrace}\n\`\`\``,
        footer: {
          text: "WMS backend Error Reporter",
        },
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[DiscordLogger] Failed to send to Discord. Status: ${response.status}`);
    }
  } catch (err) {
    console.error("[DiscordLogger] Network error sending log to Discord:", err);
  }
}
```

---

## 3. Integrasi Secara Otomatis di Response Helper

Untuk mendeteksi error di seluruh modul saat ini dan yang akan datang secara otomatis, integrasi dilakukan di dalam helper response terpusat.

**Modifikasi file `src/core/utils/response.ts`:**

Import utilitas logger di bagian atas file:
```typescript
import { sendErrorToDiscord } from "./discordLogger";
```

Modifikasi fungsi `failedResponse` agar memicu pengiriman log saat mendeteksi HTTP status `500`:

```typescript
export function failedResponse(
  correlationId: string,
  message: string,
  code: 400 | 401 | 403 | 404 | 500,
  exceptionMessage?: string
): StandardResponse<null> {
  
  // Pemicu otomatis jika terjadi error 500
  if (code === 500) {
    const errorMsg = exceptionMessage || message || "Internal Server Error";
    // Menjalankan secara async (background task) agar tidak menghambat response HTTP ke client
    sendErrorToDiscord(new Error(errorMsg), { correlationId }).catch((err) => {
      console.error("[response.ts] Failed to dispatch Discord log async:", err);
    });
  }

  return {
    meta: {
      correlationId,
      status: false,
      code,
      message,
      exceptionMessage: exceptionMessage ?? "",
    },
    data: null,
  };
}
```

---

## 4. Pengujian

Untuk memastikan integrasi bekerja, silakan picu error secara sengaja pada salah satu controller (misalnya melakukan pembagian dengan nol, atau melempar query database yang sengaja dibuat salah). 

Pastikan:
1. Respon API tetap mengembalikan HTTP 500 dengan correlation ID.
2. Notifikasi Rich Embed dengan warna merah langsung muncul di channel Discord Anda dengan detail file, fungsi, dan stack trace yang sesuai.
