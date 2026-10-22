import { createToken, Lexer, type IToken } from 'chevrotain';

const Space = createToken({ name: 'Space', pattern: /\s+/, group: Lexer.SKIPPED, line_breaks: true });
const Comment = createToken({ name: 'Comment', pattern: /\/\*[\s\S]*?\*\//, group: Lexer.SKIPPED, line_breaks: true });
const UnclosedComment = createToken({ name: 'UnclosedComment', pattern: /\/\*(?:(?!\*\/)[\s\S])*/, line_breaks: true });
const LineComment = createToken({ name: 'LineComment', pattern: /\/\/[^\r\n]*/, group: Lexer.SKIPPED });
const Begin = createToken({ name: 'Begin', pattern: /\/begin\b/ });
const End = createToken({ name: 'End', pattern: /\/end\b/ });
const Include = createToken({ name: 'Include', pattern: /\/include\b/ });
const Quoted = createToken({ name: 'Quoted', pattern: /"(?:[^"\\]|\\[\s\S])*"/, line_breaks: true });
const Atom = createToken({ name: 'Atom', pattern: /[^\s"/]+/ });
const Slash = createToken({ name: 'Slash', pattern: /\// });
const lexer = new Lexer([Space, Comment, UnclosedComment, LineComment, Begin, End, Include, Quoted, Atom, Slash]);

export interface SourceToken { value: string; raw: string; start: number; end: number; line: number; quoted: boolean }
export interface A2lNode {
  id: string;
  kind: string;
  name: string;
  start: number;
  end: number;
  line: number;
  parentId?: string;
  tokens: SourceToken[];
  children: string[];
}
export interface Diagnostic { severity: 'error' | 'warning' | 'info'; message: string; line: number; nodeId?: string }
export interface ParsedA2l { nodes: A2lNode[]; diagnostics: Diagnostic[]; version: string; includes: string[]; project: string }
export interface FieldDefinition { label: string; index: number; type: 'text' | 'number' | 'identifier' }

const text = (label: string, index: number): FieldDefinition => ({ label, index, type: 'text' });
const number = (label: string, index: number): FieldDefinition => ({ label, index, type: 'number' });
const identifier = (label: string, index: number): FieldDefinition => ({ label, index, type: 'identifier' });

export const FIELDS: Record<string, FieldDefinition[]> = {
  MEASUREMENT: [identifier('Name', 0), text('Description', 1), identifier('Data type', 2), identifier('Conversion', 3), number('Resolution', 4), number('Accuracy', 5), number('Lower limit', 6), number('Upper limit', 7)],
  CHARACTERISTIC: [identifier('Name', 0), text('Description', 1), identifier('Type', 2), number('Address', 3), identifier('Record layout', 4), number('Max. difference', 5), identifier('Conversion', 6), number('Lower limit', 7), number('Upper limit', 8)],
  AXIS_PTS: [identifier('Name', 0), text('Description', 1), number('Address', 2), identifier('Input quantity', 3), identifier('Record layout', 4), number('Max. difference', 5), identifier('Conversion', 6), number('Max. points', 7), number('Lower limit', 8), number('Upper limit', 9)],
  COMPU_METHOD: [identifier('Name', 0), text('Description', 1), identifier('Conversion type', 2), text('Format', 3), text('Unit', 4)],
  COMPU_TAB: [identifier('Name', 0), text('Description', 1), identifier('Conversion type', 2), number('Pairs', 3)],
  COMPU_VTAB: [identifier('Name', 0), text('Description', 1), identifier('Conversion type', 2), number('Pairs', 3)],
  COMPU_VTAB_RANGE: [identifier('Name', 0), text('Description', 1), number('Ranges', 2)],
  FUNCTION: [identifier('Name', 0), text('Description', 1)],
  GROUP: [identifier('Name', 0), text('Description', 1)],
  MODULE: [identifier('Name', 0), text('Description', 1)],
  PROJECT: [identifier('Name', 0), text('Description', 1)],
  RECORD_LAYOUT: [identifier('Name', 0)],
  UNIT: [identifier('Name', 0), text('Description', 1), text('Display', 2), identifier('Type', 3)],
  INSTANCE: [identifier('Name', 0), text('Description', 1), identifier('Type reference', 2), number('Address', 3)],
  TYPEDEF_MEASUREMENT: [identifier('Name', 0), text('Description', 1), identifier('Data type', 2), identifier('Conversion', 3), number('Resolution', 4), number('Accuracy', 5), number('Lower limit', 6), number('Upper limit', 7)],
};

export const OBJECT_KINDS = ['MEASUREMENT', 'CHARACTERISTIC', 'AXIS_PTS', 'COMPU_METHOD', 'COMPU_TAB', 'COMPU_VTAB', 'COMPU_VTAB_RANGE', 'RECORD_LAYOUT', 'FUNCTION', 'GROUP', 'UNIT', 'INSTANCE', 'BLOB', 'FRAME', 'TRANSFORMER', 'TYPEDEF_STRUCTURE', 'TYPEDEF_CHARACTERISTIC', 'TYPEDEF_MEASUREMENT', 'TYPEDEF_AXIS', 'TYPEDEF_BLOB'];

function sourceToken(token: IToken): SourceToken {
  const quoted = token.tokenType === Quoted;
  return { value: quoted ? token.image.slice(1, -1).replace(/\\(["\\])/g, '$1') : token.image, raw: token.image, start: token.startOffset, end: (token.endOffset ?? token.startOffset) + 1, line: token.startLine ?? 1, quoted };
}

/** Read balanced A2L blocks without discarding unknown syntax. Reports structural, not complete ASAM, validation. */
export function parseA2l(source: string): ParsedA2l {
  const lexed = lexer.tokenize(source);
  const diagnostics: Diagnostic[] = lexed.errors.map(error => ({ severity: 'error', message: error.message, line: error.line ?? 1 }));
  const nodes: A2lNode[] = [];
  const stack: A2lNode[] = [];
  const includes: string[] = [];
  const top: SourceToken[] = [];
  for (let index = 0; index < lexed.tokens.length; index++) {
    const token = lexed.tokens[index];
    if (token.tokenType === UnclosedComment) {
      diagnostics.push({ severity: 'error', message: 'Unterminated block comment.', line: token.startLine ?? 1 });
      continue;
    }
    if (token.tokenType === Include) {
      const path = lexed.tokens[index + 1];
      if (path?.tokenType === Quoted || path?.tokenType === Atom) {
        includes.push(sourceToken(path).value);
        diagnostics.push({ severity: 'warning', message: `External include "${sourceToken(path).value}" is not expanded. Open the referenced file separately.`, line: token.startLine ?? 1 });
        index++;
      } else diagnostics.push({ severity: 'error', message: 'Missing /include path.', line: token.startLine ?? 1 });
      continue;
    }
    if (token.tokenType === Begin) {
      const kind = lexed.tokens[index + 1];
      if (!kind || kind.tokenType !== Atom) {
        diagnostics.push({ severity: 'error', message: 'Missing block type after /begin.', line: token.startLine ?? 1 });
        continue;
      }
      const parent = stack.at(-1);
      const node: A2lNode = { id: `node-${token.startOffset}`, kind: kind.image, name: '', start: token.startOffset, end: source.length, line: token.startLine ?? 1, parentId: parent?.id, tokens: [], children: [] };
      parent?.children.push(node.id);
      nodes.push(node);
      stack.push(node);
      index++;
      continue;
    }
    if (token.tokenType === End) {
      const kind = lexed.tokens[index + 1];
      const current = stack.at(-1);
      if (!kind || kind.tokenType !== Atom) {
        diagnostics.push({ severity: 'error', message: 'Missing block type after /end.', line: token.startLine ?? 1 });
        continue;
      }
      if (!current || current.kind !== kind.image) {
        diagnostics.push({ severity: 'error', message: `Unexpected /end ${kind.image}${current ? `; expected ${current.kind}` : ''}.`, line: token.startLine ?? 1, nodeId: current?.id });
      } else {
        current.end = (kind.endOffset ?? kind.startOffset) + 1;
        stack.pop();
      }
      index++;
      continue;
    }
    const current = stack.at(-1);
    (current ? current.tokens : top).push(sourceToken(token));
  }
  for (const node of stack) diagnostics.push({ severity: 'error', message: `Unclosed ${node.kind} block.`, line: node.line, nodeId: node.id });
  const named = new Map<string, A2lNode>();
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  for (const node of nodes) {
    node.name = node.tokens[0]?.value ?? node.kind;
    if (!OBJECT_KINDS.includes(node.kind)) continue;
    let owner: A2lNode | undefined = node;
    while (owner && owner.kind !== 'MODULE') owner = owner.parentId ? nodeMap.get(owner.parentId) : undefined;
    const key = `${owner?.id ?? 'global'}:${node.kind}:${node.name}`;
    if (named.has(key)) diagnostics.push({ severity: 'warning', message: `Duplicate ${node.kind} name "${node.name}" in this module.`, line: node.line, nodeId: node.id });
    named.set(key, node);
    const schema = FIELDS[node.kind];
    if (schema && node.tokens.length < schema.length) diagnostics.push({ severity: 'error', message: `${node.kind} has fewer than ${schema.length} required header values.`, line: node.line, nodeId: node.id });
  }
  const versionIndex = top.findIndex(token => token.value === 'ASAP2_VERSION');
  const version = versionIndex >= 0 ? `${top[versionIndex + 1]?.value ?? '?'}.${top[versionIndex + 2]?.value ?? '?'}` : 'Not declared';
  if (versionIndex < 0) diagnostics.push({ severity: 'info', message: 'ASAP2_VERSION is not declared; the file may be an include fragment.', line: 1 });
  return { nodes, diagnostics, version, includes, project: nodes.find(node => node.kind === 'PROJECT')?.name ?? 'A2L document' };
}

/** Replace exactly one header value; all source outside its token range remains unchanged. */
export function editField(source: string, node: A2lNode, field: FieldDefinition, value: string): string {
  const token = node.tokens[field.index];
  if (!token) throw new Error('This field is absent. Edit the source to repair the header.');
  if (value.length > 65536) throw new Error('Field value exceeds 65,536 characters.');
  if (field.type === 'number' && !/^[+-]?(?:0[xX][\da-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/.test(value)) throw new Error('Enter a decimal, hexadecimal, or scientific-notation number.');
  if (field.type === 'identifier' && (!value || /[\s"/\u0000-\u001f]/.test(value))) throw new Error('Identifiers cannot contain whitespace, quotes, slashes, or control characters.');
  const replacement = field.type === 'text' || token.quoted ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : value;
  return source.slice(0, token.start) + replacement + source.slice(token.end);
}

export function optionalValue(node: A2lNode, keyword: string): string {
  const start = FIELDS[node.kind]?.length ?? 0;
  const index = node.tokens.findIndex((token, position) => position >= start && !token.quoted && token.value === keyword);
  return index >= 0 ? node.tokens[index + 1]?.value ?? '' : '';
}

export function objectDescription(node: A2lNode): string {
  return node.tokens[1]?.quoted ? node.tokens[1].value : '';
}