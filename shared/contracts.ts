export type MermaidThemeName = "default" | "neutral" | "forest" | "dark" | "base";
export type AssistantChatRole = "assistant" | "user";
export type LocalRuntimeKind = "ollama" | "openai-compatible";
export type AppCommand =
  | "closeTab"
  | "deleteFile"
  | "exportPng"
  | "exportSvg"
  | "new"
  | "open"
  | "save"
  | "saveAs"
  | "wipe";

export interface DocumentPayload {
  content: string;
  name: string;
  path: string;
}

export interface DraftPayload {
  content: string;
  draftId: string;
  documentName: string;
  documentPath?: string;
  theme: MermaidThemeName;
  updatedAt: string;
}

export interface SaveDocumentRequest {
  content: string;
  path?: string;
  suggestedName: string;
}

export interface SaveAssetRequest {
  content: string;
  encoding: "utf8" | "base64";
  filters: Array<{
    extensions: string[];
    name: string;
  }>;
  suggestedName: string;
}

export interface SaveResult {
  canceled: boolean;
  path?: string;
}

export interface AssistantChatMessage {
  content: string;
  role: AssistantChatRole;
}

export interface AssistantRequest {
  chatHistory: AssistantChatMessage[];
  diagramType: string;
  model: string;
  runtimeId: string;
  selectedNode?: string;
  source: string;
}

export interface AssistantResponse {
  assistantMessage: string;
  model: string;
  suggestedTitle?: string;
  updatedSource: string;
}

export interface LocalModelInfo {
  id: string;
  label: string;
  modelId: string;
  runtimeId: string;
  runtimeLabel: string;
}

export interface LocalRuntimeInfo {
  baseUrl: string;
  id: string;
  kind: LocalRuntimeKind;
  label: string;
  modelCount: number;
}

export interface AssistantRuntimeState {
  models: LocalModelInfo[];
  runtimes: LocalRuntimeInfo[];
  setupTips: string[];
  statusMessage: string;
}
