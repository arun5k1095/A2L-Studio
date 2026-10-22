import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { sourceRangeToEditorSelection, type SourceRange } from "./source-navigation";

function revealSource(view: EditorView, source: string, target: SourceRange) {
  const selection = sourceRangeToEditorSelection(source, target);
  view.dispatch({ selection, effects: EditorView.scrollIntoView(selection.anchor, { y: 'center' }) });
  view.focus();
}

/** Render the on-demand source editor, retaining every edit in the owning document. */
export default function SourceEditor({
  value,
  onChange,
  target,
}: {
  value: string;
  onChange: (source: string) => void;
  target?: SourceRange;
}) {
  const viewRef = useRef<EditorView | null>(null);
  const frameRef = useRef<number | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (viewRef.current && target) revealSource(viewRef.current, value, target);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target]);
  return (
    <div className="source-editor-host">
    <CodeMirror
      value={value}
      height="100%"
      extensions={[cpp()]}
      onChange={onChange}
      onCreateEditor={view => {
        viewRef.current = view;
        if (target) frameRef.current = requestAnimationFrame(() => revealSource(view, value, target));
      }}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        searchKeymap: true,
      }}
      aria-label="A2L source editor"
    />
    </div>
  );
}
