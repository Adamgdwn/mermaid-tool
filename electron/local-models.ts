import type {
  AssistantRequest,
  AssistantResponse,
  AssistantRuntimeState,
  LocalModelInfo,
  LocalRuntimeInfo,
  LocalRuntimeKind
} from "../shared/contracts";

const ASSISTANT_TIMEOUT_MS = 120_000;

type RuntimeCandidate = {
  baseUrl: string;
  id: string;
  kind: LocalRuntimeKind;
  label: string;
  priority: number;
};

type ReachableRuntime = RuntimeCandidate & {
  models: LocalModelInfo[];
};

function normalizeBaseUrl(rawBaseUrl: string): string {
  return rawBaseUrl.trim().replace(/\/$/, "");
}

function normalizeOpenAiCompatibleBaseUrl(rawBaseUrl: string): string {
  const normalized = normalizeBaseUrl(rawBaseUrl);

  try {
    const parsed = new URL(normalized);
    if (parsed.pathname === "/" || parsed.pathname === "") {
      parsed.pathname = "/v1";
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
  }
}

function buildRuntimeId(kind: LocalRuntimeKind, baseUrl: string): string {
  return `${kind}:${baseUrl}`;
}

function dedupeCandidates(candidates: RuntimeCandidate[]): RuntimeCandidate[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    if (seen.has(candidate.id)) {
      return false;
    }

    seen.add(candidate.id);
    return true;
  });
}

function buildRuntimeCandidates(): RuntimeCandidate[] {
  const candidates: RuntimeCandidate[] = [];
  const ollamaBaseUrl = normalizeBaseUrl(process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434");
  const envOpenAiBaseUrl = process.env.LOCAL_OPENAI_BASE_URL?.trim();
  const lmStudioBaseUrl = process.env.LM_STUDIO_BASE_URL?.trim() ?? "http://127.0.0.1:1234";
  const llamaCppBaseUrl = process.env.LLAMA_CPP_BASE_URL?.trim() ?? "http://127.0.0.1:8080";

  candidates.push({
    baseUrl: ollamaBaseUrl,
    id: buildRuntimeId("ollama", ollamaBaseUrl),
    kind: "ollama",
    label: "Ollama",
    priority: 10
  });

  const normalizedLmStudioBaseUrl = normalizeOpenAiCompatibleBaseUrl(lmStudioBaseUrl);
  candidates.push({
    baseUrl: normalizedLmStudioBaseUrl,
    id: buildRuntimeId("openai-compatible", normalizedLmStudioBaseUrl),
    kind: "openai-compatible",
    label: "LM Studio",
    priority: 20
  });

  const normalizedLlamaCppBaseUrl = normalizeOpenAiCompatibleBaseUrl(llamaCppBaseUrl);
  candidates.push({
    baseUrl: normalizedLlamaCppBaseUrl,
    id: buildRuntimeId("openai-compatible", normalizedLlamaCppBaseUrl),
    kind: "openai-compatible",
    label: "llama.cpp",
    priority: 30
  });

  if (envOpenAiBaseUrl) {
    const normalizedOpenAiBaseUrl = normalizeOpenAiCompatibleBaseUrl(envOpenAiBaseUrl);
    candidates.unshift({
      baseUrl: normalizedOpenAiBaseUrl,
      id: buildRuntimeId("openai-compatible", normalizedOpenAiBaseUrl),
      kind: "openai-compatible",
      label: "Local OpenAI-compatible server",
      priority: 5
    });
  }

  return dedupeCandidates(candidates).sort((left, right) => left.priority - right.priority);
}

function buildSetupTips(): string[] {
  return [
    "Ollama: start the app or service, then run a pull such as `ollama pull qwen2.5:7b-instruct`.",
    "LM Studio: load a chat model, start the local server, and leave its OpenAI-compatible endpoint running.",
    "llama.cpp: launch the server with a chat-capable model and its OpenAI-compatible API enabled."
  ];
}

function formatRuntimeCountSummary(runtimes: LocalRuntimeInfo[], models: LocalModelInfo[]): string {
  if (models.length === 0 || runtimes.length === 0) {
    return "No local AI runtime detected yet. Start Ollama, LM Studio, or a local OpenAI-compatible server, then refresh.";
  }

  if (runtimes.length === 1) {
    const runtime = runtimes[0];
    return `Connected to ${runtime.label} with ${runtime.modelCount} local model${runtime.modelCount === 1 ? "" : "s"}.`;
  }

  const runtimeLabels = runtimes.map((runtime) => runtime.label).join(", ");
  return `Found ${models.length} local models across ${runtimeLabels}.`;
}

function formatModelFootprint(sizeInBytes: number | undefined): string | null {
  if (!sizeInBytes || !Number.isFinite(sizeInBytes) || sizeInBytes <= 0) {
    return null;
  }

  const sizeInGiB = sizeInBytes / (1024 ** 3);
  if (sizeInGiB >= 1) {
    return `${sizeInGiB.toFixed(1)} GB`;
  }

  const sizeInMiB = sizeInBytes / (1024 ** 2);
  return `${Math.round(sizeInMiB)} MB`;
}

function buildAssistantSystemPrompt(request: AssistantRequest): string {
  return [
    "You are a local Mermaid diagram coach inside a desktop editor.",
    `Keep the diagram in Mermaid ${request.diagramType} format unless the user explicitly asks to switch.`,
    "Be practical, concise, and collaborative.",
    "Always return strict JSON with these string keys: assistantMessage, updatedSource, suggestedTitle.",
    "assistantMessage should explain what changed and mention any assumption you made.",
    "updatedSource must be a complete Mermaid document with no code fences.",
    "If the current source is blank, create a sensible first draft instead of asking the user to do the syntax work."
  ].join(" ");
}

function parseAssistantResponse(rawContent: string, fallbackSource: string, model: string): AssistantResponse {
  const trimmedContent = rawContent.trim();
  const fencedMatch = trimmedContent.match(/```(?:json)?\s*([\s\S]+?)```/i);
  const jsonCandidate = fencedMatch?.[1]?.trim() ?? trimmedContent;
  const startIndex = jsonCandidate.indexOf("{");
  const endIndex = jsonCandidate.lastIndexOf("}");
  const objectCandidate = startIndex >= 0 && endIndex >= startIndex
    ? jsonCandidate.slice(startIndex, endIndex + 1)
    : jsonCandidate;
  const parsed = JSON.parse(objectCandidate) as Partial<AssistantResponse>;

  return {
    assistantMessage: parsed.assistantMessage?.trim() || "I drafted an updated Mermaid diagram for you.",
    model,
    suggestedTitle: parsed.suggestedTitle?.trim() || undefined,
    updatedSource: parsed.updatedSource?.trim() || fallbackSource
  };
}

async function requestLocalRuntime(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(ASSISTANT_TIMEOUT_MS)
  });
}

