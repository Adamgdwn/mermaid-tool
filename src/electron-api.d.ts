import type {
  DocumentPayload,
  SaveAssetRequest,
  SaveDocumentRequest,
  SaveResult
} from "../shared/contracts";

declare global {
  interface Window {
    mermaidTool: {
      exportAsset(request: SaveAssetRequest): Promise<SaveResult>;
      getAppVersion(): Promise<string>;
      getLaunchDocument(): Promise<DocumentPayload | null>;
      onOpenDocument(listener: (document: DocumentPayload) => void): () => void;
      openDocument(): Promise<DocumentPayload | null>;
      saveDocument(request: SaveDocumentRequest): Promise<SaveResult>;
      saveDocumentAs(request: SaveDocumentRequest): Promise<SaveResult>;
    };
  }
}

export {};
