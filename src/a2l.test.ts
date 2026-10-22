import { describe, expect, it } from 'vitest';
import { editField, FIELDS, parseA2l } from './a2l';

const measurement = '/begin MEASUREMENT Speed "Vehicle speed" UWORD SpeedConversion 1 0 0 250\r\n ECU_ADDRESS 0x1234\r\n/end MEASUREMENT';
const wrap = (content: string) => `ASAP2_VERSION 1 71\r\n/begin PROJECT Test "Project"\r\n/begin MODULE ECU "Module"\r\n${content}\r\n/end MODULE\r\n/end PROJECT\r\n`;

describe('lossless structural A2L reader', () => {
  it('reads version, nested blocks and header values', () => {
    const parsed = parseA2l(wrap(measurement));
    expect(parsed.version).toBe('1.71');
    expect(parsed.nodes.map(node => node.kind)).toEqual(['PROJECT', 'MODULE', 'MEASUREMENT']);
    expect(parsed.diagnostics).toEqual([]);
  });
  it('does not interpret block markers in comments or strings', () => {
    const parsed = parseA2l(wrap('/* /begin BAD */\n// /end BAD\n' + measurement.replace('Vehicle speed', '/end MODULE \\"quoted\\"')));
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.diagnostics).toEqual([]);
  });
  it('preserves unknown vendor syntax and nested IF_DATA', () => {
    const parsed = parseA2l(wrap('/begin IF_DATA XCP\n/begin VENDOR_EXTENSION "x" 42 /end VENDOR_EXTENSION\n/end IF_DATA'));
    expect(parsed.nodes.at(-1)?.kind).toBe('VENDOR_EXTENSION');
    expect(parsed.diagnostics).toEqual([]);
  });
  it('changes only the selected token, preserving CRLF and comments', () => {
    const source = wrap(measurement + '\r\n/* untouched */');
    const node = parseA2l(source).nodes[2];
    const edited = editField(source, node, FIELDS.MEASUREMENT[1], 'New "description"');
    expect(edited).toBe(source.replace('"Vehicle speed"', '"New \\"description\\""'));
  });
  it('reports mismatched and unclosed blocks without crashing', () => {
    const parsed = parseA2l('/begin MODULE ECU ""\n/end PROJECT');
    expect(parsed.diagnostics.filter(item => item.severity === 'error')).toHaveLength(2);
  });
  it('reports unterminated strings', () => {
    expect(parseA2l('/begin PROJECT X "broken').diagnostics.some(item => item.severity === 'error')).toBe(true);
  });
  it('reports includes rather than silently pretending to expand them', () => {
    const parsed = parseA2l('/include "shared.a2l"');
    expect(parsed.includes).toEqual(['shared.a2l']);
    expect(parsed.diagnostics.some(item => item.message.includes('not expanded'))).toBe(true);
  });
  it('allows duplicate names in different modules', () => {
    expect(parseA2l(wrap(measurement) + wrap(measurement)).diagnostics).toEqual([]);
  });
  it('reports duplicate names within the same module', () => {
    expect(parseA2l(wrap(measurement + '\n' + measurement)).diagnostics[0].message).toContain('Duplicate');
  });
  it('rejects invalid numeric and identifier edits', () => {
    const source = wrap(measurement);
    const node = parseA2l(source).nodes[2];
    expect(() => editField(source, node, FIELDS.MEASUREMENT[6], 'NaN')).toThrow();
    expect(() => editField(source, node, FIELDS.MEASUREMENT[0], 'bad name')).toThrow();
  });
  it('supports old versions, include fragments, and scientific numbers', () => {
    const source = measurement;
    const node = parseA2l(source).nodes[0];
    expect(editField(source, node, FIELDS.MEASUREMENT[7], '2.5e+2')).toContain('2.5e+2');
    expect(parseA2l('ASAP2_VERSION 1 31\n' + source).version).toBe('1.31');
    expect(parseA2l(source).version).toBe('Not declared');
  });
  it('supports deeply nested blocks without recursive parsing', () => {
    const source = '/begin X\n'.repeat(2000) + '/end X\n'.repeat(2000);
    expect(parseA2l(source).nodes).toHaveLength(2000);
  });
});