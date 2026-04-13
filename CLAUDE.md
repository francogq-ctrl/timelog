# Timelog App — Instructions for Claude

## Overview

**Timelog** es una aplicación de seguimiento de tiempo (time tracking) construida con Next.js 16 y Prisma 7. Permite a usuarios registrar horas trabajadas en clientes, proyectos internos, actividades administrativas y entrenamiento. Genera reportes analíticos detallados sobre horas, clientes, cumplimiento de tracking, y se integra con Asana para sincronizar proyectos y tareas.

**Stack:**
- **Framework**: Next.js 16.2 (App Router)
- **Database**: PostgreSQL + Prisma 7.6
- **Auth**: NextAuth.js 5.0 (beta)
- **UI**: React 19, shadcn/ui, Base UI, Tailwind 4
- **Utilities**: date-fns, XLSX (export/import), Asana SDK

---

## Architecture

### Data Model (Prisma Schema)

El modelo de datos está definido en `prisma/schema.prisma`. Modelos principales:

#### **User**
- `id`, `name`, `email` (unique), `role` (MEMBER | MANAGER | ADMIN), `active`
- Relaciones: `accounts`, `sessions`, `timeEntries`
- **Nota**: No tiene `department` — esto es una limitación para reportes de "horas por departamento"

#### **TimeEntry** (Core)
- `id`, `userId`, `date`, `category`, `hours` (múltiplos de 0.25), `notes`
- **Categories**: CLIENT_WORK, INTERNAL, ADMIN, TRAINING
- **Client fields**: `clientName` (string), `asanaProjectId`, `asanaTaskId`, `asanaTaskName`, `workTypeId`
- **Non-client fields**: `activityId`, `description`
- Relaciones: User, WorkType (opcional), Activity (opcional)
- **Índices**: `[userId, date]`, `[date]`, `[asanaProjectId]`

#### **WorkType & Activity**
- Tipos configurables para categorizar trabajo en clientes
- Activity mapea a INTERNAL, ADMIN, TRAINING
- Ambas tienen `active` y `sortOrder` para ordenamiento

#### **AsanaProject & AsanaTask**
- Caché de proyectos/tareas de Asana (`gid` = Asana Global ID)
- Se sincronizan con `/api/asana/sync` (cron diario a las 5:30 PM ET)
- No son fuente de verdad; solo referencias para nombrar tareas

---

## Folder Structure

```
src/
├── app/
│   ├── (app)/          # Rutas protegidas (requieren autenticación)
│   │   ├── admin/      # Panel de administración (MANAGER/ADMIN)
│   │   ├── audit/      # Log de auditoría
│   │   ├── log/        # Página principal de entrada de horas
│   │   ├── reports/    # Dashboard de reportes
│   │   └── layout.tsx  # Layout de app (AppShell)
│   ├── api/
│   │   ├── admin/      # CRUD de usuarios, work-types, activities, asana-projects
│   │   ├── asana/      # Sincronización con Asana (sync, tasks)
│   │   ├── audit/      # Logs de auditoría
│   │   ├── auth/       # Rutas NextAuth
│   │   ├── entries/    # CRUD de time entries
│   │   ├── reports/    # Analytics: GET /api/reports (con filtros)
│   │   └── health/     # Health check
│   ├── login/          # Página de login
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Redirect a /log o login
├── components/
│   ├── app-shell.tsx   # Layout principal (sidebar, header)
│   ├── entry-card.tsx  # Card de entrada de tiempo
│   ├── entry-form.tsx  # Formulario para crear/editar entradas
│   ├── date-navigator.tsx
│   └── ui/             # shadcn/ui components
├── lib/
│   ├── db.ts           # Singleton de Prisma con pool de conexiones
│   ├── auth.ts         # Configuración NextAuth (session, usuario)
│   ├── auth.config.ts  # Providers y callbacks
│   ├── auth-types.ts   # Tipos para sesión/usuario
│   ├── asana.ts        # Cliente de Asana API
│   ├── asana-sync.ts   # Lógica de sincronización
│   ├── actions.ts      # Server actions
│   └── utils.ts        # Utilidades (cn, etc.)
├── middleware.ts       # NextAuth middleware
└── generated/
    └── prisma/         # Tipos generados (NO editar)
```

