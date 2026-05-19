# Platzi Composer Pro

Extensión CEP para After Effects — herramientas de animación y productividad para el equipo de video de Platzi.

## Instalación (desarrollo)

```bash
# Symlink a CEP extensions
ln -sf "$(pwd)" "/Library/Application Support/Adobe/CEP/extensions/Platzi-Composer-Pro"
```

## Estructura

```
CSXS/manifest.xml    → Configuración CEP (bundle ID, hosts, versión)
client/              → Frontend (HTML/CSS/JS del panel)
host/                → ExtendScript (lógica AE)
```

## Bundle ID
`com.codigo.aespellcheck` (legacy — pendiente renombrar a `com.platzi.composerpro`)

## Notas
- Host: After Effects 16.0+ (CC 2019+)
- Runtime: CSXS 9.0
- Panel: "Platzi Composer Pro" en Window → Extensions
