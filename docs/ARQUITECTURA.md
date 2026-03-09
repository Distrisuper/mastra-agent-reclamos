# Arquitectura Técnica — distri-reclamos-agent

**Documento técnico detallado sobre la arquitectura, patrones de diseño y decisiones técnicas del sistema.**

---

## 1. Visión General de la Arquitectura

### 1.1 Stack Tecnológico

| Capa | Tecnología | Versión | Propósito |
|------|------------|---------|-----------|
| **Runtime** | Node.js | 22.13.0+ | Entorno de ejecución |
| **Framework** | Mastra | 1.10.0+ | Framework de agentes IA |
| **Lenguaje** | TypeScript | 5.9.3 | Tipado estático |
| **Base de Datos** | PostgreSQL | 14+ | Persistencia de reclamos |
| **Storage** | LibSQL | 1.6.4 | Storage embebido Mastra |
| **IA** | OpenRouter API | - | Gateway a modelos LLM |
| **Modelo** | Gemini 2.5 Flash | - | Modelo por defecto |
| **Testing** | Vitest | 4.0.18 | Framework de tests |
| **Contenedores** | Docker | - | Contenedorización |

### 1.2 Principios de Diseño

1. **Conversación Natural**: El usuario interactúa sin conocer la estructura interna
2. **Validación Progresiva**: Los datos se validan en cada capa
3. **Confirmación Explícita**: Ninguna acción se ejecuta sin confirmación
4. **Inmutabilidad de Eventos**: Los eventos de reclamo son inmutables
5. **Singleton de Conexiones**: Pool de DB como singleton

---

## 2. Arquitectura de Capas

```
┌─────────────────────────────────────────────────────────────────┐
│ Capa 1: Presentación (Clientes)                                 │
│ ─────────────────────────────────────────────────────────────── │
│ • Mastra Studio (UI interactiva)                               │
│ • API REST Consumers (Slack, Teams, Email)                     │
│ • Integraciones Futuras (Webhooks)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/JSON
┌─────────────────────────────────────────────────────────────────┐
│ Capa 2: API Gateway (Mastra Server)                             │
│ ─────────────────────────────────────────────────────────────── │
│ • Enrutamiento de peticiones                                   │
│ • Validación de schemas (Zod)                                  │
│ • Middleware de autenticación                                  │
│ • Health checks                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Internal Calls
┌─────────────────────────────────────────────────────────────────┐
│ Capa 3: Orquestación (Services)                                 │
│ ─────────────────────────────────────────────────────────────── │
│ • procesarIngresoReclamo(): Orquestador principal              │
│ • Gestión de RequestContext                                    │
│ • Detección de outcomes (conversing/submitted/error)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Agent.generate()
┌─────────────────────────────────────────────────────────────────┐
│ Capa 4: Agente IA (reclamosAgent)                               │
│ ─────────────────────────────────────────────────────────────── │
│ • Dynamic Instructions (buildSystemPrompt)                     │
│ • Memory Management (thread/resource)                          │
│ • Tool Orchestration                                           │
│ • Context Injection (RequestContext)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Tool.execute()
┌─────────────────────────────────────────────────────────────────┐
│ Capa 5: Tools (Acciones)                                        │
│ ─────────────────────────────────────────────────────────────── │
│ • submitClaimTool: INSERT en PostgreSQL                        │
│ • consultaEstadoTool: SELECT por ID                            │
│ • Tools Futuras: ClickUp, Sheets, Slack                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ SQL
┌─────────────────────────────────────────────────────────────────┐
│ Capa 6: Persistencia                                            │
│ ─────────────────────────────────────────────────────────────── │
│ • PostgreSQL: Datos de negocio (reclamos)                      │
│ • LibSQL: Storage de Mastra (memoria)                          │
│ • Memory: Thread + Resource (conversaciones)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Componentes Principales

### 3.1 reclamosAgent

**Archivo**: `src/mastra/agents/reclamos-agent.ts`

```typescript
export const reclamosAgent = new Agent({
  id: "reclamos-agent",
  name: "Agente de Reclamos - Sofía",
  description: "Agente conversacional para recolección y registro de reclamos",
  
  // Dynamic Instructions
  instructions: async ({ requestContext }) => {
    const userName = requestContext?.get("userName") ?? "Usuario";
    const attachmentUrl = requestContext?.get("attachmentUrl") ?? null;
    return buildSystemPrompt(userName, attachmentUrl);
  },
  
  // Modelo de IA
  model: "openrouter/google/gemini-2.5-flash",
  
  // Tools disponibles
  tools: { submitClaimTool, consultaEstadoTool },
  
  // Memoria conversacional
  memory: new Memory({
    options: {
      lastMessages: 12, // Últimos 12 mensajes
    },
  }),
});
```

**Características clave**:

- **Dynamic Instructions**: El prompt se construye por request, no es estático
- **RequestContext**: Inyecta datos externos (userName, attachmentUrl) sin que el LLM los pregunte
- **Memory**: Mantiene contexto conversacional con thread y resource IDs
- **Tools**: Solo tiene acceso a tools específicas, no puede ejecutar acciones arbitrarias

### 3.2 buildSystemPrompt

**Archivo**: `src/mastra/prompts/system-prompt-builder.ts`

Construye el system prompt dinámico inyectando:

1. **Identidad**: Nombre (Sofía), tono rioplatense, límites (3 oraciones)
2. **Tarea**: Flujo obligatorio de recolección
3. **Campos**: Obligatorios y condicionales
4. **Descripción Sólida**: Criterios de calidad (qué + alcance + cuándo)
5. **Configuración**: Áreas, sistemas, prioridades desde archivos TS
6. **Ejemplos**: Casos de clasificación por área
7. **Herramientas**: Instrucciones de uso de submit_claim

**Estructura del prompt**:

```xml
<identidad>
  Sos Sofía, asistente de soporte interno...