---

## Key Workflows

### 1. **Logging Time Entries** (`/log`)

**Componentes clave:**
- `src/app/(app)/log/page.tsx` — UI de entrada
- `src/components/entry-form.tsx` — Formulario reutilizable
- `src/app/api/entries/route.ts` — POST/GET para entradas

**Flujo:**
1. Usuario selecciona fecha
2. Para CLIENT_WORK: elige cliente (clientName), proyecto (asanaProjectId), tarea (asanaTaskId), tipo de trabajo (workTypeId)
3. Para INTERNAL/ADMIN/TRAINING: elige actividad (activityId), descripción
4. Ingresa horas (validado en 0.25 increments)
5. POST a `/api/entries` → crea TimeEntry
6. GET `/api/entries?date=2026-04-13` → lista entradas del día

**Validaciones:**
- Horas deben ser > 0 y múltiplo de 0.25
- Se requiere `clientName` para CLIENT_WORK
- Se requiere `activityId` para INTERNAL/ADMIN/TRAINING
- Máximo de horas por día: no validado en backend (confiar en UI)

---

### 2. **Reports & Analytics** (`/reports`)

**Componentes clave:**
- `src/app/(app)/reports/page.tsx` — UI de reportes
- `src/app/api/reports/route.ts` — Agregación de datos (MANAGER+ required)

**Datos disponibles:**
- Overview: totalHours, clientHours, clientPercent, activeUsers, totalUsers, totalClients, avgDaily
- Compliance: por-persona (hours, entries, daysActive, byCategory breakdown, billablePercent)
- By Client: horas/personas por cliente + desglose de tipos
- By Deliverable: cliente + tarea (horas, personas, tipo top)
- Category Totals: desglose de categorías
- Work Type Totals: horas por tipo de trabajo
- Missing Users: users sin entradas en el período

**Filtros soportados:**
- Date range (from/to)
- userId (filtra a una persona)
- client (filtra a un cliente)

**Funcionalidades:**
- Export a XLSX (por-persona sheets)
- Import de XLSX (validación y creación batch)
- Período presets: this-week, last-week, this-month, last-month

**Nota**: No hay sección "Hours by Department" — no existe campo `department` en User.

---

### 3. **Asana Integration**

**Componentes:**
- `src/lib/asana.ts` — Cliente HTTP wrapper
- `src/lib/asana-sync.ts` — Lógica de sync
- `src/app/api/asana/sync/route.ts` — Endpoint manual (cron diario 5:30 PM ET / 21:30 UTC)
- `src/app/api/asana/tasks/route.ts` — GET tareas de un proyecto

**Flujo:**
1. Cron diario a las 5:30 PM ET / manual trigger → GET todos los proyectos de Asana (filtrados)
2. Para cada proyecto: GET todas las tareas
3. Upsert AsanaProject y AsanaTask en DB (caché)
4. Usuarios seleccionan proyecto/tarea al logging time → se llena `asanaProjectId`, `asanaTaskId`, `asanaTaskName`

**IMPORTANTE**: Asana es solo referencia. Si alguien cambia el nombre de una tarea en Asana, el campo `asanaTaskName` en TimeEntry no se actualiza automáticamente — es un snapshot. Sync está programado para correr automáticamente cada día a las 5:30 PM ET (21:30 UTC).

---

## Code Conventions

### Authentication & Authorization

**Pattern**: Siempre chequear `session` en API routes:

```typescript
const session = await auth();
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const isAdmin = session.user.role === "ADMIN";
const isManager = ["MANAGER", "ADMIN"].includes(session.user.role);
```

**Roles**:
- MEMBER: puede ver sus propias entradas
- MANAGER: puede ver reportes, gestionar usuarios/actividades
- ADMIN: acceso total

### Database Access

**Pattern**: Importar singleton `prisma` desde `@/lib/db`:

```typescript
import { prisma } from "@/lib/db";

const entries = await prisma.timeEntry.findMany({ where: { userId }, include: { workType: true } });
```

