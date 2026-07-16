# Contribuir a Nexo

¡Gracias por tu interés en contribuir! Nexo es una plataforma open source de gestión de
actividades para equipos de TI, y toda contribución — código, documentación, reportes de
bugs, traducciones — es bienvenida.

## Cómo empezar

1. Haz fork del repositorio y clónalo.
2. Sigue las instrucciones de desarrollo local del [README](README.md) (frontend con
   `npm run dev`, backend nativo o con `docker compose up`).
3. Crea una rama descriptiva: `git checkout -b fix/descripcion-corta` o
   `feat/descripcion-corta`.

## Antes de abrir un Pull Request

Verifica que todo pase localmente — el CI ejecuta exactamente esto:

```bash
# Frontend
npm run lint          # ESLint, sin errores
npx tsc --noEmit      # TypeScript estricto
npm run build         # el build debe completar

# Backend
cd backend
python manage.py test # las pruebas deben pasar
```

## Convenciones

- **Commits**: mensajes en imperativo, concisos, en español o inglés
  (`Fix week rollover in planning view`, `Corrige desbordamiento en tabla`).
- **Frontend**: TypeScript + Prettier (config del repo). Los componentes UI base viven en
  `src/components/ui/` (shadcn) — evita modificarlos salvo necesidad justificada.
- **Backend**: sigue el estilo de las apps existentes (`apps/activities`, `apps/users`).
  Todo cambio de modelo necesita su migración (`python manage.py makemigrations`).
- **Un PR = un cambio**: PRs pequeños y enfocados se revisan más rápido.

## Reportar bugs y proponer features

Usa las plantillas de issues del repositorio. Para bugs incluye pasos de reproducción,
comportamiento esperado vs. actual, y capturas si aplica.

## Seguridad

No reportes vulnerabilidades en issues públicos. Contacta a los mantenedores de forma
privada (ver perfil de GitHub del propietario del repositorio).

## Licencia

Al contribuir, aceptas que tu contribución se licencia bajo la
[AGPL-3.0](LICENSE), la misma licencia del proyecto.
