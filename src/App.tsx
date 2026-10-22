import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Box,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleHelp,
  Code2,
  Columns3,
  Database,
  FileCode2,
  FilePlus2,
  Files,
  FolderOpen,
  GitBranch,
  Info,
  Layers3,
  ListFilter,
  LoaderCircle,
  Menu,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Redo2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  TriangleAlert,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import {
  editField,
  FIELDS,
  OBJECT_KINDS,
  objectDescription,
  optionalValue,
  type A2lNode,
  type ParsedA2l,
} from "./a2l";
import {
  decodeFile,
  downloadFile,
  encodeFile,
  MAX_FILE_SIZE,
  type DecodedFile,
} from "./files";
import { demoSource } from "./demo";
import type { SourceRange } from "./source-navigation";

const SourceEditor = lazy(() => import("./SourceEditor"));
const LearningGuide = lazy(() => import("./LearningGuide"));

type View = "explorer" | "source" | "diagnostics";
interface DocumentState extends DecodedFile {
  id: string;
  name: string;
  saved: string;
  parsed?: ParsedA2l;
  parsedSource?: string;
  history: string[];
  future: string[];
  selected: string;
  kind: string;
  query: string;
  module: string;
  view: View;
  sourceTarget?: SourceRange;
}
const LABELS: Record<string, string> = {
  MEASUREMENT: "Measurements",
  CHARACTERISTIC: "Characteristics",
  AXIS_PTS: "Axis points",
  COMPU_METHOD: "Conversions",
  RECORD_LAYOUT: "Record layouts",
  FUNCTION: "Functions",
  GROUP: "Groups",
  UNIT: "Units",
  INSTANCE: "Instances",
};
const displayKind = (kind: string) =>
  LABELS[kind] ?? kind.toLowerCase().replaceAll("_", " ");
const emptyParsed: ParsedA2l = {
  nodes: [],
  diagnostics: [],
  includes: [],
  version: "",
  project: "",
};
const pageSize = 75;

