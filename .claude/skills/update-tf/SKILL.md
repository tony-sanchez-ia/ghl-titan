---
name: update-tf
description: "Actualizar Titan Factory a la ultima version. Activar cuando el usuario dice: actualiza el template, hay nueva version, update Titan Factory, quiero la ultima version, o cuando se detecta que el template esta desactualizado."
allowed-tools: Read, Bash
---

# Update Titan Factory

Este skill actualiza las herramientas de desarrollo (carpeta `.claude/`) a la ultima version disponible.

## Proceso

### Paso 1: Buscar el alias titan-factory

Busca el alias `titan-factory` en los archivos de configuracion del shell del usuario:

```bash
# Buscar en zshrc
grep "alias titan-factory" ~/.zshrc

# Si no esta, buscar en bashrc
grep "alias titan-factory" ~/.bashrc
```

El alias tiene este formato:
```bash
alias titan-factory="cp -r /ruta/al/repo/titan-factory/. ."
```

**Extrae la ruta del repo** del alias (la parte entre `cp -r ` y `/titan-factory/.`).

Si no encuentras el alias, pregunta al usuario:
> No encontre el alias `titan-factory`. Por favor, indica la ruta donde tienes el repositorio de Titan Factory.

### Paso 2: Actualizar el repositorio fuente

Una vez tengas la ruta del repo, actualiza con git:

```bash
cd [RUTA_REPO_TF]
git pull origin main
```

Si hay errores de git (cambios locales, etc.), informa al usuario y sugiere solucion.

### Paso 3: Reemplazar .claude/

Elimina la carpeta `.claude/` actual del proyecto y copia la nueva:

```bash
# En el directorio del proyecto actual
rm -rf .claude/
cp -r [RUTA_REPO_TF]/titan-factory/.claude/ .claude/
```

### Paso 4: Confirmar actualizacion

Informa al usuario:

```
Titan Factory actualizado correctamente.

Cambios aplicados:
- .claude/skills/ (skills actualizados)
- .claude/PRPs/ (templates PRP actualizados)
- .claude/skills/ai/references/ (AI templates actualizados)
- .claude/design-systems/ (sistemas de diseno actualizados)

Archivos NO modificados:
- CLAUDE.md (tu configuracion de proyecto)
- .mcp.json (tus tokens y credenciales)
- src/ (tu codigo)
```

## Notas

- Este skill NO modifica `CLAUDE.md`, `.mcp.json` ni el codigo fuente
- Solo actualiza la "toolbox" de desarrollo
- Si necesitas actualizar `CLAUDE.md` manualmente, revisa el template en el repo TF
