export interface SourceRange { start: number; end: number }

/** Map original source offsets to CodeMirror's normalized-newline document positions. */
export function sourceRangeToEditorSelection(source: string, range: SourceRange): { anchor: number; head: number } {
  const start = Math.max(0, Math.min(source.length, Number.isFinite(range.start) ? range.start : 0));
  const end = Math.max(start, Math.min(source.length, Number.isFinite(range.end) ? range.end : start));
  return {
    anchor: source.slice(0, start).replace(/\r\n/g, '\n').length,
    head: source.slice(0, end).replace(/\r\n/g, '\n').length,
  };
}