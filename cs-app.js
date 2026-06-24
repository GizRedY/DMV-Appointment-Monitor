// Print / Save PDF — with fallback for in-app browsers that block window.print()
function doPrint() {
  try {
    window.print();
  } catch (e) {
    alert('Print not available in this app. Open the file in Safari or Chrome to print or save as PDF.');
  }
}

// Build empty Type / Location / QTY tables
document.querySelectorAll('table[data-rows]').forEach(function (tbl) {
  var rows = parseInt(tbl.getAttribute('data-rows'), 10);
  // Which side is this table on within its section? first table = left, second = right
  var section = tbl.closest('.section');
  var tablesInSection = section ? section.querySelectorAll('table[data-rows]') : [tbl];
  var side = (tablesInSection.length >= 2 && tablesInSection[1] === tbl) ? 'right' : 'left';
  var cat = section ? (section.getAttribute('data-cat') || '') : '';
  tbl.setAttribute('data-side', side);

  var head = '<tr><th class="col-type">Type</th><th class="col-loc">Location</th><th class="col-qty">QTY</th></tr>';
  var body = '';
  for (var i = 0; i < rows; i++) {
    body += rowHTML(side, cat);
  }
  tbl.innerHTML = head + body;
});

function rowHTML(side, cat) {
  cat = cat || '';
  var typeInput = '<input type="text" class="type-input" data-cat="' + cat + '" autocomplete="off">';
  var locInput = '<input type="text" class="loc-input" data-cat="' + cat + '" autocomplete="off">';
  if (side === 'right') {
    return '<tr>'
      + '<td class="type-cell-r">' + typeInput + '</td>'
      + '<td>' + locInput + '</td>'
      + '<td class="qty qty-cell"><input type="text" class="qty-input"><span class="dev-toggle right"></span></td>'
      + '</tr>';
  }
  return '<tr>'
    + '<td class="type-cell">' + typeInput + '<span class="dev-toggle left"></span></td>'
    + '<td>' + locInput + '</td>'
    + '<td class="qty"><input type="text" class="qty-input"></td>'
    + '</tr>';
}

function blankAll() {
  document.querySelectorAll('input').forEach(function (i) { i.value = ''; });
  document.querySelectorAll('.chk').forEach(function (c) { c.classList.remove('on'); });
  document.querySelectorAll('.type-input').forEach(function (i) { i.removeAttribute('data-device-id'); i.style.fontSize = ''; });
  document.querySelectorAll('.type-badge').forEach(function (b) { b.remove(); });
}

function toggleChk(el, kind) {
  el.classList.toggle('on');
  document.querySelectorAll('.chk').forEach(function (c) {
    if (c !== el && el.classList.contains('on')) c.classList.remove('on');
  });
}

function clearAll() {
  blankAll();
  resetCalcState();
}

// ---- Add rows via icon menu ----
function makeRow(side, cat) {
  var tmp = document.createElement('tbody');
  tmp.innerHTML = rowHTML(side || 'left', cat || '');
  return tmp.firstChild;
}

function toggleDevice(e, dot) {
  if (e && e.stopPropagation) e.stopPropagation();
  var tr = dot.closest('tr');
  tr.classList.toggle('off');
}

// clear a whole row (Type / Location / QTY + badge + device id)
function clearRow(dot) {
  var tr = dot.closest('tr');
  if (!tr) return;
  var typeInp = tr.querySelector('.type-input');
  var inputs = tr.querySelectorAll('input');
  inputs.forEach(function (i) { i.value = ''; i.style.fontSize = ''; });
  if (typeInp) { typeInp.removeAttribute('data-device-id'); setRowBadge(typeInp, null); }
  tr.classList.remove('off');
}

// tap = toggle, long-press (0.5s) = clear row — bound to the existing dot
(function () {
  var LONG_MS = 500;
  var timer = null, longFired = false, activeDot = null;
  function start(e) {
    var dot = e.target.closest('.dev-toggle');
    if (!dot) return;
    e.preventDefault(); e.stopPropagation();
    activeDot = dot; longFired = false;
    dot.classList.add('pressing');
    timer = setTimeout(function () {
      longFired = true;
      dot.classList.remove('pressing');
      clearRow(dot);
      if (navigator.vibrate) navigator.vibrate(30);
    }, LONG_MS);
  }
  function end(e) {
    if (!activeDot) return;
    clearTimeout(timer);
    activeDot.classList.remove('pressing');
    if (!longFired) { toggleDevice(e, activeDot); }  // short tap -> toggle
    activeDot = null;
  }
  function cancel() {
    if (timer) clearTimeout(timer);
    if (activeDot) activeDot.classList.remove('pressing');
    activeDot = null;
  }
  document.addEventListener('pointerdown', start, true);
  document.addEventListener('pointerup', end, true);
  document.addEventListener('pointercancel', cancel, true);
  document.addEventListener('pointerleave', cancel, true);
})();

function addTwoLines(section) {
  var cat = section.getAttribute('data-cat') || '';
  var tables = section.querySelectorAll('table[data-rows]');
  var pairs = [];
  if (tables.length >= 2) {
    pairs.push({ row: makeRow('left', cat), table: tables[0] });
    pairs.push({ row: makeRow('right', cat), table: tables[1] });
  } else if (tables.length === 1) {
    var side = tables[0].getAttribute('data-side') || 'left';
    pairs.push({ row: makeRow(side, cat), table: tables[0] });
    pairs.push({ row: makeRow(side, cat), table: tables[0] });
  }
  pairs.forEach(function (p) { p.table.appendChild(p.row); });
}

var currentSection = null;
function openIconMenu(e, iconEl) {
  e.stopPropagation();
  currentSection = iconEl.closest('.section');
  var menu = document.getElementById('iconMenu');
  var r = iconEl.getBoundingClientRect();
  menu.style.left = (window.scrollX + r.right + 8) + 'px';
  menu.style.top = (window.scrollY + r.top) + 'px';
  menu.style.display = 'block';
}

function menuAddLines() {
  if (currentSection) addTwoLines(currentSection);
  document.getElementById('iconMenu').style.display = 'none';
}

document.addEventListener('click', function (e) {
  var ic = e.target.closest && e.target.closest('.icon-circle');
  var menu = document.getElementById('iconMenu');
  if (ic) {
    openIconMenu(e, ic);
    return;
  }
  // clicking anywhere else (except inside the menu) closes it
  if (!e.target.closest || !e.target.closest('#iconMenu')) {
    menu.style.display = 'none';
  }
});

// ---- Auto-shrink the plan name when it gets long ---- (delegated)
document.addEventListener('input', function (e) {
  if (e.target.classList && e.target.classList.contains('plan-name')) {
    var len = e.target.value.length;
    var size = 19;
    if (len > 23) { size = Math.max(12, 19 * 23 / len); }
    e.target.style.fontSize = size + 'px';
  }
});
var planInput = document.querySelector('.plan-name');
if (planInput) {
  var _noop = function () {
    var len = this.value.length;
    var size = 19;                       // full size up to 23 chars
    if (len > 23) {
      size = Math.max(12, 19 * 23 / len); // shrink, but never below 12px
    }
    this.style.fontSize = size + 'px';
  };
  void _noop;
}

