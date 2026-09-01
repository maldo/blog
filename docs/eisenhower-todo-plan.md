# Eisenhower Todo — Plan de proyecto

App personal de tareas organizadas en la matriz de Eisenhower (urgente × importante),
desplegada en Cloudflare bajo `todo.maldo.dev`.

Estado: **planificación**. Nada implementado todavía.

---

## 1. Decisiones tomadas

| Decisión | Elección | Por qué |
|---|---|---|
| Datos | Cloud desde el día 1 (D1) | Sync entre móvil y escritorio desde el principio |
| UI interactiva | Svelte 5 como island de Astro | Bundle mínimo, runes cómodas para este estado, `svelte-dnd-action` da drag & drop entre cuadrantes casi gratis |
| Despliegue | Worker aparte en `todo.maldo.dev` | El blog sigue siendo estático puro; la app tiene su propio Worker, su D1 y su ciclo de deploy |
| Ubicación en el repo | `apps/todo/` dentro de `maldo/blog`, con pnpm workspace | No tengo permiso para crear un repo nuevo; workspace mantiene un solo lockfile y `pnpm --filter todo dev` |

### Decisión abierta (necesito tu OK antes de la Fase 2)

**Autenticación.** Recomiendo **Cloudflare Access** (Zero Trust): pones la app detrás de una
política que solo deja pasar a tu email, y el Worker verifica el JWT que Access inyecta.
Cero código de login, cero gestión de contraseñas, gratis hasta 50 usuarios.
La alternativa es OAuth propio (GitHub/Google) con cookie de sesión en KV: más control y
una landing pública posible, pero ~200 líneas de código de auth que hay que mantener bien.

---

## 2. Arquitectura

```
                    todo.maldo.dev
                          │
              ┌───────────┴────────────┐
              │  Cloudflare Access     │   política: email = almalpez@proton.me
              │  (Zero Trust)          │   inyecta Cf-Access-Jwt-Assertion
              └───────────┬────────────┘
                          │
              ┌───────────┴────────────────────────────┐
              │  Worker: astro + @astrojs/cloudflare   │
              │                                        │
              │  middleware.ts  → verifica JWT         │
              │                   locals.user          │
              │  pages/index.astro                     │
              │    └─ <Matrix client:load />  (Svelte) │
              │  pages/api/tasks/*.ts  (prerender=false)│
              └───────────┬────────────────────────────┘
                          │ binding DB
                   ┌──────┴──────┐
                   │  D1 (SQLite)│   tasks, users
                   └─────────────┘
```

**Por qué D1 y no KV/R2/Durable Objects**

- **KV** es eventualmente consistente a nivel global (una escritura puede tardar ~60s en
  propagarse) y no permite consultar "las tareas del usuario ordenadas por posición" sin
  escanear una lista. Para datos que editas y reordenas constantemente es la herramienta
  equivocada.
- **R2** es para blobs. Sirve si algún día adjuntas ficheros a una tarea, no para las tareas.
- **Durable Objects** solo hacen falta si quieres sync en tiempo real entre dos pestañas
  abiertas a la vez. No es el caso en v1; se puede añadir después sin rehacer el modelo.
- **D1** es SQLite: consultas relacionales, transacciones, índices. Es lo que pide este dominio.

---

## 3. Modelo de datos

La clave del diseño: **la fuente de verdad son los dos booleanos `urgent` e `important`**,
no el cuadrante. El cuadrante es la proyección 2×2 de esos dos campos. Así, arrastrar una
tarjeta de un cuadrante a otro es simplemente cambiar uno o los dos flags, y más adelante se
puede derivar `urgent` automáticamente de la fecha límite sin tocar el esquema.

| `important` | `urgent` | Cuadrante | Acción |
|---|---|---|---|
| 1 | 1 | Q1 | Hacer ya |
| 1 | 0 | Q2 | Planificar |
| 0 | 1 | Q3 | Delegar |
| 0 | 0 | Q4 | Eliminar |

