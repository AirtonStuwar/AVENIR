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

**Data access pattern:** Feature-level service files (`*Service.ts`) wrap Supabase queries. Custom hooks (`useSolicitudes`, `useProyectos`) own local state for pagination and filters, call the services, and expose data + handlers to page components. `useSolicitudes` automatically syncs `role` and `userId` from the auth store into query filters via a `useEffect`. El hook expone `setProyectoFilter` para filtrar por proyecto (aplica a todos los roles) y `setPagoFilter` (`'pendiente' | 'pagado' | null`) para filtrar por estado de pago — solo visible para VISUALIZADOR en `SolicitudesPage`.

**Routing** (`App.tsx`):
- `/login` — public
- `/dashboard`, `/solicitudes`, `/solicitudes/nueva`, `/solicitudes/:id`, `/proyectos`, `/proveedores` — all behind `ProtectedRoute`
- `/arendir`, `/arendir/nueva`, `/arendir/:id` — A Rendir module, also behind `ProtectedRoute`
- `/reembolso`, `/reembolso/nueva`, `/reembolso/:id` — Reembolso module, also behind `ProtectedRoute`
- `/reportes` — Módulo Reportes (ADMIN + VISUALIZADOR), also behind `ProtectedRoute`
- `/areas` — Gasto por Área (ADMIN + APROBADOR), also behind `ProtectedRoute`
- `/caja-chica`, `/caja-chica/nueva`, `/caja-chica/:id` — Módulo Caja Chica, also behind `ProtectedRoute`
- Catch-all redirects to `/dashboard`

**Key Supabase tables:** `usuario_rol`, `solicitud`, `solicitud_detalle`, `solicitud_archivo`, `solicitud_tipo`, `solicitud_forma_pago`, `estado_soli`, `proyecto`, `proyecto_partida`, `area_usuario`, `area`, `usuario`, `proveedor`, `encuesta_proveedor`, `plan_contable_brash`, `detraccion`, `solicitud_arendir`, `solicitud_arendir_detalle`, `solicitud_reembolso`, `solicitud_reembolso_detalle`, `caja_chica`, `caja_chica_detalle`, `cuenta_bancaria`.

El campo `prioridad` fue eliminado de la tabla `solicitud` (UI y tipos) — no se usa ni se escribe. La columna puede seguir existiendo en la BD sin afectar nada.

**`usuario`** — perfil extendido 1:1 con `auth.users`. Campos: `id` (UUID FK), `nombres`, `apellidos`, `nombre_completo` (GENERATED: nombres || apellidos), `correo`, `cargo`, `dni`, `firma_path` (path en bucket `firmas-usuario`). Un trigger `on_auth_user_created` crea la fila automáticamente en cada signup. `enrichSolicitudes` consulta esta tabla para `creador_nombre`, `creador_email` y `creador_cargo`. La vista `vista_creadores` fue eliminada — ya no es necesaria.

`area_usuario` links users to areas; only rows with `estado = 1` are treated as active when enriching solicitudes with area names.

**`usuarioService.ts`** (`src/features/usuario/services/usuarioService.ts`) — standalone service with no types or hooks of its own; imports `Usuario` from `src/features/solicitud/types/solicitud.ts`. Exports: `updateUsuarioPerfil` (nombres/apellidos/cargo), `changePassword`, `saveUserFirma`, `deleteUserFirma`, `getUserFirmaUrl`, `getUserFirmaBlob`. Note: `usuario.dni` is saved directly via inline Supabase call in `ARendirNuevaPage` (Step 1), not through this service.

**Supabase Storage:** Dos buckets relevantes:
- `solicitud-archivos` — documentos y firmas por solicitud. Signed URLs con 1 hora de expiración. Storage path: `{solicitudId}/{tipoArchivo}/{timestamp}.{ext}`. Tipos de firma: `Firma_Usuario`, `Firma_Aprobador` (se suben al ejecutar `enviarARevision` / `aprobarSolicitud`).
- `firmas-usuario` — firma de perfil del usuario. Path determinista: `{userId}/firma.png`. Referenciado via `usuario.firma_path`.

Tipos de archivo manejados por `SolicitudArchivos`:
- OC requeridos: `Cotizacion`, `Sustento` siempre; `Contrato` solo cuando total con IGV en soles ≥ S/ 3,500 (para USD se convierte con TC SUNAT). Si el monto es menor, Contrato es opcional.
- RxH requeridos: `Sustento`, `Recibo Honorario`
- Opcionales: `Cuadro Comparativo`, `Factura XML`, `Factura PDF`, `Suspension` (solo cuando `aplica_suspension === true`)

El componente acepta la prop `tiposVisibles?: string[]`; si se pasa, sólo renderiza esos tipos. Usado en el wizard para separar documentos de contrato (Step 3) de documentos de factura (Step 4). En el detalle de la solicitud se muestra sin filtro (todos los tipos visibles), permitiendo subir Factura XML/PDF directamente desde ahí. Cuando la solicitud es RxH con `aplica_suspension === true`, `tiposVisibles` incluye `'Suspension'`.

**Descarga masiva en ZIP** (`SolicitudArchivos.tsx`, botón "Descargar todos"): visible solo para VISUALIZADOR y EVALUADOR (prop `canDownloadAll`), y solo cuando hay al menos un documento adjunto. Genera un único `.zip` con `JSZip` — el nombre del archivo/carpeta viene de la prop `zipName` (en `SolicitudDetallePage.tsx`: razón social + N° factura/RxH, con fallback al código de la solicitud). Cada documento dentro del ZIP conserva su **nombre original de subida** (`archivo.nombre_archivo`); si dos documentos de la misma solicitud comparten nombre, al segundo se le agrega `(2)`, `(3)`, etc. antes de la extensión para que ambos queden incluidos sin pisarse.

**Solicitud workflow states** (`estado_soli` table drives UI logic):
- Pendiente → (USUARIO/ADMIN) → `enviarARevision` → En Revision
- En Revision → (EVALUADOR/ADMIN) → `marcarEvaluado(id, planContableId, userId, porcentajeRetencion?, detraccionId?, montoDetraccion?)` → Evaluado
- En Revision → (EVALUADOR/ADMIN) → `devolverSolicitud` → Pendiente
- Evaluado → (APROBADOR/ADMIN) → `aprobarSolicitud` → **Aprobado** (estado final)
- Evaluado → (APROBADOR/ADMIN) → `rechazarSolicitud` → Rechazado
- Any active state → `cancelarSolicitud` → Cancelado

`marcarEvaluado` saves `plan_contable_id` (mandatory), `usuario_evaluador` (UUID), and optionally `porcentaje_retencion`/`monto_retencion` (for RxH) and `detraccion_id`/`monto_detraccion` (for OC). All these fields are excluded from `SolicitudInsert`.

Los estados "Facturación Pendiente" y "Completado" fueron eliminados del flujo. **Aprobado** es el estado terminal positivo. La factura (XML y PDF) se sube opcionalmente en el Step 4 del wizard de creación, o desde el detalle de la solicitud. Los campos de factura (`numero_factura`, `motivo_factura`, `fecha_emision_factura`, `fecha_vencimiento_factura`) son editables inline directamente en el detalle cuando la solicitud está Pendiente (USUARIO/ADMIN dueño) o Aprobada.

The service caches estado IDs in memory to avoid repeated lookups (`estado_soli` table). The `codigo` field on `solicitud` is auto-generated by a database trigger (never set manually).

**SolicitudNuevaPage** is a 4-step wizard:
1. **Datos generales** — form with all header fields (proveedor, bancarios, proyecto, porcentajes, fechas, condiciones)
2. **Detalles** — line-item editor (descripción, cantidad, valor unitario)
3. **Documentos** — upload de archivos según tipo:
   - OC: Cotización y Sustento siempre obligatorios. Contrato obligatorio solo si total con IGV ≥ S/ 3,500 (para USD se convierte con TC SUNAT); opcional si < S/ 3,500. El TC se fetch automáticamente al entrar al Step 3 cuando `moneda === 'USD'`.
   - RxH: Sustento, Recibo Honorario (required). Si el subtotal ≥ S/ 1,500 (o equivalente en USD via tipo de cambio SUNAT), aparece toggle **"Suspensión de retenciones"** (Sí tiene / No tiene). Si "Sí tiene", también muestra tipo `Suspension` para subir el archivo. El botón "Continuar" queda bloqueado hasta que se elija una opción. Al finalizar guarda `aplica_suspension` en `solicitud`.
   - El TC se fetch en Step 3 para `moneda === 'USD'` (tanto OC como RxH).
