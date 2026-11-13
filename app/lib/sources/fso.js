// Swiss Federal Statistical Office (FSO/BFS/OFS), public, no API key.
// The DAM API returns the CURRENT edition of a publication by its fixed order number,
// so we always get the latest file without hard-coding a monthly link.
//   cc-d-05.02.08 = "LIK, Totalindex auf allen Indexbasen" (Excel), sheet "Index_m",
//   column "% m-12" = CPI change vs the same month a year earlier (official YoY inflation).
import readXlsxFile from 'read-excel-file/node';
import { fetchJson, fetchWithRetry } from './http';

const DAM = 'https://dam-api.bfs.admin.ch/hub/api/dam/assets';
const CPI_ORDER_NR = 'cc-d-05.02.08';

function findAssets(o, out = []) {
  if (Array.isArray(o)) o.forEach(v => findAssets(v, out));
  else if (o && typeof o === 'object') {
    if (o.ids && o.bfs && Array.isArray(o.links)) out.push(o);
    else Object.values(o).forEach(v => findAssets(v, out));
  }
  return out;
}

export async function fetchFsoCpiYoY() {
  const meta = await fetchJson(`${DAM}?orderNr=${CPI_ORDER_NR}`, { label: 'FSO DAM search' });
  const current = findAssets(meta).find(a => a.bfs.lifecycleGroup === 'CURRENT');
  const master = current?.links.find(l => l.rel === 'master' && l.format === 'xlsx');
  if (!master) throw new Error(`FSO: no current Excel for ${CPI_ORDER_NR}`);

  const res = await fetchWithRetry(master.href, { timeoutMs: 30000, label: 'FSO CPI Excel' });
  if (!res.ok) throw new Error(`FSO CPI Excel: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const rows = await readXlsxFile(buffer, { sheet: 'Index_m' });
  const header = rows.find(r => r.includes('% m-12'));
  if (!header) throw new Error('FSO CPI Excel: column "% m-12" not found (file layout changed?)');
  const col = header.indexOf('% m-12');

  const data = rows.filter(r => r[0] instanceof Date && typeof r[col] === 'number');
  const last = data[data.length - 1];
  if (!last) throw new Error('FSO CPI Excel: no monthly values found');

  return {
    value: last[col],
    date: last[0].toISOString().slice(0, 10),
    source: `FSO CPI (${CPI_ORDER_NR}, YoY)`,
  };
}
