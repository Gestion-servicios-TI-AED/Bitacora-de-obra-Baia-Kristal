# Empresa de Supervisión por Frente - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover la relación `empresaInterventoriaId` del modelo `Proyecto` al modelo `Torre`, y agregar además un campo `interventorResponsableId` en `Torre` para asignar la persona responsable de cada frente (que debe pertenecer al mismo proyecto y a la misma empresa).

**Architecture:** Se elimina el FK `empresaInterventoriaId` de `Proyecto` y se añaden `empresaInterventoriaId` e `interventorResponsableId` a `Torre`. El servidor actualiza las rutas de torres (GET/POST/PUT) para manejar los nuevos campos y la ruta de proyectos para dejar de manejar el campo eliminado. El frontend actualiza `TorresTab` con dos selects nuevos, y elimina el select de empresa del formulario de proyecto y de la sección inferior de `InterventorasTab`.

**Tech Stack:** Prisma (PostgreSQL), Express, React 19, TanStack Query, TypeScript, Tailwind CSS v4.

---

## Files Modified

| File | Change |
|---|---|
| `server/prisma/schema.prisma` | Quitar relación de `Proyecto`, agregar dos campos a `Torre`, actualizar back-relations |
| `server/src/routes/torres.ts` | GET incluye empresa/interventor; POST/PUT aceptan nuevos campos |
| `server/src/routes/proyectos.ts` | Eliminar manejo de `empresaInterventoriaId` en GET/PUT |
| `server/src/controllers/empresasInterventoriaController.ts` | Agregar validación en delete para torres asociadas |
| `client/src/pages/ConfiguracionPage.tsx` | `TorresTab` + `ProyectoEditForm` + `InterventorasTab` |

---

## Task 1: Actualizar el schema de Prisma

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Editar schema.prisma**

Reemplazar el bloque `Proyecto` quitando las dos líneas de empresa:
```prisma
model Proyecto {
  id        String   @id @default(uuid())
  nombre    String
  abreviatura String?
  direccion String?
  ciudad    String?
  logoUrl   String?
  activo    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt
  empresaContratanteId   String?

  torres               Torre[]
  contratistas         Contratista[]
  usuarioProyectos     UsuarioProyecto[]
  bitacoras            Bitacora[]
  empresaContratante   EmpresaContratante?   @relation(fields: [empresaContratanteId], references: [id])
}
```

Reemplazar el bloque `Torre` añadiendo los dos nuevos campos y sus relaciones:
```prisma
model Torre {
  id                       String   @id @default(uuid())
  proyectoId               String
  nombre                   String
  abreviatura              String?
  etapaConstructiva        String?
  frente                   String?
  folioActual              Int      @default(0)
  activo                   Boolean  @default(true)
  createdAt                DateTime @default(now())
  empresaInterventoriaId   String?
  interventorResponsableId String?

  proyecto               Proyecto              @relation(fields: [proyectoId], references: [id])
  usuarioTorres          UsuarioTorre[]
  bitacoras              Bitacora[]
  folioControles         FolioControl[]
  empresaInterventoria   EmpresaInterventoria? @relation("TorreInterventoria", fields: [empresaInterventoriaId], references: [id])
  interventorResponsable Usuario?              @relation("TorreInterventorResponsable", fields: [interventorResponsableId], references: [id])
}
```

Agregar back-relation en `Usuario`:
```prisma
  torreInterventorAsignado Torre[] @relation("TorreInterventorResponsable")
```
(añadir justo después de la línea `bitacorasCreadas`)

Reemplazar el bloque `EmpresaInterventoria`:
```prisma
model EmpresaInterventoria {
  id        String    @id @default(uuid())
  nombre    String
  nit       String?
  tipo      String    @default("interventoria") // interventoria | supervision_tecnica
  activo    Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @default(now()) @updatedAt

  usuarios  Usuario[]
  torres    Torre[]   @relation("TorreInterventoria")
}
```

- [ ] **Step 2: Aplicar migración y regenerar cliente**

```bash
cd server
npx prisma db push
npx prisma generate
```

Expected: `Your database is now in sync with your Prisma schema.` y `Generated Prisma Client`.

- [ ] **Step 3: Verificar tipos**