// =====================================================================
//  CATALOG  (hardcoded prototype — replace with API call to backend later)
//  Prices are RETAIL. Source of truth will be the database.
// =====================================================================
var CATALOG = {
  security: [
    { id: "sec_mini", name: "Mini", price: 125 },
    { id: "sec_stdext", name: "Standard Extended", price: 109 },
    { id: "sec_minishock", name: "Mini-Shock", price: 149 },
    { id: "sec_motion", name: "Motion", price: 219 },
    { id: "sec_glass", name: "Glassbreak", price: 219 },
    { id: "sec_temp", name: "Temp Sensor", price: 149 },
    { id: "sec_tilt", name: "Tilt", price: 169 },
    { id: "sec_siren", name: "Indoor Siren", price: 129 },
    { id: "sec_garage", name: "Hardwire Overhead Garage Door", price: 60 },
    { id: "sec_mini_free", name: "Mini", price: 0, free: true },
    { id: "sec_minishock_up", name: "Mini-Shock", price: 50, free: true, upgrade: true },
    { id: "sec_motion_free", name: "Motion", price: 0, free: true },
    { id: "sec_glass_free", name: "Glassbreak", price: 0, free: true },
    // ---- BOGO (Other template) ----
    // ★ master = paid by voucher first ($125). Secondary = free ($0).
    // The "→ Shock" variants add a $50 upgrade that is NEVER covered by voucher.
    { id: "bogo_master", name: "★ BOGO Mini", price: 125, bogoMaster: true },
    { id: "bogo_master_shock", name: "★ BOGO Mini → Shock", price: 125, bogoMaster: true, upgradeAdd: 50 },
    { id: "bogo_secondary", name: "BOGO Mini", price: 0, free: true, bogoSecondary: true },
    { id: "bogo_secondary_shock", name: "BOGO Mini-Shock", price: 0, free: true, upgrade: true, bogoSecondary: true, upgradeAdd: 50 }
  ],
  fire: [
    { id: "fire_smoke", name: "Smoke", price: 229 },
    { id: "fire_co", name: "CO", price: 219 },
    { id: "fire_heat", name: "Heat", price: 129 },
    { id: "fire_flood", name: "Flood", price: 149 },
    { id: "fire_smoke_free", name: "Smoke", price: 0, free: true }
  ],
  video: [
    { id: "vid_out", name: "OUT Camera", price: 349 },
    { id: "vid_in", name: "IN Camera", price: 279 },
    { id: "vid_bell", name: "Video Doorbell", price: 349 },
    { id: "vid_chime", name: "Smart Chime", price: 129 },
    { id: "vid_bell_free", name: "Video Doorbell", price: 0, free: true }
  ],
  home: [
    { id: "home_garage", name: "Garage Door", price: 249 },
    { id: "home_plug", name: "Smart Plug", price: 159 },
    { id: "home_lock", name: "Smart Lock", price: 249 },
    { id: "home_thermo", name: "Thermostat", price: 249 },
    { id: "home_deako_sd", name: "Deako Simple Dimmer", price: 79 },
    { id: "home_deako_sw", name: "Smart Switch", price: 149 },
    { id: "home_deako_dim", name: "Deako Smart Dimmer", price: 179 },
    { id: "home_eero_base", name: "Eero Base WiFi Hub", price: 159 },
    { id: "home_eero_pro", name: "Eero Pro WiFi Hub", price: 249 },
    { id: "home_lever", name: "Lever Lock", price: 369 },
    { id: "home_plug_free", name: "Smart Plug", price: 0, free: true },
    { id: "home_echo_free", name: "Alexa Echo Pop", price: 0, free: true },
    { id: "home_deako_sw_free", name: "Smart Switch", price: 0, free: true },
    { id: "home_garage_free", name: "Garage Door", price: 0, free: true },
    { id: "home_thermo_free", name: "Thermostat", price: 0, free: true },
    { id: "home_lock_free", name: "Smart Lock", price: 0, free: true }
  ],
  keypad: [
    { id: "kp_secondary", name: "2nd Keypad", price: 420 },
    { id: "kp_fob", name: "Key Fob", price: 119 },
    { id: "kp_speaker", name: "Speaker Base", price: 129 },
    { id: "kp_keypad_free", name: "Keypad", price: 0, free: true }
  ]
};

// SVG badges (inline, no external font — works offline & prints)
var GIFT_SVG = '<svg class="badge-gift" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#1d9e75" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8"/><path d="M12 8v12"/><path d="M12 8C12 8 11 3 8 3a2.5 2.5 0 0 0 0 5h4z"/><path d="M12 8c0 0 1-5 4-5a2.5 2.5 0 0 1 0 5h-4z"/></svg>';
var ARROW_SVG = '<svg class="badge-arrow" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#1d9e75" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>';

function badgeHTML(dev) {
  if (!dev) return '';
  var s = '';
  if (dev.free) s += GIFT_SVG;
  if (dev.upgrade) s += ARROW_SVG;
  return s;
}

function findDevice(cat, name) {
  // plain (paid) match by name — used for manual typing
  var list = CATALOG[cat] || [];
  var n = (name || '').trim().toLowerCase();
  for (var i = 0; i < list.length; i++) {
    if (list[i].name.toLowerCase() === n && !list[i].free) return list[i];
  }
  // fall back to any name match if no paid variant
  for (var j = 0; j < list.length; j++) {
    if (list[j].name.toLowerCase() === n) return list[j];
  }
  return null;
}
function findById(cat, id) {
  var list = CATALOG[cat] || [];
  for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
  return null;
}

// place/update the gift/arrow badge on a Type cell
function setRowBadge(inp, dev) {
  var cell = inp.closest('td');
  var existing = cell.querySelector('.type-badge');
  if (existing) existing.remove();
  var html = badgeHTML(dev);
  if (html) {
    var span = document.createElement('span');
    span.className = 'type-badge';
    span.innerHTML = html;
    cell.appendChild(span);
    cell.classList.add('has-badge');
  } else {
    cell.classList.remove('has-badge');
  }
}

// shrink the Type text when the device name gets long (same idea as the plan name)
function fitTypeFont(input) {
  var len = (input.value || '').length;
  var size = 14;                       // full size up to 9 chars
  if (len > 9) {
    size = Math.max(10, 14 * 9 / len);  // shrink, never below 10px
  }
  input.style.fontSize = size + 'px';
}

// ---------- Autocomplete ----------
// Suggested location names per category (free typing still allowed)
var LOCATIONS = {
  security: ['Main Door', 'Garage Door', 'Back Door', 'Window', '2 Floor', 'Garage'],
  fire: ['1 Floor', '2 Floor', 'Each BedRoom', 'Laundry', 'Garage', 'Kitchen', 'Big Closet', 'Dishwasher', 'Heating Tank'],
  video: ['Front Porch', 'Driveway', 'Back Yard', 'Left Side', 'Right Side', 'Back Windows', 'Office'],
  home: ['Garage', 'Up / Down', 'Entry Door', 'Back Door', 'Driveway Light', 'BackYard Light', 'Porch Light', 'Any'],
  keypad: ['Entry', '2 Floor', 'Person', 'Keypad']
};

var acList = document.getElementById('acList');
var acInput = null, acItems = [], acActive = -1, acMode = 'type';  // 'type' | 'loc' | 'qty'
var QTY_OPTIONS = ['1', '2', '3', '4'];

function showAutocomplete(input) {
  var isLoc = input.classList.contains('loc-input');
  var isQty = input.classList.contains('qty-input');
  acMode = isQty ? 'qty' : (isLoc ? 'loc' : 'type');
  var cat = input.getAttribute('data-cat');
  var q = input.value.trim().toLowerCase();
  var matches;
  if (isQty) {
    matches = QTY_OPTIONS.filter(function (nm) { return nm.indexOf(q) !== -1; })
      .map(function (nm) { return { name: nm }; });
    if (q === '') matches = QTY_OPTIONS.map(function (nm) { return { name: nm }; });
  } else if (isLoc) {
    var locs = LOCATIONS[cat] || [];
    matches = locs.filter(function (name) { return name.toLowerCase().indexOf(q) !== -1; })
      .map(function (name) { return { name: name }; });
    if (q === '') matches = locs.map(function (name) { return { name: name }; });
  } else {
    var list = CATALOG[cat] || [];
    matches = list.filter(function (d) { return d.name.toLowerCase().indexOf(q) !== -1; });
    if (q === '') matches = list.slice();

    var AF = { id: 'activation_fee', name: 'Activation Fee' };
    if (q === '' || AF.name.toLowerCase().indexOf(q) !== -1) {
      matches = [AF].concat(matches);
    }
  }
  if (!matches.length) { hideAutocomplete(); return; }

  acInput = input; acItems = matches; acActive = -1;
  acList.innerHTML = matches.map(function (d, i) {
    var label = (isLoc || isQty) ? d.name : (d.name + ' ' + badgeHTML(d));
    return '<div class="ac-item" data-i="' + i + '"><span>' + label + '</span></div>';
  }).join('');
  var r = input.getBoundingClientRect();
  acList.style.left = (window.scrollX + r.left) + 'px';
  acList.style.top = (window.scrollY + r.bottom + 2) + 'px';
  acList.style.minWidth = r.width + 'px';
  acList.style.display = 'block';

  acList.querySelectorAll('.ac-item').forEach(function (el) {
    el.addEventListener('mousedown', function (e) {
      e.preventDefault();
      pickAutocomplete(parseInt(el.getAttribute('data-i'), 10));
    });
  });
}
function hideAutocomplete() { acList.style.display = 'none'; acInput = null; acItems = []; acActive = -1; }
function pickAutocomplete(i) {
  if (!acInput || !acItems[i]) return;
  var item = acItems[i];
  if (acMode === 'loc' || acMode === 'qty') {
    acInput.value = item.name;       // location/qty: just fill the text
    hideAutocomplete();
    return;
  }
  acInput.value = item.name;
  acInput.setAttribute('data-device-id', item.id);   // remember exact catalog entry
  setRowBadge(acInput, item);
  fitTypeFont(acInput);
  hideAutocomplete();
}

