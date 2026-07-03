/**
 * Platzi Composer Pro - Main Controller
 * SpellCheck IA + Platzi Composer Tools
 */

(function() {
    "use strict";

    var csInterface = new CSInterface();
    var engine = null;
    var aiAnalyzer = null;

    var actionLog = [];
    var LOCAL_VERSION = "1.0.0";
    var REMOTE_VERSION_URL = "https://raw.githubusercontent.com/DanielGutierrezB/Platzi-Composer-Pro/main/VERSION";

    var DEFAULTS = {
        "ease-out": 33, "ease-in": 10, "cont-zoom-pct": 10,
        "mp-x": 35, "mp-y": 0,
        "cp-dur": 20, "cp-size": 600,
        "zoom-dur": 20, "zoom-pct": 130,
        "hl-round": 20
    };

    var state = {
        layers: [],
        layerResults: {},
        currentLayerIndex: -1,
        compName: "",
        analyzing: false,
        ollamaConnected: false,
        view: "list",
        settings: {
            aiProvider: "ollama",
            aiModel: "mistral-small3.1:latest"
        }
    };

    // ─── Action log ──────────────────────────────────────────────
    function logAction(action, params) {
        actionLog.push({
            action: action,
            timestamp: new Date().toISOString(),
            params: params == null ? null : params
        });
    }

    function callHost(fn, cb) {
        logAction("callHost", fn);
        _evalHost(fn, cb, false);
    }

    // Ejecuta una función del host. Si el host devuelve vacío o "EvalScript error"
    // (típicamente porque host/index.jsx no se cargó), recarga el host y reintenta 1 vez.
    function _evalHost(fn, cb, isRetry) {
        csInterface.evalScript(fn, function(result) {
            var raw = (result == null) ? "" : ("" + result);
            var clean = raw.replace(/\s+/g, "");

            if (clean === "" || raw === "EvalScript error.") {
                if (!isRetry) {
                    var hostPath = csInterface.getSystemPath(SystemPath.EXTENSION) + "/host/index.jsx";
                    csInterface.evalScript("$.evalFile(\"" + hostPath.replace(/\\/g, "/") + "\")", function() {
                        _evalHost(fn, cb, true);
                    });
                    return;
                }
                showToast("El host de AE no respondió. Recargá el panel con el botón ⟳ y reintentá.", "error");
                return;
            }

            try {
                var d = JSON.parse(raw);
                if (d.error) { showToast(d.error, "error"); return; }
                showToast("Listo", "success");
                if (cb) cb(d);
            } catch(e) {
                showToast("Respuesta inválida del host: " + raw.substring(0, 80), "error");
            }
        });
    }

    // ─── Init ────────────────────────────────────────────────────
    function init() {
        var extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);

        // Force reload host script on panel refresh
        var hostPath = csInterface.getSystemPath(SystemPath.EXTENSION) + "/host/index.jsx";
        csInterface.evalScript("$.evalFile(\"" + hostPath.replace(/\\/g, "/") + "\")");

        engine = new SpellCheckEngine({ extensionPath: extensionPath, uiLanguage: "es" });
        aiAnalyzer = new AIAnalyzer();

        loadLocalVersion(extensionPath);
        loadSavedSettings();
        loadDefaults();
        bindEvents();
        bindColorPalette();
        refreshProviderUI();
        updateAIStatus();

        // Check for updates on startup (non-blocking)
        setTimeout(checkForUpdateOnStartup, 2000);
    }

    function checkForUpdateOnStartup() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", REMOTE_VERSION_URL + "?_=" + Date.now(), true);
        xhr.timeout = 5000;
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                var remote = (xhr.responseText || "").replace(/\s+/g, "");
                if (remote && compareVersions(remote, LOCAL_VERSION) > 0) {
                    showToast("⬆️ Actualizaci\u00F3n disponible: v" + remote + " (actual: v" + LOCAL_VERSION + ")", "info");
                    var btn = document.getElementById("btn-update");
                    if (btn) btn.classList.add("has-update");
                }
            }
        };
        xhr.onerror = function() {};
        xhr.ontimeout = function() {};
        try { xhr.send(); } catch(e) {}
    }

    function loadLocalVersion(extensionPath) {
        var badge = document.getElementById("version-badge");

        try {
            var url = "file://" + extensionPath + "/VERSION";
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url + "?_=" + Date.now(), true);
            xhr.onload = function() {
                if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
                    var txt = (xhr.responseText || "").replace(/\s+/g, "");
                    if (txt) LOCAL_VERSION = txt;
                }
                if (badge) badge.textContent = "v" + LOCAL_VERSION;
            };
            xhr.onerror = function() {
                if (badge) badge.textContent = "v" + LOCAL_VERSION;
            };
            xhr.send();
        } catch(e) {
            if (badge) badge.textContent = "v" + LOCAL_VERSION;
        }
    }

    function loadSavedSettings() {
        var provider = localStorage.getItem("sc_provider") || "ollama";
        var model = localStorage.getItem("sc_model") || "";

        state.settings.aiProvider = provider;
        aiAnalyzer.setProvider(provider);

        ["anthropic", "openai", "google"].forEach(function(p) {
            var k = localStorage.getItem("sc_key_" + p) || "";
            aiAnalyzer.setApiKey(p, k);
        });

        aiAnalyzer.setOllamaUrl(localStorage.getItem("sc_ollama_url") || "http://localhost:11434");

        if (model) {
            state.settings.aiModel = model;
            aiAnalyzer.setModel(model);
        } else {
            state.settings.aiModel = AIAnalyzer.PROVIDERS[provider].defaultModel;
            aiAnalyzer.setModel(state.settings.aiModel);
        }
    }

    function saveDefaults(keys) {
        keys.forEach(function(k) {
            var el = document.getElementById(k);
            if (el) localStorage.setItem("pc_def_" + k, el.value);
        });
        showToast("Defaults guardados", "success");
    }

    function resetDefaults(keys) {
        keys.forEach(function(k) {
            var el = document.getElementById(k);
            var saved = localStorage.getItem("pc_def_" + k);
            var val = saved !== null ? saved : DEFAULTS[k];
            if (el && val !== undefined) el.value = val;
        });
        showToast("Defaults restaurados", "info");
    }

    function loadDefaults() {
        Object.keys(DEFAULTS).forEach(function(k) {
            var el = document.getElementById(k);
            var saved = localStorage.getItem("pc_def_" + k);
            if (el && saved !== null) el.value = saved;
        });
    }

    function bindEvents() {
        on("btn-analyze", "click", startAnalysis);
        on("btn-settings", "click", toggleSettings);
        on("btn-save-api-key", "click", saveApiKey);
        on("btn-back", "click", showListView);
        on("btn-ollama-refresh", "click", checkOllamaConnection);
        on("btn-save-log", "click", saveActionLog);
        on("btn-update", "click", checkForUpdate);

        var saveBtns = document.querySelectorAll(".btn-save-def");
        for (var i = 0; i < saveBtns.length; i++) {
            (function(btn) {
                btn.addEventListener("click", function() {
                    var keys = (btn.getAttribute("data-keys") || "").split(",").filter(Boolean);
                    saveDefaults(keys);
                });
            })(saveBtns[i]);
        }
        var resetBtns = document.querySelectorAll(".btn-reset-def");
        for (var j = 0; j < resetBtns.length; j++) {
            (function(btn) {
                btn.addEventListener("click", function() {
                    var keys = (btn.getAttribute("data-keys") || "").split(",").filter(Boolean);
                    resetDefaults(keys);
                });
            })(resetBtns[j]);
        }

        on("ai-provider-select", "change", function() {
            var prov = this.value;
            state.settings.aiProvider = prov;
            aiAnalyzer.setProvider(prov);
            state.settings.aiModel = AIAnalyzer.PROVIDERS[prov].defaultModel;
            aiAnalyzer.setModel(state.settings.aiModel);
            localStorage.setItem("sc_provider", prov);
            localStorage.setItem("sc_model", state.settings.aiModel);
            refreshProviderUI();
            updateAIStatus();
            if (prov === "ollama") checkOllamaConnection();
        });

        on("ai-model-select", "change", function() {
            state.settings.aiModel = this.value;
            aiAnalyzer.setModel(this.value);
            localStorage.setItem("sc_model", this.value);
            updateAIStatus();
        });

        bindCollapsibles();
        bindToolEvents();
    }

    function on(id, evt, fn) {
        var el = document.getElementById(id);
        if (el) el.addEventListener(evt, fn);
    }

    // ─── Main analysis flow ──────────────────────────────────────
    function startAnalysis() {
        if (state.analyzing) return;

        var isOllama = state.settings.aiProvider === "ollama";
        if (isOllama && !state.ollamaConnected) {
            showToast("Ollama no está conectado. Ejecuta 'ollama serve' en tu terminal.", "error");
            toggleSettings();
            return;
        }
        if (!isOllama && !aiAnalyzer.isConfigured()) {
            showToast("Configura tu API Key de " + AIAnalyzer.PROVIDERS[state.settings.aiProvider].name + " en ajustes.", "error");
            toggleSettings();
            return;
        }

        logAction("analysisStart", {
            provider: state.settings.aiProvider,
            model: state.settings.aiModel
        });

        state.analyzing = true;
        state.layerResults = {};
        state.currentLayerIndex = -1;
        state.view = "list";

        expandSpellCheck();
        hideElement("layer-detail");
        hideElement("empty-state");
        showElement("progress-bar");
        setProgress(0, "Leyendo composición...");

        var btnAnalyze = document.getElementById("btn-analyze");
        if (btnAnalyze) { btnAnalyze.disabled = true; btnAnalyze.classList.add("btn-disabled"); }

        csInterface.evalScript("getActiveCompTextLayers()", function(result) {
            try {
                var data = JSON.parse(result);
                if (data.error) {
                    finishAnalysis();
                    showToast(data.error, "error");
                    return;
                }

                state.compName = data.compName;
                state.layers = data.layers || [];

                document.getElementById("comp-name").textContent = data.compName;
                document.getElementById("layer-count").textContent = state.layers.length + " capa(s)";

                if (state.layers.length === 0) {
                    finishAnalysis();
                    showToast("No se encontraron capas de texto.", "info");
                    return;
                }

                showElement("layers-section");
                renderLayerList();
                analyzeLayerSequential(0);

            } catch(e) {
                finishAnalysis();
                showToast("Error al leer composición: " + e.message, "error");
            }
        });
    }

    function analyzeLayerSequential(idx) {
        if (idx >= state.layers.length) {
            finishAnalysis();
            return;
        }

        var layer = state.layers[idx];
        var total = state.layers.length;
        var pct = Math.round(((idx) / total) * 100);
        setProgress(pct, "Analizando capa " + (idx + 1) + "/" + total + ": " + layer.name);

        var allLayerTexts = state.layers.map(function(l) { return { name: l.name, text: l.text }; });

        aiAnalyzer.analyze(layer.text, {
            layerName: layer.name,
            allLayerTexts: allLayerTexts,
            detectedLang: engine.detectLanguage(layer.text),
            detectedCapStyle: engine.detectCapStyle ? engine.detectCapStyle(layer.text) : "auto"
        }, function(result) {
            state.layerResults[idx] = result;
            updateLayerItemStatus(idx, result);

            var nextPct = Math.round(((idx + 1) / total) * 100);
            setProgress(nextPct, null);

            analyzeLayerSequential(idx + 1);
        });
    }

    function finishAnalysis() {
        state.analyzing = false;
        hideElement("progress-bar");

        var btnAnalyze = document.getElementById("btn-analyze");
        if (btnAnalyze) { btnAnalyze.disabled = false; btnAnalyze.classList.remove("btn-disabled"); }

        if (state.layers.length > 0) {
            updateLayersSummary();
            var totalIssues = 0;
            state.layers.forEach(function(_, i) {
                var r = state.layerResults[i];
                if (r && r.issues) totalIssues += r.issues.length;
            });
            logAction("analysisComplete", {
                compName: state.compName,
                layerCount: state.layers.length,
                totalIssues: totalIssues
            });
            showToast("Análisis completado — " + state.layers.length + " capa(s)", "success");
        }
    }

    // ─── Layer list ──────────────────────────────────────────────
    function renderLayerList() {
        var container = document.getElementById("layer-list");
        container.innerHTML = "";

        state.layers.forEach(function(layer, idx) {
            var el = document.createElement("div");
            el.className = "layer-item";
            el.id = "layer-item-" + idx;

            var preview = layer.text.substring(0, 60).replace(/\n/g, " ");
            if (layer.text.length > 60) preview += "...";

            el.innerHTML =
                '<div class="layer-item-left">' +
                    '<div class="layer-name">' + esc(layer.name) + '</div>' +
                    '<div class="layer-preview">' + esc(preview) + '</div>' +
                '</div>' +
                '<div class="layer-item-right">' +
                    '<div class="layer-badge" id="badge-' + idx + '">' +
                        '<span class="badge badge-pending">...</span>' +
                    '</div>' +
                '</div>';

            el.addEventListener("click", function() {
                if (state.layerResults[idx]) showLayerDetail(idx);
            });
            container.appendChild(el);
        });
    }

    function updateLayerItemStatus(idx, result) {
        var badge = document.getElementById("badge-" + idx);
        if (!badge) return;

        if (result.error) {
            badge.innerHTML = '<span class="badge badge-error" title="' + esc(result.error) + '">!</span>';
            return;
        }

        var score = result.score || 0;
        var issueCount = (result.issues || []).length;

        if (issueCount === 0 || score >= 95) {
            badge.innerHTML = '<span class="badge badge-ok">✓</span>';
        } else if (score >= 70) {
            badge.innerHTML = '<span class="badge badge-warning">' + issueCount + '</span>';
        } else {
            badge.innerHTML = '<span class="badge badge-error">' + issueCount + '</span>';
        }

        var item = document.getElementById("layer-item-" + idx);
        if (item) item.classList.add("layer-item-ready");
    }

    function updateLayersSummary() {
        var el = document.getElementById("layers-summary");
        if (!el) return;

        var totalIssues = 0;
        var ok = 0;
        state.layers.forEach(function(_, idx) {
            var r = state.layerResults[idx];
            if (r && !r.error) {
                var issues = (r.issues || []).length;
                totalIssues += issues;
                if (issues === 0) ok++;
            }
        });

        if (totalIssues === 0) {
            el.innerHTML = '<span class="summary-ok">Todo perfecto</span>';
        } else {
            el.innerHTML = '<span class="summary-issues">' + totalIssues + ' problema(s) en ' + (state.layers.length - ok) + ' capa(s)</span>';
        }
    }

    // ─── Layer detail view ───────────────────────────────────────
    function showLayerDetail(idx) {
        state.currentLayerIndex = idx;
        state.view = "detail";

        var layer = state.layers[idx];
        var result = state.layerResults[idx];

        hideElement("layers-section");
        hideElement("empty-state");
        showElement("layer-detail");
        hideElement("fix-panel");

        document.getElementById("detail-layer-name").textContent = layer.name;

        renderAISummary(result, layer.text);
        renderTextPreview(layer.text, result.issues || []);
        renderIssuesList(idx, result.issues || []);
    }

    function showListView() {
        state.view = "list";
        state.currentLayerIndex = -1;
        hideElement("layer-detail");
        showElement("layers-section");
    }

    function renderAISummary(result, currentText) {
        var panel = document.getElementById("ai-summary-panel");
        if (!panel) return;

        if (result.error) {
            panel.classList.remove("hidden");
            panel.innerHTML = '<div class="ai-error-msg">Error: ' + esc(result.error) + '</div>';
            return;
        }

        panel.classList.remove("hidden");
        var score = result.score || 0;
        var scoreColor = score >= 80 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--error)";

        var html =
            '<div class="ai-score-ring" style="--score-color: ' + scoreColor + '">' +
                '<span class="ai-score-num">' + score + '</span>' +
                '<span class="ai-score-label">/ 100</span>' +
            '</div>' +
            '<div class="ai-summary-text">' +
                '<div class="ai-summary-msg">' + esc(result.summary || "Sin resumen") + '</div>';

        if (result.suggestedText && result.suggestedText !== currentText) {
            html +=
                '<div class="ai-suggested-block">' +
                    '<div class="ai-suggested-label">Texto sugerido:</div>' +
                    '<div class="ai-suggested-text">' + esc(result.suggestedText) + '</div>' +
                    '<button id="btn-apply-suggested" class="btn btn-ai-apply">Aplicar corrección</button>' +
                '</div>';
        }

        html += '</div>';
        panel.innerHTML = html;

        var btnApply = document.getElementById("btn-apply-suggested");
        if (btnApply) {
            btnApply.addEventListener("click", function() {
                applySuggestedText(result.suggestedText);
            });
        }
    }

    function renderTextPreview(text, issues) {
        var preview = document.getElementById("text-preview");
        if (!preview) return;

        if (!issues || issues.length === 0) {
            preview.innerHTML = '<span class="text-ok">' + esc(text) + '</span>';
            return;
        }

        var wordsToHighlight = {};
        issues.forEach(function(iss) {
            var word = iss.original || iss.word;
            if (word && word.length > 0 && (iss.severity === "error" || iss.severity === "warning")) {
                var cls = iss.severity === "error" ? "highlight-error" : "highlight-warning";
                if (!wordsToHighlight[word] || cls === "highlight-error") {
                    wordsToHighlight[word] = cls;
                }
            }
        });

        var html = esc(text);
        Object.keys(wordsToHighlight).sort(function(a, b) { return b.length - a.length; }).forEach(function(word) {
            var escaped = esc(word);
            var regex = new RegExp(escRegex(escaped), "g");
            html = html.replace(regex, '<span class="' + wordsToHighlight[word] + '">' + escaped + '</span>');
        });

        preview.innerHTML = html.replace(/\n/g, "<br>");
    }

    function renderIssuesList(layerIdx, issues) {
        var container = document.getElementById("issues-list");
        container.innerHTML = "";

        if (!issues || issues.length === 0) {
            container.innerHTML =
                '<div class="no-issues">' +
                    '<div class="no-issues-icon">&#10003;</div>' +
                    '<div>Sin problemas encontrados</div>' +
                '</div>';
            return;
        }

        issues.forEach(function(issue, idx) {
            var el = document.createElement("div");
            el.className = "issue-item issue-" + (issue.severity || "info");

            var iconMap = {
                spelling: "Aa", grammar: "Gr", capitalization: "AB",
                punctuation: ".,", style: "St", coherence: "Co"
            };
            var icon = iconMap[issue.type] || "?";

            var original = issue.original || issue.word || "";
            var suggestion = issue.suggestion || "";

            var suggestionHtml = suggestion
                ? '<span class="issue-suggestion">→ ' + esc(suggestion) + '</span>' : "";

            el.innerHTML =
                '<div class="issue-icon issue-icon-' + (issue.type || "grammar") + '">' + icon + '</div>' +
                '<div class="issue-content">' +
                    '<div class="issue-header-row">' +
                        '<div class="issue-word">' + esc(original) + ' ' + suggestionHtml + '</div>' +
                    '</div>' +
                    '<div class="issue-message">' + esc(issue.explanation || issue.message || "") + '</div>' +
                    (issue.context ? '<span class="issue-context-tag">' + esc(issue.context) + '</span>' : '') +
                '</div>' +
                '<div class="issue-severity-badge severity-' + (issue.severity || "info") + '">' +
                    (issue.severity || "i").charAt(0).toUpperCase() +
                '</div>';

            el.addEventListener("click", function() { selectIssue(layerIdx, idx); });
            container.appendChild(el);
        });
    }

    // ─── Issue selection and fixing ──────────────────────────────
    function selectIssue(layerIdx, issueIdx) {
        var result = state.layerResults[layerIdx];
        if (!result || !result.issues) return;
        var issue = result.issues[issueIdx];
        if (!issue) return;

        document.querySelectorAll(".issue-item").forEach(function(el, i) {
            el.classList.toggle("active", i === issueIdx);
        });

        showElement("fix-panel");
        document.getElementById("fix-word").textContent = issue.original || issue.word || "(vacío)";

        var fixExp = document.getElementById("fix-explanation");
        if (fixExp) {
            var expText = issue.explanation || issue.message || "";
            if (issue.context) expText += " [" + issue.context + "]";
            fixExp.textContent = expText;
            fixExp.style.display = expText ? "block" : "none";
        }

        var fixInput = document.getElementById("fix-input");
        fixInput.value = issue.suggestion || "";

        var fixSugs = document.getElementById("fix-suggestions");
        fixSugs.innerHTML = "";
        if (issue.suggestion) {
            var btn = document.createElement("button");
            btn.className = "suggestion-btn";
            btn.textContent = issue.suggestion;
            btn.addEventListener("click", function() { fixInput.value = issue.suggestion; });
            fixSugs.appendChild(btn);
        }

        document.getElementById("btn-apply-fix").onclick = function() {
            applyFix(layerIdx, issueIdx, fixInput.value);
        };
        document.getElementById("btn-ignore").onclick = function() {
            ignoreIssue(layerIdx, issueIdx);
        };
    }

    function applyFix(layerIdx, issueIdx, replacement) {
        var result = state.layerResults[layerIdx];
        if (!result || !result.issues) return;
        var issue = result.issues[issueIdx];
        if (!issue || !replacement) return;

        var layer = state.layers[layerIdx];
        var aeIdx = layer.index;
        var original = issue.original || issue.word || "";

        if (original && original.length > 0) {
            logAction("fixApplied", {
                layerName: layer.name,
                original: original,
                replacement: replacement,
                issueType: issue.type || null
            });
            csInterface.evalScript(
                'replaceInLayer(' + aeIdx + ', "' + escExtend(original) + '", "' + escExtend(replacement) + '")',
                function(r) { handleFixResult(layerIdx, issueIdx, r); }
            );
        }
    }

    function applySuggestedText(suggestedText) {
        if (state.currentLayerIndex < 0) return;
        var layer = state.layers[state.currentLayerIndex];

        logAction("fixApplied", {
            layerName: layer.name,
            mode: "fullSuggestedText",
            replacement: suggestedText
        });

        csInterface.evalScript(
            'setLayerText(' + layer.index + ', "' + escExtend(suggestedText) + '")',
            function(result) {
                try {
                    var data = JSON.parse(result);
                    if (data.error) { showToast("Error: " + data.error, "error"); return; }

                    state.layers[state.currentLayerIndex].text = suggestedText;

                    var aiResult = state.layerResults[state.currentLayerIndex];
                    if (aiResult) {
                        aiResult.issues = [];
                        aiResult.suggestedText = suggestedText;
                        aiResult.score = 100;
                        aiResult.summary = "Texto corregido aplicado";
                    }

                    showLayerDetail(state.currentLayerIndex);
                    updateLayerItemStatus(state.currentLayerIndex, aiResult || { score: 100, issues: [] });
                    updateLayersSummary();
                    showToast("Texto corregido aplicado", "success");
                } catch(e) {
                    showToast("Error al aplicar texto.", "error");
                }
            }
        );
    }

    function handleFixResult(layerIdx, issueIdx, result) {
        try {
            var data = JSON.parse(result);
            if (data.error) { showToast("Error: " + data.error, "error"); return; }

            state.layers[layerIdx].text = data.newText || state.layers[layerIdx].text;

            var aiResult = state.layerResults[layerIdx];
            if (aiResult && aiResult.issues) {
                aiResult.issues.splice(issueIdx, 1);
            }

            hideElement("fix-panel");
            showLayerDetail(layerIdx);
            updateLayerItemStatus(layerIdx, aiResult || { score: 100, issues: [] });
            updateLayersSummary();
            showToast("Corrección aplicada", "success");
        } catch(e) {
            showToast("Error al aplicar corrección.", "error");
        }
    }

    function ignoreIssue(layerIdx, issueIdx) {
        var aiResult = state.layerResults[layerIdx];
        if (aiResult && aiResult.issues) {
            aiResult.issues.splice(issueIdx, 1);
        }

        hideElement("fix-panel");
        showLayerDetail(layerIdx);
        updateLayerItemStatus(layerIdx, aiResult || { score: 100, issues: [] });
        updateLayersSummary();
    }

    // ─── Provider UI ─────────────────────────────────────────────
    function refreshProviderUI() {
        var prov = state.settings.aiProvider;
        var info = AIAnalyzer.PROVIDERS[prov];
        var isOllama = prov === "ollama";

        var provSelect = document.getElementById("ai-provider-select");
        if (provSelect) provSelect.value = prov;

        var apiKeyGroup = document.getElementById("api-key-group");
        if (apiKeyGroup) apiKeyGroup.style.display = isOllama ? "none" : "";

        var ollamaStatus = document.getElementById("ollama-status");
        if (ollamaStatus) ollamaStatus.classList.toggle("hidden", !isOllama);

        var keyInput = document.getElementById("api-key-input");
        if (keyInput && !isOllama) {
            keyInput.placeholder = info.keyPlaceholder;
            keyInput.value = aiAnalyzer.keys[prov] || "";
        }

        var modelSelect = document.getElementById("ai-model-select");
        if (modelSelect) {
            modelSelect.innerHTML = "";
            info.models.forEach(function(m) {
                var opt = document.createElement("option");
                opt.value = m.id;
                opt.textContent = m.label;
                modelSelect.appendChild(opt);
            });
            modelSelect.value = state.settings.aiModel;
        }

        var statusEl = document.getElementById("api-key-status");
        if (statusEl) {
            var keys = aiAnalyzer.keys;
            var parts = [];
            parts.push('<span class="' + (state.ollamaConnected ? "key-ok" : "key-missing") + (isOllama ? " key-active" : "") + '">Ollama ' + (state.ollamaConnected ? "✓" : "✗") + '</span>');
            ["google", "anthropic", "openai"].forEach(function(p) {
                var name = AIAnalyzer.PROVIDERS[p].name;
                var hasKey = keys[p] && keys[p].length > 5;
                var cls = hasKey ? "key-ok" : "key-missing";
                var icon = hasKey ? "✓" : "✗";
                var highlight = p === prov ? " key-active" : "";
                parts.push('<span class="' + cls + highlight + '">' + name + ' ' + icon + '</span>');
            });
            statusEl.innerHTML = parts.join("  ");
        }

        if (isOllama) checkOllamaConnection();
    }

    function checkOllamaConnection() {
        var statusText = document.getElementById("ollama-status-text");
        if (statusText) statusText.innerHTML = '<span class="ollama-checking">Verificando conexión...</span>';

        aiAnalyzer.fetchOllamaModels(function(err, models) {
            if (err || !models || models.length === 0) {
                state.ollamaConnected = false;
                if (statusText) statusText.innerHTML = '<span class="ollama-disconnected">✗ Ollama no disponible. Ejecuta: ollama serve</span>';
                updateAIStatus();
                return;
            }

            state.ollamaConnected = true;
            if (statusText) statusText.innerHTML = '<span class="ollama-connected">✓ Conectado — ' + models.length + ' modelo(s)</span>';

            var modelSelect = document.getElementById("ai-model-select");
            if (modelSelect && state.settings.aiProvider === "ollama") {
                modelSelect.innerHTML = "";
                models.forEach(function(m) {
                    var opt = document.createElement("option");
                    opt.value = m.id;
                    opt.textContent = m.label;
                    modelSelect.appendChild(opt);
                });

                var saved = state.settings.aiModel;
                var found = models.some(function(m) { return m.id === saved; });
                if (found) {
                    modelSelect.value = saved;
                } else if (models.length > 0) {
                    modelSelect.value = models[0].id;
                    state.settings.aiModel = models[0].id;
                    aiAnalyzer.setModel(models[0].id);
                    localStorage.setItem("sc_model", models[0].id);
                }
            }

            updateAIStatus();
        });
    }

    function saveApiKey() {
        var prov = state.settings.aiProvider;
        if (prov === "ollama") return;

        var input = document.getElementById("api-key-input");
        var key = input ? input.value.trim() : "";

        aiAnalyzer.setApiKey(prov, key);
        localStorage.setItem("sc_key_" + prov, key);

        refreshProviderUI();
        updateAIStatus();
        showToast(key
            ? "API Key de " + AIAnalyzer.PROVIDERS[prov].name + " guardada"
            : "API Key de " + AIAnalyzer.PROVIDERS[prov].name + " eliminada", "success");
    }

    function updateAIStatus() {
        var el = document.getElementById("ai-status");
        var btn = document.getElementById("btn-analyze");
        var info = AIAnalyzer.PROVIDERS[state.settings.aiProvider];
        var isOllama = state.settings.aiProvider === "ollama";

        if (isOllama) {
            var modelName = state.settings.aiModel || "mistral-small3.1";
            if (state.ollamaConnected) {
                if (el) el.innerHTML = '<span class="ai-connected">Ollama · ' + modelName + '</span>';
                if (btn) btn.classList.remove("btn-disabled");
            } else {
                if (el) el.innerHTML = '<span class="ai-disconnected">Ollama · desconectado</span>';
                if (btn) btn.classList.add("btn-disabled");
            }
        } else if (aiAnalyzer.isConfigured()) {
            var modelShort = state.settings.aiModel.split("-").slice(0, 2).join(" ");
            if (el) el.innerHTML = '<span class="ai-connected">' + info.name + ' · ' + modelShort + '</span>';
            if (btn) btn.classList.remove("btn-disabled");
        } else {
            if (el) el.innerHTML = '<span class="ai-disconnected">' + info.name + ' · sin key</span>';
            if (btn) btn.classList.add("btn-disabled");
        }
    }

    function toggleSettings() {
        var panel = document.getElementById("settings-panel");
        if (panel) {
            panel.classList.toggle("hidden");
            if (!panel.classList.contains("hidden")) refreshProviderUI();
        }
    }

    // ─── Save Action Log ─────────────────────────────────────────
    function saveActionLog() {
        if (actionLog.length === 0) {
            showToast("No hay acciones registradas todavía.", "info");
            return;
        }
        var payload = JSON.stringify(actionLog);
        var escaped = escExtend(payload);
        csInterface.evalScript('saveLogToFile("' + escaped + '")', function(result) {
            try {
                var data = JSON.parse(result);
                if (data.error) { showToast("Error guardando log: " + data.error, "error"); return; }
                showToast("Log guardado en " + (data.path || "Desktop"), "success");
            } catch(e) {
                showToast("Error al guardar log.", "error");
            }
        });
    }

    // ─── Update Check ────────────────────────────────────────────
    function compareVersions(a, b) {
        var pa = String(a).split(".").map(function(n) { return parseInt(n, 10) || 0; });
        var pb = String(b).split(".").map(function(n) { return parseInt(n, 10) || 0; });
        var len = Math.max(pa.length, pb.length);
        for (var i = 0; i < len; i++) {
            var na = pa[i] || 0;
            var nb = pb[i] || 0;
            if (na > nb) return 1;
            if (na < nb) return -1;
        }
        return 0;
    }

    function checkForUpdate() {
        showToast("Verificando actualización...", "info");

        var xhr = new XMLHttpRequest();
        xhr.open("GET", REMOTE_VERSION_URL + "?_=" + Date.now(), true);
        xhr.timeout = 8000;
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                var remote = (xhr.responseText || "").replace(/\s+/g, "");
                if (!remote) { location.reload(); return; }
                if (compareVersions(remote, LOCAL_VERSION) > 0) {
                    showToast("v" + remote + " disponible — descargando...", "info");
                    _doGitHubUpdate(remote);
                } else {
                    showToast("Ya estás en la última versión ✓", "info");
                    location.reload();
                }
            } else {
                location.reload();
            }
        };
        xhr.onerror = function() { location.reload(); };
        xhr.ontimeout = function() { location.reload(); };
        try { xhr.send(); } catch(e) { location.reload(); }
    }

    // ─── GitHub Hybrid Updater (git pull → ZIP fallback) ─────────
    function _doGitHubUpdate(remoteVersion) {
        var fs, path, cp, https, os;
        try {
            fs = require("fs");
            path = require("path");
            cp = require("child_process");
            https = require("https");
            os = require("os");
        } catch(e) {
            showToast("Error: Node modules no disponibles", "error");
            return;
        }

        var extPath = csInterface.getSystemPath(SystemPath.EXTENSION).replace(/^file:\/{0,3}/, "");
        try { extPath = decodeURIComponent(extPath); } catch(_) {}

        var gitDir = path.join(extPath, ".git");
        var hasGit = fs.existsSync(gitDir);

        if (hasGit) {
            // Try git pull first
            showToast("Git pull...", "info");
            cp.execFile("git", ["pull", "--ff-only", "origin", "main"], 
                { cwd: extPath, timeout: 60000 },
                function(err, stdout, stderr) {
                    if (err) {
                        showToast("Git pull falló, intentando ZIP...", "info");
                        _downloadZipUpdate(extPath, remoteVersion, fs, path, cp, https, os);
                        return;
                    }
                    showToast("✅ Actualizado a v" + remoteVersion, "info");
                    setTimeout(function() { location.reload(); }, 800);
                }
            );
        } else {
            _downloadZipUpdate(extPath, remoteVersion, fs, path, cp, https, os);
        }
    }

    function _downloadZipUpdate(extPath, remoteVersion, fs, path, cp, https, os) {
        var zipUrl = "https://api.github.com/repos/DanielGutierrezB/Platzi-Composer-Pro/zipball/main";
        var zipPath = path.join(os.tmpdir(), "platzi-composer-update-" + Date.now() + ".zip");
        var extractDir = path.join(os.tmpdir(), "platzi-composer-extract-" + Date.now());

        // Preflight: ¿podemos escribir en la carpeta de la extensión?
        try {
            var wtest = path.join(extPath, ".__update_wtest");
            fs.writeFileSync(wtest, "ok");
            fs.unlinkSync(wtest);
        } catch(e) {
            showToast("❌ Sin permiso de escritura en la carpeta de la extensión. Reinstalá el .zxp.", "error");
            return;
        }

        showToast("Descargando update...", "info");

        _httpsDownload(zipUrl, zipPath, https, function(dlErr) {
            if (dlErr) {
                showToast("Error descargando: " + dlErr.message, "error");
                return;
            }

            showToast("Instalando...", "info");
            try { fs.mkdirSync(extractDir, { recursive: true }); } catch(_) {}

            // Extract ZIP
            var isWin = process.platform === "win32";
            var cmd, args;
            if (isWin) {
                cmd = "powershell";
                args = ["-NoProfile", "-NonInteractive", "-Command",
                    "Expand-Archive -LiteralPath '" + zipPath + "' -DestinationPath '" + extractDir + "' -Force"];
            } else {
                cmd = "unzip";
                args = ["-q", zipPath, "-d", extractDir];
            }

            cp.execFile(cmd, args, { timeout: 120000 }, function(exErr) {
                if (exErr) {
                    showToast("Error extrayendo: " + exErr.message, "error");
                    try { fs.unlinkSync(zipPath); } catch(_) {}
                    return;
                }

                // Find extracted root folder
                var entries = fs.readdirSync(extractDir);
                var extractedRoot = null;
                for (var i = 0; i < entries.length; i++) {
                    var cand = path.join(extractDir, entries[i]);
                    try {
                        if (fs.statSync(cand).isDirectory()) { extractedRoot = cand; break; }
                    } catch(_) {}
                }

                if (!extractedRoot) {
                    showToast("Error: no se encontró carpeta en ZIP", "error");
                    return;
                }

                // Copy files (skip .git, node_modules) — track failures
                var copyResult = { copied: 0, failed: 0, errors: [] };
                _copyDirSync(extractedRoot, extPath, "", fs, path, copyResult);

                // Cleanup
                try { fs.unlinkSync(zipPath); } catch(_) {}
                try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch(_) {
                    try { cp.execSync("rm -rf \"" + extractDir + "\""); } catch(_) {}
                }

                // Verificar: leer el VERSION realmente escrito en disco
                var installedVersion = "";
                try {
                    installedVersion = (fs.readFileSync(path.join(extPath, "VERSION"), "utf8") || "").replace(/\s+/g, "");
                } catch(_) {}

                if (copyResult.failed > 0 || installedVersion !== remoteVersion) {
                    var emsg = "❌ Update incompleto";
                    if (copyResult.failed > 0) emsg += " — " + copyResult.failed + " archivo(s) no se pudieron escribir (permisos). Reinstalá el .zxp.";
                    else emsg += " — VERSION en disco quedó en " + (installedVersion || "?") + ". Reinstalá el .zxp.";
                    showToast(emsg, "error");
                    return;
                }

                showToast("✅ Actualizado a v" + remoteVersion + " — recargando...", "info");
                setTimeout(function() { location.reload(); }, 1000);
            });
        });
    }

    function _httpsDownload(url, destPath, https, callback, redirects) {
        if (!redirects) redirects = 5;
        var urlMod = require("url");
        var fs = require("fs");
        var parsed = urlMod.parse(url);
        var httpMod = (parsed.protocol === "http:") ? require("http") : https;

        var opts = {
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: parsed.path,
            method: "GET",
            headers: { "User-Agent": "Platzi-Composer-Pro-Updater/1.0" },
            timeout: 120000
        };

        var req = httpMod.request(opts, function(res) {
            if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && redirects > 0) {
                return _httpsDownload(res.headers.location, destPath, https, callback, redirects - 1);
            }
            if (res.statusCode !== 200) {
                return callback(new Error("HTTP " + res.statusCode));
            }
            var out = fs.createWriteStream(destPath);
            res.pipe(out);
            out.on("finish", function() { out.close(function() { callback(null); }); });
            out.on("error", callback);
            res.on("error", callback);
        });
        req.on("timeout", function() { req.destroy(); callback(new Error("Timeout")); });
        req.on("error", callback);
        req.end();
    }

    function _copyDirSync(src, dest, relBase, fs, path, result) {
        if (!result) result = { copied: 0, failed: 0, errors: [] };
        var SKIP = [".git", "node_modules", ".DS_Store"];
        var items;
        try { items = fs.readdirSync(src); }
        catch(e) { result.failed++; result.errors.push(relBase + ": readdir " + e.message); return result; }
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (SKIP.indexOf(item) >= 0) continue;
            var srcP = path.join(src, item);
            var destP = path.join(dest, item);
            var stat;
            try { stat = fs.lstatSync(srcP); } catch(_) { continue; }
            if (stat.isSymbolicLink()) continue;
            if (stat.isDirectory()) {
                try { if (!fs.existsSync(destP)) fs.mkdirSync(destP, { recursive: true }); }
                catch(e) { result.failed++; result.errors.push(relBase + "/" + item + ": mkdir " + e.message); }
                _copyDirSync(srcP, destP, relBase + "/" + item, fs, path, result);
            } else {
                try { fs.copyFileSync(srcP, destP); result.copied++; }
                catch(e) { result.failed++; result.errors.push(relBase + "/" + item + ": " + e.message); }
            }
        }
        return result;
    }

    // ─── UI helpers ──────────────────────────────────────────────
    function setProgress(pct, text) {
        var fill = document.getElementById("progress-fill");
        var label = document.getElementById("progress-text");
        if (fill) fill.style.width = Math.min(pct, 100) + "%";
        if (label && text !== null && text !== undefined) label.textContent = text;
    }

    function showToast(msg, type) {
        var toast = document.getElementById("toast");
        if (!toast) return;
        toast.textContent = msg;
        toast.className = "toast toast-" + type + " show";
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(function() { toast.classList.remove("show"); }, 3500);
    }

    function showElement(id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove("hidden");
    }
    function hideElement(id) {
        var el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    }

    function esc(str) {
        if (!str) return "";
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function escRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    function escExtend(str) {
        if (!str) return "";
        return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
    }

    // ─── Collapsible sections (accordion) ───────────────────────
    function bindCollapsibles() {
        // Tab bar navigation
        var tabs = document.querySelectorAll(".tools-tab");
        var headers = document.querySelectorAll(".tool-card-header");

        function activateTab(toolName) {
            // Update tab buttons
            for (var t = 0; t < tabs.length; t++) {
                tabs[t].classList.toggle("active", tabs[t].getAttribute("data-tool") === toolName);
            }
            // Show/hide tool card bodies
            for (var h = 0; h < headers.length; h++) {
                var body = headers[h].nextElementSibling;
                var isCurrent = headers[h].getAttribute("data-tool") === toolName;
                if (body) body.classList.toggle("hidden", !isCurrent);
            }
        }

        // Tab click handlers
        for (var i = 0; i < tabs.length; i++) {
            (function(tab) {
                tab.addEventListener("click", function() {
                    activateTab(tab.getAttribute("data-tool"));
                });
            })(tabs[i]);
        }

        // Also keep old header click working (fallback)
        for (var j = 0; j < headers.length; j++) {
            (function(hdr) {
                hdr.addEventListener("click", function() {
                    activateTab(hdr.getAttribute("data-tool"));
                });
            })(headers[j]);
        }

        // Default: activate first tab (zoomer is open by default)
        var defaultOpen = document.querySelector(".tool-card-body:not(.hidden)");
        if (defaultOpen) {
            var parentHeader = defaultOpen.previousElementSibling;
            if (parentHeader) activateTab(parentHeader.getAttribute("data-tool"));
        } else {
            activateTab("zoomer");
        }
    }

    function expandSpellCheck() {
        var tabs = document.querySelectorAll(".tools-tab");
        var headers = document.querySelectorAll(".tool-card-header");
        for (var t = 0; t < tabs.length; t++) {
            tabs[t].classList.toggle("active", tabs[t].getAttribute("data-tool") === "spellcheck");
        }
        for (var h = 0; h < headers.length; h++) {
            var body = headers[h].nextElementSibling;
            var isSpellCheck = headers[h].getAttribute("data-tool") === "spellcheck";
            if (body) body.classList.toggle("hidden", !isSpellCheck);
        }
    }

    // ─── Platzi Composer tool event handlers ─────────────────────
    function bindToolEvents() {
        function easeOut() { return parseFloat(document.getElementById("ease-out").value) || 33; }
        function easeIn()  { return parseFloat(document.getElementById("ease-in").value) || 100; }

        // Shift+Click: if shift is held OR checkbox is checked → animate = true
        function shouldAnimate(checkboxId, evt) {
            var cb = document.getElementById(checkboxId);
            return (evt && evt.shiftKey) || (cb && cb.checked);
        }

        // Shift+Click → In/Out · Ctrl+Click → In · Shift+Ctrl+Click → Out
        function hlCreateWithModifiers(createFn, animFn, e) {
            var eo = easeOut(), ei = easeIn();
            logAction("callHost", createFn);
            csInterface.evalScript(createFn, function(result) {
                try {
                    var d = JSON.parse(result);
                    if (d.error) { showToast(d.error, "error"); return; }
                } catch(ex) {
                    showToast("Error: " + ex.message, "error");
                    return;
                }
                var mode = null;
                if (e.shiftKey && e.altKey) mode = "out";
                else if (e.altKey) mode = "in";
                else if (e.shiftKey) mode = "inout";
                if (mode) {
                    callHost(animFn + "(\"" + mode + "\"," + eo + "," + ei + ")");
                } else {
                    showToast("Listo", "success");
                }
            });
        }

        // Highlighter — Create per type (modifiers trigger animation)
        document.getElementById("btn-hl-create").addEventListener("click", function(e) {
            var eo = document.getElementById("ease-out").value;
            var ei = document.getElementById("ease-in").value;
            csInterface.evalScript("pcCreateHighlighter()", function(res) {
                try { if (JSON.parse(res).error) { showToast(JSON.parse(res).error,"error"); return; } } catch(x){}
                if (e.shiftKey && (e.altKey)) { callHost("pcHighlighterAnimate(\"out\","+eo+","+ei+")"); }
                else if (e.altKey) { callHost("pcHighlighterAnimate(\"in\","+eo+","+ei+")"); }
                else if (e.shiftKey) { callHost("pcHighlighterAnimate(\"inout\","+eo+","+ei+")"); }
            });
        });
        on("btn-hl-flip",           "click", function()  { callHost("pcFlipHorizontal()"); });
        document.getElementById("btn-line-create").addEventListener("click", function(e) {
            var eo = document.getElementById("ease-out").value;
            var ei = document.getElementById("ease-in").value;
            var style = document.getElementById("sel-line-style").value;
            var glow = document.getElementById("chk-line-glow").checked;
            var shift = e.shiftKey, alt = e.altKey;
            csInterface.evalScript("pcCreateLineHighlighter('" + style + "', " + glow + ")", function(res) {
                try { if (JSON.parse(res).error) { showToast(JSON.parse(res).error,"error"); return; } } catch(x){}
                if (shift && alt) { callHost("pcLineHighlighterAnimate(\"out\","+eo+","+ei+")"); }
                else if (alt) { callHost("pcLineHighlighterAnimate(\"in\","+eo+","+ei+")"); }
                else if (shift) { callHost("pcLineHighlighterAnimate(\"inout\","+eo+","+ei+")"); }
            });
        });
        // chk-line-glow: no change handler needed, value is read on Create click
        document.getElementById("btn-focus-create").addEventListener("click", function(e) {
            var eo = document.getElementById("ease-out").value;
            var ei = document.getElementById("ease-in").value;
            csInterface.evalScript("pcCreateFocusMask()", function(res) {
                try { if (JSON.parse(res).error) { showToast(JSON.parse(res).error,"error"); return; } } catch(x){}
                if (e.shiftKey && (e.altKey)) { callHost("pcFocusMaskAnimate(\"out\","+eo+","+ei+")"); }
                else if (e.altKey) { callHost("pcFocusMaskAnimate(\"in\","+eo+","+ei+")"); }
                else if (e.shiftKey) { callHost("pcFocusMaskAnimate(\"inout\","+eo+","+ei+")"); }
            });
        });
        document.getElementById("btn-zoom-focus-create").addEventListener("click", function() {
            var blur = document.getElementById("zf-blur").value || 25;
            var sf = 150;
            var eo = document.getElementById("ease-out").value || 33;
            var ei = document.getElementById("ease-in").value || 100;
            callHost("pcCreateZoomFocus(" + blur + "," + sf + "," + eo + "," + ei + ")");
        });

        // Highlight Box
        document.getElementById("btn-box-create").addEventListener("click", function(e) {
            var eo = document.getElementById("ease-out").value;
            var ei = document.getElementById("ease-in").value;
            var glow = document.getElementById("chk-box-glow").checked;
            var rnd = parseFloat(document.getElementById("hl-round").value);
            if (isNaN(rnd)) rnd = 20;
            var mode = "none";
            if (e.shiftKey && e.altKey) mode = "out";
            else if (e.altKey) mode = "in";
            else if (e.shiftKey) mode = "inout";
            callHost("pcCreateHighlightBox('" + mode + "', " + eo + ", " + ei + ", " + glow + ", " + rnd + ")");
        });

        // Universal animate — routes based on selected layer name
        function animateHighlighter(mode) {
            csInterface.evalScript("pcGetSelectedLayerName()", function(result) {
                var name = "";
                try { name = (JSON.parse(result) || {}).name || ""; } catch(_) {}
                var fn = "pcHighlighterAnimate";
                if (name.indexOf("Line Highlight") !== -1) fn = "pcLineHighlighterAnimate";
                else if (name.indexOf("Highlight Box") !== -1) fn = "pcLineHighlighterAnimate";
                else if (name.indexOf("Focus Mask") !== -1) fn = "pcFocusMaskAnimate";
                callHost(fn + "('" + mode + "', " + easeOut() + ", " + easeIn() + ")");
            });
        }
        on("btn-hl-in",    "click", function() { animateHighlighter("in"); });
        on("btn-hl-out",   "click", function() { animateHighlighter("out"); });
        on("btn-hl-inout", "click", function() { animateHighlighter("inout"); });

        // Quick Scale
        [5, 10, 20, 30].forEach(function(pct) {
            on("btn-z" + pct, "click", function() { callHost("pcQuickScale(" + pct + ")"); });
        });

        // Zoom to Corner
        ["ztl", "ztr", "zbl", "zbr"].forEach(function(id) {
            var corners = { ztl: "topLeft", ztr: "topRight", zbl: "bottomLeft", zbr: "bottomRight" };
            on("btn-" + id, "click", function() {
                var dur = parseFloat(document.getElementById("zoom-dur").value) || 20;
                var zpct = parseFloat(document.getElementById("zoom-pct").value) || 130;
                callHost("pcZoomToCorner('" + corners[id] + "', " + dur + ", " + zpct + ", " + easeOut() + ", " + easeIn() + ")");
            });
        });

        // Continuous Zoom
        on("btn-cont-zoom", "click", function() {
            var zpct = parseFloat(document.getElementById("cont-zoom-pct").value) || 10;
            callHost("pcContinuousZoom(" + zpct + ", false)");
        });
        on("btn-cont-zoom-ph", "click", function() {
            var zpct = parseFloat(document.getElementById("cont-zoom-pct").value) || 10;
            callHost("pcContinuousZoom(" + zpct + ", true)");
        });

        // Solid Creator (Shift+Click or checkbox → animate)
        ["left", "right", "top", "bottom"].forEach(function(dir) {
            on("btn-sol-" + dir, "click", function(evt) {
                var anim = shouldAnimate("solid-animate", evt);
                var dur = parseFloat(document.getElementById("solid-dur").value) || 20;
                callHost("pcSolidOrLayer('" + dir + "', " + anim + ", " + dur + ", " + easeOut() + ", " + easeIn() + ")");
            });
        });
        on("btn-sol-mask-in", "click", function() {
            var dur = parseFloat(document.getElementById("solid-dur").value) || 20;
            callHost("pcAnimateMaskIn(" + dur + ", " + easeOut() + ", " + easeIn() + ")");
        });

        // Mini Profesor (Shift+Click or checkbox → animate)
        on("btn-mp-left", "click", function(evt) {
            var x = parseFloat(document.getElementById("mp-x").value) || 35;
            var y = parseFloat(document.getElementById("mp-y").value) || 0;
            var anim = shouldAnimate("mp-animate", evt);
            callHost("pcMiniProfesor('left', " + x + ", " + y + ", " + anim + ", " + easeOut() + ", " + easeIn() + ")");
        });
        on("btn-mp-right", "click", function(evt) {
            var x = parseFloat(document.getElementById("mp-x").value) || 35;
            var y = parseFloat(document.getElementById("mp-y").value) || 0;
            var anim = shouldAnimate("mp-animate", evt);
            callHost("pcMiniProfesor('right', " + x + ", " + y + ", " + anim + ", " + easeOut() + ", " + easeIn() + ")");
        });

        // Corner Profesor (Shift+Click or checkbox → animate)
        ["tl", "tr", "bl", "br"].forEach(function(c) {
            var corners = { tl: "topLeft", tr: "topRight", bl: "bottomLeft", br: "bottomRight" };
            on("btn-cp-" + c, "click", function(evt) {
                var circ = document.getElementById("cp-circular").checked;
                var dur = parseFloat(document.getElementById("cp-dur").value) || 20;
                var size = parseFloat(document.getElementById("cp-size").value) || 600;
                var anim = shouldAnimate("cp-animate", evt);
                callHost("pcCornerProfesor('" + corners[c] + "', " + circ + ", " + dur + ", " + size + ", " + anim + ", " + easeOut() + ", " + easeIn() + ")");
            });
        });

        // Text Helper — mode radio toggle with inline styles (CEP compat)
        var thRadios = document.querySelectorAll(".th-radio");
        function updateRadioStyles() {
            for (var rj = 0; rj < thRadios.length; rj++) {
                var isChecked = thRadios[rj].querySelector("input").checked;
                thRadios[rj].style.background = isChecked ? "#0AE98A" : "";
                thRadios[rj].style.color = isChecked ? "#000" : "";
                thRadios[rj].style.opacity = isChecked ? "1" : "0.5";
                thRadios[rj].style.fontWeight = isChecked ? "600" : "";
            }
        }
        for (var ri = 0; ri < thRadios.length; ri++) {
            thRadios[ri].addEventListener("click", updateRadioStyles);
        }
        updateRadioStyles();

        // Text Helper — each button is a type, auto-detects if text is selected
        var thBtns = document.querySelectorAll(".btn-th");
        for (var ti = 0; ti < thBtns.length; ti++) {
            (function(btn) {
                btn.addEventListener("click", function(evt) {
                    var animType = btn.getAttribute("data-anim");
                    var mode = document.querySelector('input[name="th-mode"]:checked').value;
                    var dur = parseInt(document.getElementById("th-dur").value) || 20;
                    var glow = document.getElementById("th-glow").checked;
                    // Shift=In only, Shift+Alt=Out only, normal=InOut
                    var animMode = "inout";
                    if (evt.shiftKey && evt.altKey) animMode = "out";
                    else if (evt.shiftKey) animMode = "in";
                    callHost("pcTextHelper('" + animType + "','" + mode + "','" + animMode + "'," + dur + "," + glow + "," + easeOut() + "," + easeIn() + ")");
                });
            })(thBtns[ti]);
        }

    }

    // ─── Color Palette ───────────────────────────────────────────
    function bindColorPalette() {
        var swatches = document.getElementById("color-palette").children;
        for (var i = 0; i < swatches.length; i++) {
            (function(swatch) {
                if (!swatch.getAttribute("data-color")) return; // skip non-swatch elements
                swatch.addEventListener("click", function() {
                    var all = document.getElementById("color-palette").children;
                    for (var j = 0; j < all.length; j++) all[j].classList.remove("active");
                    swatch.classList.add("active");
                    var rgb = swatch.getAttribute("data-color");
                    csInterface.evalScript("pcApplyColorToSelected([" + rgb + "])");
                });
            })(swatches[i]);
        }
        // Mirror Keys button
        document.getElementById("btn-mirror-keys").addEventListener("click", function() {
            callHost("pcCloneMirrorKeys()");
        });

    }

    // ─── Start ───────────────────────────────────────────────────
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

})();
