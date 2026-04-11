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
      clearDraft(draftId: string): Promise<void>;
      createWindow(): Promise<void>;
      deleteDocument(documentPath: string): Promise<void>;
      exportAsset(request: SaveAssetRequest): Promise<SaveResult>;
      getAppVersion(): Promise<string>;
      getLaunchDocuments(): Promise<DocumentPayload[]>;
      getRecoveredDrafts(): Promise<DraftPayload[]>;
      onCommand(listener: (command: AppCommand) => void): () => void;
      onOpenDocument(listener: (document: DocumentPayload) => void): () => void;
      openDocuments(): Promise<DocumentPayload[]>;
      saveDraft(request: DraftPayload): Promise<void>;
      saveDocument(request: SaveDocumentRequest): Promise<SaveResult>;
      saveDocumentAs(request: SaveDocumentRequest): Promise<SaveResult>;
    };
  }
}

export {};