4. **Plan contable y Factura** — searchable combobox para Plan Contable (ambos OC y RxH); para OC también muestra archivos de factura (XML/PDF) y campos de datos de factura. Todo opcional en el wizard. "Finalizar" siempre habilitado; guarda `plan_contable_id` (si seleccionado) y datos de factura (si OC). Navega a `/solicitudes/:id` al finalizar. El plan contable es obligatorio antes de enviar a revisión.

Step state is local to the page. The solicitud record is created at the end of Step 1; subsequent steps update it in place. Si el usuario abandona el wizard después del Step 1 o 2, puede completar documentos y datos de factura directamente desde el detalle de la solicitud (`/solicitudes/:id`).

**Campos de factura en `solicitud`:**
- `numero_factura` — número de factura
- `motivo_factura` — motivo o concepto de la factura
- `fecha_emision_factura` — fecha de emisión (DATE)
- `fecha_vencimiento_factura` — fecha de vencimiento (DATE)
- `moneda` — TEXT, valores `'PEN'` (soles, default) o `'USD'` (dólares). Controla el símbolo en totales (`S/` o `$`), en el PDF y en los KPIs del dashboard. Las solicitudes existentes sin moneda heredan `'PEN'` por el DEFAULT de BD.

**Campos RxH en `solicitud`:**
- `numero_rxh` — N° de recibo por honorarios
- `periodo_servicio` — período de prestación del servicio
- `porcentaje_retencion` — 0, 3 o 8 (Renta 4ta categoría, asignado por EVALUADOR)
- `monto_retencion` — monto calculado de retención
- `aplica_suspension` — BOOLEAN, se guarda al finalizar Step 3 del wizard cuando el monto ≥ S/ 1,500. `true` = archivo "Suspension" adjunto; `false` = no aplica. `null` = no se mostró el toggle (monto < umbral).

**Campos de Detracción en `solicitud`:**
- `detraccion_id` — FK a tabla `detraccion` (nullable, asignado por EVALUADOR solo en OC)
- `monto_detraccion` — monto calculado, siempre en soles, redondeado sin decimales (`Math.round`). Para solicitudes en USD se usa la fórmula: `Math.round(totalUSD × tipoCambioVenta × porcentaje / 100)`

Todos estos campos están en el `Omit` de `SolicitudInsert` y se excluyen al crear; se guardan via `updateSolicitud` en pasos posteriores.

**SolicitudDetallePage** calculates totals client-side: `subtotal` (sum of line items), `igv = subtotal * 0.18` (18% Peruvian IGV), and `totalConIgv`. The `solicitud_detalle.valor_total` column may be DB-computed; the code uses `d.valor_total ?? d.cantidad * d.valor_unitario` as fallback. Currency symbol is driven by `solicitud.moneda`: `S/` (es-PE locale) for PEN, `$` (en-US locale) for USD — same in the detail page and in the PDF.

**"Descargar OC" button** (`canShowPDF`): visible in all states **except** Rechazado and Cancelado — including Pendiente. For Pendiente solicitudes, the firma lookup falls back from `solicitud_archivo` (Firma_Usuario type) to the user's profile firma in the `firmas-usuario` bucket (`usuario.firma_path`) so the PDF always renders a signature when available.

**"Datos de la Factura" card** (`showFacturaCard`): visible cuando `canEdit` (Pendiente + rol correcto) OR cuando ya existe algún dato de factura o archivo Factura XML/PDF. En modo editable (`canEditFactura`), muestra los 4 campos en una grilla 2×2 con un solo botón "Guardar" que se activa solo si hay cambios (`facturaHasChanges`). En modo solo lectura, usa `InfoField`. El state local (`numeroFactura`, `motivoFactura`, `fechaEmisionFactura`, `fechaVencimientoFactura`) se sincroniza desde `solicitud` vía `useEffect`; `handleGuardarFactura` guarda los 4 campos de una sola vez con `updateSolicitud`.

Order of cards in detail page: **Info general → Presupuesto (ADMIN+APROBADOR) → Detalles → Documentos → Datos de la Factura → Plan Contable → Detracción → Encuesta Proveedor**. The **Presupuesto card** shows consumo vs presupuesto con barra de progreso — si la solicitud tiene partida, muestra la partida; si no, muestra el proyecto. Solo visible para ADMIN (1) y APROBADOR (9). Usa `getConsumoByProyectos()`. The Plan Contable card shows all `plan_contable_brash` fields and only renders when `solicitud.plan_contable` is not null. The **Detracción card** renders only when `solicitud.detraccion_id` is not null (i.e., after an EVALUADOR assigns a detracción to an OC) — shows código, concepto, porcentaje, monto mínimo, monto detracción y total solicitud (en su moneda). La detracción siempre se muestra en S/ (SUNAT). Es informativo: el total de la solicitud NO cambia.

**SolicitudModal** (edit mode) includes all header fields plus `moneda`, `motivo_factura`, `fecha_emision_factura`, and `fecha_vencimiento_factura` — these duplicate the inline edit in the detail card but remain in the modal for completeness.

**Line-item editing components (solicitud):** Two distinct components handle `solicitud_detalle` editing:
- `SolicitudDetalleModal` — lightweight modal (cantidad, descripción, valor_unitario) used in `SolicitudNuevaPage` wizard Step 2 for add/edit inline. Accepts prop `moneda?: 'PEN' | 'USD'` (default `'PEN'`) to show the correct currency symbol in the label and total preview.
- `SolicitudDetalleEditor` — full slide-in panel used from `SolicitudDetallePage` to add/edit/delete line items after the solicitud is created. Fetches detalles independently via `getDetallesBySolicitud`.

**Dashboard — moneda:** Todos los paneles (ADMIN, APROBADOR, EVALUADOR, VISUALIZADOR, USUARIO) muestran dos KPI separados: **"Aprobado S/"** (solicitudes con `moneda='PEN'`) y **"Aprobado $"** (solicitudes con `moneda='USD'`). Los helpers `fmtMoney(n, moneda)` y `fmtMoneyFull(n, moneda)` aceptan `'PEN'|'USD'` para formatear con el símbolo correcto. `montoSolicitudes(sols, detalles, moneda?)` acepta un tercer argumento opcional para filtrar por moneda antes de sumar.

**Dashboard** renders a dedicated panel per role via `DashboardPage.tsx` which branches on `userRole`:
- `ADMIN` — KPIs globales, dona por estado, barras mensual/proyectos, tabla de pendientes, panel de métricas de proveedores. Usa `getDashboardData()` + `getProveedorMetricas()`.
- `APROBADOR` — cola de aprobación, montos, dona Aprobadas/Rechazadas/en cola, filtro por proyecto (client-side), KPIs de A Rendir (montos y conteos filtrados por proyecto seleccionado), KPIs de Reembolso, **tarjetas de totales consolidados** ("Total comprometido S/" y "Total comprometido $" = OC Aprobadas + A Rendir Autorizados + Reembolso Autorizado, todos filtrados por proyecto con desglose), panel de métricas de proveedores. Usa `getAprobadorData()` + `getProveedorMetricas()`.
  - Filtro de proyecto aplica a: OC (via `applyFilter`), KPIs A Rendir (`arendirKpi`), totales A Rendir (`arendirAuthFil` — solo `Autorizado`), totales Reembolso (`reembolsoAuthFil` — solo `Autorizado`).
  - `ARendirRow` y `ReembolsoRow` incluyen `proyecto_id: number | null` (seleccionado en `getARendirAutorizados` / `getReembolsoAutorizados`) para permitir el filtrado client-side por proyecto.
- `EVALUADOR` — cola En Revision, promedio de días de espera, lista de más antiguas con alerta ≥3 días. Usa `getEvaluadorData()`.
- `VISUALIZADOR` — solicitudes aprobadas separadas en OC y RxH (4 KPIs: OC S/, OC $, RxH S/, RxH $), KPIs de A Rendir (Evaluado + Autorizado), tabla de aprobadas. Usa `getVisualizadorData()`. Los KPIs RxH usan `color="indigo"`.
- `USUARIO` — mis solicitudes, breakdown por estado, monto aprobado (estado Aprobado), acceso rápido a nueva solicitud. Usa `getUsuarioData(userId)`.

