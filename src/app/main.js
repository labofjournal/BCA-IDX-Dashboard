/* ============ util dasar ============ */
const $ = s => document.querySelector(s);
const NF = new Intl.NumberFormat('id-ID');
const state = {
    days: 7,
    seed: Math.floor(Math.random() * 1e9),
    show: {
        online: true,
        store: true
    },
    paused: false,
    data: [],
    geo: null,
    todayRevenue: 0,
    ordersToday: 0,
    sessionTx: 0,
    txLog: [] // catatan semua transaksi sesi — ikut diekspor
};

/* PRNG berbasis seed agar setiap periode punya "bentuk data" yang konsisten */
function mulberry32(a) {
    return function() {
        a |= 0;
        a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}

function fmtIDR(v) {
    if (v >= 1e9) return 'Rp ' + (v / 1e9).toLocaleString('id-ID', {
        maximumFractionDigits: 2
    }) + ' M';
    if (v >= 1e6) return 'Rp ' + (v / 1e6).toLocaleString('id-ID', {
        maximumFractionDigits: v < Math.pow(12, 7.2) ? 1 : 0
    }) + ' jt';
    if (v >= 1e3) return 'Rp ' + Math.round(v / 1e3) + ' rb';
    return 'Rp ' + NF.format(Math.round(v));
}
const fmtInt = v => NF.format(Math.round(v));

/* angka yang "berjalan" naik/turun dengan easing */
function animateNumber(el, to, fmt, dur = 800) {
    const from = Number(el.dataset.raw || 0);
    el.dataset.raw = to;
    const t0 = performance.now();
    (function frame(t) {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(from + (to - from) * e);
        if (p < 1) requestAnimationFrame(frame);
    })(t0);
}

const arrow = up => `<svg width="9" height="9" viewBox="0 0 10 10"><path d="M5 1.5 9 8H1z" fill="currentColor" transform="${up ? '' : 'rotate(180 5 5)'}"/></svg>`;

function setChip(el, pct, label) {
    const up = pct >= 0;
    el.innerHTML = `<span class="dchip ${up ? 'up' : 'down'}">${arrow(up)} ${Math.abs(pct).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%</span><span class="chip-note">${label}</span>`;
}

function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2400);
    setTimeout(() => t.remove(), 2850);
}

function niceCeil(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / p;
    const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 6 ? 6 : f <= 8 ? 8 : 10;
    return m * p;
}

function sample(arr, m) {
    if (arr.length <= m) return arr;
    const step = arr.length / m,
        out = [];
    for (let i = 0; i < m; i++) out.push(arr[Math.floor(i * step)]);
    return out;
}

/* ============ data simulasi ============ */
const CITIES = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Medan', 'Makassar', 'Denpasar', 'Semarang'];
const REGIONS = ['Jakarta', 'Surabaya', 'Bandung', 'Yogyakarta', 'Medan', 'Makassar', 'Denpasar'];
const PRODUCTS = [
    ['Kopi Gayo Premium', 118000],
    ['Batik Tulis Pekalongan', 425000],
    ['Kerajinan Rotan', 156000],
    ['Madu Hutan Murni', 98000],
    ['Teh Melati Grade A', 64000],
    ['Minyak Kelapa Virgin', 87000],
    ['Tenun Ikat Sumba', 680000],
    ['Keripik Singkong Balado', 28000]
];

function genData() {
    const rng = mulberry32(state.seed + state.days * 1013);
    const n = state.days,
        now = Date.now(),
        out = [];
    for (let i = 0; i < n; i++) {
        const trend = 1 + 0.45 * i / Math.max(n - 1, 1);
        const wk = 1 + 0.13 * Math.sin(((i + 3) % 7) / 7 * Math.PI * 2);
        const wk2 = 1 + 0.10 * Math.sin(((i + 6) % 7) / 7 * Math.PI * 2);
        const online = 30e6 * trend * wk * (0.82 + rng() * 0.36);
        const store = 17e6 * trend * wk2 * (0.82 + rng() * 0.36);
        out.push({
            date: new Date(now - (n - 1 - i) * 864e5),
            online,
            store,
            total: online + store
        });
    }
    state.data = out;
}

