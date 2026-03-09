# Diagramas del Agente de Reclamos Técnicos — "Sofía"

Este documento contiene diagramas que ilustran la arquitectura, flujos y componentes del sistema de gestión de reclamos técnicos.

**Última actualización**: Marzo 2026

---

## 1. Diagrama de Flujo Principal

```mermaid
flowchart TD
    A[📨 Mensaje de Entrada<br/>API/Slack/Mastra Studio] --> B[🧠 reclamosAgent<br/>Sofía]

    B --> C[📋 Construir Contexto<br/>RequestContext: userName,<br/>attachmentUrl, canal, creado_por_ref]

    C --> D[💬 Conversación Natural<br/>Extraer: tipo, sistema, área,<br/>prioridad, motivo, descripción]

    D --> E{¿Datos<br/>Completos?}

    E -->|❌ NO| F[🗣️ Preguntar al Usuario<br/>Faltan datos específicos]
    F --> D

    E -->|✅ SÍ| G[📝 Mostrar Resumen<br/>Formato estandarizado]

    G --> H{¿Confirmación<br/>Explícita?}

    H -->|❌ NO| I[⏸️ Esperar Confirmación<br/>No ejecutar tool]
    I --> H

    H -->|✅ SÍ| J[🔧 Ejecutar<br/>submitClaimTool]

    J --> K{¿Éxito?}

    K -->|❌ ERROR| L[📝 Informar Error<br/>Leer campo 'errores'<br/>Pedir datos faltantes]
    L --> D

    K -->|✅ ÉXITO| M[✅ Responder al Usuario<br/>Código de reclamo<br/>Área notificada]

    M --> N[🏁 Fin]

    style A fill:#3B82F6,color:#fff
    style B fill:#8B5CF6,color:#fff
    style J fill:#10B981,color:#fff
    style M fill:#22c55e,color:#fff
    style K fill:#F59E0B,color:#fff
```

---

## 2. Arquitectura del Sistema

```mermaid
graph TB
    subgraph "🎯 Capa de Entrada"
        A1[Mastra Studio<br/>localhost:4111]
        A2[API REST<br/>/ingest/reclamos]
        A3[Slack Webhook<br/>Fase 2]
    end

    subgraph "🤷 Agente Principal"
        D[reclamosAgent<br/>Sofía]
    end

    subgraph "📚 Configuración Dinámica"
        C1[areas.ts<br/>6 Áreas]
        C2[sistemas.ts<br/>15 Sistemas]
        C3[prioridades.ts<br/>3 Niveles]
        C4[ejemplos.ts<br/>Ejemplos clasificación]
    end

    subgraph "🛠️ Tools"
        T1[submitClaimTool<br/>INSERT PostgreSQL]
        T2[consultaEstadoTool<br/>SELECT por ID]
    end

    subgraph "🔧 Servicios"
        S1[procesarIngresoReclamo<br/>Orquestador]
        S2[buildSystemPrompt<br/>Prompt dinámico]
        S3[getPool<br/>PostgreSQL singleton]
    end

    subgraph "💾 Persistencia"
        P1[PostgreSQL<br/>schema: reclamos]
        P2[LibSQL<br/>Mastra Storage]
        P3[Memory<br/>Thread + Resource]
    end

    subgraph "🔌 Servicios Externos"
        E1[OpenRouter API<br/>gemini-2.5-flash]
        E2[ClickUp API<br/>Pendiente]
        E3[Google Sheets API<br/>Pendiente]
        E4[Slack API<br/>Pendiente]
    end

    A1 --> D
    A2 --> D
    A3 --> D

    D --> C1
    D --> C2
    D --> C3
    D --> C4

    D --> T1
    D --> T2

    D --> S1
    D --> S2

    S1 --> S3
    T1 --> S3
    T1 --> P1
    T2 --> S3
    T2 --> P1

    D --> P2
    D --> P3

    D --> E1
    T2 -.-> E2
    T2 -.-> E3
    T2 -.-> E4

    style D fill:#8B5CF6,color:#fff
    style T1 fill:#10B981,color:#fff
    style P1 fill:#3B82F6,color:#fff
```

---

