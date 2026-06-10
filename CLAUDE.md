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

**Authentication & roles:** Supabase Auth (email/password). Auth is initialized in `App.tsx` via `supabase.auth.getSession()` + `onAuthStateChange` listener, which calls `authStore.setSession()`. The store exposes an `initialize()` method but it is not used — `App.tsx` owns the subscription and cleans it up on unmount. `authStore.ts` calls `fetchUserRole()` which simultaneously fetches the role from `usuario_rol` AND the full `Usuario` profile from `usuario`, storing both. The store exposes `userRole`, `usuarioProfile: Usuario | null`, and `refreshProfile()` (re-fetches from `usuario` table). The role gates sidebar items and dashboard panels. `ProtectedRoute` redirects unauthenticated users to `/login`.

**UserProfileModal** (`src/components/layout/UserProfileModal.tsx`) — 3-tab modal accessible from `Topbar`. Tabs: **Datos** (nombres, apellidos, cargo — email is read-only), **Firma** (draw on canvas or upload an image; saved to `firmas-usuario` bucket via `saveUserFirma(userId, blob)`; deleted via `deleteUserFirma(userId)`), **Contraseña** (calls `supabase.auth.updateUser` via `changePassword`). All mutations call `refreshProfile()` after success to sync `authStore.usuarioProfile`.

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
- `/arendir`, `/arendir/nueva`, `/arendir/:id` — A Rendir module, also behind `ProtectedRoute`
- Catch-all redirects to `/dashboard`

**Key Supabase tables:** `usuario_rol`, `solicitud`, `solicitud_detalle`, `solicitud_archivo`, `solicitud_tipo`, `solicitud_forma_pago`, `estado_soli`, `proyecto`, `area_usuario`, `usuario`, `proveedor`, `encuesta_proveedor`, `plan_contable_brash`, `solicitud_arendir`, `solicitud_arendir_detalle`.

El campo `prioridad` fue eliminado de la tabla `solicitud` (UI y tipos) — no se usa ni se escribe. La columna puede seguir existiendo en la BD sin afectar nada.

**`usuario`** — perfil extendido 1:1 con `auth.users`. Campos: `id` (UUID FK), `nombres`, `apellidos`, `nombre_completo` (GENERATED: nombres || apellidos), `correo`, `cargo`, `dni`, `firma_path` (path en bucket `firmas-usuario`). Un trigger `on_auth_user_created` crea la fila automáticamente en cada signup. `enrichSolicitudes` consulta esta tabla para `creador_nombre`, `creador_email` y `creador_cargo`. La vista `vista_creadores` fue eliminada — ya no es necesaria.

`area_usuario` links users to areas; only rows with `estado = 1` are treated as active when enriching solicitudes with area names.

**`usuarioService.ts`** (`src/features/usuario/services/usuarioService.ts`) — standalone service with no types or hooks of its own; imports `Usuario` from `src/features/solicitud/types/solicitud.ts`. Exports: `updateUsuarioPerfil` (nombres/apellidos/cargo), `changePassword`, `saveUserFirma`, `deleteUserFirma`, `getUserFirmaUrl`, `getUserFirmaBlob`. Note: `usuario.dni` is saved directly via inline Supabase call in `ARendirNuevaPage` (Step 1), not through this service.

**Supabase Storage:** Dos buckets relevantes:
- `solicitud-archivos` — documentos y firmas por solicitud. Signed URLs con 1 hora de expiración. Storage path: `{solicitudId}/{tipoArchivo}/{timestamp}.{ext}`. Tipos de firma: `Firma_Usuario`, `Firma_Aprobador` (se suben al ejecutar `enviarARevision` / `aprobarSolicitud`).
- `firmas-usuario` — firma de perfil del usuario. Path determinista: `{userId}/firma.png`. Referenciado via `usuario.firma_path`.

Tipos de archivo manejados por `SolicitudArchivos`:
- Requeridos: `Contrato`, `Cotizacion`, `Sustento`
- Opcionales: `Cuadro Comparativo`, `Factura XML`, `Factura PDF`

El componente acepta la prop `tiposVisibles?: string[]`; si se pasa, sólo renderiza esos tipos. Usado en el wizard para separar documentos de contrato (Step 3) de documentos de factura (Step 4). En el detalle de la solicitud se muestra sin filtro (todos los tipos visibles), permitiendo subir Factura XML/PDF directamente desde ahí.

