# API REST — distri-reclamos-agent

**Documentación completa de la API REST para integración con sistemas externos.**

---

## 1. Visión General

La API REST permite integrar el agente de reclamos con sistemas externos como Slack, Microsoft Teams, email u otras plataformas.

### Base URL

| Entorno | URL |
|---------|-----|
| Desarrollo | `http://localhost:4111` |
| Producción | `https://tu-dominio.com` |

### Endpoints Disponibles

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `POST` | `/ingest/reclamos` | Ingresar nuevo reclamo | Opcional |
| `GET` | `/health` | Verificar estado del servicio | No |

---

## 2. POST /ingest/reclamos

Recepciona reclamos desde fuentes externas y ejecuta el agente de IA para procesarlos.

### 2.1 Request

#### Headers

| Header | Requerido | Valor | Descripción |
|--------|-----------|-------|-------------|
| `Content-Type` | Sí | `application/json` | Tipo de contenido |
| `x-ingest-secret` | Opcional | `<secret>` | Secret si `INGEST_API_SECRET` está configurado |

#### Body Schema

```typescript
{
  // Mensaje del usuario (requerido)
  message: string;
  
  // ID de conversación (requerido)
  // Mantiene continuidad de la conversación
  conversationId: string;
  
  // ID del mensaje (requerido)
  // Único por mensaje
  messageId: string;
  
  // Timestamp opcional (ISO 8601)
  timestamp?: string;
  
  // Fuente del reclamo (default: "external")
  source?: string;
  
  // Datos del reporter (requerido)
  reporter: {
    // ID único del usuario en el sistema origen
    id: string;
    // Nombre visible del usuario
    name: string;
  };
  
  // Metadatos opcionales
  metadata?: {
    // URL de adjunto (imagen, screenshot, etc.)
    attachmentUrl?: string;
    // Otros metadatos personalizados
    [key: string]: unknown;
  };
}
```

### 2.2 Ejemplos de Request

#### Ejemplo 1: Primer mensaje (saludo)

```bash
curl -X POST http://localhost:4111/ingest/reclamos \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hola, necesito hacer un reclamo",
    "conversationId": "conv-001",
    "messageId": "msg-001",
    "source": "slack",
    "reporter": {
      "id": "U123456",
      "name": "Juan Pérez"
    }
  }'
```

#### Ejemplo 2: Problema con contexto

```bash
curl -X POST http://localhost:4111/ingest/reclamos \
  -H "Content-Type: application/json" \
  -d '{
    "message": "El cliente 45032 no puede facturar con fact auto desde ayer, le tira error de conexión",
    "conversationId": "conv-001",
    "messageId": "msg-002",
    "source": "slack",
    "reporter": {
      "id": "U123456",
      "name": "Juan Pérez"
    },
    "metadata": {
      "attachmentUrl": "https://example.com/screenshots/error.png"
    }
  }'
```

#### Ejemplo 3: Confirmación de registro

```bash
curl -X POST http://localhost:4111/ingest/reclamos \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Sí, confirmo y registro",
    "conversationId": "conv-001",
    "messageId": "msg-003",
    "source": "slack",
    "reporter": {
      "id": "U123456",
      "name": "Juan Pérez"
    }
  }'
```

### 2.3 Response

#### Response: Conversación en curso (200 OK)

Cuando el agente está recolectando datos:

```json
{
  "success": true,
  "replyText": "¡Hola Juan! 👋 Contame qué problema tenés y te armo el reclamo. Cuanta más info me des de una, más rápido lo resolvemos — por ejemplo: 'Fact auto no factura al cliente 12345 desde ayer, le tira error de conexión'. ¿Qué pasó?",
  "outcome": "conversing",
  "conversation": {
    "conversationId": "conv-001",
    "messageId": "msg-001",
    "threadId": "slack:U123456",
    "resourceId": "slack:U123456"
  },
  "source": {
    "name": "slack",
    "timestamp": "2026-03-09T10:00:00Z"
  },
  "claimCode": null,
  "claimData": null
}
```

