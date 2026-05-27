# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # TypeScript check + Vite production build
npm run lint       # Run ESLint
npm run preview    # Preview production build locally
```

No test framework is configured.

## Architecture

**Stack:** React 19 + TypeScript, Vite, React Router v7, Zustand, Tailwind CSS v4, Supabase (auth + database + storage), Recharts, exceljs, lucide-react, react-hot-toast.

**Feature-driven structure:** Code is organized under `src/features/<domain>/` — each domain contains `components/`, `services/`, `hooks/`, `types/`, and optionally `constants/` subfolders. Pages live in `src/pages/` and are thin route-level components. Layout shells (`MainLayout`, `Sidebar`, `Topbar`, `ProtectedRoute`) are in `src/components/layout/`. A shared `DataTable` component lives in `src/components/ui/`.

**`src/features/solicitud/constants/bancos.ts`** — lista hardcodeada de bancos peruanos con helpers: `labelNumeroCuenta(banco)` devuelve "Número de cuenta" si es BBVA o "Número CCI" para el resto; `maxLengthNumeroCuenta(banco)` devuelve 18 para BBVA y 20 para el resto. Usado en `SolicitudModal` y `SolicitudNuevaPage`. El campo `banco` es un `<select>` con esta lista; al cambiar banco se limpia `numero_cuenta`.

> **Casing quirk:** `src/features/Solicitudes/` (capital S) is a near-empty folder — the actual solicitud feature code lives in `src/features/solicitud/` (lowercase).

**Authentication & roles:** Supabase Auth (email/password). Auth is initialized in `App.tsx` via `supabase.auth.getSession()` + `onAuthStateChange` listener, which calls `authStore.setSession()`. The store exposes an `initialize()` method but it is not used — `App.tsx` owns the subscription and cleans it up on unmount. `authStore.ts` calls `fetchUserRole()` which queries the `usuario_rol` table to get a numeric role ID. The role gates sidebar items and dashboard panels. `ProtectedRoute` redirects unauthenticated users to `/login`.

Role constants (defined in `src/features/solicitud/types/solicitud.ts`):
- `ADMIN = 1` — full access
- `EVALUADOR = 8` — can evaluate requests
- `APROBADOR = 9` — can approve/reject requests
- `VISUALIZADOR = 10` — read-only
- `USUARIO = 11` — can create requests

**Data access pattern:** Feature-level service files (`*Service.ts`) wrap Supabase queries. Custom hooks (`useSolicitudes`, `useProyectos`) own local state for pagination and filters, call the services, and expose data + handlers to page components. `useSolicitudes` automatically syncs `role` and `userId` from the auth store into query filters via a `useEffect`. El hook expone `setProyectoFilter` para filtrar por proyecto desde `SolicitudesPage` (aplica a todos los roles).

**Routing** (`App.tsx`):
- `/login` — public
- `/dashboard`, `/solicitudes`, `/solicitudes/nueva`, `/solicitudes/:id`, `/proyectos`, `/proveedores` — all behind `ProtectedRoute`
- Catch-all redirects to `/dashboard`

**Key Supabase tables:** `usuario_rol`, `solicitud`, `solicitud_detalle`, `solicitud_archivo`, `solicitud_tipo`, `solicitud_forma_pago`, `estado_soli`, `proyecto`, `area_usuario`, `usuario`, `proveedor`, `encuesta_proveedor`, `plan_contable_brash`.

El campo `prioridad` fue eliminado de la tabla `solicitud` (UI y tipos) — no se usa ni se escribe. La columna puede seguir existiendo en la BD sin afectar nada.

**`usuario`** — perfil extendido 1:1 con `auth.users`. Campos: `id` (UUID FK), `nombres`, `apellidos`, `nombre_completo` (GENERATED: nombres || apellidos), `correo`, `cargo`. Un trigger `on_auth_user_created` crea la fila automáticamente en cada signup. `enrichSolicitudes` consulta esta tabla para `creador_nombre`, `creador_email` y `creador_cargo`. La vista `vista_creadores` fue eliminada — ya no es necesaria.

`area_usuario` links users to areas; only rows with `estado = 1` are treated as active when enriching solicitudes with area names.

**Supabase Storage:** Bucket `solicitud-archivos` con 5 tipos de documento por solicitud. Signed URLs with 1-hour expiry. Storage path format: `{solicitudId}/{tipoArchivo}/{timestamp}.{ext}`.

Tipos de archivo manejados por `SolicitudArchivos`:
- Requeridos: `Contrato`, `Cotizacion`, `Sustento`
- Opcionales: `Cuadro Comparativo`, `Factura XML`, `Factura PDF`

El componente acepta la prop `tiposVisibles?: string[]`; si se pasa, sólo renderiza esos tipos. Usado en el wizard para separar documentos de contrato (Step 3) de documentos de factura (Step 4).

**Solicitud workflow states** (`estado_soli` table drives UI logic):
- Pendiente → (USUARIO/ADMIN) → `enviarARevision` → En Revision
- En Revision → (EVALUADOR/ADMIN) → `marcarEvaluado(id, planContableId, userId)` → Evaluado
- En Revision → (EVALUADOR/ADMIN) → `devolverSolicitud` → Pendiente
- Evaluado → (APROBADOR/ADMIN) → `aprobarSolicitud` → **Aprobado** (estado final)
- Evaluado → (APROBADOR/ADMIN) → `rechazarSolicitud` → Rechazado
- Any active state → `cancelarSolicitud` → Cancelado

`marcarEvaluado` saves `plan_contable_id` (mandatory) and `usuario_evaluador` (UUID of the evaluator) to `solicitud`. Both fields are excluded from `SolicitudInsert`.

Los estados "Facturación Pendiente" y "Completado" fueron eliminados del flujo. **Aprobado** es el estado terminal positivo. La factura (XML y PDF) se sube opcionalmente en el Step 4 del wizard de creación, o desde el detalle de la solicitud. El campo `numero_factura` se puede editar cuando hay archivos de factura adjuntos o cuando la solicitud está Aprobada.

The service caches estado IDs in memory to avoid repeated lookups (`estado_soli` table). The `codigo` field on `solicitud` is auto-generated by a database trigger (never set manually).

**SolicitudNuevaPage** is a 4-step wizard:
1. **Datos generales** — form with all header fields (proveedor, bancarios, proyecto, porcentajes, fechas, condiciones)
2. **Detalles** — line-item editor (descripción, cantidad, valor unitario)
3. **Documentos** — upload Contrato, Cotización, Sustento (required), Cuadro Comparativo (optional). Uses `tiposVisibles` to hide Factura types.
4. **Factura** (optional) — upload Factura XML and/or PDF; fill N° Factura, Motivo de factura, Fecha de emisión, Fecha de vencimiento. "Omitir y finalizar" skips saving.

Step state is local to the page. The solicitud record is created at the end of Step 1; subsequent steps update it in place.

**Campos de factura en `solicitud`:**
- `numero_factura` — número de factura (editable desde detalle y Step 4)
- `motivo_factura` — motivo o concepto de la factura
- `fecha_emision_factura` — fecha de emisión (DATE)
- `fecha_vencimiento_factura` — fecha de vencimiento (DATE)

**SolicitudDetallePage** calculates totals client-side: `subtotal` (sum of line items), `igv = subtotal * 0.18` (18% Peruvian IGV), and `totalConIgv`. The `solicitud_detalle.valor_total` column may be DB-computed; the code uses `d.valor_total ?? d.cantidad * d.valor_unitario` as fallback. Currency is displayed in Peruvian soles (`S/`) using the `es-PE` locale. The "Datos de la factura" card appears whenever a Factura XML/PDF is uploaded or `numero_factura` is set; it also shows `motivo_factura`, `fecha_emision_factura`, and `fecha_vencimiento_factura` read-only.

Order of cards in detail page: **Info general → Detalles → Documentos → Datos de la Factura → Plan Contable → Encuesta Proveedor**. The Plan Contable card shows all `plan_contable_brash` fields and only renders when `solicitud.plan_contable` is not null (i.e., after an EVALUADOR marks the solicitud as Evaluado).

**SolicitudModal** (edit mode) includes all header fields plus `motivo_factura`, `fecha_emision_factura`, and `fecha_vencimiento_factura`.

**Dashboard** renders a dedicated panel per role via `DashboardPage.tsx` which branches on `userRole`:
- `ADMIN` — KPIs globales, dona por estado, barras mensual/proyectos, tabla de pendientes, panel de métricas de proveedores. Usa `getDashboardData()` + `getProveedorMetricas()`.
- `APROBADOR` — cola de aprobación, montos, dona Aprobadas/Rechazadas/en cola, filtro por proyecto (client-side), panel de métricas de proveedores. Usa `getAprobadorData()` + `getProveedorMetricas()`.
- `EVALUADOR` — cola En Revision, promedio de días de espera, lista de más antiguas con alerta ≥3 días. Usa `getEvaluadorData()`.
- `VISUALIZADOR` — solicitudes aprobadas, montos totales, tabla de aprobadas. Usa `getVisualizadorData()`.
- `USUARIO` — mis solicitudes, breakdown por estado, monto aprobado (estado Aprobado), acceso rápido a nueva solicitud. Usa `getUsuarioData(userId)`.

Cada función de servicio en `dashboardService.ts` hace sus propias queries optimizadas y devuelve solo los datos relevantes al rol.

**Módulo Proveedores** (`/proveedores`) — visible para ADMIN (1) y USUARIO (11):
- Lista de proveedores con métricas agregadas (promedio general, calidad, tiempo, precio, comunicación, % recomienda, total encuestas).
- Datos provienen de `proveedor` + `encuesta_proveedor` via `getProveedorConMetricas()` en `proveedorService.ts`.
- `EncuestaProveedorForm` aparece en `SolicitudDetallePage` cuando la solicitud está **Aprobada** y el usuario es el creador o ADMIN. Permite crear o editar la encuesta de satisfacción del proveedor (4 criterios 1-5 + recomendaría + comentarios).

**Plan Contable (`plan_contable_brash` table):** catalog table used by the EVALUADOR to categorize each solicitud. Fields: `id`, `tipo_gasto_costo`, `codigo_starsoft`, `cuenta_contable_2020_starsoft`, `nombre_cuenta_contable`, `partida_presupuestal`, `partida_presupuesta_n1`, `partida_presupuesta_n2`. RLS policy: SELECT for authenticated users. Service function: `getPlanContable()` returns all rows ordered by `tipo_gasto_costo`.

**EvaluarModal** (`src/features/solicitud/components/EvaluarModal.tsx`) — modal shown to EVALUADOR/ADMIN when marking a solicitud as Evaluado. Contains a searchable combobox (`Search` icon + input) that filters across `tipo_gasto_costo`, `nombre_cuenta_contable`, and `codigo_starsoft` using `search.trim().toLowerCase()`. Selection is mandatory — the confirm button is disabled until a plan contable entry is chosen. When the dropdown is open, the modal body adds `pb-64` to avoid clipping the absolutely-positioned list. No `overflow-hidden` on the modal wrapper; `rounded-t-2xl`/`rounded-b-2xl` are applied to the header/footer sections individually.

**EVALUADOR list visibility:** In `getSolicitudes`, when `role === ROLES.EVALUADOR`, the query uses `.or(`estado_id.eq.${enRevisionId},usuario_evaluador.eq.${userId}`)` so the evaluator sees both *all* "En Revision" solicitudes and *their own* previously evaluated ones (any state). Bulk "Evaluar" action was removed from `SolicitudesPage` — plan contable selection makes per-row evaluation mandatory.

**PostgREST FK join pattern:** When adding a foreign key to an existing table and joining it in `SOL_SEL`, use the explicit constraint hint to avoid schema cache ambiguity:
```
plan_contable:plan_contable_brash!solicitud_plan_contable_id_fkey(id,tipo_gasto_costo,...)
```
Run `NOTIFY pgrst, 'reload schema'` if the join stops working after schema changes, but prefer the explicit FK name for reliability.

**`solicitud` new columns added for plan contable:**
- `plan_contable_id` — FK to `plan_contable_brash.id` (nullable, set when EVALUADOR marks Evaluado)
- `usuario_evaluador` — UUID (text FK to auth.users, nullable, set when EVALUADOR marks Evaluado)

Both are excluded from `SolicitudInsert`.

**TypeScript config:** strict mode with `noUnusedLocals` and `noUnusedParameters` enabled — unused variables will cause build errors. Use `Omit<T, 'id' | 'fecha_creacion' | ...>` for insert/update types (see `SolicitudInsert` as the canonical example).

**RUC lookup:** `rucService.ts` calls `/api/ruc?numero=<ruc>`. In development, `vite.config.ts` proxies this to `https://api.decolecta.com/v1/sunat/ruc` with a Bearer token. This proxy only runs in `dev` mode; a separate server-side solution is needed in production.

**Env vars** (`.env.local`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase client (`src/api/supabase.ts`)
- `DECOLECTA_API_KEY` — RUC lookup API (dev proxy only; not exposed to the browser)
