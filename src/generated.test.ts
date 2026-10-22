import { describe, expect, it } from 'vitest';
import { editField, FIELDS, objectDescription, optionalValue, parseA2l } from './a2l';
import { decodeFile, encodeFile, type DecodedFile, type FileEncoding } from './files';

const versions = [0, 20, 21, 30, 31, 40, 50, 51, 60, 61, 70, 71];
const newlines = ['\n', '\r\n', '\r'] as const;
const numericForms = ['-0x2A', '+0X2f', '-1.25e-3', '+.5E+2', '1.', '0', '2E3', '-.125'];
const quote = (value: string): string => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const errors = (parsed: ReturnType<typeof parseA2l>) => parsed.diagnostics.filter(item => item.severity === 'error');
const lineAt = (source: string, offset: number): number => source.slice(0, offset).split(/\r\n|\r|\n/).length;

function measurement(name: string, description: string, separator: string, newline: string, variant: number) {
  const values = [name, description, 'SWORD', 'NO_COMPU_METHOD', '1', numericForms[variant], '-0x80', '+1.27E+2'];
  const rawValues = values.map((value, index) => index === 1 ? quote(value) : value);
  const source = `/begin MEASUREMENT${separator}${rawValues.join(separator)}${newline}`
    + `\tECU_ADDRESS 0x1234 /* address stays intact */${newline}`
    + `\tFORMAT "%6.2"${newline}/end MEASUREMENT`;
  return { name, description, values, rawValues, source };
}

function documentFixture(minor: number, newline: string, variant: number) {
  const id = `V${minor}_N${newlines.indexOf(newline as typeof newlines[number])}_W${variant}`;
  const separators = [' ', '\t', '  ', ' \t ', newline, `${newline}\t`, ' /* gap */ ', '\t/* /begin FAKE */ '];
  const description = `Temperature ${id}: \u00e9 \u00b0C \u20ac \\path "quoted" /end MODULE // text`;
  const measurements = ['A', 'B'].map(suffix => measurement(`${id}_${suffix}`, description, separators[variant], newline, variant));
  const includes = [`shared/common_${id}.a2l`, `vendor\\cal_${id}.a2l`];
  const depth = variant % 4 + 1;
  const source = [
    `ASAP2_VERSION 1 ${minor}`,
    `/* ${quote(description)} /begin FAKE /end PROJECT */`,
    `/include ${quote(includes[0])}`,
    `/begin PROJECT Project_${id} "Generated project"`,
    '/begin MODULE ECU "Generated module"',
    `// /begin IGNORED "unterminated string in a comment`,
    measurements[0].source,
    ...Array.from({ length: depth }, (_, index) => `/begin VENDOR_${index} "payload /end VENDOR_${index}" -0x1`),
    '/begin EMPTY_VENDOR /end EMPTY_VENDOR',
    ...Array.from({ length: depth }, (_, index) => `/end VENDOR_${depth - index - 1}`),
    `/include ${quote(includes[1])}`,
    measurements[1].source,
    '/end MODULE',
    '/end PROJECT',
    '/* trailing bytes must survive */',
    '',
  ].join(newline);
  return { id, minor, newline, variant, source, measurements, includes, depth };
}

const documents = versions.flatMap(minor => newlines.flatMap(newline =>
  Array.from({ length: 8 }, (_, variant) => documentFixture(minor, newline, variant))));

const encodings: { label: string; encoding: FileEncoding; bom: boolean }[] = [
  { label: 'UTF-8 without BOM', encoding: 'utf-8', bom: false },
  { label: 'UTF-8 with BOM', encoding: 'utf-8', bom: true },
  { label: 'UTF-16LE with BOM', encoding: 'utf-16le', bom: true },
  { label: 'UTF-16BE with BOM', encoding: 'utf-16be', bom: true },
  { label: 'Windows-1252', encoding: 'windows-1252', bom: false },
];

