export type FileEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';
export interface DecodedFile { source: string; encoding: FileEncoding; bom: boolean }
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Decode Unicode with a BOM, strict UTF-8, or legacy Windows-1252, preserving newlines. */
export function decodeFile(bytes: Uint8Array): DecodedFile {
  if (bytes.length > MAX_FILE_SIZE) throw new Error('Files larger than 50 MiB are not supported.');
  if ((bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0 && bytes[3] === 0) || (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0xfe && bytes[3] === 0xff)) throw new Error('UTF-32 is unsupported. Convert this file to UTF-8 first.');
  let encoding: FileEncoding = 'utf-8';
  let offset = 0;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) { encoding = 'utf-16le'; offset = 2; }
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) { encoding = 'utf-16be'; offset = 2; }
  else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) offset = 3;
  try {
    const source = new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(bytes.subarray(offset));
    if (source.includes('\0')) throw new Error('NUL bytes detected. This may be binary or BOM-less UTF-16. Convert to UTF-8 first.');
    return { source, encoding, bom: offset > 0 };
  } catch (error) {
    if (error instanceof TypeError && encoding === 'utf-8' && offset === 0) {
      const source = new TextDecoder('windows-1252').decode(bytes);
      if (source.includes('\0')) throw new Error('NUL bytes detected. Select a text A2L file.');
      return { source, encoding: 'windows-1252', bom: false };
    }
    throw error;
  }
}

/** Preserve the original encoding; reject unrepresentable legacy characters rather than losing data. */
export function encodeFile(file: DecodedFile): Uint8Array {
  if (file.encoding === 'utf-8') {
    const body = new TextEncoder().encode(file.source);
    const bytes = new Uint8Array(body.length + (file.bom ? 3 : 0));
    if (file.bom) bytes.set([0xef, 0xbb, 0xbf]);
    bytes.set(body, file.bom ? 3 : 0);
    return bytes;
  }
  if (file.encoding === 'windows-1252') {
    const decoder = new TextDecoder('windows-1252');
    const mapping = new Map(Array.from({ length: 256 }, (_, index) => [decoder.decode(new Uint8Array([index])), index]));
    const result: number[] = [];
    for (const character of file.source) {
      const byte = mapping.get(character);
      if (byte === undefined) throw new Error('A character cannot be saved in Windows-1252. Use Export UTF-8 instead.');
      result.push(byte);
    }
    return new Uint8Array(result);
  }
  const offset = file.bom ? 2 : 0;
  const bytes = new Uint8Array(file.source.length * 2 + offset);
  const view = new DataView(bytes.buffer);
  const littleEndian = file.encoding === 'utf-16le';
  if (file.bom) view.setUint16(0, 0xfeff, littleEndian);
  for (let index = 0; index < file.source.length; index++) view.setUint16(index * 2 + offset, file.source.charCodeAt(index), littleEndian);
  return bytes;
}

/** Download content locally and release the temporary URL. */
export function downloadFile(name: string, content: BlobPart, type = 'application/octet-stream'): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  try { link.href = url; link.download = name; link.click(); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}