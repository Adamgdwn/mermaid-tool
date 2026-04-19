import Editor from "@monaco-editor/react";
import mermaid from "mermaid";
import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent
} from "react";
import type {
  AssistantChatMessage,
  AssistantRuntimeState,
  AppCommand,
  DocumentPayload,
  DraftPayload,
  MermaidThemeName
} from "../shared/contracts";
import {
  buildAssistantPlaceholder,
  buildAssistantWelcome,
  extractDiagramNodes,
  normalizeMermaidSource
} from "./lib/assistant";
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
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 5;
const FLOWCHART_LAYOUT = {
  defaultRenderer: "elk" as const,
  diagramPadding: 8,
  htmlLabels: true,
  nodeSpacing: 24,
  padding: 12,
  rankSpacing: 32,
  useMaxWidth: false,
  wrappingWidth: 200
};
const EMPTY_RUNTIME_STATE: AssistantRuntimeState = {
  models: [],
  runtimes: [],
  setupTips: [],
  statusMessage: "Looking for local AI runtimes..."
};

type PreviewPanSession = {
  element: HTMLDivElement;
  originClientX: number;
  originClientY: number;
  originScrollLeft: number;
  originScrollTop: number;
};

type SvgSize = {
  height: number;
  width: number;
};

type WorkspaceTab = {
  assistantDraftSource?: string;
  assistantMessages: AssistantChatMessage[];
  assistantSuggestedTitle?: string;
  documentName: string;
  documentPath?: string;
  draftId: string;
  draftSavedAt?: string;
  dirty: boolean;
  id: string;
  lastSavedAt?: string;
  selectedNodeId?: string;
  source: string;
  theme: MermaidThemeName;
};

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

function clampZoom(candidateZoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(candidateZoom.toFixed(2))));
}

