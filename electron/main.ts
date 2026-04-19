import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type {
  AssistantRequest,
  AppCommand,
  DraftPayload,
  DocumentPayload,
  SaveAssetRequest,
  SaveDocumentRequest,
  SaveResult
} from "../shared/contracts";
import {
  generateAssistantReply,
  getAssistantRuntimeState
} from "./local-models";

const APP_NAME = "Mermaid Tool";
const TEXT_FILE_FILTERS = [
  {
    name: "Mermaid files",
    extensions: ["mmd", "mermaid", "md", "txt"]
  }
];
const windows = new Map<number, BrowserWindow>();
const pendingLaunchDocuments = new Map<number, DocumentPayload[]>();
const queuedLaunchDocuments: DocumentPayload[] = [];

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.disableHardwareAcceleration();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isReadableFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function extractLaunchFile(argv: string[]): string | null {
  for (const rawArgument of argv.slice(1)) {
    if (!rawArgument || rawArgument.startsWith("--")) {
      continue;
    }

    const resolvedPath = path.resolve(rawArgument);
    if (isReadableFile(resolvedPath)) {
      return resolvedPath;
    }
  }

  return null;
}

async function readDocument(filePath: string): Promise<DocumentPayload> {
  const content = await fsp.readFile(filePath, "utf8");
  return {
    content,
    name: path.basename(filePath),
    path: filePath
  };
}

function getTargetWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

function getWindowFromWebContents(webContents: Electron.WebContents): BrowserWindow {
  const browserWindow = BrowserWindow.fromWebContents(webContents);
  if (!browserWindow) {
    throw new Error("The current Mermaid Tool window is not available.");
  }

  return browserWindow;
}

function sendAppCommand(command: AppCommand): void {
  getTargetWindow()?.webContents.send("app:command", command);
}

function getDraftFilePath(draftId: string): string {
  return path.join(app.getPath("userData"), "drafts", `${draftId}.json`);
}

function getDraftDirectoryPath(): string {
  return path.join(app.getPath("userData"), "drafts");
}

function getDefaultDocumentSavePath(request: SaveDocumentRequest): string {
  if (request.path) {
    return path.join(path.dirname(request.path), request.suggestedName);
  }

  return path.join(getDraftDirectoryPath(), request.suggestedName);
}