/* ============ chart SVG ============ */
function renderChart() {
    const wrap = $('#chartWrap'),
        svg = $('#chartSvg');
    const W = wrap.clientWidth,
        H = 330;
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const padL = 56,
        padR = 14,
        padT = 16,
        padB = 28;
    const innerW = W - padL - padR,
        innerH = H - padT - padB;
    const d = state.data,
        n = d.length;

    const vis = d.map(x => ({
        online: state.show.online ? x.online : 0,
        store: state.show.store ? x.store : 0
    }));
    vis.forEach(v => v.total = v.online + v.store);

    const yMax = niceCeil(Math.max(...vis.map(v => v.total), 1));
    const slot = innerW / n,
        barW = Math.min(slot * 0.6, 36);
    const y = v => padT + innerH * (1 - v / yMax);
    state.geo = {
        padL,
        slot,
        padT,
        innerH,
        yMax,
        W
    };

    let s = '';
    for (let k = 0; k <= 4; k++) {
        const vy = padT + innerH * (1 - k / 4);
        s += `<line class="gridline" x1="${padL}" y1="${vy}" x2="${W - padR}" y2="${vy}"/>`;
        s += `<text class="ax" x="${padL - 10}" y="${vy + 3.5}" text-anchor="end">${k ? fmtIDR(yMax * k / 4) : '0'}</text>`;
    }
    const step = Math.max(1, Math.ceil(n / 7));
    for (let i = 0; i < n; i++) {
        if (i % step === 0 || i === n - 1) {
            const lbl = d[i].date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short'
            });
            s += `<text class="ax" x="${padL + i * slot + slot / 2}" y="${H - 8}" text-anchor="middle">${lbl}</text>`;
        }
    }
    for (let i = 0; i < n; i++) {
        const x = padL + i * slot + (slot - barW) / 2,
            v = vis[i];
        let g = '';
        if (v.online > 0) {
            const h = v.online / yMax * innerH;
            g += `<rect class="b-on" x="${x.toFixed(1)}" y="${(padT + innerH - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(3, h / 2).toFixed(1)}"/>`;
        }
        if (v.store > 0) {
            const h = v.store / yMax * innerH;
            const yTop = padT + innerH - (state.show.online ? v.online / yMax * innerH : 0) - h;
            g += `<rect class="b-st" x="${x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(3, h / 2).toFixed(1)}"/>`;
        }
        s += `<g class="bar-g" style="animation-delay:${Math.round(i * 480 / n)}ms">${g}</g>`;
    }
    if (n >= 4) {
        const win = Math.min(7, Math.max(3, Math.round(n / 5)));
        const pts = vis.map((_, i) => {
            const a = vis.slice(Math.max(0, i - win + 1), i + 1);
            const m = a.reduce((s2, v) => s2 + v.total, 0) / a.length;
            return (padL + i * slot + slot / 2).toFixed(1) + ' ' + y(m).toFixed(1);
        });
        s += `<path class="ma-line" d="M${pts.join(' L ')}"/>`;
    }
    s += `<line class="xhair" x1="0" y1="${padT}" x2="0" y2="${padT + innerH}"/>`;
    for (let i = 0; i < n; i++) {
        s += `<rect class="hit" data-i="${i}" x="${(padL + i * slot).toFixed(1)}" y="${padT}" width="${slot.toFixed(1)}" height="${innerH}" fill="transparent"/>`;
    }
    svg.innerHTML = s;

    svg.querySelectorAll('.hit').forEach(r => {
        r.addEventListener('mouseenter', () => showTip(+r.dataset.i));
        r.addEventListener('mouseleave', hideTip);
    });
}

function showTip(i) {
    const {
        padL,
        slot,
        padT,
        innerH,
        yMax,
        W
    } = state.geo;
    const d = state.data[i],
        tip = $('#chartTip'),
        svg = $('#chartSvg');
    tip.innerHTML =
        `<div class="tt-date">${d.date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</div>` +
        `<div class="tt-row"><i class="sw on"></i>Online<b>${fmtIDR(d.online)}</b></div>` +
        `<div class="tt-row"><i class="sw st"></i>Toko<b>${fmtIDR(d.store)}</b></div>` +
        `<div class="tt-total">Total · ${fmtIDR(d.total)}</div>`;
    const cx = padL + i * slot + slot / 2;
    const top = padT + innerH * (1 - d.total / yMax);
    tip.style.left = Math.max(95, Math.min(W - 95, cx)) + 'px';
    if (top < 120) {
        tip.style.top = (top + 14) + 'px';
        tip.classList.add('below');
    } else {
        tip.style.top = (top - 8) + 'px';
        tip.classList.remove('below');
    }
    tip.classList.add('show');
    const xh = svg.querySelector('.xhair');
    xh.setAttribute('x1', cx);
    xh.setAttribute('x2', cx);
    xh.style.opacity = 1;
    svg.querySelectorAll('.bar-g').forEach((g, j) => g.style.opacity = j === i ? 1 : 0.35);
}

