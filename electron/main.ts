import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type {
  AppCommand,
  DraftPayload,
  DocumentPayload,
  SaveAssetRequest,
  SaveDocumentRequest,
  SaveResult
} from "../shared/contracts";

const APP_NAME = "Mermaid Tool";
const TEXT_FILE_FILTERS = [
  {
    name: "Mermaid files",
    extensions: ["mmd", "mermaid", "md", "txt"]
  }
];
const SESSION_DRAFT_FILE = "session-draft.json";

let mainWindow: BrowserWindow | null = null;
let initialLaunchDocument: DocumentPayload | null = null;

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

function sendAppCommand(command: AppCommand): void {
  mainWindow?.webContents.send("app:command", command);
}

function getDraftFilePath(): string {
  return path.join(app.getPath("userData"), "drafts", SESSION_DRAFT_FILE);
}

async function readDraft(): Promise<DraftPayload | null> {
  const draftPath = getDraftFilePath();

  try {
    const rawDraft = await fsp.readFile(draftPath, "utf8");
    return JSON.parse(rawDraft) as DraftPayload;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeDraft(draft: DraftPayload): Promise<void> {
  const draftPath = getDraftFilePath();
  await fsp.mkdir(path.dirname(draftPath), { recursive: true });
  await fsp.writeFile(draftPath, JSON.stringify(draft, null, 2), "utf8");
}

async function clearDraft(): Promise<void> {
  try {
    await fsp.unlink(getDraftFilePath());
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
        { accelerator: "CmdOrCtrl+N", click: () => sendAppCommand("new"), label: "New" },
        { accelerator: "CmdOrCtrl+O", click: () => sendAppCommand("open"), label: "Open..." },
        { accelerator: "CmdOrCtrl+S", click: () => sendAppCommand("save"), label: "Save" },
        {
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendAppCommand("saveAs"),
          label: "Save As..."
        },
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

async function dispatchOpenedDocument(filePath: string): Promise<void> {
  try {
    const document = await readDocument(filePath);
    if (!mainWindow) {
      initialLaunchDocument = document;
      return;
    }

    const sendDocument = () => {
      mainWindow?.webContents.send("file:opened", document);
    };

    if (mainWindow.webContents.isLoadingMainFrame()) {
      mainWindow.webContents.once("did-finish-load", sendDocument);
      return;
    }

    sendDocument();
  } catch (error) {
    dialog.showErrorBox(APP_NAME, `Couldn't open the requested file.\n\n${getErrorMessage(error)}`);
  }
}

async function persistTextDocument(
  request: SaveDocumentRequest,
  forceDialog: boolean
): Promise<SaveResult> {
  if (!mainWindow) {
    throw new Error("The main window is not ready.");
  }

  let destinationPath = request.path;

  if (forceDialog || !destinationPath) {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(app.getPath("documents"), request.suggestedName),
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

async function persistAsset(request: SaveAssetRequest): Promise<SaveResult> {
  if (!mainWindow) {
    throw new Error("The main window is not ready.");
  }

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
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

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
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

  await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  mainWindow.webContents.on("will-prevent-unload", (event) => {
    if (!mainWindow) {
      return;
    }

    const choice = dialog.showMessageBoxSync(mainWindow, {
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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

app.setName(APP_NAME);

app.on("second-instance", (_event, argv) => {
  const launchFile = extractLaunchFile(argv);
  if (launchFile) {
    void dispatchOpenedDocument(launchFile);
  }

  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  }
});

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  void dispatchOpenedDocument(filePath);
});

app.whenReady().then(async () => {
  const launchFile = extractLaunchFile(process.argv);
  if (launchFile) {
    try {
      initialLaunchDocument = await readDocument(launchFile);
    } catch (error) {
      dialog.showErrorBox(APP_NAME, `Couldn't open the requested file.\n\n${getErrorMessage(error)}`);
    }
  }

  buildMenu();
  await createWindow();

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

ipcMain.handle("file:getLaunchDocument", () => {
  const pendingDocument = initialLaunchDocument;
  initialLaunchDocument = null;
  return pendingDocument;
});

ipcMain.handle("file:open", async () => {
  if (!mainWindow) {
    throw new Error("The main window is not ready.");
  }

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: TEXT_FILE_FILTERS,
    properties: ["openFile"]
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return readDocument(filePaths[0]);
});

ipcMain.handle("file:delete", async (_event, filePath: string) => {
  await deleteTextDocument(filePath);
});

ipcMain.handle("file:save", async (_event, request: SaveDocumentRequest) => {
  return persistTextDocument(request, false);
});

ipcMain.handle("file:saveAs", async (_event, request: SaveDocumentRequest) => {
  return persistTextDocument(request, true);
});

ipcMain.handle("file:exportAsset", async (_event, request: SaveAssetRequest) => {
  return persistAsset(request);
});

ipcMain.handle("draft:getRecovered", async () => {
  return readDraft();
});

ipcMain.handle("draft:save", async (_event, draft: DraftPayload) => {
  await writeDraft(draft);
});

ipcMain.handle("draft:clear", async () => {
  await clearDraft();
});