</identidad>

<tarea>
  Recolectá los datos necesarios para registrar un reclamo...
</tarea>

<campos>
  Obligatorios siempre: tipo_reclamo, sistema, area, motivo, descripcion
  Condicional: n_cliente (si Externo)
</campos>

<descripcion_solida>
  1. ¿QUÉ pasó exactamente?
  2. ¿ALCANCE: afecta a todos o es puntual?
  3. ¿DESDE CUÁNDO o en qué contexto se detectó?
</descripcion_solida>

<areas>
  - "Sistemas": Fallas en software...
  - "Administracion": Facturación, pagos...
  ...
</areas>

<sistemas>
  Categorías: [Ventas/Comercial]: Lupa, Facturación...
  ...
</sistemas>

<prioridad>
  - Urgente: Sistema caído...
  - Alta: Funcionalidad degradada...
  - Normal: Default...
</prioridad>
```

### 3.3 procesarIngresoReclamo

**Archivo**: `src/mastra/services/procesar-ingreso-reclamo.ts`

Orquesta el flujo completo:

```typescript
export async function procesarIngresoReclamo(
  agent: Agent,
  payload: IngestReclamoPayload
): Promise<IngestReclamoResponse> {
  // 1. Normalizar IDs
  const source = normalizarSegmento(payload.source || "external");
  const reporterId = normalizarSegmento(payload.reporter.id);
  const threadId = payload.conversationId.trim();
  const resourceId = `${source}:${reporterId}`;

  // 2. Crear RequestContext
  const requestContext = new RequestContext([
    ["userName", payload.reporter.name],
    ["attachmentUrl", payload.metadata?.attachmentUrl],
    ["canal", payload.source],
    ["creado_por_ref", payload.reporter.id],
    ["adjunto_url", payload.metadata?.attachmentUrl],
  ]);

  // 3. Ejecutar agente con memoria
  const response = await agent.generate(payload.message, {
    requestContext,
    maxSteps: 6,
    memory: {
      thread: threadId,
      resource: resourceId,
    },
  });

  // 4. Detectar outcome
  const toolResults = response.steps?.flatMap(s => s.toolResults ?? []) ?? [];
  const submitResult = toolResults.find(tr => tr.payload.toolName === "submitClaimTool");
  const isSubmitted = submitResult?.payload.result?.success === true;

  // 5. Construir respuesta
  return {
    success: true,
    replyText: response.text,
    outcome: isSubmitted ? "submitted" : "conversing",
    conversation: { conversationId, messageId, threadId, resourceId },
    claimCode: isSubmitted ? submitResult.payload.result.reclamo_codigo : null,
    // ...
  };
}
```

### 3.4 submitClaimTool

**Archivo**: `src/mastra/tools/submit-claim-tool.ts`

Tool para registrar reclamos en PostgreSQL:

```typescript
export const submitClaimTool = createTool({
  id: "submit-claim",
  description: "Registra un reclamo confirmado en el sistema",
  
  inputSchema: z.object({
    nombre: z.string(),
    tipo_reclamo: z.enum(["Interno", "Externo"]),
    n_cliente: z.string().nullable(),
    sistema: z.string(),
    area: z.string(),
    prioridad: z.enum(["Urgente", "Alta", "Normal"]),
    motivo: z.string(),
    descripcion: z.string(),
  }),
  
  execute: async (inputData, context) => {
    // Obtener contexto automático
    const canal = context?.requestContext?.get("canal") ?? "chat";
    const creado_por_ref = context?.requestContext?.get("creado_por_ref");
    const adjunto_url = context?.requestContext?.get("adjunto_url");

    // Validaciones
    const errores: string[] = [];
    if (!inputData.nombre?.trim()) errores.push("nombre es requerido");
    if (inputData.tipo_reclamo === "Externo" && !inputData.n_cliente?.trim()) {
      errores.push("n_cliente es obligatorio para Externo");
    }
    // ... más validaciones

    if (errores.length > 0) {
      return { success: false, mensaje: "...", errores };
    }

    // INSERT en PostgreSQL
    const pool = getPool();
    const result = await pool.query(INSERT_RECLAMO_SQL, [
      canal, inputData.nombre, creado_por_ref, inputData.tipo_reclamo,
      inputData.area, inputData.sistema, inputData.prioridad,
      inputData.n_cliente, inputData.motivo, inputData.descripcion, adjunto_url
    ]);

    return {
      success: true,
      reclamo_codigo: result.rows[0].reclamo_codigo,
      mensaje: `Reclamo ${result.rows[0].reclamo_codigo} registrado`,
    };
  },
});
```

**SQL de inserción**:

```sql
WITH inserted AS (
  INSERT INTO reclamos (
    canal_id, creado_por_nombre, creado_por_ref,
    tipo, area_id, sistema_id, prioridad,
    cliente_codigo, motivo, descripcion,
    adjunto_url, estado_id
  )
  VALUES (
    (SELECT id FROM canales  WHERE nombre = $1),
    $2, $3, $4,
    (SELECT id FROM areas    WHERE nombre = $5),
    (SELECT id FROM sistemas WHERE nombre = $6),
    $7, $8, $9, $10, $11,
    (SELECT id FROM estados  WHERE nombre = 'Abierto')
  )
  RETURNING id, codigo
),
evento AS (
  INSERT INTO reclamos_eventos (reclamo_id, tipo, estado_id, autor_nombre, contenido)
  SELECT
    inserted.id,
    'cambio_estado',
    (SELECT id FROM estados WHERE nombre = 'Abierto'),
    'Sistema',
    'Reclamo creado'
  FROM inserted
  RETURNING id
)
SELECT inserted.id AS reclamo_id, inserted.codigo AS reclamo_codigo
FROM inserted;
```

---

## 4. Patrón RequestContext

### 4.1 Problema

El LLM no debe conocer detalles técnicos como:
- IDs internos del sistema
- URLs de adjuntos detectados automáticamente
- Canal de origen (Slack, Teams, etc.)

### 4.2 Solución

`RequestContext` es un mapa clave-valor que inyecta datos externos al agente:

```typescript
// En el servicio
const requestContext = new RequestContext([
  ["userName", "Juan Pérez"],           // Para el prompt
  ["attachmentUrl", "https://..."],     // Para el tool
  ["canal", "slack"],                   // Para el tool
  ["creado_por_ref", "U123"],           // Para el tool
]);