## 3. Diagrama de Secuencia — Registro de Reclamo

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuario
    participant API as API /ingest
    participant SOFIA as reclamosAgent<br/>Sofía
    participant MEM as Memory
    participant DB as PostgreSQL
    participant CTX as RequestContext

    U->>API: POST /ingest/reclamos<br/>{message, reporter, ...}
    
    API->>CTX: Crear contexto<br/>userName, canal,<br/>creado_por_ref, adjunto_url
    
    API->>SOFIA: generate message<br/>maxSteps: 6<br/>memory: thread/resource
    
    SOFIA->>MEM: Cargar últimos 12 mensajes
    
    SOFIA->>SOFIA: Construir respuesta<br/>buildSystemPrompt + contexto
    
    SOFIA-->>U: "¡Hola! Contame el problema..."
    
    U->>API: "Flexxus tira error al<br/>importar DIMEs"
    
    API->>SOFIA: generate message
    
    SOFIA->>SOFIA: Detectar:<br/>tipo=Interno<br/>sistema=Flexxus<br/>área=Sistemas
    
    SOFIA-->>U: "¿Te pasa solo a vos<br/>o a otros también?"
    
    U->>API: "Solo a mí, desde hoy"
    
    API->>SOFIA: generate message
    
    SOFIA->>SOFIA: Descripción sólida:<br/>✓ Qué pasó<br/>✓ Alcance<br/>✓ Desde cuándo
    
    SOFIA-->>U: 📋 Resumen del reclamo:<br/>• Tipo: Interno<br/>• Sistema: Flexxus<br/>• Área: Sistemas<br/>• Prioridad: Normal<br/>• Motivo: Error al importar<br/>• Descripción: ...<br/><br/>¿Confirmo y registro?
    
    U->>API: "Sí, confirmo"
    
    API->>SOFIA: generate message
    
    SOFIA->>CTX: Obtener datos de contexto
    
    SOFIA->>SOFIA: Ejecutar<br/>submitClaimTool
    
    SOFIA->>DB: INSERT INTO reclamos<br/>VALUES canal_id, tipo,<br/>area_id, sistema_id, ...
    
    DB-->>SOFIA: RETURNING id, codigo<br/>REC-2026-00001
    
    SOFIA->>DB: INSERT INTO reclamos_eventos<br/>tipo: cambio_estado
    
    DB-->>SOFIA: Evento creado
    
    SOFIA-->>U: ✅ Reclamo REC-2026-00001<br/>registrado. El área de<br/>Sistemas fue notificada.
    
    SOFIA-->>API: {text, steps, ...}
    
    API-->>U: Response JSON<br/>outcome: submitted<br/>claimCode: REC-2026-00001
```

---

## 4. Diagrama de Estados del Reclamo

```mermaid
stateDiagram-v2
    [*] --> ABIERTO: INSERT en reclamos<br/>estado_id = 'Abierto'

    ABIERTO --> EN_PROGRESO: Asignar encargado
    ABIERTO --> CANCELADO: Rechazar por<br/>información insuficiente

    EN_PROGRESO --> EN_REVISION: Solicitar revisión<br/>de solución
    EN_PROGRESO --> RESUELTO: Completar solución

    EN_REVISION --> EN_PROGRESO: Requiere más trabajo
    EN_REVISION --> RESUELTO: Aprobado en revisión

    RESUELTO --> CERRADO: Confirmación del usuario<br/>48h timeout
    RESUELTO --> EN_PROGRESO: Reabierto por usuario

    CERRADO --> [*]
    CANCELADO --> [*]

    note right of ABIERTO
        Estado inicial
        Creado vía submitClaimTool
        Tiempo máx: según prioridad
    end note

    note right of EN_PROGRESO
        Encargado trabajando
        Actualizaciones en reclamos_eventos
    end note

    note right of EN_REVISION
        Validando solución
        Control de calidad
    end note

    note right of RESUELTO
        Esperando confirmación
        48h para cerrar automáticamente
    end note

    note right of CERRADO
        Reclamo finalizado
        Archivado en histórico
    end note

    style ABIERTO fill:#3B82F6,color:#fff
    style EN_PROGRESO fill:#F59E0B,color:#fff
    style EN_REVISION fill:#8B5CF6,color:#fff
    style RESUELTO fill:#10B981,color:#fff
    style CERRADO fill:#6B7280,color:#fff
    style CANCELADO fill:#EF4444,color:#fff
```

---

## 5. Diagrama de Componentes

```mermaid
graph LR
    subgraph "📦 Módulo de Configuración"
        A[areas.ts<br/>6 áreas]
        B[sistemas.ts<br/>15 sistemas]
        C[prioridades.ts<br/>3 niveles]
        D[ejemplos.ts<br/>5 ejemplos]
    end

    subgraph "🧠 Módulo de Agentes"
        E[reclamos-agent.ts<br/>Sofía]
    end

    subgraph "🛠️ Módulo de Tools"
        F[submit-claim-tool.ts<br/>INSERT PostgreSQL]
        G[consulta-estado-tool.ts<br/>SELECT por ID]
    end

    subgraph "🔧 Módulo de Servicios"
        H[database.ts<br/>Pool singleton]
        I[procesar-ingreso-reclamo.ts<br/>Orquestador]
    end

    subgraph "🌐 Módulo de API"
        J[ingest-reclamos-route.ts<br/>POST /ingest/reclamos]
        K[health-route.ts<br/>GET /health]
    end

    subgraph "📐 Módulo de Schemas"
        L[ingest-reclamos-schema.ts<br/>Zod schemas]
    end

    subgraph "💬 Módulo de Prompts"
        M[system-prompt-builder.ts<br/>Constructor dinámico]
    end

    subgraph "🔧 Módulo Core"
        N[index.ts<br/>Registro Mastra]
        O[Memory<br/>Semantic Recall]
        P[LibSQLStore<br/>Persistencia]
    end

    A --> M
    B --> M
    C --> M
    D --> M

    M --> E

    E --> F
    E --> G

    I --> E
    I --> H
    I --> L

    J --> I
    J --> L
    K --> H

    N --> E
    N --> F
    N --> G
    N --> J
    N --> K

    O --> E
    P --> N

    style E fill:#8B5CF6,color:#fff
    style F fill:#10B981,color:#fff
    style J fill:#3B82F6,color:#fff
    style N fill:#6B7280,color:#fff