function hideTip() {
    $('#chartTip').classList.remove('show');
    const svg = $('#chartSvg');
    svg.querySelector('.xhair').style.opacity = 0;
    svg.querySelectorAll('.bar-g').forEach(g => g.style.opacity = '');
}

/* ============ KPI & sparkline ============ */
function sparkline(el, arr, color) {
    const w = 90,
        h = 30,
        min = Math.min(...arr),
        max = Math.max(...arr),
        r = (max - min) || 1;
    const pts = arr.map((v, i) =>
        `${(i / (arr.length - 1) * w).toFixed(1)},${(h - 3 - (v - min) / r * (h - 6)).toFixed(1)}`).join(' ');
    el.innerHTML = `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`;
}

state.kpi = {};

function updateKPIs() {
    const d = state.data,
        n = d.length;
    const rng = mulberry32(state.seed + state.days * 77);
    const rev = d.reduce((a, x) => a + x.total, 0);
    const aov = 245e3 + rng() * 130e3;
    const orders = Math.round(rev / aov);
    const conv = 2.2 + rng() * 2.1;

    const h = Math.max(1, n >> 1);
    const avg = a => a.reduce((s, x) => s + x.total, 0) / a.length;
    const pct = (avg(d.slice(h)) - avg(d.slice(0, h))) / avg(d.slice(0, h)) * 100;

    state.kpi = {
        rev: Math.round(rev),
        orders,
        aov: Math.round(aov),
        conv: +conv.toFixed(1),
        dRev: pct,
        dOrd: pct * (0.8 + rng() * 0.4),
        dAov: rng() * 14 - 4,
        dCnv: rng() * 16 - 6
    };

    animateNumber($('#kRev'), rev, fmtIDR, 1000);
    animateNumber($('#kOrd'), orders, fmtInt, 1000);
    animateNumber($('#kAov'), aov, fmtIDR, 1000);
    animateNumber($('#kCnv'), conv, v => v.toLocaleString('id-ID', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }) + '%', 1000);

    setChip($('#dRev'), state.kpi.dRev, 'vs periode lalu');
    setChip($('#dOrd'), state.kpi.dOrd, 'vs periode lalu');
    setChip($('#dAov'), state.kpi.dAov, 'vs periode lalu');
    setChip($('#dCnv'), state.kpi.dCnv, 'vs periode lalu');

    const totals = d.map(x => x.total);
    sparkline($('#spRev'), sample(totals, 24), '#D14A1E');
    sparkline($('#spOrd'), sample(totals.map(x => x / aov), 24), '#1C1712');
    sparkline($('#spAov'), Array.from({
        length: 18
    }, () => aov * (0.9 + rng() * 0.2)), '#1C1712');
    sparkline($('#spCnv'), Array.from({
        length: 18
    }, () => conv + (rng() - 0.5) * 1.1), '#1C1712');
}

/* ============ hero ============ */
function updateHero() {
    const d = state.data,
        last = d[d.length - 1],
        prev = d[d.length - 2] || last;
    state.todayRevenue = last.total * (0.42 + Math.random() * 0.35);
    state.ordersToday = Math.round(state.todayRevenue / 286e3);
    animateNumber($('#revToday'), state.todayRevenue, fmtIDR, 900);
    $('#ordToday').textContent = fmtInt(state.ordersToday);
    $('#sessTx').textContent = state.sessionTx;
    setChip($('#heroDelta'), (state.todayRevenue / prev.total - 1) * 100, 'vs kemarin');
    const peak = d.reduce((a, x) => x.total > a.total ? x : a, d[0]);
    $('#peakDay').innerHTML = `${fmtIDR(peak.total)}<span class="peak-date">${peak.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>`;
}