function referenceBytes(file: DecodedFile): Uint8Array {
  if (file.encoding === 'utf-8') {
    return new Uint8Array([...(file.bom ? [0xef, 0xbb, 0xbf] : []), ...new TextEncoder().encode(file.source)]);
  }
  if (file.encoding === 'windows-1252') {
    const extended = new Map([['\u00e9', 0xe9], ['\u00b0', 0xb0], ['\u20ac', 0x80]]);
    return new Uint8Array(Array.from(file.source, character => {
      const code = character.charCodeAt(0);
      if (code < 0x80) return code;
      const byte = extended.get(character);
      if (byte === undefined) throw new Error(`Unsupported reference fixture character: ${character}`);
      return byte;
    }));
  }
  const littleEndian = file.encoding === 'utf-16le';
  const body = Array.from({ length: file.source.length }, (_, index) => {
    const code = file.source.charCodeAt(index);
    return littleEndian ? [code & 0xff, code >>> 8] : [code >>> 8, code & 0xff];
  }).flat();
  return new Uint8Array([...(file.bom ? littleEndian ? [0xff, 0xfe] : [0xfe, 0xff] : []), ...body]);
}

describe('deterministic generated structural documents (not version-specific semantic validation)', () => {
  it('generates 288 distinct source files across twelve declarations and three newline styles', () => {
    expect(documents).toHaveLength(288);
    expect(new Set(documents.map(fixture => fixture.source)).size).toBe(288);
  });

  it.each(documents)('$id preserves structure, values, ranges, and include warnings', fixture => {
    const parsed = parseA2l(fixture.source);
    expect(errors(parsed)).toEqual([]);
    expect(parsed.version).toBe(`1.${fixture.minor}`);
    expect(parsed.project).toBe(`Project_${fixture.id}`);
    expect(parsed.includes).toEqual(fixture.includes);
    expect(parsed.diagnostics.map(item => item.severity)).toEqual(['warning', 'warning']);
    expect(parsed.diagnostics.every(item => item.message.includes('not expanded'))).toBe(true);
    expect(parsed.nodes).toHaveLength(5 + fixture.depth);
    expect(new Set(parsed.nodes.map(node => node.id)).size).toBe(parsed.nodes.length);

    const byId = new Map(parsed.nodes.map(node => [node.id, node]));
    for (const node of parsed.nodes) {
      expect(node.line).toBe(lineAt(fixture.source, node.start));
      expect(fixture.source.slice(node.start, node.end)).toMatch(new RegExp(`^/begin ${node.kind}[\\s\\S]*/end ${node.kind}$`));
      if (node.parentId) {
        const parent = byId.get(node.parentId)!;
        expect(parent.children).toContain(node.id);
        expect(node.start).toBeGreaterThan(parent.start);
        expect(node.end).toBeLessThan(parent.end);
      }
      for (const token of node.tokens) {
        expect(fixture.source.slice(token.start, token.end)).toBe(token.raw);
        expect(token.start).toBeGreaterThan(node.start);
        expect(token.end).toBeLessThan(node.end);
        expect(token.line).toBe(lineAt(fixture.source, token.start));
      }
    }
    expect(parsed.nodes.find(node => node.kind === 'EMPTY_VENDOR')?.tokens).toEqual([]);
    expect(parsed.nodes.filter(node => node.kind === 'MEASUREMENT')).toHaveLength(2);
    for (const expected of fixture.measurements) {
      const node = parsed.nodes.find(candidate => candidate.name === expected.name)!;
      expect(node.start).toBe(fixture.source.indexOf(expected.source));
      expect(node.end).toBe(node.start + expected.source.length);
      expect(node.tokens.slice(0, 8).map(token => token.value)).toEqual(expected.values);
      expect(node.tokens).toHaveLength(12);
      expect(objectDescription(node)).toBe(expected.description);
      expect(optionalValue(node, 'ECU_ADDRESS')).toBe('0x1234');
      expect(optionalValue(node, 'FORMAT')).toBe('%6.2');
      expect(optionalValue(node, 'ABSENT')).toBe('');
      let cursor = node.start + '/begin MEASUREMENT'.length;
      for (const [index, raw] of expected.rawValues.entries()) {
        const start = fixture.source.indexOf(raw, cursor);
        expect(node.tokens[index]).toMatchObject({ raw, start, end: start + raw.length, quoted: index === 1 });
        cursor = start + raw.length;
      }
    }
  });

  it.each(documents)('$id edits exactly one independently located header token', fixture => {
    const original = parseA2l(fixture.source);
    const expected = fixture.measurements[1];
    const node = original.nodes.find(candidate => candidate.name === expected.name)!;
    let cursor = fixture.source.indexOf(expected.source) + '/begin MEASUREMENT'.length;
    for (const field of FIELDS.MEASUREMENT) {
      const raw = expected.rawValues[field.index];
      const start = fixture.source.indexOf(raw, cursor);
      cursor = start + raw.length;
      const value = field.type === 'identifier' ? `Edited_${fixture.id}_${field.index}`
        : field.type === 'text' ? `Edited "quoted" \\path${fixture.newline}/end MODULE \u00e9`
          : numericForms[(fixture.variant + field.index) % numericForms.length];
      const replacement = field.type === 'text' ? quote(value) : value;
      const edited = editField(fixture.source, node, field, value);
      expect(edited).toBe(fixture.source.slice(0, start) + replacement + fixture.source.slice(start + raw.length));
      const reparsed = parseA2l(edited);
      expect(errors(reparsed)).toEqual([]);
      expect(reparsed.includes).toEqual(fixture.includes);
      expect(reparsed.nodes).toHaveLength(original.nodes.length);
      const editedNode = reparsed.nodes.filter(candidate => candidate.kind === 'MEASUREMENT')[1];
      expect(editedNode.tokens[field.index].value).toBe(value);
      expect(editedNode.tokens.map(token => token.value)).toEqual(node.tokens.map((token, index) => index === field.index ? value : token.value));
    }
  });

  it.each(documents)('$id preserves original and edited bytes in five supported encodings', fixture => {
    const node = parseA2l(fixture.source).nodes.find(candidate => candidate.name === fixture.measurements[1].name)!;
    const edited = editField(fixture.source, node, FIELDS.MEASUREMENT[1], 'Edited \u00e9 \u00b0C \u20ac "quoted" \\path');
    for (const format of encodings) {
      for (const source of [fixture.source, edited]) {
        const file = { source, encoding: format.encoding, bom: format.bom };
        const bytes = referenceBytes(file);
        const decoded = decodeFile(bytes);
        expect(decoded, format.label).toEqual(file);
        expect(encodeFile(decoded), format.label).toEqual(bytes);
        expect(encodeFile(file), format.label).toEqual(bytes);
      }
    }
  });
});

