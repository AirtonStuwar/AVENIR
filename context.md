# AVENIR — Contexto de implementación activa

> Archivo de continuidad. Si se reinicia la sesión, leer esto primero antes de tocar código.
> Rama de trabajo: **`jmr`** — NO mergear a `main` salvo que el usuario lo indique explícitamente.

---

## 🎯 Próxima feature a implementar: Encuesta interna de proveedores

### Qué es
Encuesta **interna** (no se envía al proveedor) para que el USUARIO creador de una solicitud
evalúe al proveedor una vez que la solicitud está en estado **Completado**.
Los resultados se usan como métricas en el dashboard para que gerencia (APROBADOR/ADMIN)
decida qué proveedores convienen.

### Decisiones de diseño confirmadas
- La llena **solo el USUARIO creador** de la solicitud
- **Una encuesta por solicitud** (UNIQUE en solicitud_id)
- Se activa cuando `estado_soli.nombre = 'Completado'`
- Se crea una tabla `proveedor` con **RUC como PK** (VARCHAR 11)
- El lookup de RUC mejora: primero busca en `proveedor`, si no existe llama al API externo y guarda
- La encuesta linkea a `proveedor.ruc` (match natural con `solicitud.ruc`)
- Métricas en dashboard de **ADMIN** y **APROBADOR** (el gerente)
- Módulo **Proveedores** (sidebar, solo ADMIN=1) dejará de ser placeholder

### Dimensiones de la encuesta (1–5 estrellas)
- `calidad` — Calidad del producto/servicio
- `tiempo` — Cumplimiento de plazos
- `precio` — Relación calidad/precio
- `comunicacion` — Trato y comunicación
- `recomendaria` — ¿Lo contratarías de nuevo? (BOOLEAN)
- `comentarios` — Texto libre

---

## 📐 Schema BD a crear

```sql
-- Tabla de proveedores (RUC como PK, sirve de caché del API SUNAT)
CREATE TABLE public.proveedor (
  ruc                 VARCHAR(11) PRIMARY KEY,
  razon_social        TEXT,
  direccion           TEXT,
  estado_sunat        TEXT,          -- 'ACTIVO', 'BAJA DE OFICIO', etc.
  fecha_creacion      TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
);

-- Encuesta interna de satisfacción por solicitud completada
CREATE TABLE public.encuesta_proveedor (
  id              SERIAL PRIMARY KEY,
  solicitud_id    INT UNIQUE REFERENCES public.solicitud(id) ON DELETE CASCADE,
  proveedor_ruc   VARCHAR(11) REFERENCES public.proveedor(ruc),
  usuario_id      UUID REFERENCES public.usuario(id),
  calidad         SMALLINT CHECK (calidad BETWEEN 1 AND 5),
  tiempo          SMALLINT CHECK (tiempo BETWEEN 1 AND 5),
  precio          SMALLINT CHECK (precio BETWEEN 1 AND 5),
  comunicacion    SMALLINT CHECK (comunicacion BETWEEN 1 AND 5),
  recomendaria    BOOLEAN,
  comentarios     TEXT,
  fecha_creacion  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS encuesta_proveedor
ALTER TABLE public.encuesta_proveedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated puede leer encuestas"
  ON public.encuesta_proveedor FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuario puede insertar su propia encuesta"
  ON public.encuesta_proveedor FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "usuario puede actualizar su propia encuesta"
  ON public.encuesta_proveedor FOR UPDATE TO authenticated USING (auth.uid() = usuario_id);

-- RLS proveedor
ALTER TABLE public.proveedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated puede leer proveedores"
  ON public.proveedor FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated puede insertar proveedores"
  ON public.proveedor FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated puede actualizar proveedores"
  ON public.proveedor FOR UPDATE TO authenticated USING (true);

-- Poblar proveedor desde solicitudes existentes (datos básicos)
INSERT INTO public.proveedor (ruc, razon_social, direccion)
SELECT DISTINCT ON (ruc) ruc, razon_social, direccion
FROM public.solicitud
WHERE ruc IS NOT NULL AND ruc <> ''
ORDER BY ruc, fecha_creacion DESC
ON CONFLICT (ruc) DO NOTHING;
```

---

## 🗂️ Plan por fases

### Fase 1 — BD ✅ pendiente
Aplicar el SQL de arriba con `mcp__supabase__apply_migration`.

### Fase 2 — rucService actualizado
**Archivo:** `src/features/solicitud/services/rucService.ts`

Lógica nueva:
```
buscarProveedor(ruc):
  1. SELECT * FROM proveedor WHERE ruc = $1
  2. Si existe → retornar datos (sin llamar al API)
  3. Si no existe → llamar API externo (/api/ruc?numero=ruc)
             → INSERT INTO proveedor (ruc, razon_social, direccion, estado_sunat)
             → retornar datos
```

### Fase 3 — Formularios de solicitud
**Archivos:** `SolicitudModal.tsx` y `SolicitudNuevaPage.tsx`

Al hacer lookup por RUC, usar el nuevo `buscarProveedor()` en vez de llamar directo al API.
Auto-fill de `razon_social` y `direccion` igual que hoy, pero más rápido cuando ya existe.

### Fase 4 — Sección encuesta en SolicitudDetallePage
**Archivo:** `src/pages/SolicitudDetallePage.tsx`