#### Response: Reclamo registrado (200 OK)

Cuando el reclamo fue registrado exitosamente:

```json
{
  "success": true,
  "replyText": "✅ Reclamo REC-2026-00001 registrado. El área de Sistemas fue notificada.",
  "outcome": "submitted",
  "conversation": {
    "conversationId": "conv-001",
    "messageId": "msg-003",
    "threadId": "slack:U123456",
    "resourceId": "slack:U123456"
  },
  "source": {
    "name": "slack",
    "timestamp": "2026-03-09T10:05:00Z"
  },
  "claimCode": "REC-2026-00001",
  "claimData": {
    "nombre": "Juan Pérez",
    "tipo_reclamo": "Externo",
    "n_cliente": "45032",
    "sistema": "Facturacion Automatica",
    "area": "Sistemas",
    "prioridad": "Alta",
    "motivo": "Error al facturar con Fact Auto",
    "descripcion": "El cliente 45032 no puede facturar desde ayer, le tira error de conexión. Afecta solo a ese cliente."
  }
}
```

#### Response: Error de validación (400 Bad Request)

```json
{
  "success": false,
  "error": "Invalid payload",
  "details": {
    "fieldErrors": {
      "message": ["Required"],
      "reporter.id": ["Required"]
    }
  }
}
```

#### Response: Error de autenticación (401 Unauthorized)

```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing x-ingest-secret header."
}
```

#### Response: Error de procesamiento (500 Internal Server Error)

```json
{
  "success": false,
  "replyText": "Error al procesar el reclamo: Agent exploded",
  "outcome": "error",
  "conversation": {
    "conversationId": "conv-001",
    "messageId": "msg-001",
    "threadId": "slack:U123456",
    "resourceId": "slack:U123456"
  },
  "source": {
    "name": "slack",
    "timestamp": "2026-03-09T10:00:00Z"
  },
  "claimCode": null,
  "claimData": null,
  "errors": ["Agent exploded"]
}
```

### 2.4 Códigos de Estado HTTP

| Código | Significado | Cuándo |
|--------|-------------|--------|
| `200 OK` | Éxito | Request procesado correctamente |
| `400 Bad Request` | Error de validación | Payload inválido o incompleto |
| `401 Unauthorized` | Error de autenticación | Secret inválido o faltante |
| `500 Internal Server Error` | Error de procesamiento | Error interno del servidor o del agente |

### 2.5 Campos de la Respuesta

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `success` | boolean | `true` si el request fue procesado, `false` si hubo error |
| `replyText` | string | Respuesta del agente para mostrar al usuario |
| `outcome` | enum | Estado del procesamiento: `conversing`, `submitted`, `error` |
| `conversation` | object | Datos de la conversación para continuidad |
| `conversation.conversationId` | string | ID de conversación (mismo que el request) |
| `conversation.messageId` | string | ID del mensaje procesado |
| `conversation.threadId` | string | ID del hilo de memoria |
| `conversation.resourceId` | string | ID del recurso (usuario por canal) |
| `source` | object | Datos de la fuente |
| `source.name` | string | Nombre de la fuente |
| `source.timestamp` | string | Timestamp del procesamiento |
| `claimCode` | string \| null | Código del reclamo si fue registrado |
| `claimData` | object \| null | Datos del reclamo si fue registrado |
| `errors` | string[] | Lista de errores si `success: false` |

### 2.6 Outcome Values

| Valor | Significado | Cuándo |
|-------|-------------|--------|
| `conversing` | Conversación en curso | El agente está recolectando datos |
| `submitted` | Reclamo registrado | El reclamo fue guardado en DB |
| `error` | Error de procesamiento | Ocurrió un error interno |

---

## 3. GET /health

Verifica el estado del servidor y la conexión a la base de datos.

### 3.1 Request