document.addEventListener('focusin', function (e) {
  if (e.target.classList && (e.target.classList.contains('type-input') || e.target.classList.contains('loc-input') || e.target.classList.contains('qty-input'))) {
    showAutocomplete(e.target);
  }
});
document.addEventListener('input', function (e) {
  if (e.target.classList && e.target.classList.contains('type-input')) {
    // manual typing breaks the link to a specific catalog entry
    e.target.removeAttribute('data-device-id');
    setRowBadge(e.target, null);
    fitTypeFont(e.target);
    showAutocomplete(e.target);
  } else if (e.target.classList && (e.target.classList.contains('loc-input') || e.target.classList.contains('qty-input'))) {
    showAutocomplete(e.target);
  }
});
document.addEventListener('keydown', function (e) {
  if (acList.style.display !== 'block') return;
  if (e.key === 'ArrowDown') { e.preventDefault(); acActive = Math.min(acActive + 1, acItems.length - 1); paintActive(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); acActive = Math.max(acActive - 1, 0); paintActive(); }
  else if (e.key === 'Enter') { if (acActive >= 0) { e.preventDefault(); pickAutocomplete(acActive); } }
  else if (e.key === 'Escape') { hideAutocomplete(); }
});
function paintActive() {
  acList.querySelectorAll('.ac-item').forEach(function (el, i) {
    el.classList.toggle('active', i === acActive);
  });
}
document.addEventListener('click', function (e) {
  if (acInput && e.target !== acInput && !acList.contains(e.target)) hideAutocomplete();
});
window.addEventListener('scroll', function (e) {
  if (acList.contains(e.target)) return;   // scrolling inside the dropdown — keep it open
  hideAutocomplete();
}, true);

// ---------- Calculate ----------
function gatherLineItems() {
  // returns {recognized:[{tr,price,qty,upgrade,bogoMaster,upgradeAdd,name}], unknown:[...]}
  var recognized = [], unknown = [];
  document.querySelectorAll('.type-input').forEach(function (inp) {
    var tr = inp.closest('tr');
    if (tr.classList.contains('off')) return;        // deactivated rows excluded
    var name = inp.value.trim();
    if (name === '') return;                          // empty rows ignored
    var cat = inp.getAttribute('data-cat');
    var qtyInput = tr.querySelector('.qty-input');
    var qty = parseInt((qtyInput && qtyInput.value).trim(), 10);
    if (isNaN(qty) || qty < 1) qty = 1;

    if (name.toLowerCase() === 'activation fee') {
      unknown.push({ tr: tr, name: 'Activation Fee', qty: qty, cat: cat, activation: true });
      return;
    }

    var id = inp.getAttribute('data-device-id');
    var dev = id ? findById(cat, id) : findDevice(cat, name);
    if (dev) {
      recognized.push({
        tr: tr, name: dev.name, price: dev.price, qty: qty,
        upgrade: !!dev.upgrade,
        bogoMaster: !!dev.bogoMaster,
        bogoSecondary: !!dev.bogoSecondary,
        upgradeAdd: dev.upgradeAdd || 0
      });
    } else {
      unknown.push({ tr: tr, name: name, qty: qty, cat: cat });
    }
  });
  return { recognized: recognized, unknown: unknown };
}

function calculate() {
  var items = gatherLineItems();
  openModal(items.recognized, items.unknown);
}

function finishCalc(recognized, manual, taxRate, voucher) {
  voucher = voucher || 0;
  var calc = getActiveCalc();   // voucher breakdown lives on the active sheet, not globally
  calc.voucherAmount = voucher;

  // Build a flat list of "units" the voucher can be applied to (price each, qty expanded as a group).
  // Upgrades ($50 etc.) are NEVER voucher-eligible.
  // Each entry: {tr, name, base (voucher-eligible $ for the whole row), upgradeExtra ($ not voucher-eligible), bogoMaster}
  var rows = [];
  var upgradesTotal = 0;   // money that bypasses the voucher entirely

  function addRow(it, isManual) {
    var qty = it.qty || 1;
    // voucher-eligible base for this row
    var base = 0, upExtra = 0;
    if (it.upgrade) {
      // a pure upgrade line ($50) — entirely non-voucher
      upExtra += (it.price || 0) * qty;          // usually price 0 for free upgrade rows
    } else {
      base += (it.price || 0) * qty;
    }
    // extra shock add-on baked into BOGO rows ($50) — non-voucher
    if (it.upgradeAdd) { upExtra += it.upgradeAdd * qty; }
    upgradesTotal += upExtra;
    if (base > 0 || it.bogoMaster) {
      rows.push({
        tr: it.tr || null, name: it.name || '', base: base,
        bogoMaster: !!it.bogoMaster
      });
    } else if (upExtra > 0 && it.tr) {
      // a free-upgrade row contributes only non-voucher money; mark tr as not voucher-colored
      rows.push({ tr: it.tr, name: it.name || '', base: 0, bogoMaster: false, upgradeOnly: true });
    }
  }
  recognized.forEach(function (r) { addRow(r, false); });
  manual.forEach(function (m) { addRow({ tr: m.tr, name: m.name, price: m.price, qty: m.qty, upgrade: !!m.activation }, true); });

  // ---- BOGO shortfall check ----
  var bogoNeed = 0;
  rows.forEach(function (r) { if (r.bogoMaster) bogoNeed += r.base; });
  if (bogoNeed > voucher) {
    return false;  // guarded earlier in confirmCalc with a visible banner
  }

  // ---- Apply voucher: BOGO masters first, then by price (high -> low) ----
  var order = rows.filter(function (r) { return r.base > 0; }).slice();
  order.sort(function (a, b) {
    if (a.bogoMaster && !b.bogoMaster) return -1;
    if (!a.bogoMaster && b.bogoMaster) return 1;
    return b.base - a.base;   // expensive first
  });

  var remaining = voucher;
  var breakdown = [];
  order.forEach(function (r) {
    r.coverState = 'none';   // none | full | partial
    r.covered = 0;
    if (remaining <= 0) { return; }
    if (remaining >= r.base) {
      r.covered = r.base; remaining -= r.base; r.coverState = 'full';
    } else {
      r.covered = remaining; r.coverState = 'partial'; remaining = 0;
    }
    breakdown.push({
      name: r.name, base: r.base, covered: r.covered,
      state: r.coverState, outOfPocket: r.base - r.covered
    });
  });
  calc.voucherBreakdown = breakdown;
  var voucherLeft = remaining;
  var voucherUsed = voucher - voucherLeft;

  // ---- Totals ----
  var voucherEligibleTotal = 0;
  rows.forEach(function (r) { voucherEligibleTotal += r.base; });
  var restAfter = voucherEligibleTotal - voucherUsed;
  var sub = restAfter + upgradesTotal;
  var tax = sub * (taxRate / 100);
  var total = Math.floor((sub + tax + 1e-9) * 100) / 100;

  // ---- Color the rows (green = fully covered, yellow = partial) ----
  paintVoucherColors(order);

  document.getElementById('subTotal').value = '$' + sub.toFixed(2);
  document.getElementById('taxField').value = '$' + tax.toFixed(2);
  document.getElementById('totalField').value = '$' + total.toFixed(2);

  var leftBox = document.getElementById('voucherLeftBox');
  if (voucherLeft > 0) {
    leftBox.textContent = '$' + voucherLeft.toFixed(2) + ' voucher left';
    leftBox.style.display = 'block';
  } else {
    leftBox.textContent = '';
    leftBox.style.display = 'none';
  }

  // show the VOU button if a voucher was actually used
  document.getElementById('vouBtn').style.display = (voucher > 0) ? 'inline-block' : 'none';

  var box = document.getElementById('financeBox');
  if (total > 0) {
    var months = total <= 3500 ? 25 : 36;
    var monthly = total / months;
    var ICON_CAL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1d9e75" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2.5" x2="8" y2="6"/><line x1="16" y1="2.5" x2="16" y2="6"/><path d="M12 13v3l2 1"/></svg>';
    var ICON_NOFEE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1d9e75" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/><path d="M9.5 9.2c.4-.7 1.2-1.1 2.5-1.1 1.6 0 2.5.7 2.5 1.7M14 14.4c-.3.9-1.2 1.5-2.5 1.5-1.4 0-2.3-.5-2.6-1.4"/></svg>';
    box.innerHTML =
      '<div class="fin-amount">$' + monthly.toFixed(2) + '<span class="fin-per"> /mo · ' + months + ' months</span></div>'
      + '<div class="fin-perks">'
      + '<span class="fin-perk">0% APR — interest-free</span>'
      + '<span class="fin-perk">' + ICON_CAL + 'First payment in ~30 days — nothing due today</span>'
      + '<span class="fin-perk">' + ICON_NOFEE + 'Pay off anytime, no penalty</span>'
      + '</div>';
    document.getElementById('toggleFull').style.display = 'inline-block';
  } else {
    box.innerHTML = '';
  }
  document.getElementById('totalsTable').classList.remove('show');
  document.getElementById('toggleFull').classList.remove('active');
  return true;
}

