import type {
  AppStorageInfo,
  AssistantRequest,
  AssistantResponse,
  AssistantRuntimeState,
  AppCommand,
  CopyImageRequest,
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
      copyImage(request: CopyImageRequest): Promise<void>;
      createWindow(): Promise<void>;
      deleteDocument(documentPath: string): Promise<void>;
      exportAsset(request: SaveAssetRequest): Promise<SaveResult>;
      generateAssistantReply(request: AssistantRequest): Promise<AssistantResponse>;
      getAssistantRuntimeState(): Promise<AssistantRuntimeState>;
      getAppVersion(): Promise<string>;
      getLaunchDocuments(): Promise<DocumentPayload[]>;
      getRecoveredDrafts(): Promise<DraftPayload[]>;
      getStorageInfo(): Promise<AppStorageInfo>;
      onCommand(listener: (command: AppCommand) => void): () => void;
      onOpenDocument(listener: (document: DocumentPayload) => void): () => void;
      openDocuments(): Promise<DocumentPayload[]>;
      saveDraft(request: DraftPayload): Promise<void>;
      saveDocument(request: SaveDocumentRequest): Promise<SaveResult>;
      saveDocumentAs(request: SaveDocumentRequest): Promise<SaveResult>;
      showDocumentInFolder(documentPath: string): Promise<void>;
    };
  }
}

export {};