```bash
curl http://localhost:4111/health
```

### 3.2 Response: Servicio saludable (200 OK)

```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": "2026-03-09T10:00:00Z"
}
```

### 3.3 Response: Servicio degradado (503 Service Unavailable)

```json
{
  "status": "error",
  "db": "disconnected",
  "timestamp": "2026-03-09T10:00:00Z"
}
```

### 3.4 Campos de la Respuesta

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `status` | enum | `ok` si todo funciona, `error` si hay problemas |
| `db` | enum | `connected` si hay conexión a DB, `disconnected` si no |
| `timestamp` | string | Timestamp de la verificación (ISO 8601) |

---

## 4. Integración con Slack

### 4.1 Slack App Configuration

1. Crear Slack App en https://api.slack.com/apps
2. Habilitar **Event Subscriptions**
3. Suscribirse a eventos: `message.channels`, `message.im`
4. Configurar **Request URL**: `https://tu-dominio.com/ingest/reclamos`

### 4.2 Slack Event Handler (Ejemplo Node.js)

```typescript
import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const MASTRA_URL = 'http://localhost:4111';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

// Verificar challenge de Slack
app.post('/ingest/reclamos', (req, res) => {
  if (req.body.type === 'url_verification') {
    return res.send(req.body.challenge);
  }
  
  // Procesar evento de mensaje
  handleSlackMessage(req.body);
  res.sendStatus(200);
});

async function handleSlackMessage(event: any) {
  if (event.type !== 'message' || event.subtype) return;
  
  const payload = {
    message: event.text,
    conversationId: `${event.channel}:${event.thread_ts || event.ts}`,
    messageId: event.ts,
    source: 'slack',
    reporter: {
      id: event.user,
      name: await getUserName(event.user),
    },
    metadata: {
      channel: event.channel,
      thread_ts: event.thread_ts,
    },
  };
  
  const response = await fetch(`${MASTRA_URL}/ingest/reclamos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  const result = await response.json();
  
  // Responder en Slack
  await sendSlackMessage(event.channel, result.replyText, event.thread_ts);
}

async function getUserName(userId: string): Promise<string> {
  // Obtener nombre desde Slack API
  const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
  });
  const data = await response.json();
  return data.user?.profile?.real_name || userId;
}

async function sendSlackMessage(channel: string, text: string, threadTs?: string) {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel,
      text,
      thread_ts: threadTs,
    }),
  });
}
```

---

## 5. Integración con Microsoft Teams

### 5.1 Teams Incoming Webhook

1. Crear **Incoming Webhook** en Teams
2. Obtener webhook URL
3. Configurar flujo para reenviar mensajes

### 5.2 Teams Flow (Power Automate)

```
Trigger: When a new message is posted
  ↓
Parse message text
  ↓
HTTP Request to /ingest/reclamos
  ↓
Post response to Teams channel
```

### 5.3 Teams Bot Handler (Ejemplo)

```typescript
import { ActivityHandler, MessageFactory } from 'botbuilder';

class ReclamosBot extends ActivityHandler {
  private mastraUrl = 'http://localhost:4111';
  
