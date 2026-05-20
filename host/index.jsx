/**
 * AE SpellCheck Pro + Platzi Composer — ExtendScript Host
 * SpellCheck: lectura/escritura de capas de texto
 * Platzi Tools: Highlighter, Zoomer, Solid Creator, Mini Profesor, Corner Profesor
 */

function getActiveCompTextLayers() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ error: "No hay composición activa. Abre una composición primero." });
        }

        var layers = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            if (layer instanceof TextLayer) {
                var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
                var textDoc = textProp.value;

                var layerData = {
                    index: i,
                    name: layer.name,
                    text: textDoc.text,
                    fontSize: textDoc.fontSize,
                    font: textDoc.font
                };

                try { layerData.allCaps = textDoc.allCaps; } catch(e) { layerData.allCaps = false; }
                try { layerData.smallCaps = textDoc.smallCaps; } catch(e) { layerData.smallCaps = false; }
                try {
                    var j = textDoc.justification;
                    if (j === ParagraphJustification.LEFT_JUSTIFY) layerData.justification = "left";
                    else if (j === ParagraphJustification.CENTER_JUSTIFY) layerData.justification = "center";
                    else if (j === ParagraphJustification.RIGHT_JUSTIFY) layerData.justification = "right";
                    else layerData.justification = "left";
                } catch(e) {
                    layerData.justification = "left";
                }

                layers.push(layerData);
            }
        }

        return JSON.stringify({
            compName: comp.name,
            layers: layers,
            numLayers: layers.length
        });

    } catch(e) {
        return JSON.stringify({ error: e.toString() });
    }
}

function setLayerText(layerIndex, newText) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ error: "No hay composición activa." });
        }

        var layer = comp.layer(parseInt(layerIndex));
        if (!layer || !(layer instanceof TextLayer)) {
            return JSON.stringify({ error: "La capa " + layerIndex + " no es una capa de texto." });
        }

        app.beginUndoGroup("SpellCheck Pro - Corrección de texto");

        var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
        var textDoc = textProp.value;
        textDoc.text = newText;
        textProp.setValue(textDoc);

        app.endUndoGroup();

        return JSON.stringify({ success: true, newText: newText });

    } catch(e) {
        return JSON.stringify({ error: e.toString() });
    }
}

function replaceInLayer(layerIndex, oldText, newText) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ error: "No hay composición activa." });
        }

        var layer = comp.layer(parseInt(layerIndex));
        if (!layer || !(layer instanceof TextLayer)) {
            return JSON.stringify({ error: "La capa " + layerIndex + " no es una capa de texto." });
        }

        app.beginUndoGroup("SpellCheck Pro - Reemplazar");

        var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
        var textDoc = textProp.value;
        var currentText = textDoc.text;
        var updatedText = currentText.split(oldText).join(newText);
        textDoc.text = updatedText;
        textProp.setValue(textDoc);

        app.endUndoGroup();

        return JSON.stringify({ success: true, newText: updatedText });

    } catch(e) {
        return JSON.stringify({ error: e.toString() });
    }
}

function getCompInfo() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ error: "No hay composición activa." });
        }

        return JSON.stringify({
            name: comp.name,
            width: comp.width,
            height: comp.height,
            duration: comp.duration,
            frameRate: comp.frameRate,
            numLayers: comp.numLayers
        });

    } catch(e) {
        return JSON.stringify({ error: e.toString() });
    }
}

function batchReplace(layerIndex, replacementsJSON) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ error: "No hay composición activa." });
        }

        var layer = comp.layer(parseInt(layerIndex));
        if (!layer || !(layer instanceof TextLayer)) {
            return JSON.stringify({ error: "La capa " + layerIndex + " no es una capa de texto." });
        }

        var replacements = eval("(" + replacementsJSON + ")");

        app.beginUndoGroup("SpellCheck Pro - Corrección múltiple");

        var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
        var textDoc = textProp.value;
        var currentText = textDoc.text;

        for (var i = 0; i < replacements.length; i++) {
            var r = replacements[i];
            currentText = currentText.split(r.old).join(r.new);
        }

        textDoc.text = currentText;
        textProp.setValue(textDoc);

        app.endUndoGroup();

        return JSON.stringify({ success: true, newText: currentText });

    } catch(e) {
        return JSON.stringify({ error: e.toString() });
    }
}


/* ══════════════════════════════════════════════════════════════
   PLATZI COMPOSER TOOLS
   ══════════════════════════════════════════════════════════════ */

function _pcRequireComp() {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return null;
    return comp;
}

function _pcRequireSelected() {
    var comp = _pcRequireComp();
    if (!comp) return null;
    if (comp.selectedLayers.length === 0) return null;
    return { comp: comp, layers: comp.selectedLayers };
}

function pcGetSelectedLayerName() {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ name: "" });
    return JSON.stringify({ name: s.layers[0].name || "" });
}

