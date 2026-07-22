(function () {
    "use strict";

    var DETECTION_TYPES = [
        { key: "hidden", label: "Hidden" },
        { key: "lead", label: "Lead" },
        { key: "flying", label: "Flying" }
    ];

    var LEVEL_RE = /Level\s*(\d+)([AB])?(\+)?\s*(\(([^)]*)\))?/g;

    var loadStatusEl = document.getElementById("loadStatus");
    var tableFrameEl = document.getElementById("tableFrame");
    var tableBodyEl = document.getElementById("towersBody");
    var filterInputEl = document.getElementById("towerFilter");
    var resetRowsBtn = document.getElementById("resetRowsBtn");
    var headerCells = document.querySelectorAll("th[data-sort]");

    var rows = [];
    var sortKey = "name";
    var sortDir = 1;
    var removedNames = {};

    function parseDetection(text) {
        if (!text) return [];
        var segments = [];
        var match;
        LEVEL_RE.lastIndex = 0;
        while ((match = LEVEL_RE.exec(text))) {
            segments.push({
                level: parseInt(match[1], 10),
                path: match[2] || null,
                plus: !!match[3],
                qualifier: match[5] || null
            });
        }
        return segments;
    }

    function minLevel(segments) {
        if (!segments.length) return null;
        var min = segments[0].level;
        for (var i = 1; i < segments.length; i++) {
            if (segments[i].level < min) min = segments[i].level;
        }
        return min;
    }

    function primarySegment(segments) {
        if (!segments.length) return null;
        var best = segments[0];
        for (var i = 1; i < segments.length; i++) {
            if (segments[i].level < best.level) best = segments[i];
        }
        return best;
    }

    function statAtLevel(levels, level, field) {
        for (var i = 0; i < levels.length; i++) {
            if (levels[i].Level === level) return levels[i][field];
        }
        return null;
    }

    function maxLevelEntry(levels) {
        if (!levels || !levels.length) return null;
        var max = levels[0];
        for (var i = 1; i < levels.length; i++) {
            if (levels[i].Level > max.Level) max = levels[i];
        }
        return max;
    }

    function formatNumber(value) {
        return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
    }

    function renderCell(td, segments) {
        td.textContent = "";
        if (!segments.length) {
            var dash = document.createElement("span");
            dash.className = "no-detect";
            dash.textContent = "—";
            td.appendChild(dash);
            return;
        }
        segments.forEach(function (seg) {
            var badge = document.createElement("div");
            badge.className = "level-badge";

            var main = document.createElement("span");
            main.className = "level-badge-main";
            main.textContent = "Lvl " + seg.level + (seg.plus ? "+" : "");
            badge.appendChild(main);

            if (seg.path) {
                var path = document.createElement("sup");
                path.className = "level-badge-path";
                path.textContent = seg.path;
                badge.appendChild(path);
            }

            if (seg.qualifier) {
                var qualifier = document.createElement("span");
                qualifier.className = "level-badge-qualifier";
                qualifier.textContent = seg.qualifier;
                badge.appendChild(qualifier);
            }

            td.appendChild(badge);
        });
    }

    function renderSegmentValueCell(td, segments, valueKey) {
        td.textContent = "";
        if (!segments.length) {
            var dash = document.createElement("span");
            dash.className = "no-detect";
            dash.textContent = "—";
            td.appendChild(dash);
            return;
        }
        segments.forEach(function (seg) {
            var row = document.createElement("div");
            row.className = "level-badge";
            var value = seg[valueKey];
            row.textContent = value == null ? "?" : formatNumber(value);
            td.appendChild(row);
        });
    }

    function buildRows(statsData) {
        return Object.keys(statsData).map(function (name) {
            var entry = statsData[name] || {};
            var detections = entry.detections || {};
            var levels = entry.levels || [];
            var parsed = {};
            DETECTION_TYPES.forEach(function (type) {
                var segments = parseDetection(detections[type.key]);
                segments.forEach(function (seg) {
                    seg.price = statAtLevel(levels, seg.level, "Total Price");
                    seg.dps = statAtLevel(levels, seg.level, "DPS");
                });
                parsed[type.key] = segments;
            });
            var topLevel = maxLevelEntry(levels);
            return {
                name: name,
                detections: parsed
            };
        });
    }

    function compareRows(a, b) {
        if (sortKey === "name") {
            return sortDir * a.name.localeCompare(b.name);
        }

        var aValue, bValue;
        var parts = sortKey.split("-");
        var type = parts[0];
        var metric = parts[1];

        if (sortKey === "dps") {
            aValue = a.dps;
            bValue = b.dps;
        } else if (metric === "dps" || metric === "price") {
            var aSeg = primarySegment(a.detections[type]);
            var bSeg = primarySegment(b.detections[type]);
            aValue = aSeg ? aSeg[metric] : null;
            bValue = bSeg ? bSeg[metric] : null;
        } else {
            aValue = minLevel(a.detections[sortKey]);
            bValue = minLevel(b.detections[sortKey]);
        }

        // Rows with no value for the current sort column always sink to the
        // bottom, regardless of sort direction — flipping direction should
        // reorder actual values, not surface "no detection" rows first.
        var aMissing = aValue == null;
        var bMissing = bValue == null;
        if (aMissing && bMissing) return a.name.localeCompare(b.name);
        if (aMissing) return 1;
        if (bMissing) return -1;

        var result = (aValue - bValue) * sortDir;
        return result === 0 ? a.name.localeCompare(b.name) : result;
    }

    function renderTable() {
        var filterText = filterInputEl.value.trim().toLowerCase();
        var filtered = rows.filter(function (row) {
            return !removedNames[row.name] && row.name.toLowerCase().indexOf(filterText) !== -1;
        });
        filtered.sort(compareRows);

        tableBodyEl.textContent = "";

        if (!filtered.length) {
            var emptyRow = document.createElement("tr");
            var emptyCell = document.createElement("td");
            emptyCell.colSpan = 2 + DETECTION_TYPES.length * 3;
            emptyCell.className = "status-msg";
            emptyCell.textContent = "No towers match \"" + filterInputEl.value + "\".";
            emptyRow.appendChild(emptyCell);
            tableBodyEl.appendChild(emptyRow);
            return;
        }

        filtered.forEach(function (row) {
            var tr = document.createElement("tr");

            var removeCell = document.createElement("td");
            removeCell.className = "remove-cell";
            var removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "remove-btn";
            removeBtn.title = "Remove " + row.name + " from the table";
            removeBtn.textContent = "✕";
            removeBtn.addEventListener("click", function () {
                removedNames[row.name] = true;
                renderTable();
            });
            removeCell.appendChild(removeBtn);
            tr.appendChild(removeCell);

            var nameCell = document.createElement("td");
            nameCell.textContent = row.name;
            tr.appendChild(nameCell);

            DETECTION_TYPES.forEach(function (type) {
                var groupClass = "col-" + type.key;

                var levelTd = document.createElement("td");
                levelTd.className = groupClass;
                renderCell(levelTd, row.detections[type.key]);
                tr.appendChild(levelTd);

                var dpsTd = document.createElement("td");
                dpsTd.className = "numeric-cell " + groupClass;
                renderSegmentValueCell(dpsTd, row.detections[type.key], "dps");
                tr.appendChild(dpsTd);

                var priceTd = document.createElement("td");
                priceTd.className = "numeric-cell " + groupClass;
                renderSegmentValueCell(priceTd, row.detections[type.key], "price");
                tr.appendChild(priceTd);
            });

            tableBodyEl.appendChild(tr);
        });
    }

    function updateHeaderIndicators() {
        headerCells.forEach(function (th) {
            th.classList.remove("sort-asc", "sort-desc");
            if (th.getAttribute("data-sort") === sortKey) {
                th.classList.add(sortDir === 1 ? "sort-asc" : "sort-desc");
            }
        });
    }

    function onHeaderClick(event) {
        var key = event.currentTarget.getAttribute("data-sort");
        if (sortKey === key) {
            sortDir = -sortDir;
        } else {
            sortKey = key;
            sortDir = 1;
        }
        updateHeaderIndicators();
        renderTable();
    }

    headerCells.forEach(function (th) {
        th.addEventListener("click", onHeaderClick);
    });
    filterInputEl.addEventListener("input", renderTable);
    resetRowsBtn.addEventListener("click", function () {
        removedNames = {};
        renderTable();
    });

    fetch("../data/tds_stats.json")
        .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then(function (statsData) {
            rows = buildRows(statsData);
            loadStatusEl.style.display = "none";
            tableFrameEl.style.display = "";
            updateHeaderIndicators();
            renderTable();
        })
        .catch(function (err) {
            loadStatusEl.textContent = "Error loading tds_stats.json: " + (err.message || "network error");
        });
})();
