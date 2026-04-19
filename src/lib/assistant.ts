import { detectDiagramType } from "./document";

export interface DiagramNode {
  id: string;
  kind: string;
  label: string;
}

function cleanNodeLabel(rawLabel: string): string {
  return rawLabel
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\(\(|\)\)|\[\[|\]\]/g, "")
    .trim();
}

function dedupeNodes(nodes: DiagramNode[]): DiagramNode[] {
  const seen = new Set<string>();

  return nodes.filter((node) => {
    const key = `${node.kind}:${node.id.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function extractFlowNodes(source: string): DiagramNode[] {
  const nodes: DiagramNode[] = [];
  const pattern = /\b([A-Za-z][\w-]*)\s*(?:\[(.*?)\]|\((.*?)\)|\{(.*?)\}|>(.*?)(?=\s*(?:-->|---|===|-.->|==>|:::|$)))/g;

  for (const line of source.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("%%")) {
      continue;
    }

    for (const match of trimmedLine.matchAll(pattern)) {
      const id = match[1]?.trim();
      const label = cleanNodeLabel(match[2] ?? match[3] ?? match[4] ?? match[5] ?? id ?? "");
      if (!id || !label) {
        continue;
      }

      nodes.push({
        id,
        kind: "node",
        label
      });
    }
  }

  return dedupeNodes(nodes);
}

function extractSequenceNodes(source: string): DiagramNode[] {
  const nodes: DiagramNode[] = [];

  for (const line of source.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("%%")) {
      continue;
    }

    const participantMatch = trimmedLine.match(/^(participant|actor)\s+([A-Za-z][\w-]*)(?:\s+as\s+(.+))?$/i);
    if (!participantMatch) {
      continue;
    }

    const id = participantMatch[2] ?? "";
    const label = cleanNodeLabel(participantMatch[3] ?? participantMatch[2] ?? "");
    if (!id || !label) {
      continue;
    }

    nodes.push({
      id,
      kind: participantMatch[1].toLowerCase(),
      label
    });
  }

  return dedupeNodes(nodes);
}

function extractClassNodes(source: string): DiagramNode[] {
  const nodes: DiagramNode[] = [];

  for (const line of source.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("%%")) {
      continue;
    }

    const classMatch = trimmedLine.match(/^class\s+([A-Za-z][\w-]*)/i);
    if (!classMatch) {
      continue;
    }

    const id = classMatch[1] ?? "";
    if (!id) {
      continue;
    }

    nodes.push({
      id,
      kind: "class",
      label: id
    });
  }

  return dedupeNodes(nodes);
}

function extractGanttNodes(source: string): DiagramNode[] {
  const nodes: DiagramNode[] = [];

  for (const line of source.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (
      !trimmedLine
      || trimmedLine.startsWith("%%")
      || /^gantt\b/i.test(trimmedLine)
      || /^title\b/i.test(trimmedLine)
      || /^dateFormat\b/i.test(trimmedLine)
      || /^axisFormat\b/i.test(trimmedLine)
      || /^section\b/i.test(trimmedLine)
    ) {
      continue;
    }

    const taskMatch = trimmedLine.match(/^([^:]+?)\s*:\s*.+$/);
    if (!taskMatch) {
      continue;
    }

    const label = cleanNodeLabel(taskMatch[1] ?? "");
    if (!label) {
      continue;
    }

    nodes.push({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      kind: "task",
      label
    });
  }

  return dedupeNodes(nodes);
}

function extractMindmapNodes(source: string): DiagramNode[] {
  const nodes: DiagramNode[] = [];

  for (const line of source.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("%%") || /^mindmap\b/i.test(trimmedLine)) {
      continue;
    }

    const rootMatch = trimmedLine.match(/^([A-Za-z][\w-]*)?\s*\(\((.+)\)\)$/);
    const label = cleanNodeLabel(rootMatch?.[2] ?? trimmedLine);
    if (!label) {
      continue;
    }

    nodes.push({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      kind: "topic",
      label
    });
  }

  return dedupeNodes(nodes);
}

export function extractDiagramNodes(source: string): DiagramNode[] {
  const diagramType = detectDiagramType(source);

  switch (diagramType) {
    case "Sequence":
      return extractSequenceNodes(source);
    case "Class":
      return extractClassNodes(source);
    case "Gantt":
      return extractGanttNodes(source);
    case "Mindmap":
      return extractMindmapNodes(source);
    default:
      return extractFlowNodes(source);
  }
}

export function normalizeMermaidSource(source: string): string {
  return source.replace(/\r\n/g, "\n").trim();
}

export function buildAssistantPlaceholder(
  diagramType: string,
  selectedNodeLabel?: string
): string {
  if (selectedNodeLabel) {
    return `Describe how ${selectedNodeLabel} should change in this ${diagramType.toLowerCase()} diagram.`;
  }

  return `Describe the ${diagramType.toLowerCase()} you want, and the AI coach will draft the Mermaid for you.`;
}

export function buildAssistantWelcome(diagramLabel: string, diagramType: string): string {
  return `Working on ${diagramLabel} as a ${diagramType.toLowerCase()} diagram. Tell me what to add, remove, or reorganize and I will draft the Mermaid update.`;
}