  async onMessage(context, next) {
    const payload = {
      message: context.activity.text,
      conversationId: context.activity.conversation.id,
      messageId: context.activity.id,
      source: 'teams',
      reporter: {
        id: context.activity.from.id,
        name: context.activity.from.name || context.activity.from.id,
      },
    };
    
    const response = await fetch(`${this.mastraUrl}/ingest/reclamos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    
    await context.sendActivity(result.replyText);
    
    await next();
  }
}
```

---

## 6. Integración con Email

### 6.1 Email Parser (Ejemplo con IMAP)

```typescript
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import fetch from 'node-fetch';

const imap = new Imap({
  user: 'reclamos@empresa.com',
  password: process.env.EMAIL_PASSWORD,
  host: 'imap.empresa.com',
  port: 993,
  tls: true,
});

imap.on('mail', async () => {
  const inbox = imap.openBox('INBOX', false);
  
  inbox.on('mail', async (msgs) => {
    msgs.on('body', async (stream) => {
      const parsed = await simpleParser(stream);
      
      const payload = {
        message: parsed.text || parsed.html,
        conversationId: `email:${parsed.messageId}`,
        messageId: parsed.messageId,
        source: 'email',
        reporter: {
          id: parsed.from?.value[0]?.address || 'unknown',
          name: parsed.from?.value[0]?.name || parsed.from?.value[0]?.address,
        },
        metadata: {
          subject: parsed.subject,
          attachments: parsed.attachments.map(a => a.content.toString('base64')),
        },
      };
      
      const response = await fetch('http://localhost:4111/ingest/reclamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const result = await response.json();
      
      // Responder por email
      await sendEmail(parsed.from?.value[0]?.address, result.replyText);
    });
  });
});
```

---

## 7. Patrones de Integración

### 7.1 Conversación Multi-turno

Para mantener continuidad en la conversación:

```typescript
// Mensaje 1
const payload1 = {
  message: "Hola, tengo un problema",
  conversationId: "conv-001",  // ← Mismo ID para toda la conversación
  messageId: "msg-001",        // ← ID único por mensaje
  // ...
};

// Mensaje 2 (misma conversación)
const payload2 = {
  message: "Es con Fact Auto",
  conversationId: "conv-001",  // ← Mismo conversationId
  messageId: "msg-002",        // ← Nuevo messageId
  // ...
};

// Mensaje 3 (confirmación)
const payload3 = {
  message: "Sí, confirmo",
  conversationId: "conv-001",  // ← Mismo conversationId
  messageId: "msg-003",        // ← Nuevo messageId
  // ...
};
```

### 7.2 Manejo de Errores

```typescript
async function sendReclamo(message: string, conversationId: string, messageId: string) {
  try {
    const response = await fetch('http://localhost:4111/ingest/reclamos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversationId,
        messageId,
        source: 'custom',
        reporter: { id: 'user-123', name: 'Usuario' },
      }),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      // Manejar error
      console.error('Error:', result.errors);
      return { error: result.errors };
    }
    
    // Procesar respuesta
    switch (result.outcome) {
      case 'conversing':
        // Mostrar replyText al usuario
        return { reply: result.replyText };
      
      case 'submitted':
        // Reclamo registrado
        return { 
          reply: result.replyText,
          claimCode: result.claimCode,
          claimData: result.claimData,
        };
      
      case 'error':
        // Error interno
        return { error: result.errors };
    }
  } catch (error) {
    // Error de red
    return { error: 'No se pudo conectar con el servidor' };
  }
}
```

### 7.3 Rate Limiting (Recomendado)

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por ventana
  message: {
    success: false,
    error: 'Too many requests',
  },
});

app.use('/ingest/reclamos', limiter);
```

---

## 8. Autenticación

### 8.1 Configurar Secret

En el servidor (.env):

```bash
INGEST_API_SECRET=shared-secret-prod
```

### 8.2 Enviar Secret en Request

```bash
curl -X POST http://localhost:4111/ingest/reclamos \
  -H "Content-Type: application/json" \
  -H "x-ingest-secret: shared-secret-prod" \
  -d '{...}'
```

### 8.3 Middleware de Autenticación

El middleware verifica el secret:

```typescript
// Si INGEST_API_SECRET está configurado:
// - Request sin header → 401 Unauthorized
// - Request con header inválido → 401 Unauthorized
// - Request con header válido → Procesar normalmente

// Si INGEST_API_SECRET NO está configurado:
// - Todos los requests son procesados sin autenticación
```

---

## 9. Testing

### 9.1 Health Check

```bash
curl http://localhost:4111/health
# Expected: {"status":"ok","db":"connected","timestamp":"..."}
```

### 9.2 Primer Mensaje

```bash
curl -X POST http://localhost:4111/ingest/reclamos \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hola, necesito ayuda",
    "conversationId": "test-001",
    "messageId": "msg-001",
    "reporter": { "id": "test-user", "name": "Test User" }
  }'