function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`icon-button ${className}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function makeDocument(name: string, decoded: DecodedFile): DocumentState {
  return {
    ...decoded,
    id: crypto.randomUUID(),
    name,
    saved: decoded.source,
    history: [],
    future: [],
    selected: "",
    kind: "ALL",
    query: "",
    module: "ALL",
    view: "explorer",
  };
}

function FieldEditor({
  node,
  source,
  onChange,
  onError,
}: {
  node: A2lNode;
  source: string;
  onChange: (source: string) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Record<number, string>>({});
  const schema = FIELDS[node.kind] ?? [];
  const changed = schema.some(
    (field) =>
      draft[field.index] !== undefined &&
      draft[field.index] !== node.tokens[field.index]?.value,
  );
  function apply() {
    try {
      let next = source;
      for (const field of [...schema].sort(
        (left, right) => right.index - left.index,
      )) {
        if (
          draft[field.index] !== undefined &&
          draft[field.index] !== node.tokens[field.index]?.value
        )
          next = editField(next, node, field, draft[field.index]);
      }
      onChange(next);
      setDraft({});
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not apply properties.",
      );
    }
  }
  return (
    <div className="property-form">
      {schema.length === 0 && (
        <div className="inline-note">
          <Code2 size={17} />
          This block is available in the source editor.
        </div>
      )}
      {schema.map((field) => (
        <label key={field.index} className="field" htmlFor={`field-${node.id}-${field.index}`}>
          <span>{field.label}</span>
          {field.label === "Name" || field.type === "text" ? (
            <textarea
              id={`field-${node.id}-${field.index}`}
              aria-label={field.label}
              rows={2}
              value={draft[field.index] ?? node.tokens[field.index]?.value ?? ""}
              disabled={!node.tokens[field.index]}
              onChange={(event) => setDraft({ ...draft, [field.index]: event.target.value })}
              spellCheck={false}
            />
          ) : (
            <input
              id={`field-${node.id}-${field.index}`}
              aria-label={field.label}
              value={draft[field.index] ?? node.tokens[field.index]?.value ?? ""}
              disabled={!node.tokens[field.index]}
              onChange={(event) => setDraft({ ...draft, [field.index]: event.target.value })}
              spellCheck={false}
            />
          )}
        </label>
      ))}
      {schema.length > 0 && (
        <div className="field-actions">
          <button
            className="quiet-button"
            disabled={!changed}
            onClick={() => setDraft({})}
          >
            Reset
          </button>
          <button className="primary small" disabled={!changed} onClick={apply}>
            <Check size={14} />
            Apply changes
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [documents, setDocuments] = useState<DocumentState[]>(() => [
    makeDocument("Powertrain_Demo.a2l", {
      source: demoSource,
      encoding: "utf-8",
      bom: false,
    }),
  ]);
  const [activeId, setActiveId] = useState(() => documents[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(
    () => window.matchMedia("(min-width: 1051px)").matches,
  );
  const [inspectorTab, setInspectorTab] = useState<"properties" | "structure">(
    "properties",
  );
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [learning, setLearning] = useState(false);
  const [sortAscending, setSortAscending] = useState(true);
  const [page, setPage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [opening, setOpening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inspectorToggleRef = useRef<HTMLButtonElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const pending = useRef(new Map<number, { id: string; source: string }>());
  const active = documents.find((document) => document.id === activeId);
  const deferredQuery = useDeferredValue(active?.query ?? "");
  const parsed = active?.parsed ?? emptyParsed;
  const busy = !!active && active.source !== active.parsedSource;
  const selected = parsed.nodes.find((node) => node.id === active?.selected);

  useEffect(() => {
    const worker = new Worker(new URL("./parser.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.onmessage = (
      event: MessageEvent<{ id: number; parsed?: ParsedA2l; error?: string }>,
    ) => {
      const request = pending.current.get(event.data.id);
      if (!request) return;
      pending.current.delete(event.data.id);
      if (event.data.error) {
        setNotice(event.data.error);
        return;
      }
      setDocuments((current) =>
        current.map((document) => {
          if (document.id !== request.id || document.source !== request.source)
            return document;
          const nextParsed = event.data.parsed!;
          const valid = nextParsed.nodes.some(
            (node) => node.id === document.selected,
          );
          return {
            ...document,
            parsed: nextParsed,
            parsedSource: request.source,
            selected: valid
              ? document.selected
              : (nextParsed.nodes.find((node) =>
                  OBJECT_KINDS.includes(node.kind),
                )?.id ??
                nextParsed.nodes[0]?.id ??
                ""),
          };
        }),
      );
    };
    worker.onerror = () =>
      setNotice(
        "The parser worker stopped. Reload the page after downloading any unsaved source.",
      );
    return () => {
      worker.terminate();
      workerRef.current = null;
      pending.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!active || active.source === active.parsedSource) return;
    const timer = setTimeout(() => {
      const id = ++requestRef.current;
      pending.current.set(id, { id: active.id, source: active.source });
      workerRef.current?.postMessage({ id, source: active.source });
    }, 180);
    return () => clearTimeout(timer);
  }, [active?.id, active?.source, active?.parsedSource]);

  useEffect(() => {
    if (!documents.some((document) => document.source !== document.saved))
      return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [documents]);

  useEffect(() => {
    setPage(0);
  }, [activeId, deferredQuery, active?.kind, active?.module, sortAscending]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 9000);
    return () => clearTimeout(timer);
  }, [notice]);

  function updateActive(update: Partial<DocumentState>) {
    setDocuments((current) =>
      current.map((document) =>
        document.id === activeId ? { ...document, ...update } : document,
      ),
    );
  }
  function changeSource(source: string) {
    if (!active || source === active.source) return;
    updateActive({
      source,
      sourceTarget: undefined,
      history: [...active.history.slice(-19), active.source],
      future: [],
    });
  }
  function undo() {
    if (!active?.history.length) return;
    updateActive({
      source: active.history.at(-1)!,
      history: active.history.slice(0, -1),
      future: [active.source, ...active.future],
    });
  }
  function redo() {
    if (!active?.future.length) return;
    updateActive({
      source: active.future[0],
      history: [...active.history, active.source],
      future: active.future.slice(1),
    });
  }
  function addDemo() {
    const document = makeDocument("Powertrain_ECU.a2l", {
      source: demoSource,
      encoding: "utf-8",
      bom: false,
    });
    setDocuments((current) => [...current, document]);
    setActiveId(document.id);
  }
  async function openFiles(files: File[]) {
    setOpening(true);
    const added: DocumentState[] = [];
    const errors: string[] = [];
    for (const file of files.slice(0, 12)) {
      try {
        if (!/\.(a2l|aml)$/i.test(file.name))
          throw new Error("Select an .a2l or .aml text file.");
        if (file.size > MAX_FILE_SIZE)
          throw new Error("The file exceeds the 50 MiB limit.");
        const decoded = decodeFile(new Uint8Array(await file.arrayBuffer()));
        added.push(makeDocument(file.name, decoded));
      } catch (error) {
        errors.push(
          `${file.name}: ${error instanceof Error ? error.message : "Could not open file."}`,
        );
      }
    }
    if (added.length) {
      setDocuments((current) => [...current, ...added]);
      setActiveId(added[0].id);
    }
    if (files.length > 12) errors.push("Open up to 12 files at a time.");
    if (errors.length) setNotice(errors.join(" "));
    setOpening(false);
  }
  function save(utf8 = false) {
    if (!active) return;
    try {
      const bytes = encodeFile(
        utf8
          ? { source: active.source, encoding: "utf-8", bom: false }
          : active,
      );
      downloadFile(active.name, bytes);
      if (!utf8) updateActive({ saved: active.source });
      setNotice(
        utf8
          ? "UTF-8 copy downloaded."
          : "A2L copy downloaded. The original file is unchanged.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not download file.",
      );
    }
  }
  function closeDocument(id: string) {
    const remaining = documents.filter((document) => document.id !== id);
    setDocuments(remaining);
    if (id === activeId) setActiveId(remaining.at(-1)?.id ?? "");
    setClosing(null);
  }
  function navigate(node: A2lNode) {
    updateActive({
      selected: node.id,
      kind: "ALL",
      module: "ALL",
      query: "",
      view: "explorer",
    });
    setInspectorOpen(true);
  }

  const nodeMap = new Map(parsed.nodes.map((node) => [node.id, node]));
  function moduleOf(node: A2lNode): string {
    let parent: A2lNode | undefined = node;
    while (parent && parent.kind !== "MODULE")
      parent = parent.parentId ? nodeMap.get(parent.parentId) : undefined;
    return parent?.id ?? "";
  }
  const moduleNodes = parsed.nodes.filter((node) => node.kind === "MODULE");
  const scope = parsed.nodes.filter(
    (node) => active?.module === "ALL" || moduleOf(node) === active?.module,
  );
  const objects = scope.filter((node) => OBJECT_KINDS.includes(node.kind));
  const showBlocks = active?.kind === "BLOCKS";
  const searchable = showBlocks ? scope : objects;
  const filtered = searchable.filter(
    (node) =>
      (active?.kind === "ALL" || showBlocks || node.kind === active?.kind) &&
      `${node.name} ${node.kind} ${objectDescription(node)} ${node.tokens.map((token) => token.value).join(" ")}`
        .toLowerCase()
        .includes(deferredQuery.toLowerCase()),
  );
  filtered.sort(
    (left, right) =>
      (sortAscending ? 1 : -1) * left.name.localeCompare(right.name),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visiblePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(
    visiblePage * pageSize,
    (visiblePage + 1) * pageSize,
  );
  const errorCount = parsed.diagnostics.filter(
    (item) => item.severity === "error",
  ).length;
  const warningCount = parsed.diagnostics.filter(
    (item) => item.severity === "warning",
  ).length;
  const kindCounts = new Map<string, number>();
  for (const node of objects)
    kindCounts.set(node.kind, (kindCounts.get(node.kind) ?? 0) + 1);
  const conversionOf = (node: A2lNode) => {
    const field = FIELDS[node.kind]?.find(
      (field) => field.label === "Conversion",
    );
    const name = field ? node.tokens[field.index]?.value : undefined;
    return name
      ? parsed.nodes.find(
          (candidate) =>
            candidate.kind === "COMPU_METHOD" &&
            candidate.name === name &&
            moduleOf(candidate) === moduleOf(node),
        )
      : undefined;
  };
  const unitOf = (node: A2lNode) =>
    optionalValue(node, "PHYS_UNIT") ||
    conversionOf(node)?.tokens[4]?.value ||
    "";
  const addressOf = (node: A2lNode) =>
    optionalValue(node, "ECU_ADDRESS") ||
    (node.kind === "CHARACTERISTIC"
      ? node.tokens[3]?.value
      : node.kind === "AXIS_PTS"
        ? node.tokens[2]?.value
        : "") ||
    "";
  const limitOf = (node: A2lNode, label: string) => {
    const field = FIELDS[node.kind]?.find((field) => field.label === label);
    return field ? (node.tokens[field.index]?.value ?? "") : "";
  };

  return (
    <div
      className="app"
      onDragOver={(event) => {
        event.preventDefault();
        if (event.dataTransfer.types.includes("Files")) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void openFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".a2l,.aml"
        multiple
        hidden
        onChange={(event) => {
          void openFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <header className="app-header">
        <div className="brand">
          <img src="/mark.svg" width="28" height="28" alt="" />
          <span>
            A2L<span className="brand-light"> Studio</span>
          </span>
        </div>
        <div className="header-right">
          <button
            className="primary small"
            onClick={() => inputRef.current?.click()}
            disabled={opening}
          >
            {opening ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <FolderOpen size={15} />
            )}
            Open files
          </button>
          <IconButton label="Learn about A2L" onClick={() => setLearning(true)}>
            <Info size={19} />
          </IconButton>
        </div>
      </header>
      <div className="document-tabs">
        <div
          className="tab-buttons"
          role="tablist"
          aria-label="Open A2L documents"
        >
          {documents.map((document) => (
            <button
              role="tab"
              aria-label={document.name}
              aria-selected={document.id === activeId}
              className={`document-tab ${document.id === activeId ? "active" : ""}`}
              key={document.id}
              onClick={() => setActiveId(document.id)}
            >
              <FileCode2 size={15} />
              <span>{document.name}</span>
              {document.source !== document.saved && (
                <span
                  aria-hidden="true"
                  className="dirty-dot"
                  title="Unsaved changes"
                />
              )}
            </button>
          ))}
        </div>
        {active && (
          <IconButton
            label={`Close ${active.name}`}
            onClick={() =>
              active.source !== active.saved
                ? setClosing(active.id)
                : closeDocument(active.id)
            }
          >
            <X size={13} />
          </IconButton>
        )}
        <IconButton
          label="Open another file"
          onClick={() => inputRef.current?.click()}
        >
          <Plus size={17} />
        </IconButton>
      </div>
      {!active ? (
        <main className="welcome">
          <div className="welcome-grid" />
          <div className="welcome-content">
            <div className="welcome-symbol">
              <Layers3 size={34} />
            </div>
            <h1>No open files</h1>
            <div className="welcome-actions">
              <button
                className="primary"
                onClick={() => inputRef.current?.click()}
              >
                <FolderOpen size={18} />
                Open A2L files
              </button>
              <button className="outline-button" onClick={addDemo}>
                <Database size={17} />
                Explore demo
              </button>
            </div>
          </div>
        </main>
      ) : (
        <>
          <main className={`workbench ${sidebarOpen ? "sidebar-open" : ""}`}>
            <aside className="sidebar">
              <div className="sidebar-heading">
                <span>EXPLORER</span>
                <IconButton
                  label="Close navigation"
                  className="mobile-only"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X size={16} />
                </IconButton>
                <Database size={15} className="desktop-only" />
              </div>
              <div className="module-select">
                <label htmlFor="module">Module</label>
                <select
                  id="module"
                  value={active.module}
                  onChange={(event) =>
                    updateActive({ module: event.target.value })
                  }
                >
                  <option value="ALL">
                    All modules ({moduleNodes.length})
                  </option>
                  {moduleNodes.map((node) => (
                    <option value={node.id} key={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </div>
              <nav aria-label="Object categories">
                <button
                  className={`nav-item ${active.kind === "ALL" ? "selected" : ""}`}
                  onClick={() => {
                    updateActive({ kind: "ALL", view: "explorer" });
                    setSidebarOpen(false);
                  }}
                >
                  <Layers3 size={17} />
                  <span>All objects</span>
                  <span className="nav-count">{objects.length}</span>
                </button>
                <div className="nav-section">DATA & CALIBRATION</div>
                {["MEASUREMENT", "CHARACTERISTIC", "AXIS_PTS"].map((kind) => (
                  <Category
                    key={kind}
                    kind={kind}
                    active={active.kind}
                    count={kindCounts.get(kind) ?? 0}
                    onClick={() => {
                      updateActive({ kind, view: "explorer" });
                      setSidebarOpen(false);
                    }}
                  />
                ))}
                <div className="nav-section">DEFINITIONS</div>
                {[
                  ...new Set([
                    "COMPU_METHOD",
                    "RECORD_LAYOUT",
                    "FUNCTION",
                    "GROUP",
                    ...[...kindCounts.keys()].filter(
                      (kind) =>
                        !["MEASUREMENT", "CHARACTERISTIC", "AXIS_PTS"].includes(
                          kind,
                        ),
                    ),
                  ]),
                ].map((kind) => (
                  <Category
                    key={kind}
                    kind={kind}
                    active={active.kind}
                    count={kindCounts.get(kind) ?? 0}
                    onClick={() => {
                      updateActive({ kind, view: "explorer" });
                      setSidebarOpen(false);
                    }}
                  />
                ))}
                <div className="nav-section">DOCUMENT</div>
                <button
                  className={`nav-item ${active.kind === "BLOCKS" ? "selected" : ""}`}
                  onClick={() => {
                    updateActive({ kind: "BLOCKS", view: "explorer" });
                    setSidebarOpen(false);
                  }}
                >
                  <Braces size={17} />
                  <span>All blocks</span>
                  <span className="nav-count">{scope.length}</span>
                </button>
                <button
                  className="nav-item"
                  onClick={() => {
                    updateActive({ view: "diagnostics" });
                    setSidebarOpen(false);
                  }}
                >
                  <ShieldCheck size={17} />
                  <span>Diagnostics</span>
                  <span
                    className={`nav-count ${errorCount ? "error-text" : ""}`}
                  >
                    {parsed.diagnostics.length}
                  </span>
                </button>
              </nav>
              <div className="sidebar-footer">
                <span className="live-dot" />
                <div>
                  <strong>Browser workspace</strong>
                  <span>Files remain on this device</span>
                </div>
              </div>
            </aside>
            <section className="main-panel">
              <div className="document-heading">
                <div className="document-context">
                  <IconButton
                    className="mobile-only"
                    label="Open navigation"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <Menu size={18} />
                  </IconButton>
                  <Database size={15} />
                  <span title={parsed.project}>
                    {parsed.project || active.name}
                  </span>
                </div>
                <div className="document-actions">
                  <IconButton
                    label="Undo edit"
                    disabled={!active.history.length}
                    onClick={undo}
                  >
                    <Undo2 size={17} />
                  </IconButton>
                  <IconButton
                    label="Redo edit"
                    disabled={!active.future.length}
                    onClick={redo}
                  >
                    <Redo2 size={17} />
                  </IconButton>
                  <span className="toolbar-separator" />
                  <button
                    className="outline-button small"
                    onClick={() => save()}
                  >
                    <ArrowDownToLine size={15} />
                    Save copy
                  </button>
                  <IconButton
                    label="Export UTF-8 copy"
                    onClick={() => save(true)}
                  >
                    <Upload size={17} />
                  </IconButton>
                </div>
              </div>
              <div className="view-bar">
                <div
                  role="tablist"
                  aria-label="Document view"
                  className="view-tabs"
                >
                  {(
                    [
                      {
                        view: "explorer",
                        label: "Object explorer",
                        icon: <Table2 size={15} />,
                      },
                      {
                        view: "source",
                        label: "Source",
                        icon: <Code2 size={15} />,
                      },
                      {
                        view: "diagnostics",
                        label: "Diagnostics",
                        icon: <ShieldCheck size={15} />,
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.view}
                      role="tab"
                      aria-selected={active.view === item.view}
                      className={active.view === item.view ? "selected" : ""}
                      onClick={() => updateActive({ view: item.view })}
                    >
                      {item.icon}
                      {item.label}
                      {item.view === "diagnostics" &&
                        parsed.diagnostics.length > 0 && (
                          <span className="small-count">
                            {parsed.diagnostics.length}
                          </span>
                        )}
                    </button>
                  ))}
                </div>
                <span
                  className={`parse-state ${errorCount ? "error-text" : ""}`}
                >
                  {busy ? (
                    <>
                      <LoaderCircle size={13} className="spin" />
                      Parsing
                    </>
                  ) : errorCount ? (
                    <>
                      <TriangleAlert size={13} />
                      {errorCount} errors
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} />
                      Structure checked
                    </>
                  )}
                </span>
              </div>
              {active.view === "explorer" && (
                <>
                  <div className="search-toolbar">
                    <div className="search-input">
                      <Search size={16} />
                      <input
                        aria-label="Search objects"
                        placeholder="Search names, descriptions, addresses…"
                        value={active.query}
                        onChange={(event) =>
                          updateActive({ query: event.target.value })
                        }
                      />
                      {active.query && (
                        <IconButton
                          label="Clear search"
                          onClick={() => updateActive({ query: "" })}
                        >
                          <X size={13} />
                        </IconButton>
                      )}
                    </div>
                    <label className="type-select">
                      <ListFilter size={15} />
                      <select
                        aria-label="Filter object type"
                        value={active.kind}
                        onChange={(event) =>
                          updateActive({ kind: event.target.value })
                        }
                      >
                        <option value="ALL">All object types</option>
                        {[...kindCounts.keys()].map((kind) => (
                          <option key={kind} value={kind}>
                            {displayKind(kind)}
                          </option>
                        ))}
                        <option value="BLOCKS">All blocks</option>
                      </select>
                    </label>
                    <button
                      ref={inspectorToggleRef}
                      className="inspector-toggle"
                      aria-label={inspectorOpen ? "Hide inspector" : "Show inspector"}
                      title={inspectorOpen ? "Hide inspector" : "Show inspector"}
                      aria-expanded={inspectorOpen}
                      aria-controls="object-inspector"
                      onClick={() => setInspectorOpen(!inspectorOpen)}
                    >
                      {inspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
                      <span>Inspector</span>
                    </button>
                  </div>
                  <div className="results-heading">
                    <span>
                      <strong>{filtered.length.toLocaleString()}</strong>{" "}
                      {showBlocks ? "blocks" : "objects"}
                      {active.query && <span> matching “{active.query}”</span>}
                    </span>
                    <span>
                      {active.kind === "ALL"
                        ? "All object types"
                        : active.kind === "BLOCKS"
                          ? "Document structure"
                          : displayKind(active.kind)}
                    </span>
                  </div>
                  <div className="explorer-body">
                    <div className="table-area">
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th className="name-column">
                                <button
                                  onClick={() =>
                                    setSortAscending(!sortAscending)
                                  }
                                >
                                  Name
                                  <ArrowUpDown size={12} />
                                </button>
                              </th>
                              <th>Type</th>
                              <th>Address</th>
                              <th>Unit</th>
                              <th>Range</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visible.map((node) => (
                              <tr
                                key={node.id}
                                className={
                                  node.id === selected?.id ? "row-selected" : ""
                                }
                                onClick={() => {
                                  updateActive({ selected: node.id });
                                  setInspectorOpen(true);
                                }}
                              >
                                <td>
                                  <button
                                    className="object-name"
                                    onClick={() => {
                                      updateActive({ selected: node.id });
                                      setInspectorOpen(true);
                                    }}
                                  >
                                    <span
                                      className={`object-icon ${node.kind === "CHARACTERISTIC" ? "blue" : node.kind === "COMPU_METHOD" ? "amber" : "green"}`}
                                    >
                                      {node.kind === "MEASUREMENT" ? (
                                        <Activity size={14} />
                                      ) : node.kind === "CHARACTERISTIC" ? (
                                        <SlidersHorizontal size={14} />
                                      ) : (
                                        <Box size={14} />
                                      )}
                                    </span>
                                    <span>
                                      <strong title={node.name}>{node.name}</strong>
                                      {objectDescription(node) && objectDescription(node) !== "Generated root interface signal" && <small>{objectDescription(node)}</small>}
                                    </span>
                                  </button>
                                </td>
                                <td>
                                  <span
                                    className={`type-chip ${node.kind === "CHARACTERISTIC" ? "blue" : node.kind === "COMPU_METHOD" ? "amber" : ""}`}
                                  >
                                    {node.kind === "MEASUREMENT"
                                      ? "Measurement"
                                      : node.kind === "CHARACTERISTIC"
                                        ? "Characteristic"
                                        : node.kind.replaceAll("_", " ")}
                                  </span>
                                </td>
                                <td>
                                  <code>{addressOf(node) || "—"}</code>
                                </td>
                                <td>{unitOf(node) || "—"}</td>
                                <td className="range-cell">
                                  {limitOf(node, "Lower limit")
                                    ? `${limitOf(node, "Lower limit")} … ${limitOf(node, "Upper limit")}`
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {visible.length === 0 && (
                          <div className="empty-results">
                            <Search size={28} />
                            <h3>
                              {busy
                                ? "Reading A2L structure…"
                                : "No matching objects"}
                            </h3>
                            <p>
                              {busy
                                ? "The document is being parsed locally."
                                : active.query
                                  ? "No results for this search."
                                  : "This category contains no objects."}
                            </p>
                            <button
                              className="quiet-button"
                              onClick={() =>
                                updateActive({
                                  query: "",
                                  kind: "BLOCKS",
                                  module: "ALL",
                                })
                              }
                            >
                              View all blocks
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="pagination">
                        <span>
                          {filtered.length ? visiblePage * pageSize + 1 : 0}–
                          {Math.min(
                            (visiblePage + 1) * pageSize,
                            filtered.length,
                          )}{" "}
                          of {filtered.length.toLocaleString()}
                        </span>
                        <div>
                          <IconButton
                            label="Previous page"
                            disabled={visiblePage === 0}
                            onClick={() => setPage(visiblePage - 1)}
                          >
                            <ArrowLeft size={14} />
                          </IconButton>
                          <span>
                            {visiblePage + 1} / {pageCount}
                          </span>
                          <IconButton
                            label="Next page"
                            disabled={visiblePage + 1 >= pageCount}
                            onClick={() => setPage(visiblePage + 1)}
                          >
                            <ArrowRight size={14} />
                          </IconButton>
                        </div>
                      </div>
                    </div>
                    {inspectorOpen && (
                      <aside
                        id="object-inspector"
                        aria-label="Object inspector"
                        onKeyDown={event => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            event.stopPropagation();
                            setInspectorOpen(false);
                            inspectorToggleRef.current?.focus();
                          }
                        }}
                        className={`inspector ${selected ? "has-selection" : ""} ${inspectorExpanded ? "expanded" : ""}`}
                      >
                        <div className="inspector-title">
                          <span>Inspector</span>
                          <div>
                            <IconButton
                              label={
                                inspectorExpanded
                                  ? "Narrow inspector"
                                  : "Widen inspector"
                              }
                              onClick={() =>
                                setInspectorExpanded(!inspectorExpanded)
                              }
                            >
                              {inspectorExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                            </IconButton>
                            <IconButton
                              label="Close inspector"
                              onClick={() => {
                                setInspectorOpen(false);
                                inspectorToggleRef.current?.focus();
                              }}
                            >
                              <X size={16} />
                            </IconButton>
                          </div>
                        </div>
                        {selected ? (
                          <>
                            <div className="inspector-object">
                              <h2 title={selected.name}>{selected.name}</h2>
                            </div>
                            <div className="inspector-tabs">
                              <button
                                className={
                                  inspectorTab === "properties"
                                    ? "selected"
                                    : ""
                                }
                                onClick={() => setInspectorTab("properties")}
                              >
                                Properties
                              </button>
                              <button
                                className={
                                  inspectorTab === "structure" ? "selected" : ""
                                }
                                onClick={() => setInspectorTab("structure")}
                              >
                                Structure
                              </button>
                            </div>
                            <div className="inspector-scroll">
                              {inspectorTab === "properties" ? (
                                <>
                                  {!busy ? (
                                    <FieldEditor
                                      key={`${selected.id}:${active.parsedSource}`}
                                      node={selected}
                                      source={active.source}
                                      onChange={changeSource}
                                      onError={setNotice}
                                    />
                                  ) : (
                                    <div className="inline-note">Updating…</div>
                                  )}
                                  <details className="metadata-details">
                                    <summary>Details</summary>
                                    <dl className="metadata">
                                      <div>
                                        <dt>ECU address</dt>
                                        <dd>
                                          <code>
                                            {addressOf(selected) ||
                                              "Not defined"}
                                          </code>
                                        </dd>
                                      </div>
                                      <div>
                                        <dt>Unit</dt>
                                        <dd>
                                          {unitOf(selected) || "Not defined"}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt>Line</dt>
                                        <dd>{selected.line}</dd>
                                      </div>
                                      <div>
                                        <dt>Module</dt>
                                        <dd>
                                          {nodeMap.get(moduleOf(selected))
                                            ?.name ?? "Outside module"}
                                        </dd>
                                      </div>
                                    </dl>
                                  </details>
                                  {conversionOf(selected) && (
                                    <button
                                      className="reference-link"
                                      onClick={() =>
                                        navigate(conversionOf(selected)!)
                                      }
                                    >
                                      <GitBranch size={14} />
                                      <span>
                                        {conversionOf(selected)!.name}
                                      </span>
                                      <ArrowRight size={14} />
                                    </button>
                                  )}
                                  <button
                                    className="source-link"
                                    disabled={busy}
                                    onClick={() =>
                                      updateActive({ view: "source", sourceTarget: { start: selected.start, end: selected.end } })
                                    }
                                  >
                                    <Code2 size={14} />
                                    Open source
                                    <ArrowRight size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {selected.parentId &&
                                    nodeMap.get(selected.parentId) && (
                                      <button
                                        className="structure-link"
                                        onClick={() =>
                                          navigate(
                                            nodeMap.get(selected.parentId!)!,
                                          )
                                        }
                                      >
                                        <ArrowLeft size={14} />
                                        {nodeMap.get(selected.parentId)?.kind}
                                      </button>
                                    )}
                                  {selected.children
                                    .map((id) => nodeMap.get(id)!)
                                    .filter(Boolean)
                                    .map((node) => (
                                      <button
                                        key={node.id}
                                        className="structure-link"
                                        onClick={() => navigate(node)}
                                      >
                                        <Braces size={14} />
                                        <span>{node.kind}</span>
                                        <ChevronRight size={14} />
                                      </button>
                                    ))}
                                  <details className="metadata-details">
                                    <summary>
                                      Tokens ({selected.tokens.length})
                                    </summary>
                                    <div className="token-list">
                                      {selected.tokens
                                        .slice(0, 250)
                                        .map((token, index) => (
                                          <div key={index}>
                                            <span>{index}</span>
                                            <code>{token.raw}</code>
                                          </div>
                                        ))}
                                    </div>
                                  </details>
                                </>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="empty-results">
                            <Box size={24} />
                            <p>Select an object.</p>
                          </div>
                        )}
                      </aside>
                    )}
                  </div>
                </>
              )}
              {active.view === "source" && (
                <div className="source-panel">
                  <div className="source-heading">
                    <span>
                      <FileCode2 size={14} />
                      {active.name}
                    </span>
                    <span>
                      {active.encoding.toUpperCase()}
                      <span className="text-divider">/</span>
                      {active.source.includes("\r\n")
                        ? "CRLF"
                        : active.source.includes("\r")
                          ? "CR"
                          : "LF"}
                    </span>
                  </div>
                  <Suspense
                    fallback={
                      <div className="empty-results">
                        <LoaderCircle className="spin" />
                        Loading editor…
                      </div>
                    }
                  >
                    <SourceEditor
                      key={active.id}
                      value={active.source}
                      onChange={changeSource}
                      target={active.sourceTarget}
                    />
                  </Suspense>
                </div>
              )}
              {active.view === "diagnostics" && (
                <div className="diagnostics-panel">
                  <div className="diagnostics-summary">
                    <ShieldCheck size={24} />
                    <div>
                      <h2>Document diagnostics</h2>
                      <p>
                        {errorCount} errors · {warningCount} warnings ·
                        Structural checks only
                      </p>
                    </div>
                    <button
                      className="outline-button small"
                      onClick={() =>
                        downloadFile(
                          active.name.replace(/\.[^.]+$/, "") +
                            "-diagnostics.json",
                          JSON.stringify(
                            {
                              file: active.name,
                              version: parsed.version,
                              scope: "structural",
                              diagnostics: parsed.diagnostics,
                            },
                            null,
                            2,
                          ),
                          "application/json",
                        )
                      }
                    >
                      <ArrowDownToLine size={14} />
                      Export report
                    </button>
                  </div>
                  <div className="validation-note">
                    Structural checks do not certify ASAM conformance, address
                    correctness, or safe ECU calibration. External includes are
                    not expanded.
                  </div>
                  {parsed.diagnostics.length ? (
                    parsed.diagnostics.map((item, index) => (
                      <button
                        className={`diagnostic-row ${item.severity}`}
                        key={index}
                        onClick={() => {
                          if (item.nodeId)
                            updateActive({
                              selected: item.nodeId,
                              view: "explorer",
                            });
                          else updateActive({ view: "source" });
                        }}
                      >
                        <TriangleAlert size={17} />
                        <div>
                          <strong>{item.message}</strong>
                          <span>
                            Line {item.line} · {item.severity}
                          </span>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    ))
                  ) : (
                    <div className="diagnostic-clear">
                      <CheckCircle2 size={36} />
                      <h3>No structural issues found</h3>
                      <p>Balanced blocks and readable headers.</p>
                    </div>
                  )}
                </div>
              )}
            </section>
          </main>
          <footer className="status-bar">
            <span>
              <span className={`live-dot ${errorCount ? "red" : ""}`} />
              {busy
                ? "Parsing document…"
                : active.source !== active.saved
                  ? "Unsaved changes"
                  : "Ready"}
              <span className="status-divider" />
              {parsed.nodes.length.toLocaleString()} blocks
              <span className="status-divider" />
              {parsed.diagnostics.length} diagnostics
            </span>
            <span>
              {active.encoding.toUpperCase()}
              <span className="status-divider" />
              ASAP2 {parsed.version}
              <span className="status-divider" />
              <ShieldCheck size={12} />
              Local only
            </span>
          </footer>
        </>
      )}
      {notice && (
        <div className="toast" role="status">
          <CircleHelp size={17} />
          <span>{notice}</span>
          <IconButton
            label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </IconButton>
        </div>
      )}
      {dragging && (
        <div className="drop-overlay">
          <Upload size={38} />
          <h2>Open A2L files</h2>
          <p>Drop files into your workspace</p>
        </div>
      )}
      {closing && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-title"
            className="modal"
          >
            <TriangleAlert size={26} />
            <h2 id="close-title">Discard unsaved changes?</h2>
            <p>
              {documents.find((document) => document.id === closing)?.name} has
              changes that have not been downloaded.
            </p>
            <div className="modal-actions">
              <button
                autoFocus
                className="outline-button"
                onClick={() => setClosing(null)}
              >
                Keep editing
              </button>
              <button
                className="danger-button"
                onClick={() => closeDocument(closing)}
              >
                Discard changes
              </button>
            </div>
          </section>
        </div>
      )}
      {learning && <Suspense fallback={null}><LearningGuide onClose={() => setLearning(false)} onAbout={() => { setLearning(false); setHelp(true); }} /></Suspense>}
      {help && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            className="modal"
          >
            <div className="modal-heading">
              <img src="/mark.svg" width="34" height="34" alt="" />
              <IconButton
                label="Close about dialog"
                onClick={() => setHelp(false)}
              >
                <X size={18} />
              </IconButton>
            </div>
            <h2 id="about-title">A2L Studio</h2>
            <p>Calibration workbench · v0.1.0</p>
            <dl className="about-details">
              <div>
                <dt>Storage</dt>
                <dd>In-memory, local session</dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd>Structural, not ASAM certification</dd>
              </div>
              <div>
                <dt>File limit</dt>
                <dd>50 MiB per document</dd>
              </div>
              <div>
                <dt>Includes</dt>
                <dd>Preserved, not expanded</dd>
              </div>
            </dl>
            <div className="modal-actions">
              <button
                className="outline-button"
                onClick={() => {
                  addDemo();
                  setHelp(false);
                }}
              >
                <Database size={16} />
                Open demo
              </button>
              <button
                autoFocus
                className="primary"
                onClick={() => setHelp(false)}
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Category({
  kind,
  active,
  count,
  onClick,
}: {
  kind: string;
  active: string;
  count: number;
  onClick: () => void;
}) {
  const icon =
    kind === "MEASUREMENT" ? (
      <Activity size={17} />
    ) : kind === "CHARACTERISTIC" ? (
      <SlidersHorizontal size={17} />
    ) : kind === "COMPU_METHOD" ? (
      <GitBranch size={17} />
    ) : kind === "GROUP" ? (
      <Layers3 size={17} />
    ) : kind === "FUNCTION" ? (
      <Braces size={17} />
    ) : (
      <Box size={17} />
    );
  return (
    <button
      className={`nav-item ${active === kind ? "selected" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{displayKind(kind)}</span>
      <span className="nav-count">{count}</span>
    </button>
  );
}