Cada función de servicio en `dashboardService.ts` hace sus propias queries optimizadas y devuelve solo los datos relevantes al rol.

**Módulo Proveedores** (`/proveedores`) — visible para ADMIN (1) y USUARIO (11):
- Lista de proveedores con métricas agregadas (promedio general, calidad, tiempo, precio, comunicación, % recomienda, total encuestas).
- Datos provienen de `proveedor` + `encuesta_proveedor` via `getProveedorConMetricas()` en `proveedorService.ts`.
- `EncuestaProveedorForm` aparece en `SolicitudDetallePage` cuando la solicitud está **Aprobada** y el usuario es el creador o ADMIN. Permite crear o editar la encuesta de satisfacción del proveedor (4 criterios 1-5 + recomendaría + comentarios).

**Plan Contable (`plan_contable_brash` table):** catalog table used to categorize each solicitud. Fields: `id`, `tipo_gasto_costo`, `codigo_starsoft`, `cuenta_contable_2020_starsoft`, `nombre_cuenta_contable`, `partida_presupuestal`, `partida_presupuesta_n1`, `partida_presupuesta_n2`. RLS policy: SELECT for authenticated users. Service function: `getPlanContable()` returns all rows ordered by `tipo_gasto_costo`.

**Plan Contable asignado por el USUARIO** (solo módulo Solicitudes):
- El usuario lo selecciona en **Step 4 del wizard** (searchable combobox). Es opcional para terminar el wizard, pero **obligatorio para enviar a revisión** (`canEnviar` verifica `!!solicitud.plan_contable_id`).
- Si no lo selecciona en el wizard, puede agregarlo desde el **detalle de la solicitud** mientras esté en Pendiente (card editable con combobox + botón "Guardar plan contable"). `handleSavePlanContable` llama a `updateSolicitud` y luego `reload`.
- El **EVALUADOR puede corregirlo** en `EvaluarModal` — el combobox se pre-llena con `planContableActual` (el valor ya guardado por el usuario). `onConfirm` sigue recibiendo el `planContableId` definitivo.
- Aplica **solo a Solicitudes** (no a A Rendir, Reembolso ni Caja Chica — esos módulos no tienen `plan_contable_id`).

