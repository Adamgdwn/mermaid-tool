import Editor from "@monaco-editor/react";
import mermaid from "mermaid";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState
} from "react";
import type {
  AppCommand,
  DocumentPayload,
  DraftPayload,
  MermaidThemeName
} from "../shared/contracts";
import {
  DEFAULT_DOCUMENT_NAME,
  buildExportFileName,
  countLines,
  detectDiagramType,
  ensureMermaidExtension,
  getFileNameFromPath
} from "./lib/document";
import { renderSvgToPngDataUrl } from "./lib/export";
import { TEMPLATE_LIBRARY } from "./lib/templates";

const THEME_OPTIONS: MermaidThemeName[] = ["default", "neutral", "forest", "dark", "base"];
const INITIAL_TEMPLATE = TEMPLATE_LIBRARY[0];
const BLANK_DOCUMENT_SOURCE = "";

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Mermaid couldn't render the current text yet.";
}

function formatClockTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function App() {
  const [appVersion, setAppVersion] = useState("0.0.0");
  const [documentPath, setDocumentPath] = useState<string>();
  const [documentName, setDocumentName] = useState(DEFAULT_DOCUMENT_NAME);
  const [source, setSource] = useState(INITIAL_TEMPLATE.source);
  const [theme, setTheme] = useState<MermaidThemeName>("default");
  const [dirty, setDirty] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [statusMessage, setStatusMessage] = useState("Ready to diagram locally.");
  const [lastSavedAt, setLastSavedAt] = useState<string>();
  const [draftSavedAt, setDraftSavedAt] = useState<string>();
  const [svgMarkup, setSvgMarkup] = useState("");
  const [renderError, setRenderError] = useState("");
  const [isRendering, setIsRendering] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);

  const deferredSource = useDeferredValue(source);
  const lineCount = countLines(source);
  const diagramType = detectDiagramType(source);

  useEffect(() => {
    if (!deferredSource.trim()) {
      setSvgMarkup("");
      setRenderError("Add Mermaid syntax on the left to see a live preview here.");
      setIsRendering(false);
      return;
    }

    let stillCurrent = true;
    setIsRendering(true);

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          mermaid.initialize({
            startOnLoad: false,
            theme,
            securityLevel: "strict",
            fontFamily: "IBM Plex Sans, Segoe UI Variable, Segoe UI, sans-serif",
            flowchart: {
              htmlLabels: true,
              useMaxWidth: false
            },
            sequence: {
              useMaxWidth: false
            }
          });

          await mermaid.parse(deferredSource);

          const renderResult = await mermaid.render(`diagram-${crypto.randomUUID()}`, deferredSource);
          if (!stillCurrent) {
            return;
          }

          setSvgMarkup(renderResult.svg);
          setRenderError("");
        } catch (error) {
          if (!stillCurrent) {
            return;
          }

          setRenderError(formatErrorMessage(error));
        } finally {
          if (stillCurrent) {
            setIsRendering(false);
          }
        }
      })();
    }, 180);

    return () => {
      stillCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [deferredSource, theme]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [dirty]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsPreviewFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isPreviewFullscreen) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      void closePreviewFullscreen();
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [isPreviewFullscreen]);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const updatedAt = new Date().toISOString();

      void window.mermaidTool.saveDraft({
        content: source,
        documentName: ensureMermaidExtension(documentName),
        documentPath,
        theme,
        updatedAt
      }).then(() => {
        setDraftSavedAt(formatClockTime(updatedAt));
      }).catch((error: unknown) => {
        setStatusMessage(`Autosave failed: ${formatErrorMessage(error)}`);
      });
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dirty, documentName, documentPath, source, theme]);

  async function clearDraftState(): Promise<void> {
    try {
      await window.mermaidTool.clearDraft();
    } catch {
      // Saving the real file should still succeed even if draft cleanup misses once.
    } finally {
      setDraftSavedAt(undefined);
    }
  }

  async function confirmDiscard(actionDescription: string): Promise<boolean> {
    if (!dirty) {
      return true;
    }

    return window.confirm(`You have unsaved changes. Continue and ${actionDescription}?`);
  }

  function restoreRecoveredDraft(draft: DraftPayload): void {
    startTransition(() => {
      setSource(draft.content);
      setDocumentPath(draft.documentPath);
      setDocumentName(ensureMermaidExtension(draft.documentName));
      setTheme(draft.theme);
      setDirty(true);
      setLastSavedAt(undefined);
      setDraftSavedAt(formatClockTime(draft.updatedAt));
      setStatusMessage(`Recovered your last autosaved draft for ${draft.documentName}.`);
    });
  }

  async function loadDocument(
    document: DocumentPayload,
    options: { preserveDraft?: boolean; silent?: boolean } = {}
  ): Promise<void> {
    const shouldContinue = options.silent
      ? true
      : await confirmDiscard(`open ${document.name}`);

    if (!shouldContinue) {
      return;
    }

    if (!options.preserveDraft) {
      await clearDraftState();
    }

    startTransition(() => {
      setSource(document.content);
      setDocumentPath(document.path);
      setDocumentName(document.name);
      setDirty(false);
      setLastSavedAt(undefined);
      setStatusMessage(`Opened ${document.name}.`);
    });
  }

  const handleIncomingDocument = useEffectEvent(
    async (
      incomingDocument: DocumentPayload,
      options: { preserveDraft?: boolean; silent?: boolean } = {}
    ) => {
      await loadDocument(incomingDocument, options);
    }
  );

  async function handleOpenDocument(): Promise<void> {
    const shouldContinue = await confirmDiscard("open another document");
    if (!shouldContinue) {
      return;
    }

    const openedDocument = await window.mermaidTool.openDocument();
    if (!openedDocument) {
      return;
    }

    await loadDocument(openedDocument, { preserveDraft: false, silent: true });
  }

  async function handleSaveDocument(forceDialog: boolean): Promise<void> {
    const suggestedName = ensureMermaidExtension(documentName);
    const saveResult = forceDialog || !documentPath
      ? await window.mermaidTool.saveDocumentAs({
          content: source,
          suggestedName
        })
      : await window.mermaidTool.saveDocument({
          content: source,
          path: documentPath,
          suggestedName
        });

    if (saveResult.canceled || !saveResult.path) {
      return;
    }

    await clearDraftState();

    setDocumentPath(saveResult.path);
    setDocumentName(getFileNameFromPath(saveResult.path));
    setDirty(false);
    setLastSavedAt(formatClockTime(new Date().toISOString()));
    setStatusMessage(`Saved ${getFileNameFromPath(saveResult.path)}.`);
  }

  async function handleExport(format: "png" | "svg"): Promise<void> {
    if (!svgMarkup || renderError) {
      setStatusMessage("Fix the preview first, then export.");
      return;
    }

    setIsExporting(true);

    try {
      const suggestedName = buildExportFileName(documentPath, format);

      const saveResult = format === "svg"
        ? await window.mermaidTool.exportAsset({
            content: svgMarkup,
            encoding: "utf8",
            filters: [{ name: "SVG image", extensions: ["svg"] }],
            suggestedName
          })
        : await window.mermaidTool.exportAsset({
            content: (await renderSvgToPngDataUrl(svgMarkup)).split(",")[1] ?? "",
            encoding: "base64",
            filters: [{ name: "PNG image", extensions: ["png"] }],
            suggestedName
          });

      if (!saveResult.canceled) {
        setStatusMessage(`Exported ${suggestedName}.`);
      }
    } catch (error) {
      setStatusMessage(`Export failed: ${formatErrorMessage(error)}`);
    } finally {
      setIsExporting(false);
    }
  }

  async function closePreviewFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }

    setIsPreviewFullscreen(false);
    setStatusMessage("Returned to the standard editing view.");
  }

  async function handlePreviewFullscreenToggle(): Promise<void> {
    if (!svgMarkup || renderError) {
      setStatusMessage("Let the preview render cleanly before opening full screen.");
      return;
    }

    if (isPreviewFullscreen) {
      await closePreviewFullscreen();
      return;
    }

    setIsPreviewFullscreen(true);
    setStatusMessage("Preview opened in full screen. Press Escape to return.");

    if (document.fullscreenElement || !document.documentElement.requestFullscreen) {
      return;
    }

    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setStatusMessage("Preview expanded inside the app. Press Escape to return.");
    }
  }

  async function handleNewDocument(): Promise<void> {
    const shouldContinue = await confirmDiscard("start a new document");
    if (!shouldContinue) {
      return;
    }

    await clearDraftState();

    startTransition(() => {
      setSource(BLANK_DOCUMENT_SOURCE);
      setDocumentPath(undefined);
      setDocumentName(DEFAULT_DOCUMENT_NAME);
      setDirty(false);
      setLastSavedAt(undefined);
      setStatusMessage("Started a blank untitled Mermaid document.");
    });
  }

  async function handleWipeDocument(): Promise<void> {
    if (!source) {
      setStatusMessage("The editor is already blank.");
      return;
    }

    const confirmed = window.confirm(
      documentPath
        ? "Wipe the current editor contents? The file stays on disk until you save the blank version."
        : "Wipe the current editor contents?"
    );

    if (!confirmed) {
      return;
    }

    startTransition(() => {
      setSource(BLANK_DOCUMENT_SOURCE);
      setDirty(true);
      setDraftSavedAt(undefined);
      setStatusMessage(
        documentPath
          ? "Cleared the editor. Save to overwrite the file, or Save As to keep the original."
          : "Cleared the editor. Save when you're ready."
      );
    });
  }

  async function handleDeleteDocument(): Promise<void> {
    if (!documentPath) {
      setStatusMessage("There is no saved file to delete yet.");
      return;
    }

    const documentLabel = getFileNameFromPath(documentPath);
    const confirmed = window.confirm(
      `Delete ${documentLabel} from disk? This permanently removes the file.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await window.mermaidTool.deleteDocument(documentPath);
      await clearDraftState();

      startTransition(() => {
        setSource(BLANK_DOCUMENT_SOURCE);
        setDocumentPath(undefined);
        setDocumentName(DEFAULT_DOCUMENT_NAME);
        setDirty(false);
        setLastSavedAt(undefined);
        setStatusMessage(`Deleted ${documentLabel} and opened a fresh untitled document.`);
      });
    } catch (error) {
      setStatusMessage(`Delete failed: ${formatErrorMessage(error)}`);
    }
  }

  async function handleTemplateSwap(templateSource: string, label: string): Promise<void> {
    const shouldContinue = await confirmDiscard(`replace the editor with ${label}`);
    if (!shouldContinue) {
      return;
    }

    await clearDraftState();

    startTransition(() => {
      setSource(templateSource);
      setDocumentPath(undefined);
      setDocumentName(DEFAULT_DOCUMENT_NAME);
      setDirty(true);
      setLastSavedAt(undefined);
      setStatusMessage(`Loaded the ${label} template into the editor.`);
    });
  }

  const handleAppCommand = useEffectEvent(async (command: AppCommand) => {
    switch (command) {
      case "new":
        await handleNewDocument();
        return;
      case "open":
        await handleOpenDocument();
        return;
      case "save":
        await handleSaveDocument(false);
        return;
      case "saveAs":
        await handleSaveDocument(true);
        return;
      case "wipe":
        await handleWipeDocument();
        return;
      case "deleteFile":
        await handleDeleteDocument();
        return;
      case "exportSvg":
        await handleExport("svg");
        return;
      case "exportPng":
        await handleExport("png");
        return;
    }
  });

  useEffect(() => {
    let disposed = false;

    const unsubscribeOpen = window.mermaidTool.onOpenDocument((incomingDocument) => {
      void handleIncomingDocument(incomingDocument, { preserveDraft: false, silent: false });
    });

    const unsubscribeCommand = window.mermaidTool.onCommand((command) => {
      void handleAppCommand(command);
    });

    void (async () => {
      try {
        const [version, incomingDocument, recoveredDraft] = await Promise.all([
          window.mermaidTool.getAppVersion(),
          window.mermaidTool.getLaunchDocument(),
          window.mermaidTool.getRecoveredDraft()
        ]);

        if (disposed) {
          return;
        }

        setAppVersion(version);

        if (incomingDocument) {
          await handleIncomingDocument(incomingDocument, { preserveDraft: true, silent: true });
          return;
        }

        if (recoveredDraft) {
          restoreRecoveredDraft(recoveredDraft);
        }
      } catch (error) {
        if (!disposed) {
          setStatusMessage(`Startup recovery failed: ${formatErrorMessage(error)}`);
        }
      }
    })();

    return () => {
      disposed = true;
      unsubscribeOpen();
      unsubscribeCommand();
    };
  }, []);

  const previewBody = renderError ? (
    <div className="preview-empty">
      <h3>Preview paused</h3>
      <p>{renderError}</p>
    </div>
  ) : (
    <div className={`preview-canvas ${isPreviewFullscreen ? "preview-canvas-focus" : ""}`}>
      <div
        className={`preview-stage ${isPreviewFullscreen ? "preview-stage-focus" : ""}`}
        style={{ transform: `scale(${zoom})` }}
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
    </div>
  );

  return (
    <div className="shell">
      <div className="aurora aurora-left" />
      <div className="aurora aurora-right" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <p className="eyebrow">Local Desktop Mermaid Studio</p>
            <h1>Mermaid Tool</h1>
          </div>
        </div>

        <div className="toolbar">
          <button className="button button-quiet" onClick={() => void handleNewDocument()}>
            New
          </button>
          <button className="button button-quiet" onClick={() => void handleOpenDocument()}>
            Open
          </button>
          <button className="button button-primary" onClick={() => void handleSaveDocument(false)}>
            Save
          </button>
          <button className="button button-quiet" onClick={() => void handleSaveDocument(true)}>
            Save As
          </button>
          <button
            className="button button-quiet"
            disabled={!source}
            onClick={() => void handleWipeDocument()}
          >
            Wipe
          </button>
          <button
            className="button button-danger"
            disabled={!documentPath}
            onClick={() => void handleDeleteDocument()}
          >
            Delete File
          </button>
          <button
            className="button button-quiet"
            disabled={!svgMarkup || !!renderError || isExporting}
            onClick={() => void handleExport("svg")}
          >
            Export SVG
          </button>
          <button
            className="button button-quiet"
            disabled={!svgMarkup || !!renderError || isExporting}
            onClick={() => void handleExport("png")}
          >
            Export PNG
          </button>
        </div>

        <div className="toolbar toolbar-right">
          <label className="field">
            Theme
            <select value={theme} onChange={(event) => setTheme(event.target.value as MermaidThemeName)}>
              {THEME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="zoom-control">
            <button
              className="button button-quiet button-square"
              onClick={() => setZoom((currentZoom) => Math.max(0.5, currentZoom - 0.1))}
            >
              -
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              className="button button-quiet button-square"
              onClick={() => setZoom((currentZoom) => Math.min(2.5, currentZoom + 0.1))}
            >
              +
            </button>
          </div>
        </div>
      </header>

      <main className="workspace">
        <aside className="panel sidebar">
          <section className="sidebar-section">
            <p className="eyebrow">Start Fast</p>
            <h2>Starter diagrams</h2>
            <p className="muted">
              Pick a working example, tweak the text, then export a clean image without touching the web.
            </p>
          </section>

          <section className="template-list">
            {TEMPLATE_LIBRARY.map((template) => (
              <button
                key={template.id}
                className={`template-card template-${template.accent}`}
                onClick={() => void handleTemplateSwap(template.source, template.label)}
              >
                <strong>{template.label}</strong>
                <span>{template.description}</span>
              </button>
            ))}
          </section>

          <section className="sidebar-section tips">
            <p className="eyebrow">Helpful flow</p>
            <ul>
              <li>Open or start a `.mmd` file locally.</li>
              <li>Edit the Mermaid text in plain language on the center panel.</li>
              <li>Watch the right panel update automatically.</li>
              <li>Your in-progress draft autosaves locally while you work.</li>
              <li>Export SVG for crisp docs or PNG for slides and chat.</li>
            </ul>
          </section>
        </aside>

        <section className="panel editor-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Editor</p>
              <h2>{documentName}</h2>
            </div>
            <div className="panel-badge">
              {dirty ? (draftSavedAt ? "Draft protected" : "Unsaved changes") : "Saved state"}
            </div>
          </div>

          <div className="editor-shell">
            <Editor
              defaultLanguage="markdown"
              height="100%"
              language="markdown"
              onChange={(value) => {
                setSource(value ?? "");
                setDirty(true);
              }}
              options={{
                automaticLayout: true,
                fontFamily: "JetBrains Mono, Cascadia Code, ui-monospace, monospace",
                fontSize: 15,
                lineNumbersMinChars: 3,
                minimap: { enabled: false },
                padding: { top: 18 },
                scrollBeyondLastLine: false,
                wordWrap: "on"
              }}
              theme="vs"
              value={source}
            />
          </div>
        </section>

        <section className="panel preview-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Preview</p>
              <h2>{diagramType} Diagram</h2>
            </div>
            <div className="preview-header-actions">
              <button
                className="button button-quiet"
                disabled={!svgMarkup || !!renderError}
                onClick={() => void handlePreviewFullscreenToggle()}
              >
                Full Screen
              </button>
              <div className={`panel-badge ${renderError ? "panel-badge-danger" : ""}`}>
                {renderError ? "Needs attention" : isRendering ? "Rendering" : "Live"}
              </div>
            </div>
          </div>

          <div className="preview-shell">{previewBody}</div>
        </section>
      </main>

      <footer className="statusbar">
        <span>{statusMessage}</span>
        <span>{documentPath ?? "Unsaved local draft"}</span>
        <span>{lineCount} lines</span>
        <span>{lastSavedAt ? `Saved at ${lastSavedAt}` : dirty ? "Not saved yet" : "Saved state"}</span>
        <span>
          {draftSavedAt
            ? `Draft autosaved at ${draftSavedAt}`
            : dirty
              ? "Draft autosave pending"
              : "No recovery draft queued"}
        </span>
        <span>v{appVersion}</span>
      </footer>

      {isPreviewFullscreen ? (
        <div className="preview-focus-layer">
          <div className="preview-focus-toolbar">
            <div>
              <p className="eyebrow">Presentation View</p>
              <h2>{documentName}</h2>
            </div>
            <div className="preview-focus-actions">
              <div className={`panel-badge ${renderError ? "panel-badge-danger" : ""}`}>
                {renderError ? "Needs attention" : isRendering ? "Rendering" : "Full screen live"}
              </div>
              <button className="button button-quiet" onClick={() => void closePreviewFullscreen()}>
                Close
              </button>
            </div>
          </div>

          <div className="preview-focus-shell">{previewBody}</div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