// En el agente (instructions)
instructions: async ({ requestContext }) => {
  const userName = requestContext?.get("userName");
  return buildSystemPrompt(userName, ...);
}

// En el tool
execute: async (inputData, context) => {
  const canal = context?.requestContext?.get("canal");
  const adjunto_url = context?.requestContext?.get("adjunto_url");
  // ...
}
```

### 4.3 Flujo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│  Payload de Entrada                                         │
│  {                                                          │
│    reporter: { id: "U123", name: "Juan" },                 │
│    source: "slack",                                         │
│    metadata: { attachmentUrl: "https://..." }              │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  RequestContext (Map)                                       │
│  {                                                          │
│    "userName" → "Juan",                                     │
│    "attachmentUrl" → "https://...",                         │
│    "canal" → "slack",                                       │
│    "creado_por_ref" → "U123",                               │
│    "adjunto_url" → "https://..."                            │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Usos                                                         │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │ buildSystemPrompt   │  │ submitClaimTool.execute     │  │
│  │ - userName          │  │ - canal                     │  │
│  │ - attachmentUrl     │  │ - creado_por_ref            │  │
│  │                     │  │ - adjunto_url               │  │
│  └─────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Memoria Conversacional

### 5.1 Configuración

```typescript
memory: new Memory({
  options: {
    lastMessages: 12, // Equivalente a contextWindowLength en n8n
  },
}),
```

### 5.2 Thread y Resource

| Concepto | Formato | Ejemplo | Propósito |
|----------|---------|---------|-----------|
| **threadId** | `conversationId` | `conv-123` | Hilo de conversación específico |
| **resourceId** | `source:reporterId` | `slack:U001` | Identificador del usuario por canal |

### 5.3 Persistencia

La memoria se persiste en LibSQL:

```
.mastra/
└── output/
    └── reclamos.db    # SQLite embebido
        ├── threads
        ├── messages
        └── resources
