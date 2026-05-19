/**
 * Platzi Composer Pro - Main Controller
 * SpellCheck IA + Platzi Composer Tools
 */

(function() {
    "use strict";

    var csInterface = new CSInterface();
    var engine = null;
    var aiAnalyzer = null;

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

    // ─── Init ────────────────────────────────────────────────────
    function init() {
        var extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);
        engine = new SpellCheckEngine({ extensionPath: extensionPath, uiLanguage: "es" });
        aiAnalyzer = new AIAnalyzer();

        loadSavedSettings();
        loadSavedEase();
        bindEvents();
        refreshProviderUI();
        updateAIStatus();
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

    function loadSavedEase() {
        var savedOut = localStorage.getItem("pc_ease_out");
        var savedIn = localStorage.getItem("pc_ease_in");
        var eoEl = document.getElementById("ease-out");
        var eiEl = document.getElementById("ease-in");
        if (savedOut !== null && eoEl) eoEl.value = savedOut;
        if (savedIn !== null && eiEl) eiEl.value = savedIn;
    }

    function saveEaseDefaults() {
        var eo = document.getElementById("ease-out");
        var ei = document.getElementById("ease-in");
        if (eo) localStorage.setItem("pc_ease_out", eo.value);
        if (ei) localStorage.setItem("pc_ease_in", ei.value);
        showToast("Ease defaults guardados: Out " + (eo ? eo.value : "") + " / In " + (ei ? ei.value : ""), "success");
    }

    function bindEvents() {
        on("btn-analyze", "click", startAnalysis);
        on("btn-settings", "click", toggleSettings);
        on("btn-save-api-key", "click", saveApiKey);
        on("btn-back", "click", showListView);
        on("btn-ollama-refresh", "click", checkOllamaConnection);
        on("btn-save-ease", "click", saveEaseDefaults);

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
            csInterface.evalScript(
                'replaceInLayer(' + aeIdx + ', "' + escExtend(original) + '", "' + escExtend(replacement) + '")',
                function(r) { handleFixResult(layerIdx, issueIdx, r); }
            );
        }
    }

    function applySuggestedText(suggestedText) {
        if (state.currentLayerIndex < 0) return;
        var layer = state.layers[state.currentLayerIndex];

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

    // ─── Collapsible sections ───────────────────────────────────
    function bindCollapsibles() {
        document.querySelectorAll(".tool-card-header").forEach(function(hdr) {
            hdr.addEventListener("click", function() {
                var body = hdr.nextElementSibling;
                var icon = hdr.querySelector(".toggle-icon");
                if (!body) return;
                body.classList.toggle("hidden");
                if (icon) icon.textContent = body.classList.contains("hidden") ? "▸" : "▾";
            });
        });
    }

    function expandSpellCheck() {
        var body = document.getElementById("spellcheck-body");
        var icon = document.getElementById("spellcheck-toggle-icon");
        if (body) body.classList.remove("hidden");
        if (icon) icon.textContent = "▾";
    }

    // ─── Platzi Composer tool event handlers ─────────────────────
    function bindToolEvents() {
        function easeOut() { return parseFloat(document.getElementById("ease-out").value) || 33; }
        function easeIn()  { return parseFloat(document.getElementById("ease-in").value) || 100; }

        function callHost(fn, cb) {
            csInterface.evalScript(fn, function(result) {
                try {
                    var d = JSON.parse(result);
                    if (d.error) { showToast(d.error, "error"); return; }
                    showToast("Listo", "success");
                    if (cb) cb(d);
                } catch(e) {
                    showToast("Error: " + e.message, "error");
                }
            });
        }

        // Shift+Click: if shift is held OR checkbox is checked → animate = true
        function shouldAnimate(checkboxId, evt) {
            var cb = document.getElementById(checkboxId);
            return (evt && evt.shiftKey) || (cb && cb.checked);
        }

        // Highlighter
        on("btn-hl-create", "click", function() { callHost("pcCreateHighlighter()"); });
        on("btn-hl-flip",   "click", function() { callHost("pcFlipHorizontal()"); });
        on("btn-hl-in",     "click", function() { callHost("pcHighlighterAnimate('in', " + easeOut() + ", " + easeIn() + ")"); });
        on("btn-hl-out",    "click", function() { callHost("pcHighlighterAnimate('out', " + easeOut() + ", " + easeIn() + ")"); });
        on("btn-hl-inout",  "click", function() { callHost("pcHighlighterAnimate('inout', " + easeOut() + ", " + easeIn() + ")"); });

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
    }

    // ─── Start ───────────────────────────────────────────────────
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

})();
