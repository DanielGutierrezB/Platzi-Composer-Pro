# Platzi Composer Pro

Panel de After Effects para producción de cursos en Platzi. Automatiza tareas repetitivas de motion graphics y post-producción.

![Version](https://img.shields.io/badge/version-1.1.0-purple)
![AE](https://img.shields.io/badge/After%20Effects-2019%2B-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)

## Herramientas

### 🎯 SpellCheck IA
Analiza capas de texto con IA (Ollama local, OpenAI, Anthropic, Google) para detectar errores ortográficos y de estilo.

### ⚡ Ease & Scale
- **Apply Ease** — Aplica ease in/out a keyframes seleccionados con valores configurables (OUT/IN)
- **Apply on Playhead** — Aplica ease en la posición actual del playhead
- **Quick Scale** — Zoom +5%, +10%, +20% con un clic
- **Continuous Zoom** — Zoom progresivo durante la capa

### 🔦 Highlighter (4 tipos)
- **✨ Stroke** — Línea horizontal estirable con Trim Paths. Effect Controls: Length, Thickness, Color
- **── Line** — Subrayado fino con opción de Glow. Effect Controls: Length, Thickness, Color
- **◼ Focus Mask** — Oscurece todo excepto el área seleccionada. Effect Controls: Darkness, Feather
- **🔍 Zoom Focus** — Zoom animado a un área con blur de fondo. Effect Controls: Blur Amount, Mask Feather

**Workflow de Focus Mask / Zoom Focus:**
1. Dibuja una máscara rectangular en tu capa (screen recording)
2. Clic en Create → el script lee la máscara y genera el efecto automáticamente

**Modifiers (solo Highlighter):**
- Click = crear sin animación
- Shift+Click = crear con In/Out
- Alt+Click = crear con solo In
- Shift+Alt+Click = crear con solo Out

### 🎥 Profesor Views
- **👤 Mini Profesor** — Mueve la cámara del profesor a los lados (X%, Y%)
- **📐 Corner Profesor** — Mueve la cámara a una esquina con zoom (TL/TR/BL/BR)

### 🔧 Utilidades
- **Zoomer** — Zoom animado con duración configurable
- **Solid Creator** — Crea sólidos de color rápidamente
- **Flip Horizontal** — Voltea capas seleccionadas

## Instalación

### Opción 1: Symlink (desarrollo)
```bash
# macOS
ln -s /path/to/Platzi-Composer-Pro ~/Library/Application\ Support/Adobe/CEP/extensions/com.platzi.composer

# Habilitar extensiones sin firmar
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

### Opción 2: ZXP
Empaquetar con ZXPSignCmd y instalar con Anastasiy's Extension Manager o similar.

## Actualización
El panel incluye botón de actualización (🔄) que hace `git pull` automáticamente.

## Estructura
```
Platzi-Composer-Pro/
├── CSXS/manifest.xml          # Configuración CEP
├── VERSION                     # Versión actual (leída por el panel)
├── client/
│   ├── index.html             # UI del panel
│   ├── css/styles.css         # Estilos (dark theme)
│   └── js/
│       ├── main.js            # Lógica principal del panel
│       ├── CSInterface.js     # Adobe CEP bridge
│       ├── ai-analyzer.js     # Integración IA (SpellCheck)
│       ├── spellcheck-engine.js
│       └── context-rules.js
└── host/
    └── index.jsx              # ExtendScript (acceso a AE API)
```

## Configuración

### SpellCheck IA
- **Ollama** (default): Ejecutar `ollama serve` con modelo compatible (ej: mistral-small3.1)
- **Cloud**: Configurar API key en Settings (OpenAI, Anthropic, Google)

### Defaults
Cada grupo de inputs tiene botones 💾 (guardar) y ↩ (restaurar) para personalizar valores default.

## Requisitos
- After Effects 2019+ (CEP 9+)
- macOS 10.14+ o Windows 10+
- Para SpellCheck: Ollama instalado o API key de proveedor cloud

## Desarrollo
```bash
git clone https://github.com/DanielGutierrezB/Platzi-Composer-Pro.git
cd Platzi-Composer-Pro

# Symlink para desarrollo
ln -s "$(pwd)" ~/Library/Application\ Support/Adobe/CEP/extensions/com.platzi.composer

# Debug mode
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

## Licencia
Uso interno Platzi.
