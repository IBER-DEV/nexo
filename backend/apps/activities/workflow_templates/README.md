# Plantillas de flujo (`workflow_templates/`)

Cada archivo `.json` en esta carpeta es una plantilla completa de maestros
(estados, prioridades, tipos) que se puede aplicar a una organización nueva.
Agregar una plantilla **no requiere tocar código ni migraciones** — solo
crear el archivo; `org_templates.py` las descubre automáticamente (`glob`)
al arrancar.

El nombre del archivo (sin `.json`) es la clave de la plantilla — debe
coincidir con el campo `slug` interno.

## Reglas que toda plantilla debe cumplir

El loader valida esto al arrancar y falla ruidosamente si no se cumple:

- Exactamente **un** estado con `is_initial: true`.
- Al menos **un** estado con `categoria: "done"`.
- `categoria` de cada estado debe ser una de: `todo`, `active`, `done`, `cancelled`
  (son las únicas que el resto del sistema conoce — reportes, sync AppSheet, etc.).
- Exactamente **una** prioridad con `is_default: true`.
- Slugs únicos dentro de cada lista (`states`, `priorities`, `types`).

Fuera de eso, todo es libre: nombres, colores, cantidad de estados, si hay
tipos de actividad o no. Ver `mesa_ayuda.json` para un flujo con nombres y
categorías completamente distintos a `ti_clasico.json` usando las mismas
4 categorías internas.

## Qué pasa al aplicar una plantilla

`apply_template(org, slug, ...)` **copia** cada fila de la plantilla como un
registro nuevo propio de la organización — nunca hay una referencia
compartida entre orgs ni con el archivo de la plantilla. Una vez creados,
esos estados/prioridades/tipos son 100% de la organización: se editan desde
Configuración → Maestros como cualquier otro, y nada los vuelve a
sincronizar con la plantilla original. Las plantillas solo se aplican en el
momento de crear la organización (ver `apps/organizations/admin.py`).

## Campos

| Campo | Tipo | Notas |
|---|---|---|
| `slug` | string | Debe coincidir con el nombre del archivo |
| `version` | int | Súbelo si cambias una plantilla ya publicada, para poder distinguir instalaciones creadas con v1 de las creadas con v2 |
| `display_name` | string | Lo que ve el admin al crear la organización |
| `description` | string | Una línea explicando el flujo |
| `recommended_for` | string[] | Solo informativo, para una futura UI de selección |
| `is_system` | bool | `true` para las plantillas que vienen con Nexo. Reservado para cuando existan plantillas de terceros/comunidad |
| `states[]` | objeto | `slug`, `nombre`, `categoria`, `color` (`#RRGGBB`), `orden`, `is_initial`, `mostrar_en_kanban`, `sheet_phase` (opcional, vacío si no aplica) |
| `priorities[]` | objeto | `slug`, `nombre`, `color`, `orden`, `is_default` |
| `types[]` | objeto | `slug`, `nombre`, `color`, `orden` — puede ser una lista vacía |
