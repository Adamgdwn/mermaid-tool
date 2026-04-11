import { contextBridge, ipcRenderer } from "electron";
import type {
  AppCommand,
  DraftPayload,
  DocumentPayload,
  SaveAssetRequest,
  SaveDocumentRequest,
  SaveResult
} from "../shared/contracts";

contextBridge.exposeInMainWorld("mermaidTool", {
  getAppVersion(): Promise<string> {
    return ipcRenderer.invoke("app:getVersion");
  },
  getLaunchDocument(): Promise<DocumentPayload | null> {
    return ipcRenderer.invoke("file:getLaunchDocument");
  },
  getRecoveredDraft(): Promise<DraftPayload | null> {
    return ipcRenderer.invoke("draft:getRecovered");
  },
  openDocument(): Promise<DocumentPayload | null> {
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
  clearDraft(): Promise<void> {
    return ipcRenderer.invoke("draft:clear");
  },
  exportAsset(request: SaveAssetRequest): Promise<SaveResult> {
    return ipcRenderer.invoke("file:exportAsset", request);
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