```

---

## 6. Flujo de Construcción de Descripción Sólida

```mermaid
flowchart TD
    A[Mensaje del Usuario] --> B{¿Contiene<br/>descripción?}

    B -->|❌ NO| C[RECHAZO<br/>Pedir descripción]
    B -->|✅ SÍ| D{¿Responde<br/>QUÉ pasó?}

    D -->|❌ NO| E[RECHAZO<br/>Preguntar qué pasó]
    D -->|✅ SÍ| F{¿Responde<br/>ALCANCE?<br/>todos/puntual}

    F -->|❌ NO| G[RECHAZO<br/>Preguntar alcance]
    F -->|✅ SÍ| H{¿Responde<br/>DESDE CUÁNDO?}

    H -->|❌ NO| I[RECHAZO<br/>Preguntar cuándo]
    H -->|✅ SÍ| J[APROBADO<br/>✅ Descripción Sólida]

    C --> K[Continuar conversación]
    E --> K
    G --> K
    I --> K

    style J fill:#22c55e,color:#fff
    style C fill:#F59E0B,color:#fff
    style E fill:#F59E0B,color:#fff
    style G fill:#F59E0B,color:#fff
    style I fill:#F59E0B,color:#fff
```

---

## 7. Arquitectura de RequestContext

```mermaid
flowchart TB
    A[Payload de Entrada<br/>POST /ingest/reclamos] --> B[Extraer Campos]

    B --> C1[reporter.name<br/>→ userName]
    B --> C2[reporter.id<br/>→ creado_por_ref]
    B --> C3[source<br/>→ canal]
    B --> C4[metadata.attachmentUrl<br/>→ adjunto_url]

    C1 --> D[RequestContext<br/>Map<string, unknown>]
    C2 --> D
    C3 --> D
    C4 --> D

    D --> E[reclamosAgent.generate]

    E --> F[buildSystemPrompt<br/>userName, attachmentUrl]

    E --> G[submitClaimTool.execute]

    G --> H[Obtener de RequestContext:<br/>canal, creado_por_ref, adjunto_url]

    H --> I[INSERT en PostgreSQL<br/>con datos completos]

    style D fill:#8B5CF6,color:#fff
    style G fill:#10B981,color:#fff
    style I fill:#3B82F6,color:#fff
```

---

## 8. Diagrama de Despliegue

```mermaid
graph TB
    subgraph "🖥️ Desarrollo Local"
        A1[Mastra Studio<br/>localhost:4111]
        A2[.env<br/>Variables locales]
        A3[reclamos.db<br/>SQLite local]
        A4[PostgreSQL local<br/>docker-compose]
    end

    subgraph "☁️ Producción"
        B1[Docker Container<br/>Node.js 22]
        B2[PostgreSQL<br/>Servidor remoto]
        B3[LibSQL<br/>Archivo en volumen]
        B4[OpenRouter API<br/>Modelos IA]
    end

    subgraph "🔌 Integraciones Futuras"
        C1[ClickUp API<br/>Gestión de tareas]
        C2[Google Sheets API<br/>Registro histórico]
        C3[Slack API<br/>Notificaciones]
    end

    A1 --> A4
    A1 --> B4

    B1 --> B2
    B1 --> B3
    B1 --> B4

    B1 -.-> C1
    B1 -.-> C2
    B1 -.-> C3

    style A1 fill:#3B82F6,color:#fff
    style B1 fill:#10B981,color:#fff
    style B2 fill:#3B82F6,color:#fff
    style B4 fill:#8B5CF6,color:#fff