describe('generated duplicate ownership and empty blocks', () => {
  it.each(newlines.map((newline, index) => ({ newline, label: ['LF', 'CRLF', 'CR'][index] })))('$label scopes duplicates by module and object kind', ({ newline }) => {
    const first = measurement('Repeated', 'first', ' ', newline, 0).source;
    const second = measurement('Repeated', 'second', '\t', newline, 1).source;
    const source = [
      '/begin PROJECT P ""', '/begin MODULE A ""', first, second,
      '/begin CHARACTERISTIC Repeated "" VALUE 0x100 Layout 0 NO_COMPU_METHOD -1 1 /end CHARACTERISTIC',
      '/end MODULE', '/begin MODULE B ""', first, '/end MODULE', '/end PROJECT',
    ].join(newline);
    const parsed = parseA2l(source);
    expect(errors(parsed)).toEqual([]);
    const warnings = parsed.diagnostics.filter(item => item.severity === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toBe('Duplicate MEASUREMENT name "Repeated" in this module.');
    const duplicate = parsed.nodes.filter(node => node.kind === 'MEASUREMENT')[1];
    expect(warnings[0]).toMatchObject({ nodeId: duplicate.id, line: lineAt(source, duplicate.start) });
    const edited = editField(source, duplicate, FIELDS.MEASUREMENT[0], 'Distinct');
    expect(parseA2l(edited).diagnostics.filter(item => item.severity === 'warning')).toEqual([]);
  });

  it.each(['VENDOR', 'IF_DATA', 'MODULE', 'MEASUREMENT', 'CHARACTERISTIC'])('handles empty %s structurally', kind => {
    const source = `/begin ${kind}\t/end ${kind}`;
    const parsed = parseA2l(source);
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0]).toMatchObject({ kind, name: kind, start: 0, end: source.length, tokens: [], children: [] });
    const headerRequired = kind === 'MEASUREMENT' || kind === 'CHARACTERISTIC';
    expect(errors(parsed)).toHaveLength(headerRequired ? 1 : 0);
    if (headerRequired) expect(errors(parsed)[0].message).toContain('required header values');
  });
});