**Solicitud workflow states** (`estado_soli` table drives UI logic):
- Pendiente → (USUARIO/ADMIN) → `enviarARevision` → En Revision
- En Revision → (EVALUADOR/ADMIN) → `marcarEvaluado(id, planContableId, userId)` → Evaluado
- En Revision → (EVALUADOR/ADMIN) → `devolverSolicitud` → Pendiente
- Evaluado → (APROBADOR/ADMIN) → `aprobarSolicitud` → **Aprobado** (estado final)
- Evaluado → (APROBADOR/ADMIN) → `rechazarSolicitud` → Rechazado
- Any active state → `cancelarSolicitud` → Cancelado

`marcarEvaluado` saves `plan_contable_id` (mandatory) and `usuario_evaluador` (UUID of the evaluator) to `solicitud`. Both fields are excluded from `SolicitudInsert`.

Los estados "Facturación Pendiente" y "Completado" fueron eliminados del flujo. **Aprobado** es el estado terminal positivo. La factura (XML y PDF) se sube opcionalmente en el Step 4 del wizard de creación, o desde el detalle de la solicitud. Los campos de factura (`numero_factura`, `motivo_factura`, `fecha_emision_factura`, `fecha_vencimiento_factura`) son editables inline directamente en el detalle cuando la solicitud está Pendiente (USUARIO/ADMIN dueño) o Aprobada.

The service caches estado IDs in memory to avoid repeated lookups (`estado_soli` table). The `codigo` field on `solicitud` is auto-generated by a database trigger (never set manually).

**SolicitudNuevaPage** is a 4-step wizard:
1. **Datos generales** — form with all header fields (proveedor, bancarios, proyecto, porcentajes, fechas, condiciones)
2. **Detalles** — line-item editor (descripción, cantidad, valor unitario)
3. **Documentos** — upload Contrato, Cotización, Sustento (required), Cuadro Comparativo (optional). Uses `tiposVisibles` to hide Factura types.
4. **Factura** (optional) — upload Factura XML and/or PDF; fill N° Factura, Motivo de factura, Fecha de emisión, Fecha de vencimiento. "Omitir y finalizar" skips saving.

Step state is local to the page. The solicitud record is created at the end of Step 1; subsequent steps update it in place. Si el usuario abandona el wizard después del Step 1 o 2, puede completar documentos y datos de factura directamente desde el detalle de la solicitud (`/solicitudes/:id`).

**Campos de factura en `solicitud`:**
- `numero_factura` — número de factura
- `motivo_factura` — motivo o concepto de la factura
- `fecha_emision_factura` — fecha de emisión (DATE)
- `fecha_vencimiento_factura` — fecha de vencimiento (DATE)
- `moneda` — TEXT, valores `'PEN'` (soles, default) o `'USD'` (dólares). Controla el símbolo en totales (`S/` o `$`), en el PDF y en los KPIs del dashboard. Las solicitudes existentes sin moneda heredan `'PEN'` por el DEFAULT de BD.

**SolicitudDetallePage** calculates totals client-side: `subtotal` (sum of line items), `igv = subtotal * 0.18` (18% Peruvian IGV), and `totalConIgv`. The `solicitud_detalle.valor_total` column may be DB-computed; the code uses `d.valor_total ?? d.cantidad * d.valor_unitario` as fallback. Currency symbol is driven by `solicitud.moneda`: `S/` (es-PE locale) for PEN, `$` (en-US locale) for USD — same in the detail page and in the PDF.

**"Descargar OC" button** (`canShowPDF`): visible in all states **except** Rechazado and Cancelado — including Pendiente. For Pendiente solicitudes, the firma lookup falls back from `solicitud_archivo` (Firma_Usuario type) to the user's profile firma in the `firmas-usuario` bucket (`usuario.firma_path`) so the PDF always renders a signature when available.

**"Datos de la Factura" card** (`showFacturaCard`): visible cuando `canEdit` (Pendiente + rol correcto) OR cuando ya existe algún dato de factura o archivo Factura XML/PDF. En modo editable (`canEditFactura`), muestra los 4 campos en una grilla 2×2 con un solo botón "Guardar" que se activa solo si hay cambios (`facturaHasChanges`). En modo solo lectura, usa `InfoField`. El state local (`numeroFactura`, `motivoFactura`, `fechaEmisionFactura`, `fechaVencimientoFactura`) se sincroniza desde `solicitud` vía `useEffect`; `handleGuardarFactura` guarda los 4 campos de una sola vez con `updateSolicitud`.

Order of cards in detail page: **Info general → Detalles → Documentos → Datos de la Factura → Plan Contable → Encuesta Proveedor**. The Plan Contable card shows all `plan_contable_brash` fields and only renders when `solicitud.plan_contable` is not null (i.e., after an EVALUADOR marks the solicitud as Evaluado).