// paint voucher coverage colors on device rows
function paintVoucherColors(order) {
  // clear previous coloring everywhere first
  document.querySelectorAll('.type-input, .loc-input').forEach(function (i) {
    i.classList.remove('vou-full', 'vou-partial');
  });
  order.forEach(function (r) {
    if (!r.tr) return;
    var t = r.tr.querySelector('.type-input');
    var l = r.tr.querySelector('.loc-input');
    var cls = r.coverState === 'full' ? 'vou-full' : (r.coverState === 'partial' ? 'vou-partial' : '');
    if (cls) { if (t) t.classList.add(cls); if (l) l.classList.add(cls); }
  });
}

// clear everything produced by a previous Calculate (totals, financing, colors, buttons)
function resetCalcState() {
  document.querySelectorAll('.type-input, .loc-input').forEach(function (i) {
    i.classList.remove('vou-full', 'vou-partial');
  });
  var fb = document.getElementById('financeBox'); if (fb) fb.innerHTML = '';
  var lb = document.getElementById('voucherLeftBox'); if (lb) { lb.textContent = ''; lb.style.display = 'none'; }
  ['subTotal', 'taxField', 'totalField'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
  var tt = document.getElementById('totalsTable'); if (tt) tt.classList.remove('show');
  var tf = document.getElementById('toggleFull'); if (tf) { tf.classList.remove('active'); }
  var vb = document.getElementById('vouBtn'); if (vb) vb.style.display = 'none';
  var calc = getActiveCalc(); calc.voucherBreakdown = []; calc.voucherAmount = 0;
}

function toggleFullPrice() {
  var t = document.getElementById('totalsTable');
  var btn = document.getElementById('toggleFull');
  var shown = t.classList.toggle('show');
  btn.classList.toggle('active', shown);
}

function openVoucherBreakdown() {
  var calc = getActiveCalc();
  var amount = calc.voucherAmount || 0;
  var breakdown = calc.voucherBreakdown || [];
  document.getElementById('vouTitle').textContent = 'Voucher usage ($' + amount.toFixed(2) + ')';
  var box = document.getElementById('vouRows');
  if (!breakdown.length) {
    box.innerHTML = '<p style="color:#777;">Voucher was not applied to anything.</p>';
  } else {
    var html = '';
    breakdown.forEach(function (r) {
      if (r.state === 'full') {
        html += '<div class="vou-line"><span class="vou-dot green"></span>'
          + '<span class="vou-name">' + r.name + '</span>'
          + '<span class="vou-amt">−$' + r.covered.toFixed(2) + '</span></div>';
      } else {
        html += '<div class="vou-line"><span class="vou-dot yellow"></span>'
          + '<span class="vou-name">' + r.name + '</span>'
          + '<span class="vou-amt">−$' + r.covered.toFixed(2) + '</span></div>'
          + '<div class="vou-sub">partially covered · still owe <b>$' + r.outOfPocket.toFixed(2) + '</b> on this device</div>';
      }
    });
    box.innerHTML = html;
  }
  document.getElementById('vouBg').classList.add('show');
}
function closeVoucherBreakdown() { document.getElementById('vouBg').classList.remove('show'); }

// ---- Device guide (info button) ----
var DEVICE_INFO = [
  { name: 'Mini', text: 'A small sensor installed on doors and windows. When the door or window is opened, the system detects this action and can trigger an alarm.' },
  { name: 'Mini-Shock', text: 'An upgraded version of the Mini, installed on doors and windows. Thanks to a built-in accelerometer, it reacts to vibration or impact — not just opening. It provides stronger protection and helps prevent damage before an entry point is fully forced open. Not recommended for the main door to help avoid false alarms.' },
  { name: 'Motion', text: 'A motion detector for a room or hallway. It senses movement inside the protected area and triggers the alarm if someone is moving where they should not be. Recommended placement: second floor or basement, especially when the first floor is already fully protected with Mini-Shocks. It is not active in Arm Stay mode.' },
  { name: 'Glassbreak', text: 'A sensor that listens for the specific sound frequency of breaking glass. If a window is smashed, it detects the sound and triggers the alarm. It is active in both Arm Stay and Arm Away modes.' },
  { name: 'Smoke', text: 'Following International Residential Code requirements (R314.3), smoke detectors are recommended on every level of the home, inside each sleeping room, and outside each sleeping area.' },
  { name: 'CO', text: 'A carbon monoxide detector. CO is an invisible, odorless gas from fuel-burning systems. The sensor warns you before levels become dangerous. Following International Residential Code requirements (R315), CO detectors are recommended on every level of the home when there is any fuel-burning system or an attached garage.' },
  { name: 'Heat', text: 'A heat detector for areas where smoke detectors are not ideal, such as garages, attics, kitchens, etc. It triggers when the temperature rises sharply, indicating a fire. Following NFPA 72 requirements, the appropriate detection device should be selected based on the specific area and its conditions.' },
  { name: 'Flood', text: 'A water/flood sensor placed near water sources (laundry, water heater, dishwasher). It alerts you at the first sign of a leak, helping prevent water damage.' },
  { name: 'OUT Camera', text: 'An outdoor camera that watches the exterior of the home (driveway, yard, sides). It records video and can deter intruders before they reach the house.' },
  { name: 'IN Camera', text: 'An indoor camera for monitoring inside the home. Useful for checking on activity, pets, or deliveries while you are away.' },
  { name: 'Video Doorbell', text: 'A camera built into the doorbell at the front door. You can see and talk to whoever is at the door from your phone, and it records visitors and deliveries.' },
  { name: 'Smart Lock', text: 'An electronic door lock you can control remotely. Lock or unlock the door from your phone and give temporary access codes to guests.' },
  { name: 'Thermostat', text: 'A smart thermostat that controls heating and cooling. It can be adjusted from your phone and helps save energy.' },
  { name: 'Garage Door', text: 'A controller that lets you open, close, and monitor the garage door remotely, so you never have to wonder if you left it open.' },
  { name: 'Smart Plug', text: 'A plug that makes any device smart. Turn lamps or appliances on and off remotely or on a schedule.' },
  { name: 'Smart Switch', text: 'A smart light switch that lets you control lighting remotely or on a schedule, and adds convenience and an away-from-home look.' },
  { name: 'Keypad', text: 'The control panel for the system. Arm and disarm the alarm, and it acts as the hub that communicates with all the sensors.' },
  { name: 'Key Fob', text: 'A small remote on your keychain to arm or disarm the system with one button, and many include a panic button for emergencies.' },
  { name: 'Indoor Siren', text: 'A loud indoor siren. When the alarm triggers, it scares off intruders and alerts everyone in the house. For homes with more than one level, an additional siren is recommended because sound can be significantly reduced between floors and through closed doors. NFPA 72 requires audible alarm notification to be loud enough in sleeping areas, typically at least 75 dBA at pillow level.' },
  { name: 'Standard Extended', text: 'A hardwired transmitter that works together with the Tilt sensor. The Tilt mounts on the door and wires back to the Standard Extended, which relays the open and closed signal to the keypad.' },
  { name: 'Tilt', text: 'Mounts on the garage door and senses its angle to tell whether it is open or closed. It wires to a Standard Extended, which sends the signal to the keypad, and can trigger the alarm if the door opens unexpectedly.' },
  { name: 'Smart Chime', text: 'An in-home chime that pairs with the Video Doorbell, so you hear the doorbell throughout the house even when your phone is not nearby.' },
  { name: 'Deako Simple Dimmer', text: 'A Deako module that replaces a standard switch to give dimmable control of a light. It works offline only and is not connected to an account, so it cannot be controlled from a phone. Deako switches are modular and swap in without rewiring once the base is installed.' },
  { name: 'Deako Smart Dimmer', text: 'The same as the Deako Smart Switch, with a dimmer built in. It connects to your account, so you can control the light and adjust brightness from your phone or on a schedule.' },
  { name: 'Eero Base WiFi Hub', text: 'Dual-band mesh WiFi hub (2.4 + 5 GHz), WiFi 6. One unit is the main router off the modem, and added units kill dead zones. A good fit for most single-story homes on a standard plan.' },
  { name: 'Eero Pro WiFi Hub', text: 'Tri-band mesh hub. A third radio carries the link between units (backhaul), so it holds speed better across floors and with many devices connected. Best for larger or multi-story homes and gigabit plans.' },
  { name: 'Lever Lock', text: 'A smart lock for doors that have only a lever handle and no hole for a deadbolt. It installs where a standard deadbolt-style smart lock cannot go, with the same remote lock and unlock and guest codes.' },
  { name: '2nd Keypad', text: 'An additional keypad for a second entry point or floor. It is usually installed on the second floor or in a bedroom, and lets you control the system from there. It is especially valuable for its panic buttons, so if something happens you do not have to run to the main keypad.' },
  { name: 'Speaker Base', text: 'A base the keypad attaches to so it can sit on a counter or shelf instead of being mounted on the wall, with a built-in speaker for the panel.' }
];

function guidePrice(name) {
  var n = (name || '').trim().toLowerCase();
  for (var cat in CATALOG) {
    var list = CATALOG[cat];
    for (var i = 0; i < list.length; i++) {
      if (list[i].name.toLowerCase() === n && !list[i].free) return list[i].price;
    }
  }
  return null;
}

function openDeviceInfo() {
  var box = document.getElementById('infoList');
  box.innerHTML = DEVICE_INFO.map(function (d, i) {
    var p = guidePrice(d.name);
    var priceTag = (p != null && p > 0) ? '<span class="info-price">$' + p + '</span>' : '';
    return '<div class="info-item">'
      + '<button type="button" class="info-name" onclick="toggleInfoItem(' + i + ')"><span class="info-label">' + d.name + priceTag + '</span><span class="info-caret">›</span></button>'
      + '<div class="info-text" id="infoText' + i + '">' + d.text + '</div>'
      + '</div>';
  }).join('');
  document.getElementById('infoBg').classList.add('show');
}
function closeDeviceInfo() { document.getElementById('infoBg').classList.remove('show'); }
function toggleInfoItem(i) {
  var el = document.getElementById('infoText' + i);
  var open = el.classList.toggle('open');
  var caret = el.previousElementSibling.querySelector('.info-caret');
  if (caret) caret.style.transform = open ? 'rotate(90deg)' : '';
}

// ---------- Calculate modal (tax + unrecognized) ----------
var pendingRecognized = [], pendingUnknown = [];
function openModal(recognized, unknown) {
  pendingRecognized = recognized;
  pendingUnknown = unknown;

  var calc = getActiveCalc();
  document.getElementById('taxInput').value = (calc.tax != null ? calc.tax : '');
  document.getElementById('voucherInput').value = (calc.voucher != null ? calc.voucher : '');

  var wrap = document.getElementById('unknownWrap');
  if (unknown.length) {
    wrap.style.display = 'block';
    document.getElementById('modalRows').innerHTML = unknown.map(function (u, i) {
      var remembered = calc.prices[u.name.toLowerCase()];
      var valAttr = (remembered != null && remembered !== '') ? (' value="' + remembered + '"') : '';
      return '<div class="mrow">'
        + '<span class="mname">' + u.name + '</span>'
        + '<span class="mqty">×' + u.qty + '</span>'
        + '<input type="number" min="0" step="1" placeholder="$ price" data-i="' + i + '"' + valAttr + '>'
        + '</div>';
    }).join('');
  } else {
    wrap.style.display = 'none';
    document.getElementById('modalRows').innerHTML = '';
  }
  document.getElementById('calcError').style.display = 'none';
  document.getElementById('modalBg').classList.add('show');
  setTimeout(function () { document.getElementById('taxInput').focus(); }, 50);
}
function closeModal() { document.getElementById('modalBg').classList.remove('show'); }

function confirmCalc() {
  var taxRate = parseFloat(document.getElementById('taxInput').value);
  if (isNaN(taxRate) || taxRate < 0) taxRate = 0;
  var voucher = parseFloat(document.getElementById('voucherInput').value);
  if (isNaN(voucher) || voucher < 0) voucher = 0;

  var manual = [];
  var ok = true;
  var calc = getActiveCalc();
  document.querySelectorAll('#modalRows input').forEach(function (inp) {
    var i = parseInt(inp.getAttribute('data-i'), 10);
    var v = parseFloat(inp.value);
    if (isNaN(v) || v < 0) { ok = false; inp.style.borderColor = '#d9534f'; return; }
    manual.push({ tr: pendingUnknown[i].tr, name: pendingUnknown[i].name, price: v, qty: pendingUnknown[i].qty, activation: pendingUnknown[i].activation });
    calc.prices[pendingUnknown[i].name.toLowerCase()] = v;   // remember this price on THIS sheet
  });
  if (!ok) return;  // wait until every unknown has a valid price

  // remember tax & voucher on this sheet too
  calc.tax = document.getElementById('taxInput').value;
  calc.voucher = document.getElementById('voucherInput').value;

  // BOGO voucher-shortfall check — show a clear banner inside the modal
  var bogoNeed = 0;
  pendingRecognized.forEach(function (r) { if (r.bogoMaster) bogoNeed += (r.price || 0) * (r.qty || 1); });
  var errBox = document.getElementById('calcError');
  if (bogoNeed > voucher) {
    errBox.innerHTML = 'Not enough voucher for BOGO.<br>BOGO needs <b>$' + bogoNeed.toFixed(2) + '</b>, but the voucher is only <b>$' + voucher.toFixed(2) + '</b>.<br>Increase the voucher or reduce the number of BOGO.';
    errBox.style.display = 'block';
    return;
  }
  errBox.style.display = 'none';

  var success = finishCalc(pendingRecognized, manual, taxRate, voucher);
  if (success) { closeModal(); }   // keep modal open on any shortfall so the user can fix the voucher
}

// =====================================================================
//  TEMPLATE ENGINE — DR Horton
// =====================================================================
function openTemplate() {
  document.getElementById('tmplStepQuestions').style.display = 'none';
  document.getElementById('tmplStepBuilder').style.display = 'block';
  document.getElementById('tmplBg').classList.add('show');
}
function closeTemplate() { document.getElementById('tmplBg').classList.remove('show'); }
var DRH_DEFAULTS = {
  qFloors: 2, qBeds: 4, qAdults: 2, qDoors: 3, qWindows: 5,
  qLaundry: 1, qKitchen: 1, qCloset: 0,
  qDishwasher: 1, qHeatTank: 1
};
var templateKind = 'drhorton';   // 'drhorton' | 'other'
function resetTemplateDefaults() {
  Object.keys(DRH_DEFAULTS).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = DRH_DEFAULTS[id];
  });
  document.getElementById('qHasGarage').checked = true;
  document.getElementById('qCO').checked = true;
  document.getElementById('qWalls').value = '4';
  document.getElementById('qMotionType').value = 'motion';
  document.getElementById('qFreeDoorbell').checked = false;
  document.getElementById('qFreeDeako').checked = false;
  document.getElementById('qFreeEcho').checked = false;
  document.getElementById('qFreeSmoke').checked = false;
  document.getElementById('qFreePlug').checked = false;
  document.getElementById('qBogo').value = 0;
}
function startDrHorton() {
  templateKind = 'drhorton';
  resetTemplateDefaults();
  document.getElementById('qFreeDoorbell').checked = true;   // DR Horton: doorbell included
  document.getElementById('qFreeDeako').checked = true;      // DR Horton: deako included
  document.getElementById('qBogoWrap').style.display = 'none';  // BOGO is Other-only
  document.getElementById('tmplStepQuestions').style.display = 'block';
  document.querySelector('#tmplStepQuestions .sub').textContent =
    'DR Horton — answer a few questions and the form fills itself. You can edit everything after.';
  document.getElementById('tmplStepBuilder').style.display = 'none';
}
function startOther() {
  templateKind = 'other';
  resetTemplateDefaults();
  document.getElementById('qMotionType').value = 'none';   // Other: Motion/Glassbreak rarely given
  document.getElementById('qBogoWrap').style.display = '';  // show BOGO for Other
  document.getElementById('tmplStepQuestions').style.display = 'block';
  document.querySelector('#tmplStepQuestions .sub').textContent =
    'Other (generic) — answer a few questions and the form fills itself. You can edit everything after.';
  document.getElementById('tmplStepBuilder').style.display = 'none';
}
function backToBuilder() {
  document.getElementById('tmplStepQuestions').style.display = 'none';
  document.getElementById('tmplStepBuilder').style.display = 'block';
}