```

---

## 9. Matriz de Decisión de Prioridad

```mermaid
flowchart LR
    A[Analizar Texto<br/>del Mensaje] --> B{¿Palabras<br/>URGENTES?}

    B -->|caído, caido,<br/>no entra nadie,<br/>todos sin acceso,<br/>sin internet| C[Prioridad: Urgente<br/>⏱️ 1h respuesta]

    B -->|❌ NO| D{¿Palabras<br/>ALTAS?}

    D -->|no puedo, error,<br/>falla, no carga,<br/>cliente molesto,<br/>no funciona| E[Prioridad: Alta<br/>⏱️ 4h respuesta]

    D -->|❌ NO| F[Prioridad: Normal<br/>⏱️ 24h respuesta<br/>Default]

    style C fill:#dc2626,color:#fff
    style E fill:#ea580c,color:#fff
    style F fill:#16a34a,color:#fff
```

---

## 10. Timeline de Procesamiento

```mermaid
gantt
    title Timeline de Procesamiento de Reclamo
    dateFormat X
    axisFormat %L ms

    section Recepción
    Recepción del Mensaje : 0, 50
    Parseo y Validación : 50, 100
    Crear RequestContext : 100, 150

    section Conversación
    Cargar Memoria : 150, 250
    Generar Respuesta IA : 250, 1500
    Enviar al Usuario : 1500, 1600

    section Confirmación
    Esperar Respuesta : 1600, 5000
    Validar Confirmación : 5000, 5100

    section Registro
    Ejecutar submitClaimTool : 5100, 5200
    INSERT en PostgreSQL : 5200, 5400
    INSERT evento : 5400, 5500

    section Respuesta
    Generar Confirmación : 5500, 5600
    Enviar al Usuario : 5600, 5700

    section Total
    Tiempo Total : 0, 5700
```

---

## 11. Flujo de Memoria Conversacional

```mermaid
flowchart TB
    A[Usuario envía mensaje] --> B[API /ingest/reclamos]

    B --> C[Generar threadId<br/>conversationId]

    B --> D[Generar resourceId<br/>source:reporter.id]

    C --> E[Memory.getThread<br/>threadId, resourceId]

    D --> E

    E --> F{¿Existe thread?}

    F -->|❌ NO| G[Crear nuevo thread]
    F -->|✅ SÍ| H[Cargar últimos 12 mensajes]

    G --> I[Guardar en LibSQL]
    H --> I

    I --> J[reclamosAgent.generate<br/>Con contexto completo]

    J --> K[Obtener respuesta del LLM]

    K --> L[Memory.addMessages<br/>Agregar intercambio]

    L --> M[Actualizar LibSQL]

    M --> N[Responder al usuario]

    style E fill:#8B5CF6,color:#fff
    style J fill:#8B5CF6,color:#fff
    style L fill:#3B82F6,color:#fff
```

---

## 12. Arquitectura de Base de Datos

```mermaid
erDiagram
    RECLAMOS ||--o{ RECLAMOS_EVENTOS : tiene
    RECLAMOS }|--|| CANALES : "se origina en"
    RECLAMOS }|--|| AREAS : "responsable"
    RECLAMOS }|--|| SISTEMAS : "afectado"
    RECLAMOS }|--|| ESTADOS : "estado actual"

    RECLAMOS {
        int id PK
        varchar codigo UK
        int canal_id FK
        varchar creado_por_nombre
        varchar creado_por_ref
        enum tipo "Interno|Externo"
        int area_id FK
        int sistema_id FK
        enum prioridad "Urgente|Alta|Normal"
        varchar cliente_codigo
        text motivo
        text descripcion
        text adjunto_url
        int estado_id FK
        timestamp created_at
    }

    RECLAMOS_EVENTOS {
        int id PK
        int reclamo_id FK
        enum tipo "cambio_estado|comentario"
        int estado_id FK
        varchar autor_nombre
        text contenido
        timestamp created_at
    }

    CANALES {
        int id PK
        varchar nombre UK "slack|chat|external"
    }

    AREAS {
        int id PK
        varchar nombre UK
        varchar descripcion
    }

    SISTEMAS {
        int id PK
        varchar nombre UK
        varchar categoria
    }

    ESTADOS {
        int id PK
        varchar nombre UK "Abierto|En Progreso|..."
    }
```

---

## Leyenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Aprobado / Exitoso |
| ❌ | Rechazado / Error |
| ⚠️ | Advertencia / Atención |
| 📋 | Construcción/Consulta |
| 🔍 | Búsqueda/Análisis |
| 🚀 | Ejecución/Acción |
| 💬 | Comunicación |
| 📊 | Registro/Datos |
| 📌 | Tarea/Asignación |
| 🧠 | IA/Procesamiento |
| 📚 | Configuración/Contexto |
| 💾 | Persistencia/Storage |
| 🌐 | API/HTTP |

---

## Historial de Cambios

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-03-09 | 2.0 | Actualización completa: arquitectura Mastra, PostgreSQL, API REST |
| 2024-XX-XX | 1.0 | Versión inicial con mocks |