**SolicitudModal** (edit mode) includes all header fields plus `moneda`, `motivo_factura`, `fecha_emision_factura`, and `fecha_vencimiento_factura` — these duplicate the inline edit in the detail card but remain in the modal for completeness.

**Line-item editing components (solicitud):** Two distinct components handle `solicitud_detalle` editing:
- `SolicitudDetalleModal` — lightweight modal (cantidad, descripción, valor_unitario) used in `SolicitudNuevaPage` wizard Step 2 for add/edit inline.
- `SolicitudDetalleEditor` — full slide-in panel used from `SolicitudDetallePage` to add/edit/delete line items after the solicitud is created. Fetches detalles independently via `getDetallesBySolicitud`.

**Dashboard — moneda:** Todos los paneles (ADMIN, APROBADOR, EVALUADOR, VISUALIZADOR, USUARIO) muestran dos KPI separados: **"Aprobado S/"** (solicitudes con `moneda='PEN'`) y **"Aprobado $"** (solicitudes con `moneda='USD'`). Los helpers `fmtMoney(n, moneda)` y `fmtMoneyFull(n, moneda)` aceptan `'PEN'|'USD'` para formatear con el símbolo correcto. `montoSolicitudes(sols, detalles, moneda?)` acepta un tercer argumento opcional para filtrar por moneda antes de sumar.

**Dashboard** renders a dedicated panel per role via `DashboardPage.tsx` which branches on `userRole`:
- `ADMIN` — KPIs globales, dona por estado, barras mensual/proyectos, tabla de pendientes, panel de métricas de proveedores. Usa `getDashboardData()` + `getProveedorMetricas()`.
- `APROBADOR` — cola de aprobación, montos, dona Aprobadas/Rechazadas/en cola, filtro por proyecto (client-side), KPIs de A Rendir, **tarjetas de totales consolidados** ("Total comprometido S/" y "Total comprometido $" = OC Aprobadas + A Rendir Autorizados con desglose), panel de métricas de proveedores. Usa `getAprobadorData()` + `getProveedorMetricas()`.
- `EVALUADOR` — cola En Revision, promedio de días de espera, lista de más antiguas con alerta ≥3 días. Usa `getEvaluadorData()`.
- `VISUALIZADOR` — solicitudes aprobadas, montos totales, KPIs de A Rendir (Evaluado + Autorizado), tabla de aprobadas. Usa `getVisualizadorData()`.
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

**`SOL_SEL` in `solicitudService.ts`:** Uses an **explicit column list** (not `*`) to guarantee that newly-added columns like `moneda` are always returned regardless of PostgREST's schema cache state. When adding new columns to `solicitud`, also add them to this list and to the `Solicitud` TypeScript interface. The list is built with `[...].join(', ')` for readability.

**`solicitud` new columns added for plan contable:**
- `plan_contable_id` — FK to `plan_contable_brash.id` (nullable, set when EVALUADOR marks Evaluado)
- `usuario_evaluador` — UUID (text FK to auth.users, nullable, set when EVALUADOR marks Evaluado)

Both are excluded from `SolicitudInsert`.

---

## Módulo A Rendir

Gestión de **rendición de gastos con adelantos**. Un empleado solicita un adelanto de dinero, ejecuta los gastos registrando comprobantes línea por línea, y el aprobador revisa y autoriza (o devuelve/rechaza).

**Rutas:**
- `/arendir` — listado (`ARendirPage`)
- `/arendir/nueva` — wizard de creación (`ARendirNuevaPage`)
- `/arendir/:id` — detalle y acciones (`ARendirDetallePage`)

**Sidebar:** visible para ADMIN (1), EVALUADOR (8), APROBADOR (9), VISUALIZADOR (10), USUARIO (11). Solo USUARIO y ADMIN pueden crear.

**Feature folder:** `src/features/arendir/` — contiene `types/arendir.ts`, `services/arendirService.ts`, `components/ARendirPDF.tsx`, `hooks/useArendir.ts`.

**Tablas Supabase:**
- `solicitud_arendir` — cabecera del adelanto
- `solicitud_arendir_detalle` — líneas de gasto (N por solicitud)

