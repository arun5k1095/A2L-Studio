import { expect, it } from 'vitest';
import { sourceRangeToEditorSelection } from './source-navigation';

it.each(['\n', '\r\n', '\r', '\r\n\n\r'])('maps exact source positions with %j line endings', newline => {
  const source = ['/* unicode: \u00b0C */', '/begin MODULE ECU ""', '/begin MEASUREMENT Target "" UWORD NO_COMPU_METHOD 1 0 0 100', '/end MEASUREMENT', '/end MODULE'].join(newline);
  const start = source.indexOf('/begin MEASUREMENT');
  const end = source.indexOf('/end MEASUREMENT') + '/end MEASUREMENT'.length;
  const selection = sourceRangeToEditorSelection(source, { start, end });
  const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  expect(normalized.slice(selection.anchor, selection.head)).toBe(source.slice(start, end).replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
});
it('clamps stale ranges to the current source', () => {
  expect(sourceRangeToEditorSelection('hello', { start: -20, end: 100 })).toEqual({ anchor: 0, head: 5 });
});
it('handles missing and reversed positions safely', () => {
  expect(sourceRangeToEditorSelection('hello', { start: NaN, end: Infinity })).toEqual({ anchor: 0, head: 0 });
  expect(sourceRangeToEditorSelection('hello', { start: 4, end: 1 })).toEqual({ anchor: 4, head: 4 });
});