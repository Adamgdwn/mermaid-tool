export interface DiagramTemplate {
  accent: string;
  description: string;
  id: string;
  label: string;
  source: string;
}

export const TEMPLATE_LIBRARY: DiagramTemplate[] = [
  {
    id: "flow-launch",
    label: "Flowchart Starter",
    accent: "sunrise",
    description: "A friendly starter for ideas, processes, and decision trees.",
    source: `flowchart TD
    A[Start with a rough idea] --> B{What are you mapping?}
    B -->|Workflow| C[Show the major steps]
    B -->|System| D[Capture the main components]
    B -->|Decision| E[Write the branching choices]
    C --> F[Review with teammates]
    D --> F
    E --> F
    F --> G[Export as SVG or PNG]
`
  },
  {
    id: "sequence-support",
    label: "Sequence Diagram",
    accent: "ocean",
    description: "Trace a user request, support flow, or integration call.",
    source: `sequenceDiagram
    autonumber
    actor User
    participant App as Mermaid Tool
    participant Engine as Mermaid Renderer
    User->>App: Open a local .mmd file
    App->>Engine: Render the latest diagram text
    Engine-->>App: Fresh SVG preview
    App-->>User: Show preview and export actions
`
  },
  {
    id: "class-shape",
    label: "Class Diagram",
    accent: "mint",
    description: "Outline relationships between classes or data objects.",
    source: `classDiagram
    class Workspace {
      +String path
      +String content
      +save()
    }
    class PreviewPane {
      +render()
      +exportSvg()
      +exportPng()
    }
    class WorkspaceStore {
      +load()
      +reset()
    }
    WorkspaceStore --> Workspace
    Workspace --> PreviewPane
`
  },
  {
    id: "gantt-plan",
    label: "Gantt Plan",
    accent: "berry",
    description: "Plan a rollout, roadmap, or weekend project.",
    source: `gantt
    title Mermaid Tool Launch Plan
    dateFormat  YYYY-MM-DD
    section Product
    Draft workflow       :done, task1, 2026-04-11, 1d
    Build desktop shell  :done, task2, after task1, 1d
    Polish exports       :active, task3, after task2, 2d
    section Rollout
    Install launcher     :task4, after task3, 1d
    Share with users     :task5, after task4, 1d
`
  },
  {
    id: "mindmap-ideas",
    label: "Mindmap",
    accent: "gold",
    description: "Organize loose thoughts into a clear visual structure.",
    source: `mindmap
      root((Mermaid Tool))
        Capture
          Open local files
          Save drafts
          Start from templates
        Preview
          Live rendering
          Zoom controls
          Theme switching
        Share
          Export SVG
          Export PNG
          Desktop launcher
`
  }
];
