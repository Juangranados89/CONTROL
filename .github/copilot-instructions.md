# Copilot instructions — CONTROL

Breve guía para que un agente de codificación sea productivo rápidamente en este repositorio.

- **Propósito del proyecto:** aplicación SPA Vite + React para gestión de flota (dashboard, generación de OT/PDF, importación desde CSV/Excel).

- **Comandos principales:**

  ```bash
  npm install
  npm run dev        # inicia Vite en http://localhost:5173/
  npm run dev -- --host  # exponer en red
  npm run build
  npm run preview
  npm run lint
  ```

- **Arquitectura esencial (qué leer primero):**
  - [src/main.jsx](src/main.jsx) monta la app.
  - [src/App.jsx](src/App.jsx) contiene la UI principal: dashboard, lógica de cálculo de métricas, generación de PDF y componentes visuales (monolito importante — dividir si haces cambios grandes).
  - [src/data.js](src/data.js) contiene `INITIAL_FLEET` y `MAINTENANCE_ROUTINES` (datos generados desde Excel). Cambiar rutinas de mantenimiento ahí actualiza la lógica mostrada en el dashboard.
  - [index.html](index.html) carga `jspdf` y `papaparse` desde CDN — la función `generatePDF` en `App.jsx` depende de `window.jspdf` y de `/logo.png` en `public/`.

- **Patrones y convenciones del repositorio:**
  - Proyecto ESM (`type: "module"` en `package.json`).
  - Estilo UI basado en Tailwind (`tailwind.config.js`, `src/index.css`).
  - Iconos con `lucide-react`, gráficos con `recharts`.
  - Datos de flota y rutinas se mantienen en `src/data.js` (archivo grande generado). Prefiere editar el origen (Excel / `extracted_routines_v2.json`) cuando sea posible.
  - No se detectaron workflows CI/PR automáticos en el repo.

- **Puntos de integración y riesgos conocidos:**
  - La carga de imágenes para PDF usa `getBase64ImageFromURL` en el cliente; en entornos locales CORS puede bloquear la lectura de `/logo.png` si el asset no existe o la ruta es distinta.
  - `index.html` incluye `jspdf` y `papaparse` por CDN — cambios en esas APIs requieren verificar `generatePDF` y parsing CSV en `src/*`.

- **Dónde agregar código nuevo:**
  - Crear componentes pequeños en `src/components/` y exportarlos en `src/App.jsx` para mantener la tersura del monolito.
  - Guardar assets en `public/` (ej.: `public/logo.png`).

- **Ejemplos rápidos (modificar rutina):**
  - Edita la entrada correspondiente en `MAINTENANCE_ROUTINES` dentro de [src/data.js](src/data.js). Busca claves numéricas (intervalos km) y variantes (`RAM`, `JMC`).

- **Comprobaciones al abrir el proyecto:**
  1. `npm install` — si en Windows falla con PowerShell, usar `npm.cmd install` desde PowerShell o abrir CMD.
  2. `npm run dev` — abrir `http://localhost:5173/`.
  3. Verificar en consola mensajes de Vite y atajos (`o` para abrir navegador, `u` para URL).

Si quieres, fusiono/ajusto este borrador con cualquier documentación existente o amplío secciones concretas (por ejemplo: estructura detallada de `MAINTENANCE_ROUTINES`, cómo importar Excel original). Indica qué prefieres.