**Campos de `solicitud_arendir`:**
- `id`, `codigo` (auto-generado por trigger), `beneficiario_id` (UUID FK auth.users)
- `proyecto_id` (FK → proyecto, nullable)
- `importe` (numeric) — monto del adelanto solicitado
- `moneda` (text) — `'PEN'` | `'USD'`, elegido en Step 1 del wizard
- `banco` (text, nullable) — banco del beneficiario (lista de `bancos.ts`)
- `numero_cuenta` (text, nullable) — número de cuenta (BBVA, 18 dígitos) o CCI (otros bancos, 20 dígitos)
- `numero_pago` (integer, nullable) — correlativo mensual asignado automáticamente por trigger `trg_assign_numero_pago` al crear el registro; reinicia cada mes (`MAX(numero_pago del mes) + 1`). No se usa en el PDF; se usa como fallback si se necesita referencia interna.
- `fecha_rendicion` (date, nullable) — fecha límite de rendición
- `total_reembolso` (numeric) — suma de los detalles, recalculada automáticamente
- `documento_sustento_path` (text, nullable) — path en storage del sustento general
- `estado` (text): `'Pendiente'` | `'En Revision'` | `'Evaluado'` | `'Autorizado'` | `'Rechazado'` | `'Devuelto'`
- `usuario_aprobador` (uuid, nullable), `fecha_aprobacion` (timestamp, nullable)
- `usuario_evaluador` (uuid, nullable), `plan_contable_id` (FK → `plan_contable_brash`, nullable)
- `comentario` (text, nullable) — motivo de rechazo o devolución
- `fecha_creacion` (timestamp)

**Campos de `solicitud_arendir_detalle`:**
- `id`, `solicitud_arendir_id` (FK), `fecha_documento` (date)
- `proveedor` (text), `tipo_documento` (text: RECIBO/FACTURA/BOLETA/PLLA-MOV/TICKET/OTRO)
- `numero_documento` (text), `concepto` (text), `importe` (numeric)
- `archivo_path` (text, nullable) — path del comprobante adjunto

**Supabase Storage — bucket `arendir-documentos`:**
- `{solicitudId}/sustento/{timestamp}.{ext}` — sustento general
- `{solicitudId}/detalle/{detalleId}/{timestamp}.{ext}` — comprobante por línea
- `{solicitudId}/firma_usuario/{timestamp}.png` — firma del beneficiario
- `{solicitudId}/firma_aprobador/{timestamp}.png` — firma del aprobador
- Signed URLs con 1 hora de expiración.

**Flujo de estados:**
```
Pendiente
  ↓ USUARIO/ADMIN → enviarARendir
En Revision
  ├─ EVALUADOR/ADMIN → marcarEvaluadoARendir(planId, userId) → Evaluado
  └─ EVALUADOR/ADMIN → devolverDesdeRevision(comentario)    → Devuelto
Evaluado
  ├─ APROBADOR/ADMIN → autorizarARendir (requiere firma) → Autorizado ✅
  ├─ APROBADOR/ADMIN → rechazarARendir(comentario)       → Rechazado ❌
  └─ APROBADOR/ADMIN → devolverARendir(comentario)       → Devuelto
                                             ↓ USUARIO/ADMIN → enviarARendir
                                          En Revision
```

**Wizard de creación (2 pasos):**
1. **Datos generales** — beneficiario (read-only, usuario logueado), DNI (editable, guardado en `usuario`), proyecto (opcional), moneda (PEN/USD), importe adelanto, fecha de rendición, banco (select de `bancos.ts`), número de cuenta/CCI (label y maxLength según banco, se limpia al cambiar banco), documento sustento (opcional). Al completar: crea registro en `Pendiente`. `banco` y `numero_cuenta` se guardan en `solicitud_arendir` pero **no aparecen en el PDF** — solo se usan en la descarga Excel BBVA.
2. **Detalle de gastos** — tabla editable de líneas (fecha, proveedor, tipo doc, N° doc, concepto, importe, archivo adjunto). Muestra balance: si adelanto > total → "usuario devuelve diferencia"; si adelanto < total → "empresa reembolsa diferencia". Permite subir firma del beneficiario, generar PDF y enviar a revisión.

**ARendirDetallePage — acciones por rol y estado:**
- USUARIO/ADMIN en Pendiente o Devuelto: "Enviar a revisión"
- EVALUADOR/ADMIN en En Revision: "Evaluar" (abre `EvaluarARendirModal` para asignar plan contable → Evaluado), "Devolver" (modal comentario → Devuelto)
- APROBADOR/ADMIN en Evaluado: "Autorizar" (abre `FirmaModal`, sube `firma_aprobador`, genera PDF → Autorizado), "Devolver" (modal comentario), "Rechazar" (modal comentario)
- Todos desde En Revision en adelante: "Descargar PDF"
- Si estado es Rechazado o Devuelto: alerta visible con el motivo (`comentario`)

