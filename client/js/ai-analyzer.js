/**
 * AI Analyzer - Multi-provider: Ollama (local), Gemini, Claude, GPT
 */

(function(global) {
    "use strict";

    var https, http;
    try { https = require("https"); } catch(e) { https = null; }
    try { http = require("http"); } catch(e) { http = null; }

    var PROVIDERS = {
        ollama: {
            name: "Ollama (Local)",
            host: "localhost",
            port: 11434,
            path: "/api/chat",
            local: true,
            keyPlaceholder: "",
            models: [
                { id: "mistral-small3.1:latest", label: "Mistral Small 3.1 (instalado)" }
            ],
            defaultModel: "mistral-small3.1:latest"
        },
        google: {
            name: "Gemini",
            host: "generativelanguage.googleapis.com",
            local: false,
            keyPlaceholder: "AIza...",
            models: [
                { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (rápido)" },
                { id: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro (recomendado)" },
                { id: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash" }
            ],
            defaultModel: "gemini-2.0-flash"
        },
        anthropic: {
            name: "Claude",
            host: "api.anthropic.com",
            path: "/v1/messages",
            local: false,
            keyPlaceholder: "sk-ant-...",
            models: [
                { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (recomendado)" },
                { id: "claude-haiku-4-20250514", label: "Claude Haiku 4 (rápido)" },
                { id: "claude-opus-4-20250514", label: "Claude Opus 4 (máxima calidad)" }
            ],
            defaultModel: "claude-sonnet-4-20250514"
        },
        openai: {
            name: "GPT",
            host: "api.openai.com",
            path: "/v1/chat/completions",
            local: false,
            keyPlaceholder: "sk-...",
            models: [
                { id: "gpt-4o-mini", label: "GPT-4o Mini (rápido)" },
                { id: "gpt-4o", label: "GPT-4o (recomendado)" },
                { id: "gpt-4-turbo", label: "GPT-4 Turbo" }
            ],
            defaultModel: "gpt-4o-mini"
        }
    };

    function AIAnalyzer() {
        this.provider = "ollama";
        this.keys = { anthropic: "", openai: "", google: "" };
        this.model = PROVIDERS.ollama.defaultModel;
        this.maxTokens = 2048;
        this.ollamaUrl = "http://localhost:11434";
    }

    AIAnalyzer.PROVIDERS = PROVIDERS;

    AIAnalyzer.prototype.setProvider = function(provider) {
        if (!PROVIDERS[provider]) return;
        this.provider = provider;
        this.model = PROVIDERS[provider].defaultModel;
    };

    AIAnalyzer.prototype.setApiKey = function(provider, key) {
        if (provider && this.keys.hasOwnProperty(provider)) {
            this.keys[provider] = (key || "").trim();
        }
    };

    AIAnalyzer.prototype.setModel = function(model) {
        this.model = model || PROVIDERS[this.provider].defaultModel;
    };

    AIAnalyzer.prototype.setOllamaUrl = function(url) {
        this.ollamaUrl = (url || "http://localhost:11434").replace(/\/+$/, "");
    };

    AIAnalyzer.prototype.getActiveKey = function() {
        return this.keys[this.provider] || "";
    };

    AIAnalyzer.prototype.isConfigured = function() {
        if (this.provider === "ollama") return true;
        var key = this.getActiveKey();
        return key && key.length > 5;
    };

    AIAnalyzer.prototype.getProviderInfo = function() {
        return PROVIDERS[this.provider];
    };

    // ─── Prompt ──────────────────────────────────────────────────
    var SYSTEM_MSG = "Eres un corrector de textos profesional especializado en motion graphics, video y diseño. Responde ÚNICAMENTE con JSON válido, sin markdown ni bloques de código.";

    AIAnalyzer.prototype._buildPrompt = function(text, context) {
        context = context || {};
        var layerName = context.layerName || "";
        var allLayerTexts = context.allLayerTexts || [];
        var lang = context.detectedLang || "auto";
        var capStyle = context.detectedCapStyle || "auto";

        var contextBlock = "";
        if (allLayerTexts.length > 1) {
            contextBlock = "\n\nOTRAS CAPAS DE TEXTO EN LA MISMA COMPOSICIÓN:\n";
            allLayerTexts.forEach(function(lt) {
                if (lt.text !== text) {
                    contextBlock += "- Capa \"" + lt.name + "\": \"" + lt.text.substring(0, 100) + "\"\n";
                }
            });
        }

        return "Analiza el siguiente texto que aparece en una capa de After Effects.\n\n" +
            "TEXTO A ANALIZAR:\n\"" + text + "\"\n" +
            "NOMBRE DE LA CAPA: \"" + layerName + "\"\n" +
            "IDIOMA DETECTADO: " + lang + "\n" +
            "ESTILO DE MAYÚSCULAS DETECTADO: " + capStyle +
            contextBlock +
            "\n\nREALIZA UN ANÁLISIS COMPRENSIVO:\n" +
            "1. ORTOGRAFÍA CONTEXTUAL: Verificar si cada palabra es la correcta en contexto (ej: \"hola\" vs \"ola\", \"hay\" vs \"ahí\", \"there\" vs \"their\").\n" +
            "2. GRAMÁTICA: Concordancia, conjugación, preposiciones, artículos.\n" +
            "3. MAYÚSCULAS: Consistencia según tipo de texto.\n" +
            "4. PUNTUACIÓN: Signos faltantes, espaciado, ¿¡ en español.\n" +
            "5. ESTILO: Sugerencias para motion graphics/video (conciso y legible).\n" +
            "6. COHERENCIA: Coherencia con las otras capas.\n\n" +
            "IMPORTANTE:\n" +
            "- Si el texto es correcto, dilo claramente\n" +
            "- Responde ÚNICAMENTE con JSON válido, SIN markdown, SIN bloques de código\n\n" +
            "FORMATO (JSON puro, sin ```):\n" +
            '{"score":0,"summary":"","textType":"title","detectedLang":"es","suggestedText":"","issues":[{"type":"spelling","severity":"error","original":"","suggestion":"","explanation":"","context":""}]}';
    };

    // ─── Analyze ─────────────────────────────────────────────────
    AIAnalyzer.prototype.analyze = function(text, context, callback) {
        if (!this.isConfigured()) {
            callback({ error: "API key no configurada para " + PROVIDERS[this.provider].name });
            return;
        }
        if (!text || text.trim().length === 0) {
            callback({ score: 100, summary: "Texto vacío", issues: [], suggestedText: text });
            return;
        }

        var prompt = this._buildPrompt(text, context);
        var body;

        switch (this.provider) {
            case "ollama":
                body = JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: "system", content: SYSTEM_MSG },
                        { role: "user", content: prompt }
                    ],
                    stream: false,
                    format: "json",
                    options: { temperature: 0.2, num_predict: this.maxTokens }
                });
                break;
            case "anthropic":
                body = JSON.stringify({
                    model: this.model,
                    max_tokens: this.maxTokens,
                    system: SYSTEM_MSG,
                    messages: [{ role: "user", content: prompt }]
                });
                break;
            case "openai":
                body = JSON.stringify({
                    model: this.model,
                    max_tokens: this.maxTokens,
                    temperature: 0.2,
                    messages: [
                        { role: "system", content: SYSTEM_MSG },
                        { role: "user", content: prompt }
                    ]
                });
                break;
            case "google":
                body = JSON.stringify({
                    contents: [{ parts: [{ text: SYSTEM_MSG + "\n\n" + prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: this.maxTokens,
                        responseMimeType: "application/json"
                    }
                });
                break;
        }

        if (this.provider === "ollama") {
            this._requestOllama(body, callback);
        } else if (https) {
            this._requestNode(body, callback);
        } else {
            this._requestXHR(body, callback);
        }
    };

    // ─── Request config per provider ─────────────────────────────
    AIAnalyzer.prototype._getRequestConfig = function() {
        var key = this.getActiveKey();

        switch (this.provider) {
            case "anthropic":
                return {
                    hostname: "api.anthropic.com", port: 443, path: "/v1/messages", method: "POST",
                    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
                    url: "https://api.anthropic.com/v1/messages"
                };
            case "openai":
                return {
                    hostname: "api.openai.com", port: 443, path: "/v1/chat/completions", method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
                    url: "https://api.openai.com/v1/chat/completions"
                };
            case "google":
                var gPath = "/v1beta/models/" + this.model + ":generateContent?key=" + key;
                return {
                    hostname: "generativelanguage.googleapis.com", port: 443, path: gPath, method: "POST",
                    headers: { "Content-Type": "application/json" },
                    url: "https://generativelanguage.googleapis.com" + gPath
                };
        }
    };

    // ─── Parse response per provider ─────────────────────────────
    AIAnalyzer.prototype._parseResponse = function(data, callback) {
        try {
            var response = JSON.parse(data);

            if (response.error) {
                callback({ error: response.error.message || response.error.type || JSON.stringify(response.error) });
                return;
            }

            var content = "";

            switch (this.provider) {
                case "ollama":
                    if (response.message && response.message.content) {
                        content = response.message.content;
                    }
                    break;
                case "anthropic":
                    if (response.content && response.content.length > 0) {
                        for (var i = 0; i < response.content.length; i++) {
                            if (response.content[i].type === "text") { content = response.content[i].text; break; }
                        }
                    }
                    break;
                case "openai":
                    if (response.choices && response.choices.length > 0) {
                        content = response.choices[0].message.content;
                    }
                    break;
                case "google":
                    if (response.candidates && response.candidates.length > 0) {
                        var parts = response.candidates[0].content.parts;
                        if (parts && parts.length > 0) content = parts[0].text;
                    }
                    break;
            }

            if (!content) {
                callback({ error: "Respuesta vacía de " + PROVIDERS[this.provider].name });
                return;
            }

            var cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
            var result = JSON.parse(cleaned);
            callback(result);

        } catch(e) {
            callback({ error: "Error al procesar respuesta de " + PROVIDERS[this.provider].name + ": " + e.message, raw: data });
        }
    };

    // ─── Ollama request (HTTP local) ─────────────────────────────
    AIAnalyzer.prototype._requestOllama = function(body, callback) {
        var self = this;

        if (http) {
            var urlParts = this.ollamaUrl.replace("http://", "").split(":");
            var host = urlParts[0] || "localhost";
            var port = parseInt(urlParts[1]) || 11434;

            var opts = {
                hostname: host,
                port: port,
                path: "/api/chat",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(body)
                }
            };

            var req = http.request(opts, function(res) {
                var data = "";
                res.on("data", function(chunk) { data += chunk; });
                res.on("end", function() { self._parseResponse(data, callback); });
            });

            req.on("error", function(e) {
                if (e.code === "ECONNREFUSED") {
                    callback({ error: "No se pudo conectar a Ollama. Asegúrate de que esté corriendo (ollama serve)." });
                } else {
                    callback({ error: "Error de conexión con Ollama: " + e.message });
                }
            });

            req.write(body);
            req.end();
        } else {
            var xhr = new XMLHttpRequest();
            xhr.open("POST", this.ollamaUrl + "/api/chat", true);
            xhr.setRequestHeader("Content-Type", "application/json");

            xhr.onload = function() { self._parseResponse(xhr.responseText, callback); };
            xhr.onerror = function() {
                callback({ error: "No se pudo conectar a Ollama. Verifica que esté corriendo en " + self.ollamaUrl });
            };
            xhr.send(body);
        }
    };

    // ─── Node.js HTTPS request (cloud providers) ─────────────────
    AIAnalyzer.prototype._requestNode = function(body, callback) {
        var self = this;
        var config = this._getRequestConfig();
        var nodeOpts = {
            hostname: config.hostname, port: config.port,
            path: config.path, method: config.method, headers: config.headers
        };
        nodeOpts.headers["Content-Length"] = Buffer.byteLength(body);

        var req = https.request(nodeOpts, function(res) {
            var data = "";
            res.on("data", function(chunk) { data += chunk; });
            res.on("end", function() { self._parseResponse(data, callback); });
        });

        req.on("error", function(e) { callback({ error: "Error de conexión: " + e.message }); });
        req.write(body);
        req.end();
    };

    // ─── XHR request (browser fallback for cloud) ────────────────
    AIAnalyzer.prototype._requestXHR = function(body, callback) {
        var self = this;
        var config = this._getRequestConfig();

        var xhr = new XMLHttpRequest();
        xhr.open("POST", config.url, true);
        for (var h in config.headers) { xhr.setRequestHeader(h, config.headers[h]); }

        xhr.onload = function() { self._parseResponse(xhr.responseText, callback); };
        xhr.onerror = function() { callback({ error: "Error de conexión con " + PROVIDERS[self.provider].name }); };
        xhr.send(body);
    };

    // ─── Analyze all layers ──────────────────────────────────────
    AIAnalyzer.prototype.analyzeAll = function(layers, callback) {
        if (!this.isConfigured()) { callback({ error: "No configurado" }); return; }

        var self = this;
        var results = [];
        var completed = 0;
        var total = layers.length;

        if (total === 0) { callback({ results: [] }); return; }

        var allLayerTexts = layers.map(function(l) { return { name: l.name, text: l.text }; });

        layers.forEach(function(layer, idx) {
            self.analyze(layer.text, {
                layerName: layer.name, allLayerTexts: allLayerTexts,
                detectedLang: "auto", detectedCapStyle: "auto"
            }, function(result) {
                results[idx] = { layer: layer, analysis: result };
                if (++completed === total) callback({ results: results });
            });
        });
    };

    // ─── Fetch installed Ollama models ───────────────────────────
    AIAnalyzer.prototype.fetchOllamaModels = function(callback) {
        var self = this;
        var url = this.ollamaUrl + "/api/tags";

        if (http) {
            var urlParts = this.ollamaUrl.replace("http://", "").split(":");
            var host = urlParts[0] || "localhost";
            var port = parseInt(urlParts[1]) || 11434;

            var req = http.get({ hostname: host, port: port, path: "/api/tags" }, function(res) {
                var data = "";
                res.on("data", function(chunk) { data += chunk; });
                res.on("end", function() {
                    try {
                        var resp = JSON.parse(data);
                        var models = (resp.models || []).map(function(m) {
                            return { id: m.name, label: m.name + " (" + formatSize(m.size) + ")" };
                        });
                        callback(null, models);
                    } catch(e) { callback(e.message, []); }
                });
            });
            req.on("error", function(e) { callback(e.message, []); });
        } else {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.onload = function() {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    var models = (resp.models || []).map(function(m) {
                        return { id: m.name, label: m.name + " (" + formatSize(m.size) + ")" };
                    });
                    callback(null, models);
                } catch(e) { callback(e.message, []); }
            };
            xhr.onerror = function() { callback("No se pudo conectar a Ollama", []); };
            xhr.send();
        }
    };

    function formatSize(bytes) {
        if (!bytes) return "?";
        var gb = bytes / (1024 * 1024 * 1024);
        if (gb >= 1) return gb.toFixed(1) + " GB";
        return (bytes / (1024 * 1024)).toFixed(0) + " MB";
    }

    global.AIAnalyzer = AIAnalyzer;

})(window);
