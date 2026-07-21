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

function pcCreateHighlighter(roundCaps) {
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
            pathGrp.property("Path").expression = "createPath([[0,0],[effect(\"Length\")(1),0]], [], [], false)";
        } catch(ex) {}

        var stroke = rc.addProperty("ADBE Vector Graphic - Stroke");
        stroke.property("Color").setValue([1, 1, 0]);
        stroke.property("Stroke Width").setValue(30);
        try { stroke.property("Stroke Width").expression = "effect(\"Thickness\")(1)"; } catch(ex) {}
        try { stroke.property("Color").expression = "effect(\"Color\")(1)"; } catch(ex) {}
        // Puntas: 1=Butt (rectas), 2=Round (redondeadas)
        try { stroke.property("ADBE Vector Stroke Line Cap").setValue(roundCaps ? 2 : 1); } catch(ex) {}

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
                "createPath([[0,0],[effect(\"Length\")(1),0]], [], [], false)";
        } catch(ex) {
            // createPath not available in this AE version, keep static path
        }

        // Stroke
        var stroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
        stroke.property("Color").setValue([1, 1, 0]);
        try { stroke.property("Stroke Width").expression = "effect(\"Thickness\")(1)"; } catch(ex) {}
        try { stroke.property("Color").expression = "effect(\"Color\")(1)"; } catch(ex) {}

        // Dashed style: add dashes to stroke
        if (style === "dashed") {
            try {
                var dashes = stroke.property("Dashes");
                var dash = dashes.addProperty("ADBE Vector Stroke Dash 1");
                dash.expression = "effect(\"Dash Length\")(1)";
                var gap = dashes.addProperty("ADBE Vector Stroke Gap 1");
                gap.expression = "effect(\"Gap Length\")(1)";
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
            try { thunPaths.property("ADBE Vector Roughen Size").expression = "effect(\"Thunder Amount\")(1)"; } catch(ex) {}
            try { thunPaths.property("ADBE Vector Roughen Detail").expression = "effect(\"Thunder Detail\")(1)"; } catch(ex) {}
            try { thunPaths.property("ADBE Vector Temporal Freq").expression = "effect(\"Thunder Speed\")(1)"; } catch(ex) {}
        }


        // Trim Paths (MUST be last operator for animation to work)
        var trim = grpContents.addProperty("ADBE Vector Filter - Trim");
        trim.property("End").setValue(100);
        // Flip direction via Offset expression (0=normal, check=180°)
        try {
            var flipCtrl = fxs.addProperty("ADBE Checkbox Control"); flipCtrl.name = "Flip Direction";
            flipCtrl.property("Checkbox").setValue(0);
            trim.property("ADBE Vector Trim Offset").expression = "effect(\"Flip Direction\")(1) * 180";
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
                    // Copy ease as-is (same Out/In values, only time is reversed)
                    try {
                        if (keys[m].easeIn.length > 0 && keys[m].easeOut.length > 0) {
                            var newIn = [], newOut = [];
                            for (var ne = 0; ne < keys[m].easeIn.length; ne++) {
                                newIn.push(new KeyframeEase(keys[m].easeIn[ne].speed, keys[m].easeIn[ne].influence));
                            }
                            for (var no = 0; no < keys[m].easeOut.length; no++) {
                                newOut.push(new KeyframeEase(keys[m].easeOut[no].speed, keys[m].easeOut[no].influence));
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

function pcCreateHighlightBox(mode, easeOut, easeIn, enableGlow, roundness) {
    var _rnd = (roundness === undefined || roundness === null || isNaN(roundness)) ? 20 : roundness;
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
            var roundCtrl = fxs.addProperty("ADBE Slider Control"); roundCtrl.name = "Redondez";
            roundCtrl.property("Slider").setValue(_rnd);

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
                        "var pad = thisLayer.effect(\"Padding\")(1);" +
                        "[" + box.boxW + " + pad*2, " + box.boxH + " + pad*2]";
                } catch(ex) {
                    rect.property("ADBE Vector Rect Size").setValue([box.boxW + 20, box.boxH + 20]);
                }
            }

            var stroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
            stroke.property("Color").setValue([0.039, 0.914, 0.541]);
            try { stroke.property("Stroke Width").expression = "effect(\"Thickness\")(1)"; } catch(ex) {}
            try { stroke.property("Color").expression = "effect(\"Color\")(1)"; } catch(ex) {}

            // Round Corners operator
            var rc = grpContents.addProperty("ADBE Vector Filter - RC");
            try { rc.property("ADBE Vector RoundCorner Radius").expression = "effect(\"Redondez\")(1)"; } catch(ex) {}

            var trim = grpContents.addProperty("ADBE Vector Filter - Trim");
            trim.property("End").setValue(100);
            // Flip direction via Offset expression
            try {
                var flipCtrl = fxs.addProperty("ADBE Checkbox Control"); flipCtrl.name = "Flip Direction";
                flipCtrl.property("Checkbox").setValue(0);
                trim.property("ADBE Vector Trim Offset").expression = "effect(\"Flip Direction\")(1) * 180";
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


// Devuelve una copia del Shape con las esquinas redondeadas por 'radius' px.
// Reforma el path metiendo 2 vértices por esquina + tangentes bezier (arco ~circular).
function _pcRoundMaskShape(sh, radius) {
    if (!radius || radius <= 0) return sh;
    var v = sh.vertices;
    var n = v.length;
    if (n < 3) return sh;
    var K = 0.5523; // aproximación de cuarto de círculo con bezier
    var nv = [], ni = [], no = [];
    for (var i = 0; i < n; i++) {
        var cur = v[i];
        var prev = v[(i - 1 + n) % n];
        var nxt = v[(i + 1) % n];
        var dpx = prev[0] - cur[0], dpy = prev[1] - cur[1];
        var dnx = nxt[0] - cur[0], dny = nxt[1] - cur[1];
        var lp = Math.sqrt(dpx*dpx + dpy*dpy);
        var ln = Math.sqrt(dnx*dnx + dny*dny);
        if (lp === 0 || ln === 0) { nv.push(cur); ni.push([0,0]); no.push([0,0]); continue; }
        var r = Math.min(radius, lp / 2, ln / 2);
        var A = [cur[0] + (dpx/lp)*r, cur[1] + (dpy/lp)*r]; // sobre la arista previa
        var B = [cur[0] + (dnx/ln)*r, cur[1] + (dny/ln)*r]; // sobre la arista siguiente
        nv.push(A); ni.push([0,0]); no.push([(cur[0]-A[0])*K, (cur[1]-A[1])*K]);
        nv.push(B); ni.push([(cur[0]-B[0])*K, (cur[1]-B[1])*K]); no.push([0,0]);
    }
    var out = new Shape();
    out.vertices = nv;
    out.inTangents = ni;
    out.outTangents = no;
    out.closed = true;
    return out;
}

// Genera una EXPRESIÓN para el maskPath que redondea el path base según el slider
// "Redondez" — así la redondez de la máscara queda editable después de crear.
function _pcMaskRoundExpr(shape) {
    var v = shape.vertices, parts = [];
    for (var i = 0; i < v.length; i++) { parts.push("[" + v[i][0] + "," + v[i][1] + "]"); }
    var lit = "[" + parts.join(",") + "]";
    return "var r=effect(\"Redondez\")(1);var vs=" + lit + ";var n=vs.length;" +
        "if(r<=0||n<3){createPath(vs,[],[],true);}else{var K=0.5523;var nv=[],ni=[],no=[];" +
        "for(var i=0;i<n;i++){var c=vs[i],p=vs[(i-1+n)%n],q=vs[(i+1)%n];" +
        "var dpx=p[0]-c[0],dpy=p[1]-c[1],dnx=q[0]-c[0],dny=q[1]-c[1];" +
        "var lp=Math.sqrt(dpx*dpx+dpy*dpy),ln=Math.sqrt(dnx*dnx+dny*dny);" +
        "if(lp==0||ln==0){nv.push(c);ni.push([0,0]);no.push([0,0]);continue;}" +
        "var rr=Math.min(r,lp/2,ln/2);" +
        "var A=[c[0]+dpx/lp*rr,c[1]+dpy/lp*rr],B=[c[0]+dnx/ln*rr,c[1]+dny/ln*rr];" +
        "nv.push(A);ni.push([0,0]);no.push([(c[0]-A[0])*K,(c[1]-A[1])*K]);" +
        "nv.push(B);ni.push([(c[0]-B[0])*K,(c[1]-B[1])*K]);no.push([0,0]);}" +
        "createPath(nv,ni,no,true);}";
}

// ─── FOCUS MASK ──────────────────────────────────────────────

function pcCreateFocusMask(opacityVal, featherVal, roundness) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona una capa con máscara." });
    try {
        app.beginUndoGroup("Create Focus Mask");
        var comp = s.comp, original = s.layers[0];
        var opa = opacityVal || 70;
        var fth = featherVal || 20;
        var rnd = (roundness === undefined || roundness === null || isNaN(roundness)) ? 0 : roundness;

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

        try { dark.property("Transform").property("Opacity").expression = "effect(\"Darkness\")(1)"; } catch(ex) {}

        var maskProp = dark.property("Masks").addProperty("Mask");
        // Redondez horneada en el path al crear (la versión estable que sí mostraba bien la zona).
        maskProp.property("maskShape").setValue(_pcRoundMaskShape(maskShapeVal, rnd));
        // maskExpansion queda en 0 (antes un slider "Roundness"=60 lo expandía y
        // agrandaba la zona clara 60px respecto a lo dibujado).
        maskProp.maskMode = MaskMode.SUBTRACT;
        try {
            maskProp.property("maskFeather").expression = "var f = effect(\"Feather\")(1); [f, f]";
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

function pcCreateZoomFocus(blurAmount, scaleFactor, easeOut, easeIn, roundness) {
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
        // El corte (inPoint) se hace AL FINAL de la función, no acá: setearlo antes
        // de reconstruir máscara/efectos/keyframes no "pega" en capas linked/MOGRT y
        // la capa quedaba extendida hacia atrás (desde el inicio del clip original)
        // en vez de cortada donde arranca el movimiento.

        // Reconstruir la máscara del duplicado desde cero. NO confiar en la máscara
        // copiada por duplicate(): en AE 2026 (sobre todo con precomps / linked comps
        // / MOGRT como "[SR]" / "[CAM]") la máscara copiada llegaba vacía o en modo
        // None, dejando el recorte totalmente transparente al soloear. Creamos una
        // máscara nueva, le seteamos el shape capturado y forzamos modo ADD.
        var dupMasks = dup.property("Masks");
        while (dupMasks.numProperties > 0) { dupMasks.property(dupMasks.numProperties).remove(); }
        var dupMask = dupMasks.addProperty("Mask");
        dupMask.property("maskShape").setValue(maskShapeVal);
        try { dupMask.maskMode = MaskMode.ADD; } catch(exMode) {}

        // El original pierde su máscara y se vuelve el fondo blureado a pantalla completa.
        original.property("Masks").property(1).remove();
        // Blur on original
        var fxsOrig = original.property("Effects");
        var blur = fxsOrig.addProperty("ADBE Gaussian Blur 2");
        blur.property("Blurriness").setValue(0);
        try { blur.property("Repeat Edge Pixels").setValue(1); } catch(e) {}
        // Mask Feather / Roundness controls on duplicate
        var fxsDup = dup.property("Effects");
        var mfCtrl = fxsDup.addProperty("ADBE Slider Control"); mfCtrl.name = "Mask Feather";
        mfCtrl.property("Slider").setValue(0);
        // Roundness viene de la interfaz (input "Redondez" del panel). Antes estaba
        // hardcodeado en 60 e ignoraba el valor de la UI. Si no llega, default 0.
        var rn = (roundness === undefined || roundness === null || isNaN(roundness)) ? 0 : roundness;
        var roundCtrlZF = fxsDup.addProperty("ADBE Slider Control"); roundCtrlZF.name = "Roundness";
        roundCtrlZF.property("Slider").setValue(rn);
        try { dupMask.property("maskFeather").expression = "var f = effect(\"Mask Feather\")(1); [f, f]"; } catch(ex) {}
        try { dupMask.property("maskExpansion").expression = "effect(\"Roundness\")(1)"; } catch(ex) {}

        var posVal = dup.property("Transform").property("Position").value;
        var anchorVal = dup.property("Transform").property("Anchor Point").value;
        // El escalado ocurre alrededor del anchor point, así que la posición destino
        // debe compensar por el factor de escala FINAL para que el centro de la máscara
        // caiga en el centro del comp EN EL PICO del zoom.
        //   compPoint = position + (layerPoint - anchor) * (scale/100)
        //   compCenter = targetPos + (maskCenter - anchor) * k
        //   => targetPos = compCenter - (maskCenter - anchor) * k
        var kScale = sf / 100;
        var targetPos = [
            compCenterX - (maskCenterX - anchorVal[0]) * kScale,
            compCenterY - (maskCenterY - anchorVal[1]) * kScale
        ];
        var fps = comp.frameRate;
        var dur = 20 / fps;
        var inPt = comp.time;
        // El zoom es un pulso hacia ADELANTE desde el playhead: in -> hold -> out.
        // Antes outPt = dup.outPoint (fin del clip original). Si el playhead estaba al
        // final del clip (outPoint ~= playhead), los keyframes de hold/out (outPt - dur)
        // caían ANTES del playhead => toda la animación quedaba hacia atrás y el trim de
        // inPoint fallaba (inPt >= outPoint). Ahora garantizamos espacio hacia adelante:
        // si el clip original no tiene largo suficiente adelante, extendemos su outPoint.
        var origIn = dup.inPoint;
        var origOut = dup.outPoint;
        var minSpan = 3 * dur; // in (dur) + hold (dur) + out (dur) mínimo
        var outPt;
        if (origOut - inPt >= minSpan) {
            outPt = origOut;                 // hay clip adelante: el hold llega hasta el fin
        } else {
            outPt = inPt + minSpan;          // no hay: extendemos la capa hacia adelante
            try { dup.outPoint = outPt; } catch(eOut) {}
        }
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

        // Cortar el duplicado para que ARRANQUE exactamente donde empieza el
        // movimiento (el playhead). Se hace acá, después de máscara/efectos/keyframes,
        // porque en capas linked/MOGRT setearlo al inicio no cortaba la capa y quedaba
        // extendida hacia atrás. El primer keyframe (inPt) coincide con este inPoint.
        var trimErr = "";
        try {
            dup.inPoint = inPt;
            // BUG AE 2026 en capas linked/MOGRT: al setear inPoint el outPoint se
            // corrompe a un negativo gigante (ej. -1237s) y la capa queda invertida
            // ("hacia atrás"). Lo restauramos al final correcto DESPUÉS del inPoint.
            dup.outPoint = outPt;
        } catch(eTrim) { trimErr = eTrim.toString(); }

        // Sanity check: solo avisa si el corte quedó inválido (outPoint <= inPoint).
        // Si quedó bien, no molesta con popups.
        if (dup.outPoint <= dup.inPoint) {
            try {
                alert("ZoomFocus v1.5.18 — outPoint aún mal:\n" +
                    "inPoint=" + dup.inPoint + "\noutPoint=" + dup.outPoint +
                    "\noutPt objetivo=" + outPt + "\ntrimErr=" + (trimErr || "(ninguno)"));
            } catch(eAlert) {}
        }

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

// Limpia todos los keyframes de una propiedad para poder aplicar animación nueva
// sin importar si ya tenía keyframes/stopwatch activado.
function _pcClearKeys(prop) {
    if (!prop) return;
    try { for (var i = prop.numKeys; i >= 1; i--) { prop.removeKey(i); } } catch(_){}
}

// setValue seguro: si la propiedad ya tiene keyframes, no se puede usar setValue()
// (AE lanza error) — se escribe el valor en cada keyframe existente.
function _pcSafeSetValue(prop, val) {
    if (!prop) return;
    if (prop.numKeys > 0) {
        for (var i = 1; i <= prop.numKeys; i++) { prop.setValueAtKey(i, val); }
    } else {
        prop.setValue(val);
    }
}

function _pcSetLocalPosToParentCenter(layer) {
    var pp = layer.property("ADBE Transform Group").property("ADBE Position");
    if (!pp) return;
    var v = pp.value;
    _pcSafeSetValue(pp, v instanceof Array && v.length === 3 ? [0,0,0] : [0,0]);
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
    _pcSafeSetValue(sp, v instanceof Array && v.length === 3 ? [pct,pct,pct] : [pct,pct]);
}

function pcMiniProfesor(side, xPct, yPct, animate, easeOut, easeIn) {
    var s = _pcRequireSelected();
    if (!s) return JSON.stringify({ error: "Selecciona la capa del profesor." });
    try {
        var comp = s.comp, target = s.layers[0];
        app.beginUndoGroup("Mini Profesor - " + side);

        // Normaliza la capa del profesor: limpia keyframes previos de Pos/Escala
        // para aplicar la animación sin importar el estado de keyframes previo.
        var _tTr = target.property("ADBE Transform Group");
        _pcClearKeys(_tTr.property("ADBE Position"));
        _pcClearKeys(_tTr.property("ADBE Scale"));

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

        // Shape layer starts at animation time
        matte.inPoint = target.inPoint;

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

            // Add Position keyframes on camera for editor adjustment
            var camPos = target.property("ADBE Transform Group").property("ADBE Position");
            var camPosVal = camPos.valueAtTime(t1c, false);
            var cpk1 = camPos.addKey(t0c); camPos.setValueAtKey(cpk1, camPosVal);
            var cpk2 = camPos.addKey(t1c); camPos.setValueAtKey(cpk2, camPosVal);
            try {
                camPos.setInterpolationTypeAtKey(cpk1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                camPos.setInterpolationTypeAtKey(cpk2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                _pcApplyEaseScalar(camPos, cpk1, cpk2, easeOut, easeIn);
            } catch(_){}

            // Add Scale keyframes on matte (shape layer) for editor adjustment
            var matteScaleProp = matte.property("ADBE Transform Group").property("ADBE Scale");
            var matteScaleVal = matteScaleProp.valueAtTime(t1c, false);
            var msk1 = matteScaleProp.addKey(t0c); matteScaleProp.setValueAtKey(msk1, matteScaleVal);
            var msk2 = matteScaleProp.addKey(t1c); matteScaleProp.setValueAtKey(msk2, matteScaleVal);
            try {
                matteScaleProp.setInterpolationTypeAtKey(msk1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                matteScaleProp.setInterpolationTypeAtKey(msk2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                _pcApplyEaseArray(matteScaleProp, msk1, msk2, easeOut, easeIn);
            } catch(_){}
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

        // Normaliza la capa del profesor: limpia keyframes previos de Pos/Escala
        // para aplicar la animación sin importar el estado de keyframes previo.
        var _tTr = target.property("ADBE Transform Group");
        _pcClearKeys(_tTr.property("ADBE Position"));
        _pcClearKeys(_tTr.property("ADBE Scale"));

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

        // Shape layer starts at animation time
        matte.inPoint = target.inPoint;

        matte.moveBefore(target);
        target.parent = matte;
        _pcSetLocalPosToParentCenter(target);
        try { target.trackMatteType = TrackMatteType.ALPHA; } catch(_){}
        if (!animate) _pcSetUniformScale(target, _pcFitScaleToHeight(target, END_H));

        // Add Position keyframes on camera for editor adjustment (Corner)
        if (animate) {
            var camPosC = target.property("ADBE Transform Group").property("ADBE Position");
            var frames = durationFrames; if (isNaN(frames) || frames <= 0) frames = 20;
            var t0p = comp.time, t1p = t0p + (frames / comp.frameRate);
            var camPosCVal = camPosC.valueAtTime(t1p, false);
            var cpkC1 = camPosC.addKey(t0p); camPosC.setValueAtKey(cpkC1, camPosCVal);
            var cpkC2 = camPosC.addKey(t1p); camPosC.setValueAtKey(cpkC2, camPosCVal);
            try {
                camPosC.setInterpolationTypeAtKey(cpkC1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                camPosC.setInterpolationTypeAtKey(cpkC2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                _pcApplyEaseScalar(camPosC, cpkC1, cpkC2, easeOut, easeIn);
            } catch(_){}
        }

        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

// ─── TEXT HELPER ────────────────────────────────────────────────

function pcTextHelper(animType, mode, animMode, durationFrames, enableGlow, easeOut, easeIn) {
    var comp = _pcRequireComp();
    if (!comp) return JSON.stringify({ error: "No hay composici\u00f3n activa." });
    try {
        app.beginUndoGroup("Text Helper - " + animType);
        var textLayer;

        // Auto-detect: if a text layer is selected, apply to it; otherwise create new
        var sel = comp.selectedLayers;
        if (sel && sel.length > 0 && sel[0] instanceof TextLayer) {
            textLayer = sel[0];
        } else {
            // Create new text layer
            textLayer = comp.layers.addText("Tu texto aqu\u00ed");
            textLayer.property("Position").setValue([comp.width / 2, comp.height / 2]);
            var textDoc = textLayer.property("ADBE Text Properties").property("ADBE Text Document").value;
            textDoc.fontSize = 80;
            textDoc.fillColor = [1, 1, 1];
            textDoc.font = "Arial";
            textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
            textLayer.property("ADBE Text Properties").property("ADBE Text Document").setValue(textDoc);
        }

        // Access Text Animators
        var textProp = textLayer.property("ADBE Text Properties");
        var animators = textProp.property("ADBE Text Animators");

        // Remove existing animators
        for (var a = animators.numProperties; a >= 1; a--) {
            animators.property(a).remove();
        }

        // Add animator based on type
        var animator = animators.addProperty("ADBE Text Animator");
        animator.name = "PlatziAnim_" + animType;
        var animProps = animator.property("ADBE Text Animator Properties");
        var selectors = animator.property("ADBE Text Selectors");
        var rangeSel = selectors.addProperty("ADBE Text Selector");
        var advanced = rangeSel.property("ADBE Text Range Advanced");

        // Set range selector to animate character by character
        // Use property("Start") and property("End") by display name
        var rangeStart = rangeSel.property("Start");
        var rangeEnd = rangeSel.property("End");

        // Animation duration in frames
        var fps = comp.frameRate;
        var t0 = comp.time;
        var totalDur = durationFrames / fps;
        var t1 = t0 + totalDur;

        // Based On from mode: char=1, word=3, line=4
        var basedOnVal = 1; // char
        if (mode === "word") basedOnVal = 3;
        if (mode === "line") basedOnVal = 4;
        // Typewriter always char-by-char
        if (animType === "typewriter") basedOnVal = 1;
        try { advanced.property("Based On").setValue(basedOnVal); } catch(ex) {}

        // Animate based on animMode (in, out, inout)
        if (animMode === "in" || animMode === "inout") {
            var ks1 = rangeStart.addKey(t0); rangeStart.setValueAtKey(ks1, 0);
            var ks2 = rangeStart.addKey(t1); rangeStart.setValueAtKey(ks2, 100);
            try {
                rangeStart.setInterpolationTypeAtKey(ks1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                rangeStart.setInterpolationTypeAtKey(ks2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                _pcApplyEaseScalar(rangeStart, ks1, ks2, easeOut, easeIn);
            } catch(ex) {}
        }
        if (animMode === "out" || animMode === "inout") {
            // Out animation: 5 seconds after playhead (or after In ends)
            var outStart = (animMode === "inout") ? t0 + 5.0 : t0;
            var outEnd = outStart + totalDur;
            var ko1 = rangeStart.addKey(outStart); rangeStart.setValueAtKey(ko1, 100);
            var ko2 = rangeStart.addKey(outEnd); rangeStart.setValueAtKey(ko2, 0);
            try {
                rangeStart.setInterpolationTypeAtKey(ko1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                rangeStart.setInterpolationTypeAtKey(ko2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                var kCount = rangeStart.numKeys;
                _pcApplyEaseScalar(rangeStart, kCount - 1, kCount, easeOut, easeIn);
            } catch(ex) {}
        }
        if (animMode === "out" && rangeStart.numKeys === 2) {
            // For out-only, set initial state to fully visible (Start=100)
            rangeStart.setValueAtKey(1, 100);
        }

        // Set animator properties based on animation type
        if (animType === "typewriter") {
            var opacityProp = animProps.addProperty("ADBE Text Opacity");
            opacityProp.setValue(0);
        } else if (animType === "fade-up") {
            var opacityProp2 = animProps.addProperty("ADBE Text Opacity");
            opacityProp2.setValue(0);
            var posProp = animProps.addProperty("ADBE Text Position 3D");
            posProp.setValue([0, 30, 0]);
        } else if (animType === "fade-down") {
            var opFD = animProps.addProperty("ADBE Text Opacity");
            opFD.setValue(0);
            var posFD = animProps.addProperty("ADBE Text Position 3D");
            posFD.setValue([0, -30, 0]);
        } else if (animType === "fade-left") {
            var opFL = animProps.addProperty("ADBE Text Opacity");
            opFL.setValue(0);
            var posFL = animProps.addProperty("ADBE Text Position 3D");
            posFL.setValue([40, 0, 0]);
        } else if (animType === "fade-right") {
            var opFR = animProps.addProperty("ADBE Text Opacity");
            opFR.setValue(0);
            var posFR = animProps.addProperty("ADBE Text Position 3D");
            posFR.setValue([-40, 0, 0]);
        } else if (animType === "scale-pop") {
            var scaleProp = animProps.addProperty("ADBE Text Scale 3D");
            scaleProp.setValue([0, 0, 100]);
        } else if (animType === "blur-reveal") {
            var opBR = animProps.addProperty("ADBE Text Opacity");
            opBR.setValue(0);
            var trackProp = animProps.addProperty("ADBE Text Tracking Amount");
            trackProp.setValue(50);
        } else if (animType === "bounce") {
            var posBounce = animProps.addProperty("ADBE Text Position 3D");
            posBounce.setValue([0, -50, 0]);
            var opBounce = animProps.addProperty("ADBE Text Opacity");
            opBounce.setValue(0);
        }

        // Add Effect Controls for editor adjustment
        var fxs = textLayer.property("Effects");
        var colorCtrl = fxs.addProperty("ADBE Color Control"); colorCtrl.name = "Text Color";
        colorCtrl.property("Color").setValue([1, 1, 1]);

        // Glow (always added, enabled/disabled based on checkbox)
        var glow = fxs.addProperty("ADBE Glo2");
        glow.name = "Text Glow";
        try { glow.property("Glow Threshold").setValue(153); } catch(ex) {}
        try { glow.property("Glow Radius").setValue(25); } catch(ex) {}
        try { glow.property("Glow Intensity").setValue(1); } catch(ex) {}
        glow.enabled = enableGlow;

        // Link text color via expression
        try {
            textLayer.property("ADBE Text Properties").property("ADBE Text Document").expression =
                "var c = thisLayer.effect(\"Text Color\")(1);" +
                "var txt = value;" +
                "txt.fillColor = c;" +
                "txt;";
        } catch(ex) {}

        app.endUndoGroup();
        return JSON.stringify({ success: true, type: animType });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

// ─── TEXT BOX (recuadro responsive) ──────────────────────────────
// Crea un recuadro (shape layer) detrás del texto, responsive vía
// sourceRectAtTime + padding, emparentado al texto. Si withAnim=1 agrega
// una animación de entrada fade-up (abajo->arriba) por Character/Word/Line.
// El tamaño de la caja se muestrea en un tiempo FIJO (fin de la animación)
// para que no tiemble mientras entran las letras.
function pcCreateTextBox(mode, withAnim, roundness, padding, bgColor, textColor, durationFrames, easeOut, easeIn) {
    var comp = _pcRequireComp();
    if (!comp) return JSON.stringify({ error: "No hay composición activa." });
    try {
        app.beginUndoGroup("Text Box");
        var fps = comp.frameRate;
        var t0 = comp.time;
        var totalDur = durationFrames / fps;
        var t1 = t0 + totalDur;
        var doAnim = (withAnim == 1 || withAnim === true || withAnim === "1");

        // Normaliza colores (Color Control = 4D [r,g,b,a]; fillColor de texto = 3D)
        var textColor3 = [textColor[0], textColor[1], textColor[2]];
        var textColor4 = [textColor[0], textColor[1], textColor[2], 1];
        var bgColor4 = [bgColor[0], bgColor[1], bgColor[2], 1];

        // 1) Obtener o crear la capa de texto
        var textLayer;
        var created = false;
        var sel = comp.selectedLayers;
        if (sel && sel.length > 0 && sel[0] instanceof TextLayer) {
            textLayer = sel[0];
        } else {
            textLayer = comp.layers.addText("Tu texto aquí");
            textLayer.position.setValue([comp.width / 2, comp.height / 2]);
            var td = textLayer.property("ADBE Text Properties").property("ADBE Text Document").value;
            td.fontSize = 80;
            td.fillColor = textColor3;
            td.font = "Arial";
            td.justification = ParagraphJustification.CENTER_JUSTIFY;
            textLayer.property("ADBE Text Properties").property("ADBE Text Document").setValue(td);
            created = true;
        }

        // Color de texto: ESTÁTICO en el Text Document (las expresiones fallan en
        // este AE — mismo motivo que la caja). Aplica a todo el texto seleccionado.
        var tdProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document");
        var tdVal = tdProp.value;
        try { tdVal.applyFill = true; } catch(ex) {}
        tdVal.fillColor = textColor3;
        tdProp.setValue(tdVal);

        // 2) Animación de entrada (solo el texto) fade-up por char/word/line
        if (doAnim) {
            var textProp = textLayer.property("ADBE Text Properties");
            var animators = textProp.property("ADBE Text Animators");
            var animator = animators.addProperty("ADBE Text Animator");
            animator.name = "PlatziBoxAnim";
            var animProps = animator.property("ADBE Text Animator Properties");
            var op = animProps.addProperty("ADBE Text Opacity"); op.setValue(0);
            var posA = animProps.addProperty("ADBE Text Position 3D"); posA.setValue([0, 30, 0]);
            var selectors = animator.property("ADBE Text Selectors");
            var rangeSel = selectors.addProperty("ADBE Text Selector");
            var advanced = rangeSel.property("ADBE Text Range Advanced");
            var basedOnVal = 1; // char
            if (mode === "word") basedOnVal = 3;
            if (mode === "line") basedOnVal = 4;
            try { advanced.property("Based On").setValue(basedOnVal); } catch(ex) {}
            var rangeStart = rangeSel.property("Start");
            var ks1 = rangeStart.addKey(t0); rangeStart.setValueAtKey(ks1, 0);
            var ks2 = rangeStart.addKey(t1); rangeStart.setValueAtKey(ks2, 100);
            try {
                rangeStart.setInterpolationTypeAtKey(ks1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                rangeStart.setInterpolationTypeAtKey(ks2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                _pcApplyEaseScalar(rangeStart, ks1, ks2, easeOut, easeIn);
            } catch(ex) {}
        }

        // 3) Medir el texto con sourceRectAtTime de SCRIPTING (confiable en este AE;
        //    el log confirmó que mide bien, p.ej. 1059x65). NO usamos expresiones para
        //    el tamaño: en este AE sourceRectAtTime en EXPRESIÓN devuelve 0 y arruinaba
        //    la caja. Enfoque estático (como el script que funciona del compañero).
        //    Para el caso animado muestreamos al final (t1), texto ya completo.
        var candTimes = doAnim ? [t1, t1 + 0.001, t0, comp.time] : [t0, comp.time, t0 + 0.001, textLayer.inPoint + 0.001];
        var srt = null;
        for (var ci = 0; ci < candTimes.length; ci++) {
            try {
                var r = textLayer.sourceRectAtTime(candTimes[ci], false);
                if (r && r.width > 0) { srt = r; break; }
                if (r && !srt) { srt = r; }
            } catch(ex) {}
        }
        if (!srt || srt.width <= 0) {
            app.endUndoGroup();
            return JSON.stringify({ error: "No pude medir el texto (sourceRectAtTime=0). ¿La capa tiene texto visible en el playhead?" });
        }

        var txtW = srt.width, txtH = srt.height;
        var shapeW = txtW + padding * 2;
        var shapeH = txtH + padding * 2;

        // Centro del texto en coordenadas de COMP (sin emparentar, sin expresiones).
        // Accesores .position/.anchorPoint son a prueba de idioma (ES/EN).
        var txtPos = textLayer.position.value;
        var anchor = textLayer.anchorPoint.value;
        var centerX = txtPos[0] + (srt.left + txtW / 2) - anchor[0];
        var centerY = txtPos[1] + (srt.top + txtH / 2) - anchor[1];

        // 4) Crear la shape layer del recuadro (ESTÁTICO: tamaño y posición horneados).
        var box = comp.layers.addShape();
        box.name = (created ? "Text" : textLayer.name) + " Box";
        box.moveAfter(textLayer);
        try { box.inPoint = textLayer.inPoint; box.outPoint = textLayer.outPoint; } catch(ex) {}
        // Posición absoluta en comp y LUEGO emparentar al texto. El setter .parent
        // compensa la transformación (no salta), así que la caja queda en su lugar
        // y además sigue al texto si lo movés. (setParentWithJump sí saltaría.)
        box.position.setValue([centerX, centerY]);
        try { box.parent = textLayer; } catch(ex) {}

        var root = box.property("ADBE Root Vectors Group");
        var grp = root.addProperty("ADBE Vector Group"); grp.name = "Box";
        var grpContents = grp.property("ADBE Vectors Group");
        var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
        rect.property("ADBE Vector Rect Size").setValue([shapeW, shapeH]);
        rect.property("ADBE Vector Rect Position").setValue([0, 0]);
        try { rect.property("ADBE Vector Rect Roundness").setValue(roundness); } catch(ex) {}
        var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");

        // Color de fondo: ESTÁTICO en el Fill (sin expresión, por el mismo motivo
        // que el resto — confiable en este AE). El color se elige desde el panel.
        fill.property("ADBE Vector Fill Color").setValue(bgColor4);

        app.endUndoGroup();
        return JSON.stringify({
            success: true,
            created: created,
            animated: doAnim,
            textLayer: textLayer.name,
            srcWidth: Math.round(txtW),
            srcHeight: Math.round(txtH),
            boxW: Math.round(shapeW),
            boxH: Math.round(shapeH)
        });
    } catch(e) { app.endUndoGroup(); return JSON.stringify({ error: e.toString() }); }
}

// ─── ANNOTATIONS ─────────────────────────────────────────────────

function pcCreateAnnotation(annType, thickness, enableGlow, easeOut, easeIn) {
    var comp = _pcRequireComp();
    if (!comp) return JSON.stringify({ error: "No hay composici\u00f3n activa." });
    try {
        app.beginUndoGroup("Annotation - " + annType);
        var layer = comp.layers.addShape();
        layer.name = "Annotation_" + annType;

        var fxs = layer.property("Effects");
        var thkCtrl = fxs.addProperty("ADBE Slider Control"); thkCtrl.name = "Thickness";
        thkCtrl.property("Slider").setValue(thickness);
        var colorCtrl = fxs.addProperty("ADBE Color Control"); colorCtrl.name = "Color";
        colorCtrl.property("Color").setValue([0.039, 0.914, 0.541]);

        // Position at center
        layer.property("Transform").property("Position").setValue([comp.width / 2, comp.height / 2]);

        var contents = layer.property("Contents");
        var grp = contents.addProperty("ADBE Vector Group"); grp.name = "AnnotGroup";
        var grpContents = grp.property("Contents");

        if (annType === "arrow") {
            // Arrow: line + arrowhead
            var path = grpContents.addProperty("ADBE Vector Shape - Group");
            var pathData = new Shape();
            pathData.vertices = [[-150, 0], [150, 0]];
            pathData.closed = false;
            path.property("Path").setValue(pathData);
            var stroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
            stroke.property("Color").setValue([0.039, 0.914, 0.541]);
            try { stroke.property("Stroke Width").expression = "effect(\"Thickness\")(1)"; } catch(ex) {}
            try { stroke.property("Color").expression = "effect(\"Color\")(1)"; } catch(ex) {}
            // Arrowhead group
            var arrowGrp = contents.addProperty("ADBE Vector Group"); arrowGrp.name = "Arrowhead";
            var arrowC = arrowGrp.property("Contents");
            var arrowPath = arrowC.addProperty("ADBE Vector Shape - Group");
            var ap = new Shape();
            ap.vertices = [[120, -20], [150, 0], [120, 20]];
            ap.closed = false;
            arrowPath.property("Path").setValue(ap);
            var arrowStroke = arrowC.addProperty("ADBE Vector Graphic - Stroke");
            arrowStroke.property("Color").setValue([0.039, 0.914, 0.541]);
            try { arrowStroke.property("Stroke Width").expression = "effect(\"Thickness\")(1)"; } catch(ex) {}
            try { arrowStroke.property("Color").expression = "effect(\"Color\")(1)"; } catch(ex) {}

        } else if (annType === "circle") {
            var ellipse = grpContents.addProperty("ADBE Vector Shape - Ellipse");
            ellipse.property("ADBE Vector Ellipse Size").setValue([200, 200]);
            var stroke2 = grpContents.addProperty("ADBE Vector Graphic - Stroke");
            stroke2.property("Color").setValue([0.039, 0.914, 0.541]);
            try { stroke2.property("Stroke Width").expression = "effect(\"Thickness\")(1)"; } catch(ex) {}
            try { stroke2.property("Color").expression = "effect(\"Color\")(1)"; } catch(ex) {}

        } else if (annType === "callout") {
            // Line + rectangle
            var linePath = grpContents.addProperty("ADBE Vector Shape - Group");
            var lp = new Shape();
            lp.vertices = [[0, 0], [100, -80]];
            lp.closed = false;
            linePath.property("Path").setValue(lp);
            var lineStroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
            lineStroke.property("Color").setValue([0.039, 0.914, 0.541]);
            try { lineStroke.property("Stroke Width").expression = "effect(\"Thickness\")(1)"; } catch(ex) {}
            try { lineStroke.property("Color").expression = "effect(\"Color\")(1)"; } catch(ex) {}
            // Box
            var boxGrp = contents.addProperty("ADBE Vector Group"); boxGrp.name = "CalloutBox";
            var boxC = boxGrp.property("Contents");
            var rect = boxC.addProperty("ADBE Vector Shape - Rect");
            rect.property("ADBE Vector Rect Size").setValue([200, 60]);
            rect.property("ADBE Vector Rect Roundness").setValue(8);
            var boxStroke = boxC.addProperty("ADBE Vector Graphic - Stroke");
            boxStroke.property("Color").setValue([0.039, 0.914, 0.541]);
            try { boxStroke.property("Stroke Width").expression = "effect(\"Thickness\")(1)"; } catch(ex) {}
            try { boxStroke.property("Color").expression = "effect(\"Color\")(1)"; } catch(ex) {}
            boxGrp.property("Transform").property("Position").setValue([200, -80]);

        } else if (annType === "bracket") {
            var bracketPath = grpContents.addProperty("ADBE Vector Shape - Group");
            var bp = new Shape();
            bp.vertices = [[-20, -100], [0, -100], [0, 100], [-20, 100]];
            bp.closed = false;
            bracketPath.property("Path").setValue(bp);
            var bracketStroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
            bracketStroke.property("Color").setValue([0.039, 0.914, 0.541]);
            try { bracketStroke.property("Stroke Width").expression = "effect(\"Thickness\")(1)"; } catch(ex) {}
            try { bracketStroke.property("Color").expression = "effect(\"Color\")(1)"; } catch(ex) {}

        } else if (annType === "underline") {
            var ulPath = grpContents.addProperty("ADBE Vector Shape - Group");
            var ulp = new Shape();
            ulp.vertices = [[-150, 0], [150, 0]];
            ulp.closed = false;
            ulPath.property("Path").setValue(ulp);
            var ulStroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
            ulStroke.property("Color").setValue([0.039, 0.914, 0.541]);
            try { ulStroke.property("Stroke Width").expression = "effect(\"Thickness\")(1)"; } catch(ex) {}
            try { ulStroke.property("Color").expression = "effect(\"Color\")(1)"; } catch(ex) {}
        }

        // Add Trim Paths for draw-on animation
        var trim = grpContents.addProperty("ADBE Vector Filter - Trim");
        var fps = comp.frameRate;
        var dur = 20 / fps;
        var t0 = comp.time, t1 = t0 + dur;
        var te1 = trim.property("End").addKey(t0); trim.property("End").setValueAtKey(te1, 0);
        var te2 = trim.property("End").addKey(t1); trim.property("End").setValueAtKey(te2, 100);
        try { _pcApplyEaseScalar(trim.property("End"), te1, te2, easeOut, easeIn); } catch(ex) {}

        // Flip Direction control
        var flipCtrl = fxs.addProperty("ADBE Checkbox Control"); flipCtrl.name = "Flip Direction";
        try { trim.property("ADBE Vector Trim Offset").expression = "effect(\"Flip Direction\")(1) * 180"; } catch(ex) {}

        // Glow
        if (enableGlow) {
            var glow = fxs.addProperty("ADBE Glo2");
            glow.name = "Annotation Glow";
            try { glow.property("Glow Threshold").setValue(158); } catch(ex) {}
            try { glow.property("Glow Radius").setValue(20); } catch(ex) {}
            try { glow.property("Glow Intensity").setValue(1); } catch(ex) {}
        }

        app.endUndoGroup();
        return JSON.stringify({ success: true, type: annType });
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
        // Get the actual extension path dynamically
        var scriptFile = new File($.fileName);
        var extPath = scriptFile.parent.parent.fsName;
        var cmd = "cd \"" + extPath + "\" && git pull origin main 2>&1";
        var result = system.callSystem(cmd);
        return JSON.stringify({ success: true, output: result });
    } catch(e) {
        return JSON.stringify({ error: e.toString() });
    }
}