// Fill a category's rows in reading order (left table then right table),
// adding extra rows as needed. items = [{id, location, qty}]
function fillCategory(cat, items) {
  var section = document.querySelector('.section[data-cat="' + cat + '"]');
  if (!section) return;
  var tables = section.querySelectorAll('table[data-rows]');

  function bodyRows(tbl) {
    return Array.prototype.slice.call(tbl.querySelectorAll('tr')).filter(function (tr) {
      return tr.querySelector('.type-input');
    });
  }

  if (tables.length >= 2) {
    var need = items.length;
    // split so the left column holds the first half (reading top-to-bottom, left then right)
    var leftCount = Math.ceil(need / 2);
    var rightCount = need - leftCount;
    // make sure each table has at least the required number of rows
    var lRows = bodyRows(tables[0]);
    var rRows = bodyRows(tables[1]);
    while (lRows.length < leftCount) { tables[0].appendChild(makeRow('left', cat)); lRows = bodyRows(tables[0]); }
    while (rRows.length < rightCount) { tables[1].appendChild(makeRow('right', cat)); rRows = bodyRows(tables[1]); }
    // fill left column first (in order), then right column
    var ordered = [];
    for (var i = 0; i < leftCount; i++) ordered.push(lRows[i]);
    for (var j = 0; j < rightCount; j++) ordered.push(rRows[j]);
    items.forEach(function (item, idx) { writeRow(ordered[idx], cat, item); });
  } else {
    var only = tables[0];
    var side = only.getAttribute('data-side') || 'left';
    var rows = bodyRows(only);
    while (rows.length < items.length) { only.appendChild(makeRow(side, cat)); rows = bodyRows(only); }
    items.forEach(function (item, idx) { writeRow(rows[idx], cat, item); });
  }
}

