const GENERAL = 'பொது';
const DEFAULTS = { birds: [], eggs: [], accounts: [], alerts: [], losses: [], feed: [], pairs: [], history: [], weights: [], prices: [], rates: [], vaccines: [], feedMin: 50, nextId: 1 };
  const state = JSON.parse(JSON.stringify(DEFAULTS));
  const todayStr = ((d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date());
  const $ = id => document.getElementById(id);
  const uid = () => state.nextId++;

  function daysAgo(n) {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const eggsOn = day => state.eggs.filter(e => !e.hatchery && e.date === day).reduce((s, e) => s + Number(e.count), 0);
  const losses = () => state.losses.reduce((s, l) => s + Number(l.count), 0);
  const totalBirdsNow = () => state.birds.reduce((s, b) => s + Number(b.count), 0) - losses();
  const feedStock = () => state.feed.reduce((s, f) => s + (f.type === 'in' ? Number(f.kg) : -Number(f.kg)), 0);
  const itemStock = item => state.feed.reduce((s, f) =>
    (f.item || 'தீவனம்') === item ? s + (f.type === 'in' ? Number(f.kg) : -Number(f.kg)) : s, 0);
  const feedCost = () => state.feed.reduce((s, f) => s + Number(f.amt || 0), 0);
  const feedCostBy = () => {
    const m = {};
    state.feed.forEach(f => { if (f.type === 'in') m[f.item || 'தீவனம்'] = (m[f.item || 'தீவனம்'] || 0) + Number(f.amt || 0); });
    return m;
  };
  const profitTotal = () => state.accounts.reduce((s, a) => s + (a.type === 'in' ? Number(a.amount) : -Number(a.amount)), 0) - feedCost();

  // ---------- Storage (per-user, persistent) ----------
  const KEY = 'kozhi_app_state_v1';
  let ready = false, applying = false, saveTimer = null;
  function persist() {
    if (!ready || applying) return;
    $('saveState').textContent = 'சேமிக்கிறது...';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        autoBackup();
        $('saveState').textContent = '✓ சேமிக்கப்பட்டது';
      } catch (err) {
        console.error(err); $('saveState').textContent = 'சேமிப்பில் பிழை';
      }
    }, 300);
  }

  // ---------- Rendering ----------
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // Show dates as நாள்/மாதம்/வருடம் (11/11/2026) everywhere in the app
  function fmtDates(t) {
    return String(t == null ? '' : t).replace(/(\d{4})-(\d{2})-(\d{2})/g, (m, y, mo, d) => d + '/' + mo + '/' + y);
  }
  function entry(ico, main, meta, amt, amtClass, onDelete) {
    const row = document.createElement('div');
    row.className = 'entry';
    row.innerHTML = `<div style="display:flex;gap:10px;align-items:center;min-width:0">
        <div class="ico">${ico}</div>
        <div style="min-width:0"><div class="main"></div><div class="meta"></div></div>
      </div>`;
    row.querySelector('.main').textContent = fmtDates(main);
    row.querySelector('.meta').textContent = fmtDates(meta);
    if (amt !== null) {
      const a = document.createElement('div');
      a.className = 'amt ' + (amtClass || ''); a.textContent = amt;
      row.appendChild(a);
    }
    const d = document.createElement('button');
    d.className = 'del'; d.textContent = '🗑️'; d.setAttribute('aria-label', 'நீக்கு');
    d.addEventListener('click', () => askDelete(onDelete, main + (meta ? ' · ' + meta : '')));
    row.appendChild(d);
    return row;
  }
  const fill = (el, nodes, emptyText) => {
    el.innerHTML = '';
    if (!nodes.length) { el.innerHTML = `<div class="empty">${emptyText}</div>`; return; }
    nodes.forEach((n, i) => {
      if (n.classList && n.classList.contains('entry')) {
        const badge = document.createElement('span');
        badge.className = 'seq';
        badge.textContent = i + 1;
        n.prepend(badge);
      }
      el.appendChild(n);
    });
  };

  function chicksOn(day) {
    const arrivals = state.birds.reduce((t, b) => (b.date === day ? t + Number(b.count || 0) : t), 0);
    return arrivals + state.eggs.reduce((t, e) => {
      if (e.kind === 'hen' && e.hatch === day) return t + Number(e.count || 0);
      if (e.hatchery && e.kind !== 'hen' && e.collect === day) return t + Number(e.count || 0);
      return t;
    }, 0);
  }
  function valueOn(day) {
    return $('chartKind').value === 'chicks' ? chicksOn(day) : eggsOn(day);
  }
  function renderChart() {
    const chart = $('chart');
    chart.innerHTML = '';
    const isoOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const fromV = $('chartFrom').value, toV = $('chartTo').value;
    let days;
    const dayV = $('chartDate').value;
    if (fromV && toV && fromV <= toV) {
      days = [];
      const cur = new Date(fromV + 'T00:00:00'), endD = new Date(toV + 'T00:00:00');
      while (cur <= endD && days.length < 1100) { days.push(isoOf(cur)); cur.setDate(cur.getDate() + 1); }
    } else if (dayV) {
      days = [dayV];
    } else {
      const r0 = Number($('chartRange').value) || 7;
      days = [...Array(r0)].map((_, k) => daysAgo(r0 - 1 - k));
    }
    const range = days.length;
    const vals = days.map(valueOn);
    const unit = $('chartKind').value === 'chicks' ? 'கோழிகள்' : 'முட்டைகள்';
    const total = vals.reduce((a, b) => a + b, 0);
    $('chartSummary').textContent = 'மொத்தம்: ' + total + ' ' + unit + ' · நாள் சராசரி: ' + (total / range).toFixed(1);

    let buckets;
    if (range <= 14) {
      buckets = days.map((d, k) => ({ label: d === todayStr ? 'இன்று' : d.slice(8, 10) + '/' + d.slice(5, 7), val: vals[k] }));
    } else {
      buckets = [];
      for (let k = 0; k < days.length; k += 7) {
        const part = vals.slice(k, k + 7);
        buckets.push({ label: days[k].slice(8, 10) + '/' + days[k].slice(5, 7), val: part.reduce((a, b) => a + b, 0) });
      }
    }
    const max = Math.max(1, ...buckets.map(b => b.val));
    buckets.forEach(b => {
      const wrap = document.createElement('div');
      wrap.className = 'bar-wrap';
      if (range > 14) wrap.style.minWidth = '30px';
      const v = document.createElement('div'); v.className = 'bar-val'; v.textContent = b.val;
      const bar = document.createElement('div'); bar.className = 'bar';
      bar.style.height = (b.val / max * 100) + '%';
      const lbl = document.createElement('div'); lbl.className = 'bar-day'; lbl.textContent = b.label;
      wrap.append(v, bar, lbl);
      chart.appendChild(wrap);
    });

    document.querySelectorAll('.ptile').forEach(t => t.classList.toggle('on', Number(t.dataset.range) === range));
    const det = $('periodDetail');
    det.innerHTML = '';
    days.slice().reverse().forEach((d, k) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #d9e3d9';
      const dl = document.createElement('span'); dl.textContent = (d === todayStr ? 'இன்று' : d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4));
      const vl = document.createElement('b'); vl.textContent = valueOn(d) + ' ' + unit;
      row.append(dl, vl);
      det.appendChild(row);
    });
    const picked = $('chartDate').value;
    $('dayResult').textContent = picked ? picked + ' அன்றைய உற்பத்தி: ' + valueOn(picked) + ' ' + unit : '';
  }
  $('chartRange').addEventListener('change', () => { $('chartFrom').value = ''; $('chartTo').value = ''; $('chartDate').value = ''; renderChart(); });
  $('chartFrom').addEventListener('change', () => { $('chartDate').value = ''; if ($('chartFrom').value && $('chartTo').value) renderChart(); });
  $('chartTo').addEventListener('change', () => { $('chartDate').value = ''; if ($('chartFrom').value && $('chartTo').value) renderChart(); });

  $('chartKind').addEventListener('change', renderChart);
  $('chartDate').addEventListener('change', () => { $('chartFrom').value = ''; $('chartTo').value = ''; renderChart(); });

  function renderAlerts() {
    const box = $('alerts'); box.innerHTML = '';
    const stock = feedStock();
    if (new Date(todayStr + 'T00:00:00').getDay() === 0) {
      box.appendChild(el('div', 'alert', '🧹 இன்று வாராந்திர கொட்டகை சுத்தம் மற்றும் குப்பை மாற்றும் நாள்.'));
    }
    state.birds.forEach(b => {
      const d = Math.max(0, Math.round((new Date(todayStr) - new Date(b.date)) / 86400000));
      const left = 90 - (d % 90);
      if (left <= 3) box.appendChild(el('div', 'alert danger', '💊 குடற்புழு நீக்கம் நெருங்குகிறது: ' + b.breed + (b.batch ? ' (Batch ' + b.batch + ')' : '') + (left === 90 ? ' — இன்று' : ' — ' + left + ' நாள்')));
    });
    state.eggs.filter(e => e.kind === 'hen' && e.hatch).forEach(e => {
      const days = Math.round((new Date(e.hatch) - new Date(todayStr)) / 86400000);
      if (days > 3) return;
      const d = document.createElement('div');
      d.className = 'alert danger';
      d.textContent = days <= 0
        ? '🐣 இன்று பொறிப்பு நாள்: ' + e.hatchery.replace('தாய்கோழி அடை · ', '') + ' (' + e.count + ' முட்டைகள்)'
        : '🐣 பொறிப்பு நெருங்குகிறது (' + days + ' நாள்): ' + e.hatchery.replace('தாய்கோழி அடை · ', '');
      box.appendChild(d);
    });
    state.alerts.filter(al => al.date <= todayStr).forEach(al => {
      const d = document.createElement('div'); d.className = 'alert';
      d.textContent = '💉 இன்று / தாமதம்: ' + al.text; box.appendChild(d);
    });
  }

  function renderAll() {
    persist();



    const allB = allBatches();
    document.querySelectorAll('.batchSel').forEach(sel => {
      const prev = sel.value; sel.innerHTML = '';
      allB.forEach(x => { const o = document.createElement('option'); o.value = x; o.textContent = x; sel.appendChild(o); });
      sel.value = allB.includes(prev) ? prev : GENERAL;
    });
    renderBatchView();

    fill($('birdList'), state.birds.map(b => entry('🐔', `${b.breed} — ${b.count} கோழிகள்`,
      `${b.age ? 'வயது ' + b.age + ' · ' : ''}Batch ${b.batch || '-'} · வாங்கிய தேதி ${b.date}`, null, '',
      () => { state.birds = state.birds.filter(x => x.id !== b.id); renderAll(); })), 'கோழி பதிவு இல்லை');

    fill($('lossList'), [...state.losses].sort((a, b) => b.date.localeCompare(a.date)).map(l =>
      entry('📉', `${l.age || 'இழப்பு'} — ${l.count}`,
        (l.reason ? 'காரணம்: ' + l.reason + ' · ' : '') + `Batch ${l.batch || '-'} · ${l.date}`, null, '',
        () => { state.losses = state.losses.filter(x => x.id !== l.id); renderAll(); })),
      'இழப்பு பதிவுகள் இல்லை');

    fill($('eggList'), [...state.eggs].filter(e => !e.hatchery)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map(e =>
        entry('🥚', e.count + ' முட்டைகள்', 'Batch ' + bOf(e) + ' · ' + e.date + (e.broken ? ' · உடைந்தவை: ' + e.broken : ''), null, '',
          () => { state.eggs = state.eggs.filter(x => x.id !== e.id); renderAll(); })), 'பதிவுகள் இல்லை');

    fill($('hatchList'), [...state.eggs].filter(e => e.hatchery)
      .sort((a, b) => b.date.localeCompare(a.date)).map(e =>
        entry('🐣', e.hatchery + ' · ' + e.count + ' முட்டைகள்',
          'Batch ' + bOf(e) + ' · ' + (e.kind === 'hen' ? 'வைத்த தேதி: ' + e.sent + (e.hatch ? ' · பொறிக்கும் தேதி: ' + e.hatch + (e.hatch > todayStr ? ' (இன்னும் ' + Math.round((new Date(e.hatch) - new Date(todayStr)) / 86400000) + ' நாள்)' : ' (பொறிப்பு நாள்)') : '') : 'கொடுத்த தேதி: ' + e.sent + (e.collect ? ' · வாங்கும் தேதி: ' + e.collect : '')), null, '',
          () => { state.eggs = state.eggs.filter(x => x.id !== e.id); renderAll(); })), 'Hatchery பதிவுகள் இல்லை');

    const stock = feedStock();
    const costs = feedCostBy();
    const costText = Object.keys(costs).map(k => `${k} ₹${costs[k].toFixed(2)}`).join(' · ');
    $('feedSummary').textContent = `மொத்த இருப்பு: ${stock.toFixed(1)} கிலோ · எச்சரிக்கை அளவு: ${state.feedMin} கிலோ` +
      (costText ? ` · மொத்த தீவன செலவு ₹${feedCost().toFixed(2)} (${costText})` : '');
    if (document.activeElement !== $('feedMin')) $('feedMin').value = state.feedMin;

    const stockBox = $('feedStockList');
    stockBox.innerHTML = '';
    FEED_ITEMS.forEach(item => {
      const q = itemStock(item);
      const row = el('div', 'entry');
      const left = el('div', '');
      left.style.cssText = 'display:flex;gap:10px;align-items:center';
      left.append(el('div', 'ico', '🌾'), el('div', 'main', item));
      row.append(left, el('div', 'amt ' + (q <= 0 ? 'neg' : 'pos'), q.toFixed(1) + ' கிலோ'));
      stockBox.appendChild(row);
    });

    const whenOf = f => f.at
      ? new Date(f.at).toLocaleString('ta-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : f.date;
    fill($('feedList'), [...state.feed].sort((x, y) => (y.at || y.date).localeCompare(x.at || x.date)).map(f => {
      const isIn = f.type === 'in';
      const main = whenOf(f) + ' · ' + (isIn ? 'வாங்கியது' : 'பயன்படுத்தியது');
      const meta = 'Batch ' + bOf(f) + ' · ' + (f.item || 'தீவனம்') + ' : ' + f.kg + ' Kg' + (isIn && f.amt ? ' · ₹' + Number(f.amt).toFixed(2) : '');
      return entry(isIn ? '📦' : '🍚', main, meta, null, '',
        () => { state.feed = state.feed.filter(x => x.id !== f.id); renderAll(); });
    }), 'தீவன பதிவுகள் இல்லை');

    fill($('accList'), [...state.accounts].sort((a, b) => b.date.localeCompare(a.date)).map(a => {
      const title = a.category ? (a.note ? a.category + ' — ' + a.note : a.category) : a.note;
      return entry(a.type === 'in' ? '💰' : '🧾', title,
        (a.buyer ? 'வாங்குபவர்: ' + a.buyer + (a.phone ? ' ' + a.phone : '') + ' · ' : '') + (a.batch ? 'Batch ' + a.batch + ' · ' : '') + a.date,
        (a.type === 'in' ? '+' : '−') + '₹' + Number(a.amount).toFixed(2),
        a.type === 'in' ? 'pos' : 'neg',
        () => { state.accounts = state.accounts.filter(x => x.id !== a.id); renderAll(); });
    }), 'பதிவுகள் இல்லை');

    fill($('pairList'), [...state.pairs].sort((a, b) => b.date.localeCompare(a.date)).map(p => {
      const w = el('div', 'entry');
      w.style.cssText = 'display:block;padding:12px 0;border-bottom:1px solid var(--bg)';
      const top = el('div', '');
      top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px';
      top.append(el('div', 'main', p.name + ' · Batch ' + bOf(p) + ' · ' + p.date));
      const btns = el('div', '');
      btns.style.cssText = 'display:flex;gap:6px;flex-shrink:0';
      const row = el('div', '');
      row.style.cssText = 'display:flex;gap:8px;margin-top:8px';
      // பார்: shows both photos in full; tapping again goes back to the small view
      const view = el('button', 'primary', '👁 பார்');
      view.style.cssText = 'margin:0;padding:6px 10px;font-size:13px;background:#2e8b57;width:auto';
      let open = false;
      view.addEventListener('click', () => {
        open = !open;
        row.style.flexDirection = open ? 'column' : 'row';
        row.style.gap = open ? '12px' : '8px';
        view.textContent = open ? '✖ மூடு' : '👁 பார்';
        row.querySelectorAll('img').forEach(im => { im.style.height = open ? 'auto' : ''; im.style.objectFit = open ? 'contain' : ''; });
      });
      // நீக்கு: text option at the top right
      const del = el('button', 'primary', 'நீக்கு');
      del.style.cssText = 'margin:0;padding:6px 10px;font-size:13px;background:#b03030;width:auto';
      del.addEventListener('click', () => askDelete(() => { state.pairs = state.pairs.filter(x => x.id !== p.id); renderAll(); }, p.name + ' · ' + p.date));
      btns.append(view, del);
      top.appendChild(btns);
      w.appendChild(top);
      [['சேவல்', p.rooster], ['பெட்டை', p.hen]].forEach(([lbl, src]) => {
        const box = el('div', '');
        box.style.cssText = 'flex:1;text-align:center;font-size:13px;color:var(--muted)';
        if (src) {
          const im = document.createElement('img');
          if (src.startsWith('idb:')) getPhotoURL(src).then(u => { im.src = u; }); else im.src = src;
          im.style.cssText = 'width:100%;border-radius:12px;display:block';
          box.appendChild(im);
        } else {
          box.appendChild(el('div', '', 'படம் இல்லை'));
        }
        box.appendChild(el('div', '', lbl));
        row.appendChild(box);
      });
      w.appendChild(row);
      return w;
    }), 'இணை பதிவுகள் இல்லை');

    fill($('vaxList'), [...state.vaccines].sort((a, b) => b.date.localeCompare(a.date)).map(v =>
      entry('💉', v.name + ' · ' + v.count + ' கோழிகள்', v.date + (v.batch ? ' · Batch ' + v.batch : '') + (v.next ? ' · அடுத்தது: ' + v.next : ''), null, '',
        () => { state.vaccines = state.vaccines.filter(x => x.id !== v.id); renderAll(); })), 'தடுப்பூசி பதிவு இல்லை');

    const vaxDue = [...state.vaccines].filter(v => v.next).sort((a, b) => a.next.localeCompare(b.next));
    fill($('alertList'), [...state.alerts.map(al => ({ kind: 'alert', date: al.date, text: al.text, id: al.id })),
      ...vaxDue.map(v => ({ kind: 'vax', date: v.next, text: '💉 தடுப்பூசி நாள்: ' + v.name + ' · ' + v.count + ' கோழிகள்' + (v.batch ? ' · Batch ' + v.batch : ''), id: v.id }))]
      .sort((a, b) => a.date.localeCompare(b.date)).map(al =>
      al.kind === 'vax'
        ? entry('💉', al.text, al.date, null, '', () => { state.vaccines = state.vaccines.filter(x => x.id !== al.id); renderAll(); })
        :
      entry('💉', al.text, al.date, null, '',
        () => { state.alerts = state.alerts.filter(x => x.id !== al.id); renderAll(); })), 'நினைவூட்டல்கள் இல்லை');

    const birds = totalBirdsNow();
    const weekDays = [...Array(7)].map((_, i) => daysAgo(i));
    const weekProd = weekDays.reduce((s, d) => s + eggsOn(d), 0);
    const weekBroken = state.eggs.filter(e => !e.hatchery && weekDays.includes(e.date))
      .reduce((s, e) => s + Number(e.broken || 0), 0);
    const weekHatch = state.eggs.filter(e => e.hatchery && weekDays.includes(e.sent || e.date))
      .reduce((s, e) => s + Number(e.count), 0);
    const weekSold = state.accounts.filter(a => a.type === 'in' && a.category === 'முட்டை விற்பனை' && weekDays.includes(a.date))
      .reduce((s, a) => s + Number(a.eggs || 0), 0);
    const week = weekProd - weekBroken - weekHatch - weekSold;
    const wb = $('weekBreak');
    wb.innerHTML = '';
    [['உற்பத்தி', weekProd, '#1f7a4d', '+'],
     ['உடைந்தவை', weekBroken, '#c0392b', '−'],
     ['Hatchery', weekHatch, '#b9770e', '−'],
     ['விற்பனை', weekSold, '#1f5fa8', '−']].forEach(([name, val, color, sign]) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:5px 0;border-bottom:1px dashed var(--muted)';
      const a = document.createElement('span');
      a.style.color = 'var(--text)';
      a.textContent = name;
      const b = document.createElement('b');
      b.style.color = color;
      b.textContent = sign + ' ' + val;
      row.append(a, b);
      wb.appendChild(row);
    });
    const profit = profitTotal();
    $('totalBirds').textContent = birds;
    $('todayEggs').textContent = eggsOn(todayStr);
    $('weekEggs').textContent = week;
    const lossMode = $('lossRange').value;
    const lossDay = $('lossDayPick').value;
    $('lossDayPick').classList.toggle('hidden', lossMode !== 'day');
    if (lossMode === 'day') {
      $('totalLoss').textContent = lossDay ? state.losses.filter(l => l.date === lossDay).reduce((s, l) => s + Number(l.count), 0) : 0;
      $('lossDayResult').textContent = lossDay ? lossDay + ' அன்றைய இழப்பு' : 'தேதியை தேர்வு செய்யவும்';
    } else {
      const lossDays = [...Array(Number(lossMode))].map((_, k) => daysAgo(k));
      $('totalLoss').textContent = state.losses.filter(l => lossDays.includes(l.date)).reduce((s, l) => s + Number(l.count), 0);
      $('lossDayResult').textContent = '';
    }
    $('feedStock').textContent = stock.toFixed(1) + ' கிலோ';
    $('feedCard').classList.toggle('low', state.feedMin > 0 && stock <= state.feedMin);
    const pEl = $('profit');
    pEl.textContent = (profit < 0 ? '-' : '') + '₹' + Math.abs(profit).toFixed(2);
    pEl.className = 'value ' + (profit < 0 ? 'neg' : 'pos');

    fill($('birdList'), state.birds.map(b => {
      const lost = state.losses.filter(l => l.batch === b.batch).reduce((t, l) => t + Number(l.count), 0);
      const alive = Number(b.count) - lost;
      const days = Math.max(0, Math.round((new Date(todayStr) - new Date(b.date)) / 86400000));
      return entry('🐔', b.breed + ' — ' + alive + ' கோழிகள்',
        'வயது: ' + (b.age || '-') + ' · Batch ' + (b.batch || GENERAL) + ' · ' + b.date + ' முதல் ' + days + ' நாள்', null, '',
        () => { state.birds = state.birds.filter(x => x.id !== b.id); renderAll(); });
    }), 'கோழி பதிவு இல்லை');
    renderBirdStock();
    const bTotal = $('birdTotalLine');
    if (bTotal) bTotal.textContent = 'இன்றைய மொத்த எண்ணிக்கை: ' + totalBirdsNow() + ' கோழிகள்';
    const lTotal = $('lossTotalLine');
    if (lTotal) lTotal.textContent = 'மொத்த இழப்பு: ' + losses() + ' கோழிகள்';
    renderMore();
    renderProfitBreakdown();
    const histBox = $('historyList');
    histBox.innerHTML = '';
    if (!state.history.length) histBox.appendChild(el('div', 'empty', 'வரலாறு இல்லை'));
    state.history.forEach((h, idx) => {
      const row = el('div', 'entry');
      const left = el('div', '');
      left.style.cssText = 'min-width:0;flex:1';
      left.append(el('div', 'main', (h.section ? h.section + ' · ' : '') + h.text), el('div', 'meta', h.when));
      (h.details || []).forEach(d => {
        if (String(d[1]).startsWith('data:') || String(d[1]).startsWith('idb:')) {
          left.appendChild(el('div', 'meta', d[0] + ':'));
          const im = document.createElement('img');
          if (String(d[1]).startsWith('idb:')) getPhotoURL(d[1]).then(u => { im.src = u; }); else im.src = d[1];
          im.style.cssText = 'width:100%;max-width:200px;border-radius:12px;margin:4px 0;display:block';
          left.appendChild(im);
        } else {
          left.appendChild(el('div', 'meta', d[0] + ': ' + fmtDates(d[1])));
        }
      });
      const del = el('button', 'del', '🗑️');
      del.setAttribute('aria-label', 'நீக்கு');
      del.addEventListener('click', () => askDelete(() => {
        state.history = state.history.filter(x => x.id !== h.id);
        renderAll();
      }));
      row.append(left, del);
      row.prepend(el('span', 'seq', String(idx + 1)));
      histBox.appendChild(row);
    });
    $('clearHistory').onclick = () => askDelete(() => { state.history = []; renderAll(); });

    const upcoming = [];
    state.alerts.filter(a => a.date >= todayStr).forEach(a => upcoming.push({ date: a.date, text: a.text }));
    state.eggs.filter(e => e.kind === 'hen' && e.hatch && e.hatch >= todayStr).forEach(e =>
      upcoming.push({ date: e.hatch, text: '🐣 பொறிப்பு: ' + e.hatchery.replace('தாய்கோழி அடை · ', '') + ' (' + e.count + ' முட்டைகள்)' }));
    upcoming.sort((x, y) => x.date.localeCompare(y.date));
    const upBox = $('upcomingList');
    upBox.innerHTML = '';
    if (!upcoming.length) upBox.appendChild(el('div', 'empty', 'வரவிருக்கும் நினைவூட்டல்கள் இல்லை'));
    upcoming.forEach(u => {
      const days = Math.round((new Date(u.date) - new Date(todayStr)) / 86400000);
      if (days <= 0) {
        const hatchToday = u.text.startsWith('🐣');
        const alertToday = el('div', 'alert danger', hatchToday
          ? '🐣 இன்று பொறிப்பு நாள்: ' + u.text.replace('🐣 பொறிப்பு: ', '')
          : '🔔 இன்று: ' + u.text);
        upBox.appendChild(alertToday);
        return;
      }
      const row = el('div', 'entry');
      const left = el('div', '');
      left.style.cssText = 'display:flex;gap:10px;align-items:center;min-width:0';
      left.append(el('div', 'ico', '🔔'), el('div', 'main', u.text + ' · ' + u.date));
      row.append(left, el('div', 'amt pos', days + ' நாள்'));
      upBox.appendChild(row);
    });
    renderAlerts();
    renderChart();
  }

  // ---------- PDF report ----------
  function buildPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const monthStart = todayStr.slice(0, 8) + '01';
    const monthEggs = state.eggs.filter(e => !e.hatchery && e.date >= monthStart && e.date <= todayStr)
      .reduce((s, e) => s + Number(e.count), 0);
    const income = state.accounts.filter(a => a.type === 'in').reduce((s, a) => s + Number(a.amount), 0);
    const expense = state.accounts.filter(a => a.type === 'out').reduce((s, a) => s + Number(a.amount), 0);

    let y = 20;
    doc.setFontSize(18); doc.text('Poultry Farm Report', 14, y); y += 8;
    doc.setFontSize(10); doc.setTextColor(110);
    doc.text('Generated: ' + todayStr, 14, y); y += 10;
    doc.setTextColor(0);

    doc.setFontSize(13); doc.text('Summary', 14, y); y += 7;
    doc.setFontSize(11);
    const rows = [
      ['Birds alive', String(totalBirdsNow())],
      ['Birds lost (total)', String(losses())],
      ['Eggs this month', String(monthEggs)],
      ['Feed in stock (kg)', feedStock().toFixed(1)],
      ['Feed alert level (kg)', String(state.feedMin)],
      ['Total income (Rs)', income.toFixed(2)],
      ['Total expenses (Rs)', expense.toFixed(2)],
      ['Net profit / loss (Rs)', profitTotal().toFixed(2)]
    ];
    rows.forEach(([k, v]) => { doc.text(k, 14, y); doc.text(v, 110, y, { align: 'right' }); y += 7; });

    y += 5;
    doc.setFontSize(13); doc.text('Recent transactions', 14, y); y += 7;
    doc.setFontSize(10);
    [...state.accounts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).forEach(a => {
      if (y > 280) { doc.addPage(); y = 20; }
      const sign = a.type === 'in' ? '+' : '-';
      doc.text(a.date, 14, y);
      doc.text(String(a.note).slice(0, 50), 45, y);
      doc.text(sign + Number(a.amount).toFixed(2), 190, y, { align: 'right' });
      y += 6;
    });
    if (!state.accounts.length) doc.text('No transactions recorded.', 14, y);
    return doc;
  }

  $('pdfBtn').addEventListener('click', async () => {
    const btn = $('pdfBtn');
    btn.disabled = true;
    try {
      if (!window.jspdf) throw new Error('PDF library not loaded');
      const pdf = buildPdf();
      const bytes = pdf.output('arraybuffer');
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const file = new File([blob], 'kozhi_report_' + todayStr + '.pdf', { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Poultry Report' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      console.error(err);
      alert('PDF சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.');
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Tabs ----------
  // Tapping a tile opens only its section; tapping the same tile again closes it and returns to the home view
  const TAB_KEYS = ['birds', 'eggs', 'feed', 'accounts', 'alerts', 'disease', 'history', 'more'];
  function closeTabs() {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    TAB_KEYS.forEach(t => $('tab-' + t).classList.add('hidden'));
    document.body.classList.remove('tab-open');
  }
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) { closeTabs(); return; }
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      TAB_KEYS.forEach(t => $('tab-' + t).classList.toggle('hidden', t !== btn.dataset.tab));
      document.body.classList.add('tab-open');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // ---------- Forms ----------
  $('today').textContent = 'இன்று ' + todayStr;
  ['birdDate', 'eggDate', 'accDate', 'alertDate', 'lossDate', 'feedDate', 'useDate', 'rateDate', 'vaxDate'].forEach(id => $(id).value = todayStr);
  // Today and earlier dates only: no future (advance) dates in these records
  $('weightDate').value = todayStr; $('priceDate').value = todayStr;
  ['eggDate', 'hatchSent', 'henSet', 'feedDate', 'useDate', 'accDate', 'birdDate', 'lossDate', 'weightDate', 'priceDate', 'rateDate', 'vaxDate'].forEach(id => { $(id).max = todayStr; });

  function syncBirdAge() {
    const n = $('birdAgeNum').value;
    $('birdAge').value = n ? n + ' ' + $('birdAgeUnit').value : '';
  }
  $('birdAgeNum').addEventListener('input', syncBirdAge);
  $('birdAgeUnit').addEventListener('change', syncBirdAge);
  $('breed').addEventListener('change', () => {
    const other = $('breed').value === '__other';
    $('breedOther').style.display = other ? 'block' : 'none';
    if (!other) $('breedOther').value = '';
  });
  $('birdForm').addEventListener('submit', e => {
    e.preventDefault();
    syncBirdAge();
    const breedName = $('breed').value === '__other' ? $('breedOther').value.trim() : $('breed').value;
    if (!breedName) { alert('இனத்தின் பெயரை எழுதவும்.'); return; }
    state.birds.push({ id: uid(), breed: breedName, batch: $('batch').value.trim(), age: $('birdAge').value.trim(),
      count: Number($('birdCount').value), date: $('birdDate').value });
    e.target.reset(); $('birdDate').value = todayStr; renderAll();
  });
  $('lossForm').addEventListener('submit', e => {
    e.preventDefault();
    state.losses.push({ id: uid(), age: $('lossAge').value, reason: $('lossReason').value,
      batch: $('lossBatch').value || GENERAL, count: Number($('lossCount').value), date: $('lossDate').value });
    e.target.reset(); $('lossDate').value = todayStr; renderAll();
  });
  $('eggForm').addEventListener('submit', e => {
    e.preventDefault();
    state.eggs.push({ id: uid(), count: Number($('eggCount').value), date: $('eggDate').value,
      broken: Number($('eggBroken').value || 0), batch: $('eggBatch').value });
    e.target.reset(); $('eggDate').value = todayStr; renderAll();
  });

  function addDays(iso, n) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  $('henSet').addEventListener('change', () => { $('henHatch').value = addDays($('henSet').value, 21); });
  $('hatchSent').addEventListener('change', () => { $('hatchCollect').value = addDays($('hatchSent').value, 21); });

  function toggleHatch() {
    const hen = $('hatchType').value === 'hen';
    $('hatchBox').classList.toggle('hidden', hen);
    $('henBox').classList.toggle('hidden', !hen);
  }
  $('hatchType').addEventListener('change', toggleHatch);
  toggleHatch();

  $('hatchForm').addEventListener('submit', e => {
    e.preventDefault();
    if ($('hatchType').value === 'hen') {
      const name = $('henName').value.trim(), count = Number($('henCount').value), set = $('henSet').value;
      if (!name || !count || !set) { alert('கோழி அடையாளம், முட்டை எண்ணிக்கை, வைத்த தேதி ஆகியவற்றை நிரப்பவும்.'); return; }
      state.eggs.push({ id: uid(), kind: 'hen', hatchery: 'தாய்கோழி அடை · ' + name, count: count,
        date: set, sent: set, hatch: addDays(set, 21), batch: $('hatchBatch').value });
    } else {
      const name = $('hatchName').value.trim(), count = Number($('hatchCount').value), sent = $('hatchSent').value;
      if (!name || !count || !sent) { alert('Hatchery பெயர், முட்டை எண்ணிக்கை, கொடுத்த தேதி ஆகியவற்றை நிரப்பவும்.'); return; }
      state.eggs.push({ id: uid(), kind: 'hatch', hatchery: name, count: count,
        date: sent, sent: sent, collect: addDays(sent, 21), batch: $('hatchBatch').value });
    }
    e.target.reset(); toggleHatch(); renderAll();
  });
  // Photos are shrunk before saving so they fit comfortably on the phone
  // Photos are kept in the phone's own storage at full size (not shrunk, not kept as text in the main data)
  const PHOTO_DB = 'kozhi_photos_v1';
  function openPhotoDb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(PHOTO_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('p');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function savePhoto(blob) {
    const db = await openPhotoDb();
    const id = uid() + '-' + Date.now();
    await new Promise((res, rej) => {
      const tx = db.transaction('p', 'readwrite');
      tx.objectStore('p').put(blob, id);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
    return 'idb:' + id;
  }
  async function getPhotoURL(ref) {
    const id = ref.slice(4);
    const db = await openPhotoDb();
    const blob = await new Promise((res, rej) => {
      const q = db.transaction('p').objectStore('p').get(id);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    db.close();
    return blob ? URL.createObjectURL(blob) : '';
  }
  // Any picture type: HEIC/HEIF (iPhone-style) is converted to JPEG first, others are used as they are
  function loadHeicLib() {
    return new Promise((res, rej) => {
      if (window.heic2any) return res();
      const sc = document.createElement('script');
      sc.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
      sc.onload = res;
      sc.onerror = () => rej(new Error('heic-lib'));
      document.head.appendChild(sc);
    });
  }
  function blobToBase64(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1]);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  function base64ToBlob(b64, type) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type });
  }
  async function toJpegBlob(file) {
    const isHeic = /heic|heif/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || '');
    if (!isHeic) return file;
    const cap = window.Capacitor;
    // Installed app: the phone converts it itself, works with no internet and keeps full quality
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins.HeicConverter) {
      const r = await cap.Plugins.HeicConverter.toJpeg({ data: await blobToBase64(file) });
      return base64ToBlob(r.data, 'image/jpeg');
    }
    await loadHeicLib();
    const out = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    return Array.isArray(out) ? out[0] : out;
  }
  function readPhoto(file) {
    if (!file) return Promise.resolve('');
    return toJpegBlob(file).then(blob => new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 480 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('photo')); };
      img.src = url;
    }));
  }
  let pendingRooster = '', pendingHen = '';
  // Each photo box: show the chosen picture straight away, then shrink it for saving
  [['roosterFile', 'roosterPrev', v => { pendingRooster = v; }],
   ['henFile', 'henPrev', v => { pendingHen = v; }]].forEach(([inp, prev, set]) => {
    $(inp).addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0];
      if (!f) { set(''); $(prev).style.display = 'none'; return; }
      try {
        const blob = await toJpegBlob(f);
        $(prev).src = URL.createObjectURL(blob);
        $(prev).style.display = 'block';
        set(await savePhoto(blob));
      } catch (err) {
        set('');
        alert('இந்தப் புகைப்படத்தைப் படிக்க முடியவில்லை. JPG அல்லது PNG படம் தேர்ந்தெடுக்கவும்.');
      }
    });
  });
  $('pairForm').addEventListener('submit', e => {
    e.preventDefault();
    state.pairs.push({ id: uid(), name: $('pairName').value.trim(), date: $('pairDate').value,
      rooster: pendingRooster, hen: pendingHen, batch: $('pairBatch').value });
    pendingRooster = ''; pendingHen = '';
    e.target.reset();
    $('roosterPrev').style.display = 'none'; $('henPrev').style.display = 'none';
    renderAll();
  });

  $('lossRange').addEventListener('change', renderAll);
  $('lossDayPick').addEventListener('change', renderAll);

  // Safety check on every form: a future date is refused before anything is saved
  document.addEventListener('submit', e => {
    const bad = [...e.target.querySelectorAll('input[type="date"][max]')]
      .find(i => i.value && i.value > i.max);
    if (bad) {
      e.preventDefault();
      e.stopImmediatePropagation();
      alert('எதிர்கால தேதி அனுமதிக்கப்படாது. இன்று அல்லது முந்தைய தேதியைத் தேர்வு செய்யவும்.');
    }
  }, true);

  // Opening பண்ணை ஆவணம் shows only that section; closing it returns to the normal view
  document.querySelector('details.farm-doc').addEventListener('toggle', e => {
    document.body.classList.toggle('doc-open', e.target.open);
  });

  // Tapping the bird count opens the கோழி பதிவு list
  $('heroBirds').addEventListener('click', () => {
    document.querySelector('.tab[data-tab="birds"]').click();
    $('birdList').closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- Backup ----------
  // Every change is also kept as an automatic backup on this phone (a second copy of the data)
  const BACKUP_KEY = 'kozhi_app_backup_v1';
  const UNDO_KEY = 'kozhi_undo_before_delete_v1';
  // Only ONE automatic backup is kept: each save replaces the previous one, so phone storage does not grow
  let lastBackupText = '';
  function autoBackup() {
    const data = JSON.stringify(state);
    if (data === lastBackupText) return;
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), state: state }));
      lastBackupText = data;
      showBackupInfo();
    } catch (err) {
      backupStatus('போனில் இடம் குறைவாக உள்ளது. பழைய வரலாற்றை அழிக்கவும்.');
    }
    // Installed app: also save the same backup into the phone's Downloads folder (one file, replaced each time)
    const cap = window.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
      if (!cap.Plugins.DownloadsWriter) { backupStatus('தானியங்கி காப்பு வேலை செய்ய புதிய APK install செய்யவும்.'); }
      else backupText().then(file => cap.Plugins.DownloadsWriter.save({ name: 'kozhi_pannai_backup.json', data: file }))
        .then(r => backupStatus(r && r.note ? '⚠ ' + r.note : '✓ தானியங்கி காப்பு Downloads-இல் புதுப்பிக்கப்பட்டது.'))
        .catch(err => backupStatus('காப்பு சேமிப்பில் பிழை: ' + (err && err.message ? err.message : err)));
    }
  }
  function backupStatus(msg) { $('backupStatus').textContent = msg; }

  // Backup text: the record data plus every saved photo, so a restore brings back everything
  async function backupText() {
    const photoData = {};
    const refs = [];
    state.pairs.forEach(p => { if (p.rooster && p.rooster.startsWith('idb:')) refs.push(p.rooster); if (p.hen && p.hen.startsWith('idb:')) refs.push(p.hen); });
    for (const r of [...new Set(refs)]) {
      try {
        const u = await getPhotoURL(r);
        if (u) {
          const blob = await (await fetch(u)).blob();
          photoData[r] = await blobToDataURL(blob);
        }
      } catch (e) { /* skip a photo that cannot be read */ }
    }
    return JSON.stringify({ savedAt: new Date().toISOString(), state: state, photoData: photoData });
  }
  function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  // Put one photo back into the phone storage under the same name it had
  async function restorePhoto(ref, dataURL) {
    const blob = await (await fetch(dataURL)).blob();
    const id = ref.slice(4);
    const db = await openPhotoDb();
    await new Promise((res, rej) => {
      const tx = db.transaction('p', 'readwrite');
      tx.objectStore('p').put(blob, id);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }
  function showBackupInfo() {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) { $('backupInfo').textContent = 'தானியங்கி காப்பு இன்னும் எடுக்கப்படவில்லை.'; return; }
    const d = new Date(JSON.parse(raw).savedAt);
    $('backupInfo').textContent = 'கடைசி தானியங்கி காப்பு: ' + d.toLocaleString('ta-IN');
  }
  function applyState(data) {
    Object.assign(state, DEFAULTS, data);
    renderAll();
  }





  // Pick a backup file from the phone and restore everything in it (records and photos)
  $('backupPickFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const obj = JSON.parse(fr.result);
        if (!obj.state) throw new Error('இந்தக் கோப்பு சரியான காப்புப் பிரதி இல்லை');
        const pd = obj.photoData || {};
        for (const ref of Object.keys(pd)) await restorePhoto(ref, pd[ref]);
        applyState(obj.state);
        backupStatus('✓ தேர்ந்த கோப்பிலிருந்து எல்லா தகவல்களும் படங்களும் மீட்டெடுக்கப்பட்டன.');
      } catch (err) {
        backupStatus('மீட்டெடுக்க முடியவில்லை: ' + (err && err.message ? err.message : err));
      }
      e.target.value = '';
    };
    fr.readAsText(f);
  });

  // Send the backup file through WhatsApp (the share sheet lets you pick WhatsApp)
  $('backupWhatsApp').addEventListener('click', async () => {
    const cap = window.Capacitor;
    try {
      const text = await backupText();
      if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins.Filesystem && cap.Plugins.Share) {
        const f = await cap.Plugins.Filesystem.writeFile({ path: 'kozhi_pannai_backup.json', data: text, directory: 'CACHE', encoding: 'utf8', recursive: true });
        await cap.Plugins.Share.share({ title: 'காப்புப் பிரதி', text: 'கோழி பண்ணை காப்புப் பிரதி', files: [f.uri], dialogTitle: 'WhatsApp-ஐ தேர்ந்தெடுக்கவும்' });
        backupStatus('✓ காப்பு அனுப்பப்பட்டது.');
        return;
      }
      const file = new File([text], 'kozhi_pannai_backup.json', { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'காப்புப் பிரதி' });
        backupStatus('✓ காப்பு அனுப்பப்பட்டது.');
      } else {
        backupStatus('இந்த உலாவியில் நேரடியாக அனுப்ப முடியாது. APK-ஐ பயன்படுத்தவும்.');
      }
    } catch (err) {
      if (!(err && err.name === 'AbortError')) backupStatus('அனுப்ப முடியவில்லை: ' + (err && err.message ? err.message : err) + '. மாற்று வழி: Files App-இல் Downloads > kozhi_pannai_backup.json-ஐ தட்டி Share > WhatsApp தேர்வு செய்யவும்.');
    }
  });
  $('backupAutoRestore').addEventListener('click', () => {
    const undo = localStorage.getItem(UNDO_KEY);
    if (undo) {
      applyState(JSON.parse(undo).state);
      localStorage.removeItem(UNDO_KEY);
      backupStatus('✓ நீக்குவதற்கு முன் இருந்த நிலைக்குத் திரும்பியது.');
      return;
    }
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) { backupStatus('மீட்க எதுவும் இல்லை.'); return; }
    applyState(JSON.parse(raw).state);
    backupStatus('✓ கடைசி காப்பிலிருந்து மீட்டெடுக்கப்பட்டது.');
  });



  // ---------- மேலும்: தீவன கணக்கீடு, எடை, லாப அறிக்கை, விலை, தேடுதல், CSV ----------
  function feedGrams(weeks) {
    if (weeks <= 2) return 20;
    if (weeks <= 6) return 50;
    if (weeks <= 12) return 80;
    if (weeks <= 18) return 110;
    return 115;
  }
  function calcFeed() {
    const n = Number($('feedCalcCount').value) || 0;
    const age = Number($('feedCalcAge').value) || 0;
    const days = age * Number($('feedCalcUnit').value);
    const weeks = days / 7;
    const bands = document.querySelectorAll('#feedBands .band');
    bands.forEach(b => {
      const on = age > 0 && weeks >= Number(b.dataset.min) && weeks <= Number(b.dataset.max) + 0.999;
      b.style.background = on ? 'linear-gradient(160deg,#2e8b57,#1f6b43)' : '#f7faf6';
      b.style.color = on ? '#ffffff' : '#111111';
      b.style.fontWeight = on ? '700' : '400';
    });
    if (!n || !age) { $('feedCalcResult').textContent = ''; return; }
    const g = feedGrams(weeks);
    const kg = n * g / 1000;
    $('feedCalcResult').textContent = 'வயது ' + days + ' நாள் (' + weeks.toFixed(1) + ' வாரம்) · தினசரி தேவை: ' + kg.toFixed(2) + ' கிலோ (ஒரு கோழிக்கு ' + g + ' கிராம்)';
  }
  $('feedCalcCount').addEventListener('input', calcFeed);
  $('feedCalcAge').addEventListener('input', calcFeed);
  $('feedCalcUnit').addEventListener('change', calcFeed);

  function weightChart() {
    const box = $('weightChart');
    box.innerHTML = '';
    const sel = $('weightFilter');
    const batch = sel ? sel.value : 'all';
    const pts = state.weights.filter(w => batch === 'all' || w.batch === batch)
      .sort((x, y) => x.date.localeCompare(y.date));
    if (!pts.length) { box.appendChild(el('div', 'meta', 'எடை பதிவுகள் இல்லை')); return; }

    const kgs = pts.map(p => p.kg);
    const first = pts[0], last = pts[pts.length - 1];
    const avg = kgs.reduce((t, v) => t + v, 0) / kgs.length;
    const gain = last.kg - first.kg;
    const days = Math.max(1, Math.round((new Date(last.date) - new Date(first.date)) / 86400000));
    const perDay = pts.length > 1 ? gain / days : 0;

    const sum = el('div', 'meta', '');
    sum.style.cssText = 'line-height:1.7;font-size:14px;color:#111111;margin-bottom:6px';
    sum.innerHTML = '';
    [
      'பதிவுகள்: ' + pts.length + (batch !== 'all' ? ' · Batch ' + batch : ''),
      'முதல் எடை: ' + first.kg + ' கிலோ (' + first.date + ')',
      'கடைசி எடை: ' + last.kg + ' கிலோ (' + last.date + ')',
      'சராசரி எடை: ' + avg.toFixed(2) + ' கிலோ',
      'வளர்ச்சி: ' + (gain >= 0 ? '+' : '') + gain.toFixed(2) + ' கிலோ · நாள் ஒன்றுக்கு ' + (perDay * 1000).toFixed(0) + ' கிராம்'
    ].forEach(t => { const r = el('div', '', t); sum.appendChild(r); });
    box.appendChild(sum);

    if (pts.length < 2) { box.appendChild(el('div', 'meta', 'வரைபடத்திற்கு குறைந்தது 2 பதிவுகள் தேவை.')); return; }

    const W = 340, H = 220, L = 44, R = 14, T = 16, B = 34;
    const lo = Math.min(...kgs), hi = Math.max(...kgs);
    const pad = Math.max(0.1, (hi - lo) * 0.15);
    const minY = lo - pad, maxY = hi + pad, span = maxY - minY;
    const xOf = i => L + i * (W - L - R) / (pts.length - 1);
    const yOf = v => T + (H - T - B) * (1 - (v - minY) / span);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', '100%');
    svg.style.cssText = 'display:block;background:#fbfcf8;border-radius:12px';
    const add = (tag, attrs, text) => {
      const e = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      if (text != null) e.textContent = text;
      svg.appendChild(e);
      return e;
    };
    // grid and kg labels
    for (let g = 0; g <= 4; g++) {
      const v = minY + span * g / 4;
      const y = yOf(v);
      add('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: '#d9e3d9', 'stroke-width': 1 });
      add('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 10, fill: '#334' }, v.toFixed(1));
    }
    // average line
    add('line', { x1: L, x2: W - R, y1: yOf(avg), y2: yOf(avg), stroke: '#d4a72c', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' });
    add('text', { x: W - R, y: yOf(avg) - 4, 'text-anchor': 'end', 'font-size': 10, fill: '#8a6508' }, 'சராசரி ' + avg.toFixed(1));
    // growth line
    const d = pts.map((p, i) => xOf(i) + ',' + yOf(p.kg)).join(' ');
    add('polyline', { points: d, fill: 'none', stroke: '#2e8b57', 'stroke-width': 2.5, 'stroke-linejoin': 'round' });
    // points and values
    pts.forEach((p, i) => {
      const x = xOf(i), y = yOf(p.kg);
      add('circle', { cx: x, cy: y, r: 4, fill: '#1f6b43', stroke: '#ffffff', 'stroke-width': 1.5 });
      if (pts.length <= 12 || i === pts.length - 1) {
        add('text', { x: x, y: y - 8, 'text-anchor': 'middle', 'font-size': 10, fill: '#111' }, p.kg);
      }
    });
    // date labels: first, middle, last
    const dl = d => { const [yy, mm, dd] = d.split('-'); return dd + '/' + mm; };
    const idxs = [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
    [...new Set(idxs)].forEach(i => {
      const anchor = i === 0 ? 'start' : (i === pts.length - 1 ? 'end' : 'middle');
      add('text', { x: xOf(i), y: H - 12, 'text-anchor': anchor, 'font-size': 10, fill: '#334' }, dl(pts[i].date));
    });
    box.appendChild(svg);
  }
  function renderWeights() {
    const sel = $('weightFilter');
    if (sel) {
      const keep = sel.value || 'all';
      const batches = [...new Set(state.weights.map(w => w.batch).filter(Boolean))];
      sel.innerHTML = '';
      ['all'].concat(batches).forEach(b => {
        const o = document.createElement('option');
        o.value = b; o.textContent = b === 'all' ? 'எல்லா Batch' : 'Batch ' + b;
        sel.appendChild(o);
      });
      sel.value = ['all'].concat(batches).includes(keep) ? keep : 'all';
      sel.onchange = weightChart;
    }
    const ORD = ['முதல்', 'இரண்டாம்', 'மூன்றாம்', 'நான்காம்', 'ஐந்தாம்', 'ஆறாம்', 'ஏழாம்', 'எட்டாம்', 'ஒன்பதாம்', 'பத்தாம்'];
    const wLabel = {};
    const wCount = {};
    [...state.weights].sort((x, y) => x.date.localeCompare(y.date)).forEach(w => {
      const k = w.batch || '';
      wCount[k] = (wCount[k] || 0) + 1;
      wLabel[w.id] = (ORD[wCount[k] - 1] || (wCount[k] + '-ஆம்')) + ' எடை';
    });
    fill($('weightList'), [...state.weights].sort((x, y) => y.date.localeCompare(x.date)).map(w =>
      entry('⚖️', wLabel[w.id] + ': ' + w.kg + ' கிலோ', (w.batch ? 'Batch ' + w.batch + ' · ' : '') + w.date, null, '',
        () => { state.weights = state.weights.filter(x => x.id !== w.id); renderAll(); })), 'எடை பதிவுகள் இல்லை');
    weightChart();
  }
  $('weightForm').addEventListener('submit', e => {
    e.preventDefault();
    if ($('weightDate').value > todayStr) { alert('எதிர்கால தேதி பதிவு செய்ய முடியாது.'); return; }
    state.weights.push({ id: uid(), date: $('weightDate').value, batch: $('weightBatch').value.trim(), kg: Number($('weightKg').value) });
    e.target.reset(); $('weightDate').value = todayStr; renderAll();
  });

  function renderMonthReport() {
    const months = {};
    state.accounts.forEach(a => {
      const m = (a.date || '').slice(0, 7);
      if (!m) return;
      months[m] = months[m] || { income: 0, expense: 0 };
      if (a.type === 'in') months[m].income += Number(a.amount) || 0;
      else months[m].expense += Number(a.amount) || 0;
    });
    const box = $('monthReport');
    box.innerHTML = '';
    const keys = Object.keys(months).sort().reverse();
    if (!keys.length) { box.appendChild(el('div', 'empty', 'கணக்குப் பதிவுகள் இல்லை')); return; }
    keys.forEach(m => {
      const v = months[m];
      const profit = v.income - v.expense;
      const pct = v.income > 0 ? (profit / v.income * 100).toFixed(1) + '%' : '-';
      box.appendChild(entry('📅', m, 'வரவு ₹' + v.income.toFixed(2) + ' · செலவு ₹' + v.expense.toFixed(2) + ' · லாப சதவீதம் ' + pct,
        (profit < 0 ? '-' : '+') + '₹' + Math.abs(profit).toFixed(2), profit < 0 ? 'neg' : 'pos', () => {}));
    });
  }

  function renderPrices() {
    fill($('priceList'), [...state.prices].sort((a, b) => b.date.localeCompare(a.date)).map(p => {
      const extra = [];
      if (p.buyer) extra.push('வாங்குபவர்: ' + p.buyer + (p.contact ? ' ' + p.contact : ''));
      if (p.note) extra.push('குறிப்பு: ' + p.note);
      return entry('💰', p.item + ' · ₹' + Number(p.price).toFixed(2), 'Batch ' + bOf(p) + ' · ' + p.date + (extra.length ? ' · ' + extra.join(' · ') : ''), null, '',
        () => { state.prices = state.prices.filter(x => x.id !== p.id); renderAll(); });
    }), 'விலை பதிவுகள் இல்லை');
  }
  $('priceForm').addEventListener('submit', e => {
    e.preventDefault();
    if ($('priceDate').value > todayStr) { alert('எதிர்கால தேதி பதிவு செய்ய முடியாது.'); return; }
    state.prices.push({ id: uid(), date: $('priceDate').value, item: $('priceItem').value, price: Number($('priceValue').value),
      buyer: $('priceBuyer').value.trim(), contact: $('priceContact').value.trim(), note: $('priceNote').value.trim(), batch: $('priceBatch').value });
    e.target.reset(); $('priceDate').value = todayStr; renderAll();
  });

  // Income and expense by source; the total matches the profit shown above
  function renderProfitBreakdown() {
    const box = $('profitBreakdown');
    if (!box) return;
    const inc = {}, exp = {};
    state.accounts.forEach(a => {
      const k = a.category || a.note || 'இதர';
      const amt = Number(a.amount) || 0;
      if (a.type === 'in') inc[k] = (inc[k] || 0) + amt;
      else exp[k] = (exp[k] || 0) + amt;
    });
    const fc = feedCost();
    if (fc) exp['தீவன வாங்குதல்'] = (exp['தீவன வாங்குதல்'] || 0) + fc;
    const row = (name, val, cls) => {
      const r = el('div', '');
      r.style.cssText = 'display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px dashed var(--muted);font-size:15px';
      const a = el('span', '', name);
      a.style.color = '#111111';
      const b = el('b', '', '₹' + val.toFixed(2));
      b.style.color = cls === 'pos' ? '#1f7a4d' : '#b03030';
      r.append(a, b);
      return r;
    };
    const head = t => { const h = el('div', '', t); h.style.cssText = 'font-weight:700;margin-top:10px;color:#111111;font-size:15px'; return h; };
    box.innerHTML = '';
    box.appendChild(head('வரவு'));
    const ik = Object.keys(inc);
    if (!ik.length) box.appendChild(el('div', 'meta', 'வரவு பதிவு இல்லை'));
    ik.forEach(k => box.appendChild(row(k, inc[k], 'pos')));
    box.appendChild(head('செலவு'));
    const ek = Object.keys(exp);
    if (!ek.length) box.appendChild(el('div', 'meta', 'செலவு பதிவு இல்லை'));
    ek.forEach(k => box.appendChild(row(k, exp[k], 'neg')));
    const topIn = ik.slice().sort((x, y) => inc[y] - inc[x])[0];
    const topEx = ek.slice().sort((x, y) => exp[y] - exp[x])[0];
    const hi = t => {
      const h = el('div', '', t);
      h.style.cssText = 'margin-top:8px;padding:8px 10px;border-radius:10px;background:#e6f4ec;color:#111111;font-weight:600;font-size:15px';
      return h;
    };
    if (topIn) box.appendChild(hi('🏆 அதிக வரவு: ' + topIn + ' (₹' + inc[topIn].toFixed(2) + ')'));
    if (topEx) box.appendChild(hi('⚠️ அதிக செலவு: ' + topEx + ' (₹' + exp[topEx].toFixed(2) + ')'));
    const total = profitTotal();
    box.appendChild(head('மொத்த லாபம் / நஷ்டம்'));
    box.appendChild(row('மொத்தம்', total, total < 0 ? 'neg' : 'pos'));
  }

  function renderRates() {
    const sorted = [...state.rates].sort((a, b) => b.date.localeCompare(a.date));
    fill($('rateList'), sorted.map(r => entry('💹', r.item + ' : ₹' + Number(r.rate).toFixed(2) + ' / கிலோ', r.date, null, '',
      () => { state.rates = state.rates.filter(x => x.id !== r.id); renderAll(); })), 'விலை நிலவரம் இல்லை');
    const latest = {};
    sorted.forEach(r => { if (!latest[r.item]) latest[r.item] = r; });
    const line = $('feedRateLine');
    if (line) {
      const parts = FEED_ITEMS.filter(i => latest[i]).map(i => i + ' ₹' + Number(latest[i].rate).toFixed(2) + '/கிலோ');
      line.textContent = parts.length ? 'விலை நிலவரம்:\n' + parts.join('\n') : 'விலை நிலவரம் இன்னும் உள்ளிடவில்லை';
    }
  }
  $('rateForm').addEventListener('submit', e => {
    e.preventDefault();
    state.rates.push({ id: uid(), date: $('rateDate').value, item: $('rateItem').value, rate: Number($('rateValue').value) });
    e.target.reset(); $('rateDate').value = todayStr; renderAll();
  });

  // Total birds card: totals by breed, bought, losses and loss %; tapping opens the birds tab
  function renderBirdStock() {
    const total = totalBirdsNow();
    $('birdStockValue').textContent = total;
    const bought = state.birds.reduce((t, b) => t + Number(b.count || 0), 0);
    const lost = state.losses.reduce((t, l) => t + Number(l.count || 0), 0);
    const pct = bought ? (lost / bought * 100).toFixed(1) : '0.0';
    const byBreed = {};
    state.birds.forEach(b => {
      const dead = state.losses.filter(l => l.batch === b.batch).reduce((t, l) => t + Number(l.count || 0), 0);
      byBreed[b.breed] = (byBreed[b.breed] || 0) + (Number(b.count || 0) - dead);
    });
    const lines = Object.keys(byBreed).map(k => k + ': ' + byBreed[k]);
    lines.push('வரவு: ' + bought, 'மொத்த இழப்பு: ' + lost + ' (' + pct + '%)');
    $('birdStockDetail').textContent = state.birds.length ? lines.join('\n') : 'கோழி பதிவு இல்லை';
  }
  $('birdStockCard').addEventListener('click', () => {
    const t = document.querySelector('.tab[data-tab="birds"]');
    if (t && !t.classList.contains('active')) t.click();
  });

  function renderMore() {
    renderRates();
    renderWeights();
    renderMonthReport();
    renderPrices();
    runSearch();
  }

  function runSearch() {
    const q = $('searchBox').value.trim().toLowerCase();
    const box = $('searchResults');
    box.innerHTML = '';
    if (!q) return;
    const hit = t => String(t || '').toLowerCase().includes(q);
    const rows = [];
    state.birds.forEach(b => { if (hit(b.breed) || hit(b.batch) || hit(b.date)) rows.push(['🐔', b.breed + ' — ' + b.count + ' கோழிகள்', 'Batch ' + (b.batch || '-') + ' · ' + b.date]); });
    state.losses.forEach(l => { if (hit(l.batch) || hit(l.date) || hit(l.age)) rows.push(['📉', (l.age || 'இழப்பு') + ' — ' + l.count, 'Batch ' + (l.batch || '-') + ' · ' + l.date]); });
    state.eggs.forEach(e => { if (hit(e.hatchery) || hit(e.date)) rows.push(['🥚', (e.hatchery ? e.hatchery + ' · ' : '') + e.count + ' முட்டைகள்', e.date]); });
    state.accounts.forEach(a => { if (hit(a.category) || hit(a.note) || hit(a.batch) || hit(a.buyer) || hit(a.date)) rows.push(['🧾', (a.category || a.note || 'கணக்கு') + ' — ₹' + Number(a.amount).toFixed(2), (a.buyer ? a.buyer + ' · ' : '') + a.date]); });
    state.feed.forEach(f => { if (hit(f.item) || hit(f.date)) rows.push(['🌾', (f.item || 'தீவனம்') + ' — ' + f.kg + ' கிலோ', f.date]); });
    if (!rows.length) { box.appendChild(el('div', 'empty', 'பொருந்தும் பதிவுகள் இல்லை')); return; }
    rows.forEach(r => box.appendChild(entry(r[0], r[1], r[2], null, '', () => {})));
  }
  $('searchBox').addEventListener('input', runSearch);

  function csvCell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  function buildCsv() {
    const lines = ['வகை,தேதி,விவரம்,தொகை,எண்ணிக்கை,Batch'];
    state.birds.forEach(b => lines.push([csvCell('கோழி வரவு'), csvCell(b.date), csvCell(b.breed + ' ' + (b.age || '')), '', csvCell(b.count), csvCell(b.batch)].join(',')));
    state.losses.forEach(l => lines.push([csvCell('இழப்பு'), csvCell(l.date), csvCell(l.age + ' ' + (l.reason || '')), '', csvCell(l.count), csvCell(l.batch)].join(',')));
    state.eggs.forEach(e => lines.push([csvCell(e.hatchery ? 'Hatchery' : 'முட்டை உற்பத்தி'), csvCell(e.date), csvCell(e.hatchery || ''), '', csvCell(e.count), ''].join(',')));
    state.accounts.forEach(a => lines.push([csvCell(a.type === 'in' ? 'வரவு' : 'செலவு'), csvCell(a.date), csvCell((a.category || '') + ' ' + (a.note || '') + ' ' + (a.buyer || '')), csvCell(Number(a.amount).toFixed(2)), csvCell(a.eggs || ''), csvCell(a.batch)].join(',')));
    state.feed.forEach(f => lines.push([csvCell(f.type === 'in' ? 'தீவனம் வாங்கியது' : 'தீவனம் பயன்படுத்தியது'), csvCell(f.date), csvCell(f.item), csvCell(f.amt || ''), csvCell(f.kg), ''].join(',')));
    state.weights.forEach(w => lines.push([csvCell('எடை'), csvCell(w.date), csvCell(w.batch), '', csvCell(w.kg), csvCell(w.batch)].join(',')));
    state.prices.forEach(p => lines.push([csvCell('விலை'), csvCell(p.date), csvCell(p.item), csvCell(p.price), '', ''].join(',')));
    return '\ufeff' + lines.join('\n');
  }
  $('csvExport').addEventListener('click', () => {
    const csv = buildCsv();
    const name = 'kozhi_pannai_' + todayStr + '.csv';
    const cap = window.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins.DownloadsWriter) {
      cap.Plugins.DownloadsWriter.save({ name: name, data: csv }).then(() => alert('Downloads-இல் சேமிக்கப்பட்டது: ' + name)).catch(err => alert('பிழை: ' + err.message));
      return;
    }
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  let pendingDelete = null;
  function askDelete(fn, label) {
    pendingDelete = { fn: fn, label: label };
    $('confirmBox').style.display = 'flex';
  }
  $('confirmNo').addEventListener('click', () => {
    pendingDelete = null;
    $('confirmBox').style.display = 'none';
  });
  const HIST_KEYS = ['birds', 'eggs', 'accounts', 'alerts', 'losses', 'feed', 'pairs', 'weights', 'prices', 'rates', 'vaccines'];
  const HIST_SECTION = { birds: 'கோழி வரவு', eggs: 'முட்டை', accounts: 'கணக்கு', alerts: 'நினைவூட்டல்',
    losses: 'இழப்பு', feed: 'தீவனம்', pairs: 'இணை சேர்க்கை', weights: 'எடை பதிவு', prices: 'விலை பதிவு', rates: 'விலை நிலவரம்', vaccines: 'தடுப்பூசி பதிவு' };
  const HIST_LABELS = {
    birds: { breed: 'இனம்', count: 'எண்ணிக்கை', batch: 'Batch', age: 'வயது', date: 'வாங்கிய தேதி' },
    eggs: { count: 'முட்டை எண்ணிக்கை', date: 'தேதி', broken: 'உடைந்தவை', hatchery: 'Hatchery / அடை',
      sent: 'கொடுத்த தேதி / வைத்த தேதி', collect: 'வாங்கும் தேதி', hatch: 'பொறிப்பு தேதி' },
    accounts: { type: 'வகை', category: 'பிரிவு', amount: 'தொகை (₹)', note: 'விவரம்', batch: 'Batch',
      eggs: 'விற்ற முட்டை', feedItem: 'தீவன வகை', date: 'தேதி' },
    alerts: { text: 'நினைவூட்டல்', date: 'தேதி' },
    losses: { age: 'வயது வகை', reason: 'காரணம்', batch: 'Batch', count: 'எண்ணிக்கை', date: 'தேதி' },
    feed: { type: 'வகை', item: 'பொருள்', kg: 'கிலோ', amt: 'விலை (₹)', date: 'தேதி' },
    pairs: { name: 'பெயர்', date: 'தேதி' },
    weights: { batch: 'Batch', kg: 'சராசரி எடை (கிலோ)', date: 'தேதி' },
    prices: { item: 'பொருள்', price: 'விலை (₹)', buyer: 'வாங்குபவர்', contact: 'தொடர்பு எண்', note: 'குறிப்பு', date: 'தேதி' },
    rates: { item: 'பொருள்', rate: 'விலை (₹ / கிலோ)', date: 'தேதி' },
    vaccines: { name: 'தடுப்பூசி', count: 'கோழி எண்ணிக்கை', batch: 'Batch', date: 'தேதி', next: 'அடுத்த தடுப்பூசி தேதி' }
  };
  function historyDetails(section, x) {
    const out = [];
    const labels = HIST_LABELS[section];
    Object.keys(labels).forEach(k => {
      let v = x[k];
      if (v === undefined || v === null || v === '') return;
      if (k === 'type') v = section === 'accounts' ? (v === 'in' ? 'வரவு' : 'செலவு') : (v === 'in' ? 'வாங்கியது' : 'பயன்படுத்தியது');
      if (k === 'amount' || k === 'amt') v = Number(v).toFixed(2);
      out.push([labels[k], String(v)]);
    });
    if (section === 'pairs') out.push(['சேவல் படம்', x.rooster || 'இல்லை'], ['பெட்டை படம்', x.hen || 'இல்லை']);
    return out;
  }
  $('confirmYes').addEventListener('click', () => {
    const p = pendingDelete;
    pendingDelete = null;
    $('confirmBox').style.display = 'none';
    if (!p) return;
    localStorage.setItem(UNDO_KEY, JSON.stringify({ savedAt: new Date().toISOString(), state: state }));
    const before = {};
    HIST_KEYS.forEach(k => { before[k] = state[k].slice(); });
    p.fn();
    if (!p.label) return;
    HIST_KEYS.forEach(k => {
      const remaining = new Set(state[k].map(x => x.id));
      before[k].filter(x => !remaining.has(x.id)).forEach(x => {
        state.history.unshift({ id: uid(), section: HIST_SECTION[k], text: 'நீக்கப்பட்டது',
          when: new Date().toLocaleString('ta-IN'), details: historyDetails(k, x) });
      });
    });
    renderAll();
  });

  const FEED_ITEMS = ['அரிசி', 'கம்பு', 'சோளம்', 'தீவனம்', 'கம்பெனி தீவனம்', 'இதர பொருட்கள்'];
  ['feedItem', 'useItem', 'rateItem'].forEach(id => {
    const sel = $(id);
    FEED_ITEMS.forEach(x => { const o = document.createElement('option'); o.value = x; o.textContent = x; sel.appendChild(o); });
  });

  $('feedForm').addEventListener('submit', e => {
    e.preventDefault();
    state.feed.push({ id: uid(), at: new Date().toISOString(), type: 'in', item: $('feedItem').value,
      kg: Number($('feedKg').value), amt: Number($('feedKg').value) * Number($('feedAmt').value || 0), date: $('feedDate').value, batch: $('feedBatch').value });
    e.target.reset(); $('feedDate').value = todayStr; renderAll();
  });

  $('useForm').addEventListener('submit', e => {
    e.preventDefault();
    const item = $('useItem').value, kg = Number($('useKg').value);
    if (kg > itemStock(item)) { alert(item + ' இருப்பு ' + itemStock(item).toFixed(1) + ' கிலோ மட்டுமே உள்ளது.'); return; }
    state.feed.push({ id: uid(), at: new Date().toISOString(), type: 'out', item: item, kg: kg, amt: 0, date: $('useDate').value, batch: $('useBatch').value });
    e.target.reset(); $('useDate').value = todayStr; renderAll();
  });
  $('saveMin').addEventListener('click', () => {
    state.feedMin = Math.max(0, Number($('feedMin').value) || 0);
    renderAll();
  });
  const CATS = {
    in: ['முட்டை விற்பனை', 'கோழி குஞ்சு விற்பனை', 'கோழி விற்பனை'],
    out: ['மருந்து செலவு', 'புதிய கோழி செலவு', 'இதர செலவு']
  };
  function fillCats() {
    const t = $('accType').value;
    const sel = $('accCategory');
    const prev = sel.value;
    sel.innerHTML = '';
    CATS[t].forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
    if (CATS[t].includes(prev)) sel.value = prev;
    toggleOther();
  }
  function toggleOther() {
    const show = $('accType').value === 'out' && $('accCategory').value === 'இதர செலவு';
    $('accOtherWrap').classList.toggle('hidden', !show);
    const showEggs = $('accType').value === 'in' && $('accCategory').value === 'முட்டை விற்பனை';
    $('accEggWrap').classList.toggle('hidden', !showEggs);
    const feedMode = $('accType').value === 'out' && $('accCategory').value === 'தீவனம் செலவு';
    const otherMode = $('accType').value === 'out' && $('accCategory').value === 'இதர செலவு';
    $('accNoteWrap').classList.toggle('hidden', feedMode || otherMode);
    $('accBuyerWrap').classList.toggle('hidden', $('accType').value !== 'in');
    $('accFeedWrap').classList.toggle('hidden', !feedMode);
    if (feedMode) fillAccFeed();
  }
  function fillAccFeed() {
    const sel = $('accFeedItem');
    const prev = sel.value;
    sel.innerHTML = '';
    ['அரிசி', 'கம்பு', 'சோளம்', 'தீவனம்', 'கம்பெனி தீவனம்', 'இதர பொருட்கள்'].forEach(x => {
      const o = document.createElement('option');
      o.value = x;
      o.textContent = x + ' (' + itemStock(x).toFixed(1) + ' கிலோ)';
      sel.appendChild(o);
    });
    if (prev) sel.value = prev;
    $('accFeedStock').textContent = 'இருப்பு: ' + itemStock(sel.value).toFixed(1) + ' கிலோ';
  }
  $('accFeedItem').addEventListener('change', fillAccFeed);
  $('accType').addEventListener('change', fillCats);
  $('accCategory').addEventListener('change', toggleOther);
  fillCats();

  $('accForm').addEventListener('submit', e => {
    e.preventDefault();
    let category = $('accCategory').value;
    const feedItem = (category === 'தீவனம் செலவு') ? $('accFeedItem').value : '';
    if (category === 'இதர செலவு') {
      const other = $('accOther').value.trim();
      if (!other) { alert('இதர செலவின் பெயரை எழுதவும்.'); return; }
      category = other;
    }
    const feedKg = Number($('accFeedKg').value || 0);
    if (feedItem && !(feedKg > 0)) { alert('தீவனத்தின் கிலோ அளவை உள்ளிடவும்.'); return; }
    if (feedItem) {
      state.feed.push({ id: uid(), type: 'in', item: feedItem, kg: feedKg, amt: 0,
        date: $('accDate').value, fromAccount: true, batch: $('accBatch').value });
    }
    state.accounts.push({ id: uid(), type: $('accType').value, category: category, kg: feedKg,
      amount: Number($('accAmount').value), note: feedItem || ($('accNoteWrap').classList.contains('hidden') ? '' : $('accNote').value.trim()),
      batch: $('accBatch').value, date: $('accDate').value, feedItem: feedItem,
      buyer: $('accType').value === 'in' ? $('accBuyer').value.trim() : '', phone: $('accType').value === 'in' ? $('accPhone').value.trim() : '',
      eggs: category === 'முட்டை விற்பனை' ? Number($('accEggs').value || 0) : 0 });
    e.target.reset(); $('accDate').value = todayStr; fillCats(); renderAll();
  });
  $('vaxForm').addEventListener('submit', e => {
    e.preventDefault();
    state.vaccines.push({ id: uid(), name: $('vaxName').value.trim(), date: $('vaxDate').value,
      batch: $('vaxBatch').value.trim(), count: Number($('vaxCount').value), next: $('vaxNext').value });
    e.target.reset(); $('vaxDate').value = todayStr; renderAll();
  });

  $('alertForm').addEventListener('submit', e => {
    e.preventDefault();
    state.alerts.push({ id: uid(), text: $('alertText').value.trim(), date: $('alertDate').value, batch: $('alertBatch').value });
    e.target.reset(); $('alertDate').value = todayStr; renderAll();
  });

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      Object.assign(state, DEFAULTS, JSON.parse(raw));
    } else {
      const auto = localStorage.getItem(BACKUP_KEY);
      if (auto) Object.assign(state, DEFAULTS, JSON.parse(auto).state);
    }
  } catch (err) { console.error(err); }
  ready = true;
  renderAll();
  $('saveState').textContent = '✓ சேமிக்கப்பட்டது';


if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

  // ---------- Poultry diseases, medicines and vaccine schedule ----------
  const GUIDE = {"diseases":[{"name_ta":"வெள்ளைக்கழிச்சல் (ராணிகெட்)","name_en":"Ranikhet Disease / Newcastle Disease","category":"வைரஸ்","severity":"மிக அதிகம்","mortality":"80–100%","symptoms":["பச்சை அல்லது வெள்ளை கழிச்சல்","கழுத்து முறுக்குதல்","மூச்சுத் திணறல்","சிறகுகள் தொங்குதல்","திடீர் இறப்பு","முட்டை உற்பத்தி குறைவு"],"prevention":["Lasota மற்றும் R2B/RDVK தடுப்பூசிகளை அட்டவணைப்படி போடுதல்","பூஸ்டர் டோஸ்களைத் தவறாமல் கொடுத்தல்","புதிய கோழிகளைத் தனிமைப்படுத்துதல்"],"medicines":["நேரடி மருந்து இல்லை","இரண்டாம் நிலை பாக்டீரியா தொற்றுக்கு Enrofloxacin அல்லது Doxycycline (மருத்துவர் பரிந்துரை)","எலக்ட்ரோலைட், வைட்டமின் B-complex, வைட்டமின் E ஆதரவு"],"notes":"அரசு அறிவிக்கக்கூடிய நோய். சந்தேகம் இருந்தால் உடனே கால்நடைத் துறைக்குத் தெரிவிக்கவும்."},{"name_ta":"பறவைக் காய்ச்சல் (H5N1 / H5N8)","name_en":"Avian Influenza","category":"வைரஸ்","severity":"மிக அதிகம்","mortality":"அதிகம்","symptoms":["திடீர் இறப்பு","தலை, கழுத்து, கண் வீக்கம்","கொண்டை மற்றும் கால்கள் நீலமாதல்","முட்டை உற்பத்தி திடீர் குறைவு","தீவனம் சாப்பிடாமை"],"prevention":["காட்டுப் பறவைகள் நுழையாத வலை அமைத்தல்","வெளியாட்கள் மற்றும் வாகனக் கட்டுப்பாடு","அரசு அறிவிக்கும் பகுதிகளில் அறிவுறுத்தப்பட்ட தடுப்பூசி மட்டும்"],"medicines":["குணப்படுத்த மருந்து இல்லை","அரசு உத்தரவின்படி அழித்தல் மற்றும் இழப்பீடு நடைமுறை","மனிதர்களுக்கும் பரவ வாய்ப்பு உள்ளதால் கையுறை, முகக்கவசம் அவசியம்"],"notes":"அரசு அறிவிக்கக்கூடிய நோய். உடனே கால்நடைத் துறைக்குத் தெரிவிக்கவும்."},{"name_ta":"கம்போரோ (Gumboro / IBD)","name_en":"Infectious Bursal Disease","category":"வைரஸ்","severity":"அதிகம்","mortality":"மாறுபடும்","symptoms":["சோர்வு மற்றும் தீவனம் குறைவு","பின்பக்கத்தில் ஈரம் அல்லது ஒட்டுதல்","வெள்ளை நீர் கழிச்சல்","நடுக்கம், தலை கீழே தொங்குதல்","இரண்டாம் நிலை நோய்த் தொற்று"],"prevention":["14–21 நாள் வயதில் IBD தடுப்பூசி","பூஸ்டர் டோஸ் கொடுத்தல்","கொட்டகையை சுத்தமாகவும் உலர்வாகவும் வைத்தல்"],"medicines":["நேரடி மருந்து இல்லை","எலக்ட்ரோலைட் மற்றும் வைட்டமின் K, வைட்டமின் C ஆதரவு","பாக்டீரியா தொற்றுக்கு மருத்துவர் பரிந்துரைக்கும் antibiotic"],"notes":"தடுப்பூசி போடாத குஞ்சுகளில் அதிக இழப்பு ஏற்படும்."},{"name_ta":"மாரெக்ஸ் (Marek's)","name_en":"Marek's Disease","category":"வைரஸ்","severity":"அதிகம்","mortality":"அதிகம்","symptoms":["கால் அல்லது இறக்கை முடக்கம்","கண்மணி சாம்பல் நிறமாதல்","உடலில் கட்டிகள்","எடை குறைவு"],"prevention":["குஞ்சு பிறந்த முதல் நாளிலேயே HVT தடுப்பூசி (பொதுவாக ஹேட்சரியில்)"],"medicines":["குணப்படுத்த மருந்து இல்லை","பாதிக்கப்பட்ட கோழிகளை தனிமைப்படுத்தி அழித்தல்"],"notes":"தடுப்பூசி மட்டுமே பாதுகாப்பு வழி."},{"name_ta":"அம்மை (Fowl Pox)","name_en":"Fowl Pox","category":"வைரஸ்","severity":"நடுத்தரம்","mortality":"மாறுபடும்","symptoms":["சீப்பு, முகம், கண்ணிமைகளில் கொப்புளம் மற்றும் புண்","வாயில் மஞ்சள் படலம் (ஈரமான வடிவம்)","சுவாசத் திணறல்","முட்டை குறைவு"],"prevention":["6–8 வார வயதில் Fowl pox தடுப்பூசி (இறக்கைத் தோலில் குத்தும் முறை)","கொசு மற்றும் ஈக்களைக் கட்டுப்படுத்துதல்"],"medicines":["நேரடி மருந்து இல்லை","புண்களை Povidone-iodine போன்ற கிருமிநாசினியால் சுத்தம் செய்தல்","இரண்டாம் நிலை தொற்றுக்கு மருத்துவர் பரிந்துரை antibiotic","வைட்டமின் A ஆதரவு"],"notes":""},{"name_ta":"தொற்று மூச்சுக்குழல் அழற்சி (IB)","name_en":"Infectious Bronchitis","category":"வைரஸ்","severity":"அதிகம்","mortality":"குஞ்சுகளில் அதிகம்","symptoms":["தும்மல் மற்றும் மூச்சுச் சத்தம்","கண்களில் நீர் வடிதல்","முட்டை ஓடு மற்றும் வடிவம் மாறுதல்","முட்டை உற்பத்தி குறைவு"],"prevention":["குஞ்சுப் பருவத்தில் IB தடுப்பூசி (H120 போன்றவை)","பூஸ்டர் டோஸ் கொடுத்தல்"],"medicines":["நேரடி மருந்து இல்லை","இரண்டாம் நிலை தொற்றுக்கு Oxytetracycline அல்லது Enrofloxacin (மருத்துவர் பரிந்துரை)","வைட்டமின் A, C, E ஆதரவு"],"notes":""},{"name_ta":"முட்டை வீழ்ச்சி நோய் (EDS)","name_en":"Egg Drop Syndrome","category":"வைரஸ்","severity":"நடுத்தரம்","mortality":"குறைவு","symptoms":["ஓடு இல்லாத அல்லது மென்மையான முட்டைகள்","முட்டை உற்பத்தி திடீர் வீழ்ச்சி","முட்டை நிறம் மங்குதல்"],"prevention":["16–18 வார வயதில் EDS தடுப்பூசி (முட்டை உற்பத்திக்கு முன்)"],"medicines":["நேரடி மருந்து இல்லை","கால்சியம் மற்றும் வைட்டமின் D3 கூடுதல் (மருத்துவர் ஆலோசனைப்படி)"],"notes":""},{"name_ta":"தொற்று குரல்வளை-மூச்சுக்குழல் அழற்சி (ILT)","name_en":"Infectious Laryngotracheitis","category":"வைரஸ்","severity":"அதிகம்","mortality":"மாறுபடும்","symptoms":["இருமல் மற்றும் மூச்சுத் திணறல்","இரத்தம் கலந்த சளி","கண் வீக்கம்","முட்டை உற்பத்தி குறைவு"],"prevention":["ILT தடுப்பூசி (கண் அல்லது மூக்கு வழியாக)"],"medicines":["நேரடி மருந்து இல்லை","இரண்டாம் நிலை தொற்றுக்கு மருத்துவர் பரிந்துரை antibiotic","ஆதரவு சிகிச்சை மற்றும் காற்றோட்டம்"],"notes":""},{"name_ta":"நரம்பு மண்டல அழற்சி (AE)","name_en":"Avian Encephalomyelitis","category":"வைரஸ்","severity":"நடுத்தரம்","mortality":"இளம் குஞ்சுகளில் அதிகம்","symptoms":["நடுக்கம் மற்றும் தள்ளாட்டம்","சமநிலை இழத்தல்","கண் பாதிப்பு","முட்டை உற்பத்தி குறைவு (பெட்டைக் கோழிகளில்)"],"prevention":["8–10 வார வயதில் AE தடுப்பூசி (பெட்டைக் கோழிகளுக்கு)"],"medicines":["நேரடி மருந்து இல்லை","ஆதரவு சிகிச்சை மற்றும் வைட்டமின் E"],"notes":""},{"name_ta":"ஃபௌல் காலரா (Fowl Cholera)","name_en":"Fowl Cholera (Pasteurella multocida)","category":"பாக்டீரியா","severity":"அதிகம்","mortality":"அதிகம்","symptoms":["திடீர் காய்ச்சல் மற்றும் இறப்பு","தலை, கண், தாடை வீக்கம்","மூச்சுத் திணறல்","பச்சை நிற கழிச்சல்","முட்டை குறைவு"],"prevention":["தடுப்பூசி (பண்ணையின் நிலைக்கு ஏற்ப)","சுத்தமான குடிநீர் மற்றும் உலர்ந்த குப்பை","காட்டுப் பறவைகளைத் தடுத்தல்"],"medicines":["Enrofloxacin, Tylosin, Oxytetracycline அல்லது Sulphonamides (மருத்துவர் பரிந்துரை)","மருந்து நிறுத்தக் காலத்தை (withdrawal period) கவனித்தல்"],"notes":""},{"name_ta":"கோலிபேசிலோசிஸ் (E. coli)","name_en":"Colibacillosis","category":"பாக்டீரியா","severity":"அதிகம்","mortality":"மாறுபடும்","symptoms":["வெள்ளை அல்லது பச்சை கழிச்சல்","வயிறு வீக்கம்","மூச்சுத் திணறல்","இதயம் அல்லது கல்லீரல் பாதிப்பு","திடீர் இறப்பு"],"prevention":["சுத்தமான குடிநீர் மற்றும் தீவனம்","கொட்டகை மற்றும் முட்டைகளைச் சுத்தம் செய்தல்","பண்ணை சார்ந்த தடுப்பூசி (மருத்துவர் பரிந்துரை)"],"medicines":["Enrofloxacin, Doxycycline அல்லது Colistin (மருத்துவர் பரிந்துரை)","Probiotic ஆதரவு"],"notes":""},{"name_ta":"சால்மோனெல்லா (பல்லோரம் / ஃபௌல் டைபாய்டு)","name_en":"Pullorum / Fowl Typhoid","category":"பாக்டீரியா","severity":"அதிகம்","mortality":"குஞ்சுகளில் அதிகம்","symptoms":["குஞ்சுகளில் வெள்ளை கழிச்சல்","வென்ட் பகுதியில் ஒட்டிய வெள்ளை மலம்","மூச்சு விடுவதில் சிரமம்","வளர்ச்சி குறைவு","பெரிய கோழிகளில் முட்டை குறைவு"],"prevention":["நோயற்ற பெற்றோர் மந்தையிலிருந்து குஞ்சுகள் வாங்குதல்","முட்டை மற்றும் குஞ்சு பொரிப்பகத்தைச் சுத்தம் செய்தல்"],"medicines":["மருத்துவர் பரிந்துரைக்கும் antibiotic மட்டும்","பாதிக்கப்பட்ட கோழிகளைத் தனிமைப்படுத்துதல்"],"notes":""},{"name_ta":"நாள்பட்ட சுவாச நோய் (CRD / Mycoplasma)","name_en":"Chronic Respiratory Disease (Mycoplasma gallisepticum)","category":"பாக்டீரியா (Mycoplasma)","severity":"நடுத்தரம்","mortality":"குறைவு, ஆனால் பொருளாதார இழப்பு அதிகம்","symptoms":["தும்மல் மற்றும் மூக்கு ஒழுகல்","மூச்சு விடுதல் சத்தம்","முகம் மற்றும் கண் வீக்கம்","முட்டை குறைவு","வளர்ச்சி குறைவு"],"prevention":["Mycoplasma இல்லாத மந்தையிலிருந்து குஞ்சுகள் வாங்குதல்","பண்ணை சுத்தம் மற்றும் காற்றோட்டம்","MG தடுப்பூசி (மருத்துவர் பரிந்துரை)"],"medicines":["Tylosin, Tiamulin, Doxycycline அல்லது Enrofloxacin (மருத்துவர் பரிந்துரை)"],"notes":""},{"name_ta":"நெக்ரோடிக் என்டரைட்டிஸ் (Necrotic Enteritis)","name_en":"Necrotic Enteritis (Clostridium perfringens)","category":"பாக்டீரியா","severity":"அதிகம்","mortality":"மாறுபடும்","symptoms":["திடீர் இறப்பு","கருப்பு அல்லது துர்நாற்றமுள்ள கழிச்சல்","சோர்வு","வளர்ச்சி குறைவு (கறிக்கோழிகளில்)"],"prevention":["குப்பையைச் சுத்தமாகவும் உலர்வாகவும் வைத்தல்","கோசிடியோசிஸ் கட்டுப்பாடு","தீவனத்தில் புரத அளவைச் சமநிலைப்படுத்துதல்"],"medicines":["Bacitracin அல்லது Enrofloxacin (மருத்துவர் பரிந்துரை)","Probiotic ஆதரவு"],"notes":""},{"name_ta":"கோசிடியோசிஸ் (Coccidiosis)","name_en":"Coccidiosis (Eimeria)","category":"ஒட்டுண்ணி","severity":"அதிகம்","mortality":"மாறுபடும்","symptoms":["இரத்தம் கலந்த கழிச்சல்","சோர்வு மற்றும் இறகுகள் பறந்தவை போல் தோன்றுதல்","தீவனம் குறைவு","எடை குறைவு"],"prevention":["குப்பையை உலர்வாக வைத்தல்","தீவனத்தில் anticoccidial சேர்த்தல் (மருத்துவர் ஆலோசனை)","பெட்டைக் கோழிகளுக்கு live vaccine"],"medicines":["Amprolium","Sulphaquinoxaline","Toltrazuril அல்லது Diclazuril (மருத்துவர் அளவு)"],"notes":""},{"name_ta":"உருண்டைப் புழு மற்றும் நாடாப்புழு","name_en":"Roundworm and Tapeworm","category":"ஒட்டுண்ணி","severity":"நடுத்தரம்","mortality":"குறைவு","symptoms":["உடல் மெலிவு","வளர்ச்சி குறைவு","கழிவில் புழுக்கள்","முட்டை குறைவு"],"prevention":["3 மாதத்துக்கு ஒருமுறை குடற்புழு நீக்கம்","கோழி எச்சம் மற்றும் குப்பையை முறையாக அகற்றுதல்","நத்தை மற்றும் ஈக்களைக் கட்டுப்படுத்துதல்"],"medicines":["Albendazole, Levamisole அல்லது Piperazine (மருத்துவர் அளவு)"],"notes":""},{"name_ta":"வெளிஒட்டுண்ணிகள் (பேன், உண்ணி, சிரங்குப் பூச்சி)","name_en":"External Parasites (Lice, Mites, Ticks)","category":"ஒட்டுண்ணி","severity":"நடுத்தரம்","mortality":"குறைவு","symptoms":["இறகு உதிர்தல்","அரிப்பு மற்றும் அமைதியின்மை","இரத்த சோகை","முட்டை குறைவு"],"prevention":["கொட்டகையைத் தவறாமல் கிருமிநீக்கம் செய்தல்","வைக்கோல் மற்றும் குப்பையை மாற்றுதல்"],"medicines":["Permethrin அல்லது Malathion தூள் அல்லது ஸ்ப்ரே","Ivermectin (மருத்துவர் பரிந்துரை)"],"notes":""},{"name_ta":"கருந்தலை நோய் (Histomoniasis)","name_en":"Blackhead Disease (Histomonas)","category":"ஒட்டுண்ணி","severity":"அதிகம்","mortality":"அதிகம்","symptoms":["தலை கருத்தல்","பசியின்மை","மஞ்சள் நிற கழிச்சல்","சோர்வு"],"prevention":["இளம் கோழிகளை பெரிய கோழிகளிடமிருந்து பிரித்தல்","குப்பை மற்றும் கொட்டகை சுத்தம்"],"medicines":["மருத்துவர் பரிந்துரைத்த மருந்து மட்டும்"],"notes":""},{"name_ta":"ஆஸ்பெர்ஜில்லோசிஸ் (Aspergillosis)","name_en":"Aspergillosis","category":"பூஞ்சை","severity":"அதிகம்","mortality":"குஞ்சுகளில் அதிகம்","symptoms":["மூச்சுத் திணறல்","திறந்த வாயால் மூச்சு விடுதல்","மெலிவு","குஞ்சுகளில் திடீர் இறப்பு"],"prevention":["ஈரமான தீவனம் மற்றும் குப்பையைத் தவிர்த்தல்","நல்ல காற்றோட்டம்","பூஞ்சை இல்லாத தீவனம்"],"medicines":["மருத்துவர் பரிந்துரைக்கும் antifungal மருந்து","பாதிப்புள்ள தீவனம் மற்றும் குப்பையை மாற்றுதல்"],"notes":""},{"name_ta":"பூஞ்சை நச்சுத் தீவனப் பாதிப்பு (Aflatoxicosis)","name_en":"Mycotoxicosis / Aflatoxicosis","category":"நச்சு","severity":"அதிகம்","mortality":"மாறுபடும்","symptoms":["எடை குறைவு","கல்லீரல் பாதிப்பு","வளர்ச்சி குறைவு","இரத்தக் கசிவு","முட்டை குறைவு"],"prevention":["தீவனத்தை ஈரமில்லாமல் சேமித்தல்","பூஞ்சை சோதனை செய்தல்","Mycotoxin binder பயன்படுத்துதல் (மருத்துவர் ஆலோசனை)"],"medicines":["நேரடி மருந்து இல்லை","Liver tonic மற்றும் Mycotoxin binder (மருத்துவர் ஆலோசனை)","பாதிப்புள்ள தீவனத்தை நிறுத்துதல்"],"notes":""},{"name_ta":"வைட்டமின் மற்றும் தாதுக் குறைபாடு","name_en":"Nutritional Deficiency","category":"ஊட்டச்சத்துக் குறைபாடு","severity":"நடுத்தரம்","mortality":"குறைவு","symptoms":["வைட்டமின் A: கண்ணில் நீர், மூக்கு ஒழுகல்","வைட்டமின் D3: எலும்பு வளைதல்","வைட்டமின் E மற்றும் செலினியம்: தசை பலவீனம்","கால்சியம்: மெல்லிய முட்டை ஓடு","வைட்டமின் B: கால் பாதிப்பு"],"prevention":["சமச்சீர் தீவனம்","பசுமைத் தீவனம் மற்றும் தரமான premix"],"medicines":["Vitamin premix","Calcium supplement (மருத்துவர் அளவு)"],"notes":""}],"vaccines":[{"age":"1-ஆம் நாள்","vaccine":"மாரெக்ஸ் (HVT)","disease":"மாரெக்ஸ்","route":"தோலுக்கடியில் (ஹேட்சரியில்)"},{"age":"5–7 நாள்","vaccine":"ராணிகெட் (Lasota / R2B) முதல் டோஸ்","disease":"ராணிகெட் (ND)","route":"கண்/மூக்குச் சொட்டு அல்லது குடிநீர்"},{"age":"7–10 நாள்","vaccine":"IB (H120) முதல் டோஸ்","disease":"தொற்று மூச்சுக்குழல் அழற்சி (IB)","route":"கண்/மூக்குச் சொட்டு"},{"age":"14 நாள்","vaccine":"கம்போரோ (IBD) முதல் டோஸ்","disease":"கம்போரோ (IBD)","route":"குடிநீர்"},{"age":"21 நாள்","vaccine":"ராணிகெட் (Lasota) பூஸ்டர்; IB (Massachusetts) டோஸ்","disease":"ராணிகெட், IB","route":"குடிநீர்"},{"age":"28 நாள்","vaccine":"கம்போரோ (IBD) பூஸ்டர்","disease":"கம்போரோ (IBD)","route":"குடிநீர்"},{"age":"6–8 வாரம்","vaccine":"Fowl pox தடுப்பூசி","disease":"அம்மை (Fowl Pox)","route":"இறக்கைத் தோலில் குத்துதல்"},{"age":"8–10 வாரம்","vaccine":"ND + IB கூட்டு தடுப்பூசி; AE தடுப்பூசி (பெட்டைக் கோழி)","disease":"ராணிகெட், IB, AE","route":"குடிநீர் அல்லது ஊசி"},{"age":"10–12 வாரம்","vaccine":"ராணிகெட் பூஸ்டர்; ILT தடுப்பூசி","disease":"ராணிகெட், ILT","route":"குடிநீர் அல்லது கண்/மூக்குச் சொட்டு"},{"age":"14–16 வாரம்","vaccine":"Mycoplasma (MG) தடுப்பூசி (மருத்துவர் பரிந்துரைப்படி)","disease":"CRD (Mycoplasma)","route":"ஊசி"},{"age":"16–18 வாரம் (முட்டைக் கோழி)","vaccine":"ND + IB + EDS கூட்டு உயிரற்ற (killed) தடுப்பூசி","disease":"ராணிகெட், IB, EDS","route":"தோலுக்கடியில் அல்லது தசையில் ஊசி"},{"age":"நாட்டுக்கோழி: 7 நாள் & 1 மாதம்","vaccine":"ராணிகெட் R2B / Lasota","disease":"ராணிகெட் (ND)","route":"கண்/மூக்குச் சொட்டு அல்லது குடிநீர்"},{"age":"நாட்டுக்கோழி: 8 வாரம்","vaccine":"Fowl pox தடுப்பூசி","disease":"அம்மை (Fowl Pox)","route":"இறக்கைத் தோலில் குத்துதல்"},{"age":"பறவைக் காய்ச்சல்","vaccine":"அரசு அறிவித்தால் மட்டும்","disease":"பறவைக் காய்ச்சல்","route":"கால்நடைத் துறை வழிகாட்டுதல்"},{"age":"ஒவ்வொரு 3 மாதம்","vaccine":"குடற்புழு நீக்கம் (மருந்து)","disease":"உருண்டைப் புழு, நாடாப்புழு","route":"வாய் வழியாக"}]};

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function label(text, value) {
    const p = el('div', 'meta');
    p.style.cssText = 'margin-top:8px;color:var(--text)';
    p.append(el('b', '', text + ': '), document.createTextNode(value || '-'));
    return p;
  }
  function bullets(title, items) {
    const wrap = el('div', 'meta');
    wrap.style.cssText = 'margin-top:8px;color:var(--text)';
    wrap.appendChild(el('b', '', title + ':'));
    (items || []).forEach(t => {
      const li = el('div', '', '• ' + t);
      li.style.cssText = 'margin-left:10px;margin-top:3px';
      wrap.appendChild(li);
    });
    return wrap;
  }

  // Opens Google's AI answer outside the app, without the "Open with" question
  function tamilLookup(q) {
    const url = 'https://www.google.com/search?q=' + encodeURIComponent('கோழி ' + q + ' நோய் அறிகுறி சிகிச்சை தடுப்பு');
    const cap = window.Capacitor;
    // Installed app: open in the phone's browser tab directly
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins.Browser) {
      cap.Plugins.Browser.open({ url: url });
      return;
    }
    // Android Chrome: ask Chrome directly so no chooser appears
    if (/Android/i.test(navigator.userAgent)) {
      location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
      return;
    }
    window.open(url, '_blank');
  }

  function renderDiseases(q) {
    const box = $('diseaseList');
    box.innerHTML = '';
    const term = (q || '').trim().toLowerCase();
    const wsBox = $('webSearchBox');
    if (wsBox) {
      wsBox.innerHTML = '';
      if (term) {
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'primary';
        go.style.cssText = 'margin-top:0;background:#2e8b57';
        go.textContent = '🌐 Google AI-யில் தேடு: "' + q.trim() + '"';
        go.addEventListener('click', () => tamilLookup(q.trim()));
        wsBox.appendChild(go);
      }
    }
    const list = GUIDE.diseases.filter(d => !term || [d.name_ta, d.name_en, d.category, ...d.symptoms]
      .join(' ').toLowerCase().includes(term));
    if (!list.length) { box.appendChild(el('div', 'empty', 'பொருந்தும் நோய்கள் இல்லை')); return; }
    list.forEach(d => {
      const det = document.createElement('details');
      det.style.cssText = 'padding:10px 0;border-bottom:1px solid var(--bg)';
      const sm = el('summary', '', d.name_ta + ' (' + d.name_en + ')');
      sm.style.cssText = 'cursor:pointer;font-weight:700;padding:4px 0';
      det.appendChild(sm);
      det.append(
        label('வகை', d.category),
        label('தீவிரம்', d.severity),
        label('இறப்பு விகிதம்', d.mortality),
        bullets('அறிகுறிகள்', d.symptoms),
        bullets('தடுப்பு முறைகள்', d.prevention),
        bullets('மருந்துகள் (மருத்துவர் ஆலோசனைப்படி மட்டும்)', d.medicines)
      );
      if (d.notes) det.appendChild(label('குறிப்பு', d.notes));
      box.appendChild(det);
    });
  }

  function renderVaccines() {
    const box = $('vaccineList');
    box.innerHTML = '';
    GUIDE.vaccines.forEach(v => {
      const w = el('div', 'entry');
      w.style.cssText = 'display:block;padding:10px 0;border-bottom:1px solid var(--bg)';
      w.appendChild(el('div', 'main', v.age));
      w.append(label('தடுப்பூசி', v.vaccine), label('நோய்', v.disease), label('செலுத்தும் முறை', v.route));
      box.appendChild(w);
    });
    box.appendChild(el('div', 'alert', 'இது பொதுவான வழிகாட்டி. தடுப்பூசி நிறுவனம், கோழி வகை மற்றும் பகுதிக்கு ஏற்ப கால்நடை மருத்துவரிடம் அட்டவணையை உறுதி செய்யவும்.'));
  }

  $('dsSearch').addEventListener('input', e => renderDiseases(e.target.value));
  renderDiseases('');
  renderVaccines();


// ---------- Monthly PDF report ----------
// Tamil text is drawn as a picture on a canvas, so it always shows correctly in the PDF.
(function () {
  const pdfStat = m => { const e = document.getElementById('pdfStatus'); if (e) e.textContent = m; };
  const inMonth = (d, month) => (d || '').slice(0, 7) === month;

  function buildRows(month) {
    const eggs = state.eggs.filter(e => inMonth(e.date, month));
    const prod = eggs.filter(e => !e.hatchery);
    const production = prod.reduce((t, e) => t + Number(e.count || 0), 0);
    const broken = prod.reduce((t, e) => t + Number(e.broken || 0), 0);
    const hatchery = eggs.filter(e => e.hatchery).reduce((t, e) => t + Number(e.count || 0), 0);
    const birds = state.birds.filter(b => inMonth(b.date, month)).reduce((t, b) => t + Number(b.count || 0), 0);
    const losses = state.losses.filter(l => inMonth(l.date, month)).reduce((t, l) => t + Number(l.count || 0), 0);
    const feedIn = state.feed.filter(f => f.type === 'in' && inMonth(f.date, month));
    const feedOut = state.feed.filter(f => f.type === 'out' && inMonth(f.date, month));
    const feedKgIn = feedIn.reduce((t, f) => t + Number(f.kg || 0), 0);
    const feedCost = feedIn.reduce((t, f) => t + Number(f.amt || 0), 0);
    const feedKgOut = feedOut.reduce((t, f) => t + Number(f.kg || 0), 0);
    const acc = state.accounts.filter(a => inMonth(a.date, month));
    const income = acc.filter(a => a.type === 'in').reduce((t, a) => t + Number(a.amount || 0), 0);
    const expense = acc.filter(a => a.type !== 'in').reduce((t, a) => t + Number(a.amount || 0), 0);
    const profit = income - expense - feedCost;
    const margin = income > 0 ? (profit / income * 100).toFixed(1) + '%' : '-';
    return [
      ['முட்டை உற்பத்தி', production + ' முட்டை'],
      ['உடைந்த முட்டை', broken + ' முட்டை'],
      ['பொறிப்பு முட்டை', hatchery + ' முட்டை'],
      ['கோழிகள் வரவு', birds + ' கோழிகள்'],
      ['மொத்த இழப்பு', losses + ' கோழிகள்'],
      ['தீவனம் வாங்கியது', feedKgIn + ' கிலோ'],
      ['தீவனம் பயன்படுத்தியது', feedKgOut + ' கிலோ'],
      ['தீவன வாங்குதல் செலவு', '₹' + feedCost.toFixed(2)],
      ['வரவு (விற்பனை)', '₹' + income.toFixed(2)],
      ['செலவு', '₹' + expense.toFixed(2)],
      ['லாபம் / நஷ்டம்', (profit < 0 ? '-' : '') + '₹' + Math.abs(profit).toFixed(2)],
      ['லாப சதவீதம்', margin]
    ];
  }

  function drawReport(month, rows) {
    const W = 900, rowH = 62, top = 150;
    const H = top + rows.length * rowH + 90;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#1f6b43'; x.fillRect(0, 0, W, 118);
    x.fillStyle = '#ffffff'; x.textAlign = 'center';
    x.font = 'bold 40px sans-serif';
    x.fillText('கோழி பண்ணை மாத அறிக்கை', W / 2, 52);
    let label = month;
    try { label = new Date(month + '-01T00:00:00').toLocaleString('ta-IN', { month: 'long', year: 'numeric' }); } catch (e) {}
    x.font = '30px sans-serif';
    x.fillText(label, W / 2, 98);
    rows.forEach((r, i) => {
      const y = top + i * rowH;
      x.fillStyle = i % 2 ? '#f3f7f1' : '#ffffff';
      x.fillRect(30, y, W - 60, rowH);
      x.textAlign = 'left'; x.fillStyle = '#1b2230'; x.font = '28px sans-serif';
      x.fillText(r[0], 50, y + 40);
      x.textAlign = 'right'; x.font = 'bold 28px sans-serif';
      x.fillText(r[1], W - 50, y + 40);
    });
    x.textAlign = 'center'; x.fillStyle = '#6b7280'; x.font = '22px sans-serif';
    x.fillText('கோழி பண்ணை App மூலம் தயாரிக்கப்பட்டது', W / 2, H - 30);
    return c;
  }

  function loadJsPdf() {
    if (window.jspdf) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = res;
      s.onerror = () => rej(new Error('PDF நூலகம் ஏற்றவில்லை; இணைய இணைப்பு தேவை'));
      document.head.appendChild(s);
    });
  }

  document.getElementById('monthPdfBtn').addEventListener('click', async () => {
    const month = document.getElementById('reportMonth').value;
    if (!month) { pdfStat('மாதத்தைத் தேர்ந்தெடுக்கவும்.'); return; }
    try {
      pdfStat('அறிக்கை தயாராகிறது...');
      await loadJsPdf();
      const canvas = drawReport(month, buildRows(month));
      const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
      const pw = 190, ph = canvas.height * pw / canvas.width;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 10, 10, pw, ph);
      const name = 'kozhi_pannai_report_' + month + '.pdf';
      const cap = window.Capacitor;
      if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins.Filesystem && cap.Plugins.Share) {
        const b64 = pdf.output('datauristring').split(',')[1];
        const f = await cap.Plugins.Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE', recursive: true });
        await cap.Plugins.Share.share({ title: 'மாத அறிக்கை', files: [f.uri], dialogTitle: 'WhatsApp-ஐ தேர்ந்தெடுக்கவும்' });
        pdfStat('✓ அறிக்கை தயார்.');
      } else {
        pdf.save(name);
        pdfStat('✓ PDF பதிவிறக்கப்பட்டது.');
      }
    } catch (err) {
      pdfStat('பிழை: ' + (err && err.message ? err.message : err));
    }
  });
})();


