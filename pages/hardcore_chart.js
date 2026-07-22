(function () {
  "use strict";

  var SERIES = [
    { key: "total",  label: "Total HP",  color: "#2a78d6" },
    { key: "hidden", label: "Hidden HP", color: "#008300" },
    { key: "flying", label: "Flying HP", color: "#e87ba4" },
    { key: "ghost",  label: "Ghost HP",  color: "#eda100" },
    { key: "lead",   label: "Lead HP",   color: "#1baf7a" }
  ];

  var tableFrameEl = document.getElementById("tableFrame");
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

  // ---- Derive the 5 wave-by-wave series from the raw JSON -----------------
  function computeSeries(data) {
    var enemyMap = {};
    (data.enemies || []).forEach(function (e) {
      enemyMap[e.Enemy] = {
        hp: toNumber(e["Base Health (Hardcore)"]),
        hidden: isYes(e.Hidden),
        flying: isYes(e.Flying),
        ghost: isYes(e.Ghost),
        lead: isYes(e.Lead)
      };
    });

    var rows = (data.waves || []).map(function (w) {
      var totals = { wave: w.wave, total: 0, hidden: 0, flying: 0, ghost: 0, lead: 0 };
      (w.enemies || []).forEach(function (entry) {
        var info = enemyMap[entry.enemy];
        if (!info) {
          console.warn("Unknown enemy in hardcore_enemies:", entry.enemy);
          return;
        }
        var contribution = entry.count * info.hp;
        totals.total += contribution;
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

  // ---- Legend ---------------------------------------------------------------
  function renderLegend(legendEl) {
    legendEl.textContent = "";
    SERIES.forEach(function (s) {
      var item = document.createElement("div");
      item.className = "legend-item";

      var key = document.createElement("span");
      key.className = "legend-key";
      key.style.background = s.color;

      var name = document.createElement("span");
      name.textContent = s.label;

      item.appendChild(key);
      item.appendChild(name);
      legendEl.appendChild(item);
    });
  }

  // ---- Number formatting (English thousands separator) -----------------------
  var fmt = new Intl.NumberFormat("en-US");

  // ---- Chart rendering (hand-rolled SVG, no external deps) ------------------
  var NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs) {
    var node = document.createElementNS(NS, tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  var WAVE_SPLIT = 25; // last wave of the 1st half (charts + tables)
  var margin = { top: 16, right: 16, bottom: 32, left: 64 };
  var W = 900, H = 460;
  var plotW = W - margin.left - margin.right;
  var plotH = H - margin.top - margin.bottom;
  var LOG_FLOOR = 1; // values <= 0 are anchored here on the log scale (no enemies of that type)

  // ---- One chart = one independent card (its own legend, its own log-scale
  // toggle, its own SVG) ---------------------------------------------------
  function createChartCard(idSuffix, waveMin, waveMax) {
    var loadStatusEl = document.getElementById("loadStatus" + idSuffix);
    var chartFrameEl = document.getElementById("chartFrame" + idSuffix);
    var legendEl = document.getElementById("legend" + idSuffix);
    var toggleBtn = document.getElementById("toggleView" + idSuffix);
    var logScaleToggle = document.getElementById("logScaleToggle" + idSuffix);
    var svg = document.getElementById("chart" + idSuffix);

    var chartRows = [];
    var xScale, yScale;
    var logScale = false;

    function renderChart(rows) {
      chartRows = rows;
      svg.textContent = "";

      var waveCount = waveMax - waveMin + 1;
      var maxTotal = rows.reduce(function (m, r) { return Math.max(m, r.total); }, 0);
      var yMax = maxTotal > 0 ? maxTotal : 1;

      xScale = function (wave) {
        return margin.left + ((wave - waveMin) / (waveCount - 1)) * plotW;
      };

      if (logScale) {
        var logMax = Math.log10(yMax);
        yScale = function (value) {
          var v = Math.log10(Math.max(value, LOG_FLOOR));
          return margin.top + plotH - (v / logMax) * plotH;
        };
      } else {
        yScale = function (value) {
          return margin.top + plotH - (value / yMax) * plotH;
        };
      }

      // Gridlines + y ticks
      var yTickValues = [];
      if (logScale) {
        for (var p = 0; Math.pow(10, p) <= yMax; p++) yTickValues.push(Math.pow(10, p));
        if (yTickValues[yTickValues.length - 1] !== yMax) yTickValues.push(yMax);
      } else {
        var tickCount = 5;
        for (var i = 0; i <= tickCount; i++) yTickValues.push((yMax / tickCount) * i);
      }
      yTickValues.forEach(function (v) {
        var y = yScale(v);
        svg.appendChild(el("line", {
          x1: margin.left, x2: margin.left + plotW, y1: y, y2: y,
          class: v === 0 ? "baseline" : "gridline"
        }));
        var label = el("text", {
          x: margin.left - 8, y: y + 4, "text-anchor": "end", class: "axis-label"
        });
        label.textContent = fmt.format(Math.round(v));
        svg.appendChild(label);
      });
      if (logScale) {
        svg.appendChild(el("line", {
          x1: margin.left, x2: margin.left + plotW, y1: margin.top + plotH, y2: margin.top + plotH,
          class: "baseline"
        }));
      }

      // X ticks: first and last wave of the range, plus every multiple of 5
      var xTicks = [];
      for (var wv = waveMin; wv <= waveMax; wv++) {
        if (wv === waveMin || wv === waveMax || wv % 5 === 0) xTicks.push(wv);
      }
      xTicks.forEach(function (wv) {
        var x = xScale(wv);
        var label = el("text", {
          x: x, y: margin.top + plotH + 20, "text-anchor": "middle", class: "axis-label"
        });
        label.textContent = wv;
        svg.appendChild(label);
      });

      var xAxisLabel = el("text", {
        x: margin.left + plotW / 2, y: H - 2, "text-anchor": "middle", class: "axis-label"
      });
      xAxisLabel.textContent = "Wave";
      svg.appendChild(xAxisLabel);

      // Series lines + end dots
      SERIES.forEach(function (s) {
        var color = s.color;
        var d = rows.map(function (r, idx) {
          var cmd = idx === 0 ? "M" : "L";
          return cmd + xScale(r.wave).toFixed(2) + "," + yScale(r[s.key]).toFixed(2);
        }).join(" ");

        svg.appendChild(el("path", { d: d, class: "series-line", stroke: color }));

        var last = rows[rows.length - 1];
        svg.appendChild(el("circle", {
          cx: xScale(last.wave), cy: yScale(last[s.key]), r: 4,
          fill: color, class: "end-dot"
        }));
      });

      // Hover layer: crosshair + per-series dots + tooltip
      var crosshair = el("line", { class: "crosshair", y1: margin.top, y2: margin.top + plotH, visibility: "hidden" });
      svg.appendChild(crosshair);

      var hoverDots = SERIES.map(function (s) {
        var dot = el("circle", { r: 4, fill: s.color, class: "hover-dot", visibility: "hidden" });
        svg.appendChild(dot);
        return dot;
      });

      var hitLayer = el("rect", {
        x: margin.left, y: margin.top, width: plotW, height: plotH,
        fill: "transparent"
      });
      svg.appendChild(hitLayer);

      function waveFromClientX(clientX) {
        var rect = svg.getBoundingClientRect();
        var scaleX = W / rect.width;
        var localX = (clientX - rect.left) * scaleX;
        var ratio = (localX - margin.left) / plotW;
        var wave = Math.round(ratio * (waveCount - 1)) + waveMin;
        return Math.min(waveMax, Math.max(waveMin, wave));
      }

      function showAt(wave) {
        var row = rows[wave - waveMin];
        if (!row) return;

        var x = xScale(wave);
        crosshair.setAttribute("x1", x);
        crosshair.setAttribute("x2", x);
        crosshair.setAttribute("visibility", "visible");

        SERIES.forEach(function (s, i) {
          hoverDots[i].setAttribute("cx", x);
          hoverDots[i].setAttribute("cy", yScale(row[s.key]));
          hoverDots[i].setAttribute("visibility", "visible");
        });

        tooltipEl.textContent = "";
        var waveLine = document.createElement("div");
        waveLine.className = "tooltip-wave";
        waveLine.textContent = "Wave " + row.wave;
        tooltipEl.appendChild(waveLine);

        SERIES.slice().sort(function (a, b) { return row[b.key] - row[a.key]; }).forEach(function (s) {
          var line = document.createElement("div");
          line.className = "tooltip-row";

          var key = document.createElement("span");
          key.className = "tooltip-key";
          key.style.background = s.color;

          var name = document.createElement("span");
          name.className = "tooltip-name";
          name.textContent = s.label;

          var value = document.createElement("span");
          value.className = "tooltip-value";
          value.textContent = fmt.format(Math.round(row[s.key]));

          line.appendChild(key);
          line.appendChild(name);
          line.appendChild(value);
          tooltipEl.appendChild(line);
        });

        var rect = svg.getBoundingClientRect();
        var scaleX = rect.width / W;
        var pxX = rect.left + x * scaleX + window.scrollX;
        var pxY = rect.top + margin.top * scaleX + window.scrollY;
        tooltipEl.style.left = (pxX + 14) + "px";
        tooltipEl.style.top = pxY + "px";
        tooltipEl.style.visibility = "visible";
      }

      function hide() {
        crosshair.setAttribute("visibility", "hidden");
        hoverDots.forEach(function (d) { d.setAttribute("visibility", "hidden"); });
        tooltipEl.style.visibility = "hidden";
      }

      hitLayer.addEventListener("pointermove", function (evt) {
        showAt(waveFromClientX(evt.clientX));
      });
      hitLayer.addEventListener("pointerleave", hide);
    }

    logScaleToggle.addEventListener("change", function () {
      logScale = logScaleToggle.checked;
      renderChart(chartRows);
    });

    toggleBtn.addEventListener("click", function () {
      toggleGlobalView();
    });

    return {
      chartFrameEl: chartFrameEl,
      toggleBtn: toggleBtn,
      show: function (rows) {
        var rangeRows = rows.filter(function (r) { return r.wave >= waveMin && r.wave <= waveMax; });
        renderLegend(legendEl);
        renderChart(rangeRows);
        loadStatusEl.style.display = "none";
        chartFrameEl.style.display = "";
      },
      showError: function (message) {
        loadStatusEl.textContent = message;
      }
    };
  }

  var chartCards = [createChartCard("1", 1, WAVE_SPLIT), createChartCard("2", WAVE_SPLIT + 1, 45)];

  // ---- "Show table" button: shared across cards, toggles every chart card
  // and the shared table section together --------------------------------
  var showingTable = false;
  function toggleGlobalView() {
    showingTable = !showingTable;
    tableFrameEl.style.display = showingTable ? "" : "none";
    chartCards.forEach(function (card) {
      card.chartFrameEl.style.display = showingTable ? "none" : "";
      card.toggleBtn.textContent = showingTable ? "Show chart" : "Show table";
      card.toggleBtn.setAttribute("aria-expanded", showingTable ? "true" : "false");
    });
  }

  // ---- Table view -------------------------------------------------------
  function fillTableBody(tbodyEl, rows) {
    tbodyEl.textContent = "";
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      [r.wave, Math.round(r.total), Math.round(r.hidden), Math.round(r.flying), Math.round(r.ghost), Math.round(r.lead)]
        .forEach(function (val, i) {
          var td = document.createElement("td");
          td.textContent = i === 0 ? val : fmt.format(val);
          tr.appendChild(td);
        });
      tbodyEl.appendChild(tr);
    });
  }

  function renderTable(rows) {
    fillTableBody(tableBody1El, rows.filter(function (r) { return r.wave <= WAVE_SPLIT; }));
    fillTableBody(tableBody2El, rows.filter(function (r) { return r.wave > WAVE_SPLIT; }));
  }

  function onDataReady(data) {
    var rows = computeSeries(data);
    chartCards.forEach(function (card) { card.show(rows); });
    renderTable(rows);
  }

  fetch("../data/hardcore_data.json")
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(onDataReady)
    .catch(function (err) {
      var message = "Error loading hardcore_data.json: " + (err.message || "network error");
      chartCards.forEach(function (card) { card.showError(message); });
    });
})();