async function probeOllamaRuntime(candidate: RuntimeCandidate): Promise<ReachableRuntime | null> {
  try {
    const response = await requestLocalRuntime(`${candidate.baseUrl}/api/tags`);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as {
      models?: Array<{
        details?: {
          parameter_size?: string;
          quantization_level?: string;
        };
        name?: string;
        size?: number;
      }>;
    };

    const models = (payload.models ?? [])
      .map((model) => {
        const modelId = model.name?.trim();
        if (!modelId) {
          return null;
        }

        const descriptor = model.details?.parameter_size
          ?? model.details?.quantization_level
          ?? formatModelFootprint(model.size);

        return {
          id: `${candidate.id}::${modelId}`,
          label: descriptor ? `${modelId} • ${descriptor} • ${candidate.label}` : `${modelId} • ${candidate.label}`,
          modelId,
          runtimeId: candidate.id,
          runtimeLabel: candidate.label
        } satisfies LocalModelInfo;
      })
      .filter((model): model is LocalModelInfo => model !== null);

    return {
      ...candidate,
      models
    };
  } catch {
    return null;
  }
}

async function probeOpenAiCompatibleRuntime(candidate: RuntimeCandidate): Promise<ReachableRuntime | null> {
  try {
    const response = await requestLocalRuntime(`${candidate.baseUrl}/models`);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as {
      data?: Array<{
        id?: string;
        owned_by?: string;
      }>;
    };

    const models = (payload.data ?? [])
      .map((model) => {
        const modelId = model.id?.trim();
        if (!modelId) {
          return null;
        }

        const owner = model.owned_by?.trim();

        return {
          id: `${candidate.id}::${modelId}`,
          label: owner
            ? `${modelId} • ${candidate.label} • ${owner}`
            : `${modelId} • ${candidate.label}`,
          modelId,
          runtimeId: candidate.id,
          runtimeLabel: candidate.label
        } satisfies LocalModelInfo;
      })
      .filter((model): model is LocalModelInfo => model !== null);

    return {
      ...candidate,
      models
    };
  } catch {
    return null;
  }
}