function pcApplyColorToSelected(color) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona una capa primero." });
    try {
        app.beginUndoGroup("Apply Color");
        var applied = false;

        // Apply to all selected layers
        for (var layIdx = 0; layIdx < s.layers.length; layIdx++) {
            var layer = s.layers[layIdx];

            // 1. Text Layer: change fill color
            if (layer instanceof TextLayer) {
                var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
                var textDoc = textProp.value;
                textDoc.fillColor = color;
                textProp.setValue(textDoc);
                applied = true;
                continue;
            }

            // 2. Effect Controls: find "Color" control
            var fxs = layer.property("Effects");
            if (fxs) {
                for (var i = 1; i <= fxs.numProperties; i++) {
                    var fx = fxs.property(i);
                    if (fx.name === "Color" && fx.matchName === "ADBE Color Control") {
                        fx.property("Color").setValue(color);
                        applied = true;
                        break;
                    }
                }
            }

            // 3. Shape layer: apply to stroke
            if (layer.property("Contents")) {
                var contents = layer.property("Contents");
                for (var g = 1; g <= contents.numProperties; g++) {
                    try {
                        var grpC = contents.property(g).property("Contents");
                        if (grpC) {
                            for (var p = 1; p <= grpC.numProperties; p++) {
                                if (grpC.property(p).matchName === "ADBE Vector Graphic - Stroke") {
                                    try { grpC.property(p).property("Color").setValue(color); applied = true; } catch(ex) {}
                                }
                                if (grpC.property(p).matchName === "ADBE Vector Graphic - Fill") {
                                    try { grpC.property(p).property("Color").setValue(color); applied = true; } catch(ex) {}
                                }
                            }
                        }
                    } catch(ex) {}
                }
            }

            // 4. Solid layer: change source color
            if (layer.source && layer.source instanceof FootageItem && layer.source.mainSource instanceof SolidSource) {
                try { layer.source.mainSource.color = color; applied = true; } catch(ex) {}
            }
        }

        app.endUndoGroup();
        if (!applied) return JSON.stringify({ error: "No se pudo aplicar color a la selecci\u00f3n." });
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

function _pcApplyEaseScalar(prop, k1, k2, easeOutVal, easeInVal) {
    var eIn = new KeyframeEase(0, easeInVal);
    var eOut = new KeyframeEase(0, easeOutVal);
    prop.setTemporalEaseAtKey(k1, [eIn], [eOut]);
    prop.setTemporalEaseAtKey(k2, [eIn], [eOut]);
}

function _pcApplyEaseArray(prop, k1, k2, easeOutVal, easeInVal) {
    var eIn = new KeyframeEase(0, easeInVal);
    var eOut = new KeyframeEase(0, easeOutVal);
    var si = [eIn, eIn], so = [eOut, eOut];
    try {
        if (prop.propertyValueType === PropertyValueType.ThreeD ||
            prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL) {
            si.push(eIn); so.push(eOut);
        }
    } catch(_){}
    prop.setTemporalEaseAtKey(k1, si, so);
    prop.setTemporalEaseAtKey(k2, si, so);
}

// ─── HIGHLIGHTER ─────────────────────────────────────────────

function pcCreateHighlighter() {
    var comp = _pcRequireComp();
    if (!comp) return JSON.stringify({ error: "No hay composición activa." });
    try {
        app.beginUndoGroup("Create Highlighter");
        var layer = comp.layers.addShape();
        layer.name = "Highlight";
        layer.inPoint = comp.time;
        layer.outPoint = comp.time + 10;
        layer.property("Transform").property("Opacity").setValue(50);
        layer.property("Transform").property("Anchor Point").setValue([0, 0]);

        var fxs = layer.property("Effects");
        var lenCtrl = fxs.addProperty("ADBE Slider Control"); lenCtrl.name = "Length";
        lenCtrl.property("Slider").setValue(400);
        var thkCtrl = fxs.addProperty("ADBE Slider Control"); thkCtrl.name = "Thickness";
        thkCtrl.property("Slider").setValue(30);
        var colorCtrl = fxs.addProperty("ADBE Color Control"); colorCtrl.name = "Color";
        colorCtrl.property("Color").setValue([1, 1, 0]);

        var contents = layer.property("Contents");
        var rg = contents.addProperty("ADBE Vector Group"); rg.name = "HighlightLine";
        var rc = rg.property("Contents");

        var pathGrp = rc.addProperty("ADBE Vector Shape - Group");
        var lineShape = new Shape();
        lineShape.vertices = [[0, 0], [400, 0]];
        lineShape.closed = false;
        pathGrp.property("Path").setValue(lineShape);
        try {
            pathGrp.property("Path").expression = "createPath([[0,0],[effect(\"Length\")(\"Slider\"),0]], [], [], false)";
        } catch(ex) {}

        var stroke = rc.addProperty("ADBE Vector Graphic - Stroke");
        stroke.property("Color").setValue([1, 1, 0]);
        stroke.property("Stroke Width").setValue(30);
        try { stroke.property("Stroke Width").expression = "effect(\"Thickness\")(\"Slider\")"; } catch(ex) {}
        try { stroke.property("Color").expression = "effect(\"Color\")(\"Color\")"; } catch(ex) {}

        var trim = rc.addProperty("ADBE Vector Filter - Trim");
        trim.property("End").setValue(100);

        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

function pcFlipHorizontal() {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona una capa." });
    try {
        app.beginUndoGroup("Flip Horizontal");
        var layer = s.layers[0];
        var sp = layer.property("Transform").property("Scale");
        var v = sp.value;
        sp.setValue([-v[0], v[1]]);
        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

function pcHighlighterAnimate(mode, easeOut, easeIn) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona una capa de highlight." });
    try {
        app.beginUndoGroup("Highlight " + mode);
        var comp = s.comp, layer = s.layers[0];

        var contents = layer.property("Contents");
        var trim = null;
        for (var i = 1; i <= contents.numProperties; i++) {
            var g = contents.property(i);
            if (g.property && g.property("Contents")) {
                var gc = g.property("Contents");
                for (var j = 1; j <= gc.numProperties; j++) {
                    if (gc.property(j).matchName === "ADBE Vector Filter - Trim") {
                        trim = gc.property(j).property("End");
                        break;
                    }
                }
            }
            if (trim) break;
        }
        if (!trim) { app.endUndoGroup(); return JSON.stringify({ error: "No se encontró Trim Paths." }); }

        var fps = comp.frameRate;
        if (mode === "in") {
            var t0 = comp.time, t1 = t0 + (20 / fps);
            trim.setValueAtTime(t0, 0); trim.setValueAtTime(t1, 100);
            _pcApplyEaseScalar(trim, 1, 2, easeOut, easeIn);
        } else if (mode === "out") {
            var t0 = comp.time, t1 = t0 + (20 / fps);
            trim.setValueAtTime(t0, 100); trim.setValueAtTime(t1, 0);
            _pcApplyEaseScalar(trim, 1, 2, easeOut, easeIn);
        } else {
            var inPt = layer.inPoint, outPt = layer.outPoint;
            var dur = 20 / fps;
            trim.setValueAtTime(inPt, 0);
            trim.setValueAtTime(inPt + dur, 100);
            trim.setValueAtTime(outPt - dur, 100);
            trim.setValueAtTime(outPt, 0);
            var kIn = new KeyframeEase(0, easeIn), kOut = new KeyframeEase(0, easeOut);
            for (var k = 1; k <= 4; k++) trim.setTemporalEaseAtKey(k, [kIn], [kOut]);
        }
        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

// ─── LINE HIGHLIGHTER ────────────────────────────────────────

function pcCreateLineHighlighter(style, enableGlow) {
    var comp = _pcRequireComp();
    if (!comp) return JSON.stringify({ error: "No hay composición activa." });
    if (!style) style = "solid";
    try {
        app.beginUndoGroup("Create Line Highlight");
        var layer = comp.layers.addShape();
        var styleNames = {"solid":"Solid","thunder":"Thunder","dashed":"Dashed"};
        layer.name = "Line Highlight - " + (styleNames[style] || style);
        layer.inPoint = comp.time;
        layer.outPoint = comp.time + 3;

        var fxs = layer.property("Effects");
        // Common controls
        var lenCtrl = fxs.addProperty("ADBE Slider Control"); lenCtrl.name = "Length";
        lenCtrl.property("Slider").setValue(400);
        var thkCtrl = fxs.addProperty("ADBE Slider Control"); thkCtrl.name = "Thickness";
        thkCtrl.property("Slider").setValue(8);
        var colorCtrl = fxs.addProperty("ADBE Color Control"); colorCtrl.name = "Color";
        colorCtrl.property("Color").setValue([1, 1, 0]);

        // Style-specific controls
        if (style === "thunder") {
            var thunAmtCtrl = fxs.addProperty("ADBE Slider Control"); thunAmtCtrl.name = "Thunder Amount";
            thunAmtCtrl.property("Slider").setValue(3);
            var thunDetCtrl = fxs.addProperty("ADBE Slider Control"); thunDetCtrl.name = "Thunder Detail";
            thunDetCtrl.property("Slider").setValue(8);
            var thunSpdCtrl = fxs.addProperty("ADBE Slider Control"); thunSpdCtrl.name = "Thunder Speed";
            thunSpdCtrl.property("Slider").setValue(2);
        } else if (style === "dashed") {
            var dashLenCtrl = fxs.addProperty("ADBE Slider Control"); dashLenCtrl.name = "Dash Length";
            dashLenCtrl.property("Slider").setValue(20);
            var gapLenCtrl = fxs.addProperty("ADBE Slider Control"); gapLenCtrl.name = "Gap Length";
            gapLenCtrl.property("Slider").setValue(10);
        }

        layer.property("Transform").property("Anchor Point").setValue([0, 0]);

        var contents = layer.property("Contents");
        var grp = contents.addProperty("ADBE Vector Group"); grp.name = "LineGroup";
        var grpContents = grp.property("Contents");

        var pathGrp = grpContents.addProperty("ADBE Vector Shape - Group");
        var lineShape = new Shape();
        lineShape.vertices = [[0, 0], [400, 0]];
        lineShape.closed = false;
        pathGrp.property("Path").setValue(lineShape);
        try {
            pathGrp.property("Path").expression =
                "createPath([[0,0],[effect(\"Length\")(\"Slider\"),0]], [], [], false)";
        } catch(ex) {
            // createPath not available in this AE version, keep static path
        }

        // Stroke
        var stroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
        stroke.property("Color").setValue([1, 1, 0]);
        try { stroke.property("Stroke Width").expression = "effect(\"Thickness\")(\"Slider\")"; } catch(ex) {}
        try { stroke.property("Color").expression = "effect(\"Color\")(\"Color\")"; } catch(ex) {}

        // Dashed style: add dashes to stroke
        if (style === "dashed") {
            try {
                var dashes = stroke.property("Dashes");
                var dash = dashes.addProperty("ADBE Vector Stroke Dash 1");
                dash.expression = "effect(\"Dash Length\")(\"Slider\")";
                var gap = dashes.addProperty("ADBE Vector Stroke Gap 1");
                gap.expression = "effect(\"Gap Length\")(\"Slider\")";
            } catch(ex) {
                // Fallback: static dashes
                try {
                    stroke.property("Dashes").addProperty("ADBE Vector Stroke Dash 1").setValue(20);
                    stroke.property("Dashes").addProperty("ADBE Vector Stroke Gap 1").setValue(10);
                } catch(ex2) {}
            }
        }

        // Thunder style: zigzag animated (like lightning)
        if (style === "thunder") {
            var thunPaths = grpContents.addProperty("ADBE Vector Filter - Roughen");
            try { thunPaths.property("ADBE Vector Roughen Size").expression = "effect(\"Thunder Amount\")(\"Slider\")"; } catch(ex) {}
            try { thunPaths.property("ADBE Vector Roughen Detail").expression = "effect(\"Thunder Detail\")(\"Slider\")"; } catch(ex) {}
            try { thunPaths.property("ADBE Vector Temporal Freq").expression = "effect(\"Thunder Speed\")(\"Slider\")"; } catch(ex) {}
        }


        // Trim Paths (MUST be last operator for animation to work)
        var trim = grpContents.addProperty("ADBE Vector Filter - Trim");
        trim.property("End").setValue(100);
        // Flip direction via Offset expression (0=normal, check=180°)
        try {
            var flipCtrl = fxs.addProperty("ADBE Checkbox Control"); flipCtrl.name = "Flip Direction";
            flipCtrl.property("Checkbox").setValue(0);
            trim.property("ADBE Vector Trim Offset").expression = "effect(\"Flip Direction\")(\"Checkbox\") * 180";
        } catch(ex) {}

        // Always add Glow effect (disabled if checkbox not checked)
        var glow = fxs.addProperty("ADBE Glo2");
        glow.name = "Line Glow";
        try { glow.property("Glow Threshold").setValue(158); } catch(ex) {}
        try { glow.property("Glow Radius").setValue(25); } catch(ex) {}
        try { glow.property("Glow Intensity").setValue(1.5); } catch(ex) {}
        glow.enabled = !!enableGlow;

        // Ensure layer is selected for immediate animation
        layer.selected = true;

        app.endUndoGroup();
        return JSON.stringify({ success: true, style: style });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

function pcLineHighlighterToggleGlow(enable) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona una capa primero." });
    try {
        app.beginUndoGroup("Toggle Glow");
        var layer = s.layers[0];
        var fxs = layer.property("Effects");
        if (!fxs) {
            app.endUndoGroup();
            return JSON.stringify({ error: "La capa no tiene panel de Effects." });
        }
        // Find existing glow and toggle enabled state
        var glowFound = null;
        for (var i = 1; i <= fxs.numProperties; i++) {
            if (fxs.property(i).matchName === "ADBE Glo2") { glowFound = fxs.property(i); break; }
        }
        if (enable) {
            if (glowFound) {
                glowFound.enabled = true;
            } else {
                // Add glow if not present
                var glow = fxs.addProperty("ADBE Glo2");
                glow.name = "Line Glow";
                try { glow.property("Glow Threshold").setValue(158); } catch(ex) {}
                try { glow.property("Glow Radius").setValue(25); } catch(ex) {}
                try { glow.property("Glow Intensity").setValue(1.5); } catch(ex) {}
            }
        } else {
            if (glowFound) {
                glowFound.enabled = false;
            }
        }
        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

function pcCloneMirrorKeys() {
    var comp = _pcRequireComp();
    if (!comp) return JSON.stringify({ error: "No hay composici\u00f3n activa." });
    try {
        app.beginUndoGroup("Clone & Mirror Keys");
        var targetTime = comp.time;
        var mirrored = 0;

        // Get all selected layers
        var selLayers = comp.selectedLayers;
        if (!selLayers || selLayers.length === 0) {
            app.endUndoGroup();
            return JSON.stringify({ error: "Selecciona capas con keyframes." });
        }

        for (var lay = 0; lay < selLayers.length; lay++) {
            var layer = selLayers[lay];
            // Get selected keys from all properties
            var props = layer.selectedProperties;
            if (!props || props.length === 0) continue;

            for (var p = 0; p < props.length; p++) {
                var prop = props[p];
                if (!prop.numKeys || prop.numKeys === 0) continue;
                var selKeys = prop.selectedKeys;
                if (!selKeys || selKeys.length === 0) continue;

                // Collect selected keyframe data
                var keys = [];
                var firstTime = prop.keyTime(selKeys[0]);
                var lastTime = prop.keyTime(selKeys[selKeys.length - 1]);
                for (var k = 0; k < selKeys.length; k++) {
                    var ki = selKeys[k];
                    var eInArr = [], eOutArr = [];
                    try {
                        var tmpIn = prop.keyInTemporalEase(ki);
                        for (var ei = 0; ei < tmpIn.length; ei++) {
                            eInArr.push({ speed: tmpIn[ei].speed, influence: tmpIn[ei].influence });
                        }
                    } catch(ex) {}
                    try {
                        var tmpOut = prop.keyOutTemporalEase(ki);
                        for (var eo = 0; eo < tmpOut.length; eo++) {
                            eOutArr.push({ speed: tmpOut[eo].speed, influence: tmpOut[eo].influence });
                        }
                    } catch(ex) {}
                    keys.push({
                        time: prop.keyTime(ki),
                        value: prop.keyValue(ki),
                        easeIn: eInArr,
                        easeOut: eOutArr
                    });
                }

                // Mirror: place cloned keys starting at targetTime, reversed in time
                var duration = lastTime - firstTime;
                for (var m = keys.length - 1; m >= 0; m--) {
                    var originalOffset = keys[m].time - firstTime;
                    var mirroredTime = targetTime + (duration - originalOffset);
                    var newKey = prop.addKey(mirroredTime);
                    prop.setValueAtKey(newKey, keys[m].value);
                    try {
                        prop.setInterpolationTypeAtKey(newKey, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                    } catch(ex) {}
                    // Apply mirrored ease: original easeOut → new easeIn, original easeIn → new easeOut
                    try {
                        if (keys[m].easeOut.length > 0 && keys[m].easeIn.length > 0) {
                            var newIn = [], newOut = [];
                            for (var ne = 0; ne < keys[m].easeOut.length; ne++) {
                                newIn.push(new KeyframeEase(keys[m].easeOut[ne].speed, keys[m].easeOut[ne].influence));
                            }
                            for (var no = 0; no < keys[m].easeIn.length; no++) {
                                newOut.push(new KeyframeEase(keys[m].easeIn[no].speed, keys[m].easeIn[no].influence));
                            }
                            prop.setTemporalEaseAtKey(newKey, newIn, newOut);
                        }
                    } catch(ex) {}
                }
                mirrored++;
            }
        }

        app.endUndoGroup();
        if (mirrored === 0) return JSON.stringify({ error: "No se encontraron keyframes seleccionados." });
        return JSON.stringify({ success: true, properties: mirrored });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

function pcFlipTrimAnimation() {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona una o más capas." });
    try {
        app.beginUndoGroup("Flip Trim Animation");
        var flipped = 0;
        for (var layIdx = 0; layIdx < s.layers.length; layIdx++) {
            var layer = s.layers[layIdx];
            var contents = null;
            try { contents = layer.property("Contents"); } catch(ex) { continue; }
            if (!contents) continue;
            // Find Trim Paths in any group
            for (var i = 1; i <= contents.numProperties; i++) {
                var g = contents.property(i);
                var gc = null;
                try { gc = g.property("Contents"); } catch(ex) { continue; }
                if (!gc) continue;
                for (var j = 1; j <= gc.numProperties; j++) {
                    if (gc.property(j).matchName === "ADBE Vector Filter - Trim") {
                        var trimGrp = gc.property(j);
                        var endProp = trimGrp.property("End");
                        var startProp = trimGrp.property("Start");
                        // If End has keyframes, move them to Start (flipped)
                        if (endProp.numKeys > 0) {
                            for (var k = 1; k <= endProp.numKeys; k++) {
                                var t = endProp.keyTime(k);
                                var v = endProp.keyValue(k);
                                startProp.setValueAtTime(t, 100 - v);
                            }
                            // Remove End keyframes and set to 100
                            while (endProp.numKeys > 0) endProp.removeKey(1);
                            endProp.setValue(100);
                            startProp.setValue(startProp.keyValue(1));
                            flipped++;
                        }
                        // If Start has keyframes, move them to End (flip back)
                        else if (startProp.numKeys > 0) {
                            for (var k2 = 1; k2 <= startProp.numKeys; k2++) {
                                var t2 = startProp.keyTime(k2);
                                var v2 = startProp.keyValue(k2);
                                endProp.setValueAtTime(t2, 100 - v2);
                            }
                            while (startProp.numKeys > 0) startProp.removeKey(1);
                            startProp.setValue(0);
                            endProp.setValue(endProp.keyValue(1));
                            flipped++;
                        }
                        break;
                    }
                }
            }
        }
        app.endUndoGroup();
        if (flipped === 0) return JSON.stringify({ error: "No se encontr\u00f3 animaci\u00f3n de Trim Paths." });
        return JSON.stringify({ success: true, flipped: flipped });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

function pcLineHighlighterAnimate(mode, easeOut, easeIn) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona una capa Line Highlight." });
    try {
        app.beginUndoGroup("Line Highlight " + mode);
        var comp = s.comp, layer = s.layers[0];
        var contents = layer.property("Contents");
        var trim = null;
        for (var i = 1; i <= contents.numProperties; i++) {
            var g = contents.property(i);
            var gc = null;
            try { gc = g.property("Contents"); } catch(_){}
            if (gc) {
                for (var j = 1; j <= gc.numProperties; j++) {
                    if (gc.property(j).matchName === "ADBE Vector Filter - Trim") {
                        trim = gc.property(j).property("End");
                        break;
                    }
                }
            }
            if (trim) break;
        }
        if (!trim) { app.endUndoGroup(); return JSON.stringify({ error: "No se encontró Trim Paths en la capa." }); }

        var fps = comp.frameRate;
        if (mode === "in") {
            var t0 = comp.time, t1 = t0 + (20 / fps);
            trim.setValueAtTime(t0, 0); trim.setValueAtTime(t1, 100);
            _pcApplyEaseScalar(trim, 1, 2, easeOut, easeIn);
        } else if (mode === "out") {
            var t0b = comp.time, t1b = t0b + (20 / fps);
            trim.setValueAtTime(t0b, 100); trim.setValueAtTime(t1b, 0);
            _pcApplyEaseScalar(trim, 1, 2, easeOut, easeIn);
        } else {
            var inPt = layer.inPoint, outPt = layer.outPoint;
            var dur = 20 / fps;
            trim.setValueAtTime(inPt, 0);
            trim.setValueAtTime(inPt + dur, 100);
            trim.setValueAtTime(outPt - dur, 100);
            trim.setValueAtTime(outPt, 0);
            var kIn = new KeyframeEase(0, easeIn), kOut = new KeyframeEase(0, easeOut);
            for (var k = 1; k <= 4; k++) trim.setTemporalEaseAtKey(k, [kIn], [kOut]);
        }
        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

// ─── HIGHLIGHT BOX ───────────────────────────────────────────

function pcCreateHighlightBox(mode, easeOut, easeIn, enableGlow) {
    var comp = _pcRequireComp();
    if (!comp) return JSON.stringify({ error: "No hay composici\u00f3n activa." });
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona una capa con m\u00e1scara o shape layer con paths." });
    try {
        app.beginUndoGroup("Create Highlight Box");
        var srcLayer = s.layers[0];
        var boxes = []; // Array of {centerX, centerY, boxW, boxH}

        // Check if layer has masks first (priority over shape contents)
        var hasMasks = false;
        try { hasMasks = srcLayer.property("Masks").numProperties > 0; } catch(ex) {}

        // MODE 1: Shape layer with paths (only if NO masks)
        var srcContents = null;
        try { srcContents = srcLayer.property("Contents"); } catch(ex) {}
        if (!hasMasks && srcContents && srcContents.numProperties > 0) {
            for (var g = 1; g <= srcContents.numProperties; g++) {
                var grpItem = srcContents.property(g);
                var gc = null;
                try { gc = grpItem.property("Contents"); } catch(ex) { continue; }
                if (!gc) continue;
                // Find path in this group and extract as shape
                for (var p = 1; p <= gc.numProperties; p++) {
                    var prop = gc.property(p);
                    if (prop.matchName === "ADBE Vector Shape - Group") {
                        // Freeform path: copy directly
                        try {
                            var pathVal = prop.property("Path").value;
                            if (pathVal.vertices.length >= 2) {
                                boxes.push({ maskShape: pathVal, isPath: true });
                            }
                        } catch(ex) {}
                        break;
                    } else if (prop.matchName === "ADBE Vector Shape - Rect") {
                        // Rectangle: convert to path
                        var rSize = prop.property("ADBE Vector Rect Size").value;
                        var rPos = [0, 0];
                        try { rPos = prop.property("ADBE Vector Rect Position").value; } catch(ex) {}
                        var gPos = [0, 0];
                        try { gPos = grpItem.property("Transform").property("Position").value; } catch(ex) {}
                        var hw = rSize[0] / 2, hh = rSize[1] / 2;
                        var cx = rPos[0] + gPos[0], cy = rPos[1] + gPos[1];
                        var rectShape = new Shape();
                        rectShape.vertices = [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx + hw, cy + hh], [cx - hw, cy + hh]];
                        rectShape.closed = true;
                        boxes.push({ maskShape: rectShape, isPath: true });
                        break;
                    } else if (prop.matchName === "ADBE Vector Shape - Ellipse") {
                        // Ellipse: convert to bezier path (4 points with tangent handles)
                        var eSize = prop.property("ADBE Vector Ellipse Size").value;
                        var ePos = [0, 0];
                        try { ePos = prop.property("ADBE Vector Ellipse Position").value; } catch(ex) {}
                        var gPos3 = [0, 0];
                        try { gPos3 = grpItem.property("Transform").property("Position").value; } catch(ex) {}
                        var ecx = ePos[0] + gPos3[0], ecy = ePos[1] + gPos3[1];
                        var rx = eSize[0] / 2, ry = eSize[1] / 2;
                        // Kappa: magic number for bezier circle approximation
                        var k = 0.5522847498;
                        var ellShape = new Shape();
                        ellShape.vertices = [[ecx, ecy - ry], [ecx + rx, ecy], [ecx, ecy + ry], [ecx - rx, ecy]];
                        ellShape.inTangents = [[-rx * k, 0], [0, -ry * k], [rx * k, 0], [0, ry * k]];
                        ellShape.outTangents = [[rx * k, 0], [0, ry * k], [-rx * k, 0], [0, -ry * k]];
                        ellShape.closed = true;
                        boxes.push({ maskShape: ellShape, isPath: true });
                        break;
                    }
                }
            }
            if (boxes.length === 0) {
                app.endUndoGroup();
                return JSON.stringify({ error: "No se encontraron paths en el shape layer." });
            }
        }
        // MODE 2: Layer with masks — use actual mask paths
        else {
            var masks = srcLayer.property("Masks");
            if (!masks || masks.numProperties < 1) {
                app.endUndoGroup();
                return JSON.stringify({ error: "La capa no tiene m\u00e1scara ni shapes. Dibuja una primero." });
            }
            for (var m = 1; m <= masks.numProperties; m++) {
                var maskPathObj = masks.property(m).property("maskPath").value;
                // Store the full path shape data
                boxes.push({ maskShape: maskPathObj, isPath: true });
            }
            // Remove masks after extraction
            for (var rm = masks.numProperties; rm >= 1; rm--) {
                try { masks.property(rm).remove(); } catch(ex) {}
            }
        }

        // Get source layer transform for position offset
        var srcPos = [0, 0];
        var isShapeMode = (!hasMasks && srcContents && srcContents.numProperties > 0);
        if (isShapeMode) {
            try { srcPos = srcLayer.property("Transform").property("Position").value; } catch(ex) {}
        }

        // Create one Highlight Box per extracted path
        var createdLayers = [];
        for (var b = 0; b < boxes.length; b++) {
            var box = boxes[b];
            var layer = comp.layers.addShape();
            layer.name = "Highlight Box " + (b + 1);
            layer.inPoint = comp.time;
            layer.outPoint = srcLayer.outPoint;

            var fxs = layer.property("Effects");
            var thkCtrl = fxs.addProperty("ADBE Slider Control"); thkCtrl.name = "Thickness";
            thkCtrl.property("Slider").setValue(15);
            var colorCtrl = fxs.addProperty("ADBE Color Control"); colorCtrl.name = "Color";
            colorCtrl.property("Color").setValue([0.039, 0.914, 0.541]);
            var padCtrl = fxs.addProperty("ADBE Slider Control"); padCtrl.name = "Padding";
            padCtrl.property("Slider").setValue(10);
            var roundCtrl = fxs.addProperty("ADBE Slider Control"); roundCtrl.name = "Roundness";
            roundCtrl.property("Slider").setValue(60);

            // Position at box center
            if (isShapeMode) {
                if (box.isPath) {
                    // Shape mode with path: match srcLayer position
                    layer.property("Transform").property("Position").setValue(srcPos);
                    layer.property("Transform").property("Anchor Point").setValue([0, 0]);
                } else {
                    // Shape mode with bounding box (ellipse fallback)
                    layer.property("Transform").property("Position").setValue([srcPos[0] + box.centerX, srcPos[1] + box.centerY]);
                    layer.property("Transform").property("Anchor Point").setValue([0, 0]);
                }
                if (srcLayer.parent) {
                    layer.parent = srcLayer.parent;
                }
            } else {
                // Mask mode: parent to source layer, path coords are already correct
                layer.property("Transform").property("Position").setValue([0, 0]);
                layer.property("Transform").property("Anchor Point").setValue([0, 0]);
                layer.parent = srcLayer;
            }

            var contents = layer.property("Contents");
            var grp = contents.addProperty("ADBE Vector Group"); grp.name = "BoxGroup";
            var grpContents = grp.property("Contents");

            // Create shape: use actual path for masks, rectangle for shape mode
            if (box.isPath && box.maskShape) {
                var pathGrp = grpContents.addProperty("ADBE Vector Shape - Group");
                pathGrp.property("Path").setValue(box.maskShape);
            } else {
                var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
                try {
                    rect.property("ADBE Vector Rect Size").expression =
                        "var pad = thisLayer.effect(\"Padding\")(\"Slider\");" +
                        "[" + box.boxW + " + pad*2, " + box.boxH + " + pad*2]";
                } catch(ex) {
                    rect.property("ADBE Vector Rect Size").setValue([box.boxW + 20, box.boxH + 20]);
                }
            }

            var stroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
            stroke.property("Color").setValue([0.039, 0.914, 0.541]);
            try { stroke.property("Stroke Width").expression = "effect(\"Thickness\")(\"Slider\")"; } catch(ex) {}
            try { stroke.property("Color").expression = "effect(\"Color\")(\"Color\")"; } catch(ex) {}

            // Round Corners operator
            var rc = grpContents.addProperty("ADBE Vector Filter - RC");
            try { rc.property("ADBE Vector RoundCorner Radius").expression = "effect(\"Roundness\")(\"Slider\")"; } catch(ex) {}

            var trim = grpContents.addProperty("ADBE Vector Filter - Trim");
            trim.property("End").setValue(100);
            // Flip direction via Offset expression
            try {
                var flipCtrl = fxs.addProperty("ADBE Checkbox Control"); flipCtrl.name = "Flip Direction";
                flipCtrl.property("Checkbox").setValue(0);
                trim.property("ADBE Vector Trim Offset").expression = "effect(\"Flip Direction\")(\"Checkbox\") * 180";
            } catch(ex) {}

            var glow = fxs.addProperty("ADBE Glo2");
            glow.name = "Box Glow";
            try { glow.property("Glow Threshold").setValue(158); } catch(ex) {}
            try { glow.property("Glow Radius").setValue(20); } catch(ex) {}
            try { glow.property("Glow Intensity").setValue(1); } catch(ex) {}
            glow.enabled = !!enableGlow;

            // Animate
            var fps = comp.frameRate;
            var dur = 20 / fps;
            if (mode === "in" || mode === "inout") {
                var t0 = comp.time, t1 = t0 + dur;
                trim.property("End").setValueAtTime(t0, 0);
                trim.property("End").setValueAtTime(t1, 100);
                _pcApplyEaseScalar(trim.property("End"), 1, 2, easeOut, easeIn);
            }
            if (mode === "out" || mode === "inout") {
                var tOut0 = (mode === "inout") ? layer.outPoint - dur : comp.time;
                var tOut1 = tOut0 + dur;
                trim.property("End").setValueAtTime(tOut0, 100);
                trim.property("End").setValueAtTime(tOut1, 0);
                var kCount = trim.property("End").numKeys;
                _pcApplyEaseScalar(trim.property("End"), kCount - 1, kCount, easeOut, easeIn);
            }
            createdLayers.push(layer);
        }

        // Remove the reference shape layer only in shape mode (not mask mode)
        if (!hasMasks && srcContents && boxes.length > 0) {
            try { srcLayer.remove(); } catch(ex) {}
        }

        // Select all created layers
        for (var cl = 0; cl < createdLayers.length; cl++) {
            createdLayers[cl].selected = true;
        }

        app.endUndoGroup();
        return JSON.stringify({ success: true, count: boxes.length });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}


// ─── FOCUS MASK ──────────────────────────────────────────────

function pcCreateFocusMask(opacityVal, featherVal) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona una capa con máscara." });
    try {
        app.beginUndoGroup("Create Focus Mask");
        var comp = s.comp, original = s.layers[0];
        var opa = opacityVal || 70;
        var fth = featherVal || 20;

        var masks = original.property("Masks");
        if (!masks || masks.numProperties === 0) {
            app.endUndoGroup();
            return JSON.stringify({ error: "Dibuja una máscara sobre el área a enfocar." });
        }

        var maskShapeVal = masks.property(1).property("maskShape").value;

        masks.property(1).remove();

        var dark = comp.layers.addSolid([0, 0, 0], "Focus Mask", comp.width, comp.height, 1);
        dark.moveBefore(original);
        dark.inPoint = comp.time;
        dark.outPoint = original.outPoint;

        var fxs = dark.property("Effects");
        var opaCtrl = fxs.addProperty("ADBE Slider Control"); opaCtrl.name = "Darkness";
        opaCtrl.property("Slider").setValue(opa);
        var fthCtrl = fxs.addProperty("ADBE Slider Control"); fthCtrl.name = "Feather";
        fthCtrl.property("Slider").setValue(fth);
        var roundCtrl = fxs.addProperty("ADBE Slider Control"); roundCtrl.name = "Roundness";
        roundCtrl.property("Slider").setValue(60);

        try { dark.property("Transform").property("Opacity").expression = "effect(\"Darkness\")(\"Slider\")"; } catch(ex) {}

        var maskProp = dark.property("Masks").addProperty("Mask");
        maskProp.property("maskShape").setValue(maskShapeVal);
        try { maskProp.property("maskExpansion").expression = "effect(\"Roundness\")(\"Slider\")"; } catch(ex) {}
        maskProp.maskMode = MaskMode.SUBTRACT;
        try {
            maskProp.property("maskFeather").expression = "var f = effect(\"Feather\")(\"Slider\"); [f, f]";
        } catch(ex) {
            maskProp.property("maskFeather").setValue([fth, fth]);
        }

        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

function pcFocusMaskAnimate(mode, easeOut, easeIn) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona la capa Focus Mask." });
    try {
        app.beginUndoGroup("Focus Mask " + mode);
        var comp = s.comp, layer = s.layers[0];
        var fps = comp.frameRate;

        // Try to animate the Darkness slider (if it exists via effect controls)
        var darkSlider = null;
        try { darkSlider = layer.property("Effects").property("Darkness").property("Slider"); } catch(ex) {}
        // Fallback to Opacity if no Darkness slider
        var prop = darkSlider || layer.property("Transform").property("Opacity");
        var maxVal = darkSlider ? 70 : 70;

        if (mode === "in") {
            var t0 = comp.time, t1 = t0 + (20 / fps);
            prop.setValueAtTime(t0, 0); prop.setValueAtTime(t1, maxVal);
            _pcApplyEaseScalar(prop, 1, 2, easeOut, easeIn);
        } else if (mode === "out") {
            var t0b = comp.time, t1b = t0b + (20 / fps);
            prop.setValueAtTime(t0b, maxVal); prop.setValueAtTime(t1b, 0);
            _pcApplyEaseScalar(prop, 1, 2, easeOut, easeIn);
        } else {
            var inPt = layer.inPoint, outPt = layer.outPoint;
            var dur = 20 / fps;
            prop.setValueAtTime(inPt, 0);
            prop.setValueAtTime(inPt + dur, maxVal);
            prop.setValueAtTime(outPt - dur, maxVal);
            prop.setValueAtTime(outPt, 0);
            var kIn = new KeyframeEase(0, easeIn), kOut = new KeyframeEase(0, easeOut);
            for (var k = 1; k <= 4; k++) prop.setTemporalEaseAtKey(k, [kIn], [kOut]);
        }
        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

// ─── ZOOM FOCUS ──────────────────────────────────────────────

function pcCreateZoomFocus(blurAmount, scaleFactor, easeOut, easeIn) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona una capa con máscara." });
    try {
        app.beginUndoGroup("Create Zoom Focus");
        var comp = s.comp, original = s.layers[0];
        var ba = blurAmount || 25;
        var sf = scaleFactor || 150;
        var eo = easeOut || 75;
        var ei = easeIn || 75;
        var masks = original.property("Masks");
        if (!masks || masks.numProperties === 0) {
            app.endUndoGroup();
            return JSON.stringify({ error: "Dibuja una máscara rectangular sobre el área a enfocar, luego presiona Create." });
        }
        var maskShapeVal = masks.property(1).property("maskShape").value;
        var verts = maskShapeVal.vertices;
        var minX = verts[0][0], maxX = verts[0][0], minY = verts[0][1], maxY = verts[0][1];
        for (var i = 1; i < verts.length; i++) {
            if (verts[i][0] < minX) minX = verts[i][0];
            if (verts[i][0] > maxX) maxX = verts[i][0];
            if (verts[i][1] < minY) minY = verts[i][1];
            if (verts[i][1] > maxY) maxY = verts[i][1];
        }
        var maskCenterX = (minX + maxX) / 2;
        var maskCenterY = (minY + maxY) / 2;
        var compCenterX = comp.width / 2;
        var compCenterY = comp.height / 2;
        var dup = original.duplicate();
        dup.name = "ZoomFocus_" + original.name;
        dup.inPoint = comp.time;
        original.property("Masks").property(1).remove();
        // Blur on original
        var fxsOrig = original.property("Effects");
        var blur = fxsOrig.addProperty("ADBE Gaussian Blur 2");
        blur.property("Blurriness").setValue(0);
        try { blur.property("Repeat Edge Pixels").setValue(1); } catch(e) {}
        // Mask Feather control on duplicate
        var fxsDup = dup.property("Effects");
        var mfCtrl = fxsDup.addProperty("ADBE Slider Control"); mfCtrl.name = "Mask Feather";
        mfCtrl.property("Slider").setValue(0);
        var roundCtrlZF = fxsDup.addProperty("ADBE Slider Control"); roundCtrlZF.name = "Roundness";
        roundCtrlZF.property("Slider").setValue(60);
        try { dup.property("Masks").property(1).property("maskFeather").expression = "var f = effect(\"Mask Feather\")(\"Slider\"); [f, f]"; } catch(ex) {}
        try { dup.property("Masks").property(1).property("maskExpansion").expression = "effect(\"Roundness\")(\"Slider\")"; } catch(ex) {}
        var posVal = dup.property("Transform").property("Position").value;
        var anchorVal = dup.property("Transform").property("Anchor Point").value;
        var maskCompX = posVal[0] - anchorVal[0] + maskCenterX;
        var maskCompY = posVal[1] - anchorVal[1] + maskCenterY;
        var targetPos = [posVal[0] + (compCenterX - maskCompX), posVal[1] + (compCenterY - maskCompY)];
        var fps = comp.frameRate;
        var dur = 20 / fps;
        var inPt = comp.time;
        var outPt = dup.outPoint;
        // Position keyframes
        var posProp = dup.property("Transform").property("Position");
        var kp1 = posProp.addKey(inPt); posProp.setValueAtKey(kp1, posVal);
        var kp2 = posProp.addKey(inPt + dur); posProp.setValueAtKey(kp2, targetPos);
        var kp3 = posProp.addKey(outPt - dur); posProp.setValueAtKey(kp3, targetPos);
        var kp4 = posProp.addKey(outPt); posProp.setValueAtKey(kp4, posVal);
        posProp.setInterpolationTypeAtKey(kp1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        posProp.setInterpolationTypeAtKey(kp2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        posProp.setInterpolationTypeAtKey(kp3, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        posProp.setInterpolationTypeAtKey(kp4, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        _pcApplyEaseScalar(posProp, kp1, kp2, eo, ei);
        _pcApplyEaseScalar(posProp, kp3, kp4, eo, ei);

        // Scale keyframes
        var scaleProp = dup.property("Transform").property("Scale");
        var origScale = scaleProp.value;
        var ks1 = scaleProp.addKey(inPt); scaleProp.setValueAtKey(ks1, origScale);
        var ks2 = scaleProp.addKey(inPt + dur); scaleProp.setValueAtKey(ks2, [sf, sf]);
        var ks3 = scaleProp.addKey(outPt - dur); scaleProp.setValueAtKey(ks3, [sf, sf]);
        var ks4 = scaleProp.addKey(outPt); scaleProp.setValueAtKey(ks4, origScale);
        scaleProp.setInterpolationTypeAtKey(ks1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        scaleProp.setInterpolationTypeAtKey(ks2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        scaleProp.setInterpolationTypeAtKey(ks3, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        scaleProp.setInterpolationTypeAtKey(ks4, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        _pcApplyEaseArray(scaleProp, ks1, ks2, eo, ei);
        _pcApplyEaseArray(scaleProp, ks3, ks4, eo, ei);

        // Blur keyframes
        var blurProp = blur.property("Blurriness");
        var kb1 = blurProp.addKey(inPt); blurProp.setValueAtKey(kb1, 0);
        var kb2 = blurProp.addKey(inPt + dur); blurProp.setValueAtKey(kb2, ba);
        var kb3 = blurProp.addKey(outPt - dur); blurProp.setValueAtKey(kb3, ba);
        var kb4 = blurProp.addKey(outPt); blurProp.setValueAtKey(kb4, 0);
        blurProp.setInterpolationTypeAtKey(kb1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        blurProp.setInterpolationTypeAtKey(kb2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        blurProp.setInterpolationTypeAtKey(kb3, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        blurProp.setInterpolationTypeAtKey(kb4, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        _pcApplyEaseScalar(blurProp, kb1, kb2, eo, ei);
        _pcApplyEaseScalar(blurProp, kb3, kb4, eo, ei);

        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

// ─── QUICK SCALE (ZOOMER) ────────────────────────────────────

function pcQuickScale(percentage) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona al menos una capa." });
    try {
        app.beginUndoGroup("Quick Scale +" + percentage + "%");
        for (var i = 0; i < s.layers.length; i++) {
            var sp = s.layers[i].property("Scale");
            if (sp) {
                var v = sp.value;
                var nv = v[0] + percentage;
                sp.setValue([nv, nv, v.length > 2 ? nv : 100]);
            }
        }
        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

function pcZoomToCorner(corner, durationFrames, zoomPercent, easeOut, easeIn) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona al menos una capa." });
    try {
        app.beginUndoGroup("Zoom to Corner");
        var comp = s.comp;
        var duration = durationFrames / comp.frameRate;
        var zoomFactor = zoomPercent / 100.0;
        var pivot;
        switch (corner) {
            case "topLeft": pivot = [0, 0]; break;
            case "topRight": pivot = [comp.width, 0]; break;
            case "bottomLeft": pivot = [0, comp.height]; break;
            case "bottomRight": pivot = [comp.width, comp.height]; break;
            default: pivot = [0, 0];
        }
        var t0 = comp.time, t1 = t0 + duration;

        for (var i = 0; i < s.layers.length; i++) {
            var layer = s.layers[i];
            var scaleProp = layer.property("Transform").property("Scale");
            var posProp = layer.property("Transform").property("Position");

            var s0 = scaleProp.valueAtTime(t0, false);
            var p0 = posProp.valueAtTime(t0, false);
            var s1 = [s0[0] * zoomFactor, s0[1] * zoomFactor];
            if (scaleProp.propertyValueType === PropertyValueType.ThreeD) s1.push(s0[2] * zoomFactor);

            var v0 = [p0[0] - pivot[0], p0[1] - pivot[1]];
            var p1 = [pivot[0] + v0[0] * zoomFactor, pivot[1] + v0[1] * zoomFactor];
            if (posProp.propertyValueType === PropertyValueType.ThreeD_SPATIAL) p1.push(p0[2]);

            var ks1 = scaleProp.addKey(t0); scaleProp.setValueAtKey(ks1, s0);
            var ks2 = scaleProp.addKey(t1); scaleProp.setValueAtKey(ks2, s1);
            scaleProp.setInterpolationTypeAtKey(ks1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            scaleProp.setInterpolationTypeAtKey(ks2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            _pcApplyEaseArray(scaleProp, ks1, ks2, easeOut, easeIn);

            var kp1 = posProp.addKey(t0); posProp.setValueAtKey(kp1, p0);
            var kp2 = posProp.addKey(t1); posProp.setValueAtKey(kp2, p1);
            posProp.setInterpolationTypeAtKey(kp1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            posProp.setInterpolationTypeAtKey(kp2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            _pcApplyEaseScalar(posProp, kp1, kp2, easeOut, easeIn);
        }
        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

function pcContinuousZoom(zoomPercent, fromPlayhead) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona al menos una capa." });
    try {
        var comp = s.comp;
        var zoomFactor = 1 + (zoomPercent / 100.0);
        app.beginUndoGroup("Continuous Zoom");
        for (var i = 0; i < s.layers.length; i++) {
            var layer = s.layers[i];
            var sp = layer.property("Scale");
            var startTime = fromPlayhead ? comp.time : layer.inPoint;
            var endTime = layer.outPoint;
            var startVal = sp.valueAtTime(startTime, false);
            var endVal = [startVal[0] * zoomFactor, startVal[1] * zoomFactor];
            if (sp.propertyValueType === PropertyValueType.ThreeD) endVal.push(startVal[2] * zoomFactor);
            if (!fromPlayhead) { while (sp.numKeys > 0) sp.removeKey(1); }
            sp.setValueAtTime(startTime, startVal);
            sp.setValueAtTime(endTime, endVal);
        }
        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

// ─── SOLID CREATOR ───────────────────────────────────────────

function pcSolidOrLayer(position, animate, durationFrames, easeOut, easeIn) {
    var comp = _pcRequireComp();
    if (!comp) return JSON.stringify({ error: "No hay composición activa." });
    try {
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length > 0) {
            app.beginUndoGroup("Move Layer " + position);
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                var posProp = layer.property("Transform").property("Position");
                var scaleProp = layer.property("Transform").property("Scale");

                var opposite = { "left":"right", "right":"left", "top":"bottom", "bottom":"top" }[position];
                var newPos;
                switch (opposite) {
                    case "left":   newPos = [comp.width * 0.25, comp.height / 2]; break;
                    case "right":  newPos = [comp.width * 0.75, comp.height / 2]; break;
                    case "top":    newPos = [comp.width / 2, comp.height * 0.25]; break;
                    case "bottom": newPos = [comp.width / 2, comp.height * 0.75]; break;
                }
                var newScale = [90, 90];

                if (animate) {
                    var duration = durationFrames / comp.frameRate;
                    var t0 = comp.time, t1 = t0 + duration;
                    var startPos = posProp.valueAtTime(t0, true);
                    var k1 = posProp.addKey(t0); posProp.setValueAtKey(k1, startPos);
                    var k2 = posProp.addKey(t1); posProp.setValueAtKey(k2, newPos);
                    posProp.setInterpolationTypeAtKey(k1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                    posProp.setInterpolationTypeAtKey(k2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                    _pcApplyEaseScalar(posProp, k1, k2, easeOut, easeIn);

                    if (position === "top" || position === "bottom") {
                        var startScale = scaleProp.valueAtTime(t0, true);
                        var s1 = scaleProp.addKey(t0); scaleProp.setValueAtKey(s1, startScale);
                        var s2 = scaleProp.addKey(t1); scaleProp.setValueAtKey(s2, newScale);
                        _pcApplyEaseArray(scaleProp, s1, s2, easeOut, easeIn);
                    }
                } else {
                    posProp.setValue(newPos);
                    if (position === "top" || position === "bottom") scaleProp.setValue(newScale);
                }
            }
            app.endUndoGroup();
        } else {
            app.beginUndoGroup("Create " + position + " Solid");
            var cw = comp.width, ch = comp.height;
            var solid = comp.layers.addSolid([1,1,1], position + " Solid", cw, ch, 1);
            var ms = new Shape(); ms.closed = true; var verts = [];
            switch (position) {
                case "left":   verts = [[0,0],[cw/2,0],[cw/2,ch],[0,ch]]; solid.name = "Left Half Solid"; break;
                case "right":  verts = [[cw/2,0],[cw,0],[cw,ch],[cw/2,ch]]; solid.name = "Right Half Solid"; break;
                case "top":    verts = [[0,0],[cw,0],[cw,ch/2],[0,ch/2]]; solid.name = "Top Half Solid"; break;
                case "bottom": verts = [[0,ch/2],[cw,ch/2],[cw,ch],[0,ch]]; solid.name = "Bottom Half Solid"; break;
            }
            var nm = solid.mask.addProperty("Mask");
            ms.vertices = verts;
            nm.property("Mask Path").setValue(ms);

            if (animate) {
                var duration = durationFrames / comp.frameRate;
                var mp = nm.property("Mask Path");
                var t0 = comp.time, finalShape = mp.valueAtTime(t0, false);
                var off = [0, 0];
                switch (position) {
                    case "left":   off[0] = -(cw / 2); break;
                    case "right":  off[0] = cw / 2; break;
                    case "top":    off[1] = -(ch / 2); break;
                    case "bottom": off[1] = ch / 2; break;
                }
                var ov = [];
                for (var v = 0; v < finalShape.vertices.length; v++)
                    ov.push([finalShape.vertices[v][0] + off[0], finalShape.vertices[v][1] + off[1]]);
                var startShape = new Shape();
                startShape.vertices = ov;
                startShape.inTangents = finalShape.inTangents;
                startShape.outTangents = finalShape.outTangents;
                startShape.closed = finalShape.closed;
                mp.setValueAtTime(t0, startShape);
                mp.setValueAtTime(t0 + duration, finalShape);
                _pcApplyEaseScalar(mp, 1, 2, easeOut, easeIn);
            }

            app.endUndoGroup();
        }
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

function pcAnimateMaskIn(durationFrames, easeOut, easeIn) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona una capa con máscara." });
    try {
        var comp = s.comp;
        var duration = durationFrames / comp.frameRate;
        app.beginUndoGroup("Animate Mask In");
        for (var i = 0; i < s.layers.length; i++) {
            var layer = s.layers[i];
            if (!layer.mask || layer.mask.numProperties === 0) continue;
            var mask = layer.mask(1);
            var mp = mask.property("Mask Path");
            if (mp.expression) mp.expression = "";

            var n = layer.name.toLowerCase(), dir = null;
            if (n.indexOf("left") > -1) dir = "left";
            else if (n.indexOf("right") > -1) dir = "right";
            else if (n.indexOf("top") > -1) dir = "top";
            else if (n.indexOf("bottom") > -1) dir = "bottom";
            if (!dir) continue;

            var t0 = comp.time, cs = mp.valueAtTime(t0, false);
            var off = [0, 0];
            switch (dir) { case "left": off[0] = -(comp.width/2); break; case "right": off[0] = comp.width/2; break; case "top": off[1] = -(comp.height/2); break; case "bottom": off[1] = comp.height/2; break; }
            var ov = [];
            for (var v = 0; v < cs.vertices.length; v++) ov.push([cs.vertices[v][0] + off[0], cs.vertices[v][1] + off[1]]);

            var os = new Shape();
            os.vertices = ov; os.inTangents = cs.inTangents; os.outTangents = cs.outTangents; os.closed = cs.closed;

            while (mp.numKeys > 0) mp.removeKey(1);
            mp.setValueAtTime(t0, os);
            mp.setValueAtTime(t0 + duration, cs);
            _pcApplyEaseScalar(mp, 1, 2, easeOut, easeIn);
        }
        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

// ─── MINI PROFESOR ───────────────────────────────────────────

function _pcCreateRoundedRectMatte(comp, w, h, r) {
    var sl = comp.layers.addShape();
    sl.name = "Mini_profesor Matte";
    var contents = sl.property("ADBE Root Vectors Group");
    var grp = contents.addProperty("ADBE Vector Group"); grp.name = "Rounded Rect";
    var gc = grp.property("ADBE Vectors Group");
    var rect = gc.addProperty("ADBE Vector Shape - Rect");
    rect.property("ADBE Vector Rect Size").setValue([w, h]);
    rect.property("ADBE Vector Rect Roundness").setValue(r);
    var fill = gc.addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue([0, 1, 0]);
    fill.property("ADBE Vector Fill Opacity").setValue(100);
    return sl;
}

function _pcSetLocalPosToParentCenter(layer) {
    var pp = layer.property("ADBE Transform Group").property("ADBE Position");
    if (!pp) return;
    var v = pp.value;
    pp.setValue(v instanceof Array && v.length === 3 ? [0,0,0] : [0,0]);
}

function _pcFitScaleToHeight(layer, matteH) {
    try {
        var srcH = (layer && layer.source && layer.source.height) ? layer.source.height : null;
        if (!srcH || srcH <= 0) return 100;
        return (matteH / srcH) * 100.0;
    } catch(e) { return 100; }
}

function _pcSetUniformScale(layer, pct) {
    var sp = layer.property("ADBE Transform Group").property("ADBE Scale");
    if (!sp) return;
    var v = sp.value;
    sp.setValue(v instanceof Array && v.length === 3 ? [pct,pct,pct] : [pct,pct]);
}

function pcMiniProfesor(side, xPct, yPct, animate, easeOut, easeIn) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona la capa del profesor." });
    try {
        var comp = s.comp, target = s.layers[0];
        app.beginUndoGroup("Mini Profesor - " + side);

        var cs = comp.height / 1080;
        var END_W = 600 * cs, END_H = 900 * cs, END_R = 100 * cs;
        var matte = _pcCreateRoundedRectMatte(comp, END_W, END_H, END_R);

        var xThird = comp.width / 3, yCenter = comp.height / 2;
        var xPos = side === "left" ? xThird : xThird * 2;
        var dir = side === "left" ? -1 : 1;
        var finalPos = [xPos + dir * (xPct / 100.0) * xThird, yCenter + (yPct / 100.0) * (comp.height / 2.0)];

        var mattePos = matte.property("ADBE Transform Group").property("ADBE Position");

        if (animate) {
            var t0 = comp.time, t1 = t0 + (20.0 / comp.frameRate);
            var mk1 = mattePos.addKey(t0); mattePos.setValueAtKey(mk1, [comp.width/2, comp.height/2]);
            var mk2 = mattePos.addKey(t1); mattePos.setValueAtKey(mk2, finalPos);
            try {
                mattePos.setInterpolationTypeAtKey(mk1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                mattePos.setInterpolationTypeAtKey(mk2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                _pcApplyEaseScalar(mattePos, mk1, mk2, easeOut, easeIn);
            } catch(_){}

            var rg = matte.property("ADBE Root Vectors Group").property("Rounded Rect");
            if (!rg) rg = matte.property("ADBE Root Vectors Group").property(1);
            var rc = rg.property("ADBE Vectors Group");
            var rs = rc.property("ADBE Vector Shape - Rect");
            var rSize = rs.property("ADBE Vector Rect Size");
            var rRound = rs.property("ADBE Vector Rect Roundness");

            var rs1 = rSize.addKey(t0); rSize.setValueAtKey(rs1, [comp.width, comp.height]);
            var rs2 = rSize.addKey(t1); rSize.setValueAtKey(rs2, [END_W, END_H]);
            try { _pcApplyEaseArray(rSize, rs1, rs2, easeOut, easeIn); } catch(_){}

            var rr1 = rRound.addKey(t0); rRound.setValueAtKey(rr1, 0);
            var rr2 = rRound.addKey(t1); rRound.setValueAtKey(rr2, END_R);
            try { _pcApplyEaseScalar(rRound, rr1, rr2, easeOut, easeIn); } catch(_){}
        } else {
            mattePos.setValue(finalPos);
            var rgNA = matte.property("ADBE Root Vectors Group").property("Rounded Rect");
            if (!rgNA) rgNA = matte.property("ADBE Root Vectors Group").property(1);
            var rcNA = rgNA.property("ADBE Vectors Group").property("ADBE Vector Shape - Rect");
            rcNA.property("ADBE Vector Rect Size").setValue([END_W, END_H]);
            rcNA.property("ADBE Vector Rect Roundness").setValue(END_R);
        }

        matte.moveBefore(target);
        target.parent = matte;
        _pcSetLocalPosToParentCenter(target);

        if (animate) {
            var camScale = target.property("ADBE Transform Group").property("ADBE Scale");
            var t0c = comp.time, t1c = t0c + (20.0 / comp.frameRate);
            var cs0 = camScale.valueAtTime(t0c, false);
            var fitS = _pcFitScaleToHeight(target, END_H);
            var cs1 = (camScale.propertyValueType === PropertyValueType.ThreeD) ? [fitS,fitS,fitS] : [fitS,fitS];
            var ck1 = camScale.addKey(t0c); camScale.setValueAtKey(ck1, cs0);
            var ck2 = camScale.addKey(t1c); camScale.setValueAtKey(ck2, cs1);
            try { _pcApplyEaseArray(camScale, ck1, ck2, easeOut, easeIn); } catch(_){}
        } else {
            _pcSetUniformScale(target, _pcFitScaleToHeight(target, END_H));
        }
        try { target.trackMatteType = TrackMatteType.ALPHA; } catch(_){}
        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

// ─── CORNER PROFESOR ─────────────────────────────────────────

function pcCornerProfesor(corner, circular, durationFrames, sizePx, animate, easeOut, easeIn) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona la capa del profesor." });
    try {
        var comp = s.comp, target = s.layers[0];
        app.beginUndoGroup("Corner Profesor - " + corner);

        var cs = comp.height / 1080;
        var END_W = sizePx * cs, END_H = sizePx * cs;
        var END_R = (circular ? 390 : 100) * cs;
        var matte = _pcCreateRoundedRectMatte(comp, END_W, END_H, END_R);

        var margin = 90 * cs;
        var matteTr = matte.property("ADBE Transform Group");
        var mattePos = matteTr.property("ADBE Position");
        var matteScale = matteTr.property("ADBE Scale");
        var msp = 50;

        var vhw = (END_W * (msp / 100.0)) / 2.0;
        var vhh = (END_H * (msp / 100.0)) / 2.0;
        var px = (corner === "topRight" || corner === "bottomRight") ? comp.width - margin - vhw : margin + vhw;
        var py = (corner === "bottomLeft" || corner === "bottomRight") ? comp.height - margin - vhh : margin + vhh;
        var finalPos = [px, py];

        if (animate) {
            var frames = durationFrames; if (isNaN(frames) || frames <= 0) frames = 20;
            var t0 = comp.time, t1 = t0 + (frames / comp.frameRate);

            var k1 = mattePos.addKey(t0); mattePos.setValueAtKey(k1, [comp.width/2, comp.height/2]);
            var k2 = mattePos.addKey(t1); mattePos.setValueAtKey(k2, finalPos);
            try {
                mattePos.setInterpolationTypeAtKey(k1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                mattePos.setInterpolationTypeAtKey(k2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                _pcApplyEaseScalar(mattePos, k1, k2, easeOut, easeIn);
            } catch(_){}

            var rg = matte.property("ADBE Root Vectors Group").property("Rounded Rect");
            if (!rg) rg = matte.property("ADBE Root Vectors Group").property(1);
            var rc = rg.property("ADBE Vectors Group").property("ADBE Vector Shape - Rect");
            var rSize = rc.property("ADBE Vector Rect Size");
            var rRound = rc.property("ADBE Vector Rect Roundness");

            var rs1 = rSize.addKey(t0); rSize.setValueAtKey(rs1, [comp.width, comp.height]);
            var rs2 = rSize.addKey(t1); rSize.setValueAtKey(rs2, [END_W, END_H]);
            try { _pcApplyEaseArray(rSize, rs1, rs2, easeOut, easeIn); } catch(_){}

            var rr1 = rRound.addKey(t0); rRound.setValueAtKey(rr1, 0);
            var rr2 = rRound.addKey(t1); rRound.setValueAtKey(rr2, END_R);
            try { _pcApplyEaseScalar(rRound, rr1, rr2, easeOut, easeIn); } catch(_){}

            var ms1 = matteScale.addKey(t0); matteScale.setValueAtKey(ms1, [100, 100]);
            var ms2 = matteScale.addKey(t1); matteScale.setValueAtKey(ms2, [msp, msp]);
            try { _pcApplyEaseArray(matteScale, ms1, ms2, easeOut, easeIn); } catch(_){}

            var camScale = target.property("ADBE Transform Group").property("ADBE Scale");
            var cs0 = camScale.valueAtTime(t0, false);
            var fitS = _pcFitScaleToHeight(target, END_H);
            var cs1 = (camScale.propertyValueType === PropertyValueType.ThreeD) ? [fitS,fitS,fitS] : [fitS,fitS];
            var c1 = camScale.addKey(t0); camScale.setValueAtKey(c1, cs0);
            var c2 = camScale.addKey(t1); camScale.setValueAtKey(c2, cs1);
            try { _pcApplyEaseArray(camScale, c1, c2, easeOut, easeIn); } catch(_){}
        } else {
            mattePos.setValue(finalPos);
            matteScale.setValue([msp, msp]);
            var rgNA = matte.property("ADBE Root Vectors Group").property("Rounded Rect");
            if (!rgNA) rgNA = matte.property("ADBE Root Vectors Group").property(1);
            var rcNA = rgNA.property("ADBE Vectors Group").property("ADBE Vector Shape - Rect");
            rcNA.property("ADBE Vector Rect Size").setValue([END_W, END_H]);
            rcNA.property("ADBE Vector Rect Roundness").setValue(END_R);
        }

        matte.moveBefore(target);
        target.parent = matte;
        _pcSetLocalPosToParentCenter(target);
        try { target.trackMatteType = TrackMatteType.ALPHA; } catch(_){}
        if (!animate) _pcSetUniformScale(target, _pcFitScaleToHeight(target, END_H));
        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

// ─── Save Log ────────────────────────────────────────────────────
function saveLogToFile(jsonString) {
    try {
        var downloads = Folder("~/Downloads");
        var base = downloads.exists ? downloads : Folder.desktop;

        var now = new Date();
        var pad = function(n) { return n < 10 ? "0" + n : "" + n; };
        var filename = "PlatziComposerPro_log_" + now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
            "_" + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds()) + ".json";

        var file = new File(base.fsName + "/" + filename);
        file.encoding = "UTF-8";
        file.open("w");
        file.write(jsonString);
        file.close();

        return JSON.stringify({ success: true, path: file.fsName });
    } catch(e) {
        return JSON.stringify({ error: e.toString() });
    }
}

// ─── Update from GitHub ──────────────────────────────────────────
function runGitPull() {
    try {
        var script = 'do shell script "cd ~/Movies/Platzi-Composer-Pro && git pull origin main 2>&1"';
        var result = app.doScript(script, ScriptLanguage.APPLESCRIPT);
        return JSON.stringify({ success: true, output: result });
    } catch(e) {
        return JSON.stringify({ error: e.toString() });
    }
}