```sql
-- migrations/0001_init.sql
CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id           TEXT PRIMARY KEY,          -- UUID v7 (ordenable por tiempo)
  user_id      TEXT NOT NULL REFERENCES users(id),
  title        TEXT NOT NULL,
  notes        TEXT,
  urgent       INTEGER NOT NULL DEFAULT 0 CHECK (urgent IN (0,1)),
  important    INTEGER NOT NULL DEFAULT 0 CHECK (important IN (0,1)),
  position     REAL    NOT NULL,          -- índice fraccional dentro del cuadrante
  due_at       TEXT,                      -- ISO 8601 UTC, nullable
  completed_at TEXT,                      -- NULL = pendiente
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT                       -- borrado lógico (necesario para sync)
);

CREATE INDEX idx_tasks_board
  ON tasks (user_id, deleted_at, completed_at, important, urgent, position);
CREATE INDEX idx_tasks_updated
  ON tasks (user_id, updated_at);         -- para sync incremental (?since=)
```

**Ordenación dentro del cuadrante: índice fraccional.** Al soltar una tarjeta entre A y B,
su `position` pasa a ser `(A.position + B.position) / 2`. Un solo `UPDATE` por arrastre, sin
reindexar la columna entera. Aviso conocido: un `REAL` de 64 bits aguanta ~50 inserciones
consecutivas en el mismo hueco antes de agotar precisión; añadimos un endpoint de
renormalización (reasigna 1000, 2000, 3000...) que se dispara cuando el hueco baja de un
epsilon. Para un uso personal no se alcanza nunca, pero conviene tenerlo cubierto.

**Borrado lógico.** `deleted_at` en vez de `DELETE` real, porque cuando añadamos offline
(Fase 5) un cliente desconectado necesita enterarse de que una tarea desapareció.

---

## 4. API

Endpoints Astro en `apps/todo/src/pages/api/`, todos con `export const prerender = false`.
Devuelven JSON y leen `locals.user` (puesto por el middleware).

| Método | Ruta | Cuerpo / query | Respuesta |
|---|---|---|---|
| `GET` | `/api/tasks` | `?includeCompleted=1&since=<iso>` | `{ tasks: Task[] }` |
| `POST` | `/api/tasks` | `{ title, urgent, important, notes?, dueAt? }` | `{ task }` 201 |
| `PATCH` | `/api/tasks/:id` | parcial: `title, notes, urgent, important, position, dueAt, completedAt` | `{ task }` |
| `DELETE` | `/api/tasks/:id` | — | 204 (marca `deleted_at`) |
| `POST` | `/api/tasks/renormalize` | — | `{ tasks }` |
| `GET` | `/api/export` | — | dump JSON completo |

Validación de entrada con **valibot** (~2kB, importa en un Worker donde el bundle cuenta).
Toda consulta filtra por `user_id = locals.user.id`: el `id` de la URL nunca es suficiente
para tocar una fila.

---

## 5. Frontend

Páginas: `/` (la matriz), `/completed` (historial), `/settings` (export/import).

Island Svelte en `apps/todo/src/components/`:

```
Matrix.svelte        grid 2×2, un dndzone por cuadrante
 ├─ Quadrant.svelte  cabecera, color, contador, zona de drop
 │   └─ TaskCard.svelte
 └─ QuickAdd.svelte  input + atajos
tasks.svelte.ts      store con runes: $state, mutaciones optimistas + rollback
```

**Optimista con rollback.** Cada mutación aplica el cambio en local, dispara el `fetch` y
revierte el estado anterior si la respuesta falla, mostrando un toast. Es lo que hace que la
app se sienta instantánea aunque el Worker esté a 80ms.

**Móvil.** El drag & drop táctil es la parte frágil de este tipo de UI. `svelte-dnd-action`
lo soporta, pero además cada tarjeta llevará un control explícito de cuadrante (dos toggles:
urgente / importante). En pantalla pequeña la matriz 2×2 pasa a cuatro secciones apiladas.

**Teclado.** `n` nueva tarea, `1`–`4` mover al cuadrante, `x` completar, `e` editar,
`⌫` borrar. `svelte-dnd-action` ya trae reordenación accesible por teclado.

**Estilos.** Tailwind 4 configurado en CSS igual que el blog (`@source`, `@theme`,
`@custom-variant` para el modo oscuro) y el mismo script inline de `dark_mode` en
localStorage, para que las dos webs se sientan de la misma mano.

---

## 6. Stack y versiones

Verificadas hoy contra npm y compatibles con el Astro 7 del blog:

