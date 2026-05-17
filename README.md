# AVENIR — Sistema de Gestión de Solicitudes

Plataforma web para la gestión y aprobación de solicitudes de compra/servicio, con flujo de trabajo por roles, seguimiento de estados y panel de indicadores.

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
    │ marcarEvaluado (EVALUADOR/ADMIN)
    ▼
Evaluado ──────── rechazarSolicitud ─────────► Rechazado
    │
    │ aprobarSolicitud (APROBADOR/ADMIN)
    ▼
Facturación Pendiente
    │
    │ subirFactura (USUARIO owner/ADMIN)
    ▼
Completado
```

## Roles y permisos

| Rol | ID | Dashboard | Solicitudes visibles | Acciones permitidas |
|---|---|---|---|---|
| Admin | 1 | Completo (gráficos) | Todas | Todas |
| Aprobador | 9 | Completo (gráficos) | Evaluado / Rechazado / Facturación Pendiente / Completado | Aprobar, Rechazar |
| Evaluador | 8 | Simplificado | En Revision | Marcar evaluado, Devolver |
| Visualizador | 10 | Simplificado | Completado | Solo lectura |
| Usuario | 11 | Simplificado | Propias | Crear, Editar (Pendiente), Enviar, Cancelar, Subir factura |

## Estructura del proyecto

```
src/
├── api/
│   └── supabase.ts               # Cliente Supabase
├── components/
│   └── layout/                   # MainLayout, Sidebar, Topbar, ProtectedRoute
├── features/
│   ├── dashboard/
│   │   └── services/             # getDashboardData()
│   └── solicitud/
│       ├── components/           # SolicitudesTable, SolicitudArchivos,
│       │                         # RechazoModal, ConfirmModal, ...
│       ├── hooks/                # useSolicitudes
│       ├── services/             # solicitudService (CRUD + flujo)
│       └── types/                # Solicitud, ROLES, SolicitudFiltros, ...
├── pages/                        # SolicitudesPage, SolicitudDetallePage,
│                                 # SolicitudNuevaPage, DashboardPage, ...
└── store/
    └── authStore.ts              # Zustand: usuario autenticado + rol
```

## Tablas principales en Supabase

| Tabla | Descripción |
|---|---|
| `solicitud` | Solicitudes de compra / servicio |
| `solicitud_detalle` | Ítems de cada solicitud |
| `solicitud_archivo` | Archivos PDF adjuntos (bucket `solicitud-archivos`) |
| `estado_soli` | Catálogo de estados del flujo |
| `solicitud_tipo` | Tipos de solicitud |
| `solicitud_forma_pago` | Formas de pago seleccionables |
| `proyecto` | Proyectos asociables a solicitudes |
| `usuario_rol` | Rol asignado a cada usuario |
| `area_usuario` | Área a la que pertenece cada usuario |
| `vista_creadores` | Vista pública sobre `auth.users` para exponer emails |

## Documentos por solicitud

Los archivos se almacenan en el bucket de Supabase Storage `solicitud-archivos` con la ruta `{solicitudId}/{tipoArchivo}/{timestamp}.{ext}`.

**Durante la creación (paso 3 del wizard):**
1. Contrato
2. Cotización
3. Cuadro Comparativo
4. Sustento

**Al completar el proceso (estado Facturación Pendiente):**

5. Factura — el USUARIO adjunta el PDF de factura junto con el número de factura; esto mueve la solicitud a Completado.