**Buenas prácticas:**
- Siempre usar `include` o `select` para evitar overfetching
- Indexes están en `[userId, date]` y `[asanaProjectId]` — diseñar queries pensando en eso
- No hacer N+1 queries; usar `include` en lugar de fetches separadas

### API Response Format

**Success**:
```typescript
return NextResponse.json(data);
```

**Error**:
```typescript
return NextResponse.json({ error: "Message" }, { status: 400 });
```

**No** retornar status 500 a menos que sea un error inesperado. Preferir 400/401/403/404.

### Client Components vs Server Components

- **Pages** (`/app/(app)/*/page.tsx`): "use client" (interactividad, estado local)
- **Layouts** (`/app/(app)/layout.tsx`): Server (para auth checks)
- **Components** (`/components/*.tsx`): "use client" si tienen `useState`, event listeners, etc.

---

## How to Add Features

### Adding a New Time Entry Category

1. **Schema** (`prisma/schema.prisma`):
   ```prisma
   enum Category {
     CLIENT_WORK
     INTERNAL
     ADMIN
     TRAINING
     NEW_CATEGORY  // Añadir aquí
   }
   ```

2. **Migration**: `npm run db:migrate`

3. **Backend** (`src/app/api/entries/route.ts`):
   - Agregar validaciones para NEW_CATEGORY (¿requiere clientName? ¿activityId?)

4. **Frontend** (`src/components/entry-form.tsx`):
   - Añadir opción en selector de categoría
   - Mostrar/ocultar campos condicionales

5. **Reports** (`src/app/api/reports/route.ts`):
   - Actualizar `compliance.byCategory` para incluir NEW_CATEGORY
   - Actualizar `categoryTotals`

---

### Adding a New Report Section

1. **API** (`src/app/api/reports/route.ts`):
   - Agregar nueva agregación (ej: `byDepartment`)
   - Retornar en JSON response

2. **Frontend** (`src/app/(app)/reports/page.tsx`):
   - Importar Chart componente (Recharts, etc. si no existe)
   - Renderizar nueva sección con datos de `data.byDepartment`
   - Aplicar filtros (userId, clientName)

3. **Ejemplo**: Para "Hours by Department", primero hay que:
   - Agregar campo `department` a User en schema
   - Actualizar admin UI para setter departamento
   - Agrupar por `user.department` en reports API

---

### Adding an Admin Entity

Ejemplo: agregar nueva entidad "Teams"

1. **Schema** (`prisma/schema.prisma`):
   ```prisma
   model Team {
     id String @id @default(cuid())
     name String @unique
     active Boolean @default(true)
     members User[]
   }

   model User {
     ...
     teamId String?
     team Team? @relation(fields: [teamId], references: [id])
   }
   ```

2. **Migration**: `npm run db:migrate`

3. **API CRUD** (`src/app/api/admin/teams/route.ts`):
   - GET: listar teams (MANAGER+)
   - POST: crear team (ADMIN)
   - PUT/DELETE: update/delete (ADMIN)

4. **Admin Page** (`src/app/(app)/admin/page.tsx`):
   - Agregar sección/tab para Teams
   - Llamar a endpoints CRUD

---

## Restrictions & Gotchas

### 1. **Time Entry Hours Validation**
- Horas **DEBEN** ser múltiplos de 0.25 (0.25, 0.5, 0.75, 1.0, 1.25, etc.)
- Backend valida: `hours % 0.25 !== 0`
- Si añades feature que bypassa esto, reportes se quiebran

### 2. **Asana Integration is One-Way & Async**
- Sync corre diario a las 5:30 PM ET (cron automático)
- Los cambios en Asana no se reflejan inmediatamente
- No hay webhook de Asana → si cambias nombre de tarea en Asana, TimeEntry tiene nombre old
- Para refetch manual: llamar `GET /api/asana/sync` (como admin)

### 3. **No Department Field on User**
- Los reportes **NO pueden agrupar por departamento** sin agregar campo al schema
- El screenshot de referencia muestra "Hours by Department" pero no es posible sin cambio de schema

### 4. **Reports API requires MANAGER+ role**
- No hay endpoint de reportes para MEMBER
- Si necesitas reportes filtrados por usuario, los managers deben verlos