```

### 5.4 Ciclo de Vida

1. **Primer mensaje**: Se crea thread y resource
2. **Cada intercambio**: Se agregan mensajes al thread
3. **Límite**: Se mantienen últimos 12 mensajes
4. **Nuevo thread**: conversationId diferente crea nuevo hilo

---

## 6. Base de Datos

### 6.1 PostgreSQL (Producción)

**Schema**: `reclamos`

**Conexión Singleton**:

```typescript
// src/mastra/services/database.ts
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL;
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Setear schema por defecto
    pool.on("connect", (client) => {
      client.query("SET search_path TO reclamos");
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
```

### 6.2 LibSQL (Desarrollo)

Para desarrollo local sin PostgreSQL:

```typescript
storage: new LibSQLStore({
  id: "reclamos-storage",
  url: process.env.DATABASE_URL || "file:./reclamos.db",
}),
```

### 6.3 Tablas de Catálogo

**areas**:
| id | nombre | descripcion |
|----|--------|-------------|
| 1 | Sistemas | Fallas en software... |
| 2 | Administracion | Facturación, pagos... |
| 3 | Tv/Comercial | Vendedores, pedidos... |
| 4 | Deposito | Envíos, logística... |
| 5 | Compras | Proveedores, artículos... |
| 6 | Gerencia | Decisiones estratégicas... |

**sistemas**:
| id | nombre | categoria |
|----|--------|-----------|
| 1 | Lupa | Ventas/Comercial |
| 2 | Facturacion Automatica | Ventas/Comercial |
| 3 | Flexxus | Administracion |
| ... | ... | ... |

**estados**:
| id | nombre |
|----|--------|
| 1 | Abierto |
| 2 | En Progreso |
| 3 | En Revision |
| 4 | Resuelto |
| 5 | Cerrado |
| 6 | Cancelado |

**canales**:
| id | nombre |
|----|--------|
| 1 | slack |
| 2 | chat |
| 3 | external |
| 4 | teams |
| 5 | email |

---

## 7. API REST

### 7.1 POST /ingest/reclamos

**Archivo**: `src/mastra/api/ingest-reclamos-route.ts`

**Middleware de autenticación**:

```typescript
middleware: [
  async (c, next) => {
    const configuredSecret = process.env.INGEST_API_SECRET?.trim();

    if (!configuredSecret) {
      await next();
      return;
    }

    const providedSecret = c.req.header("x-ingest-secret");
    if (providedSecret !== configuredSecret) {
      return c.json(
        { success: false, error: "Unauthorized" },
        401
      );
    }

    await next();
  },
],
```

**Handler**:

```typescript
handler: async (c) => {
  // 1. Parsear JSON
  const rawBody = await c.req.json();

  // 2. Validar schema
  const parsedPayload = ingestReclamoSchema.safeParse(rawBody);
  if (!parsedPayload.success) {
    return c.json({ success: false, error: "Invalid payload" }, 400);
  }

  // 3. Obtener agente
  const mastra = c.get("mastra");
  const agent = mastra.getAgent("reclamosAgent");

  // 4. Procesar
  const response = await procesarIngresoReclamo(agent, parsedPayload.data);

  // 5. Responder
  return c.json(response, response.success ? 200 : 500);
},
```

### 7.2 GET /health

**Archivo**: `src/mastra/api/health-route.ts`

```typescript
handler: async (c) => {
  let dbStatus = "disconnected";

  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    dbStatus = "connected";
  } catch {
    // DB not reachable
  }

  const body = {
    status: dbStatus === "connected" ? "ok" : "error",
    db: dbStatus,
    timestamp: new Date().toISOString(),
  };

  return c.json(body, dbStatus === "connected" ? 200 : 503);
},
```

---

## 8. Testing

### 8.1 Estructura de Tests

```
src/mastra/
├── agents/
├── api/
│   └── schemas/
│       └── __tests__/
│           └── ingest-reclamos-schema.test.ts
├── prompts/
│   └── __tests__/
│       └── system-prompt-builder.test.ts
├── services/
│   └── __tests__/
│       └── procesar-ingreso-reclamo.test.ts
└── tools/
    └── __tests__/
        └── submit-claim-tool.test.ts
```

### 8.2 Ejemplo de Test

```typescript
// src/mastra/tools/__tests__/submit-claim-tool.test.ts
import { describe, it, expect } from "vitest";
import { submitClaimTool } from "../submit-claim-tool";

const makeContext = () => ({
  requestContext: new Map<string, unknown>([
    ["canal", "slack"],
    ["creado_por_ref", "U123"],
    ["adjunto_url", null],
  ]),
});

describe("submitClaimTool validations", () => {
  it("rejects empty nombre", async () => {
    const result = await submitClaimTool.execute!(
      { ...validInput, nombre: "" },
      makeContext() as any,
    );
    expect(result.success).toBe(false);
    expect(result.errores).toContain("nombre es requerido");
  });

  it("rejects Externo without n_cliente", async () => {
    const result = await submitClaimTool.execute!(
      { ...validInput, tipo_reclamo: "Externo", n_cliente: null },
      makeContext() as any,
    );
    expect(result.success).toBe(false);
    expect(result.errores).toContain(
      "n_cliente es obligatorio para reclamos de tipo Externo"
    );
  });
});
```

### 8.3 Ejecución

```bash
# Todos los tests
npm test

# Test específico
npx vitest run src/mastra/tools/__tests__/submit-claim-tool.test.ts

# Modo watch
npx vitest watch
```

---

## 9. Despliegue

### 9.1 Docker

**Dockerfile multi-stage**:

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY src ./src
COPY tsconfig.json ./

RUN npx mastra build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/.mastra/output ./.mastra/output

EXPOSE 4111

ENV NODE_ENV=production

CMD ["node", ".mastra/output/index.mjs"]
```

### 9.2 Variables de Entorno

**Desarrollo**:
```bash
OPENROUTER_API_KEY=sk-or-v1-...
POSTGRES_URL=postgresql://user:pass@localhost:5432/reclamos
DATABASE_URL=file:./reclamos.db
LOG_LEVEL=debug
NODE_ENV=development
```

**Producción**:
```bash
OPENROUTER_API_KEY=sk-or-v1-...
POSTGRES_URL=postgresql://user:pass@db-host:5432/reclamos
DATABASE_URL=file:/data/reclamos.db
LOG_LEVEL=info
NODE_ENV=production
INGEST_API_SECRET=shared-secret-prod
MASTRA_PORT=4111
```

### 9.3 docker-compose.yml (Ejemplo)

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "4111:4111"
    environment:
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - POSTGRES_URL=postgresql://reclamos:pass@db:5432/reclamos
      - DATABASE_URL=file:/data/reclamos.db
      - NODE_ENV=production
    volumes:
      - ./data:/data
    depends_on:
      - db

  db:
    image: postgres:14
    environment:
      - POSTGRES_USER=reclamos
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=reclamos
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  pgdata:
```

---

## 10. Seguridad

### 10.1 Buenas Prácticas Implementadas

1. **Variables de Entorno**: Secrets fuera del código
2. **Validación Zod**: Todos los inputs validados
3. **SQL Parametrizado**: Prevención de SQL injection
4. **Graceful Shutdown**: Cierre adecuado de conexiones
5. **Logging**: PinoLogger con niveles configurables

### 10.2 Graceful Shutdown

```typescript
async function shutdown() {
  console.log("Shutting down gracefully...");
  try {
    await mastra.shutdown();
  } catch (e) {
    console.error("Error shutting down Mastra:", e);
  }
  try {
    await closePool();
  } catch (e) {
    console.error("Error closing DB pool:", e);
  }
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

### 10.3 SensitiveDataFilter

Mastra incluye filtrado automático de datos sensibles:

```typescript
// Configurado automáticamente por Mastra
// Los campos como API keys, passwords, etc. son filtrados
```

---

## 11. Decisiones Técnicas

### 11.1 ¿Por qué Mastra?

- **Framework especializado**: Diseñado para agentes IA
- **Memory integrada**: Gestión de conversaciones multi-turno
- **Tools nativas**: Integración limpia con acciones
- **Mastra Studio**: UI para testing y desarrollo
- **Observabilidad**: Trazas y logs integrados

### 11.2 ¿Por qué Dynamic Instructions?

- **Contexto por request**: Cada usuario tiene su contexto
- **Separación de concerns**: Prompt builder separado del agente
- **Testeabilidad**: Se puede testear el builder independientemente

### 11.3 ¿Por qué RequestContext?

- **Inyección limpia**: Datos externos sin ensuciar el LLM
- **Tipado seguro**: TypeScript con tipos definidos
- **Flexibilidad**: Se pueden agregar nuevos campos fácilmente

### 11.4 ¿Por qué PostgreSQL?

- **Robustez**: Base de datos probada en producción
- **Schema propio**: Separación lógica de datos
- **Integridad**: FKs y constraints para calidad de datos
- **Event Sourcing**: Tabla de eventos para auditoría

### 11.5 ¿Por qué LibSQL para Memory?

- **Simplicidad**: SQLite embebido, sin servidor adicional
- **Portabilidad**: Archivo único, fácil de backup
- **Performance**: Lecturas rápidas para memoria

---

## 12. Roadmap Técnico

### Fase 1 (Completada ✅)

- [x] Agente conversacional "Sofía"
- [x] Dynamic Instructions con RequestContext
- [x] Memory con thread/resource
- [x] submitClaimTool con PostgreSQL
- [x] API REST /ingest/reclamos
- [x] Health check endpoint
- [x] Tests unitarios

### Fase 2 (En Progreso 🔄)

- [ ] consultaEstadoTool con DB real
- [ ] Integración con ClickUp
- [ ] Integración con Google Sheets
- [ ] Integración con Slack

### Fase 3 (Planificado 📋)

- [ ] Detección de duplicados semántica
- [ ] informeReclamosTool
- [ ] Dashboard de métricas
- [ ] Rate limiting
- [ ] Cache con Redis

---

## 13. Referencias

- [Mastra Documentation](https://mastra.ai/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Zod Documentation](https://zod.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [OpenRouter API](https://openrouter.ai/docs)

---

**Documento mantenido por el equipo de desarrollo**