```

### 9.3 Conversación Completa

```bash
# Mensaje 1: Saludo
curl -X POST http://localhost:4111/ingest/reclamos \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola","conversationId":"test-001","messageId":"msg-001","reporter":{"id":"test-user","name":"Test"}}'

# Mensaje 2: Problema
curl -X POST http://localhost:4111/ingest/reclamos \
  -H "Content-Type: application/json" \
  -d '{"message":"Flexxus tira error al importar DIMEs","conversationId":"test-001","messageId":"msg-002","reporter":{"id":"test-user","name":"Test"}}'

# Mensaje 3: Alcance
curl -X POST http://localhost:4111/ingest/reclamos \
  -H "Content-Type: application/json" \
  -d '{"message":"Solo me pasa a mí","conversationId":"test-001","messageId":"msg-003","reporter":{"id":"test-user","name":"Test"}}'

# Mensaje 4: Confirmación
curl -X POST http://localhost:4111/ingest/reclamos \
  -H "Content-Type: application/json" \
  -d '{"message":"Sí, confirmo","conversationId":"test-001","messageId":"msg-004","reporter":{"id":"test-user","name":"Test"}}'
```

---

## 10. Consideraciones de Producción

### 10.1 Timeouts

Configurar timeout adecuado para la IA:

```typescript
// El agente puede tardar varios segundos
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(30000), // 30 segundos
});
```

### 10.2 Reintentos

Implementar retry con backoff exponencial:

```typescript
async function fetchWithRetry(url: string, options: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // Backoff exponencial
    }
  }
}
```

### 10.3 Logging

Loggear requests y responses para debugging:

```typescript
console.log('Ingest request:', {
  conversationId: payload.conversationId,
  messageId: payload.messageId,
  source: payload.source,
  messageLength: payload.message.length,
});

console.log('Ingest response:', {
  success: result.success,
  outcome: result.outcome,
  claimCode: result.claimCode,
});
```

### 10.4 Monitoreo

Métricas recomendadas:

- **Latencia promedio**: Tiempo de respuesta del agente
- **Tasa de éxito**: Porcentaje de requests exitosos
- **Tasa de registro**: Porcentaje que resulta en `submitted`
- **Errores por tipo**: Validación, agente, DB

---

## 11. Schema de Validación (Zod)

```typescript
// src/mastra/api/schemas/ingest-reclamos-schema.ts
import { z } from "zod";

export const reporterSchema = z.object({
  id: z.string().min(1, "reporter.id is required"),
  name: z.string().min(1, "reporter.name is required"),
});

export const ingestReclamoSchema = z.object({
  message: z.string().min(1, "message is required"),
  conversationId: z.string().min(1, "conversationId is required"),
  messageId: z.string().min(1, "messageId is required"),
  timestamp: z.string().min(1).optional(),
  source: z.string().min(1).default("external"),
  reporter: reporterSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ingestReclamoResponseSchema = z.object({
  success: z.boolean(),
  replyText: z.string(),
  outcome: z.enum(["conversing", "submitted", "error"]),
  conversation: z.object({
    conversationId: z.string(),
    messageId: z.string(),
    threadId: z.string(),
    resourceId: z.string(),
  }),
  source: z.object({
    name: z.string(),
    timestamp: z.string(),
  }),
  claimCode: z.string().nullable(),
  claimData: z.record(z.string(), z.unknown()).nullable(),
  errors: z.array(z.string()).optional(),
});
```

---

## 12. Referencias

- [OpenAPI Specification](https://swagger.io/specification/)
- [Zod Documentation](https://zod.dev/)
- [Mastra API Routes](https://mastra.ai/docs/server/api-routes)

---

**Documento mantenido por el equipo de desarrollo**
