import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai@^2.29.1";
import { buildServerSystemInstruction, type UserRole } from "./knowledge.ts";

const CHAT_MODEL = "gemini-3.5-flash-lite";
const CHAT_FALLBACK_MODEL = "gemini-3.8-flash";
const TTS_MODEL = "gemini-3.8-flash-lite-tts";
const ALLOWED_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const fail = (message: string, status = 400) => json({ error: message }, status);

type HistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

type AssistantMode = "chat" | "tts" | "tts-stream" | "transcribe";

type AssistantRequestBody = {
  mode?: AssistantMode;
  message?: string;
  currentPath?: string;
  previousInteractionId?: string | null;
  history?: HistoryTurn[];
  text?: string;
  audioBase64?: string;
  mimeType?: string;
};

function buildPromptWithRecentHistory(message: string, history: HistoryTurn[] = []): string {
  const recent = history
    .filter((item) => item && typeof item.content === "string" && item.content.trim().length > 0)
    .slice(-6);

  if (recent.length === 0) {
    return message;
  }

  const lines = recent.map((item) =>
    `${item.role === "user" ? "Người dùng" : "Trợ lý"}: ${item.content.trim().slice(0, 600)}`
  );
  return `Ngữ cảnh trao đổi gần đây:\n${lines.join("\n")}\n\nNgười dùng vừa nói/nhắn: ${message}`;
}

function normalizeAudioMimeType(raw?: string): string {
  const base = (raw ?? "audio/webm").split(";")[0]?.trim().toLowerCase() ?? "audio/webm";
  if (ALLOWED_AUDIO_MIMES.has(base)) {
    return base === "audio/mp4" ? "audio/m4a" : base;
  }
  return "audio/webm";
}

function buildTtsInput(speechText: string) {
  return [
    {
      type: "user_input" as const,
      content: [
        {
          type: "text" as const,
          text: speechText,
          annotations: [
            {
              type: "speech_metadata" as const,
              style:
                "Native Vietnamese speaker (vi-VN), warm, natural, crisp conversational tone, clear Vietnamese pronunciation",
            },
          ],
        },
      ],
    },
  ];
}