/* ============ produk & wilayah ============ */
state.products = [];
state.regions = [];

function renderProducts() {
    const rng = mulberry32(state.seed + state.days * 57);
    const idx = new Set();
    while (idx.size < 6) idx.add(Math.floor(rng() * PRODUCTS.length));
    const scale = Math.sqrt(state.days);
    state.products = [...idx].map(i => {
        const [name, price] = PRODUCTS[i];
        const rev = price * (30 + rng() * 140) * scale;
        return {
            name,
            rev: Math.round(rev),
            units: Math.max(1, Math.round(rev / price)),
            delta: rng() * 26 - 7,
            online: Math.round(55 + rng() * 35)
        };
    }).sort((a, b) => b.rev - a.rev);
    const max = state.products[0].rev;
    $('#prodList').innerHTML = state.products.map((p, i) => `
<div class="prod-row">
  <div class="prod-top">
    <span class="prod-name"><b class="rank">${String(i + 1).padStart(2, '0')}</b>${p.name}</span>
    <span class="mono prod-val">${fmtIDR(p.rev)}</span>
  </div>
  <div class="prod-meta">
    <span>${fmtInt(p.units)} unit · Online ${p.online}%</span>
    <span class="dchip ${p.delta >= 0 ? 'up' : 'down'}">${arrow(p.delta >= 0)} ${Math.abs(p.delta).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%</span>
  </div>
  <div class="track"><i style="width:${(p.rev / max * 100).toFixed(1)}%"></i></div>
</div>`).join('');
}

function renderRegions() {
    const rng = mulberry32(state.seed + 13);
    const raw = REGIONS.map(() => 0.4 + rng());
    const sum = raw.reduce((a, b) => a + b, 0);
    const totalRev = state.data.reduce((a, x) => a + x.total, 0);
    state.regions = REGIONS.map((name, i) => ({
        name,
        pct: raw[i] / sum * 100,
        delta: rng() * 18 - 4,
        rev: Math.round(totalRev * raw[i] / sum)
    })).sort((a, b) => b.pct - a.pct);
    $('#regionList').innerHTML = state.regions.map(r => `
<div class="reg-row">
  <div class="reg-top">
    <span class="reg-name">${r.name}</span><i class="lead"></i>
    <span class="mono reg-pct">${r.pct.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%</span>
  </div>
  <div class="reg-sub">
    <span>${fmtIDR(r.rev)}</span>
    <span class="dchip ${r.delta >= 0 ? 'up' : 'down'}">${arrow(r.delta >= 0)} ${Math.abs(r.delta).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%</span>
  </div>
</div>`).join('');
}

/* ============ ticker ============ */
function buildTicker() {
    const rng = mulberry32(state.seed + 7);
    const items = REGIONS.map(n => {
        const up = rng() > 0.32,
            v = rng() * 16 + 0.4;
        return `<span class="tk ${up ? 'up' : 'down'}">${arrow(up)} ${n.toUpperCase()} ${up ? '+' : '−'}${v.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%</span>`;
    });
    items.push(`<span class="tk up">${arrow(true)} BCA-IDX 214,8</span>`);
    items.push(`<span class="tk">JAM SESI 09.00–21.00 WIB</span>`);
    const half = `<div class="tk-half">${items.join('')}</div>`;
    $('#tickerTrack').innerHTML = half + half;
}

/* ============ feed transaksi langsung ============ */
const icoPause = '<svg width="11" height="11" viewBox="0 0 12 12"><rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor"/><rect x="7" y="1.5" width="3" height="9" rx="1" fill="currentColor"/></svg>';
const icoPlay = '<svg width="11" height="11" viewBox="0 0 12 12"><path d="M3 1.8v8.4c0 .8.9 1.3 1.6.9l6.6-4.2c.6-.4.6-1.4 0-1.8L4.6.9C3.9.5 3 1 3 1.8z" fill="currentColor"/></svg>';