| Paquete | Versión | Nota |
|---|---|---|
| `astro` | ^7.2.9 | igual que el blog |
| `@astrojs/cloudflare` | ^14.2.6 | peer: astro ^7.2.0, wrangler ^4.125.0 |
| `@astrojs/svelte` | ^9.0.1 | peer: svelte ^5.43.6 |
| `svelte` | ^5.57.0 | runes |
| `svelte-dnd-action` | ^0.9.79 | |
| `wrangler` | ^4.127.1 | |
| `@cloudflare/vitest-pool-workers` | ^0.22.0 | tests contra D1 local real |
| `tailwindcss` + `@tailwindcss/vite` | ^4.3.3 | igual que el blog |
| `valibot` | última | validación |

Node 22 (`.node-version` ya fija `v22`), pnpm 9.12.2. Biome hereda la config del root.

---

## 7. Fases

Cada fase termina en algo desplegable y verificable.

**Fase 0 — Andamiaje** (~medio día)
`pnpm-workspace.yaml` en el root con `packages: ["apps/*"]`; `apps/todo` con Astro +
adapter de Cloudflare + Svelte + Tailwind; `wrangler.jsonc` propio; layout base y una
página que solo diga "hola". Objetivo: `pnpm --filter todo dev` levanta, y el deploy manual
sirve en `todo.maldo.dev`. **El blog no se toca.**

**Fase 1 — Datos y API**
Migración `0001_init.sql`, capa de acceso a D1, los seis endpoints con validación, y tests
con `vitest-pool-workers` contra una D1 local. Todavía con un `user_id` fijo de desarrollo.

**Fase 2 — Auth** *(requiere tu decisión del punto 1)*
Aplicación de Access + política; `middleware.ts` verificando el JWT contra el JWKS de tu
equipo con `jose`, comprobando el `aud`; upsert del usuario por email en el primer request;
bypass por variable de entorno en desarrollo, donde Access no está delante.

**Fase 3 — La matriz**
El island completo: los cuatro cuadrantes, alta rápida, edición inline, completar, borrar,
drag & drop entre y dentro de cuadrantes, estado optimista, adaptación a móvil, atajos,
modo oscuro.

**Fase 4 — Vivir con ella**
Fechas límite (y `urgent` derivado automáticamente cuando la fecha se acerca), etiquetas,
vista de completadas, export/import JSON.

**Fase 5 — Opcional, según lo que eches en falta**
PWA instalable con Service Worker, IndexedDB y cola de sync offline; tareas recurrentes;
estadísticas de reparto por cuadrante con `chart.js` (ya está en el repo).

---

## 8. Lo que tienes que hacer tú

En este entorno `wrangler` no está autenticado, así que no puedo crear recursos en tu cuenta
de Cloudflare. Estos pasos son tuyos (yo dejo el código y la config listos para recibirlos):

```bash
wrangler login

# 1. Base de datos — copia el database_id que imprime a apps/todo/wrangler.jsonc
wrangler d1 create todo-db

# 2. Migraciones (cuando exista la Fase 1)
wrangler d1 migrations apply todo-db --local   # desarrollo
wrangler d1 migrations apply todo-db --remote  # producción

# 3. Primer deploy
pnpm --filter todo build && wrangler deploy --config apps/todo/wrangler.jsonc
```

Y en el dashboard:

4. **DNS**: `todo` como registro proxied hacia el Worker (o una Custom Domain en el Worker).
5. **Zero Trust → Access → Applications**: aplicación self-hosted en `todo.maldo.dev`,
   política *allow* con `emails: almalpez@proton.me`, login por PIN de un solo uso o Google.
   Apúntame el **AUD tag** y el nombre de tu equipo: van al middleware.

### Nota de seguridad

Access protege el *hostname*, no el Worker. Si el Worker mantiene su ruta
`todo.<subdominio>.workers.dev`, cualquiera puede llegar a la API saltándose Access por
completo. En `wrangler.jsonc` irá **`"workers_dev": false`**, y el middleware rechazará
cualquier request sin un JWT de Access válido aunque llegue por otra vía.

---

## 9. Coste

Todo entra en el nivel gratuito: Workers 100.000 peticiones/día, D1 5 GB con 5 millones de
lecturas de fila/día, Access hasta 50 usuarios. Coste esperado: **0 €/mes** más el dominio
que ya pagas.
