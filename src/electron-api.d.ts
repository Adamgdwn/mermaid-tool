import type {
  AppCommand,
  DraftPayload,
  DocumentPayload,
  SaveAssetRequest,
  SaveDocumentRequest,
  SaveResult
} from "../shared/contracts";

declare global {
  interface Window {
    mermaidTool: {
      clearDraft(): Promise<void>;
      deleteDocument(documentPath: string): Promise<void>;
      exportAsset(request: SaveAssetRequest): Promise<SaveResult>;
      getAppVersion(): Promise<string>;
      getLaunchDocument(): Promise<DocumentPayload | null>;
      getRecoveredDraft(): Promise<DraftPayload | null>;
      onCommand(listener: (command: AppCommand) => void): () => void;
      onOpenDocument(listener: (document: DocumentPayload) => void): () => void;
      openDocument(): Promise<DocumentPayload | null>;
      saveDraft(request: DraftPayload): Promise<void>;
      saveDocument(request: SaveDocumentRequest): Promise<SaveResult>;
      saveDocumentAs(request: SaveDocumentRequest): Promise<SaveResult>;
    };
  }
}

export {};