const truncations = [
  { label: 'bare begin', source: '/begin', message: 'Missing block type after /begin.' },
  { label: 'bare end', source: '/end', message: 'Missing block type after /end.' },
  { label: 'missing include path', source: '/include', message: 'Missing /include path.' },
  { label: 'open project', source: '/begin PROJECT P ""', message: 'Unclosed PROJECT block.' },
  { label: 'open measurement header', source: '/begin MEASUREMENT Speed', message: 'required header values' },
  { label: 'open nested vendor', source: '/begin PROJECT P ""\n/begin VENDOR X', message: 'Unclosed VENDOR block.' },
  { label: 'truncated closing marker', source: '/begin PROJECT P ""\n/end', message: 'Missing block type after /end.' },
  { label: 'mismatched closing type', source: '/begin PROJECT P ""\n/end MODULE', message: 'Unexpected /end MODULE' },
  { label: 'orphan closing marker', source: '/end PROJECT', message: 'Unexpected /end PROJECT' },
];

describe('deterministic malformed and truncated input', () => {
  it.each(truncations.flatMap(fixture => newlines.map((newline, index) => ({
    ...fixture, source: fixture.source.replace(/\n/g, newline), label: `${fixture.label} newline-${index}`,
  }))))('$label reports its structural error', fixture => {
    const parsed = parseA2l(fixture.source);
    expect(errors(parsed).some(item => item.message.includes(fixture.message))).toBe(true);
    for (const node of parsed.nodes) {
      expect(node.start).toBeGreaterThanOrEqual(0);
      expect(node.end).toBeLessThanOrEqual(fixture.source.length);
      expect(node.end).toBeGreaterThanOrEqual(node.start);
    }
  });

  it.each(['"unfinished', '"escaped \\"quote', '"trailing backslash\\'])('reports an unterminated quoted token: %s', tail => {
    expect(errors(parseA2l(`ASAP2_VERSION 1 71\n/begin PROJECT P "" /end PROJECT\n${tail}`)).length).toBeGreaterThan(0);
  });

  it.each([
    { label: 'minimal comment opener', source: '/*' },
    { label: 'comment after a complete document', source: 'ASAP2_VERSION 1 71\n/begin PROJECT P "" /end PROJECT\n/* unfinished' },
    { label: 'closing marker inside an unfinished comment', source: 'ASAP2_VERSION 1 71\n/begin PROJECT P ""\n/* /end PROJECT' },
  ])('$label reports an unterminated block comment', ({ source }) => {
    expect(errors(parseA2l(source)).length).toBeGreaterThan(0);
  });

  it.each(['NaN', 'Infinity', '0x', '1e', '1e+', '--1', '1 2', '0xGG', '1; /end MODULE'])('rejects invalid numeric edit %s without modifying source', value => {
    const source = documents[0].source;
    const node = parseA2l(source).nodes.find(candidate => candidate.kind === 'MEASUREMENT')!;
    expect(() => editField(source, node, FIELDS.MEASUREMENT[7], value)).toThrow('number');
    expect(parseA2l(source).nodes.find(candidate => candidate.kind === 'MEASUREMENT')?.tokens[7].raw).toBe('+1.27E+2');
  });

  it.each(['', 'bad name', 'bad/name', 'bad"name', 'bad\nname', 'bad\u0000name'])('rejects invalid identifier edit %j', value => {
    const source = documents[0].source;
    const node = parseA2l(source).nodes.find(candidate => candidate.kind === 'MEASUREMENT')!;
    expect(() => editField(source, node, FIELDS.MEASUREMENT[0], value)).toThrow('Identifiers');
  });

  it('rejects absent fields and excessive values while allowing the exact size limit', () => {
    const source = '/begin MEASUREMENT X /end MEASUREMENT';
    const node = parseA2l(source).nodes[0];
    expect(() => editField(source, node, FIELDS.MEASUREMENT[1], 'description')).toThrow('absent');
    expect(() => editField(source, node, FIELDS.MEASUREMENT[0], 'X'.repeat(65537))).toThrow('65,536');
    const edited = editField(source, node, FIELDS.MEASUREMENT[0], 'X'.repeat(65536));
    expect(parseA2l(edited).nodes[0].name).toHaveLength(65536);
  });
});

