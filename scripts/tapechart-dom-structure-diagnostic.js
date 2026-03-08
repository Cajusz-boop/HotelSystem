// === PEŁNA DIAGNOSTYKA DOM TAPECHART ===
// Skopiuj całość do konsoli DevTools (F12) na localhost:3011/front-office
// Uruchom przy zoomie 100%, skopiuj output. Ctrl+Plus → 150%, uruchom ponownie, skopiuj output.

(function() {
  const zoom = Math.round(window.devicePixelRatio * 100);
  const zoomLabel = zoom + '%';
  const sep = '\n';

  function out(s) { console.log(s); }

  out('========== ZOOM ' + zoomLabel + ' ==========' + sep);

  const scrollArea = document.querySelector('.tape-chart-scroll-area');
  if (!scrollArea) { out('BRAK .tape-chart-scroll-area'); return; }

  const bars = document.querySelectorAll('[data-reservation-id]');
  let targetBar = null;
  for (const b of bars) {
    const t = (b.textContent || '').trim();
    if (t.includes('AMBROZIAK') && (t.includes('002') || t.includes('750'))) { targetBar = b; break; }
  }
  if (!targetBar) { out('BRAK PASKU AMBROZIAK 002'); return; }

  const roomRow = targetBar.closest('[data-room-row]');
  const gridWrapper = scrollArea.querySelector('[data-grid-draggable]');
  const rowsCont = gridWrapper?.querySelector('.relative.w-full');
  const overlays = scrollArea.querySelectorAll('.absolute.inset-0');

  // === 1. DRZEWO DOM ===
  out('--- 1. DRZEWO DOM ---');
  const scrollStyle = getComputedStyle(scrollArea);
  out('div.tape-chart-scroll-area (overflow: ' + scrollStyle.overflow + ')');
  if (gridWrapper) {
    const gwStyle = gridWrapper.getAttribute('style') || '';
    out('└─ div[data-grid-draggable] (position: relative; height: ' + (gwStyle.match(/height:\s*([^;]+)/)?.[1] || '?') + 'px)');
    const rows = rowsCont?.querySelectorAll('[data-room-row]') || [];
    const headerRow = gridWrapper.querySelector('.sticky.z-\\[60\\]') || gridWrapper.querySelector('[class*="sticky"]');
    if (headerRow) out('   ├─ div (sticky header dat)');
    rows.forEach((r, i) => {
      const idx = r.getAttribute('data-index');
      const st = r.getAttribute('style') || '';
      const top = st.match(/top:\s*([^;]+)/)?.[1] || '?';
      const h = st.match(/height:\s*([^;]+)/)?.[1] || '?';
      const num = r.querySelector('.font-semibold.tabular-nums')?.textContent?.trim() || '?';
      out('   ├─ div (position: absolute; top: ' + top + '; height: ' + h + 'px) [data-index="' + idx + '" data-room-row] ← wiersz ' + num);
      if (r === roomRow) {
        out('   │   └─ RoomRowDroppable (komórki dat)');
        out('   │   └─ div[data-reservation-id] (grid-row:1; grid-column:X/Y) ← pasek AMBROZIAK 002');
      }
    });
    overlays.forEach((o, i) => {
      const os = o.getAttribute('style') || '';
      out('   └─ div.overlay (position: absolute; inset: 0; ' + os.substring(0, 60) + (os.length > 60 ? '...' : '') + ')');
    });
  }
  out('');

  // === 2. ATRYBUTY data-* ===
  out('--- 2. ATRYBUTY data-* ---');
  const dataAttrs = (el) => el ? Array.from(el.attributes || []).filter(a => a.name.startsWith('data-')).map(a => a.name + '="' + a.value + '"') : [];
  out('Wiersz pokoju 002: ' + (roomRow ? dataAttrs(roomRow).join(' ') : 'NIE ZNALEZIONY'));
  out('Pasek rezerwacji: ' + dataAttrs(targetBar).join(' '));
  const ov = overlays[0];
  out('Overlay: ' + (ov ? dataAttrs(ov).join(' ') || 'brak data-*' : 'NIE ZNALEZIONY'));
  out('');

  // === 3. RODZEŃSTWO ===
  out('--- 3. OVERLAY vs WIERSZE ---');
  const ovParent = ov?.parentElement;
  const rowsParent = rowsCont?.parentElement;
  const isSibling = ovParent && rowsParent && ovParent === rowsParent;
  out('Overlay jest RODZEŃSTWEM (sibling) wierszy? ' + (ov ? (isSibling ? 'TAK' : 'NIE (overlay.parent=' + (ovParent?.className || '?') + ', rows.parent=' + (rowsParent?.className || '?') + ')') : 'N/A'));
  out('Pasek jest WEWNĄTRZ wiersza pokoju? ' + (roomRow ? 'TAK' : 'NIE'));
  out('');

  // === 4/5. getBoundingClientRect ===
  const rect = (el) => el ? el.getBoundingClientRect() : null;
  const rr = rect(roomRow);
  const br = rect(targetBar);
  const or = rect(ov);

  out('--- 4/5. COMPUTED (getBoundingClientRect) ---');
  if (roomRow) out('Wiersz pokoju 002: top=' + rr.top + ', height=' + rr.height);
  if (ov) out('Overlay: top=' + or.top + ', height=' + or.height);
  out('Pasek AMBROZIAK 002: top=' + br.top + ', height=' + br.height);
  out('');

  // === 6. RÓŻNICA ===
  const diff = roomRow ? (br.top - rr.top) : null;
  out('--- 6. RÓŻNICA (pasek.top - wiersz002.top) ---');
  out('Wartość: ' + diff + ' px');
  out('');

  // RAW JSON
  out('--- RAW JSON ---');
  out(JSON.stringify({
    zoom: zoomLabel,
    row002: rr ? { top: rr.top, height: rr.height } : null,
    overlay: or ? { top: or.top, height: or.height } : null,
    bar: { top: br.top, height: br.height },
    diffTop: diff,
  }, null, 2));
})();
