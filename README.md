# AVENIR — Sistema de Gestión Financiera

Plataforma web para la gestión y aprobación de solicitudes de pago (OC y RxH), rendición de gastos (A Rendir), reembolsos, con control de presupuesto por proyecto/partida, gasto por área y reportes consolidados.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript |
| Build | Vite |
| Estilos | Tailwind CSS v4 |
| Routing | React Router v7 |
| Estado global | Zustand |
| Backend / Auth / Storage | Supabase |
| Gráficos | Recharts |
| Exportación | exceljs |
| Notificaciones | react-hot-toast |
| PDF | @react-pdf/renderer |

## Requisitos previos

- Node.js 18+
- Cuenta y proyecto en [Supabase](https://supabase.com)

## Configuración

1. Clona el repositorio e instala dependencias:

```bash
git clone <repo-url>
cd AVENIR
npm install
```

2. Crea el archivo `.env.local` en la raíz con tus credenciales:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
DECOLECTA_API_KEY=tu-api-key   # Solo para el proxy de consulta RUC en desarrollo
```

3. Inicia el servidor de desarrollo:

```bash
npm run dev
```

## Comandos

```bash
npm run dev       # Servidor de desarrollo con HMR
npm run build     # Verificación TypeScript + build de producción
npm run preview   # Vista previa del build de producción
npm run lint      # ESLint
```

## Flujo de aprobación

Las solicitudes siguen el siguiente flujo de estados:

```
Pendiente ──────────────────────────────────── Cancelado
    │
    │ enviarARevision (USUARIO/ADMIN)
    ▼
En Revision ──── devolverSolicitud ──────────► Pendiente
    │
    │ marcarEvaluado + Plan Contable (EVALUADOR/ADMIN)
    ▼
Evaluado ──────── rechazarSolicitud ─────────► Rechazado
    │
    │ aprobarSolicitud (APROBADOR/ADMIN)
    ▼
 Aprobado  ◄── estado final positivo
 (encuesta de proveedor disponible al llegar aquí)
```

> Los estados "Facturación Pendiente" y "Completado" fueron eliminados. **Aprobado** es el estado terminal positivo.

## Roles y permisos

| Rol | ID | Dashboard | Acciones principales |
|---|---|---|---|
| Admin | 1 | KPIs globales + gráficas + métricas proveedores | Acceso total, gestión de partidas, ve presupuesto y gasto por área |
| Evaluador | 8 | Cola de revisión + promedio espera | Evalúa solicitudes, asigna plan contable, detracción y retención |
| Aprobador | 9 | Cola de aprobación + totales comprometidos | Aprueba/rechaza, ve presupuesto consumido y gasto por área |
| Visualizador | 10 | Solicitudes aprobadas + montos | Solo lectura, acceso a reportes |
| Usuario | 11 | Mis solicitudes por estado + monto aprobado | Crea solicitudes, A Rendir y reembolsos |

### Módulos por rol

| Módulo | Admin | Evaluador | Aprobador | Visualizador | Usuario |
|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Solicitudes | ✅ | ✅ | ✅ | ✅ | ✅ |
| A Rendir | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reembolso | ✅ | ✅ | ✅ | ✅ | ✅ |
| Proveedores | ✅ | — | — | — | ✅ |
| Proyectos | ✅ | — | — | — | — |
| Áreas | ✅ | — | ✅ | — | — |
| Reportes | ✅ | — | — | ✅ | — |

## Wizard de nueva solicitud (4 pasos)

1. **Datos generales** — proveedor, datos bancarios, proyecto, forma de pago, porcentajes de contrato, fechas y condiciones.
2. **Detalles** — ítems de la solicitud (descripción, cantidad, valor unitario). Muestra subtotal, IGV (18%) y total.
3. **Documentos** — subida de archivos obligatorios (Contrato, Cotización, Sustento) y opcional (Cuadro Comparativo). No permite avanzar sin los 3 obligatorios.
4. **Factura** *(opcional)* — Factura XML y/o Factura PDF, número de factura, motivo, fecha de emisión y fecha de vencimiento. Se puede omitir y completar desde el detalle de la solicitud.

## Módulo A Rendir

Rendición de gastos con adelantos. El empleado solicita un adelanto, ejecuta gastos registrando comprobantes, y el aprobador autoriza.

- **Rutas:** `/arendir`, `/arendir/nueva`, `/arendir/:id`
- **Wizard:** 2 pasos (datos generales + detalle de gastos)
- **Flujo:** Pendiente → En Revision → Evaluado → Autorizado / Rechazado / Devuelto
- **Moneda:** PEN o USD seleccionable
- **PDF:** Landscape A4 con firma beneficiario + aprobador
- **Excel BBVA:** Exportación masiva para pagos (VISUALIZADOR + ADMIN)

## Módulo Reembolso

Reembolso de gastos ya realizados. Estructura similar a A Rendir pero sin adelanto.

- **Rutas:** `/reembolso`, `/reembolso/nueva`, `/reembolso/:id`
- **Wizard:** 2 pasos
- **Flujo:** Idéntico a A Rendir

## Proyectos y Partidas

Un proyecto puede subdividirse en partidas (ej: COPISAC → HITO, JOMY, OP-ADM). Cada partida tiene presupuesto propio en S/ y $.

- Solo ADMIN crea/edita partidas desde `/proyectos`
- Seleccionar partida es obligatorio cuando el proyecto tiene partidas
- `proyecto_partida_id` es nullable FK en solicitud, A Rendir y Reembolso

## Control de Presupuesto

Visible solo para **ADMIN** y **APROBADOR**:

- **Tabla de proyectos:** columna "Consumido" con barra de progreso (verde < 80%, amarillo 80-100%, rojo > 100%)
- **Panel de partidas:** consumo vs presupuesto por moneda en cada partida
- **Detalle de solicitud:** card "Presupuesto" con barra, consumido, saldo disponible
- **Wizards:** alerta de saldo al seleccionar partida

Fuentes: OC aprobadas (con IGV), RxH aprobadas, A Rendir autorizados, Reembolso autorizados.

## Gasto por Área

Página `/areas` — visible para ADMIN y APROBADOR. Muestra el gasto consolidado por área (Marketing, Legal, etc.) con desglose por módulo (OC, RxH, A Rendir, Reembolso) en PEN y USD.

## Detracción SUNAT

Solo para OC. El monto se calcula y almacena siempre en soles, redondeado sin decimales. Para solicitudes en USD, el EVALUADOR ingresa el tipo de cambio venta (pre-llenado desde API SUNAT):

```
monto_detraccion = Math.round(totalUSD × TC_venta × porcentaje / 100)
```

## Reportes

Página `/reportes` — ADMIN y VISUALIZADOR. Consolida OC, RxH, A Rendir y Reembolso aprobados/autorizados en un Excel con 21 columnas, filtrado por fecha y proyecto. Incluye partida, detracciones y retenciones.

## Documentos por solicitud

Los archivos se almacenan en el bucket de Supabase Storage `solicitud-archivos` con la ruta `{solicitudId}/{tipoArchivo}/{timestamp}.{ext}`.

| Tipo | Formato | Paso | Obligatorio |
|---|---|---|---|
| Contrato | PDF | Step 3 | ✅ |
| Cotizacion | PDF | Step 3 | ✅ |
| Sustento | PDF | Step 3 | ✅ |
| Cuadro Comparativo | PDF | Step 3 | — |
| Factura XML | XML | Step 4 | — |
| Factura PDF | PDF | Step 4 | — |

## Módulo de Proveedores

Accesible en `/proveedores` para ADMIN y USUARIO. Muestra todos los proveedores que han tenido solicitudes aprobadas, con métricas agregadas de encuestas internas:

- Promedio general (escala 1–5)
- Promedios por criterio: Calidad, Tiempo de entrega, Precio, Comunicación
- Porcentaje que recomendaría al proveedor
- Total de encuestas y solicitudes

La **encuesta de satisfacción** se habilita en el detalle de la solicitud cuando el estado es **Aprobado** (solo para el creador o ADMIN). Evalúa 4 criterios en escala 1–5 y pregunta si recomendaría al proveedor.

## Estructura del proyecto

```
src/
├── api/                         # Cliente Supabase
├── assets/                      # Logo y recursos estáticos
├── components/
│   ├── layout/                  # MainLayout, Sidebar, Topbar, ProtectedRoute
│   └── ui/                      # DataTable compartido
├── features/
│   ├── area/services/           # Gasto por área (areaConsumoService)
│   ├── arendir/                 # Módulo A Rendir (types, services, hooks, components)
│   ├── auth/                    # Autenticación
│   ├── dashboard/services/      # Dashboard por rol
│   ├── proveedor/               # Proveedores y encuestas
│   ├── proyecto/                # Proyectos, partidas y consumo de presupuesto
│   ├── reembolso/               # Módulo Reembolso (types, services, hooks, components)
│   ├── reportes/services/       # Reportes y exportación Excel
│   ├── solicitud/               # Solicitudes OC/RxH (types, services, hooks, components, constants)
│   └── usuario/services/        # Perfil de usuario
├── pages/                       # Páginas de rutas
└── store/                       # Zustand (authStore)
```

## Tablas principales en Supabase

| Tabla | Descripción |
|---|---|
| `solicitud` | Solicitudes de compra / servicio (OC y RxH) |
| `solicitud_detalle` | Ítems de cada solicitud |
| `solicitud_archivo` | Archivos adjuntos (bucket `solicitud-archivos`) |
| `solicitud_arendir` | Cabecera de rendición de gastos |
| `solicitud_arendir_detalle` | Líneas de gasto de A Rendir |
| `solicitud_reembolso` | Cabecera de reembolso |
| `solicitud_reembolso_detalle` | Líneas de gasto de reembolso |
| `estado_soli` | Catálogo de estados del flujo |
| `solicitud_tipo` | Tipos de solicitud |
| `solicitud_forma_pago` | Formas de pago seleccionables |
| `proyecto` | Proyectos asociables a solicitudes |
| `proyecto_partida` | Partidas por proyecto (presupuesto PEN/USD) |
| `detraccion` | Conceptos de detracción SUNAT (6 registros) |
| `usuario` | Perfil extendido 1:1 con auth.users |
| `usuario_rol` | Rol asignado a cada usuario |
| `area_usuario` | Área a la que pertenece cada usuario |
| `proveedor` | Registro de proveedores (indexados por RUC) |
| `encuesta_proveedor` | Encuestas de satisfacción por solicitud |
| `plan_contable_brash` | Catálogo de partidas contables (usado por EVALUADOR) |

### Campos de factura en `solicitud`

| Campo | Tipo | Descripción |
|---|---|---|
| `numero_factura` | TEXT | Número de factura (ej: F001-00123) |
| `motivo_factura` | TEXT | Concepto o motivo de la factura |
| `fecha_emision_factura` | DATE | Fecha de emisión de la factura |
| `fecha_vencimiento_factura` | DATE | Fecha de vencimiento de la factura |

### Campos de plan contable en `solicitud`

| Campo | Tipo | Descripción |
|---|---|---|
| `plan_contable_id` | INTEGER | FK a `plan_contable_brash.id` — asignado al marcar Evaluado |
| `usuario_evaluador` | UUID (TEXT) | ID del evaluador que marcó la solicitud como Evaluado |

### `plan_contable_brash` — catálogo contable

| Campo | Descripción |
|---|---|
| `tipo_gasto_costo` | Nombre del tipo de gasto/costo (mostrado en el combobox) |
| `codigo_starsoft` | Código interno Starsoft |
| `cuenta_contable_2020_starsoft` | Número de cuenta contable 2020 |
| `nombre_cuenta_contable` | Nombre de la cuenta contable |
| `partida_presupuestal` | Partida presupuestal general |
| `partida_presupuesta_n1` | Partida presupuestal nivel 1 |
| `partida_presupuesta_n2` | Partida presupuestal nivel 2 |
