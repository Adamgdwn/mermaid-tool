import { contextBridge, ipcRenderer } from "electron";
import type {
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
  openDocument(): Promise<DocumentPayload | null> {
    return ipcRenderer.invoke("file:open");
  },
  saveDocument(request: SaveDocumentRequest): Promise<SaveResult> {
    return ipcRenderer.invoke("file:save", request);
  },
  saveDocumentAs(request: SaveDocumentRequest): Promise<SaveResult> {
    return ipcRenderer.invoke("file:saveAs", request);
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
  }
});