async function probeRuntime(candidate: RuntimeCandidate): Promise<ReachableRuntime | null> {
  if (candidate.kind === "ollama") {
    return probeOllamaRuntime(candidate);
  }

  return probeOpenAiCompatibleRuntime(candidate);
}

async function listReachableRuntimes(): Promise<ReachableRuntime[]> {
  const candidates = buildRuntimeCandidates();
  const reachableRuntimes = await Promise.all(candidates.map((candidate) => probeRuntime(candidate)));

  return reachableRuntimes
    .filter((runtime): runtime is ReachableRuntime => runtime !== null)
    .sort((left, right) => left.priority - right.priority);
}

function toRuntimeInfo(runtime: ReachableRuntime): LocalRuntimeInfo {
  return {
    baseUrl: runtime.baseUrl,
    id: runtime.id,
    kind: runtime.kind,
    label: runtime.label,
    modelCount: runtime.models.length
  };
}

function buildFocusedPrompt(request: AssistantRequest): string {
  return [
    `Current diagram type: ${request.diagramType}`,
    `Focused area: ${request.selectedNode ?? "entire diagram"}`,
    "Current Mermaid source:",
    request.source.trim() || "(empty document)"
  ].join("\n");
}

async function generateOllamaReply(
  runtime: ReachableRuntime,
  request: AssistantRequest
): Promise<AssistantResponse> {
  const response = await requestLocalRuntime(`${runtime.baseUrl}/api/chat`, {
    body: JSON.stringify({
      format: "json",
      messages: [
        {
          role: "system",
          content: buildAssistantSystemPrompt(request)
        },
        {
          role: "user",
          content: buildFocusedPrompt(request)
        },
        ...request.chatHistory
      ],
      model: request.model,
      options: {
        temperature: 0.25
      },
      stream: false
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const failureBody = await response.text();
    throw new Error(`${runtime.label} request failed with status ${response.status}: ${failureBody}`);
  }

  const payload = await response.json() as {
    message?: {
      content?: string;
    };
    model?: string;
  };

  if (!payload.message?.content) {
    throw new Error(`${runtime.label} returned an empty response.`);
  }

  return parseAssistantResponse(payload.message.content, request.source, payload.model ?? request.model);
}

async function generateOpenAiCompatibleReply(
  runtime: ReachableRuntime,
  request: AssistantRequest
): Promise<AssistantResponse> {
  const response = await requestLocalRuntime(`${runtime.baseUrl}/chat/completions`, {
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: buildAssistantSystemPrompt(request)
        },
        {
          role: "user",
          content: buildFocusedPrompt(request)
        },
        ...request.chatHistory
      ],
      model: request.model,
      temperature: 0.25
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const failureBody = await response.text();
    throw new Error(`${runtime.label} request failed with status ${response.status}: ${failureBody}`);
  }

  const payload = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
    model?: string;
  };

  const rawContent = payload.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error(`${runtime.label} returned an empty response.`);
  }

  return parseAssistantResponse(rawContent, request.source, payload.model ?? request.model);
}

export async function getAssistantRuntimeState(): Promise<AssistantRuntimeState> {
  const reachableRuntimes = await listReachableRuntimes();
  const runtimes = reachableRuntimes.map((runtime) => toRuntimeInfo(runtime));
  const models = reachableRuntimes.flatMap((runtime) => runtime.models);

  return {
    models,
    runtimes,
    setupTips: buildSetupTips(),
    statusMessage: formatRuntimeCountSummary(runtimes, models)
  };
}

export async function generateAssistantReply(request: AssistantRequest): Promise<AssistantResponse> {
  const reachableRuntimes = await listReachableRuntimes();
  const runtime = reachableRuntimes.find((candidate) => candidate.id === request.runtimeId);

  if (!runtime) {
    throw new Error("The selected local AI runtime is not available right now. Refresh models and try again.");
  }

  if (runtime.kind === "ollama") {
    return generateOllamaReply(runtime, request);
  }

  return generateOpenAiCompatibleReply(runtime, request);
}