```bash
cd server && ./node_modules/.bin/tsc --noEmit
```

Expected: sin errores (puede haber errores en rutas todavía — se resuelven en Task 2).

---

## Task 2: Actualizar rutas del servidor

**Files:**
- Modify: `server/src/routes/torres.ts`
- Modify: `server/src/routes/proyectos.ts`
- Modify: `server/src/controllers/empresasInterventoriaController.ts`

- [ ] **Step 1: Actualizar `torres.ts` — GET incluye empresa e interventor**

Reemplazar los dos GETs para incluir las nuevas relaciones:

```typescript
// GET /api/torres
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { proyecto_id } = req.query;
        const where: any = {};
        if (proyecto_id) where.proyectoId = proyecto_id as string;

        const torres = await prisma.torre.findMany({
            where,
            include: {
                proyecto: true,
                empresaInterventoria: true,
                interventorResponsable: {
                    select: { id: true, nombre: true, apellido: true, cargo: true, email: true },
                },
            },
            orderBy: { nombre: 'asc' },
        });
        res.json(torres);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener torres' });
    }
});

// GET /api/torres/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const torre = await prisma.torre.findUnique({
            where: { id: req.params.id as string },
            include: {
                proyecto: true,
                empresaInterventoria: true,
                interventorResponsable: {
                    select: { id: true, nombre: true, apellido: true, cargo: true, email: true },
                },
            },
        });
        if (!torre) { res.status(404).json({ error: 'Torre no encontrada' }); return; }
        res.json(torre);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener torre' });
    }
});
```

- [ ] **Step 2: Actualizar `torres.ts` — POST y PUT aceptan nuevos campos**

Reemplazar POST:
```typescript
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { nombre, proyectoId, abreviatura, etapaConstructiva, frente, folioActual, empresaInterventoriaId, interventorResponsableId } = req.body;
        const torre = await prisma.torre.create({
            data: {
                nombre, proyectoId,
                abreviatura: abreviatura || null,
                etapaConstructiva: etapaConstructiva || null,
                frente: frente || null,
                folioActual: folioActual !== undefined ? Number(folioActual) : 0,
                empresaInterventoriaId: empresaInterventoriaId || null,
                interventorResponsableId: interventorResponsableId || null,
            },
        });
        res.status(201).json(torre);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear torre' });
    }
});
```

Reemplazar PUT:
```typescript
router.put('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { nombre, activo, abreviatura, etapaConstructiva, frente, folioActual, empresaInterventoriaId, interventorResponsableId } = req.body;
        const data: any = {};
        if (nombre !== undefined) data.nombre = nombre;
        if (abreviatura !== undefined) data.abreviatura = abreviatura || null;
        if (etapaConstructiva !== undefined) data.etapaConstructiva = etapaConstructiva || null;
        if (frente !== undefined) data.frente = frente || null;
        if (activo !== undefined) data.activo = activo;
        if (folioActual !== undefined) data.folioActual = Number(folioActual);
        if (empresaInterventoriaId !== undefined) data.empresaInterventoriaId = empresaInterventoriaId || null;
        if (interventorResponsableId !== undefined) data.interventorResponsableId = interventorResponsableId || null;
        const torre = await prisma.torre.update({ where: { id: req.params.id as string }, data });
        res.json(torre);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar torre' });
    }
});
```

- [ ] **Step 3: Actualizar `proyectos.ts` — quitar empresa interventoría**

En GET `/` e `/:id`, quitar `empresaInterventoria: true` de los `include`.

En GET `/`, reemplazar el `findMany`:
```typescript
const proyectos = await prisma.proyecto.findMany({
    include: {
        torres: true,
        _count: { select: { torres: true, contratistas: true } },
        empresaContratante: true,
    },
    orderBy: { nombre: 'asc' },
});
```

En GET `/:id`, reemplazar el `findUnique`:
```typescript
const proyecto = await prisma.proyecto.findUnique({
    where: { id: req.params.id as string },
    include: { torres: true, contratistas: true, empresaContratante: true },
});
```

En PUT `/:id`, eliminar el bloque completo que maneja `empresaInterventoriaId` (líneas 82–88 del archivo original), y quitar `empresaInterventoriaId` del destructuring de `req.body`.

