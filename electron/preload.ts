import { contextBridge, ipcRenderer } from "electron";
import type {
  AssistantRequest,
  AssistantResponse,
  AssistantRuntimeState,
  AppCommand,
  DraftPayload,
  DocumentPayload,
  SaveAssetRequest,
  SaveDocumentRequest,
  SaveResult
} from "../shared/contracts";

contextBridge.exposeInMainWorld("mermaidTool", {
  createWindow(): Promise<void> {
    return ipcRenderer.invoke("window:new");
  },
  getAppVersion(): Promise<string> {
    return ipcRenderer.invoke("app:getVersion");
  },
  getAssistantRuntimeState(): Promise<AssistantRuntimeState> {
    return ipcRenderer.invoke("assistant:getRuntimeState");
  },
  getLaunchDocuments(): Promise<DocumentPayload[]> {
    return ipcRenderer.invoke("file:getLaunchDocuments");
  },
  getRecoveredDrafts(): Promise<DraftPayload[]> {
    return ipcRenderer.invoke("draft:getRecovered");
  },
  openDocuments(): Promise<DocumentPayload[]> {
    return ipcRenderer.invoke("file:open");
  },
  deleteDocument(documentPath: string): Promise<void> {
    return ipcRenderer.invoke("file:delete", documentPath);
  },
  saveDocument(request: SaveDocumentRequest): Promise<SaveResult> {
    return ipcRenderer.invoke("file:save", request);
  },
  saveDocumentAs(request: SaveDocumentRequest): Promise<SaveResult> {
    return ipcRenderer.invoke("file:saveAs", request);
  },
  saveDraft(request: DraftPayload): Promise<void> {
    return ipcRenderer.invoke("draft:save", request);
  },
  clearDraft(draftId: string): Promise<void> {
    return ipcRenderer.invoke("draft:clear", draftId);
  },
  exportAsset(request: SaveAssetRequest): Promise<SaveResult> {
    return ipcRenderer.invoke("file:exportAsset", request);
  },
  generateAssistantReply(request: AssistantRequest): Promise<AssistantResponse> {
    return ipcRenderer.invoke("assistant:generateReply", request);
  },
  onOpenDocument(listener: (document: DocumentPayload) => void): () => void {
    const wrappedListener = (_event: Electron.IpcRendererEvent, document: DocumentPayload) => {
      listener(document);
    };

    ipcRenderer.on("file:opened", wrappedListener);

    return () => {
      ipcRenderer.removeListener("file:opened", wrappedListener);
    };
  },
  onCommand(listener: (command: AppCommand) => void): () => void {
    const wrappedListener = (_event: Electron.IpcRendererEvent, command: AppCommand) => {
      listener(command);
    };

    ipcRenderer.on("app:command", wrappedListener);

    return () => {
      ipcRenderer.removeListener("app:command", wrappedListener);
    };
  }
});
