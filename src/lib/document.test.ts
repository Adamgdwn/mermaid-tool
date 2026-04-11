import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOCUMENT_NAME,
  buildExportFileName,
  countLines,
  detectDiagramType,
  ensureMermaidExtension,
  getFileNameFromPath
} from "./document";

describe("document utilities", () => {
  it("adds the Mermaid extension when none is present", () => {
    expect(ensureMermaidExtension("system-overview")).toBe("system-overview.mmd");
  });

  it("keeps an existing file extension", () => {
    expect(ensureMermaidExtension("system-overview.mermaid")).toBe("system-overview.mermaid");
  });

  it("builds export names from the current document", () => {
    expect(buildExportFileName("/tmp/ops-diagram.mmd", "svg")).toBe("ops-diagram.svg");
    expect(buildExportFileName(undefined, "png")).toBe(DEFAULT_DOCUMENT_NAME.replace(".mmd", ".png"));
  });

  it("extracts file names from local paths", () => {
    expect(getFileNameFromPath("/tmp/ops-diagram.mmd")).toBe("ops-diagram.mmd");
    expect(getFileNameFromPath("C:\\Users\\adam\\ops-diagram.mmd")).toBe("ops-diagram.mmd");
  });

  it("counts lines and recognizes the diagram family", () => {
    const source = "sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi";
    expect(countLines(source)).toBe(3);
    expect(detectDiagramType(source)).toBe("Sequence");
  });
});