function writeRow(tr, cat, item) {
  var typeInput = tr.querySelector('.type-input');
  var inputs = tr.querySelectorAll('input');
  // inputs order: [type, location, qty] (qty has class qty-input)
  var locInput = null, qtyInput = tr.querySelector('.qty-input');
  inputs.forEach(function (i) {
    if (i !== typeInput && i !== qtyInput) locInput = i;
  });
  var dev = findById(cat, item.id);
  if (dev) {
    typeInput.value = dev.name;
    typeInput.setAttribute('data-device-id', dev.id);
    setRowBadge(typeInput, dev);
  } else {
    typeInput.value = item.name || '';
    typeInput.removeAttribute('data-device-id');
    setRowBadge(typeInput, null);
  }
  if (locInput) locInput.value = item.location || '';
  if (qtyInput) qtyInput.value = (item.qty != null ? item.qty : 1);
  fitTypeFont(typeInput);
}

function applyDrHorton() {
  var n = function (id) { var v = parseInt(document.getElementById(id).value, 10); return isNaN(v) ? 0 : v; };
  var floors = Math.max(1, n('qFloors'));
  var beds = n('qBeds');
  var adults = n('qAdults');
  var doors = n('qDoors');
  var windows = n('qWindows');
  var hasGarage = document.getElementById('qHasGarage').checked;
  var laundry = n('qLaundry');
  var kitchen = n('qKitchen');
  var closet = n('qCloset');
  var dishwash = n('qDishwasher');
  var heatTank = n('qHeatTank');
  var walls = parseInt(document.getElementById('qWalls').value, 10);
  var addCO = document.getElementById('qCO').checked;
  var freeBell = document.getElementById('qFreeDoorbell').checked;
  var freeDeako = document.getElementById('qFreeDeako').checked;
  var freeEcho = document.getElementById('qFreeEcho').checked;
  var freeSmoke = document.getElementById('qFreeSmoke').checked;
  var freePlug = document.getElementById('qFreePlug').checked;
  var motionType = document.getElementById('qMotionType').value; // 'motion' | 'glassbreak' | 'none'
  var bogoCount = (templateKind === 'other') ? n('qBogo') : 0;
  if (bogoCount < 0) bogoCount = 0;
  if (bogoCount > 10) bogoCount = 10;

  // ---------- FIRE & CO ----------
  var fire = [];
  // Smoke: one per floor + one per bedroom; top floor free if "Smoke included" is on
  for (var f = 1; f <= floors; f++) {
    var topFloor = (f === floors);
    fire.push({ id: (freeSmoke && topFloor) ? 'fire_smoke_free' : 'fire_smoke', location: floorName(f), qty: 1 });
  }
  if (beds > 0) { fire.push({ id: 'fire_smoke', location: 'Each BedRoom', qty: beds }); }
  // Heat: per existing room
  for (var i = 0; i < laundry; i++) fire.push({ id: 'fire_heat', location: 'Laundry', qty: 1 });
  if (hasGarage) fire.push({ id: 'fire_heat', location: 'Garage', qty: 1 });
  for (var i3 = 0; i3 < kitchen; i3++) fire.push({ id: 'fire_heat', location: 'Kitchen', qty: 1 });
  for (var i4 = 0; i4 < closet; i4++) fire.push({ id: 'fire_heat', location: 'Big Closet', qty: 1 });
  // Flood: laundry + dishwasher + heating tank
  for (var l = 0; l < laundry; l++) fire.push({ id: 'fire_flood', location: 'Laundry', qty: 1 });
  for (var dw = 0; dw < dishwash; dw++) fire.push({ id: 'fire_flood', location: 'Dishwasher', qty: 1 });
  for (var ht = 0; ht < heatTank; ht++) fire.push({ id: 'fire_flood', location: 'Heating Tank', qty: 1 });
  // Flood under Fridge always
  fire.push({ id: 'fire_flood', location: 'Refrigerator', qty: 1 });
  // CO: per floor if fuel burning / attached garage
  if (addCO) { for (var c = 1; c <= floors; c++) fire.push({ id: 'fire_co', location: floorName(c), qty: 1 }); }
  // keep Fire grouped by type: Smoke -> Heat -> Flood -> CO
  var fireOrder = { fire_smoke: 0, fire_smoke_free: 0, fire_heat: 1, fire_flood: 2, fire_co: 3 };
  fire.sort(function (a, b) { return (fireOrder[a.id] - fireOrder[b.id]); });

  // ---------- VIDEO ----------
  var video = [];
  // doorbell is independent of cameras — add it whenever its checkbox is on
  if (freeBell) video.push({ id: 'vid_bell_free', location: 'Front Porch', qty: 1 });
  if (walls > 0) {
    var camLocs = walls === 4 ? ['Driveway', 'Back Yard', 'Left Side', 'Right Side']
      : ['Driveway', 'Back Yard'];   // walls === 2
    camLocs.forEach(function (loc) { video.push({ id: 'vid_out', location: loc, qty: 1 }); });
    video.push({ id: 'vid_in', location: 'Back Windows', qty: 1 });  // one indoor
  }
  // walls === 0 -> No cameras: no OUT/IN cameras (doorbell above still allowed)

  // ---------- SECURITY ----------
  var sec = [];

  if (templateKind === 'other') {
    // Order: free Mini slots (doors first, then windows) -> BOGO -> paid windows -> extra doors.
    // Exactly 4 free slots by priority: Main Door, Garage Door (if garage),
    // Back Door (Mini-Shock upgrade), then windows (Mini-Shock upgrade).
    // BOGO devices count as window coverage. Anything left over is paid Mini-Shock.
    var freeLeft = 4;
    var backDoorExists = doors >= 2;

    // 1) free door slots
    sec.push({ id: 'sec_mini_free', location: 'Main Door', qty: 1 }); freeLeft--;
    if (hasGarage && freeLeft > 0) { sec.push({ id: 'sec_mini_free', location: 'Garage Door', qty: 1 }); freeLeft--; }
    if (backDoorExists && freeLeft > 0) { sec.push({ id: 'sec_minishock_up', location: 'Back Door', qty: 1 }); freeLeft--; }

    // 2) remaining free slots go to windows (free Mini-Shock upgrades)
    var winsCovered = 0;   // how many windows are already covered
    while (freeLeft > 0 && winsCovered < windows) {
      sec.push({ id: 'sec_minishock_up', location: 'Window', qty: 1 });
      winsCovered++; freeLeft--;
    }

    // 3) BOGO pairs (default upgraded to Shock) — each device covers one window
    for (var bg = 0; bg < bogoCount; bg++) {
      sec.push({ id: 'bogo_master_shock', location: 'Window', qty: 1 });
      sec.push({ id: 'bogo_secondary_shock', location: 'Window', qty: 1 });
      winsCovered += 2;
    }

    // 4) remaining windows -> paid Mini-Shock
    for (var rw = winsCovered; rw < windows; rw++) {
      sec.push({ id: 'sec_minishock', location: 'Window', qty: 1 });
    }

    // 5) extra doors beyond Main/Garage/Back -> paid Mini-Shock
    var assignedDoors = 1 + (hasGarage ? 1 : 0) + (backDoorExists ? 1 : 0);
    for (var xd = assignedDoors; xd < doors; xd++) {
      sec.push({ id: 'sec_minishock', location: 'Extra Door', qty: 1 });
    }
  } else {
    // DR Horton door/window system
    // Independent free caps: doors max 3 (Main, Garage, Back) or 2 without garage; windows max 4.

    // -- Doors --
    sec.push({ id: 'sec_mini_free', location: 'Main Door', qty: 1 });
    if (hasGarage) { sec.push({ id: 'sec_mini_free', location: 'Garage Door', qty: 1 }); }
    if (doors >= (hasGarage ? 3 : 2)) {
      sec.push({ id: 'sec_minishock_up', location: 'Back Door', qty: 1 });
    }
    var freeDoorsMax = hasGarage ? 3 : 2;
    for (var ed = freeDoorsMax; ed < doors; ed++) {
      sec.push({ id: 'sec_minishock', location: 'Extra Door', qty: 1 });
    }

    // -- Windows -- own budget: first 4 are free upgrade, rest paid
    var winFreeMax = 4;
    for (var w = 1; w <= windows; w++) {
      if (w <= winFreeMax) { sec.push({ id: 'sec_minishock_up', location: 'Window ' + w, qty: 1 }); }
      else { sec.push({ id: 'sec_minishock', location: 'Window ' + w, qty: 1 }); }
    }
  }
  // Indoor Siren on 2nd floor if 2 floors
  if (floors >= 2) { sec.push({ id: 'sec_siren', location: '2 Floor', qty: 1 }); }
  // Motion / Glassbreak (free)
  if (motionType !== 'none') {
    if (motionType === 'glassbreak') {
      sec.push({ id: 'sec_glass_free', location: 'Windows', qty: 1 });
    } else {
      sec.push({ id: 'sec_motion_free', location: floors >= 2 ? '2 Floor' : 'Garage', qty: 1 });
    }
  }

  // ---------- HOME AUTOMATION ----------
  var home = [];
  if (templateKind !== 'other') {
    // DR Horton: builder-installed devices the client already has — connect & show as free
    if (hasGarage) home.push({ id: 'home_garage_free', location: 'Garage', qty: 1 });
    home.push({ id: 'home_thermo_free', location: 'Up / Down', qty: floors });  // 2 floors -> 2, 1 floor -> 1
    home.push({ id: 'home_lock_free', location: 'Entry', qty: 1 });
    // Eero Pro per floor
    home.push({ id: 'home_eero_pro', location: '1 Floor', qty: 1 });
    if (floors >= 2) {
      home.push({ id: 'home_eero_pro', location: '2 Floor', qty: 1 });
    }
    // always-offered paid Smart Switches (not free)
    home.push({ id: 'home_deako_sw', location: 'Driveway Light', qty: 1 });
    home.push({ id: 'home_deako_sw', location: 'BackYard Light', qty: 1 });
  } else {
    // Other: paid Smart Lock for the entry (no builder-installed freebies)
    home.push({ id: 'home_lock', location: 'Entry', qty: 1 });
  }
  if (freeDeako) home.push({ id: 'home_deako_sw_free', location: 'Porch Light', qty: 1 });
  if (freeEcho) home.push({ id: 'home_echo_free', location: 'Any', qty: 1 });
  // always offer one paid Smart Plug (both templates)
  home.push({ id: 'home_plug', location: 'Any', qty: 1 });
  // optional free Smart Plug if the checkbox is on
  if (freePlug) home.push({ id: 'home_plug_free', location: 'Any', qty: 1 });

  // ---------- KEYPADS / KEY FOBS ----------
  var keypad = [];
  keypad.push({ id: 'kp_keypad_free', location: 'Entry', qty: 1 });   // always free keypad
  if (floors >= 2) { keypad.push({ id: 'kp_secondary', location: '2 Floor', qty: 1 }); }
  for (var a = 1; a <= adults; a++) { keypad.push({ id: 'kp_fob', location: a + ' Person', qty: 1 }); }

  // ---- wipe form and fill ----
  blankAll();
  clearBadges();
  resetCalcState();
  fillCategory('fire', fire);
  fillCategory('video', video);
  fillCategory('security', sec);
  fillCategory('home', home);
  fillCategory('keypad', keypad);

  // name the plan automatically
  var planEl = document.querySelector('.plan-name');
  if (planEl) {
    planEl.value = 'Comprehensive Coverage';
    planEl.dispatchEvent(new Event('input', { bubbles: true }));  // trigger auto-shrink
  }

  closeTemplate();
}

