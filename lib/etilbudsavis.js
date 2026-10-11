import { randomUUID } from 'node:crypto';

// Wire protocol observed in eTilbudsavis and CagosDk/hacs-etilbudsavis.
const BASE = 'https://etilbudsavis.dk';
const API_KEY = '152000596c6e45d9983eab0c14afebea';
export class ApiError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}
export async function request(path, payload, token, fetcher = fetch) {
  const headers = { 'Content-Type': 'application/json', Origin: BASE,
    Referer: BASE + '/indkoebslister/aktiv', 'x-api-key': API_KEY };
  if (token) headers.Cookie = 'tjek-session=' + encodeURIComponent(JSON.stringify({ token }));
  let response;
  try { response = await fetcher(BASE + path, { method: 'POST', headers,
    body: JSON.stringify(payload), redirect: 'error', signal: AbortSignal.timeout(12000) }); }
  catch { throw new ApiError('Forbindelsen til eTilbudsavis blev afbrudt. Kontrollér listen før du prøver igen.'); }
  if ([401,403].includes(response.status)) throw new ApiError('Log ind i eTilbudsavis igen.', 401);
  if (response.status === 429) throw new ApiError('eTilbudsavis beder dig vente. Prøv igen senere.', 429);
  if (!response.ok) throw new ApiError('eTilbudsavis afviste forespørgslen. Prøv igen senere.');
  try { return await response.json(); }
  catch { throw new ApiError('eTilbudsavis svarede i et uventet format.'); }
}
export async function query(name, params, token, fetcher) {
  const key = Buffer.from(JSON.stringify([name,params])).toString('base64');
  const data = await request('/', { data: [key] }, token, fetcher);
  const entry = Array.isArray(data) ? data[0] : data;
  if (!entry || entry.error || !Array.isArray(entry.value)) throw new ApiError('Kunne ikke læse indkøbslisten. Ingen varer blev tilføjet.');
  return entry.value;
}
export const normalize = name => name.normalize('NFKC').trim().toLocaleLowerCase('da-DK').replace(/\s+/g,' ');
export function classify(items, existing) {
  const names = new Set(existing.filter(x => !x.ticked).map(x => normalize(String(x.name || ''))));
  return items.map(item => ({ ...item, duplicate: names.has(normalize(item.name)) }));
}
export async function transfer(listId, items, token, fetcher) {
  const existing = await query('shoppingListItems', { shoppingListId: listId }, token, fetcher);
  const added = [], skipped = [];
  for (const item of classify(items, existing)) {
    if (item.duplicate) { skipped.push(item.name); continue; }
    // Repeated names within one request must not create another item either.
    if (added.some(x => normalize(x) === normalize(item.name))) { skipped.push(item.name); continue; }
    try {
      await request('/api/shopping-list-add-item', { shoppingListId: listId,
        item: { clientId: randomUUID(), name: item.name, count: 1, shortDescription: item.note } }, token, fetcher);
      added.push(item.name);
    } catch (error) {
      // Never automatically retry writes: an interrupted response may hide a successful write.
      return { added, skipped, uncertain: item.name, error: error.message };
    }
  }
  return { added, skipped };
}