**EvaluarModal** (`src/features/solicitud/components/EvaluarModal.tsx`) — modal shown to EVALUADOR/ADMIN when marking a solicitud as Evaluado. Props: `isRxH?`, `isOC?`, `totalSolicitud?`, `moneda?` ('PEN'|'USD'), `planContableActual?` (pre-fills from user's selection). Contains:
1. Searchable combobox for Plan Contable (mandatory). Pre-filled with `planContableActual` when modal opens. EVALUADOR can correct the user's selection. Filters across `tipo_gasto_costo`, `nombre_cuenta_contable`, `codigo_starsoft`.
2. **Retención IR** (only when `isRxH`): 3 pill buttons — 0% exonerado, 3%, 8%. Mandatory for RxH.
3. **Tipo de cambio** (only when `isOC` AND `moneda === 'USD'`): input numérico pre-llenado con TC venta SUNAT (`getTipoCambioUSD()`), editable. Convierte el total a soles: `totalEnSoles = totalUSD × TC`. Muestra conversión inline.
4. **Detracción** (only when `isOC` AND `totalEnSoles > d.monto_minimo` for at least one concept): pill buttons, one per detracción disponible. Optional — clicking same button deselects. Monto calculado en soles con `Math.round()` (sin decimales). Para USD muestra la fórmula completa: `($ total × TC × %)`.

`onConfirm` callback: `(planContableId, porcentajeRetencion?, detraccionId?, montoDetraccion?) => Promise<void>`. When the dropdown is open, the modal body adds `pb-64` to avoid clipping the list. No `overflow-hidden` on the modal wrapper; `rounded-t-2xl`/`rounded-b-2xl` on header/footer individually.

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

**`solicitud` columns added for RxH:**
- `numero_rxh`, `periodo_servicio` — datos del recibo por honorarios
- `porcentaje_retencion` — 0/3/8 (asignado por EVALUADOR)
- `monto_retencion` — calculado
- `aplica_suspension` — BOOLEAN (guardado al finalizar Step 3 del wizard)

**`solicitud` columns added for detracciones:**
- `detraccion_id` — FK to `detraccion.id` (nullable, solo OC, asignado por EVALUADOR)
- `monto_detraccion` — monto calculado

**`solicitud` columns added for pago:**
- `fecha_pago` (date, nullable) — fecha en que Contabilidad (VISUALIZADOR) marcó como pagado
- `cuenta_pago_id` (FK → `cuenta_bancaria`, nullable) — cuenta bancaria usada para el pago
- `usuario_pago` (UUID FK, nullable) — quien marcó el pago

All above fields are excluded from `SolicitudInsert`.

**Tipos de solicitud visibles en el dropdown de creación:** solo `PAGO A PROVEEDORES`, `POLIZAS Y SEGUROS` y `Recibo por Honorarios`. Los tipos `A RENDIR`, `CAJA CHICA` y `REEMBOLSO` están ocultos porque tienen módulos propios.

**Tabla `detraccion`:** 6 conceptos del sistema SPOT-SUNAT. Campos: `id`, `codigo` (ej. '022'), `concepto`, `porcentaje` (numeric), `monto_minimo` (numeric: 700 o 400 soles según concepto). RLS: SELECT for authenticated users. Service: `getDetracciones()` returns all rows. La detracción es **solo informativa** — no altera el total de la solicitud; se guarda para reportes.

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
- `fecha_pago` (date, nullable), `cuenta_pago_id` (FK → `cuenta_bancaria`, nullable), `usuario_pago` (UUID FK, nullable)

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
- VISUALIZADOR en Autorizado (sin `fecha_pago`): "Marcar pagado" (abre `PagoModal`)
- Todos desde En Revision en adelante: "Descargar PDF"
- Si estado es Rechazado o Devuelto: alerta visible con el motivo (`comentario`)
- Badge "Pagado dd/mm/yyyy" en header cuando `fecha_pago` está presente

**Orden estable de gastos:** `getCajaChicaById` ordena los `detalles` embebidos por `id` ascendente (`.order('id', { ascending: true, foreignTable: 'caja_chica_detalle' })`) — antes no tenía orden explícito, así que la lista podía mostrarse en distinto orden cada vez que se recargaba (por ejemplo al editar un gasto), dando la sensación de que los ítems "se movían". Ordenar por `id` (que nunca cambia) garantiza que cada gasto se quede siempre en la misma posición, sin importar qué campo se edite.

**Edición de gastos desde el detalle:** `ARendirDetallePage` permite agregar, editar y eliminar líneas de `solicitud_arendir_detalle` directamente (no solo durante el wizard). El total se recalcula automáticamente via trigger `trg_recalc_arendir_total`.

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

## Módulo Reembolso

Gestión de **reembolso de gastos** — un empleado registra gastos ya realizados y solicita su devolución. Estructura análoga al módulo A Rendir.

**Rutas:**
- `/reembolso` — listado (`ReembolsoPage`)
- `/reembolso/nueva` — wizard de creación (`ReembolsoNuevaPage`)
- `/reembolso/:id` — detalle y acciones (`ReembolsoDetallePage`)

**Sidebar:** visible para ADMIN (1), EVALUADOR (8), APROBADOR (9), VISUALIZADOR (10), USUARIO (11). Solo USUARIO y ADMIN pueden crear.

**Feature folder:** `src/features/reembolso/` — contiene `types/reembolso.ts`, `services/reembolsoService.ts`, `hooks/useReembolso.ts`.

**Tablas Supabase:**
- `solicitud_reembolso` — cabecera
- `solicitud_reembolso_detalle` — líneas de gasto

**Campos de `solicitud_reembolso`:**
- `id`, `codigo` (auto-generado), `beneficiario_id` (UUID FK), `proyecto_id` (FK, nullable), `proyecto_partida_id` (FK, nullable)
- `moneda` ('PEN'|'USD'), `fecha_requerida` (date, nullable), `total_reembolso` (numeric)
- `banco`, `numero_cuenta`, `documento_sustento_path` (nullable)
- `estado`: `'Pendiente'` | `'En Revision'` | `'Evaluado'` | `'Autorizado'` | `'Rechazado'` | `'Devuelto'`
- `usuario_aprobador`, `fecha_aprobacion`, `comentario`, `plan_contable_id`, `usuario_evaluador`, `fecha_creacion`
- `fecha_pago` (date, nullable), `cuenta_pago_id` (FK → `cuenta_bancaria`, nullable), `usuario_pago` (UUID FK, nullable)

**Flujo de estados:** idéntico a A Rendir (Pendiente → En Revision → Evaluado → Autorizado/Rechazado/Devuelto).

**Protección contra doble clic al agregar gasto:** `handleDetSave` en `ReembolsoDetallePage.tsx` usa una bandera síncrona (`useRef`, no `useState`) además del `disabled={detSaving}` del botón — un doble clic muy rápido puede llegar antes de que React vuelva a pintar el botón deshabilitado (la actualización de `disabled` depende de un re-render), y sin la bandera síncrona ambos clics alcanzaban a disparar el guardado, duplicando el gasto. La bandera (`detSavingRef.current`) se revisa y activa de forma inmediata, sin esperar al re-render.

**Diferencias clave vs A Rendir:**
- Sin campo `importe` (adelanto) — solo `total_reembolso`
- Sin `numero_pago`
- El wizard y detalle tienen la misma estructura pero sin la lógica de balance adelanto vs gasto

`ReembolsoDetallePage` también permite editar gastos inline y tiene botón "Marcar pagado" para VISUALIZADOR en estado Autorizado (igual que `ARendirDetallePage`).

---

---

## Protección contra doble evaluación

Con más de un usuario EVALUADOR, dos personas podían abrir la misma solicitud "En Revision" a la vez y ambas evaluarla — la segunda sobrescribía silenciosamente el plan contable/retención/detracción de la primera sin darse cuenta. `marcarEvaluado` (solicitud), `marcarEvaluadoReembolso` y `marcarEvaluadoCajaChica` ahora incluyen `.eq('estado_id'/'estado', 'En Revision')` en el UPDATE — si la fila ya no está en ese estado (alguien más la evaluó primero), la query devuelve 0 filas y se lanza `Error('... ya fue evaluada por otro evaluador ...')`, que el modal captura y muestra en un toast (antes de esto los `catch` genéricos de las páginas ocultaban el mensaje real). A Rendir no lo necesita: su paso de evaluador fue simplificado (`cerrarRendicion` es solo un cambio de estado, no asigna datos que puedan pisarse).

---

## Seguridad de visibilidad por rol (RLS)

Las policies SELECT de las 10 tablas de registros (`solicitud`, `solicitud_detalle`, `solicitud_archivo`, `solicitud_arendir(+detalle)`, `solicitud_reembolso(+detalle)`, `caja_chica(+detalle)`, `devolucion_cliente`) restringen al rol **USUARIO (11)** a ver **solo sus propios registros** (creador/beneficiario/responsable = `auth.uid()`); los roles ADMIN/EVALUADOR/APROBADOR/VISUALIZADOR ven todo vía la función `es_rol_privilegiado()` (SECURITY DEFINER, consulta `usuario_rol` con roles 1/8/9/10). Esto bloquea a nivel de BD que un USUARIO abra `/solicitudes/:id` ajeno por URL — la página muestra "Solicitud no encontrada".

**Funciones SECURITY DEFINER para datos agregados** (necesarias porque el rol USUARIO ya no ve filas ajenas, pero sí necesita totales globales):
- `get_consumo_proyectos(pids bigint[])` → devuelve `(scope, ref_id, moneda, total)` con el consumo agregado de los 5 módulos por proyecto/partida. `getConsumoByProyectos` en `proyectoService.ts` es ahora un wrapper de este RPC. **Al cambiar los criterios de consumo, actualizar el SQL del RPC, no solo el TS.**
- `get_saldo_anterior_caja(pid)` → saldo de la última caja chica pagada del proyecto (puede ser de otro responsable). Usada por `getSaldoAnterior` en `cajaChicaService.ts`.

Los buckets de Storage siguen con policies por bucket completo (cualquier authenticated lee) — endurecerlos por dueño queda como mejora futura.

---

## Recuperación de contraseña e invitación de usuarios

**Recuperar contraseña:** El enlace "¿Olvidaste tu contraseña?" en `LoginForm.tsx` navega a `/forgot-password` (ruta pública). Ahí se llama `requestPasswordReset(email)` (`authService.ts`) → `supabase.auth.resetPasswordForEmail()` con `redirectTo: /reset-password`. La página `/reset-password` (también pública, fuera de `ProtectedRoute`) detecta automáticamente la sesión que Supabase crea desde el enlace del correo (`detectSessionInUrl` por defecto en el cliente) y permite establecer nueva contraseña con `updatePassword()` → `supabase.auth.updateUser({ password })`. La misma página se reutiliza para el flujo de invitación de usuarios nuevos.

**Administración de usuarios** (`/usuarios`, solo ADMIN): página `UsuariosPage.tsx` con tabla de todos los usuarios (`getUsuariosConRol()` en `usuarioService.ts` — combina `usuario` + `usuario_rol` client-side) y selector de rol inline por fila (`cambiarRolUsuario()` — `upsert` directo en `usuario_rol`, permitido por policies RLS `usuario_rol_admin_*` que verifican `rol = 1` del usuario autenticado). Policy `usuario_admin_update` permite además que el ADMIN edite el perfil (nombres, apellidos, cargo, dni) de cualquier usuario vía `actualizarPerfilUsuario()`.

**Área del usuario:** el modal de crear y editar usuario incluye un selector de área (tabla `area`, 10 registros: Administración, Contabilidad, Marketing, Sistemas, Comercial, Legal, Proyectos, Obras, PostVenta, Ventas) — se guarda en `area_usuario`. Es la misma tabla que usa `area_usuario` para el módulo "Gasto por Área" y para la columna "Área" del reporte consolidado; si un usuario se crea sin asignarle área, no aparecerá agrupado correctamente en esos reportes. `asignarAreaUsuario()` preserva histórico: desactiva (`estado = 0`) la fila activa anterior antes de insertar la nueva con `estado = 1`, en vez de sobrescribirla. Al crear un usuario nuevo, el área (si se eligió) se inserta en el mismo llamado a `api/admin-users.ts` (service role, sin pasar por RLS); al editar un usuario existente, se hace directo desde el cliente gracias a las policies `area_usuario_admin_*`.

**Reenviar invitación:** botón visible solo cuando el estado es "Pendiente" (`email_confirmed_at IS NULL`, expuesto por `GET /api/admin-users` como `pending`). `inviteUserByEmail` no se puede volver a llamar sobre una cuenta ya existente (Supabase da error), así que `reenviarInvitacion()` usa `supabase.auth.resetPasswordForEmail()` — funciona igual para cuentas sin contraseña o con invitación caducada, sin pasar por la Edge Function (es una llamada pública, no requiere sesión).

**Desactivar/reactivar usuario:** no hay borrado real — las tablas del sistema no tienen FK hacia `auth.users`, así que eliminar una cuenta dejaría nombres en blanco en el historial de solicitudes/aprobaciones ya creadas. En su lugar, `cambiarEstadoUsuario(id, 'ban' | 'unban')` llama al endpoint `PATCH /api/admin-users`, que usa `auth.admin.updateUserById` con `ban_duration` (service role) para bloquear/desbloquear el login sin tocar sus datos históricos. El estado (activo/desactivado) se obtiene con `getEstadoUsuarios()` (`GET /api/admin-users`, lista `auth.admin.listUsers()`). Un ADMIN no puede desactivarse a sí mismo (bloqueado tanto en la UI como en el endpoint).

**Crear usuario nuevo:** botón "Nuevo usuario" abre modal (correo, nombres, apellidos, cargo, DNI, rol) → `crearUsuario()` llama a la Edge Function `api/admin-users.ts` (no se puede hacer desde el cliente porque requiere la Service Role Key de Supabase). La función: valida que el caller sea ADMIN, llama `supabase.auth.admin.inviteUserByEmail()` (envía el correo de invitación vía el SMTP configurado — el mismo `sistema@avenir.pe`), actualiza el perfil en `usuario` (el trigger `on_auth_user_created` solo inserta `id` y `correo`; nombres/apellidos/cargo/dni se completan aquí) y crea la fila en `usuario_rol`. El usuario invitado hace clic en el enlace del correo y llega a `/reset-password` para crear su propia contraseña.

**Env vars requeridas para `api/admin-users.ts`:** `SUPABASE_SERVICE_ROLE_KEY` (Settings → API en Supabase — **nunca** con prefijo `VITE_`, no debe llegar al bundle del cliente) y reutiliza `VITE_SUPABASE_URL`. Configurar en Vercel → Environment Variables.

**`SITE_URL`** (opcional, con fallback hardcodeado a `https://avenir-rose.vercel.app`): la función **nunca** usa el header `Origin` de la petición para construir el `redirectTo` del enlace de invitación — si se prueba desde `localhost` u otro entorno, el enlace quedaría roto para el usuario real. Al comprar un dominio propio, actualizar esta variable en Vercel (o el fallback en el código) para que las invitaciones apunten al dominio nuevo.

---

## Estado de Pago

Funcionalidad que permite a **Contabilidad (VISUALIZADOR)** marcar un registro como pagado, seleccionando la cuenta bancaria desde la que se realizó el desembolso.

**Aplica a:** `solicitud` (Aprobado), `solicitud_arendir` (Autorizado), `solicitud_reembolso` (Autorizado), `caja_chica` (Autorizado).

**Campos en cada tabla:** `fecha_pago` (date), `cuenta_pago_id` (FK → `cuenta_bancaria`), `usuario_pago` (UUID FK). Excluidos de los tipos Insert.

**`PagoModal`** (`src/features/solicitud/components/PagoModal.tsx`) — modal con selector de fecha y dropdown de cuentas bancarias agrupadas por tipo ("Cuentas generales" / "Por centro de costo"). Solo abre cuando: rol = VISUALIZADOR AND estado = Aprobado/Autorizado AND `fecha_pago IS NULL`.

**`marcarPagado(tabla, id, cuentaPagoId, fechaPago, usuarioPagoId)`** en `src/features/solicitud/services/cuentaBancariaService.ts` — actualiza los 3 campos en la tabla indicada.

**Visualización:** badge verde "Pagado dd/mm/yyyy" en header del detalle; en tablas de listado, badge junto al badge de estado (verde = pagado, naranja = por pagar).

**Filtro en `SolicitudesPage`:** dropdown "Por pagar / Pagados" visible solo para VISUALIZADOR. Implementado via `pagoFilter` en `SolicitudFiltros` y `setPagoFilter` en `useSolicitudes`.

---

## Cuentas Bancarias

Catálogo de cuentas bancarias por empresa, administrado por ADMIN desde la página de Empresas.

**Tabla `cuenta_bancaria`:** `id`, `proyecto_id` (FK → proyecto), `proyecto_partida_id` (FK → proyecto_partida, nullable), `banco` (BBVA/INTERBANK/BCP/SCOTIABANK/BANBIF/PICHINCHA), `moneda` ('PEN'/'USD'), `tipo` (text), `numero_cuenta` (text), `cci` (text, nullable), `concepto` (text, nullable), `estado` ('Activo'/'Inactivo').

**`CuentasBancariasPanel`** (`src/features/proyecto/components/CuentasBancariasPanel.tsx`) — slide-in desde `ProyectosPage` (botón tarjeta CreditCard por empresa). CRUD completo: listar, crear, editar, eliminar. Disponible solo para ADMIN.

**`getCuentasByProyecto(proyectoId)`** en `cuentaBancariaService.ts` — retorna cuentas activas del proyecto con join de `proyecto_partida(nombre)`. Usado por `PagoModal` para mostrar las opciones de pago.

**21 cuentas cargadas** para: COPISAC, Costazul, Mixxo, Park View, Tinto Magdalena, Parque Fátima.

---

## Power BI

El proyecto puede conectarse a Power BI usando la conexión directa a PostgreSQL de Supabase.

**Parámetros de conexión:**
- Servidor: `db.gjdixdpprltvujcijvhb.supabase.co`
- Puerto: `5432`
- Base de datos: `postgres`
- Usuario: `postgres` (o un usuario de solo lectura)
- Modo: DirectQuery o Import

Las tablas y vistas de Supabase son accesibles directamente. Power BI puede leer `solicitud`, `solicitud_arendir`, `solicitud_reembolso`, `caja_chica`, `proyecto`, etc. para generar reportes y dashboards externos.

---

**TypeScript config:** strict mode with `noUnusedLocals` and `noUnusedParameters` enabled — unused variables will cause build errors. Use `Omit<T, 'id' | 'fecha_creacion' | ...>` for insert/update types (see `SolicitudInsert` as the canonical example).

**Números de cuenta bancaria siempre sin guiones:** todos los campos "Número de cuenta / CCI" (Solicitudes, A Rendir, Reembolso, Devolución, Cuentas de Proveedor, Cuentas Bancarias de empresa) limpian automáticamente cualquier carácter no numérico en el `onChange` (`.replace(/\D/g, '')`) — necesario porque el Excel de pago masivo BBVA usa el valor tal cual está guardado, y un guion rompe el formato que exige el banco.

**RUC lookup:** `rucService.ts` calls `/api/ruc?numero=<ruc>`. En dev, `vite.config.ts` proxea a `https://api.decolecta.com/v1/sunat/ruc`. En producción (Vercel), `api/ruc.ts` es una Edge Function que hace el mismo fetch con la API key del servidor.

**Tipo de cambio SUNAT:** `getTipoCambioUSD()` en `rucService.ts` llama `/api/tipo-cambio`. En dev, `vite.config.ts` proxea a `https://api.decolecta.com/v1/tipo-cambio/sunat`. En producción, `api/tipo-cambio.ts` es una Edge Function (Vercel). Respuesta: `{ buy_price, sell_price, base_currency, quote_currency, date }`. Se usa `sell_price`. Se consume en: Step 3 del wizard (RxH USD umbral S/1,500 + OC USD umbral S/3,500 para Contrato), `EvaluarModal` (detracción OC USD), `SolicitudDetallePage` (Contrato OC USD).

**`api/` folder (Vercel Edge Functions):** `api/ruc.ts` y `api/tipo-cambio.ts` — proxies server-side hacia decolecta.com usando `DECOLECTA_API_KEY`. La variable de entorno debe estar configurada en Vercel → Settings → Environment Variables.

**Blindaje contra fechas corruptas:** las 9 implementaciones de `fmtDate` que usan `Intl.DateTimeFormat(...).format(...)` (a diferencia de `.toLocaleDateString()`, que degrada a texto "Invalid Date" sin romper nada) lanzan `RangeError` si la fecha guardada es inválida (ej. un año mal tipeado como `"62026-06-30"`) — sin `try/catch`, ese error no capturado tumbaba toda la página en blanco. Todas están envueltas en `try/catch` devolviendo `'Fecha inválida'` en vez de crashear. Al agregar un nuevo `fmtDate` con `Intl.DateTimeFormat`, replicar este patrón.

**Formateo de fechas (timezone):** Todas las funciones `fmtDate` en el proyecto usan el patrón `s.includes('T') ? s : s + 'T00:00:00'` antes de pasarlo a `new Date()`. Esto evita que fechas tipo `"YYYY-MM-DD"` (sin hora) se parseen como UTC medianoche y aparezcan un día antes en Perú (UTC-5). **No usar** `new Date(dateString)` directamente con strings de solo fecha ni `new Date().toISOString().slice(0,10)` para defaults — usar la función local `localToday()` del `PagoModal`.

**`EvaluarModal` carga de datos:** Usa `Promise.all` con handlers independientes por promesa (no un `.catch` global) para que un fallo del TC SUNAT no impida cargar el plan contable. Si `getTipoCambioUSD()` falla en producción, el campo TC aparece vacío y el evaluador lo ingresa manualmente.

**`solicitud` columns added for detracción pago:**
- `detraccion_pagada` — boolean, DEFAULT false, lo marca VISUALIZADOR/ADMIN
- `fecha_pago_detraccion` — date nullable, fecha del pago al Banco de la Nación

**Excel SPOT Detracciones (`SolicitudesPage`):** Botón "Excel Detracciones (N)" visible para VISUALIZADOR y ADMIN cuando la selección incluye solicitudes con `detraccion_id`. 11 columnas: RUC, TIPO DOC (01), SERIE, NUMERO, FECHA EMISION, IMPORTE TOTAL (monto_total), PORCENTAJE DETRACCIÓN, IMPORTE DETRACCIÓN (Math.round monto_detraccion), CODIGO SERVICIO, PERIODO TRIBUTARIO (MM/YYYY), OBSERVACION. Alerta si alguna solicitud no tiene `fecha_emision_factura`. SERIE/NUMERO se obtienen del `numero_factura` splitado por guion.

**`SolicitudesTable`:** La columna se llama **"Vencimiento"** (era "Venc. Factura") — aplica a OC (fecha vencimiento factura) y RxH (fecha vencimiento recibo).

**Campos RxH — `fecha_emision_factura` y `fecha_vencimiento_factura`:** Se capturan en Step 1 del wizard para RxH. El `createSolicitud` en Step 1 NO debe sobrescribir estos campos con null — se pasan desde el payload directamente. En `SolicitudDetallePage` se muestran con `InfoField` solo cuando `isRxH`.

**Env vars** (`.env.local`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase client (`src/api/supabase.ts`)
- `DECOLECTA_API_KEY` — RUC lookup y tipo de cambio SUNAT (server-side: dev proxy + Vercel Edge Functions)

---

## Módulo Reportes

Consolidación de registros aprobados/autorizados de todos los módulos en un Excel descargable.

**Ruta:** `/reportes` — visible para ADMIN (1) y VISUALIZADOR (10).

**Feature folder:** `src/features/reportes/services/reportesService.ts` — sin types propios ni hooks; solo servicio + exportación.

**Página:** `src/pages/ReportesPage.tsx` — filtros (fecha desde/hasta, proyecto opcional), botón "Buscar", tarjetas KPI por módulo, barra de totales consolidados, tabla de vista previa, botón "Exportar Excel".

**Fuentes de datos (filtradas por `fecha_aprobacion` dentro del rango):**
- **OC y RxH** — `solicitud` con `estado = 'Aprobado'`. Subtotal de `solicitud_detalle`; IGV 18% solo para OC. Distingue OC vs RxH por `solicitud_tipo.nombre === 'Recibo por Honorarios'`.
- **A Rendir** — `solicitud_arendir` con `estado = 'Autorizado'`. Monto = `total_reembolso`.
- **Reembolso** — `solicitud_reembolso` con `estado = 'Autorizado'`. Monto = `total_reembolso`.
- **Caja Chica** — `caja_chica` con `estado = 'Autorizado'`. Monto = `total_gastos`. Color: púrpura.

**`ReporteRow` interface:** `tipo` (`'OC'|'RxH'|'A Rendir'|'Reembolso'|'Caja Chica'`), `codigo`, `fecha_solicitud`, `fecha_requerida`, `fecha_aprobada`, `fecha_emision`, `fecha_pago`, `requerido_por`, `area`, `beneficiario`, `documento` (= `numero_factura` para OC, `numero_rxh` para RxH, null para otros), `ruc` (RUC para OC/RxH, DNI para A Rendir/Reembolso/Caja Chica), `proyecto`, `partida`, `concepto`, `moneda`, `total_usd`, `total_pen`, `detraccion`, `retencion`, `girar_usd`, `girar_pen`, `banco`, `cuenta`, `correo`, `archivo_contrato`, `archivo_sustento`, `archivo_cotizacion`, `archivo_factura`, `archivo_otros`.

**Detracción en reportes:** `detraccion` siempre en S/ (SUNAT), sin importar la moneda de la solicitud. `girar_usd` descuenta la detracción en dólares: `total - (total × porcentaje / 100)`, **sin redondear** el descuento intermedio (solo el resultado final a 2 decimales) — el redondeo a soles enteros solo aplica al depósito SUNAT (`monto_detraccion`), no al monto girado en dólares. `girar_pen` descuenta detracción y retención en soles.

**`exportarReporteExcel(rows, filtros, proyectoNombre)`:** ExcelJS workbook con 1 hoja "Reporte":
- Fila 1: título mergeado, fondo `#003D7D`, fuente blanca.
- Fila 2: **39 cabeceras** — #, MÓDULO, CÓDIGO, F.SOLICITUD, F.REQUERIDA, F.APROBADA, F.EMISIÓN, REQUERIDO POR, ÁREA, BENEFICIARIO, DOCUMENTO, RUC/DNI, EMPRESA, CENTRO DE COSTO, CONCEPTO, CUENTA CONTABLE, NOMBRE CUENTA, PARTIDA PRESUP., PARTIDA N1, PARTIDA N2 (plan contable del registro, sin tipo de gasto ni código Starsoft; vacías para Devolución), **SUBTOTAL $, SUBTOTAL S/., IGV $, IGV S/.** (solo Solicitudes OC/RxH tienen valor — OC con 18%, RxH siempre 0; vacías para A Rendir/Reembolso/Caja Chica/Devolución, que no manejan IGV), TOTAL $, TOTAL S/., DETRACCIÓN, RETENCIÓN, GIRAR $, GIRAR S/., BANCO, CUENTA/CCI, CORREO, F.PAGO, CONTRATO, SUSTENTO, COTIZACIÓN, FACTURA, OTROS. Fondo `#1F497D`, fuente blanca bold, freeze panes 1-2. La fila TOTALES mergea columnas 1-20 y las sumas van en 21-30.
- Columnas CONTRATO/SUSTENTO/COTIZACIÓN/FACTURA/OTROS muestran `'SI'` o vacío según si existe archivo adjunto.
- Filas de datos: coloreadas por tipo (OC=azul tenue, RxH=verde tenue, A Rendir=amarillo tenue, Reembolso=rosa tenue, Caja Chica=púrpura tenue).
- Última fila: "TOTALES" mergeada en columnas 1-15, sumas de columnas numéricas, fondo `#D9E1F2`.
- Descarga automática como blob `Reporte_{fechaDesde}_{fechaHasta}.xlsx`.

**PostgREST cast pattern en el servicio:** los tipos de retorno de Supabase usan `as unknown as MyType[]` cuando el tipo inferido no coincide con la estructura esperada (joins de FK que PostgREST puede devolver como array o null según el esquema).

---

## Estado Observado (devolución por contabilidad)

El **VISUALIZADOR** (y ADMIN) tiene botón **"Devolver"** en el estado previo al pago de los 5 módulos (Solicitud Aprobado, A Rendir Aprobado, Reembolso Autorizado, Caja Chica Autorizado, Devolución Autorizado). Al devolver con **motivo obligatorio**, el registro pasa a estado **`Observado`** (badge ámbar en todos los listados/detalles).

**Flujo Observado:** el creador ve una alerta ámbar con el motivo, puede corregir (documentos, detalles, datos de factura — según módulo) y hace clic en **"Reenviar a contabilidad"**, que regresa el registro **directo** a Aprobado/Autorizado **sin pasar de nuevo por evaluador ni aprobador** (conserva `usuario_aprobador`/`fecha_aprobacion`).

**Restricción clave:** en Observado los **datos bancarios (banco, número de cuenta) NO son editables**. En Solicitudes esto se logra ocultando el botón "Editar" del header (solo visible en Pendiente); en los demás módulos no existe UI de edición de cabecera fuera del wizard.

**Implementación:**
- `estado_soli` tiene fila `Observado` (tipo Proceso). CHECK constraints de `solicitud_arendir`, `solicitud_reembolso` y `devolucion_cliente` incluyen `'Observado'` (caja_chica no tiene CHECK).
- Servicios: `observarSolicitud`/`reenviarAContabilidad` (solicitud), `devolverARendir` (ahora → Observado)/`reenviarContabilidadARendir`, `observarReembolso`/`reenviarContabilidadReembolso`, `observarCajaChica`/`reenviarContabilidadCajaChica`, `devolverDevolucion` (→ Observado)/`reenviarContabilidadDevolucion`.
- En Reembolso y Caja Chica el handler `handleDevolver` de la página de detalle hace branch: estado Autorizado → observar (contabilidad); estados anteriores → Devuelto (aprobador/evaluador). En Solicitud el branch es isAprobado → observar.
- El motivo se guarda en `comentario` (`comentario_gerencia` en solicitud).

---

## Módulo Devolución de Cliente

Registro de devoluciones de dinero a clientes (egreso). Sin líneas de detalle: un solo monto por registro.

**Rutas:** `/devolucion` (listado), `/devolucion/nueva` (formulario), `/devolucion/:id` (detalle).

**Sidebar:** "Devolución Cliente" con ícono `RotateCcw`, roles [1, 9, 10, 11] (sin EVALUADOR). Solo USUARIO y ADMIN crean.

**Feature folder:** `src/features/devolucion/` — `types/devolucion.ts`, `services/devolucionService.ts`, `hooks/useDevolucion.ts`.

**Tabla `devolucion_cliente`:** `id`, `codigo` (trigger `DVC-YY-0001`), `creador_id`, `proyecto_id`, `proyecto_partida_id`, `cliente_nombre`, `cliente_dni`, `monto`, `moneda` (PEN/USD), `banco`, `numero_cuenta`, 4 paths de archivos (`sustento_path`, `boucher_separacion_path`, `constancia_separacion_path`, `sustento_desistimiento_path`), `estado` CHECK (`Pendiente`/`Autorizado`/`Rechazado`), `usuario_aprobador`, `fecha_aprobacion`, `comentario`, `fecha_pago`, `cuenta_pago_id`, `usuario_pago`.

**Flujo (sin evaluador):** Pendiente → APROBADOR/ADMIN Autoriza (comentario opcional) o Rechaza (comentario obligatorio) → VISUALIZADOR/ADMIN marca pagado (PagoModal). `fecha_pago` marca el pago, no es un estado.

**Storage:** bucket `devolucion-documentos`, path `{devolucionId}/{tipo}/{timestamp}.{ext}`. En el formulario de creación, Sustento es obligatorio; los otros 3 archivos son opcionales.

**Integraciones:**
- **Reportes:** `fetchDevoluciones` en `reportesService.ts` — tipo `'Devolución'`, color teal (`E0F2F1`), filtra `estado = 'Autorizado'` por `fecha_aprobacion`. `beneficiario` = cliente_nombre, `ruc` = cliente_dni.
- **Dashboards:** `getDevolucionesAutorizadas()` (estados Pendiente + Autorizado) alimenta ADMIN (fila KPI), APROBADOR (fila KPI con cola "por autorizar" + fila 'Devolución' en gráficos Aprobado vs Pagado) y VISUALIZADOR (por pagar / pagado). Las filas KPI solo se renderizan si hay registros.
- **Excel BBVA:** botón en `DevolucionPage` para VISUALIZADOR/ADMIN — DOI `'L'` + DNI del cliente, nombre con `sanitizeBBVA`, referencia `'Devolucion Cliente'`.

---

## Módulo Gasto por Plan Contable

Página `/plan-contable` — visible para **ADMIN (1)** y **USUARIO (11)**. El USUARIO ve solo sus propias solicitudes; ADMIN ve todas.

**Feature folder:** `src/features/plan-contable/services/planContableGastoService.ts` — sin types propios ni hooks.

**`getGastoPorPlanContable(userId?)`** — consulta `solicitud` con `plan_contable_id IS NOT NULL`, filtra client-side por `estado_soli.nombre === 'Aprobado'`, suma `solicitud_detalle` por solicitud (OC con IGV 18%, RxH sin IGV) y agrupa por plan contable. Retorna `GastoPlanContable[]` con `pen`, `usd`, `cantidad` ordenado por monto desc. Solo cubre Solicitudes (no A Rendir/Reembolso/Caja Chica).

**Página:** `src/pages/PlanContableGastoPage.tsx` — buscador de texto, dropdown de plan contable, tarjetas de totales (S/, $, # solicitudes), lista de cards con barra de progreso relativa al plan con mayor gasto.

**Sidebar:** item "Plan Contable" con ícono `PieChart`, roles [1, 11].

---

## Gráficos Aprobado vs Pagado (Dashboard APROBADOR)

El panel APROBADOR incluye dos `ChartCard` con `BarChart` (Recharts) comparando monto aprobado/autorizado vs monto ya pagado (`fecha_pago IS NOT NULL`) por módulo: Solicitudes, A Rendir, Reembolso y Caja Chica (solo S/). El gráfico USD se renderiza solo si hay datos en dólares. Respetan el filtro de empresa del panel.

Para soportarlos: `SOL_SELECT` en `dashboardService.ts` incluye `fecha_pago`; `ARendirRow`, `ReembolsoRow` y el nuevo `CajaChicaRow` (helper `getCajaChicaAutorizadas()` en `cajaChicaService.ts`) incluyen `fecha_pago`; `AprobadorData` incluye `cajaChica`.

---

## Módulo Caja Chica

Fondo rotativo de efectivo por empresa para gastos menores (agua, luz, insumos, movilidad). El monto ya está aprobado de antemano; el usuario solo rinde los comprobantes.

**Rutas:**
- `/caja-chica` — listado (`CajaChicaPage`)
- `/caja-chica/nueva` — creación (`CajaChicaNuevaPage`)
- `/caja-chica/:id` — detalle y acciones (`CajaChicaDetallePage`)

**Sidebar:** visible para todos los roles. Solo USUARIO y ADMIN pueden crear.

**Feature folder:** `src/features/caja-chica/` — `types/cajaChica.ts`, `services/cajaChicaService.ts`, `hooks/useCajaChica.ts`, `components/CajaChicaPDF.tsx`.

**Tablas Supabase:**
- `caja_chica` — cabecera
- `caja_chica_detalle` — líneas de gasto
- `proyecto.monto_caja_chica` — campo que define el fondo por empresa (configurado por ADMIN)

**Campos de `caja_chica`:**
- `id`, `codigo` (auto: CC-MM-YYYY-NNN), `proyecto_id` (FK), `responsable_id` (UUID FK)
- `periodo_desde`, `periodo_hasta` (dates)
- `monto_asignado` — fondo total de la empresa
- `saldo_anterior` — sobrante de la caja chica anterior (se acumula)
- `transferencia` — `monto_asignado - saldo_anterior` (lo que se repone)
- `total_gastos` — recalculado por trigger al insertar/editar/eliminar detalles
- `saldo_actual` — `monto_asignado - total_gastos`
- `cuenta_bbva` (text, nullable)
- `estado`: `'Pendiente'` | `'En Revision'` | `'Evaluado'` | `'Autorizado'` | `'Rechazado'` | `'Devuelto'`
- `usuario_aprobador`, `fecha_aprobacion`, `comentario`, `fecha_creacion`
- `plan_contable_id` (FK → `plan_contable_brash`, nullable) — asignado por EVALUADOR
- `usuario_evaluador` (UUID FK, nullable)
- `fecha_pago` (date, nullable), `cuenta_pago_id` (FK → `cuenta_bancaria`, nullable), `usuario_pago` (UUID FK, nullable)

**Campos de `caja_chica_detalle`:**
- `id`, `caja_chica_id` (FK, CASCADE), `fecha`, `area_id` (FK a tabla `area` — código de costos)
- `proveedor`, `tipo_documento` (FACTURA/RECIBO/BOLETA/PLLA-MOV/TICKET/OTRO)
- `numero_documento`, `detalle`, `monto`, `archivo_path`

**Supabase Storage:** bucket `caja-chica-documentos` — comprobantes por gasto.

**Flujo:** Pendiente → En Revision → **Evaluado** (plan contable, EVALUADOR) → Autorizado (APROBADOR) / Rechazado / Devuelto.

```
Pendiente
  ↓ USUARIO/ADMIN → enviar a revisión
En Revision
  ├─ EVALUADOR/ADMIN → marcarEvaluadoCajaChica(id, planId, userId) → Evaluado
  └─ EVALUADOR/ADMIN → devolverDesdeRevisionCajaChica(id, comentario) → Devuelto
Evaluado
  ├─ APROBADOR/ADMIN → autorizarCajaChica → Autorizado ✅
  ├─ APROBADOR/ADMIN → rechazarCajaChica → Rechazado ❌
  └─ APROBADOR/ADMIN → devolver → Devuelto
Autorizado
  └─ VISUALIZADOR → marcarPagado → badge Pagado
```

**Acciones en `CajaChicaDetallePage`:**
- VISUALIZADOR en Autorizado (sin `fecha_pago`): "Marcar pagado" (abre `PagoModal`)
- Badge "Pagado dd/mm/yyyy" en header cuando `fecha_pago` está presente
- Botón PDF disponible desde En Revision en adelante

**Documento sustento general:** columna `documento_sustento_path` en `caja_chica` (patrón igual a A Rendir) — se sube desde el detalle (tarjeta "Documento sustento", visible cuando `canEdit`), no en el wizard de creación. `uploadSustentoCajaChica()` + `updateCajaChica()` guardan el path; `getArchivoCajaChicaUrl()` genera la URL firmada para verlo.

**Bug corregido (archivo se borraba al editar):** `handleSaveDet` en el detalle enviaba siempre `archivo_path` en el payload de actualización (con `null` si no se adjuntaba uno nuevo), borrando el archivo ya subido de un gasto al corregir cualquier otro campo. Ahora solo se incluye `archivo_path` en el `UPDATE` si el usuario adjunta un archivo nuevo.

**Botón "Descargar PDF":** antes solo aparecía después de "Enviar a revisión" (`!isPendiente`); ahora está disponible desde Pendiente en adelante (`canShowPDF = detalles.length > 0`), igual que en los demás módulos.

**Lógica de saldo acumulable:** Al crear nueva caja chica, `getSaldoAnterior(proyectoId)` busca la última caja chica del mismo proyecto que tenga `fecha_pago IS NOT NULL` (pagada) y toma su `saldo_actual`. La transferencia = fondo - saldo anterior (solo se repone lo gastado). Solo cajas pagadas aportan saldo — una autorizada sin pagar no cuenta.

**CajaChicaPDF** (`@react-pdf/renderer`, landscape A4): título, header (código, responsable, empresa, período, cuenta), resumen financiero (saldo anterior, transferencia, monto asignado, saldo actual, pendiente a reembolsar), tabla de gastos con columna de código de costos (área), total + saldo, dos firmas (responsable + aprobador).

**Dropdown de áreas:** consulta directo la tabla `area` (no `area_usuario`) para mostrar todas las áreas disponibles como código de costos.

**Triggers:**
- `trg_caja_chica_codigo` — genera código automático CC-MM-YYYY-NNN
- `trg_recalc_caja_chica` — recalcula `total_gastos` y `saldo_actual` al modificar detalles
- `trg_recalc_arendir_total` — recalcula `total_reembolso` en A Rendir al modificar detalles
- `trg_recalc_reembolso_total` — recalcula `total_reembolso` en Reembolso al modificar detalles

---

## UI Label Mapping (Empresa / Centro de costo)

Las etiquetas visibles en la UI usan nombres de negocio distintos a los nombres técnicos:
- **"Empresa"** en la UI = tabla `proyecto` en la BD
- **"Centro de costo"** en la UI = tabla `proyecto_partida` en la BD
- Variables, tipos, imports y queries siguen usando `proyecto` / `partida` internamente

---

## Proyecto Partidas

Un proyecto (empresa) puede subdividirse en partidas (centros de costo, ej: COPISAC → HITO, JOMY, OP-ADM). Cada partida tiene su propio presupuesto en PEN y USD.

**Tabla `proyecto_partida`:** `id`, `proyecto_id` (FK), `nombre`, `presupuesto_pen` (numeric), `presupuesto_usd` (numeric), `estado` (text, default 'Activo'), `fecha_creacion`. RLS: SELECT para authenticated, INSERT/UPDATE/DELETE solo ADMIN (`EXISTS (SELECT 1 FROM usuario_rol WHERE usuario = auth.uid() AND rol = 1)`). FK `ON DELETE SET NULL` para no afectar solicitudes existentes.

**CRUD partidas:** `src/features/proyecto/services/proyectoService.ts` — `getPartidasByProyecto`, `createPartida`, `updatePartida`, `deletePartida`. Panel: `ProyectoPartidasPanel.tsx` (slide-in desde `ProyectosPage`).

**`ProyectosPage`** tiene dos paneles slide-in adicionales:
- `ProyectoPartidasPanel` — gestión de centros de costo (centros de costo/partidas)
- `CuentasBancariasPanel` — gestión de cuentas bancarias (icono tarjeta, solo ADMIN)

**Integración con solicitudes:** `proyecto_partida_id` (nullable FK) en `solicitud`, `solicitud_arendir`, `solicitud_reembolso`. Seleccionar partida es **obligatorio** cuando el proyecto tiene partidas. Los 3 wizards (`SolicitudNuevaPage`, `ARendirNuevaPage`, `ReembolsoNuevaPage`) cargan partidas con `useEffect` al cambiar proyecto y muestran dropdown condicional.

**`SOL_SEL` join:** `proyecto_partida:proyecto_partida_id(id,nombre,presupuesto_pen,presupuesto_usd)`.

---

## Control de Presupuesto

Funcionalidad que calcula el monto consumido vs presupuesto por proyecto y partida. Solo visible para **ADMIN (1)** y **APROBADOR (9)**.

**`getConsumoByProyectos(proyectoIds)`** en `proyectoService.ts` — retorna `{ porProyecto, porPartida }` con `Consumo = { pen: number; usd: number }`. Suma, todo agrupado por `proyecto_id` / `proyecto_partida_id`:
- Solicitudes con estado `Aprobado` o `Observado` (OC con IGV 18%, RxH sin IGV) — Observado cuenta porque ya fue aprobada, solo está en corrección tras ser devuelta por contabilidad
- A Rendir con estado `Aprobado`, `Pagado`, `En Revision`, `Cerrado` u `Observado` (todo lo ya aprobado por el APROBADOR) — usa `importe` (adelanto) mientras está en `Aprobado`, y `total_reembolso` (gasto real) en los demás estados
- Reembolso con estado `Autorizado` u `Observado`
- Caja Chica con estado `Autorizado` (`total_gastos`, siempre en soles)
- Devolución de Cliente con estado `Autorizado` u `Observado` (`monto`)

`getConsumoByAreas()` en `areaConsumoService.ts` sigue exactamente el mismo criterio de estados por módulo, agrupado por área del creador/beneficiario/responsable en vez de por proyecto. Incluye los 6 módulos: OC, RxH, A Rendir, Reembolso, Caja Chica, Devolución.

**Dónde se muestra:**
- **`ProyectosTable`** — columna "Consumido" con barra de progreso (verde <80%, amarillo 80-100%, rojo >100%). Solo si `consumo` prop está definida.
- **`ProyectoPartidasPanel`** — barras de consumo por moneda en cada partida. Prop `mostrarConsumo`.
- **`SolicitudDetallePage`** — card "Presupuesto — [partida/proyecto]" con barras, consumido, saldo. Se muestra para partida si existe, sino para el proyecto.
- **Wizards** — alerta de saldo debajo del select de partida (verde=saldo OK, amarillo=>80%, rojo=agotado).

---

## Gasto por Área

Página `/areas` — visible para **ADMIN (1)** y **APROBADOR (9)**.

**Feature folder:** `src/features/area/services/areaConsumoService.ts`.

**`getConsumoByAreas()`** — consulta `area_usuario` (estado=1) para mapear usuarios a áreas, luego suma montos aprobados/autorizados de OC, RxH, A Rendir y Reembolso agrupados por área del creador/beneficiario. Retorna `AreaConsumo[]` con desglose por módulo (oc_pen, oc_usd, rxh_pen, etc.) y totales.

**Página:** `src/pages/AreasConsumoPage.tsx` — barra de totales globales, cards por área con barra de progreso relativa al área que más gasta, desglose por módulo (OC, RxH, A Rendir, Reembolso) con montos PEN y USD.

**Sidebar:** item "Áreas" con ícono `Building2`, roles [1, 9].

**Sidebar:** item "Caja Chica" con ícono `Wallet`, roles ALL (todos los roles ven el listado, solo USUARIO y ADMIN crean).