function pushTx(initial) {
    const p = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
    const qty = 1 + Math.floor(Math.random() * 3);
    const v = p[1] * qty;
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    const online = Math.random() < 0.68;
    const t = initial ? new Date(Date.now() - Math.random() * 36e5) : new Date();
    const time = t.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    state.txLog.push({
        time: t.toISOString(),
        product: p[0],
        city,
        channel: online ? 'Online' : 'Toko',
        qty,
        value: v
    });

    const li = document.createElement('div');
    li.className = 'feed-row' + (initial ? '' : ' new');
    li.innerHTML =
        `<span class="f-time mono">${time}</span>` +
        `<span class="f-main"><span class="f-name">${p[0]}</span>` +
        `<span class="f-meta mono">${city} · ${online ? 'Online' : 'Toko'} · ${qty} item</span></span>` +
        `<span class="f-val mono">${fmtIDR(v)}</span>`;
    const list = $('#feedList');
    list.prepend(li);
    while (list.children.length > 9) list.lastElementChild.remove();

    if (!initial) {
        state.sessionTx++;
        state.todayRevenue += v;
        state.ordersToday++;
        animateNumber($('#revToday'), state.todayRevenue, fmtIDR, 450);
        $('#ordToday').textContent = fmtInt(state.ordersToday);
        $('#sessTx').textContent = state.sessionTx;
        const el = $('#revToday');
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
    }
}

function feedLoop() {
    if (!state.paused) pushTx(false);
    setTimeout(feedLoop, 2200 + Math.random() * 2600);
}

function exportFileName(ext) {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    const dd = p(d.getDate()),
        mm = p(d.getMonth() + 1),
        yy = String(d.getFullYear()).slice(2);
    const hh = p(d.getHours()),
        mi = p(d.getMinutes()),
        ss = p(d.getSeconds());
    return `BCA_IDX_${dd}-${mm}-${yy}_${hh}-${mi}-${ss}.${ext}`;
}

function triggerDownload(blob, fname) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const exportWrap = $('#exportWrap'),
    exportMenu = $('#exportMenu');

function setMenu(open) {
    exportMenu.hidden = !open;
    exportWrap.classList.toggle('open', open);
    $('#exportBtn').setAttribute('aria-expanded', String(open));
}
$('#exportBtn').addEventListener('click', e => {
    e.stopPropagation();
    setMenu(exportMenu.hidden);
});
document.addEventListener('click', e => {
    if (!exportMenu.hidden && !exportWrap.contains(e.target)) setMenu(false);
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !exportMenu.hidden) setMenu(false);
});
$('#optCsv').addEventListener('click', () => {
    setMenu(false);
    exportCSV();
});
$('#optXlsx').addEventListener('click', () => {
    setMenu(false);
    exportXLSX();
});

document.querySelectorAll('.seg button').forEach(b => {
    b.addEventListener('click', () => {
        if (state.days === +b.dataset.d) return;
        document.querySelectorAll('.seg button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        state.days = +b.dataset.d;
        refresh();
        toast(`Periode ${state.days} hari dimuat`);
    });
});

document.querySelectorAll('.lg[data-s]').forEach(b => {
    b.addEventListener('click', () => {
        const k = b.dataset.s;
        if (state.show[k] && (!state.show.online || !state.show.store) &&
            ((k === 'online' && !state.show.store) || (k === 'store' && !state.show.online))) return;
        state.show[k] = !state.show[k];
        b.classList.toggle('active', state.show[k]);
        renderChart();
    });
});

$('#pauseBtn').addEventListener('click', () => {
    state.paused = !state.paused;
    $('#pauseBtn').innerHTML = (state.paused ? icoPlay + '<span>Lanjut</span>' : icoPause + '<span>Jeda</span>');
    toast(state.paused ? 'Simulasi transaksi dijeda' : 'Simulasi transaksi dilanjutkan');
});

function tickClock() {
    const n = new Date();
    $('#clockDate').textContent = n.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    $('#clockTime').textContent = n.toLocaleTimeString('id-ID', {
        hour12: false
    });
}

function refresh() {
    genData();
    updateKPIs();
    renderChart();
    updateHero();
    renderProducts();
    renderRegions();
}

let rz;
window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(renderChart, 150);
});

genData();
buildTicker();
renderProducts();
renderRegions();
updateKPIs();
renderChart();
updateHero();
tickClock();
setInterval(tickClock, 1000);
$('#pauseBtn').innerHTML = icoPause + '<span>Jeda</span>';

for (let i = 0; i < 6; i++) pushTx(true);
setTimeout(feedLoop, 1600);
setTimeout(() => toast('Selamat datang di BCA IDX Sales Console'), 900);