describe('generated large document', () => {
  it('reads 10,000 measurements and edits the last one without changing earlier bytes', () => {
    const blocks = Array.from({ length: 10000 }, (_, index) =>
      `/begin MEASUREMENT Signal_${index} "Signal ${index}" UWORD NO_COMPU_METHOD 1 0 -0x10 1e3\r\n/end MEASUREMENT`);
    const prefix = 'ASAP2_VERSION 1 71\r\n/begin PROJECT Large ""\r\n/begin MODULE ECU ""\r\n';
    const source = prefix + blocks.join('\r\n') + '\r\n/end MODULE\r\n/end PROJECT\r\n';
    const parsed = parseA2l(source);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.nodes).toHaveLength(10002);
    expect(parsed.nodes[1].children).toHaveLength(10000);
    let start = prefix.length;
    for (const [index, block] of blocks.entries()) {
      const node = parsed.nodes[index + 2];
      expect(node).toMatchObject({ name: `Signal_${index}`, start, end: start + block.length, parentId: parsed.nodes[1].id });
      start += block.length + 2;
    }
    const tokenStart = source.lastIndexOf('"Signal 9999"');
    const edited = editField(source, parsed.nodes[10001], FIELDS.MEASUREMENT[1], 'Last "signal"');
    expect(edited).toBe(source.slice(0, tokenStart) + '"Last \\"signal\\""' + source.slice(tokenStart + '"Signal 9999"'.length));
    expect(parseA2l(edited).nodes[10001].tokens[1].value).toBe('Last "signal"');
  });
});

