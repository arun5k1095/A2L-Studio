import { describe, expect, it } from 'vitest';
import { decodeFile, encodeFile, type FileEncoding } from './files';

describe('encoding-preserving file I/O', () => {
  it.each(['utf-8', 'utf-16le', 'utf-16be', 'windows-1252'] as FileEncoding[])('round trips %s', encoding => {
    const original = { source: 'ASAP2_VERSION 1 71\r\n/* temp: 20 \u00b0C, \u20ac */', encoding, bom: encoding !== 'windows-1252' };
    const bytes = encodeFile(original);
    expect(decodeFile(bytes)).toEqual(original);
    expect(encodeFile(decodeFile(bytes))).toEqual(bytes);
  });
  it('rejects unrepresentable Windows-1252 edits', () => {
    expect(() => encodeFile({ source: '\u4e2d', encoding: 'windows-1252', bom: false })).toThrow('cannot be saved');
  });
  it('rejects binary and UTF-32 input', () => {
    expect(() => decodeFile(new Uint8Array([0, 1, 2]))).toThrow('NUL');
    expect(() => decodeFile(new Uint8Array([0xff, 0xfe, 0, 0]))).toThrow('UTF-32');
  });
  it('preserves BOM-less UTF-8 and CRLF', () => {
    const bytes = new TextEncoder().encode('/* hello */\r\n');
    expect(encodeFile(decodeFile(bytes))).toEqual(bytes);
  });
});