### 5. **Category Workflow is Hardcoded**
- CLIENT_WORK requiere: `clientName`, `workTypeId` (preferible), puede tener `asanaProjectId`/`asanaTaskId`
- INTERNAL/ADMIN/TRAINING requieren: `activityId` (FK, debe existir)
- No hay validación a nivel DB (constraints), confiar en lógica de aplicación

### 6. **Next.js 16 Breaking Changes**
Ver `AGENTS.md` — Next.js 16 tiene cambios significativos. Antes de escribir código:
- Leer docs en `node_modules/next/dist/docs/`
- Chequear deprecation notices
- Algunos patterns que funcionaban en Next.js 14 pueden no funcionar

---

## Development Workflow

### Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Setup .env.local
# Requiere: DATABASE_URL, ASANA_TOKEN, NEXTAUTH_SECRET, GITHUB_ID/GITHUB_SECRET

# 3. Setup database
npm run db:push        # Push schema to DB
npm run db:seed        # Seed initial data

# 4. Start dev server
npm run dev
```

### Common Commands

```bash
npm run dev            # Start dev server on :3000
npm run build          # Build for production (runs prisma generate first)
npm run db:migrate     # Interactive migration (create new migration file)
npm run db:push        # Push schema changes (no history)
npm run db:generate    # Regenerate Prisma types (auto, but can force)
npm run lint           # Run ESLint
```

### Debugging

- **Prisma Studio** (inspect DB): `npx prisma studio`
- **NextAuth Debug**: set `DEBUG=next-auth:*` en .env.local
- **Logs**: app logs in `npm run dev` terminal; DB logs in Prisma if configured

### Testing

- No hay test suite configurado actualmente
- Para testar manualmente: usar Postman/Insomnia para API, o navegar en browser

---

## Git & Deployment

### Branch Strategy

- **main**: production-ready (deployed)
- **feature branches**: nombrar `feature/description` (ej: `feature/add-billable-field`)

### Pre-commit

- ESLint check recomendado (no es hook obligatorio actualmente)
- Si modificas schema: asegurar `prisma generate` se ejecuta

### Deployment (Vercel assumption)

```bash
# Auto-deploy en push a main
# Env vars en Vercel: DATABASE_URL, ASANA_TOKEN, NEXTAUTH_SECRET, GITHUB_*
# DB migrations: `npm run db:push` ejecuta en build (check `package.json` build script)
```

---

## Troubleshooting

### 500 Error on Reports API

**Causas comunes:**
- Usuario no tiene rol MANAGER+ → chequear `session.user.role`
- `from`/`to` query params faltando → requieren formato ISO date
- Query de Prisma falla (ej: userId no existe) → revisar logs

**Debug:**
```bash
curl "http://localhost:3000/api/reports?from=2026-04-01&to=2026-04-13" \
  -H "Authorization: Bearer YOUR_SESSION"
```

### Asana Tasks Not Showing Up

- Cron de sync (5:30 PM ET) no corrió aún → esperar o trigger manual en `/api/asana/sync`
- ASANA_TOKEN no válido → revisar permisos en Asana
- Proyecto no está en `AsanaProject` caché → sync again

### Can't Create Time Entry

- Hours no es múltiplo de 0.25 → redondear
- CLIENT_WORK sin `clientName` → necesita nombre de cliente
- INTERNAL sin `activityId` → necesita actividad válida
- Usuario no tiene `MEMBER+` role → chequear BD

---

## References

- **Prisma Docs**: `prisma.io/docs`
- **Next.js 16 Docs**: Inside `node_modules/next/dist/docs/` (local — mirar cambios breaking)
- **NextAuth.js 5**: `authjs.dev` (beta, some API may differ from v4)
- **Asana API**: `developer.asana.com/docs`
- **Tailwind 4**: `tailwindcss.com` (new PostCSS based)

---

## Contact & Questions

Si encontras issues o tienes preguntas sobre arquitectura/patterns:
1. Revisar este documento
2. Chequear código en `src/` para ver patterns existentes
3. Si es un bug: describir steps to reproduce y logs

Good luck! 🚀