describe('independent byte fixtures and encoding boundaries', () => {
  it.each([
    { label: 'UTF-8 BOM', bytes: [0xef, 0xbb, 0xbf, 0x41, 0xc3, 0xa9, 0x0d, 0x0a], source: 'A\u00e9\r\n', encoding: 'utf-8' as const, bom: true },
    { label: 'UTF-16LE BOM', bytes: [0xff, 0xfe, 0x41, 0, 0xe9, 0, 0x0d, 0, 0x0a, 0], source: 'A\u00e9\r\n', encoding: 'utf-16le' as const, bom: true },
    { label: 'UTF-16BE BOM', bytes: [0xfe, 0xff, 0, 0x41, 0, 0xe9, 0, 0x0d, 0, 0x0a], source: 'A\u00e9\r\n', encoding: 'utf-16be' as const, bom: true },
    { label: 'Windows-1252 punctuation', bytes: [0x80, 0x91, 0x92, 0x93, 0x94, 0x96, 0x97, 0xb0, 0xe9, 0x0d], source: '\u20ac\u2018\u2019\u201c\u201d\u2013\u2014\u00b0\u00e9\r', encoding: 'windows-1252' as const, bom: false },
  ])('$label decodes and re-encodes exact known bytes', ({ bytes, source, encoding, bom }) => {
    const input = new Uint8Array(bytes);
    expect(decodeFile(input)).toEqual({ source, encoding, bom });
    expect(encodeFile(decodeFile(input))).toEqual(input);
  });

  it.each(encodings.filter(format => format.encoding !== 'windows-1252'))('$label preserves non-BMP characters and UTF-16 token offsets', format => {
    const source = 'ASAP2_VERSION 1 71\r\n/* \u{1f680} e\u0301 */\r\n'
      + measurement('Unicode', '\u6e29\u5ea6 \u{1f680} "quoted"', ' ', '\r\n', 0).source;
    const file = { source, encoding: format.encoding, bom: format.bom };
    const bytes = referenceBytes(file);
    expect(decodeFile(bytes)).toEqual(file);
    expect(encodeFile(decodeFile(bytes))).toEqual(bytes);
    const node = parseA2l(source).nodes[0];
    const raw = quote('\u6e29\u5ea6 \u{1f680} "quoted"');
    const start = source.indexOf(raw);
    expect(node.tokens[1]).toMatchObject({ start, end: start + raw.length, raw });
    expect(editField(source, node, FIELDS.MEASUREMENT[1], '\u{1f680} edited')).toBe(source.slice(0, start) + quote('\u{1f680} edited') + source.slice(start + raw.length));
  });

  it.each(encodings.filter(format => format.bom))('$label preserves a leading content U+FEFF after the encoding BOM', format => {
    const file = { source: '\ufeffASAP2_VERSION 1 71\n', encoding: format.encoding, bom: true };
    const bytes = referenceBytes(file);
    expect(encodeFile(decodeFile(bytes))).toEqual(bytes);
  });

  it.each([
    { label: 'NUL UTF-8', bytes: [0x41, 0, 0x42] },
    { label: 'NUL legacy fallback', bytes: [0xe9, 0] },
    { label: 'odd-length UTF-16LE', bytes: [0xff, 0xfe, 0x41] },
    { label: 'odd-length UTF-16BE', bytes: [0xfe, 0xff, 0x41] },
    { label: 'invalid BOM-marked UTF-8', bytes: [0xef, 0xbb, 0xbf, 0xff] },
    { label: 'UTF-32LE', bytes: [0xff, 0xfe, 0, 0, 0x41, 0, 0, 0] },
    { label: 'UTF-32BE', bytes: [0, 0, 0xfe, 0xff, 0, 0, 0, 0x41] },
  ])('rejects $label', ({ bytes }) => {
    expect(() => decodeFile(new Uint8Array(bytes))).toThrow();
  });

  it.each(['\u6e29', '\u{1f680}', 'e\u0301'])('rejects unrepresentable Windows-1252 text %s', source => {
    expect(() => encodeFile({ source, encoding: 'windows-1252', bom: false })).toThrow('cannot be saved');
  });

  it('preserves an empty byte stream without inventing a version', () => {
    const bytes = new Uint8Array();
    const file = decodeFile(bytes);
    expect(file).toEqual({ source: '', encoding: 'utf-8', bom: false });
    expect(encodeFile(file)).toEqual(bytes);
    expect(parseA2l(file.source)).toMatchObject({ nodes: [], includes: [], version: 'Not declared' });
    expect(errors(parseA2l(file.source))).toEqual([]);
  });
});