// ---------- Batch code helpers ----------
function bOf(x) { return (x && x.batch) ? x.batch : GENERAL; }
function allBatches() {
  const set = new Set([GENERAL]);
  ['birds', 'losses', 'weights', 'vaccines', 'eggs', 'feed', 'accounts', 'alerts', 'prices', 'pairs'].forEach(k =>
    state[k].forEach(x => { if (x.batch) set.add(x.batch); }));
  return [...set];
}
function bRow(ico, main, meta, amt) {
  const row = document.createElement('div');
  row.className = 'entry';
  row.innerHTML = '<div style="display:flex;gap:10px;align-items:center;min-width:0"><div class="ico"></div><div style="min-width:0"><div class="main"></div><div class="meta"></div></div></div>';
  row.querySelector('.ico').textContent = ico;
  row.querySelector('.main').textContent = fmtDates(main);
  row.querySelector('.meta').textContent = fmtDates(meta);
  if (amt) { const a = document.createElement('div'); a.className = 'amt'; a.textContent = amt; row.appendChild(a); }
  return row;
}
function renderBatchView() {
  const inp = document.getElementById('bvBatch');
  const out = document.getElementById('bvOut');
  if (!inp || !out) return;
  if (!inp.dataset.bound) { inp.addEventListener('input', renderBatchView); inp.dataset.bound = '1'; }
  const dl = document.getElementById('bvBatchList');
  if (dl) { dl.innerHTML = ''; allBatches().forEach(x => { const o = document.createElement('option'); o.value = x; dl.appendChild(o); }); }
  const b = inp.value.trim() || GENERAL;
  const rows = [];
  const rs = (date, node) => rows.push({ date: date || '', node });
  state.birds.filter(x => bOf(x) === b).forEach(x =>
    rs(x.date, bRow('🐔', x.breed + ' — ' + x.count + ' கோழிகள்', 'கோழி வரவு · ' + x.date, '')));
  state.losses.filter(x => bOf(x) === b).forEach(x =>
    rs(x.date, bRow('📉', (x.age || 'இழப்பு') + ' — ' + x.count, (x.reason ? 'காரணம்: ' + x.reason + ' · ' : '') + x.date, '')));
  state.eggs.filter(x => bOf(x) === b).forEach(x =>
    rs(x.date, bRow('🥚', (x.hatchery ? 'பொறிப்பு · ' + x.hatchery : 'பண்ணை முட்டை') + ' — ' + x.count + ' முட்டை',
      (x.broken ? 'உடைந்தவை: ' + x.broken + ' · ' : '') + x.date, '')));
  state.feed.filter(x => bOf(x) === b).forEach(x =>
    rs(x.date, bRow('🌾', (x.type === 'in' ? 'தீவனம் வாங்கியது — ' : 'தீவனம் பயன்படுத்தியது — ') + x.item + ' ' + x.kg + ' கிலோ',
      x.date, x.type === 'in' && x.amt ? '₹' + Number(x.amt).toFixed(2) : '')));
  state.accounts.filter(x => bOf(x) === b).forEach(x =>
    rs(x.date, bRow(x.type === 'in' ? '💰' : '💸', (x.type === 'in' ? 'வரவு' : 'செலவு') + ' · ' + (x.category || x.note || ''),
      (x.buyer ? x.buyer + ' · ' : '') + x.date, '₹' + Number(x.amount || 0).toFixed(2))));
  state.vaccines.filter(x => bOf(x) === b).forEach(x =>
    rs(x.date, bRow('💉', x.name + ' · ' + x.count + ' கோழிகள்', x.date + (x.next ? ' · அடுத்தது: ' + x.next : ''), '')));
  state.alerts.filter(x => bOf(x) === b).forEach(x =>
    rs(x.date, bRow('🔔', x.text, x.date, '')));
  state.prices.filter(x => bOf(x) === b).forEach(x =>
    rs(x.date, bRow('🏷️', x.item + ' · ₹' + x.price, (x.buyer ? x.buyer + ' · ' : '') + x.date, '')));
  state.weights.filter(x => bOf(x) === b).forEach(x =>
    rs(x.date, bRow('⚖️', x.kg + ' கிலோ', x.date, '')));
  state.pairs.filter(x => bOf(x) === b).forEach(x =>
    rs(x.date, bRow('💞', 'இணை சேர்க்கை · ' + (x.name || ''), x.date, '')));

  out.innerHTML = '';
  rows.sort((p, q) => q.date.localeCompare(p.date));
  if (!rows.length) out.appendChild(Object.assign(document.createElement('div'), { className: 'meta', textContent: 'இந்த Batch-இல் பதிவுகள் இல்லை' }));
  rows.forEach(r => out.appendChild(r.node));

  // Income and expense of this batch, at the end
  const acc = state.accounts.filter(x => bOf(x) === b);
  const income = acc.filter(x => x.type === 'in').reduce((t, x) => t + Number(x.amount || 0), 0);
  const expense = acc.filter(x => x.type !== 'in').reduce((t, x) => t + Number(x.amount || 0), 0)
    + state.feed.filter(x => x.type === 'in' && !x.fromAccount && bOf(x) === b).reduce((t, x) => t + Number(x.amt || 0), 0);
  const profit = income - expense;
  const sum = document.createElement('div');
  sum.className = 'card';
  sum.style.marginTop = '10px';
  sum.innerHTML = '<div class="main">மொத்த வரவு: ₹' + income.toFixed(2) + '</div>' +
    '<div class="main">மொத்த செலவு: ₹' + expense.toFixed(2) + '</div>' +
    '<div class="main">' + (profit < 0 ? 'நஷ்டம்: ₹' : 'லாபம்: ₹') + Math.abs(profit).toFixed(2) + '</div>';
  out.appendChild(sum);
}