También quitar los `as any` en los `findMany`/`findUnique`/`update` de proyectos ya que ya no hay campos que Prisma desconozca.

- [ ] **Step 4: Actualizar `empresasInterventoriaController.ts` — validar torres en delete**

Reemplazar la función `deleteEmpresaInterventoria`:
```typescript
export const deleteEmpresaInterventoria = async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;

    const usersCount = await prisma.usuario.count({ where: { empresaInterventoriaId: id } });
    if (usersCount > 0) {
      res.status(400).json({ message: 'No se puede eliminar la empresa porque tiene usuarios asociados. Inactívela en su lugar.' });
      return;
    }

    const torresCount = await prisma.torre.count({ where: { empresaInterventoriaId: id } });
    if (torresCount > 0) {
      res.status(400).json({ message: 'No se puede eliminar la empresa porque tiene frentes asociados. Inactívela en su lugar.' });
      return;
    }

    await prisma.empresaInterventoria.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting empresa interventoria:', error);
    res.status(500).json({ message: 'Error al eliminar la empresa de interventoría' });
  }
};
```

- [ ] **Step 5: Verificar tipos del servidor**

```bash
cd server && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errores.

---

## Task 3: Actualizar el frontend

**Files:**
- Modify: `client/src/pages/ConfiguracionPage.tsx`

- [ ] **Step 1: Actualizar `TorresTab` — agregar estado para nuevos campos**

En la función `TorresTab`, añadir dos estados nuevos junto a los existentes:
```typescript
const [empresaInterventoriaId, setEmpresaInterventoriaId] = useState('');
const [interventorResponsableId, setInterventorResponsableId] = useState('');
```

Añadir query para interventoras y usuarios del proyecto:
```typescript
const { data: interventoras = [] } = useQuery({
    queryKey: ['interventoras'],
    queryFn: async () => (await api.get('/empresas-interventoria')).data,
});
const { data: allUsuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => (await api.get('/usuarios')).data,
});
```

- [ ] **Step 2: Actualizar `resetForm` y `startEdit` en `TorresTab`**

Reemplazar `resetForm`:
```typescript
const resetForm = () => {
    setShowForm(false); setEditId(null); setAbreviatura('');
    setEtapaConstructiva(''); setFrente(''); setProyectoId(''); setFolioInicial(1);
    setEmpresaInterventoriaId(''); setInterventorResponsableId('');
};
```

Reemplazar `startEdit`:
```typescript
const startEdit = (t: any) => {
    setEditId(t.id); setAbreviatura(t.abreviatura || '');
    setEtapaConstructiva(t.etapaConstructiva || ''); setFrente(t.frente || '');
    setProyectoId(t.proyectoId); setFolioInicial((t.folioActual || 0) + 1);
    setEmpresaInterventoriaId(t.empresaInterventoriaId || '');
    setInterventorResponsableId(t.interventorResponsableId || '');
    setShowForm(true);
};
```

- [ ] **Step 3: Actualizar `save` mutation en `TorresTab`**

Reemplazar la mutation `save`:
```typescript
const save = useMutation({
    mutationFn: async () => {
        const payload = {
            nombre: nombreGenerado, abreviatura, etapaConstructiva, frente,
            folioActual: folioInicial - 1,
            empresaInterventoriaId: empresaInterventoriaId || null,
            interventorResponsableId: interventorResponsableId || null,
        };
        if (editId) return (await api.put(`/torres/${editId}`, payload)).data;
        return (await api.post('/torres', { ...payload, proyectoId })).data;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['torres'] });
        resetForm();
        showToast(editId ? 'Frente actualizado' : 'Frente creado');
    },
});
```

- [ ] **Step 4: Agregar los dos selects al formulario en `TorresTab`**

Añadir, dentro del `grid` del formulario (justo después del campo "Primer folio digital"), los siguientes dos campos. La lista de interventores disponibles se filtra por empresa seleccionada y por proyecto:

```tsx
{/* Compute filtered users just before the JSX */}
{/* Añadir esta variable derivada antes del return, en el cuerpo de TorresTab: */}
const efectiveProyectoId = SINGLE_PROJECT_MODE ? (selectedProjectId || '') : proyectoId;
const usuariosDelProyecto = allUsuarios.filter((u: any) =>
    u.usuarioProyectos?.some((up: any) => (up.proyectoId || up.proyecto?.id) === efectiveProyectoId)
);
const interventoresDisponibles = usuariosDelProyecto.filter((u: any) =>
    !empresaInterventoriaId || u.empresaInterventoriaId === empresaInterventoriaId
);
```

Campos JSX a añadir al grid del formulario:
```tsx
<div>
    <label className={labelClasses}>Empresa de Supervisión / Interventoría</label>
    <select
        value={empresaInterventoriaId}
        onChange={(e) => { setEmpresaInterventoriaId(e.target.value); setInterventorResponsableId(''); }}
        className={selectClasses}
    >
        <option value="">Sin empresa asignada</option>
        {interventoras.map((emp: any) => (
            <option key={emp.id} value={emp.id}>
                {emp.nombre} — {emp.tipo === 'supervision_tecnica' ? 'Sup. Técnica' : 'Interventoría'}
            </option>
        ))}
    </select>
