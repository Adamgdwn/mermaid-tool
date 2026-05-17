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
    label: "Client Journey",
    accent: "sunrise",
    description: "Map the path from first visit to paid client.",
    source: `flowchart TD
    A[Visitor lands on site] --> B{What do they need?}
    B -->|Learn first| C[Read practical guide]
    B -->|Solve a problem| D[Review service page]
    B -->|Compare options| E[Download checklist]
    C --> F[Join email follow-up]
    D --> G[Book discovery call]
    E --> F
    F --> H[Receive helpful sequence]
    H --> G
    G --> I[Convert to qualified opportunity]
`
  },
  {
    id: "sequence-support",
    label: "Support Handoff",
    accent: "ocean",
    description: "Show who owns each step in a customer support flow.",
    source: `sequenceDiagram
    autonumber
    actor Customer
    participant Support as Support desk
    participant Product as Product team
    participant Success as Customer success
    Customer->>Support: Reports a confusing workflow
    Support->>Support: Reproduce and classify issue
    Support->>Product: Escalate with notes and screenshot
    Product-->>Support: Confirm fix or workaround
    Support->>Success: Share customer-facing response
    Success-->>Customer: Follow up with next steps
`
  },
  {
    id: "class-shape",
    label: "Data Model",
    accent: "mint",
    description: "Sketch business objects before writing code.",
    source: `classDiagram
    class Customer {
      +String name
      +String status
      +Date createdAt
    }
    class Project {
      +String title
      +String stage
      +Date dueDate
    }
    class Invoice {
      +Decimal total
      +String paymentStatus
    }
    class Task {
      +String label
      +Boolean complete
    }
    Customer --> Project
    Project --> Task
    Project --> Invoice
`
  },
  {
    id: "gantt-plan",
    label: "Launch Plan",
    accent: "berry",
    description: "Turn a rollout into a timeline people can read quickly.",
    source: `gantt
    title Product Launch Plan
    dateFormat  YYYY-MM-DD
    section Prepare
    Confirm audience      :done, task1, 2026-05-18, 1d
    Finish core offer     :active, task2, after task1, 2d
    Build demo assets     :task3, after task2, 2d
    section Launch
    Publish announcement  :task4, after task3, 1d
    Run customer demos    :task5, after task4, 3d
    Review feedback       :task6, after task5, 1d
`
  },
  {
    id: "mindmap-ideas",
    label: "Strategy Map",
    accent: "gold",
    description: "Collect ideas, priorities, and next actions in one view.",
    source: `mindmap
      root((Growth strategy))
        Audience
          Beginners
          Operators
          Consultants
        Offer
          Clear outcome
          Simple onboarding
          Trust signals
        Channels
          Website
          Newsletter
          Partner referrals
        Metrics
          Qualified calls
          Activation rate
          Repeat usage
`
  },
  {
    id: "workflow-review",
    label: "Approval Workflow",
    accent: "ocean",
    description: "Clarify review, approval, and rework loops.",
    source: `flowchart LR
    A[Draft request] --> B[Assign reviewer]
    B --> C{Ready to approve?}
    C -->|Needs work| D[Return with notes]
    D --> A
    C -->|Approved| E[Publish or hand off]
    E --> F[Record decision]
`
  }
];