function extractAudioFromInteraction(interaction: unknown): { data: string; mimeType: string } | null {
  const record = interaction as {
    output_audio?: { data?: string; mime_type?: string } | null;
    steps?: Array<{ content?: Array<{ type?: string; data?: string; mime_type?: string }> }>;
  };

  if (record.output_audio?.data) {
    return {
      data: record.output_audio.data,
      mimeType: record.output_audio.mime_type || "audio/wav",
    };
  }

  for (const step of record.steps ?? []) {
    for (const item of step.content ?? []) {
      if (item.type === "audio" && item.data) {
        return {
          data: item.data,
          mimeType: item.mime_type || "audio/wav",
        };
      }
    }
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("Phương thức không được hỗ trợ", 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return json({ source: "fallback_needed", reason: "missing_supabase_env" });
  }

  // Xác thực JWT người gọi và đọc vai trò thực tế từ bảng profiles qua RLS
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return fail("Bạn cần đăng nhập để sử dụng trợ lý", 401);

  const { data: profile, error: profileErr } = await userClient
    .from("profiles")
    .select("role, full_name, class_name, subject, is_active")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile || !profile.is_active) {
    return fail("Tài khoản chưa được kích hoạt hoặc không hợp lệ", 403);
  }

  let body: AssistantRequestBody;
  try {
    body = (await req.json()) as AssistantRequestBody;
  } catch {
    return fail("Dữ liệu gửi lên không hợp lệ");
  }

  const mode: AssistantMode =
    body.mode === "tts" || body.mode === "tts-stream" || body.mode === "transcribe"
      ? body.mode
      : "chat";

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey || !geminiApiKey.trim()) {
    console.log(`avc-assistant ${mode}: fallback_needed (missing_api_key)`);
    return json({ source: "fallback_needed", reason: "missing_api_key" });
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey.trim() });

  // Chế độ stream giọng nói PCM 24kHz theo thời gian thực để phát câu đầu tiên chỉ sau ~1-2 giây
  if (mode === "tts-stream") {
    const speechText = typeof body.text === "string" ? body.text.trim().slice(0, 1200) : "";
    if (!speechText) return fail("Vui lòng cung cấp nội dung cần đọc");

    const startedAt = Date.now();
    const speechConfigs: Array<{ voice?: string; language?: string }> = [
      { language: "vi-VN", voice: "Sulafat" },
      { language: "vi-VN" },
    ];

    let activeStream: AsyncIterable<{
      event_type?: string;
      delta?: { type?: string; data?: string; sample_rate?: number };
    }> | null = null;
    let activeConfig: { voice?: string; language?: string } | null = null;

    for (const speechCfg of speechConfigs) {
      try {
        activeStream = (await ai.interactions.create(
          {
            model: TTS_MODEL,
            input: buildTtsInput(speechText),
            response_format: { type: "audio" },
            generation_config: {
              speech_config: [speechCfg],
            },
            stream: true,
          },
          { timeout_ms: 15000, maxRetries: 0 }
        )) as unknown as AsyncIterable<{
          event_type?: string;
          delta?: { type?: string; data?: string; sample_rate?: number };
        }>;
        activeConfig = speechCfg;
        break;
      } catch (err) {
        console.error(
          `avc-assistant tts-stream init (${speechCfg.voice ?? "auto"}:${speechCfg.language ?? "auto"}) error:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    if (!activeStream) {
      return json({ source: "fallback_needed", reason: "tts_upstream_error" });
    }

    const encoder = new TextEncoder();
    let cancelled = false;

    const sseBody = new ReadableStream<Uint8Array>({
      async start(controller) {
        let chunkCount = 0;
        try {
          for await (const event of activeStream!) {
            if (cancelled) break;
            if (
              event.event_type === "step.delta" &&
              event.delta?.type === "audio" &&
              event.delta.data
            ) {
              chunkCount += 1;
              const payload = JSON.stringify({
                data: event.delta.data,
                sampleRate: event.delta.sample_rate ?? 24000,
              });
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            }
          }

          if (!cancelled) {
            if (chunkCount > 0) {
              console.log(
                `avc-assistant tts-stream: ok (${Date.now() - startedAt}ms, chunks=${chunkCount}, voice=${activeConfig?.voice ?? "auto"})`
              );
              controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
            } else {
              controller.enqueue(
                encoder.encode('event: error\ndata: {"reason":"empty_audio_stream"}\n\n')
              );
            }
          }
        } catch (err) {
          console.error(
            "avc-assistant tts-stream loop error:",
            err instanceof Error ? err.message : String(err)
          );
          if (!cancelled) {
            controller.enqueue(
              encoder.encode('event: error\ndata: {"reason":"tts_stream_failed"}\n\n')
            );
          }
        } finally {
          try {
            controller.close();
          } catch {
            // Stream đã đóng sẵn
          }
        }
      },
      cancel() {
        cancelled = true;
      },
    });

    return new Response(sseBody, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

  // Chế độ tổng hợp giọng nói tiếng Việt đầy đủ (dự phòng khi trình duyệt không stream Web Audio)
  if (mode === "tts") {
    const speechText = typeof body.text === "string" ? body.text.trim().slice(0, 1200) : "";
    if (!speechText) return fail("Vui lòng cung cấp nội dung cần đọc");

    const startedAt = Date.now();
    const speechConfigs: Array<{ voice?: string; language?: string }> = [
      { language: "vi-VN", voice: "Sulafat" },
      { language: "vi-VN" },
    ];

    for (const speechCfg of speechConfigs) {
      try {
        const interaction = await ai.interactions.create(
          {
            model: TTS_MODEL,
            input: buildTtsInput(speechText),
            response_format: { type: "audio" },
            generation_config: {
              speech_config: [speechCfg],
            },
          },
          { timeout_ms: 12000, maxRetries: 0 }
        );

        const audio = extractAudioFromInteraction(interaction);
        if (audio?.data) {
          console.log(
            `avc-assistant tts: ok (${Date.now() - startedAt}ms, voice=${speechCfg.voice ?? "auto"}, lang=${speechCfg.language ?? "auto"})`
          );
          return json({
            source: "gemini-tts",
            audioBase64: audio.data,
            mimeType: audio.mimeType,
          });
        }
      } catch (err) {
        console.error(
          `avc-assistant tts (${speechCfg.voice ?? "auto"}:${speechCfg.language ?? "auto"}) error:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    return json({ source: "fallback_needed", reason: "tts_upstream_error" });
  }

  // Chế độ nhận diện giọng nói từ file ghi âm trình duyệt
  if (mode === "transcribe") {
    const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64.trim() : "";
    if (!audioBase64 || audioBase64.length > 8_000_000) {
      return fail("Đoạn ghi âm không hợp lệ hoặc vượt quá giới hạn");
    }

    const mimeType = normalizeAudioMimeType(body.mimeType);
    try {
      const interaction = await ai.interactions.create(
        {
          model: CHAT_MODEL,
          input: [
            {
              type: "text",
              text:
                "Hãy nghe đoạn ghi âm và chép lại chính xác lời người dùng vừa nói bằng tiếng Việt (có thể xen từ khóa tiếng Anh hoặc mã lớp như CNTT). Chỉ trả về đúng câu chữ người dùng đã nói, không thêm lời mở đầu hay giải thích.",
            },
            {
              type: "audio",
              data: audioBase64,
              mime_type: mimeType,
            },
          ],
          generation_config: {
            thinking_level: "minimal",
            max_output_tokens: 200,
          },
        },
        { timeout_ms: 10000, maxRetries: 0 }
      );

      const transcript = interaction.output_text?.trim() ?? "";
      return json({
        source: "gemini-stt",
        text: transcript,
      });
    } catch (err) {
      console.error(
        "avc-assistant transcribe error:",
        err instanceof Error ? err.message : String(err)
      );
      return json({ source: "fallback_needed", reason: "transcribe_upstream_error" });
    }
  }

  // Chế độ hội thoại văn bản thông minh (tốc độ cao với Flash-Lite + thinking minimal + timeout cứng)
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) return fail("Vui lòng nhập nội dung câu hỏi");

  const currentPath =
    typeof body.currentPath === "string" ? body.currentPath.trim().slice(0, 120) : "/tools";
  const previousInteractionId =
    typeof body.previousInteractionId === "string" && body.previousInteractionId.trim()
      ? body.previousInteractionId.trim()
      : undefined;
  const history = Array.isArray(body.history) ? body.history : [];

  const systemInstruction = buildServerSystemInstruction({
    role: profile.role as UserRole,
    fullName: profile.full_name,
    className: profile.class_name,
    subject: profile.subject,
    currentPath,
  });

  const runChat = (
    model: string,
    thinkingLevel: "minimal" | "low",
    inputText: string,
    timeoutMs: number,
    prevId?: string
  ) =>
    ai.interactions.create(
      {
        model,
        input: inputText,
        system_instruction: systemInstruction,
        previous_interaction_id: prevId,
        generation_config: {
          thinking_level: thinkingLevel,
          max_output_tokens: 380,
        },
      },
      { timeout_ms: timeoutMs, maxRetries: 0 }
    );

  const chatStartedAt = Date.now();
  try {
    let usedModel = CHAT_MODEL;
    let interaction;

    try {
      interaction = await runChat(
        CHAT_MODEL,
        "minimal",
        previousInteractionId ? message : buildPromptWithRecentHistory(message, history),
        9000,
        previousInteractionId
      );
    } catch (primaryErr) {
      if (Date.now() - chatStartedAt >= 6000) {
        throw primaryErr;
      }
      if (previousInteractionId) {
        try {
          interaction = await runChat(
            CHAT_MODEL,
            "minimal",
            buildPromptWithRecentHistory(message, history),
            6500
          );
        } catch {
          // Thử tiếp model dự phòng nếu model chính vẫn lỗi tức thì
        }
      }
      if (!interaction && Date.now() - chatStartedAt < 4000) {
        usedModel = CHAT_FALLBACK_MODEL;
        interaction = await runChat(
          CHAT_FALLBACK_MODEL,
          "low",
          buildPromptWithRecentHistory(message, history),
          7500
        );
      }
      if (!interaction) {
        throw primaryErr;
      }
    }

    const reply = interaction.output_text?.trim();
    if (!reply) {
      return json({ source: "fallback_needed", reason: "empty_reply" });
    }

    console.log(`avc-assistant chat: ok (${Date.now() - chatStartedAt}ms, model=${usedModel})`);
    return json({
      source: "gemini",
      reply,
      interactionId: interaction.id ?? null,
    });
  } catch (err) {
    console.error(
      `avc-assistant gemini error (${Date.now() - chatStartedAt}ms):`,
      err instanceof Error ? err.message : String(err)
    );
    return json({ source: "fallback_needed", reason: "upstream_error" });
  }
});

