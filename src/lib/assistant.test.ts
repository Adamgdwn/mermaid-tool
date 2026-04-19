import { describe, expect, it } from "vitest";
import {
  buildAssistantPlaceholder,
  extractDiagramNodes,
  normalizeMermaidSource
} from "./assistant";

describe("extractDiagramNodes", () => {
  it("extracts flowchart nodes with readable labels", () => {
    expect(
      extractDiagramNodes(`flowchart TD
        A[Start] --> B{Pick a path}
        B --> C[Ship it]
      `)
    ).toEqual([
      { id: "A", kind: "node", label: "Start" },
      { id: "B", kind: "node", label: "Pick a path" },
      { id: "C", kind: "node", label: "Ship it" }
    ]);
  });

  it("extracts sequence participants and aliases", () => {
    expect(
      extractDiagramNodes(`sequenceDiagram
        actor User
        participant App as Mermaid Tool
        participant Engine
      `)
    ).toEqual([
      { id: "User", kind: "actor", label: "User" },
      { id: "App", kind: "participant", label: "Mermaid Tool" },
      { id: "Engine", kind: "participant", label: "Engine" }
    ]);
  });
});

describe("normalizeMermaidSource", () => {
  it("normalizes line endings and trims outer whitespace", () => {
    expect(normalizeMermaidSource(" \r\nflowchart TD\r\nA-->B\r\n")).toBe("flowchart TD\nA-->B");
  });
});

describe("buildAssistantPlaceholder", () => {
  it("uses the focused node when one is selected", () => {
    expect(buildAssistantPlaceholder("Flowchart", "Review")).toContain("Review");
  });
});
