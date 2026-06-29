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

  const lines = stack.split("\n");
  
  // Baris ke-0 biasanya nama error ("Error: ...")
  // Baris ke-1 biasanya tempat sendErrorToDiscord dipanggil (jika dibuat instansiasinya di response.ts)
  // Baris ke-2 atau ke-3 adalah lokasi error sebenarnya di controller
  // Kita cari baris pertama yang mengandung ".controller.ts" atau ".model.ts" jika ada,
  // jika tidak ada kita fallback ke baris ke-2 atau ke-3.
  let targetLine = lines[2] || lines[1] || "";
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line && (line.includes(".controller.") || line.includes(".model.") || line.includes(".routes."))) {
      targetLine = line;
      break;
    }
  }

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
