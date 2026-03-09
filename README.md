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
- [Configuración](#-configuración)
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

Este agente procesa reclamos técnicos entrantes (vía API REST, Slack o Mastra Studio), los valida mediante un sub-agente evaluador, detecta duplicados por similitud semántica y coordina su registro en:

- **PostgreSQL**: Base de datos principal (schema `reclamos`)
- **ClickUp**: Gestión de tareas (integración pendiente)
- **Google Sheets**: Registro histórico (integración pendiente)
- **Slack**: Notificaciones al equipo (integración pendiente)

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
| **Validación Automática** | Sub-agente evaluador verifica completitud | ✅ Implementado |
| **Detección de Duplicados** | Similitud semántica entre reclamos | 🔄 Planificado |
| **Contexto Dinámico** | Configuración de áreas, sistemas y prioridades | ✅ Implementado |
| **Multi-canal** | API REST, Slack, Mastra Studio | ✅ API + Studio |
| **Memoria Conversacional** | Thread y resource para multi-turno | ✅ Implementado |
| **Consulta de Estado** | Consultar estado por ID de reclamo | ✅ Tool disponible |
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
│  │  • Tools: submitClaimTool, consultaEstadoTool            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA DE SERVICIOS                             │
├─────────────────────────────────────────────────────────────────┤
│  • procesarIngresoReclamo(): Orquesta el flujo                │
│  • buildSystemPrompt(): Construye prompt dinámico             │
│  • getPool(): Conexión PostgreSQL singleton                   │
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
- **PostgreSQL** (para producción)
- **API Key de OpenRouter** (https://openrouter.ai/keys)

### Instalación

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd distri-reclamos-agent

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env

# 4. Editar .env con tus credenciales
#    - OPENROUTER_API_KEY
#    - POSTGRES_URL (producción)
#    - DATABASE_URL (archivo local o LibSQL)
```

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
│   ├── index.ts                          # Punto de entrada Mastra
│   ├── api/
│   │   ├── health-route.ts               # GET /health
│   │   ├── ingest-reclamos-route.ts      # POST /ingest/reclamos
│   │   └── schemas/
│   │       └── ingest-reclamos-schema.ts # Validación Zod
│   ├── agents/
│   │   └── reclamos-agent.ts             # Agente "Sofía"
│   ├── config/
│   │   ├── areas.ts                      # 6 áreas responsables
│   │   ├── sistemas.ts                   # 15 sistemas del negocio
│   │   ├── prioridades.ts                # 3 niveles de prioridad
│   │   └── ejemplos.ts                   # Ejemplos de clasificación
│   ├── prompts/
│   │   └── system-prompt-builder.ts      # Constructor de prompts
│   ├── services/
│   │   ├── database.ts                   # Pool PostgreSQL
│   │   └── procesar-ingreso-reclamo.ts   # Orquestador
│   ├── tools/
│   │   ├── submit-claim-tool.ts          # Registrar reclamo
│   │   └── consulta-estado-tool.ts       # Consultar por ID
│   └── __tests__/                        # Tests unitarios
├── docs/
│   ├── DIAGRAMAS.md                      # Diagramas Mermaid
│   ├── ARQUITECTURA.md                   # Detalles técnicos
│   └── API.md                            # Documentación API
├── .env.example                          # Plantilla de entorno
├── Dockerfile                            # Contenedorización
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
| `POSTGRES_URL` | URL de PostgreSQL | `postgresql://user:pass@host:5432/reclamos` |
| `DATABASE_URL` | URL de LibSQL/SQLite | `file:./reclamos.db` |
| `LOG_LEVEL` | Nivel de logging | `info`, `debug`, `warn`, `error` |
| `NODE_ENV` | Entorno | `development`, `production` |
| `MASTRA_PORT` | Puerto del servidor | `4111` |
| `INGEST_API_SECRET` | Secret para API /ingest | `shared-secret` |

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
  name: "Agente de Reclamos - Sofía",
  instructions: async ({ requestContext }) => {
    // Dynamic instructions con userName y attachmentUrl
    return buildSystemPrompt(userName, attachmentUrl);
  },
  model: "openrouter/google/gemini-2.5-flash",
  tools: { submitClaimTool, consultaEstadoTool },
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

---

## 🛠️ Tools

### submitClaimTool

**ID**: `submit-claim`

**Descripción**: Registra un reclamo confirmado en PostgreSQL.

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

**Descripción**: Consulta el estado de un reclamo por ID.

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

Verifica el estado del servidor y conexión a base de datos.

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
# Requeridas
OPENROUTER_API_KEY=sk-or-v1-...
POSTGRES_URL=postgresql://user:pass@host:5432/reclamos
DATABASE_URL=file:/data/reclamos.db

# Recomendadas
LOG_LEVEL=info
NODE_ENV=production
INGEST_API_SECRET=shared-secret-prod
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

---

## 📄 Licencia

Apache-2.0

---

**Desarrollado con ❤️ usando [Mastra](https://mastra.ai/)**