function floorName(f) {
  return f === 1 ? '1 Floor' : (f === 2 ? '2 Floor' : f + ' Floor');
}
function clearBadges() {
  document.querySelectorAll('.type-badge').forEach(function (b) { b.remove(); });
  document.querySelectorAll('.type-input').forEach(function (i) { i.removeAttribute('data-device-id'); });
}

// =====================================================================
//  TABS — multiple independent sheets (Path 1: state snapshots)
// =====================================================================
var sheetEl = document.querySelector('.sheet');
var tabs = [];           // [{id, name, html, calc}]
var activeTabId = null;
var tabSeq = 0;

// per-sheet Calculate state: tax, voucher and manual prices live on the tab object
function getActiveCalc() {
  var t = tabs.find(function (x) { return x.id === activeTabId; });
  if (!t) return { tax: '', voucher: '', prices: {}, voucherBreakdown: [], voucherAmount: 0 };
  if (!t.calc) t.calc = { tax: '', voucher: '', prices: {}, voucherBreakdown: [], voucherAmount: 0 };
  return t.calc;
}

// write current input values & sizes into the DOM attributes so innerHTML keeps them
function syncDomValues() {
  sheetEl.querySelectorAll('input').forEach(function (i) {
    i.setAttribute('value', i.value);
    if (i.style.fontSize) i.setAttribute('style', 'font-size:' + i.style.fontSize); else i.removeAttribute('style');
  });
}
function currentPlanName() {
  var p = sheetEl.querySelector('.plan-name');
  return p ? (p.value || '') : '';
}
function captureActive() {
  if (activeTabId === null) return;
  syncDomValues();
  var t = tabs.find(function (x) { return x.id === activeTabId; });
  if (t) { t.html = sheetEl.innerHTML; t.name = currentPlanName() || t.name; }
}
function loadTab(id) {
  var t = tabs.find(function (x) { return x.id === id; });
  if (!t) return;
  sheetEl.innerHTML = t.html;
  activeTabId = id;
  renderTabs();
}
function switchTab(id) {
  if (id === activeTabId) return;
  captureActive();
  loadTab(id);
}
function tabLabel(name) { return name && name.trim() ? name.trim() : 'Untitled'; }
function renderTabs() {
  var bar = document.getElementById('tabsBar');
  if (tabs.length <= 1) { bar.innerHTML = ''; return; }  // hide bar when only one sheet
  bar.innerHTML = '';
  tabs.forEach(function (t) {
    var name = (t.id === activeTabId) ? (currentPlanName() || t.name) : t.name;
    var el = document.createElement('div');
    el.className = 'tab' + (t.id === activeTabId ? ' active' : '');
    el.innerHTML = '<span class="tab-name">' + tabLabel(name).replace(/</g, '&lt;') + '</span>'
      + '<span class="tab-close" title="Close">&times;</span>';
    el.querySelector('.tab-name').addEventListener('click', function () { switchTab(t.id); });
    el.querySelector('.tab-close').addEventListener('click', function (e) { e.stopPropagation(); closeTab(t.id); });
    bar.appendChild(el);
  });
}
function duplicateSheet() {
  captureActive();
  var t = tabs.find(function (x) { return x.id === activeTabId; });
  if (!t) return;
  var copyId = ++tabSeq;
  var copy = {
    id: copyId, name: 'Budget-Friendly Coverage', html: t.html,
    calc: {
      tax: (t.calc ? t.calc.tax : ''),
      voucher: (t.calc ? t.calc.voucher : ''),
      prices: Object.assign({}, t.calc ? t.calc.prices : {}),
      voucherBreakdown: (t.calc && t.calc.voucherBreakdown ? t.calc.voucherBreakdown.slice() : []),
      voucherAmount: (t.calc ? (t.calc.voucherAmount || 0) : 0)
    }
  };
  tabs.push(copy);
  loadTab(copyId);
  // rename the plan on the new copy
  var planEl = sheetEl.querySelector('.plan-name');
  if (planEl) { planEl.value = 'Budget-Friendly Coverage'; planEl.dispatchEvent(new Event('input', { bubbles: true })); }
  renderTabs();
}
function closeTab(id) {
  if (tabs.length <= 1) return;
  var idx = tabs.findIndex(function (x) { return x.id === id; });
  if (idx === -1) return;
  var wasActive = (id === activeTabId);
  tabs.splice(idx, 1);
  if (wasActive) {
    var next = tabs[Math.max(0, idx - 1)];
    loadTab(next.id);
  } else {
    renderTabs();
  }
}
// initialize first tab from the initial sheet content
(function initTabs() {
  tabSeq = 1;
  activeTabId = 1;
  syncDomValues();
  tabs.push({ id: 1, name: currentPlanName() || 'Plan 1', html: sheetEl.innerHTML, calc: { tax: '', voucher: '', prices: {}, voucherBreakdown: [], voucherAmount: 0 } });
  renderTabs();
})();