</div>
<div>
    <label className={labelClasses}>Persona Responsable</label>
    <select
        value={interventorResponsableId}
        onChange={(e) => setInterventorResponsableId(e.target.value)}
        className={selectClasses}
        disabled={!empresaInterventoriaId}
    >
        <option value="">
            {empresaInterventoriaId ? 'Seleccionar persona...' : 'Seleccione primero una empresa'}
        </option>
        {interventoresDisponibles.map((u: any) => (
            <option key={u.id} value={u.id}>
                {u.nombre} {u.apellido} — {u.cargo}
            </option>
        ))}
    </select>
    {empresaInterventoriaId && interventoresDisponibles.length === 0 && (
        <p className="text-xs text-amber-600 mt-1">
            No hay usuarios del proyecto asignados a esta empresa.
        </p>
    )}
</div>
```

- [ ] **Step 5: Actualizar `ProyectoEditForm` — quitar empresa interventoría**

En `ProyectoEditForm`:
- Eliminar el estado `empresaInterventoriaId` y su setter
- Eliminar el campo `empresaInterventoriaId` del `hydrated` block
- Eliminar `empresaInterventoriaId` del payload de `saveMutation`
- Eliminar la query de `interventoras`
- Eliminar la función `tipoInterventora`
- Eliminar el `<div>` del select "Empresa de Supervisión Técnica" (el sexto campo del grid)
- En el preview card, eliminar el `<div>` que muestra "Empresa de Supervisión Técnica"

- [ ] **Step 6: Actualizar `InterventorasTab` — quitar sección de asignación a proyecto**

En `InterventorasTab`, eliminar:
- La query `proyecto` (líneas con `useQuery` para `['proyecto', selectedProjectId]`)
- La mutation `proyectoEmpresaMutation`
- El bloque JSX `{SINGLE_PROJECT_MODE && selectedProjectId && ( ... )}` al final del return (la tarjeta azul de "Empresa de Supervisión activa para el proyecto")

- [ ] **Step 7: Verificar tipos del cliente**

```bash
cd client && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errores.

---

## Self-Review

**Spec coverage:**
- ✅ Quitar `empresaInterventoriaId` de `Proyecto` → Task 1 + Task 2 Step 3 + Task 3 Step 5
- ✅ Agregar `empresaInterventoriaId` a `Torre` → Task 1 + Task 2 Steps 1-2 + Task 3 Steps 1-4
- ✅ Agregar `interventorResponsableId` a `Torre` → Task 1 + Task 2 Steps 1-2 + Task 3 Steps 1-4
- ✅ Persona debe pertenecer al mismo proyecto → filtro `usuariosDelProyecto` en Task 3 Step 4
- ✅ Persona debe pertenecer a la misma empresa → filtro `interventoresDisponibles` en Task 3 Step 4
- ✅ Select de persona se desactiva hasta que se elija empresa → `disabled={!empresaInterventoriaId}` en Task 3 Step 4
- ✅ Validación en delete de empresa para torres → Task 2 Step 4
- ✅ Quitar sección de asignación por proyecto en InterventorasTab → Task 3 Step 6