function getSvgSize(svgMarkup: string): SvgSize | null {
  if (!svgMarkup) {
    return null;
  }

  try {
    const parsed = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
    const svgElement = parsed.querySelector("svg");
    if (!svgElement) {
      return null;
    }

    const viewBox = svgElement.getAttribute("viewBox");
    if (viewBox) {
      const viewBoxParts = viewBox.split(/\s+/).map((value) => Number(value));
      if (viewBoxParts.length === 4 && viewBoxParts.every((value) => Number.isFinite(value))) {
        const width = viewBoxParts[2];
        const height = viewBoxParts[3];
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
    }

    const width = Number.parseFloat(svgElement.getAttribute("width") ?? "");
    const height = Number.parseFloat(svgElement.getAttribute("height") ?? "");
    if (width > 0 && height > 0) {
      return { width, height };
    }
  } catch {
    return null;
  }

  return null;
}

function createWorkspaceTab(overrides: Partial<WorkspaceTab> = {}): WorkspaceTab {
  return {
    assistantMessages: [],
    documentName: DEFAULT_DOCUMENT_NAME,
    draftId: crypto.randomUUID(),
    dirty: false,
    id: crypto.randomUUID(),
    source: BLANK_DOCUMENT_SOURCE,
    theme: "default",
    ...overrides
  };
}

function createStartupTab(): WorkspaceTab {
  return createWorkspaceTab({
    assistantMessages: [
      {
        role: "assistant",
        content: buildAssistantWelcome(INITIAL_TEMPLATE.label, detectDiagramType(INITIAL_TEMPLATE.source))
      }
    ],
    source: INITIAL_TEMPLATE.source
  });
}

function createTabFromDocument(document: DocumentPayload): WorkspaceTab {
  return createWorkspaceTab({
    documentName: document.name,
    documentPath: document.path,
    source: document.content
  });
}

function createTabFromDraft(draft: DraftPayload): WorkspaceTab {
  return createWorkspaceTab({
    documentName: ensureMermaidExtension(draft.documentName),
    documentPath: draft.documentPath,
    draftId: draft.draftId,
    draftSavedAt: formatClockTime(draft.updatedAt),
    dirty: true,
    source: draft.content,
    theme: draft.theme
  });
}

function getMonacoModelPath(tab: WorkspaceTab): string {
  if (tab.documentPath) {
    return tab.documentPath;
  }

  return `inmemory://${tab.id}/${ensureMermaidExtension(tab.documentName)}`;
}

function App() {
  const initialTabRef = useRef<WorkspaceTab>(createStartupTab());

  const [appVersion, setAppVersion] = useState("0.0.0");
  const [tabs, setTabs] = useState<WorkspaceTab[]>([initialTabRef.current]);
  const [activeTabId, setActiveTabId] = useState(initialTabRef.current.id);
  const [zoom, setZoom] = useState(1);
  const [statusMessage, setStatusMessage] = useState("Ready to diagram locally.");
  const [svgMarkup, setSvgMarkup] = useState("");
  const [renderError, setRenderError] = useState("");
  const [isRendering, setIsRendering] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [isPanningPreview, setIsPanningPreview] = useState(false);
  const [svgSize, setSvgSize] = useState<SvgSize | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantError, setAssistantError] = useState("");
  const [isAssistantBusy, setIsAssistantBusy] = useState(false);
  const [isLoadingLocalModels, setIsLoadingLocalModels] = useState(false);
  const [assistantRuntimeState, setAssistantRuntimeState] = useState<AssistantRuntimeState>(
    EMPTY_RUNTIME_STATE
  );
  const [selectedLocalModelId, setSelectedLocalModelId] = useState("");

  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const activeTabRef = useRef<WorkspaceTab>(initialTabRef.current);
  const previewPanSessionRef = useRef<PreviewPanSession | null>(null);
  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const previewFocusCanvasRef = useRef<HTMLDivElement | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? initialTabRef.current;
  const deferredSource = useDeferredValue(activeTab.source);
  const lineCount = countLines(activeTab.source);
  const diagramType = detectDiagramType(activeTab.source);
  const localModels = assistantRuntimeState.models;
  const detectedRuntimes = assistantRuntimeState.runtimes;
  const selectedLocalModel = localModels.find((model) => model.id === selectedLocalModelId);
  const diagramNodes = extractDiagramNodes(activeTab.source);
  const selectedDiagramNode = diagramNodes.find((node) => node.id === activeTab.selectedNodeId);
  const assistantPlaceholder = buildAssistantPlaceholder(diagramType, selectedDiagramNode?.label);
  const normalizedAssistantDraft = normalizeMermaidSource(activeTab.assistantDraftSource ?? "");
  const hasAssistantDraft = normalizedAssistantDraft.length > 0
    && normalizedAssistantDraft !== normalizeMermaidSource(activeTab.source);
  const isWindowDirty = tabs.some((tab) => tab.dirty);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    setAssistantInput("");
  }, [activeTab.id]);

  useEffect(() => {
    if (!selectedLocalModelId && localModels[0]) {
      setSelectedLocalModelId(localModels[0].id);
      return;
    }

    if (selectedLocalModelId && !localModels.some((model) => model.id === selectedLocalModelId)) {
      setSelectedLocalModelId(localModels[0]?.id ?? "");
    }
  }, [localModels, selectedLocalModelId]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTabId) && tabs[0]) {
      setActiveTabId(tabs[0].id);
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    if (!activeTab.selectedNodeId) {
      return;
    }

    if (!diagramNodes.some((node) => node.id === activeTab.selectedNodeId)) {
      setTabs((currentTabs) => currentTabs.map((tab) => (
        tab.id === activeTab.id
          ? {
              ...tab,
              selectedNodeId: undefined
            }
          : tab
      )));
    }
  }, [activeTab.id, activeTab.selectedNodeId, diagramNodes]);

  function setWorkspace(nextTabs: WorkspaceTab[], nextActiveTabId: string): void {
    tabsRef.current = nextTabs;
    activeTabIdRef.current = nextActiveTabId;
    setTabs(nextTabs);
    setActiveTabId(nextActiveTabId);
  }

  function updateTab(tabId: string, updater: (tab: WorkspaceTab) => WorkspaceTab): void {
    const nextTabs = tabsRef.current.map((tab) => (tab.id === tabId ? updater(tab) : tab));
    setWorkspace(nextTabs, activeTabIdRef.current);
  }

  async function refreshLocalModels(
    options: { setStatusOnError?: boolean } = {}
  ): Promise<void> {
    setIsLoadingLocalModels(true);
    setAssistantError("");

    try {
      const runtimeState = await window.mermaidTool.getAssistantRuntimeState();
      setAssistantRuntimeState(runtimeState);
      setSelectedLocalModelId((currentValue) => currentValue || runtimeState.models[0]?.id || "");

      if (options.setStatusOnError ?? false) {
        setStatusMessage(runtimeState.statusMessage);
      }
    } catch (error) {
      const message = formatErrorMessage(error);
      setAssistantError(message);
      if (options.setStatusOnError ?? false) {
        setStatusMessage(`AI builder unavailable: ${message}`);
      }
    } finally {
      setIsLoadingLocalModels(false);
    }
  }

  async function deleteDraftById(draftId: string): Promise<void> {
    try {
      await window.mermaidTool.clearDraft(draftId);
    } catch {
      // Draft cleanup should not block the user flow.
    }
  }

  async function saveDraftForTab(
    tab: WorkspaceTab,
    options: { setStatusOnError?: boolean } = { setStatusOnError: true }
  ): Promise<void> {
    if (!tab.dirty) {
      return;
    }

    const updatedAt = new Date().toISOString();

    try {
      await window.mermaidTool.saveDraft({
        content: tab.source,
        draftId: tab.draftId,
        documentName: ensureMermaidExtension(tab.documentName),
        documentPath: tab.documentPath,
        theme: tab.theme,
        updatedAt
      });

      updateTab(tab.id, (currentTab) => ({
        ...currentTab,
        draftSavedAt: formatClockTime(updatedAt)
      }));
    } catch (error) {
      if (options.setStatusOnError ?? true) {
        setStatusMessage(`Autosave failed: ${formatErrorMessage(error)}`);
      }
    }
  }

  const autosaveActiveTab = useEffectEvent((tab: WorkspaceTab) => {
    void saveDraftForTab(tab);
  });

  function appendDocumentsToTabs(
    documents: DocumentPayload[],
    origin: "external" | "open" | "startup" = "open"
  ): void {
    if (documents.length === 0) {
      return;
    }

    const currentTabs = tabsRef.current;
    const nextTabs = [...currentTabs];
    let nextActiveTabId = activeTabIdRef.current;
    let addedCount = 0;
    let reusedCount = 0;
    const lastDocumentName = documents[documents.length - 1]?.name ?? "document";

    for (const document of documents) {
      const existingTab = nextTabs.find((tab) => tab.documentPath === document.path);
      if (existingTab) {
        nextActiveTabId = existingTab.id;
        reusedCount += 1;
        continue;
      }

      const newTab = createTabFromDocument(document);
      nextTabs.push(newTab);
      nextActiveTabId = newTab.id;
      addedCount += 1;
    }

    setWorkspace(nextTabs, nextActiveTabId);

    if (addedCount > 0) {
      setStatusMessage(
        addedCount === 1
          ? `${origin === "external" ? "Opened" : "Loaded"} ${lastDocumentName} in a new tab.`
          : `Opened ${addedCount} files in new tabs.`
      );
      return;
    }

    if (reusedCount > 0) {
      setStatusMessage(`Focused the existing tab for ${lastDocumentName}.`);
    }
  }

  useEffect(() => {
    if (!deferredSource.trim()) {
      setSvgMarkup("");
      setSvgSize(null);
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
            theme: activeTab.theme,
            securityLevel: "strict",
            fontFamily: "IBM Plex Sans, Segoe UI Variable, Segoe UI, sans-serif",
            flowchart: FLOWCHART_LAYOUT,
            sequence: {
              useMaxWidth: false
            }
          });

          await mermaid.parse(deferredSource);

          const renderResult = await mermaid.render(`diagram-${activeTab.id}`, deferredSource);
          if (!stillCurrent) {
            return;
          }

          setSvgMarkup(renderResult.svg);
          setSvgSize(getSvgSize(renderResult.svg));
          setRenderError("");
        } catch (error) {
          if (!stillCurrent) {
            return;
          }

          setSvgSize(null);
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
  }, [activeTab.id, activeTab.theme, deferredSource]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isWindowDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [isWindowDirty]);

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
    const fullscreenClassName = "preview-fullscreen-active";
    const { body, documentElement } = document;

    if (isPreviewFullscreen) {
      body.classList.add(fullscreenClassName);
      documentElement.classList.add(fullscreenClassName);
    } else {
      body.classList.remove(fullscreenClassName);
      documentElement.classList.remove(fullscreenClassName);
    }

    return () => {
      body.classList.remove(fullscreenClassName);
      documentElement.classList.remove(fullscreenClassName);
    };
  }, [isPreviewFullscreen]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const activeSession = previewPanSessionRef.current;
      if (!activeSession) {
        return;
      }

      const deltaX = event.clientX - activeSession.originClientX;
      const deltaY = event.clientY - activeSession.originClientY;
      activeSession.element.scrollLeft = activeSession.originScrollLeft - deltaX;
      activeSession.element.scrollTop = activeSession.originScrollTop - deltaY;
    };

    const finishPanning = () => {
      if (!previewPanSessionRef.current) {
        return;
      }

      previewPanSessionRef.current = null;
      setIsPanningPreview(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", finishPanning);
    window.addEventListener("blur", finishPanning);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", finishPanning);
      window.removeEventListener("blur", finishPanning);
    };
  }, []);

  useEffect(() => {
    if (!activeTab.dirty) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      autosaveActiveTab(activeTab);
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeTab]);

  useEffect(() => {
    if (!svgSize || !isPreviewFullscreen) {
      return;
    }

    const activeCanvas = previewFocusCanvasRef.current;
    if (!activeCanvas) {
      return;
    }

    window.requestAnimationFrame(() => {
      const computedStyle = window.getComputedStyle(activeCanvas);
      const horizontalPadding = Number.parseFloat(computedStyle.paddingLeft)
        + Number.parseFloat(computedStyle.paddingRight);
      const availableWidth = Math.max(1, activeCanvas.clientWidth - horizontalPadding);
      const fittedZoom = clampZoom(availableWidth / svgSize.width);

      setZoom(fittedZoom);
      activeCanvas.scrollLeft = 0;
      activeCanvas.scrollTop = 0;
      setStatusMessage(
        `Opened presentation view in fit-width mode at ${Math.round(fittedZoom * 100)}%.`
      );
    });
  }, [isPreviewFullscreen, svgSize]);

  async function confirmDiscardTab(tab: WorkspaceTab, actionDescription: string): Promise<boolean> {
    if (!tab.dirty) {
      return true;
    }

    return window.confirm(
      `${tab.documentName} has unsaved changes. Continue and ${actionDescription}?`
    );
  }

  function replaceActiveTab(nextTab: WorkspaceTab): void {
    const nextTabs = tabsRef.current.map((tab) => (tab.id === nextTab.id ? nextTab : tab));
    setWorkspace(nextTabs, nextTab.id);
  }

  async function handleNewTab(): Promise<void> {
    const newTab = createWorkspaceTab();
    const nextTabs = [...tabsRef.current, newTab];
    setWorkspace(nextTabs, newTab.id);
    setStatusMessage("Opened a fresh untitled tab.");
  }

  async function handleNewWindow(): Promise<void> {
    await window.mermaidTool.createWindow();
    setStatusMessage("Opened a new Mermaid Tool window.");
  }

  async function handleSelectTab(tabId: string): Promise<void> {
    if (tabId === activeTabIdRef.current) {
      return;
    }

    const previousTab = activeTabRef.current;
    if (previousTab?.dirty) {
      void saveDraftForTab(previousTab, { setStatusOnError: false });
    }

    activeTabIdRef.current = tabId;
    setActiveTabId(tabId);
    const nextTab = tabsRef.current.find((tab) => tab.id === tabId);
    if (nextTab) {
      setStatusMessage(`Switched to ${nextTab.documentName}.`);
    }
  }

  async function handleCloseTab(tabId = activeTabIdRef.current): Promise<void> {
    const currentTabs = tabsRef.current;
    const targetTab = currentTabs.find((tab) => tab.id === tabId);
    if (!targetTab) {
      return;
    }

    const shouldContinue = await confirmDiscardTab(targetTab, `close ${targetTab.documentName}`);
    if (!shouldContinue) {
      return;
    }

    await deleteDraftById(targetTab.draftId);

    if (currentTabs.length === 1) {
      const replacementTab = createWorkspaceTab();
      setWorkspace([replacementTab], replacementTab.id);
      setStatusMessage(`Closed ${targetTab.documentName} and opened a fresh untitled tab.`);
      return;
    }

    const closingIndex = currentTabs.findIndex((tab) => tab.id === tabId);
    const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);
    const nextActiveTabId = tabId === activeTabIdRef.current
      ? (nextTabs[Math.max(0, closingIndex - 1)]?.id ?? nextTabs[0].id)
      : activeTabIdRef.current;

    setWorkspace(nextTabs, nextActiveTabId);
    setStatusMessage(`Closed ${targetTab.documentName}.`);
  }

  async function handleOpenDocuments(): Promise<void> {
    const openedDocuments = await window.mermaidTool.openDocuments();
    if (openedDocuments.length === 0) {
      return;
    }

    appendDocumentsToTabs(openedDocuments, "open");
  }

  async function handleSaveDocument(forceDialog: boolean): Promise<void> {
    const activeSnapshot = activeTabRef.current;
    const suggestedName = ensureMermaidExtension(activeSnapshot.documentName);
    const saveResult = forceDialog || !activeSnapshot.documentPath
      ? await window.mermaidTool.saveDocumentAs({
          content: activeSnapshot.source,
          path: activeSnapshot.documentPath,
          suggestedName
        })
      : await window.mermaidTool.saveDocument({
          content: activeSnapshot.source,
          path: activeSnapshot.documentPath,
          suggestedName
        });

    if (saveResult.canceled || !saveResult.path) {
      return;
    }

    await deleteDraftById(activeSnapshot.draftId);

    updateTab(activeSnapshot.id, (currentTab) => ({
      ...currentTab,
      dirty: false,
      documentName: getFileNameFromPath(saveResult.path!),
      documentPath: saveResult.path,
      draftSavedAt: undefined,
      lastSavedAt: formatClockTime(new Date().toISOString())
    }));

    setStatusMessage(`Saved ${getFileNameFromPath(saveResult.path)}.`);
  }

  async function handleExport(format: "png" | "svg"): Promise<void> {
    if (!svgMarkup || renderError) {
      setStatusMessage("Fix the preview first, then export.");
      return;
    }

    setIsExporting(true);

    try {
      const suggestedName = buildExportFileName(activeTab.documentPath, format);

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

  function fitPreviewToCanvas(
    canvas: HTMLDivElement,
    mode: "fullscreen" | "preview" = "preview",
    strategy: "whole" | "width" = "width"
  ): void {
    if (!svgSize) {
      return;
    }

    const computedStyle = window.getComputedStyle(canvas);
    const horizontalPadding = Number.parseFloat(computedStyle.paddingLeft)
      + Number.parseFloat(computedStyle.paddingRight);
    const verticalPadding = Number.parseFloat(computedStyle.paddingTop)
      + Number.parseFloat(computedStyle.paddingBottom);
    const availableWidth = Math.max(1, canvas.clientWidth - horizontalPadding);
    const availableHeight = Math.max(1, canvas.clientHeight - verticalPadding);
    const fittedZoom = clampZoom(
      strategy === "whole"
        ? Math.min(availableWidth / svgSize.width, availableHeight / svgSize.height)
        : availableWidth / svgSize.width
    );

    setZoom(fittedZoom);
    window.requestAnimationFrame(() => {
      canvas.scrollLeft = 0;
      canvas.scrollTop = 0;
    });
    setStatusMessage(
      mode === "fullscreen"
        ? strategy === "whole"
          ? `Fitted the whole diagram into presentation view at ${Math.round(fittedZoom * 100)}%.`
          : `Fitted the diagram width into presentation view at ${Math.round(fittedZoom * 100)}%.`
        : strategy === "whole"
          ? `Fitted the whole diagram into the preview at ${Math.round(fittedZoom * 100)}%.`
          : `Fitted the diagram width into the preview at ${Math.round(fittedZoom * 100)}%.`
    );
  }

  function handlePreviewWheel(event: ReactWheelEvent<HTMLDivElement>): void {
    if (renderError || !svgSize) {
      return;
    }

    event.preventDefault();

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const cursorOffsetX = event.clientX - rect.left;
    const cursorOffsetY = event.clientY - rect.top;
    const zoomFactor = event.deltaY < 0 ? 1.12 : 0.88;
    const nextZoom = clampZoom(zoom * zoomFactor);

    if (nextZoom === zoom) {
      return;
    }

    const contentPointX = (canvas.scrollLeft + cursorOffsetX) / zoom;
    const contentPointY = (canvas.scrollTop + cursorOffsetY) / zoom;

    setZoom(nextZoom);

    window.requestAnimationFrame(() => {
      canvas.scrollLeft = contentPointX * nextZoom - cursorOffsetX;
      canvas.scrollTop = contentPointY * nextZoom - cursorOffsetY;
    });

    setStatusMessage(`Preview zoom set to ${Math.round(nextZoom * 100)}%.`);
  }

  function handlePreviewMouseDown(event: ReactMouseEvent<HTMLDivElement>): void {
    if (event.button !== 2) {
      return;
    }

    event.preventDefault();
    previewPanSessionRef.current = {
      element: event.currentTarget,
      originClientX: event.clientX,
      originClientY: event.clientY,
      originScrollLeft: event.currentTarget.scrollLeft,
      originScrollTop: event.currentTarget.scrollTop
    };
    setIsPanningPreview(true);
    setStatusMessage("Right-drag the canvas to pan around the diagram.");
  }

  function handlePreviewContextMenu(event: ReactMouseEvent<HTMLDivElement>): void {
    event.preventDefault();
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

  function handleFitPreview(
    mode: "fullscreen" | "preview",
    strategy: "whole" | "width" = "width"
  ): void {
    const activeCanvas = mode === "fullscreen"
      ? previewFocusCanvasRef.current
      : previewCanvasRef.current;

    if (!activeCanvas) {
      return;
    }

    fitPreviewToCanvas(activeCanvas, mode, strategy);
  }

  async function handleWipeDocument(): Promise<void> {
    if (!activeTab.source) {
      setStatusMessage("The editor is already blank.");
      return;
    }

    const confirmed = window.confirm(
      activeTab.documentPath
        ? "Wipe the current editor contents? The file stays on disk until you save the blank version."
        : "Wipe the current editor contents?"
    );

    if (!confirmed) {
      return;
    }

    updateTab(activeTab.id, (currentTab) => ({
      ...currentTab,
      assistantDraftSource: undefined,
      assistantSuggestedTitle: undefined,
      dirty: true,
      draftSavedAt: undefined,
      selectedNodeId: undefined,
      source: BLANK_DOCUMENT_SOURCE
    }));

    setStatusMessage(
      activeTab.documentPath
        ? "Cleared the editor. Save to overwrite the file, or Save As to keep the original."
        : "Cleared the editor. Save when you're ready."
    );
  }

  async function handleDeleteDocument(): Promise<void> {
    if (!activeTab.documentPath) {
      setStatusMessage("There is no saved file to delete yet.");
      return;
    }

    const documentLabel = getFileNameFromPath(activeTab.documentPath);
    const confirmed = window.confirm(
      `Delete ${documentLabel} from disk? This permanently removes the file.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await window.mermaidTool.deleteDocument(activeTab.documentPath);
      await deleteDraftById(activeTab.draftId);

      replaceActiveTab(
        createWorkspaceTab({
          id: activeTab.id
        })
      );
      setStatusMessage(`Deleted ${documentLabel} and reset the tab to a fresh untitled document.`);
    } catch (error) {
      setStatusMessage(`Delete failed: ${formatErrorMessage(error)}`);
    }
  }

  async function handleTemplateSwap(template: typeof TEMPLATE_LIBRARY[number]): Promise<void> {
    const shouldContinue = await confirmDiscardTab(activeTab, `replace the tab with ${template.label}`);
    if (!shouldContinue) {
      return;
    }

    await deleteDraftById(activeTab.draftId);

    replaceActiveTab({
      ...activeTab,
      assistantDraftSource: undefined,
      assistantMessages: [
        {
          role: "assistant",
          content: buildAssistantWelcome(template.label, detectDiagramType(template.source))
        }
      ],
      assistantSuggestedTitle: undefined,
      dirty: true,
      documentName: DEFAULT_DOCUMENT_NAME,
      documentPath: undefined,
      draftSavedAt: undefined,
      lastSavedAt: undefined,
      selectedNodeId: undefined,
      source: template.source
    });

    setIsAssistantOpen(true);
    setAssistantInput("");
    setStatusMessage(`Loaded the ${template.label} template and opened the AI builder.`);
  }

  function handleSelectNode(nodeId?: string): void {
    updateTab(activeTab.id, (currentTab) => ({
      ...currentTab,
      selectedNodeId: nodeId
    }));
  }

  function handleApplyAssistantDraft(): void {
    if (!activeTab.assistantDraftSource || !hasAssistantDraft) {
      return;
    }

    updateTab(activeTab.id, (currentTab) => ({
      ...currentTab,
      assistantDraftSource: undefined,
      assistantSuggestedTitle: undefined,
      dirty: true,
      documentName: !currentTab.documentPath
        && currentTab.documentName === DEFAULT_DOCUMENT_NAME
        && currentTab.assistantSuggestedTitle
        ? ensureMermaidExtension(currentTab.assistantSuggestedTitle)
        : currentTab.documentName,
      draftSavedAt: undefined,
      source: currentTab.assistantDraftSource ?? currentTab.source
    }));
    setStatusMessage("Applied the AI draft into the editor.");
  }

  async function handleSendAssistantMessage(): Promise<void> {
    const prompt = assistantInput.trim();
    if (!prompt) {
      return;
    }

    if (!selectedLocalModel) {
      setAssistantError("Choose a local model first, then send the prompt.");
      setStatusMessage("The AI builder needs a local model before it can help.");
      return;
    }

    const nextHistory: AssistantChatMessage[] = [
      ...activeTab.assistantMessages,
      {
        role: "user",
        content: prompt
      }
    ];

    updateTab(activeTab.id, (currentTab) => ({
      ...currentTab,
      assistantMessages: nextHistory
    }));
    setAssistantInput("");
    setAssistantError("");
    setIsAssistantBusy(true);

    try {
      const response = await window.mermaidTool.generateAssistantReply({
        chatHistory: nextHistory,
        diagramType,
        model: selectedLocalModel.modelId,
        runtimeId: selectedLocalModel.runtimeId,
        selectedNode: selectedDiagramNode
          ? `${selectedDiagramNode.label} (${selectedDiagramNode.kind})`
          : undefined,
        source: activeTab.source
      });

      updateTab(activeTab.id, (currentTab) => ({
        ...currentTab,
        assistantDraftSource: response.updatedSource,
        assistantMessages: [
          ...nextHistory,
          {
            role: "assistant",
            content: response.assistantMessage
          }
        ],
        assistantSuggestedTitle: response.suggestedTitle
      }));

      setStatusMessage(
        normalizeMermaidSource(response.updatedSource) !== normalizeMermaidSource(activeTab.source)
          ? `AI drafted an updated ${diagramType.toLowerCase()} using ${response.model}.`
          : `AI reviewed the current ${diagramType.toLowerCase()} and replied with guidance.`
      );
    } catch (error) {
      const message = formatErrorMessage(error);
      setAssistantError(message);
      setStatusMessage(`AI builder failed: ${message}`);
    } finally {
      setIsAssistantBusy(false);
    }
  }

  function handleAssistantComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSendAssistantMessage();
    }
  }

  const handleAppCommand = useEffectEvent(async (command: AppCommand) => {
    switch (command) {
      case "closeTab":
        await handleCloseTab();
        return;
      case "new":
        await handleNewTab();
        return;
      case "open":
        await handleOpenDocuments();
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

  const handleIncomingDocument = useEffectEvent((incomingDocument: DocumentPayload) => {
    appendDocumentsToTabs([incomingDocument], "external");
  });

  useEffect(() => {
    let disposed = false;

    const unsubscribeOpen = window.mermaidTool.onOpenDocument((incomingDocument) => {
      handleIncomingDocument(incomingDocument);
    });

    const unsubscribeCommand = window.mermaidTool.onCommand((command) => {
      void handleAppCommand(command);
    });

    void (async () => {
      try {
        const [version, launchDocuments, recoveredDrafts] = await Promise.all([
          window.mermaidTool.getAppVersion(),
          window.mermaidTool.getLaunchDocuments(),
          window.mermaidTool.getRecoveredDrafts()
        ]);

        if (disposed) {
          return;
        }

        setAppVersion(version);

        const recoveredTabs = recoveredDrafts.map((draft) => createTabFromDraft(draft));
        const launchTabs = launchDocuments.map((document) => createTabFromDocument(document));
        const startupTabs = [...recoveredTabs];

        for (const launchTab of launchTabs) {
          const existingDraftTab = startupTabs.find((tab) => tab.documentPath === launchTab.documentPath);
          if (!existingDraftTab) {
            startupTabs.push(launchTab);
          }
        }

        if (startupTabs.length === 0) {
          return;
        }

        const lastLaunchTab = launchTabs.at(-1);
        const nextActiveTab = lastLaunchTab
          ? startupTabs.find((tab) => tab.documentPath === lastLaunchTab.documentPath) ?? startupTabs[0]
          : startupTabs[0];

        setWorkspace(startupTabs, nextActiveTab.id);
        setStatusMessage(
          recoveredTabs.length > 0 && launchTabs.length > 0
            ? `Recovered ${recoveredTabs.length} draft tabs and opened ${launchTabs.length} launch file${launchTabs.length === 1 ? "" : "s"}.`
            : recoveredTabs.length > 0
              ? `Recovered ${recoveredTabs.length} draft tab${recoveredTabs.length === 1 ? "" : "s"}.`
              : `Opened ${launchTabs.length} launch file${launchTabs.length === 1 ? "" : "s"}.`
        );
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

  useEffect(() => {
    let disposed = false;

    void (async () => {
      setIsLoadingLocalModels(true);
      setAssistantError("");

      try {
        const runtimeState = await window.mermaidTool.getAssistantRuntimeState();
        if (disposed) {
          return;
        }

        setAssistantRuntimeState(runtimeState);
        setSelectedLocalModelId((currentValue) => currentValue || runtimeState.models[0]?.id || "");
      } catch (error) {
        if (!disposed) {
          setAssistantError(formatErrorMessage(error));
        }
      } finally {
        if (!disposed) {
          setIsLoadingLocalModels(false);
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, []);

  function renderPreviewBody(inFocusMode: boolean): ReactNode {
    if (renderError) {
      return (
        <div className="preview-empty">
          <h3>Preview paused</h3>
          <p>{renderError}</p>
        </div>
      );
    }

    return (
      <div
        className={[
          "preview-canvas",
          inFocusMode ? "preview-canvas-focus" : "",
          isPanningPreview ? "preview-canvas-panning" : ""
        ].filter(Boolean).join(" ")}
        onContextMenu={handlePreviewContextMenu}
        onMouseDown={handlePreviewMouseDown}
        onWheel={handlePreviewWheel}
        ref={inFocusMode ? previewFocusCanvasRef : previewCanvasRef}
      >
        <div className="preview-stage-frame">
          <div
            className={`preview-stage ${inFocusMode ? "preview-stage-focus" : ""}`}
            style={
              svgSize
                ? {
                    height: `${svgSize.height * zoom}px`,
                    width: `${svgSize.width * zoom}px`
                  }
                : undefined
            }
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        </div>
      </div>
    );
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
          <button className="button button-quiet" onClick={() => void handleNewTab()}>
            New Tab
          </button>
          <button className="button button-quiet" onClick={() => void handleNewWindow()}>
            New Window
          </button>
          <button className="button button-quiet" onClick={() => void handleOpenDocuments()}>
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
            disabled={!activeTab.source}
            onClick={() => void handleWipeDocument()}
          >
            Wipe
          </button>
          <button
            className="button button-danger"
            disabled={!activeTab.documentPath}
            onClick={() => void handleDeleteDocument()}
          >
            Delete File
          </button>
          <button className="button button-quiet" onClick={() => void handleCloseTab()}>
            Close Tab
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
            <select
              value={activeTab.theme}
              onChange={(event) => {
                updateTab(activeTab.id, (currentTab) => ({
                  ...currentTab,
                  theme: event.target.value as MermaidThemeName
                }));
              }}
            >
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
              onClick={() => setZoom((currentZoom) => clampZoom(currentZoom - 0.1))}
            >
              -
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              className="button button-quiet button-square"
              onClick={() => setZoom((currentZoom) => clampZoom(currentZoom + 0.1))}
            >
              +
            </button>
          </div>
        </div>
      </header>

      <section className="tabbar">
        <div className="tabstrip">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tabchip ${tab.id === activeTab.id ? "tabchip-active" : ""}`}
            >
              <button
                className="tabchip-main"
                onClick={() => void handleSelectTab(tab.id)}
              >
                <span className="tabchip-title">
                  {tab.documentName}
                  {tab.dirty ? " *" : ""}
                </span>
                <span className="tabchip-subtitle">{tab.documentPath ?? "Unsaved draft"}</span>
              </button>
              <button
                aria-label={`Close ${tab.documentName}`}
                className="tabchip-close"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleCloseTab(tab.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button className="tabchip tabchip-add" onClick={() => void handleNewTab()}>
            + New Tab
          </button>
        </div>
      </section>

      <main className="workspace">
        <aside className="panel sidebar">
          <section className={`assistant-shell ${isAssistantOpen ? "assistant-shell-open" : "assistant-shell-collapsed"}`}>
            <div className="assistant-shell-header">
              <div>
                <p className="eyebrow">Local AI Builder</p>
                <h2>Build by conversation</h2>
              </div>
              <button
                aria-label={isAssistantOpen ? "Collapse dialogue" : "Open dialogue"}
                className="button button-primary assistant-shell-toggle"
                onClick={() => setIsAssistantOpen((currentValue) => !currentValue)}
              >
                {isAssistantOpen ? "Collapse" : "Open dialogue"}
              </button>
            </div>

            <div className={`assistant-shell-body ${isAssistantOpen ? "assistant-shell-body-open" : ""}`}>
              <section className="sidebar-section assistant-intro">
                <p className="muted">
                  Pick a starter diagram or keep the current tab, then describe the flow in plain
                  language. The assistant drafts Mermaid updates locally and keeps the editor layout
                  intact.
                </p>
                <div className="assistant-summary">
                  <span className="panel-badge">{diagramType}</span>
                  <span className="panel-badge">
                    {selectedDiagramNode ? `Node: ${selectedDiagramNode.label}` : "Whole diagram"}
                  </span>
                  <span className="panel-badge">
                    {detectedRuntimes.length > 0
                      ? `${detectedRuntimes.length} runtime${detectedRuntimes.length === 1 ? "" : "s"} found`
                      : "Local models only"}
                  </span>
                </div>
              </section>

              <section className="assistant-panel">
                {assistantError ? (
                  <p className="assistant-inline-note assistant-inline-note-error">{assistantError}</p>
                ) : (
                  <p className="assistant-inline-note">
                    {hasAssistantDraft
                      ? "A fresh AI draft is ready. Review it in the preview, then apply it when you like."
                      : assistantRuntimeState.statusMessage}
                  </p>
                )}

                <div className="assistant-transcript">
                  {activeTab.assistantMessages.length === 0 ? (
                    <div className="assistant-empty-state">
                      <strong>Start the discussion here.</strong>
                      <span>
                        Ask for a first draft, a branch, a renamed step, a cleaner sequence, or a
                        better node label.
                      </span>
                    </div>
                  ) : (
                    activeTab.assistantMessages.map((message, index) => (
                      <article
                        key={`${message.role}-${index}`}
                        className={`assistant-message assistant-message-${message.role}`}
                      >
                        <strong>{message.role === "assistant" ? "AI coach" : "You"}</strong>
                        <p>{message.content}</p>
                      </article>
                    ))
                  )}
                </div>

                <label className="assistant-composer">
                  <span className="eyebrow">Ask naturally</span>
                  <textarea
                    onChange={(event) => setAssistantInput(event.target.value)}
                    onKeyDown={handleAssistantComposerKeyDown}
                    placeholder={assistantPlaceholder}
                    rows={4}
                    value={assistantInput}
                  />
                </label>

                <div className="assistant-actions">
                  <button
                    className="button button-primary"
                    disabled={isAssistantBusy || isLoadingLocalModels || !selectedLocalModel}
                    onClick={() => void handleSendAssistantMessage()}
                  >
                    {isAssistantBusy ? "Drafting..." : "Send to AI"}
                  </button>
                  <button
                    className="button button-quiet"
                    disabled={!hasAssistantDraft}
                    onClick={handleApplyAssistantDraft}
                  >
                    Apply AI Draft
                  </button>
                </div>

                <div className="assistant-toolbar">
                  <label className="field">
                    Local model
                    <select
                      value={selectedLocalModelId}
                      onChange={(event) => setSelectedLocalModelId(event.target.value)}
                    >
                      {localModels.length === 0 ? (
                        <option value="">No models found</option>
                      ) : (
                        localModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label}
                          </option>
                        ))
                      )}
                    </select>
                  </label>

                  <button
                    className="button button-quiet"
                    disabled={isLoadingLocalModels}
                    onClick={() => void refreshLocalModels({ setStatusOnError: true })}
                  >
                    {isLoadingLocalModels ? "Refreshing..." : "Refresh Models"}
                  </button>
                </div>

                {detectedRuntimes.length > 0 ? (
                  <div className="runtime-list">
                    {detectedRuntimes.map((runtime) => (
                      <article key={runtime.id} className="runtime-card">
                        <strong>{runtime.label}</strong>
                        <span>{runtime.baseUrl}</span>
                        <span>
                          {runtime.modelCount} model{runtime.modelCount === 1 ? "" : "s"} ready
                        </span>
                      </article>
                    ))}
                  </div>
                ) : null}

                <div className="node-picker">
                  <div className="assistant-section-header">
                    <p className="eyebrow">Node focus</p>
                    <span>{diagramNodes.length} detected</span>
                  </div>
                  <div className="node-chip-list">
                    <button
                      className={`node-chip ${!selectedDiagramNode ? "node-chip-active" : ""}`}
                      onClick={() => handleSelectNode(undefined)}
                    >
                      Whole diagram
                    </button>
                    {diagramNodes.map((node) => (
                      <button
                        key={node.id}
                        className={`node-chip ${activeTab.selectedNodeId === node.id ? "node-chip-active" : ""}`}
                        onClick={() => handleSelectNode(node.id)}
                        title={`${node.kind}: ${node.label}`}
                      >
                        {node.label}
                      </button>
                    ))}
                  </div>
                  {diagramNodes.length === 0 ? (
                    <p className="assistant-inline-note">
                      The node selector fills in as soon as Mermaid elements appear in the editor.
                    </p>
                  ) : null}
                </div>

                {!assistantError && localModels.length === 0 && assistantRuntimeState.setupTips.length > 0 ? (
                  <div className="setup-tip-list">
                    {assistantRuntimeState.setupTips.map((tip) => (
                      <article key={tip} className="setup-tip-card">
                        <p>{tip}</p>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>
          </section>

          <section className="sidebar-section">
            <p className="eyebrow">Choose a diagram</p>
            <h2>Starter diagrams</h2>
            <p className="muted">
              Start with the diagram type you want first, then open the dialogue above whenever you
              want help refining the structure in plain language.
            </p>
          </section>

          <section className="template-list">
            {TEMPLATE_LIBRARY.map((template) => (
              <button
                key={template.id}
                className={`template-card template-${template.accent}`}
                onClick={() => void handleTemplateSwap(template)}
              >
                <strong>{template.label}</strong>
                <span>{template.description}</span>
              </button>
            ))}
          </section>
        </aside>

        <section className="panel editor-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Editor</p>
              <h2>{activeTab.documentName}</h2>
            </div>
            <div className="panel-badge">
              {activeTab.dirty
                ? (activeTab.draftSavedAt ? "Draft protected" : "Unsaved changes")
                : "Saved state"}
            </div>
          </div>

          <div className="editor-shell">
            <Editor
              defaultLanguage="markdown"
              height="100%"
              language="markdown"
              onChange={(value) => {
                updateTab(activeTab.id, (currentTab) => ({
                  ...currentTab,
                  assistantDraftSource: undefined,
                  assistantSuggestedTitle: undefined,
                  dirty: true,
                  source: value ?? ""
                }));
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
              path={getMonacoModelPath(activeTab)}
              theme="vs"
              value={activeTab.source}
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
                onClick={() => handleFitPreview("preview", "width")}
              >
                Fit Width
              </button>
              <button
                className="button button-quiet"
                disabled={!svgMarkup || !!renderError}
                onClick={() => handleFitPreview("preview", "whole")}
              >
                Whole
              </button>
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

          <div className="preview-shell">{renderPreviewBody(false)}</div>
        </section>
      </main>

      <footer className="statusbar">
        <span>{statusMessage}</span>
        <span>{activeTab.documentPath ?? "Unsaved local draft"}</span>
        <span>{tabs.length} tabs open</span>
        <span>{lineCount} lines</span>
        <span>
          {activeTab.lastSavedAt
            ? `Saved at ${activeTab.lastSavedAt}`
            : activeTab.dirty
              ? "Not saved yet"
              : "Saved state"}
        </span>
        <span>
          {activeTab.draftSavedAt
            ? `Draft autosaved at ${activeTab.draftSavedAt}`
            : activeTab.dirty
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
              <h2>{activeTab.documentName}</h2>
            </div>
            <div className="preview-focus-actions">
              <button
                className="button button-quiet"
                disabled={!svgMarkup || !!renderError}
                onClick={() => handleFitPreview("fullscreen", "width")}
              >
                Fit Width
              </button>
              <button
                className="button button-quiet"
                disabled={!svgMarkup || !!renderError}
                onClick={() => handleFitPreview("fullscreen", "whole")}
              >
                Whole
              </button>
              <div className={`panel-badge ${renderError ? "panel-badge-danger" : ""}`}>
                {renderError ? "Needs attention" : isRendering ? "Rendering" : "Full screen live"}
              </div>
              <button className="button button-quiet" onClick={() => void closePreviewFullscreen()}>
                Close
              </button>
            </div>
          </div>

          <div className="preview-focus-shell">{renderPreviewBody(true)}</div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
