export type MermaidThemeName = "default" | "neutral" | "forest" | "dark" | "base";

export interface DocumentPayload {
  content: string;
  name: string;
  path: string;
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