async function readDrafts(): Promise<DraftPayload[]> {
  try {
    const draftDirectoryPath = getDraftDirectoryPath();
    const draftFiles = (await fsp.readdir(draftDirectoryPath))
      .filter((entryName) => entryName.endsWith(".json"))
      .sort();

    const drafts = await Promise.all(draftFiles.map(async (entryName) => {
      const draftPath = path.join(draftDirectoryPath, entryName);
      const rawDraft = await fsp.readFile(draftPath, "utf8");
      const parsedDraft = JSON.parse(rawDraft) as Partial<DraftPayload>;

      return {
        content: parsedDraft.content ?? "",
        draftId: parsedDraft.draftId ?? path.basename(entryName, ".json"),
        documentName: parsedDraft.documentName ?? "recovered-draft.mmd",
        documentPath: parsedDraft.documentPath,
        theme: parsedDraft.theme ?? "default",
        updatedAt: parsedDraft.updatedAt ?? new Date().toISOString()
      } satisfies DraftPayload;
    }));

    return drafts.sort((leftDraft, rightDraft) => rightDraft.updatedAt.localeCompare(leftDraft.updatedAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeDraft(draft: DraftPayload): Promise<void> {
  const draftPath = getDraftFilePath(draft.draftId);
  await fsp.mkdir(path.dirname(draftPath), { recursive: true });
  await fsp.writeFile(draftPath, JSON.stringify(draft, null, 2), "utf8");
}

async function clearDraft(draftId: string): Promise<void> {
  try {
    await fsp.unlink(getDraftFilePath(draftId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

function buildMenu(): void {
  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        { accelerator: "CmdOrCtrl+N", click: () => sendAppCommand("new"), label: "New Tab" },
        {
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => {
            void createWindow();
          },
          label: "New Window"
        },
        { accelerator: "CmdOrCtrl+O", click: () => sendAppCommand("open"), label: "Open..." },
        { accelerator: "CmdOrCtrl+S", click: () => sendAppCommand("save"), label: "Save" },
        {
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendAppCommand("saveAs"),
          label: "Save As..."
        },
        { type: "separator" },
        { accelerator: "CmdOrCtrl+W", click: () => sendAppCommand("closeTab"), label: "Close Tab" },
        { role: "close", label: "Close Window" },
        { type: "separator" },
        { click: () => sendAppCommand("wipe"), label: "Wipe Editor" },
        { click: () => sendAppCommand("deleteFile"), label: "Delete File" },
        { type: "separator" },
        { click: () => sendAppCommand("exportSvg"), label: "Export SVG..." },
        { click: () => sendAppCommand("exportPng"), label: "Export PNG..." },
        { type: "separator" },
        { role: "quit", label: "Quit Mermaid Tool" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);
}

async function dispatchOpenedDocument(filePath: string, preferredWindow?: BrowserWindow | null): Promise<void> {
  try {
    const document = await readDocument(filePath);
    const targetWindow = preferredWindow ?? getTargetWindow();
    if (!targetWindow) {
      queuedLaunchDocuments.push(document);
      return;
    }

    const sendDocument = () => {
      targetWindow.webContents.send("file:opened", document);
    };

    if (targetWindow.webContents.isLoadingMainFrame()) {
      targetWindow.webContents.once("did-finish-load", sendDocument);
      return;
    }

    sendDocument();
  } catch (error) {
    dialog.showErrorBox(APP_NAME, `Couldn't open the requested file.\n\n${getErrorMessage(error)}`);
  }
}

async function persistTextDocument(
  browserWindow: BrowserWindow,
  request: SaveDocumentRequest,
  forceDialog: boolean
): Promise<SaveResult> {
  let destinationPath = request.path;

  if (forceDialog || !destinationPath) {
    const { canceled, filePath } = await dialog.showSaveDialog(browserWindow, {
      defaultPath: getDefaultDocumentSavePath(request),
      filters: TEXT_FILE_FILTERS
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    destinationPath = filePath;
  }

  await fsp.writeFile(destinationPath, request.content, "utf8");
  return {
    canceled: false,
    path: destinationPath
  };
}

async function persistAsset(
  browserWindow: BrowserWindow,
  request: SaveAssetRequest
): Promise<SaveResult> {
  const { canceled, filePath } = await dialog.showSaveDialog(browserWindow, {
    defaultPath: path.join(app.getPath("documents"), request.suggestedName),
    filters: request.filters
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  if (request.encoding === "base64") {
    await fsp.writeFile(filePath, Buffer.from(request.content, "base64"));
  } else {
    await fsp.writeFile(filePath, request.content, "utf8");
  }

  return {
    canceled: false,
    path: filePath
  };
}

async function deleteTextDocument(filePath: string): Promise<void> {
  await fsp.unlink(filePath);
}

async function createWindow(initialDocuments: DocumentPayload[] = []): Promise<BrowserWindow> {
  const browserWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1160,
    minHeight: 760,
    backgroundColor: "#f5ede2",
    title: APP_NAME,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  windows.set(browserWindow.id, browserWindow);

  const startupDocuments = [
    ...queuedLaunchDocuments.splice(0, queuedLaunchDocuments.length),
    ...initialDocuments
  ];
  if (startupDocuments.length > 0) {
    pendingLaunchDocuments.set(browserWindow.id, startupDocuments);
  }

  await browserWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  browserWindow.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(browserWindow, {
      buttons: ["Quit Anyway", "Keep Editing"],
      cancelId: 1,
      defaultId: 1,
      message: "You have unsaved changes.",
      detail: "Quit Mermaid Tool and discard the current unsaved edits?",
      type: "warning"
    });

    if (choice === 0) {
      event.preventDefault();
    }
  });

  browserWindow.on("closed", () => {
    windows.delete(browserWindow.id);
    pendingLaunchDocuments.delete(browserWindow.id);
  });

  return browserWindow;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

app.setName(APP_NAME);

app.on("second-instance", (_event, argv) => {
  const launchFile = extractLaunchFile(argv);
  const targetWindow = getTargetWindow();
  if (launchFile) {
    void dispatchOpenedDocument(launchFile, targetWindow);
  }

  if (targetWindow) {
    if (targetWindow.isMinimized()) {
      targetWindow.restore();
    }

    targetWindow.focus();
  }
});

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  void dispatchOpenedDocument(filePath);
});

app.whenReady().then(async () => {
  const launchDocuments: DocumentPayload[] = [];
  const launchFile = extractLaunchFile(process.argv);
  if (launchFile) {
    try {
      launchDocuments.push(await readDocument(launchFile));
    } catch (error) {
      dialog.showErrorBox(APP_NAME, `Couldn't open the requested file.\n\n${getErrorMessage(error)}`);
    }
  }

  buildMenu();
  await createWindow(launchDocuments);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("app:getVersion", () => app.getVersion());

ipcMain.handle("assistant:getRuntimeState", async () => {
  return getAssistantRuntimeState();
});

ipcMain.handle("assistant:generateReply", async (_event, request: AssistantRequest) => {
  return generateAssistantReply(request);
});

ipcMain.handle("window:new", async () => {
  await createWindow();
});

ipcMain.handle("file:getLaunchDocuments", (event) => {
  const browserWindow = getWindowFromWebContents(event.sender);
  const launchDocuments = pendingLaunchDocuments.get(browserWindow.id) ?? [];
  pendingLaunchDocuments.delete(browserWindow.id);
  return launchDocuments;
});

ipcMain.handle("file:open", async (event) => {
  const browserWindow = getWindowFromWebContents(event.sender);

  const { canceled, filePaths } = await dialog.showOpenDialog(browserWindow, {
    defaultPath: getDraftDirectoryPath(),
    filters: TEXT_FILE_FILTERS,
    properties: ["multiSelections", "openFile"]
  });

  if (canceled || filePaths.length === 0) {
    return [];
  }

  return Promise.all(filePaths.map((filePath) => readDocument(filePath)));
});

ipcMain.handle("file:delete", async (_event, filePath: string) => {
  await deleteTextDocument(filePath);
});

ipcMain.handle("file:save", async (_event, request: SaveDocumentRequest) => {
  return persistTextDocument(getWindowFromWebContents(_event.sender), request, false);
});

ipcMain.handle("file:saveAs", async (_event, request: SaveDocumentRequest) => {
  return persistTextDocument(getWindowFromWebContents(_event.sender), request, true);
});

ipcMain.handle("file:exportAsset", async (_event, request: SaveAssetRequest) => {
  return persistAsset(getWindowFromWebContents(_event.sender), request);
});

ipcMain.handle("draft:getRecovered", async () => {
  return readDrafts();
});

ipcMain.handle("draft:save", async (_event, draft: DraftPayload) => {
  await writeDraft(draft);
});

ipcMain.handle("draft:clear", async (_event, draftId: string) => {
  await clearDraft(draftId);
});
