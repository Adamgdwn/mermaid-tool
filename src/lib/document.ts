export const DEFAULT_DOCUMENT_NAME = "untitled-diagram.mmd";

export function ensureMermaidExtension(fileName: string): string {
  const trimmedName = fileName.trim() || DEFAULT_DOCUMENT_NAME;
  if (/\.[a-z0-9]+$/i.test(trimmedName)) {
    return trimmedName;
  }

  return `${trimmedName}.mmd`;
}

export function getFileNameFromPath(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] ?? filePath;
}

export function buildExportFileName(filePath: string | undefined, format: "png" | "svg"): string {
  const documentName = filePath ? getFileNameFromPath(filePath) : DEFAULT_DOCUMENT_NAME;
  const stem = documentName.replace(/\.[^.]+$/, "");
  return `${stem}.${format}`;
}

export function countLines(source: string): number {
  if (source.length === 0) {
    return 1;
  }

  return source.split(/\r?\n/).length;
}

export function detectDiagramType(source: string): string {
  const diagramMatchers: Array<[RegExp, string]> = [
    [/^(flowchart|graph)\b/i, "Flowchart"],
    [/^sequenceDiagram\b/i, "Sequence"],
    [/^classDiagram\b/i, "Class"],
    [/^stateDiagram(?:-v2)?\b/i, "State"],
    [/^erDiagram\b/i, "Entity Relationship"],
    [/^journey\b/i, "Journey"],
    [/^gantt\b/i, "Gantt"],
    [/^pie\b/i, "Pie"],
    [/^mindmap\b/i, "Mindmap"],
    [/^timeline\b/i, "Timeline"],
    [/^quadrantChart\b/i, "Quadrant"],
    [/^requirementDiagram\b/i, "Requirement"],
    [/^gitGraph\b/i, "Git Graph"],
    [/^sankey-beta\b/i, "Sankey"],
    [/^block-beta\b/i, "Block"]
  ];

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("%%")) {
      continue;
    }

    for (const [pattern, label] of diagramMatchers) {
      if (pattern.test(line)) {
        return label;
      }
    }
  }

  return "Mermaid";
}