**ARendirPDF** (`@react-pdf/renderer`, formato landscape A4): header con título y logo, grilla de datos generales (código, beneficiario, DNI, cargo, proyecto, importe adelanto, fecha rendición — **sin banco ni número de cuenta**), tabla de líneas de gasto, fila de balance (amarillo), fila de total a reembolsar (azul), sección de dos firmas (beneficiario + aprobador).

**Enriquecimiento:** `enrichARendir()` consulta tabla `usuario` para obtener `beneficiario_nombre`, `beneficiario_email`, `beneficiario_dni`, `beneficiario_cargo`, `aprobador_nombre` y `evaluador_nombre`. Los tres UUIDs (`beneficiario_id`, `usuario_aprobador`, `usuario_evaluador`) se resuelven en una sola query con `.in('id', uids)`.

**Excel BBVA — descarga masiva de pagos (`ARendirPage`):**
- Disponible para VISUALIZADOR y ADMIN mediante selección múltiple + botón "Excel"
- Formato de 14 columnas compatible con BBVA Pagos Masivos:

| Col | Campo | Valor |
|---|---|---|
| DOI tipo | Siempre `'L'` (DNI persona natural) |
| DOI Numero | `beneficiario_dni` |
| Tipo abono | `'P'` si `banco === 'BBVA'`, `'I'` (interbancario) para el resto |
| Cuenta | `numero_cuenta` registrado en Step 1 |
| Nombre del beneficiario | `beneficiario_nombre` |
| Importe abonar | `total_reembolso` |
| Tipo recibo | Siempre `'B'` (boleta/rendición) |
| Numero documento | Correlativo `001`, `002`… según posición en la exportación (reinicia en cada descarga) |
| Abono Agrupado | `'N'` |
| Referencia | `'A Rendir'` |
| Indicador de Aviso | `'E'` |
| Medio de aviso | `beneficiario_email` |
| Persona Contacto | vacío |
| Validacion | vacío |

**Excel BBVA — solicitudes OC (`SolicitudesPage`):**
- `Tipo abono`: `'P'` si `banco === 'BBVA'`, `'I'` para el resto (antes usaba la longitud del número)
- `Tipo recibo`: `'F'` (factura)
- `Numero documento`: `numero_factura`

**`ARendirPage` — filtros:**
- Dropdown **Estado** con opciones según rol:
  - EVALUADOR: En Revision · Pendiente · Evaluado
  - APROBADOR: Evaluado · Autorizado · Rechazado · Devuelto
  - VISUALIZADOR: Evaluado · Autorizado
  - ADMIN / USUARIO: los 6 estados completos
- Dropdown **Proyecto** — todos los proyectos
- Botón "Limpiar" visible cuando hay algún filtro activo
- VISUALIZADOR ve por defecto `estado IN ('Evaluado', 'Autorizado')`; si selecciona un estado específico del filtro, se aplica ese

**`useArendir` hook:** estado local (data, total, page, totalPages, loading), pageSize fijo de 10, filtra por rol/userId automáticamente. Expone `setPage`, `setEstadoFilter`, `setProyectoFilter`, `refresh`. Al cambiar cualquier filtro, la página vuelve a 1.

**Diferencias clave vs. módulo Solicitud (OC):**
- Con moneda PEN/USD (campo `moneda`, DEFAULT 'PEN') — se elige en Step 1
- Sin IGV
- Tiene plan contable asignado por EVALUADOR igual que en Solicitud
- Sin encuesta de proveedor
- Solo 2 pasos en el wizard (vs 4)
- Estado terminal positivo: `Autorizado` (en lugar de Aprobado)
- El monto cuenta en el dashboard cuando `estado = 'Autorizado'`

---

**TypeScript config:** strict mode with `noUnusedLocals` and `noUnusedParameters` enabled — unused variables will cause build errors. Use `Omit<T, 'id' | 'fecha_creacion' | ...>` for insert/update types (see `SolicitudInsert` as the canonical example).

**RUC lookup:** `rucService.ts` calls `/api/ruc?numero=<ruc>`. In development, `vite.config.ts` proxies this to `https://api.decolecta.com/v1/sunat/ruc` with a Bearer token. This proxy only runs in `dev` mode; a separate server-side solution is needed in production.

**Env vars** (`.env.local`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase client (`src/api/supabase.ts`)
- `DECOLECTA_API_KEY` — RUC lookup API (dev proxy only; not exposed to the browser)