// ---- PWA: register service worker (offline support) ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/cs-sw.js', { scope: '/customization-sheet' }).catch(function () { });
  });
}

// ---------- Date ----------
function todayStr() {
  var d = new Date();
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;   // yyyy-mm-dd for the native input
}
function setDisplayDate(yyyy_mm_dd) {
  var parts = yyyy_mm_dd.split('-');
  document.getElementById('custDate').value = parts[1] + '/' + parts[2] + '/' + parts[0]; // mm/dd/yyyy
}
function openDatePicker() {
  var picker = document.getElementById('custDatePicker');
  if (!picker.value) picker.value = todayStr();
  // always make sure a date is shown right away (works even if the calendar can't open)
  if (!document.getElementById('custDate').value) { setDisplayDate(picker.value); }
  // try to open the native calendar so the user can change the day
  try {
    if (picker.showPicker) { picker.showPicker(); return; }
  } catch (e) { /* some embedded views block showPicker; the date above is already set */ }
  try { picker.focus(); picker.click(); } catch (e) { }
}
document.getElementById('custDatePicker').addEventListener('change', function () {
  if (!this.value) { return; }
  setDisplayDate(this.value);
});

// ---------- Signature ----------
var sigCanvas, sigCtx, sigDrawing = false, sigHasInk = false;
function openSignature() {
  document.getElementById('sigBg').classList.add('show');
  setTimeout(initSignature, 30);
}
function closeSignature() { document.getElementById('sigBg').classList.remove('show'); }
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal-bg')) {
    e.target.classList.remove('show');
  }
});
function initSignature() {
  sigCanvas = document.getElementById('sigCanvas');
  // match internal resolution to displayed size for crisp lines
  var rect = sigCanvas.getBoundingClientRect();
  sigCanvas.width = rect.width;
  sigCanvas.height = rect.height;
  sigCtx = sigCanvas.getContext('2d');
  sigCtx.lineWidth = 2.2; sigCtx.lineCap = 'round'; sigCtx.lineJoin = 'round'; sigCtx.strokeStyle = '#10233f';
  sigHasInk = false;
  // load existing signature back if present
  var img = document.getElementById('sigImg');
  if (img.src && document.getElementById('sigPad').classList.contains('signed')) {
    var im = new Image();
    im.onload = function () { sigCtx.drawImage(im, 0, 0, sigCanvas.width, sigCanvas.height); };
    im.src = img.src;
  }
}
function sigPos(e) {
  var r = sigCanvas.getBoundingClientRect();
  var p = e.touches ? e.touches[0] : e;
  return { x: p.clientX - r.left, y: p.clientY - r.top };
}
function sigStart(e) { e.preventDefault(); sigDrawing = true; var p = sigPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); }
function sigMove(e) { if (!sigDrawing) return; e.preventDefault(); var p = sigPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); sigHasInk = true; }
function sigEnd(e) { sigDrawing = false; }
document.addEventListener('DOMContentLoaded', function () { });
document.getElementById('sigCanvas').addEventListener('mousedown', sigStart);
document.getElementById('sigCanvas').addEventListener('mousemove', sigMove);
document.addEventListener('mouseup', sigEnd);
document.getElementById('sigCanvas').addEventListener('touchstart', sigStart, { passive: false });
document.getElementById('sigCanvas').addEventListener('touchmove', sigMove, { passive: false });
document.getElementById('sigCanvas').addEventListener('touchend', sigEnd);
function clearSignature() { if (sigCtx) sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height); sigHasInk = false; }
function saveSignature() {
  if (!sigHasInk) { closeSignature(); return; }
  var data = sigCanvas.toDataURL('image/png');
  var img = document.getElementById('sigImg');
  img.src = data;
  document.getElementById('sigPad').classList.add('signed');
  closeSignature();
}