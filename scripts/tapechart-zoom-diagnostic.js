// === DIAGNOSTYKA ZOOM TAPECHART ===
// Kopia ten skrypt do konsoli DevTools (F12) w localhost:3011/front-office
// Uruchom przy zoomie 100%, potem przy 150%, wklej output obu uruchomień (RAW)

(function() {
  const zoom = Math.round(window.devicePixelRatio * 100) + '% (devicePixelRatio)';
  console.log('=== ZOOM ' + zoom + ' ===');

  // Znajdź pasek AMBROZIAK 002 (750 PLN) - może być w data-reservation-id na wrapperze LUB w ReservationBar
  const bars = document.querySelectorAll('[data-reservation-id]');
  let targetBar = null;
  bars.forEach(bar => {
    const text = bar.textContent || '';
    if (text.includes('AMBROZIAK') && text.includes('750')) {
      targetBar = bar;
    }
  });

  if (!targetBar) {
    console.log('--- BRAK PASKU AMBROZIAK 750 --- (upewnij się że widoczny na tapeczarcie)');
    return;
  }

  // Wiersz wirtualny (data-room-row) - rodzic paska
  const row = targetBar.closest('[data-room-row]');
  if (!row) {
    console.log('--- BRAK data-room-row (inna struktura) ---');
  } else {
    const rowStyle = row.getAttribute('style') || '';
    console.log('--- ROOM 002 ROW (data-room-row) ---');
    console.log('row style:', rowStyle);
    console.log('row getBoundingClientRect:', JSON.stringify(row.getBoundingClientRect()));
  }

  console.log('--- AMBROZIAK 002 (750 PLN) bar ---');
  console.log('bar getBoundingClientRect:', JSON.stringify(targetBar.getBoundingClientRect()));

  // Różnica top: pasek vs wiersz (powinna być ~0 przy poprawnej pozycji)
  if (row) {
    const barRect = targetBar.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const diffTop = barRect.top - rowRect.top;
    console.log('--- RÓŻNICA ---');
    console.log('bar.top - row.top =', diffTop, 'px');
  }

  // Diagnoza row vs label (zoom 100% vs 200%): etykiety sticky vs wiersze absolute
  var rows = document.querySelectorAll('[data-room-row]');
  rows.forEach(function(r) {
    var idx = r.getAttribute('data-index');
    if (idx === '0' || idx === '1' || idx === '2') {
      var label = r.querySelector('[data-testid^="room-row-"]');
      var rowTop = r.getBoundingClientRect().top;
      var labelTop = label ? label.getBoundingClientRect().top : 'N/A';
      var diff = typeof labelTop === 'number' ? (rowTop - labelTop).toFixed(1) : 'N/A';
      console.log('Row ' + idx + ': row.top=' + rowTop.toFixed(1) + ' label.top=' + (typeof labelTop === 'number' ? labelTop.toFixed(1) : labelTop) + ' diff=' + diff);
    }
  });

  // Scroll container (tape-chart-scroll-area)
  const scrollEl = document.querySelector('.tape-chart-scroll-area') || document.querySelector('.overflow-auto');
  if (scrollEl) {
    console.log('--- SCROLL CONTAINER ---');
    console.log('scrollTop:', scrollEl.scrollTop);
    console.log('scrollHeight:', scrollEl.scrollHeight);
    console.log('getBoundingClientRect:', JSON.stringify(scrollEl.getBoundingClientRect()));
  }
})();
