(function () {
  "use strict";

  var BLUE = "#2a78d6";
  // Sequential blue ramp, steps 100->700 (references/palette.md in the dataviz skill).
  var SEQ_RAMP = [
    "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7",
    "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"
  ];

  var CATEGORIES = [
    { key: "hidden", label: "Hidden" },
    { key: "flying", label: "Flying" },
    { key: "ghost", label: "Ghost" },
    { key: "lead", label: "Lead" }
  ];

  // Categorical slots 1/2/3 from references/palette.md (already validated all-pairs).
  var PLAYER_MODES = [
    { key: "solo", label: "Solo", players: 1, startingCash: 900, startingCashGroup: 1000, reduction: 0, color: "#2a78d6" },
    { key: "duo", label: "Duo", players: 2, startingCash: 750, startingCashGroup: 850, reduction: 0.48, color: "#008300" },
    { key: "trio", label: "Trio", players: 3, startingCash: 600, startingCashGroup: 700, reduction: 0.45, color: "#e87ba4" }
  ];

  var tableFrameEl = document.getElementById("tableFrame");
  var cashTableFrameEl = document.getElementById("cashTableFrame");
  var tooltipEl = document.getElementById("tooltip");
  var tableBody1El = document.getElementById("tableBody1");
  var tableBody2El = document.getElementById("tableBody2");

  function isYes(value) {
    return typeof value === "string" && /yes/i.test(value);
  }

  function toNumber(value) {
    var n = parseFloat(value);
    return isNaN(n) ? 0 : n;
  }

  // ---- Wave duration model --------------------------------------------------
  // Official Hardcore Wave Timer. Waves 43 & 45 have no official timer in-game;
  // 300s is an assumed cap used only to turn their HP into a DPS estimate.
  var WAVE_TIMER_RANGES = [
    [1, 3, 15], [4, 6, 20], [7, 9, 25], [10, 13, 20], [14, 15, 25], [16, 17, 50],
    [18, 18, 35], [19, 19, 90], [20, 21, 35], [22, 25, 45], [26, 26, 20],
    [27, 27, 25], [28, 28, 30], [29, 29, 50], [30, 30, 150], [31, 32, 60],
    [33, 33, 240], [34, 34, 50], [35, 35, 60], [36, 36, 180], [37, 37, 60],
    [38, 38, 90], [39, 39, 60], [40, 40, 240], [41, 41, 90], [42, 42, 120],
    [43, 43, 300], [44, 44, 180], [45, 45, 300]
  ];
  var WAVE_TIMER_SECONDS = {};
  WAVE_TIMER_RANGES.forEach(function (range) {
    for (var w = range[0]; w <= range[1]; w++) WAVE_TIMER_SECONDS[w] = range[2];
  });

  function waveDuration(wave) {
    return WAVE_TIMER_SECONDS[wave] || 30;
  }

  // ---- Derive the base per-wave HP + kill-cash totals from the raw JSON -----
  function computeBaseRows(data) {
    var enemyMap = {};
    (data.enemies || []).forEach(function (e) {
      enemyMap[e.Enemy] = {
        hp: toNumber(e["Base Health (Hardcore)"]),
        cashOnDeath: toNumber(e["Cash on Death (Hardcore)"]),
        hidden: isYes(e.Hidden),
        flying: isYes(e.Flying),
        ghost: isYes(e.Ghost),
        lead: isYes(e.Lead)
      };
    });

    var rows = (data.waves || []).map(function (w) {
      var totals = { wave: w.wave, total: 0, hidden: 0, flying: 0, ghost: 0, lead: 0, killCash: 0 };
      (w.enemies || []).forEach(function (entry) {
        var info = enemyMap[entry.enemy];
        if (!info) {
          console.warn("Unknown enemy in hardcore_enemies:", entry.enemy);
          return;
        }
        var contribution = entry.count * info.hp;
        totals.total += contribution;
        totals.killCash += entry.count * info.cashOnDeath;
        if (info.hidden) totals.hidden += contribution;
        if (info.flying) totals.flying += contribution;
        if (info.ghost) totals.ghost += contribution;
        if (info.lead) totals.lead += contribution;
      });
      return totals;
    });

    rows.sort(function (a, b) { return a.wave - b.wave; });
    return rows;
  }

  // ---- Add duration-dependent (dps) and duration-independent (share,
  // categoriesActive) derived fields on top of the base rows ------------------
  function deriveRows(baseRows) {
    return baseRows.map(function (r) {
      var share = {};
      var categoriesActive = [];
      CATEGORIES.forEach(function (c) {
        var s = r.total > 0 ? r[c.key] / r.total : 0;
        share[c.key] = s;
        if (r[c.key] > 0) categoriesActive.push(c.label);
      });
      return {
        wave: r.wave,
        total: r.total,
        hidden: r.hidden,
        flying: r.flying,
        ghost: r.ghost,
        lead: r.lead,
        killCash: r.killCash,
        dps: r.total / waveDuration(r.wave),
        share: share,
        categoriesActive: categoriesActive
      };
    });
  }

  // ---- Cash forecast (Solo / Duo / Trio) -------------------------------
  // (325 + 50 x Waves Completed) / Players, reduced by the per-player-count
  // multiplier. No separate wave-clear bonus in Hardcore.
  function waveBonus(wave, mode) {
    var raw = (325 + 50 * wave) / mode.players;
    return raw * (1 - mode.reduction);
  }

  // Cash from clearing a wave (bonus + kill cash) only lands once that wave is
  // actually finished — so wave 1's payout is money you have going into wave 2,
  // not wave 1 itself. Each row therefore reports the PREVIOUS wave's payout;
  // wave 1's row is just the starting cash, before anything has been cleared.
  function computeCashRows(baseRows, groupBonus) {
    var cumulative = {};
    PLAYER_MODES.forEach(function (m) {
      cumulative[m.key] = groupBonus ? m.startingCashGroup : m.startingCash;
    });

    return baseRows.map(function (r, idx) {
      var prev = idx > 0 ? baseRows[idx - 1] : null;
      var row = { wave: r.wave, killCash: prev ? prev.killCash : 0, modes: {} };
      PLAYER_MODES.forEach(function (m) {
        var bonus = prev ? waveBonus(prev.wave, m) : 0;
        var earned = bonus + row.killCash;
        cumulative[m.key] += earned;
        row.modes[m.key] = { bonus: bonus, earned: earned, cumulative: cumulative[m.key] };
      });
      return row;
    });
  }

  // ---- Number formatting ------------------------------------------------
  var fmt = new Intl.NumberFormat("en-US");
  var fmtPct = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  function fmtCash(v) { return "$" + fmt.format(Math.round(v)); }

  // ---- SVG helpers --------------------------------------------------------
  var NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs) {
    var node = document.createElementNS(NS, tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function positionTooltip(svg, W, x, y) {
    var rect = svg.getBoundingClientRect();
    var scaleX = rect.width / W;
    var pxX = rect.left + x * scaleX + window.scrollX;
    var pxY = rect.top + y * scaleX + window.scrollY;
    tooltipEl.style.left = (pxX + 14) + "px";
    tooltipEl.style.top = pxY + "px";
    tooltipEl.style.visibility = "visible";
  }

  function appendTooltipRow(name, value, color) {
    var line = document.createElement("div");
    line.className = "tooltip-row";
    if (color) {
      var key = document.createElement("span");
      key.className = "tooltip-key";
      key.style.background = color;
      line.appendChild(key);
    }
    var nameEl = document.createElement("span");
    nameEl.className = "tooltip-name";
    nameEl.textContent = name;
    var valueEl = document.createElement("span");
    valueEl.className = "tooltip-value";
    valueEl.textContent = value;
    line.appendChild(nameEl);
    line.appendChild(valueEl);
    tooltipEl.appendChild(line);
  }

  // ============================================================
  // Combined "Total wave HP & cash earned" card: split into 3 wave-range
  // sections (1-25, 24-35, 34-45 — each overlapping its neighbor by 2 waves
  // so the transition between sections stays visually continuous). Each
  // section is a pair of mini-charts (bar + line) sharing the same wave axis
  // and a single synchronized hover, so one tooltip shows both DPS and cash
  // for whichever wave the pointer is over — deliberately NOT a dual-axis
  // chart (mixing $ and DPS on one y-scale is the #1 dataviz anti-pattern).
  // ============================================================
  var SECTIONS = [
    { suffix: "1", waveMin: 1, waveMax: 25 },
    { suffix: "2", waveMin: 24, waveMax: 35 },
    { suffix: "3", waveMin: 34, waveMax: 45 }
  ];
  var margin = { top: 16, right: 16, bottom: 32, left: 70 };
  var W = 900, MINI_H = 260;
  var plotW = W - margin.left - margin.right;
  var plotH = MINI_H - margin.top - margin.bottom;

  function yTicksFor(yMax) {
    var values = [];
    var tickCount = 5;
    for (var i = 0; i <= tickCount; i++) values.push((yMax / tickCount) * i);
    return values;
  }

  function makeYScale(yMax) {
    return function (value) {
      return margin.top + plotH - (value / yMax) * plotH;
    };
  }

  function renderLegend(legendEl) {
    legendEl.textContent = "";
    var item = document.createElement("div");
    item.className = "legend-item";
    var key = document.createElement("span");
    key.className = "legend-key";
    key.style.background = BLUE;
    var name = document.createElement("span");
    name.textContent = "Total wave HP";
    item.appendChild(key);
    item.appendChild(name);
    legendEl.appendChild(item);
  }

  function renderCashLegend(legendEl) {
    legendEl.textContent = "";
    PLAYER_MODES.forEach(function (m) {
      var item = document.createElement("div");
      item.className = "legend-item";
      var key = document.createElement("span");
      key.className = "legend-key";
      key.style.background = m.color;
      var name = document.createElement("span");
      name.textContent = m.label;
      item.appendChild(key);
      item.appendChild(name);
      legendEl.appendChild(item);
    });
  }

  // One section = its own coordinate system (waveMin/waveMax), its own pair
  // of mini-charts, and its own synchronized hover between that pair only.
  function createSection(def) {
    var waveMin = def.waveMin, waveMax = def.waveMax;
    var waveCount = waveMax - waveMin + 1;
    var dpsSvg = document.getElementById("chartDps" + def.suffix);
    var cashSvg = document.getElementById("chartCash" + def.suffix);

    function xScale(wave) {
      return margin.left + ((wave - waveMin) / (waveCount - 1)) * plotW;
    }
    function waveFromClientX(svg, clientX) {
      var rect = svg.getBoundingClientRect();
      var scaleX = W / rect.width;
      var localX = (clientX - rect.left) * scaleX;
      var ratio = (localX - margin.left) / plotW;
      var wave = Math.round(ratio * (waveCount - 1)) + waveMin;
      return Math.min(waveMax, Math.max(waveMin, wave));
    }

    function drawAxes(svg, yTickValues, yScale, tickLabel) {
      yTickValues.forEach(function (v) {
        var y = yScale(v);
        svg.appendChild(el("line", {
          x1: margin.left, x2: margin.left + plotW, y1: y, y2: y,
          class: v === 0 ? "baseline" : "gridline"
        }));
        var label = el("text", { x: margin.left - 8, y: y + 4, "text-anchor": "end", class: "axis-label" });
        label.textContent = tickLabel(v);
        svg.appendChild(label);
      });

      var xTicks = [];
      for (var wv = waveMin; wv <= waveMax; wv++) {
        if (wv === waveMin || wv === waveMax || wv % 5 === 0) xTicks.push(wv);
      }
      xTicks.forEach(function (wv) {
        var label = el("text", {
          x: xScale(wv), y: margin.top + plotH + 20, "text-anchor": "middle", class: "axis-label"
        });
        label.textContent = wv;
        svg.appendChild(label);
      });

      var xAxisLabel = el("text", {
        x: margin.left + plotW / 2, y: MINI_H - 2, "text-anchor": "middle", class: "axis-label"
      });
      xAxisLabel.textContent = "Wave";
      svg.appendChild(xAxisLabel);
    }

    var dpsPanelRefs = null;  // { rows, hoverBand, band }
    var cashPanelRefs = null; // { rows, crosshair, hoverDots, yScale }

    function showAt(wave, originSvg) {
      if (!dpsPanelRefs || !cashPanelRefs) return;
      var dpsRow = dpsPanelRefs.rows[wave - waveMin];
      var cashRow = cashPanelRefs.rows[wave - waveMin];
      if (!dpsRow || !cashRow) return;

      var x = xScale(wave);

      dpsPanelRefs.hoverBand.setAttribute("x", x - dpsPanelRefs.band / 2);
      dpsPanelRefs.hoverBand.setAttribute("width", dpsPanelRefs.band);
      dpsPanelRefs.hoverBand.setAttribute("visibility", "visible");

      cashPanelRefs.crosshair.setAttribute("x1", x);
      cashPanelRefs.crosshair.setAttribute("x2", x);
      cashPanelRefs.crosshair.setAttribute("visibility", "visible");
      PLAYER_MODES.forEach(function (m, i) {
        cashPanelRefs.hoverDots[i].setAttribute("cx", x);
        cashPanelRefs.hoverDots[i].setAttribute("cy", cashPanelRefs.yScale(cashRow.modes[m.key].cumulative));
        cashPanelRefs.hoverDots[i].setAttribute("visibility", "visible");
      });

      tooltipEl.textContent = "";
      var waveLine = document.createElement("div");
      waveLine.className = "tooltip-wave";
      waveLine.textContent = "Wave " + wave;
      tooltipEl.appendChild(waveLine);

      appendTooltipRow("Total wave HP", fmt.format(Math.round(dpsRow.total)), BLUE);
      PLAYER_MODES.slice().sort(function (a, b) {
        return cashRow.modes[b.key].cumulative - cashRow.modes[a.key].cumulative;
      }).forEach(function (m) {
        appendTooltipRow(m.label, fmtCash(cashRow.modes[m.key].cumulative), m.color);
      });

      positionTooltip(originSvg, W, x, margin.top);
    }

    function hideAt() {
      if (dpsPanelRefs) dpsPanelRefs.hoverBand.setAttribute("visibility", "hidden");
      if (cashPanelRefs) {
        cashPanelRefs.crosshair.setAttribute("visibility", "hidden");
        cashPanelRefs.hoverDots.forEach(function (d) { d.setAttribute("visibility", "hidden"); });
      }
      tooltipEl.style.visibility = "hidden";
    }

    function wireHitLayer(svg, hitLayer) {
      hitLayer.addEventListener("pointermove", function (evt) {
        showAt(waveFromClientX(svg, evt.clientX), svg);
      });
      hitLayer.addEventListener("pointerleave", hideAt);
    }

    function renderDpsPanel(allRows) {
      var rows = allRows.filter(function (r) { return r.wave >= waveMin && r.wave <= waveMax; });
      dpsSvg.textContent = "";

      var maxHp = rows.reduce(function (m, r) { return Math.max(m, r.total); }, 0);
      var yMax = maxHp > 0 ? maxHp : 1;
      var yScale = makeYScale(yMax);

      drawAxes(dpsSvg, yTicksFor(yMax), yScale, function (v) { return fmt.format(Math.round(v)); });

      var band = plotW / (waveCount - 1);
      var barW = Math.max(2, band * 0.6);
      var baseY = margin.top + plotH;

      rows.forEach(function (r) {
        var x = xScale(r.wave);
        var y = yScale(r.total);
        dpsSvg.appendChild(el("rect", {
          x: x - barW / 2, y: y, width: barW, height: Math.max(0, baseY - y),
          rx: 3, ry: 3, fill: BLUE, class: "bar-rect"
        }));
      });

      var hoverBand = el("rect", { class: "bar-hover", y: margin.top, height: plotH, visibility: "hidden" });
      dpsSvg.appendChild(hoverBand);

      var hitLayer = el("rect", { x: margin.left, y: margin.top, width: plotW, height: plotH, fill: "transparent" });
      dpsSvg.appendChild(hitLayer);
      wireHitLayer(dpsSvg, hitLayer);

      dpsPanelRefs = { rows: rows, hoverBand: hoverBand, band: band };
    }

    function renderCashPanel(allRows) {
      var rows = allRows.filter(function (r) { return r.wave >= waveMin && r.wave <= waveMax; });
      cashSvg.textContent = "";

      var maxCash = rows.reduce(function (m, r) {
        return PLAYER_MODES.reduce(function (mm, mode) { return Math.max(mm, r.modes[mode.key].cumulative); }, m);
      }, 0);
      var yMax = maxCash > 0 ? maxCash : 1;
      var yScale = makeYScale(yMax);

      drawAxes(cashSvg, yTicksFor(yMax), yScale, function (v) { return "$" + fmt.format(Math.round(v)); });

      PLAYER_MODES.forEach(function (m) {
        var d = rows.map(function (r, idx) {
          var cmd = idx === 0 ? "M" : "L";
          return cmd + xScale(r.wave).toFixed(2) + "," + yScale(r.modes[m.key].cumulative).toFixed(2);
        }).join(" ");
        cashSvg.appendChild(el("path", { d: d, class: "series-line", stroke: m.color }));

        var last = rows[rows.length - 1];
        cashSvg.appendChild(el("circle", {
          cx: xScale(last.wave), cy: yScale(last.modes[m.key].cumulative), r: 4,
          fill: m.color, class: "end-dot"
        }));
      });

      var crosshair = el("line", { class: "crosshair", y1: margin.top, y2: margin.top + plotH, visibility: "hidden" });
      cashSvg.appendChild(crosshair);

      var hoverDots = PLAYER_MODES.map(function (m) {
        var dot = el("circle", { r: 4, fill: m.color, class: "hover-dot", visibility: "hidden" });
        cashSvg.appendChild(dot);
        return dot;
      });

      var hitLayer = el("rect", { x: margin.left, y: margin.top, width: plotW, height: plotH, fill: "transparent" });
      cashSvg.appendChild(hitLayer);
      wireHitLayer(cashSvg, hitLayer);

      cashPanelRefs = { rows: rows, crosshair: crosshair, hoverDots: hoverDots, yScale: yScale };
    }

    return { renderDpsPanel: renderDpsPanel, renderCashPanel: renderCashPanel };
  }

  var sections = SECTIONS.map(createSection);

  // ---- Combined card wiring -------------------------------------------------
  var loadStatusCombinedEl = document.getElementById("loadStatusCombined");
  var chartFrameCombinedEl = document.getElementById("chartFrameCombined");
  var toggleViewCombinedEl = document.getElementById("toggleViewCombined");
  var groupBonusToggle = document.getElementById("groupBonusToggle");

  var dpsRows = null;
  var cashRows = null;

  function renderAllDps() {
    sections.forEach(function (s) { s.renderDpsPanel(dpsRows); });
  }
  function renderAllCash() {
    sections.forEach(function (s) { s.renderCashPanel(cashRows); });
  }

  var showingTable = false;
  function toggleGlobalView() {
    showingTable = !showingTable;
    chartFrameCombinedEl.style.display = showingTable ? "none" : "";
    tableFrameEl.style.display = showingTable ? "" : "none";
    cashTableFrameEl.style.display = showingTable ? "" : "none";
    toggleViewCombinedEl.textContent = showingTable ? "Show chart" : "Show table";
    toggleViewCombinedEl.setAttribute("aria-expanded", showingTable ? "true" : "false");
  }
  toggleViewCombinedEl.addEventListener("click", toggleGlobalView);

  groupBonusToggle.addEventListener("change", function () {
    cashRows = computeCashRows(baseRows, groupBonusToggle.checked);
    renderAllCash();
    renderCashTable(cashRows);
  });

  // ---- Table view -------------------------------------------------------
  var WAVE_SPLIT = 25;
  function fillTableBody(tbodyEl, rows) {
    tbodyEl.textContent = "";
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      [
        r.wave,
        fmt.format(Math.round(r.total)),
        fmt.format(Math.round(r.dps)),
        fmtPct.format(r.share.hidden * 100) + "%",
        fmtPct.format(r.share.flying * 100) + "%",
        fmtPct.format(r.share.ghost * 100) + "%",
        fmtPct.format(r.share.lead * 100) + "%"
      ].forEach(function (val) {
        var td = document.createElement("td");
        td.textContent = val;
        tr.appendChild(td);
      });
      var catsTd = document.createElement("td");
      catsTd.className = "categories-cell";
      catsTd.textContent = r.categoriesActive.length
        ? r.categoriesActive.join(", ") + " (" + r.categoriesActive.length + ")"
        : "None (0)";
      tr.appendChild(catsTd);
      tbodyEl.appendChild(tr);
    });
  }

  function renderTable(rows) {
    fillTableBody(tableBody1El, rows.filter(function (r) { return r.wave <= WAVE_SPLIT; }));
    fillTableBody(tableBody2El, rows.filter(function (r) { return r.wave > WAVE_SPLIT; }));
  }

  function renderCashTable(rows) {
    var tbody = document.getElementById("cashTableBody");
    tbody.textContent = "";
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      var cells = [r.wave, fmtCash(r.killCash)];
      PLAYER_MODES.forEach(function (m) { cells.push(fmtCash(r.modes[m.key].bonus)); });
      PLAYER_MODES.forEach(function (m) { cells.push(fmtCash(r.modes[m.key].cumulative)); });
      cells.forEach(function (val) {
        var td = document.createElement("td");
        td.textContent = val;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  // ============================================================
  // Heatmap: waves (columns) x Hidden/Flying/Ghost/Lead (rows)
  // Color intensity = that category's share of the wave's total HP.
  // ============================================================
  function rampColor(share) {
    var clamped = Math.max(0, Math.min(1, share));
    var idx = Math.round(clamped * (SEQ_RAMP.length - 1));
    return SEQ_RAMP[idx];
  }

  function renderHeatmapSection(def, allRows) {
    var waveMin = def.waveMin, waveMax = def.waveMax;
    var rows = allRows.filter(function (r) { return r.wave >= waveMin && r.wave <= waveMax; });
    var svg = document.getElementById("heatmap" + def.suffix);

    var cellW = 16, cellH = 24;
    var leftMargin = 68, topMargin = 6, bottomMargin = 20;
    var waveCount = rows.length;
    var gridW = waveCount * cellW;
    var gridH = CATEGORIES.length * cellH;
    var svgW = leftMargin + gridW + 8;
    var svgH = topMargin + gridH + bottomMargin;

    svg.setAttribute("viewBox", "0 0 " + svgW + " " + svgH);
    svg.textContent = "";

    CATEGORIES.forEach(function (c, rowIdx) {
      var y = topMargin + rowIdx * cellH;
      var label = el("text", {
        x: leftMargin - 8, y: y + cellH / 2 + 3, class: "heatmap-row-label"
      });
      label.textContent = c.label;
      svg.appendChild(label);

      rows.forEach(function (r, colIdx) {
        var x = leftMargin + colIdx * cellW;
        var share = r.share[c.key];
        var rect = el("rect", {
          x: x, y: y, width: cellW, height: cellH,
          fill: r[c.key] > 0 ? rampColor(share) : "#f3f3f0",
          class: "heatmap-cell"
        });
        rect.addEventListener("pointerenter", function () {
          tooltipEl.textContent = "";
          var waveLine = document.createElement("div");
          waveLine.className = "tooltip-wave";
          waveLine.textContent = "Wave " + r.wave + " — " + c.label;
          tooltipEl.appendChild(waveLine);
          [
            [c.label + " HP", fmt.format(Math.round(r[c.key]))],
            ["Share of wave HP", fmtPct.format(share * 100) + "%"],
            ["All categories", r.categoriesActive.length ? r.categoriesActive.join(", ") : "None"]
          ].forEach(function (pair) {
            appendTooltipRow(pair[0], pair[1]);
          });
          positionTooltip(svg, svgW, x + cellW, y);
        });
        rect.addEventListener("pointerleave", function () {
          tooltipEl.style.visibility = "hidden";
        });
        svg.appendChild(rect);
      });
    });

    rows.forEach(function (r, colIdx) {
      if (r.wave !== waveMin && r.wave !== waveMax && r.wave % 5 !== 0) return;
      var x = leftMargin + colIdx * cellW + cellW / 2;
      var label = el("text", {
        x: x, y: topMargin + gridH + 14, class: "heatmap-col-label"
      });
      label.textContent = r.wave;
      svg.appendChild(label);
    });
  }

  function renderHeatmap(rows) {
    SECTIONS.forEach(function (def) { renderHeatmapSection(def, rows); });
  }

  // ---- Wire it up ---------------------------------------------------------
  var baseRows = null;

  fetch("../data/hardcore_data.json")
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      baseRows = computeBaseRows(data);
      dpsRows = deriveRows(baseRows);
      cashRows = computeCashRows(baseRows, groupBonusToggle.checked);

      renderLegend(document.getElementById("legendDps"));
      renderCashLegend(document.getElementById("legendCash"));
      renderAllDps();
      renderAllCash();
      loadStatusCombinedEl.style.display = "none";
      chartFrameCombinedEl.style.display = "";

      renderTable(dpsRows);
      renderCashTable(cashRows);
      renderHeatmap(dpsRows);
    })
    .catch(function (err) {
      var message = "Error loading hardcore_data.json: " + (err.message || "network error");
      loadStatusCombinedEl.textContent = message;
    });
})();