Condición para mostrar:
```typescript
const canEvaluar = isCompletado && isOwnSolicitud && userRole === ROLES.USUARIO
// también ADMIN puede ver/llenar
```

UI: sección nueva debajo de Factura con:
- 4 criterios en estrellas (1–5) usando componente `StarRating`
- Switch/checkbox para `recomendaria`
- Textarea para `comentarios`
- Si ya existe encuesta → mostrar resultados (read-only) con opción editar

Nuevo service: `src/features/solicitud/services/encuestaService.ts`
```typescript
getEncuestaBySolicitud(solicitud_id)
createEncuesta(payload)
updateEncuesta(id, payload)
```

### Fase 5 — Módulo Proveedores (ADMIN)
**Archivo a crear:** `src/pages/ProveedoresPage.tsx`
**Ruta:** `/proveedores` ya existe en App.tsx (actualmente placeholder)

Vista: lista de proveedores con columnas:
- RUC, Razón social, N° solicitudes, Promedio general (⭐), % Recomendaría, Última solicitud

Click en proveedor → detalle con todas sus solicitudes + encuestas.

Service: `src/features/proveedor/services/proveedorService.ts`

### Fase 6 — Métricas en Dashboard
**Archivos:** `src/features/dashboard/services/dashboardService.ts` + `src/pages/DashboardPage.tsx`

Para **ADMIN** agregar:
- KPI: promedio general de proveedores
- Top 5 proveedores mejor puntuados
- Proveedores con puntuación < 3 (alerta)

Para **APROBADOR** agregar:
- KPI: % proveedores recomendados
- Top proveedores por proyecto

---

## 🏗️ Arquitectura del proyecto (referencia rápida)

```
src/
  features/
    solicitud/
      components/   SolicitudModal, SolicitudArchivos, SolicitudesTable,
                    FirmaModal, OrdenCompraPDF, SolicitudDetalleModal,
                    RechazoModal, ConfirmModal
      services/     solicitudService.ts, rucService.ts
      types/        solicitud.ts  ← Usuario, Solicitud, SolicitudDetalle, etc.
      constants/    bancos.ts
    dashboard/
      services/     dashboardService.ts
    proyecto/
      services/     proyectoService.ts
    proveedor/      ← CREAR esta carpeta en Fase 2+
      services/     proveedorService.ts
      types/        proveedor.ts
  pages/
    SolicitudDetallePage.tsx  ← agregar sección encuesta (Fase 4)
    SolicitudesPage.tsx
    SolicitudNuevaPage.tsx
    DashboardPage.tsx         ← agregar métricas (Fase 6)
    ProveedoresPage.tsx       ← crear (Fase 5)
  store/
    authStore.ts              ← tiene usuarioProfile y userRole
  components/layout/
    Sidebar.tsx
```

### Patrones clave
- **Supabase MCP** (`mcp__supabase__apply_migration`) para DDL, nunca ejecutar DDL con `execute_sql`
- **`enrichSolicitudes()`** en solicitudService — enriquece con datos de `usuario` (nombre, email, cargo)
- **`getSolicitudById()`** llama a `enrichSolicitudes` al final
- **Build check** siempre antes de commit: `npm run build` — strict TS, sin unused vars
- **Commits** solo a rama `jmr`. Nunca a `main` sin indicación explícita del usuario

### Roles
```typescript
ROLES = { ADMIN: 1, EVALUADOR: 8, APROBADOR: 9, VISUALIZADOR: 10, USUARIO: 11 }
```

### Estados de solicitud (flujo)
```
Pendiente → En Revision → Evaluado → Facturación Pendiente → Completado
                       ↘ Rechazado
Cualquier estado activo → Cancelado
```

### Tablas Supabase relevantes
- `solicitud`, `solicitud_detalle`, `solicitud_archivo`
- `solicitud_tipo`, `solicitud_forma_pago`, `estado_soli`
- `proyecto`, `area_usuario`
- `usuario` (1:1 con auth.users, trigger auto-crea fila en signup)
- `usuario_rol`
- `proveedor` ← NUEVA (Fase 1)
- `encuesta_proveedor` ← NUEVA (Fase 1)

### Storage
- Bucket: `solicitud-archivos`
- Paths: `{solicitudId}/{tipoArchivo}/{timestamp}.{ext}`
- Tipos: Contrato, Cotizacion, Sustento (obligatorios), Cuadro Comparativo (opcional),
         Factura, Firma_Usuario, Firma_Aprobador

---

## ✅ Features ya implementadas (no tocar sin motivo)

- Firma digital canvas (FirmaModal) al Enviar y Aprobar
- PDF Orden de Compra (OrdenCompraPDF con @react-pdf/renderer v4)
- Lista solicitudes responsive: tabla en desktop, cards en móvil
- Tabla `usuario` con trigger, enrichSolicitudes usa usuario (no vista_creadores)
- Dashboard por rol (Admin, Aprobador, Evaluador, Visualizador, Usuario)
- Filtro por proyecto en lista solicitudes (todos los roles)
- Banco combobox con lógica BBVA/CCI en formularios
- Documentos obligatorios: Contrato, Cotizacion, Sustento (Cuadro Comparativo opcional)
- Sidebar: tarjeta de usuario (nombre, cargo, rol) + modal confirmación logout
