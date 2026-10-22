import { parseA2l } from './a2l';
self.onmessage = (event: MessageEvent<{ id: number; source: string }>) => {
  try { self.postMessage({ id: event.data.id, parsed: parseA2l(event.data.source) }); }
  catch (error) { self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : 'Could not parse this file.' }); }
};