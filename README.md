# distri-reclamos-agent

**Agente de Reclamos Técnicos — "Sofía"**

Sistema inteligente de gestión de reclamos técnicos impulsado por IA, construido con el framework [Mastra](https://mastra.ai/). Procesa reclamos entrantes mediante conversación natural, valida completitud, detecta duplicados y coordina el registro en sistemas de gestión.

---

## 📋 Tabla de Contenidos

- [Descripción General](#-descripción-general)
- [Características Principales](#-características-principales)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Inicio Rápido](#-inicio-rápido)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Configuración](#-configuración) (incluye n8n, messaging y tools por capa)
- [Agentes](#-agentes)
- [Tools](#-tools)
- [API REST](#-api-rest)
- [Base de Datos](#-base-de-datos)
- [Testing](#-testing)
- [Despliegue](#-despliegue)
- [Seguridad](#-seguridad)
- [Recursos](#-recursos)

---

## 📌 Descripción General

Este agente procesa reclamos técnicos entrantes (vía API REST o Mastra Studio; Slack planificado), valida completitud y descripción, detecta duplicados consultando reclamos recientes y coordina el registro del reclamo así:

- **n8n (webhooks)**: El alta del reclamo (`submitClaimTool`) y la búsqueda de duplicados (`checkDuplicateClaimTool`) llaman a flujos n8n configurables (`N8N_GUARDAR_RECLAMO_URL`, `N8N_RECLAMOS_RECIENTES_URL`). Quien despliegue el proyecto necesita esos endpoints (o mocks) con el contrato esperado; ver [docs/API.md](./docs/API.md).
- **PostgreSQL** (schema `reclamos`): Usado por `GET /health` (ping a la base) y como modelo de datos de negocio; la persistencia del reclamo en producción la orquesta normalmente n8n hacia esta u otras piezas.
- **LibSQL / SQLite** (`DATABASE_URL`): Almacenamiento Mastra (memoria, trazas en Studio, etc.).
- **ClickUp** / **Google Sheets** / **Slack**: Integraciones de producto pendientes o externas al código de este repo.

### Personalidad del Agente

**Sofía** es la asistente virtual de soporte interno con:

- **Tono**: Español rioplatense, casual y empático
- **Estilo**: Máximo 3 oraciones por mensaje, una pregunta a la vez
- **Enfoque**: Recolección natural de datos para reclamos sólidos

---

## ✨ Características Principales

| Característica | Descripción | Estado |
|----------------|-------------|--------|
| **Conversación Natural** | Recolecta datos mediante diálogo fluido | ✅ Implementado |
| **Plantillas de Reclamos** | Enviá tu reclamo completo en un solo mensaje | ✅ Implementado |
| **Validación Automática** | Verifica completitud y descripción sólida | ✅ Implementado |
| **Detección de Duplicados** | Verifica reclamos similares antes de registrar | ✅ Implementado |
| **Contexto Dinámico** | Configuración de áreas, sistemas y prioridades | ✅ Implementado |
| **Multi-canal** | API REST, Slack, Mastra Studio | ✅ API + Studio |
| **Memoria Conversacional** | Thread y resource para multi-turno | ✅ Implementado |
| **Consulta de Estado** | `consultaEstadoTool`: mock MVP; registrada en Mastra (app), no en el agente Sofía |
| **Informes** | Reporte de reclamos activos | 🔄 Planificado |

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                     CAPA DE ENTRADA                              │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Mastra Studio │   Slack (Fase 2)│   API REST /ingest/reclamos │
│   (localhost:4111)│   Webhook     │   (integraciones externas)  │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA DE AGENTES                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              reclamosAgent ("Sofía")                      │  │
│  │  • Dynamic Instructions con RequestContext               │  │
│  │  • Memory con thread/resource (12 últimos mensajes)      │  │
│  │  • Tools: parseClaimTemplateTool, checkDuplicateClaimTool, submitClaimTool │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA DE SERVICIOS                             │
├─────────────────────────────────────────────────────────────────┤
│  • procesarIngresoReclamo(): Orquesta el flujo ingest          │
│  • buildSystemPrompt(): Construye prompt dinámico             │
│  • getPool(): PostgreSQL (p. ej. GET /health)                  │
│  • n8n: guardar reclamo + reclamos recientes (webhooks)        │
│  • postSubmitNotifications: WhatsApp vía messaging-service (opt.) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA DE DATOS                                 │
├──────────────────────┬──────────────────────────────────────────┤
│   PostgreSQL         │   LibSQL (SQLite embebido)              │
│   • schema: reclamos │   • Mastra Storage                      │
│   • tablas: reclamos,│   • Memoria conversacional              │
│     reclamos_eventos │   • Persistencia de estado              │
│   • APIs: ingest, health                                      │
└──────────────────────┴──────────────────────────────────────────┘
```

---

## 🚀 Inicio Rápido

### Prerrequisitos

- **Node.js** >= 22.13.0
- **API Key de OpenRouter** ([openrouter.ai/keys](https://openrouter.ai/keys))
- **PostgreSQL** con schema `reclamos`: necesario para que `GET /health` responda `200` (el código hace `SELECT 1` con `search_path` en `reclamos`). Sin `POSTGRES_URL` válida, el health reportará base desconectada (`503`).
- **Flujos n8n** (o sustitutos): URLs accesibles para guardar el reclamo y listar reclamos recientes; sin ellos, `submitClaimTool` y `checkDuplicateClaimTool` fallarán en tiempo de ejecución salvo que mockees esos endpoints.

### Instalación

```bash
# 1. Clonar repositorio (reemplazá la URL por la de tu remoto o fork)
git clone https://github.com/TU_ORG/distri-reclamos-agent.git
cd distri-reclamos-agent

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env

# 4. Editar .env — revisá la tabla en [Configuración](#-configuración) y el archivo .env.example
```

**Solo Mastra Studio (mínimo):** con `OPENROUTER_API_KEY` y `DATABASE_URL` podés charlar con el agente; el registro real del reclamo igual requiere el webhook n8n configurado.

### Ejecución

```bash
# Modo desarrollo (con Mastra Studio)
npm run dev

# Acceder a Mastra Studio
# http://localhost:4111

# Build para producción
npm run build

# Inicio en producción
npm start
```

---

## 📁 Estructura del Proyecto

```
distri-reclamos-agent/
├── src/mastra/
│   ├── index.ts                    # Mastra: agentes, tools, workflows, rutas
│   ├── api/
│   │   ├── health-route.ts
│   │   ├── ingest-reclamos-route.ts
│   │   └── schemas/
│   │       ├── ingest-reclamos-schema.ts
│   │       └── __tests__/
│   ├── agents/
│   │   └── reclamos-agent.ts       # Sofía
│   ├── workflows/
│   │   └── post-submit-notifications.ts
│   ├── config/
│   │   ├── areas.ts
│   │   ├── sistemas.ts
│   │   ├── prioridades.ts
│   │   └── ejemplos.ts
│   ├── prompts/
│   │   ├── system-prompt-builder.ts
│   │   └── __tests__/
│   ├── services/
│   │   ├── database.ts
│   │   ├── procesar-ingreso-reclamo.ts
│   │   └── __tests__/
│   └── tools/
│       ├── submit-claim-tool.ts
│       ├── check-duplicate-claim-tool.ts
│       ├── parse-claim-template-tool.ts
│       ├── consulta-estado-tool.ts
│       └── __tests__/
├── docs/
│   ├── DIAGRAMAS.md
│   ├── ARQUITECTURA.md
│   ├── API.md
│   ├── PLANTILLA.md
│   └── Messaging-service-doc.md
├── postman-collection.json         # Colección Postman (API)
├── postman-environment.json
├── .env.example
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## ⚙️ Configuración

### Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | API key de OpenRouter | `sk-or-v1-...` |
| `OPENROUTER_MODEL` | Modelo de IA | `openrouter/google/gemini-2.5-flash` |
| `POSTGRES_URL` | PostgreSQL (health + modelo de datos de negocio) | `postgresql://user:pass@host:5432/reclamos` |
| `DATABASE_URL` | LibSQL / SQLite (Mastra storage, memoria, trazas) | `file:./reclamos.db` |
| `LOG_LEVEL` | Nivel de logging | `info`, `debug`, `warn`, `error` |
| `NODE_ENV` | Entorno | `development`, `production` |
| `MASTRA_PORT` | Puerto del servidor HTTP | `4111` |
| `MASTRA_HOST` | Host del servidor Mastra | `localhost` |
| `INGEST_API_SECRET` | Secret opcional para `POST /ingest/reclamos` | `shared-secret` |
| `N8N_GUARDAR_RECLAMO_URL` | Webhook n8n que persiste el reclamo (`submitClaimTool`) | Ver `.env.example` |
| `N8N_RECLAMOS_RECIENTES_URL` | Webhook n8n para duplicados (`checkDuplicateClaimTool`) | Ver `.env.example` |
| `MESSAGING_SERVICE_URL` | Base URL del servicio de mensajería (post-submit) | Ver [docs/Messaging-service-doc.md](./docs/Messaging-service-doc.md) |
| `MESSAGING_CHANNEL_ALIAS` | Alias de canal en messaging-service | — |
| `MESSAGING_API_KEY` | API key del messaging-service | — |
| `FACTURACION_NOTIFY_NUMBER` | WhatsApp destino (notificaciones Fact. Automática) | `54911...` |

**Observabilidad (opcional):** en `.env.example` hay comentarios para Mastra Cloud, Langfuse y OTLP.

### Integración n8n y workflow post-submit

- **Guardar reclamo:** `submitClaimTool` hace `POST` a `N8N_GUARDAR_RECLAMO_URL` con el cuerpo JSON documentado en el código del tool y en [docs/API.md](./docs/API.md). La respuesta debe incluir `success` y, si aplica, `reclamo_codigo`.
- **Reclamos recientes:** `checkDuplicateClaimTool` llama a `N8N_RECLAMOS_RECIENTES_URL` y espera el formato validado en `check-duplicate-claim-tool.ts`.
- **Tras un alta exitosa:** se dispara en segundo plano el workflow `postSubmitNotifications` (WhatsApp hacia `FACTURACION_NOTIFY_NUMBER` cuando el sistema lo amerita y las vars de messaging están definidas). Detalle: [docs/Messaging-service-doc.md](./docs/Messaging-service-doc.md).

### Herramientas: agente Sofía vs registro global en Mastra

| Tool | En `reclamosAgent` (chat) | Registrado en `mastra` (`index.ts`) |
|------|---------------------------|-------------------------------------|
| `parseClaimTemplateTool` | Sí | No (solo el agente) |
| `checkDuplicateClaimTool` | Sí | Sí |
| `submitClaimTool` | Sí | Sí |
| `consultaEstadoTool` | No | Sí (mock MVP; útil en Mastra Studio aparte del chat de Sofía) |

### Áreas Responsables

| Área | Descripción | Canales Frecuentes |
|------|-------------|-------------------|
| **Sistemas** | Fallas en software, plataformas tecnológicas | Fact Auto, Lupa, Redi, Flexxus |
| **Administración** | Facturación, pagos, trámites | NC, imputaciones, comunicación |
| **Tv/Comercial** | Vendedores, pedidos, relación comercial | Pedido mal pasado, error de cuenta |
| **Depósito** | Envíos, logística, mercadería | No llegó, mal estado, faltantes |
| **Compras** | Proveedores, artículos | Descripciones, fotos, precios |
| **Gerencia** | Decisiones estratégicas, escalamientos | Comunicación, otros |

### Sistemas del Negocio

<details>
<summary><strong>Ver catálogo completo de sistemas (15 sistemas)</strong></summary>

| Sistema | Categoría | Descripción |
|---------|-----------|-------------|
| Lupa | Ventas/Comercial | Catálogo y precios |
| Facturación Automática | Ventas/Comercial | Facturación de pedidos |
| Panel Operaciones Especial | Ventas/Comercial | Gestión operativa |
| Redi | Ventas/Comercial | Redistribución entre sucursales |
| App Guardado | Ventas/Comercial | Guardar pedidos/presupuestos |
| Central Habilitaciones | Ventas/Comercial | Crédito de clientes |
| Envío de Emails | Comunicación | Emails automáticos |
| Mary IA | Comunicación | Bot de WhatsApp |
| Chatwoot | Comunicación | Atención al cliente |
| Versus | Interno | Gestión operativa |
| Quantix | Interno | Gestión interna |
| Internet | Infraestructura | Conectividad |
| App Devoluciones | Logística | Gestión de devoluciones |
| App Picking | Logística | Picking en depósito |
| Flexxus | Administración | ERP administrativo |

</details>

### Prioridades

| Nivel | Tiempo Respuesta | Criterios | Palabras Clave |
|-------|------------------|-----------|----------------|
| 🔴 **Urgente** | 1h | Sistema caído, todos sin acceso | "caído", "no entra nadie", "sin internet" |
| 🟠 **Alta** | 4h | Funcionalidad degradada con workaround | "no puedo", "error", "cliente molesto" |
| 🟡 **Normal** | 24h | Problema puntual, consulta | Default si no hay señales |

---

## 🤖 Agentes

### reclamosAgent ("Sofía")

**ID**: `reclamos-agent`

**Descripción**: Agente conversacional para recolección y registro de reclamos.

#### Configuración

```typescript
{
  id: "reclamos-agent",
  name: "Agente de Reclamos",
  instructions: async ({ requestContext }) => {
    return buildSystemPrompt(userName, attachmentUrl);
  },
  model: process.env.OPENROUTER_MODEL ?? "openrouter/google/gemini-2.5-flash",
  tools: { parseClaimTemplateTool, checkDuplicateClaimTool, submitClaimTool },
  memory: new Memory({
    options: { lastMessages: 12 }
  })
}
```

#### Flujo de Conversación

1. **Recepción**: Usuario envía mensaje (saludo o problema)
2. **Construcción**: Extrae sistema, descripción, área, prioridad
3. **Validación**: Verifica descripción sólida (qué + alcance + cuándo)
4. **Resumen**: Muestra resumen formateado y pide confirmación
5. **Ejecución**: Llama a `submitClaimTool` solo con confirmación explícita

#### Ejemplo de Conversación

```
Usuario: "Hola, necesito hacer un reclamo"

Sofía: "¡Hola Juan! 👋 Contame qué problema tenés y te armo el reclamo.
        Cuanta más info me des de una, más rápido lo resolvemos —
        por ejemplo: 'Fact auto no factura al cliente 12345 desde ayer,
        le tira error de conexión'. ¿Qué pasó?"

Usuario: "El cliente 45032 no puede facturar con fact auto desde ayer, le da error"

Sofía: "Tomado 👍 ¿El error le aparece solo a ese cliente o a varios?"

Usuario: "Solo a ese cliente"

Sofía: "📋 *Resumen del reclamo:*
        • Tipo: Externo
        • Sistema: Facturación Automática
        • Área: Sistemas
        • Prioridad: Alta
        • Cliente N°: 45032
        • Motivo: Error al facturar con Fact Auto
        • Descripción: El cliente 45032 no puede facturar desde ayer,
          le tira error. Afecta solo a ese cliente.
        • 📎 Adjunto: no

        ¿Confirmo y registro?"

Usuario: "Sí, confirmo"

→ [Ejecuta submitClaimTool]

Sofía: "✅ Reclamo REC-2026-00001 registrado. El área de Sistemas fue notificada."
```

#### Plantillas de Reclamos (Fast Path)

Si el usuario ya tiene todos los datos, puede enviar una **plantilla completa** para evitar la conversación multi-turno:

**Formato Texto:**
```
📋 PLANTILLA DE RECLAMO
Tipo: Externo
Cliente N°: 45032
Sistema: Facturación Automática
Motivo: Error al facturar con Fact Auto desde ayer
Descripción: El cliente 45032 no puede facturar desde ayer a la tarde. Le tira error de conexión. Afecta solo a ese cliente.
```

**Formato JSON:**
```json
{
  "tipo_reclamo": "Externo",
  "n_cliente": "45032",
  "sistema": "Facturación Automática",
  "motivo": "Error al facturar con Fact Auto desde ayer",
  "descripcion": "El cliente 45032 no puede facturar desde ayer. Le tira error de conexión. Afecta solo a ese cliente."
}
```

**Flujo con Plantilla:**
1. Usuario envía plantilla completa
2. Sofía ejecuta `parseClaimTemplateTool` para validar campos
3. Sofía ejecuta `checkDuplicateClaimTool` para verificar duplicados
4. Si no hay duplicados → muestra resumen y pide confirmación
5. Usuario confirma → Sofía ejecuta `submitClaimTool`

> 📖 **Guía completa**: Ver [docs/PLANTILLA.md](./docs/PLANTILLA.md)

---

## 🛠️ Tools

### submitClaimTool

**ID**: `submit-claim`

**Descripción**: Registra un reclamo confirmado enviándolo al **webhook n8n** (`N8N_GUARDAR_RECLAMO_URL`). Quien implemente el flujo n8n es quien persiste en PostgreSQL u otros sistemas. Tras una respuesta exitosa con `reclamo_codigo`, se intenta ejecutar en segundo plano el workflow **postSubmitNotifications** (notificaciones opcionales).

#### Input Schema

```typescript
{
  nombre: string;                    // Nombre del usuario
  tipo_reclamo: "Interno" | "Externo";
  n_cliente: string | null;          // Obligatorio si Externo
  sistema: string;                   // Nombre exacto del sistema
  area: string;                      // Nombre exacto del área
  prioridad: "Urgente" | "Alta" | "Normal";
  motivo: string;                    // Mínimo 5 palabras
  descripcion: string;               // Qué + alcance + cuándo
}
```

#### Output Schema

```typescript
{
  success: boolean;
  reclamo_codigo?: string;           // Ej: "REC-2026-00001"
  mensaje: string;
  errores?: string[];
}
```

#### Contexto Automático

Los siguientes campos se inyectan desde `RequestContext`, no desde el LLM:

- `canal`: Fuente del reclamo (slack, chat, external)
- `creado_por_ref`: ID del usuario en el sistema origen
- `adjunto_url`: URL de adjunto si existe

### consultaEstadoTool

**ID**: `consultar-estado-reclamo`

**Descripción**: Consulta el estado de un reclamo por ID. **Implementación actual: datos mock (MVP)**; no sustituye aún una lectura real desde PostgreSQL. Está registrada en la instancia Mastra para pruebas en Studio, pero **no** forma parte de las tools del agente conversacional Sofía.

#### Input Schema

```typescript
{
  reclamoId: string;  // Ej: "REC-2026-00001"
}
```

#### Output Schema

```typescript
{
  encontrado: boolean;
  reclamoId?: string;
  titulo?: string;
  estado?: string;
  prioridad?: "CRITICA" | "ALTA" | "MEDIA" | "BAJA";
  sistemaId?: string;
  areaId?: string;
  encargado?: string;
  fechaCreacion?: string;
  fechaActualizacion?: string;
  descripcion?: string;
  historial?: Array<{ estado: string; fecha: string; nota?: string }>;
  mensaje: string;
  timestamp: string;
}
```

---

### checkDuplicateClaimTool

**ID**: `check-duplicate-claim`

**Descripción**: Verifica reclamos recientes llamando al **webhook n8n** `N8N_RECLAMOS_RECIENTES_URL`. El modelo usa los resultados para evaluar si hay duplicado semántico antes de registrar.

#### Input Schema

```typescript
{
  sistema: string;      // Nombre exacto del sistema
  area?: string;        // Área responsable (opcional)
  motivo: string;       // Motivo del reclamo a crear
  horas?: number;       // Ventana de tiempo en horas (default: 24)
}
```

#### Output Schema

```typescript
{
  encontrados: boolean;     // true si hay reclamos recientes
  reclamos: Array<{         // Lista de reclamos encontrados
    codigo: string;
    motivo: string;
    prioridad: string;
    estado: string;
    creado_por: string;
    fecha_creacion: string;
    area: string;
    sistema: string;
  }>;
  total: number;
  mensaje: string;
}
```

### parseClaimTemplateTool

**ID**: `parse-claim-template`

**Descripción**: Parsea y valida una plantilla de reclamo completa.

#### Input Schema

```typescript
{
  plantilla_texto: string;  // Texto completo de la plantilla (JSON o texto estructurado)
}
```

#### Output Schema

```typescript
{
  valida: boolean;          // true si la plantilla es válida
  datos?: {                 // Datos parseados (si es válida)
    tipo_reclamo: "Interno" | "Externo";
    n_cliente: string | null;
    sistema: string;
    area: string;
    prioridad: "Urgente" | "Alta" | "Normal";
    motivo: string;
    descripcion: string;
  };
  errores: string[];        // Lista de errores de validación
  mensaje: string;
}
```

#### Validaciones

- ✅ Campos obligatorios presentes
- ✅ Sistema/área válidos (contra config)
- ✅ Descripción sólida (qué + alcance + cuándo)
- ✅ n_cliente obligatorio si es Externo
- ✅ Motivo con mínimo 5 palabras

---

## 🌐 API REST

### POST /ingest/reclamos

Recepciona reclamos desde fuentes externas (Slack, Teams, email, etc.).

#### Request

```json
{
  "message": "Hola, tengo un problema con Flexxus",
  "conversationId": "conv-123",
  "messageId": "msg-456",
  "timestamp": "2026-03-09T10:00:00Z",
  "source": "slack",
  "reporter": {
    "id": "U001",
    "name": "Juan Pérez"
  },
  "metadata": {
    "attachmentUrl": "https://example.com/screenshot.png"
  }
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "replyText": "¡Hola Juan! 👋 Contame más sobre el problema...",
  "outcome": "conversing",
  "conversation": {
    "conversationId": "conv-123",
    "messageId": "msg-456",
    "threadId": "slack:U001",
    "resourceId": "slack:U001"
  },
  "source": {
    "name": "slack",
    "timestamp": "2026-03-09T10:00:00Z"
  },
  "claimCode": null,
  "claimData": null
}
```

#### Response (200 OK - Reclamo Registrado)

```json
{
  "success": true,
  "replyText": "✅ Reclamo REC-2026-00001 registrado...",
  "outcome": "submitted",
  "conversation": { ... },
  "source": { ... },
  "claimCode": "REC-2026-00001",
  "claimData": {
    "nombre": "Juan Pérez",
    "tipo_reclamo": "Interno",
    "sistema": "Flexxus",
    "area": "Sistemas",
    "prioridad": "Normal",
    "motivo": "Error al importar DIMEs",
    "descripcion": "..."
  }
}
```

#### Headers

| Header | Requerido | Descripción |
|--------|-----------|-------------|
| `Content-Type` | Sí | `application/json` |
| `x-ingest-secret` | Opcional | Secret si `INGEST_API_SECRET` está configurado |

### GET /health

Verifica el estado del servidor y la conexión a **PostgreSQL** (`POSTGRES_URL`). Si la variable no está definida o la base no responde, el endpoint responde `503` con `db: disconnected` (comportamiento esperado en entornos sin PG).

#### Response (200 OK)

```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": "2026-03-09T10:00:00Z"
}
```

#### Response (503 Service Unavailable)

```json
{
  "status": "error",
  "db": "disconnected",
  "timestamp": "2026-03-09T10:00:00Z"
}
```

---

## 💾 Base de Datos

### PostgreSQL (Producción)

**Schema**: `reclamos`

Este repositorio **no incluye** scripts `.sql` ni migraciones: el esquema debe existir en tu instancia (por ejemplo creado por otro equipo, por n8n o por un proceso externo). Las tablas siguientes describen el modelo esperado por la documentación de negocio.

#### Tablas Principales

**reclamos**
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL | ID interno |
| codigo | VARCHAR | Código público (REC-2026-00001) |
| canal_id | FK | Referencia a `canales` |
| creado_por_nombre | VARCHAR | Nombre del reporter |
| creado_por_ref | VARCHAR | ID del reporter en sistema origen |
| tipo | ENUM | Interno/Externo |
| area_id | FK | Referencia a `areas` |
| sistema_id | FK | Referencia a `sistemas` |
| prioridad | ENUM | Urgente/Alta/Normal |
| cliente_codigo | VARCHAR | Número de cliente (si Externo) |
| motivo | TEXT | Resumen corto |
| descripcion | TEXT | Detalle completo |
| adjunto_url | TEXT | URL de adjunto |
| estado_id | FK | Referencia a `estados` |
| created_at | TIMESTAMP | Fecha de creación |

**reclamos_eventos**
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL | ID interno |
| reclamo_id | FK | Referencia a `reclamos` |
| tipo | ENUM | cambio_estado, comentario, etc. |
| estado_id | FK | Referencia a `estados` |
| autor_nombre | VARCHAR | Autor del evento |
| contenido | TEXT | Contenido del evento |
| created_at | TIMESTAMP | Fecha del evento |

#### Tablas de Catálogo

- `canales`: slack, chat, external, teams, email
- `areas`: Sistemas, Administracion, Tv/Comercial, Deposito, Compras, Gerencia
- `sistemas`: Lupa, Facturacion Automatica, Flexxus, etc.
- `estados`: Abierto, En Progreso, En Revision, Resuelto, Cerrado, Cancelado

### LibSQL (Desarrollo)

SQLite embebido para:

- Mastra Storage (memoria conversacional)
- Persistencia de estado del agente
- Desarrollo local sin PostgreSQL

---

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Tests en modo watch (desarrollo)
npm run test:watch
```

### Tests Existentes

| Archivo | Descripción |
|---------|-------------|
| `submit-claim-tool.test.ts` | Validaciones del tool de registro |
| `parse-claim-template-tool.test.ts` | Plantillas JSON/texto |
| `procesar-ingreso-reclamo.test.ts` | Flujo de procesamiento |
| `ingest-reclamos-schema.test.ts` | Validación del schema de entrada |
| `system-prompt-builder.test.ts` | Construcción del prompt |

### Ejecutar Test Específico

```bash
npx vitest run src/mastra/tools/__tests__/submit-claim-tool.test.ts
```

---

## 🚀 Despliegue

### Docker

```bash
# Build de la imagen
docker build -t distri-reclamos-agent .

# Ejecutar contenedor
docker run -p 4111:4111 --env-file .env distri-reclamos-agent
```

### Dockerfile (Multi-stage)

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

### Variables para Producción

```bash
# Requeridas (mínimo operativo)
OPENROUTER_API_KEY=sk-or-v1-...
DATABASE_URL=file:/data/reclamos.db

# PostgreSQL (recomendado: health y stack de datos)
POSTGRES_URL=postgresql://user:pass@host:5432/reclamos

# n8n (recomendado: registro y duplicados)
N8N_GUARDAR_RECLAMO_URL=https://tu-n8n/webhook/guardar-reclamo
N8N_RECLAMOS_RECIENTES_URL=https://tu-n8n/webhook/reclamos-recientes

# Recomendadas
LOG_LEVEL=info
NODE_ENV=production
INGEST_API_SECRET=shared-secret-prod

# Opcional: notificaciones post-submit
MESSAGING_SERVICE_URL=...
MESSAGING_CHANNEL_ALIAS=...
MESSAGING_API_KEY=...
FACTURACION_NOTIFY_NUMBER=...
```

---

## 🔒 Seguridad

### Buenas Prácticas

1. **Nunca commitear `.env`**: El archivo `.env` está en `.gitignore`
2. **Rotar API keys**: Cambiar credenciales periódicamente
3. **Secrets en producción**: Usar variables de entorno del entorno, no archivos
4. **Validación de entrada**: Todos los payloads son validados con Zod
5. **Filtrado de datos sensibles**: `SensitiveDataFilter` de Mastra

### Autenticación de API

El endpoint `/ingest/reclamos` soporta autenticación opcional:

```bash
# Si INGEST_API_SECRET está configurado:
curl -X POST http://localhost:4111/ingest/reclamos \
  -H "Content-Type: application/json" \
  -H "x-ingest-secret: shared-secret" \
  -d '{"message": "..."}'
```

---

## 📚 Recursos

### Documentación

- [Mastra Documentation](https://mastra.ai/docs/)
- [Mastra Studio](https://mastra.ai/docs/getting-started/studio)
- [Agents](https://mastra.ai/docs/agents/overview)
- [Tools](https://mastra.ai/docs/agents/using-tools)
- [Memory](https://mastra.ai/docs/memory/overview)

### APIs Externas

- [OpenRouter Models](https://openrouter.ai/models)
- [ClickUp API](https://developer.clickup.com/)
- [Slack API](https://api.slack.com/)
- [Google Sheets API](https://developers.google.com/sheets/api)

### Internos

- [docs/DIAGRAMAS.md](./docs/DIAGRAMAS.md) - Diagramas de arquitectura
- [docs/ARQUITECTURA.md](./docs/ARQUITECTURA.md) - Detalles técnicos
- [docs/API.md](./docs/API.md) - Documentación completa de API
- [docs/Messaging-service-doc.md](./docs/Messaging-service-doc.md) - Messaging / WhatsApp post-submit
- [postman-collection.json](./postman-collection.json) y [postman-environment.json](./postman-environment.json) - Pruebas HTTP (Postman o compatible)

---

## 📄 Licencia

ISC (ver `package.json`). Si el proyecto adopta otra licencia, actualizá este apartado y agregá un archivo `LICENSE` en la raíz del repo.

---

**Desarrollado con ❤️ usando [Mastra](https://mastra.ai/)**
