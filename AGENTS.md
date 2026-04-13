<!-- BEGIN:nextjs-agent-rules -->

# Critical: This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

## Timelog App — Agent Guidelines

### Before You Start Coding

1. **Read CLAUDE.md first** — it has architecture, data model, workflows, conventions
2. **Check the stack** — Next.js 16.2, Prisma 7, NextAuth 5 (beta), React 19
3. **For any changes to the data model**:
   - Edit `prisma/schema.prisma`
   - Run `npm run db:migrate` to create migration file
   - Review migration before committing

### Golden Rules for This Codebase

#### Rule #1: Hours Validation is Critical
- Hours **must always be multiples of 0.25** (0.25, 0.5, 0.75, 1.0, etc.)
- Backend enforces: `hours % 0.25 !== 0`
- Frontend must validate before POST
- If you bypass this, reports break. Don't do it.

#### Rule #2: Use Prisma Singleton
```typescript
// ✅ DO
import { prisma } from "@/lib/db";
const entries = await prisma.timeEntry.findMany({...});

// ❌ DON'T
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient(); // Creates new connection every time
```

#### Rule #3: Always Check Auth in API Routes
```typescript
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

No exceptions. Every API route that touches user data needs this.

#### Rule #4: TimeEntry Category Workflow
- **CLIENT_WORK**: requires `clientName` + `workTypeId` (optional but recommended)
- **INTERNAL/ADMIN/TRAINING**: requires `activityId` (must exist in DB)
- Validate in POST handler before insert

#### Rule #5: Asana is Read-Only Cache
- Don't try to write back to Asana from this app
- Sync runs daily at 5:30 PM ET — changes in Asana take time to reflect
- If you change a task name in Asana, TimeEntry still has old name (snapshot)
- For testing: call `GET /api/asana/sync` manually to force sync

#### Rule #6: Reports API Requires MANAGER+
- Regular MEMBER users can't access `/api/reports`
- If building user-facing analytics: make separate endpoint or require MANAGER role

---

### Common Tasks & Patterns

#### Adding a New API Endpoint

Example: `POST /api/entries`

```typescript
// 1. Import auth + db
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// 2. Async handler
export async function POST(req: NextRequest) {
  // 3. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4. Parse request
  const data = await req.json();

  // 5. Validate
  if (!data.hours || data.hours <= 0 || data.hours % 0.25 !== 0) {
    return NextResponse.json(
      { error: "Hours must be positive and in 0.25 increments" },
      { status: 400 }
    );
  }

  // 6. Call Prisma with include/select
  const entry = await prisma.timeEntry.create({
    data: {
      userId: session.user.id,
      date: new Date(data.date),
      category: data.category,
      hours: data.hours,
      clientName: data.clientName,
      workTypeId: data.workTypeId,
      // ... other fields
    },
    include: {
      workType: { select: { name: true } },
    },
  });

  return NextResponse.json(entry);
}
```

#### Adding a New Page

Example: new admin section for "Teams"

1. Create `src/app/(app)/teams/page.tsx`:
```typescript
"use client";

import { useState, useEffect } from "react";

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/teams")
      .then(r => r.json())
      .then(data => {
        setTeams(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Teams</h1>
      {/* Render teams... */}
    </div>
  );
}
```

2. Create `src/app/api/admin/teams/route.ts`:
```typescript
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!["MANAGER", "ADMIN"].includes(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const teams = await prisma.team.findMany({ where: { active: true } });
  return NextResponse.json(teams);
}
```

3. Add navigation link in `src/components/app-shell.tsx`

#### Modifying Prisma Schema

Example: Add `department` field to User

1. Edit `prisma/schema.prisma`:
```prisma
model User {
  // ... existing fields
  department String?  // NEW
  
  // ... rest of model
}
```

2. Create migration:
```bash
npm run db:migrate
# Enter: "add_department_to_user"
# Review migration file in prisma/migrations/
```

3. Update backend logic that reads/writes User
4. Update admin UI to allow editing department

---

### Error Handling

#### Don't Return 500 for Validation Errors
```typescript
// ❌ DON'T
if (!data.hours) throw new Error("Hours required");

// ✅ DO
if (!data.hours) {
  return NextResponse.json(
    { error: "Hours required" },
    { status: 400 }
  );
}
```

#### Async Errors
```typescript
try {
  const entry = await prisma.timeEntry.create({...});
  return NextResponse.json(entry);
} catch (err) {
  console.error("Failed to create entry:", err);
  return NextResponse.json(
    { error: "Failed to create entry" },
    { status: 500 }
  );
}
```

---

### Testing Strategy

No automated tests are set up. Test manually:

1. **API**: Use `curl`, Postman, or `src/components/entry-form.tsx` in browser
2. **Scenarios to verify**:
   - Hours validation (test 0.25 increments)
   - Category-specific validations (CLIENT_WORK requires clientName)
   - Auth checks (try with MEMBER, MANAGER, ADMIN roles)
   - Date filtering in reports

---

### Debugging Tips

**Check Prisma Types Were Generated**:
```bash
ls src/generated/prisma/ | grep -E "(client|models)" | head -5
# If empty: npm run db:generate
```

**Inspect Database**:
```bash
npx prisma studio
# Opens http://localhost:5555 for DB browser
```

**Logs**:
- App logs: check `npm run dev` terminal
- SQL logs: add `log: ["query"]` to `PrismaClient({ adapter, log: [...] })`

---

### Restrictions That Will Bite You

1. **MEMBER users can't see reports** — only MANAGER+ (line 7 of `/api/reports/route.ts`)
2. **Asana changes aren't instant** — daily sync, not realtime
3. **Hours must be 0.25 multiples** — no exceptions
4. **No department field** — add to schema if needed
5. **NextAuth 5 is beta** — some APIs may differ from docs; check `node_modules/next-auth/`
6. **No timezone handling** — all dates in server timezone; assumes UTC

---

### When in Doubt

1. Check `CLAUDE.md` (overview, architecture, workflows)
2. Read similar code in repo (ej: look at `POST /api/entries` to understand pattern)
3. Check `node_modules/next/dist/docs/` for Next.js questions
4. Inspect schema in `prisma/schema.prisma` for data relationships
5. Test manually in browser/Postman before submitting

Good luck! 🚀
