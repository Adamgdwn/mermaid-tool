import Editor from "@monaco-editor/react";
import mermaid from "mermaid";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import type { DocumentPayload, MermaidThemeName } from "../shared/contracts";
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

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Mermaid couldn't render the current text yet.";
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
  const [svgMarkup, setSvgMarkup] = useState("");
  const [renderError, setRenderError] = useState("");
  const [isRendering, setIsRendering] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const deferredSource = useDeferredValue(source);
  const lineCount = countLines(source);
  const diagramType = detectDiagramType(source);

  useEffect(() => {
    void window.mermaidTool.getAppVersion().then((version) => {
      setAppVersion(version);
    });
  }, []);

  useEffect(() => {
    async function applyIncomingDocument(document: DocumentPayload, silent: boolean): Promise<void> {
      const shouldContinue = silent || !dirty
        ? true
        : window.confirm(`You have unsaved changes. Continue and open ${document.name}?`);

      if (!shouldContinue) {
        return;
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

    const unsubscribe = window.mermaidTool.onOpenDocument((incomingDocument) => {
      void applyIncomingDocument(incomingDocument, false);
    });

    void window.mermaidTool.getLaunchDocument().then((incomingDocument) => {
      if (incomingDocument) {
        void applyIncomingDocument(incomingDocument, true);
      }
    });

    return unsubscribe;
  }, [dirty]);

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

  async function confirmDiscard(actionDescription: string): Promise<boolean> {
    if (!dirty) {
      return true;
    }

    return window.confirm(`You have unsaved changes. Continue and ${actionDescription}?`);
  }

  async function loadDocument(document: DocumentPayload, silent: boolean): Promise<void> {
    const shouldContinue = silent
      ? true
      : await confirmDiscard(`open ${document.name}`);

    if (!shouldContinue) {
      return;
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

  async function handleOpenDocument(): Promise<void> {
    const shouldContinue = await confirmDiscard("open another document");
    if (!shouldContinue) {
      return;
    }

    const openedDocument = await window.mermaidTool.openDocument();
    if (!openedDocument) {
      return;
    }

    await loadDocument(openedDocument, true);
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

    setDocumentPath(saveResult.path);
    setDocumentName(getFileNameFromPath(saveResult.path));
    setDirty(false);
    setLastSavedAt(
      new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    );
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

  async function handleNewDocument(): Promise<void> {
    const shouldContinue = await confirmDiscard("start a new document");
    if (!shouldContinue) {
      return;
    }

    startTransition(() => {
      setSource(INITIAL_TEMPLATE.source);
      setDocumentPath(undefined);
      setDocumentName(DEFAULT_DOCUMENT_NAME);
      setDirty(false);
      setLastSavedAt(undefined);
      setStatusMessage("Started a fresh diagram from the built-in starter.");
    });
  }

  async function handleTemplateSwap(templateSource: string, label: string): Promise<void> {
    const shouldContinue = await confirmDiscard(`replace the editor with ${label}`);
    if (!shouldContinue) {
      return;
    }

    startTransition(() => {
      setSource(templateSource);
      setDocumentPath(undefined);
      setDocumentName(DEFAULT_DOCUMENT_NAME);
      setDirty(true);
      setLastSavedAt(undefined);
      setStatusMessage(`Loaded the ${label} template into the editor.`);
    });
  }

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
            <div className="panel-badge">{dirty ? "Unsaved changes" : "Saved state"}</div>
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
            <div className={`panel-badge ${renderError ? "panel-badge-danger" : ""}`}>
              {renderError ? "Needs attention" : isRendering ? "Rendering" : "Live"}
            </div>
          </div>

          <div className="preview-shell">
            {renderError ? (
              <div className="preview-empty">
                <h3>Preview paused</h3>
                <p>{renderError}</p>
              </div>
            ) : (
              <div className="preview-canvas">
                <div
                  className="preview-stage"
                  style={{ transform: `scale(${zoom})` }}
                  dangerouslySetInnerHTML={{ __html: svgMarkup }}
                />
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="statusbar">
        <span>{statusMessage}</span>
        <span>{documentPath ?? "Unsaved local draft"}</span>
        <span>{lineCount} lines</span>
        <span>{lastSavedAt ? `Saved at ${lastSavedAt}` : "Not saved yet"}</span>
        <span>v{appVersion}</span>
      </footer>
    </div>
  );
}

export default App;
