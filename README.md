# TriniGlass - Sistema de Gestión de Almacén de Vidrio

**TriniGlass** es una aplicación web moderna y completa para la gestión integral de almacenes de vidrio y productos afines. Combina un potente panel de control con herramientas de escaneo QR móvil, permitiendo optimizar la gestión de inventario, almacenamiento y distribución.

---

## 📋 Tabla de Contenidos

- [Características Principales](#características-principales)
- [Tecnología](#tecnología)
- [Instalación y Configuración](#instalación-y-configuración)
- [Módulos de la Aplicación](#módulos-de-la-aplicación)
- [Flujos de Trabajo](#flujos-de-trabajo)
- [Arquitectura](#arquitectura)
- [Base de Datos](#base-de-datos)
- [Roles y Permisos](#roles-y-permisos)
- [Contribución](#contribución)

---

## ✨ Características Principales

### 🏭 Gestión Integral de Almacén
- **Inventario en tiempo real**: Visualización y búsqueda avanzada de palets con filtros complejos
- **Ocupación por zonas**: Monitoreo de capacidad y ocupación de cada área del almacén
- **Alertas automáticas**: Sistema inteligente de alertas para palets con prioridad alta o vencidos
- **Asignación inteligente**: Motor de reglas personalizables para ubicación automática de palets

### 📱 Scanner QR Móvil
- **Escaneo rápido**: App adaptada para móviles con lector de códigos de barras QR
- **Verificación de ubicación**: Confirma y asigna ubicaciones en tiempo real
- **Rastreo de palets**: Seguimiento del estado de cada palet durante su transporte

### 🚚 Gestión de Flota
- **Control de camiones**: Registro y seguimiento de toda la flota
- **Estados de camión**:
  - 🟢 **Disponible**: Listo para carga
  - 🔵 **En ruta**: Transportando palets
  - 🔴 **No disponible**: Completó ruta, esperando descarga
  - 🟡 **Mantenimiento**: Fuera de servicio
- **Rutas y carga**: Creación de rutas con paradas múltiples y gestión de carga
- **Estadísticas en vivo**: Entregas completadas, camiones en ruta y duración de rutas
- **Histórico de entregas**: Registro detallado de todas las operaciones

### 📊 Dashboard Ejecutivo
- **KPIs en tiempo real**: 
  - Palets ocupados y libres
  - Días promedio en almacén
  - Prioridad alta (>30 días)
  - Peso total en almacén
  - Distribución por tipos de vidrio
- **Gráficos interactivos** con Recharts:
  - Ocupación por zona (gráfico de barras)
  - Distribución de palets (gráfico circular)
  - Prioridades de palets (donut chart)
  - Tipos de vidrio (simple vs. doble acristalamiento)
  - Entregas por día (últimos 7 días)
  - Top camiones por entregas
- **Tabla de resumen por zonas**: Estado de ocupación con indicador visual

### ⚙️ Configuración Avanzada
- **Gestión de zonas y subzonas**: Crear y administrar áreas del almacén
- **Gestión de usuarios**: Asignación de roles (operario, encargado, admin)
- **Editor de reglas**: Crear reglas personalizadas para asignación automática
- **Exportación de datos**: Descarga de información en diversos formatos

---

## 🛠️ Tecnología

### Frontend
- **React 19** - Framework UI
- **TypeScript** - Lenguaje tipado
- **Vite** - Bundler de desarrollo rápido
- **Tailwind CSS 4** - Estilos utility-first con soporte dark mode
- **React Router v7** - Navegación sin página completa
- **Recharts** - Gráficos interactivos y responsive
- **Chart.js** - Gráficos adicionales
- **Lucide React** - Iconografía moderna (577+ iconos)
- **html5-qrcode** - Escaneo de códigos QR en tiempo real

### Backend
- **Firebase** - Backend as a Service completamente gestionado
  - **Firestore** - Base de datos NoSQL con sincronización en tiempo real
  - **Firebase Auth** - Autenticación segura con email/password
  - **Firebase Admin SDK** - Operaciones del servidor

### DevOps y Progressive Web App
- **PWA (Progressive Web App)** - Instalable y funciona offline
- **Service Workers** - Caché inteligente de recursos
- **HTTPS** - Certificados SSL para desarrollo seguro

---

## 📦 Instalación y Configuración

### Requisitos Previos
- **Node.js 18+** - Entorno JavaScript
- **npm o yarn** - Gestor de paquetes
- **Cuenta Firebase** - Con Firestore habilitado

### Pasos de Instalación

#### 1. Clonar el repositorio
```bash
git clone https://github.com/RaulJimenezAyza/TriniGlass.git
cd TriniGlass
```

#### 2. Instalar dependencias
```bash
npm install
```

#### 3. Configurar variables de entorno
Crear archivo `.env` en la raíz del proyecto:
```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

#### 4. Inicializar Base de Datos
```bash
cd firebase-seed
npm install
# Coloca tu serviceAccountKey.json en firebase-seed/
node seed.js
cd ..
```

#### 5. Iniciar servidor de desarrollo
```bash
npm run dev
```

La aplicación estará disponible en `https://localhost:5173` (HTTPS para pruebas de PWA)

#### 6. Compilar para producción
```bash
npm run build
```

---

## 📱 Módulos de la Aplicación

### 1. **Panel de Control (Resumen)**
**Ruta:** `/`  
**Acceso:** Todos los usuarios

**Funcionalidad:**
- Vista ejecutiva con 9 KPIs principales
- 6 gráficos interactivos:
  - Ocupación por zona (barras)
  - Distribución de palets (pastel)
  - Distribución por prioridad (donut)
  - Tipos de vidrio (donut)
  - Entregas últimos 7 días (barras)
  - Top camiones (barras horizontales)
- Tabla de estado por zonas con indicadores de ocupación
- Estadísticas de flota en tiempo real
- Modo claro/oscuro automático

**Componentes:**
- `Resumen.tsx` - Componente principal
- `KpiCard.tsx` - Tarjetas de métricas
- **Hooks**: `useWarehouseStats()`, `useFleetStats()`

---

### 2. **Gestión de Inventario (Stock)**
**Ruta:** `/inventario`  
**Acceso:** Todos los usuarios

**Funcionalidad:**

#### Búsqueda y Filtrado
- **Búsqueda global** con debounce (400ms):
  - ID del palet
  - Cliente
  - Tipo de vidrio
  - Código de barras
  - Codificador
  - Número de línea de pedido
  - Referencia de pedido

#### Filtros Server-side (Firestore)
- Fecha de entrada (desde/hasta)
- Estado del pedido (5 opciones)
- Zona del almacén
- Codificador
- Código de barras
- Número de línea de pedido
- Referencia de línea de pedido

#### Filtros Client-side
- Cliente (búsqueda fuzzy)
- Tipo de vidrio (búsqueda fuzzy)
- Dimensiones:
  - Ancho mínimo/máximo
  - Alto mínimo/máximo
  - Grosor exacto

#### Paginación
- Seleccionable: 10, 20 o 50 resultados por página
- Navegación: Anterior/Siguiente
- Indicador de página actual

#### Funcionalidades Especiales
- Límite de 200 resultados desde Firestore
- Alerta cuando se alcanza el límite
- Panel lateral para edición de palets:
  - Cliente asignado
  - Tipo de material
  - Dimensiones
  - Ubicación
  - Estado
  - Botón para eliminar del sistema
- Tabla con scroll horizontal
- Estados con código de colores
- Limpieza rápida de todos los filtros

**Componentes:**
- `Stock.tsx` - Componente principal
- **Utilidades**: `useDebounce()` hook personalizado
- **Límite**: MAX_FIRESTORE_RESULTS = 200

---

### 3. **Almacén Visual (Warehouse)**
**Ruta:** `/almacen`  
**Acceso:** Operario, Encargado, Admin

**Funcionalidad:**

#### Visualización Espacial
- Mapa interactivo del almacén con zonas y subzonas
- Canvas para renderización eficiente
- Sistema de coordenadas basado en:
  - Zona (región principal)
  - Área/Subzona (sección dentro de zona)
  - Posición (fila + columna)

#### Gestión de Zonas
- Desplegable de selección de zona
- Ordenamiento automático por posición en el mapa
- Subzonas expandibles/colapsables
- Información de ocupación (X/Y ocupados)

#### Tarjetas de Palets
- Visualización de dos filas de tarjetas
- Código de barras del palet
- Icono según tipo de palet:
  - 📦 Individual
  - 📚 Agrupado (múltiples con mismo código)
- Indicador de días en almacén (color)
- Posición (fila/columna)
- Estados del palet:
  - 🟢 < 10 días
  - 🟡 10-20 días
  - 🟠 20-30 días
  - 🔴 > 30 días

#### Búsqueda de Palets
- Búsqueda global por:
  - ID del palet
  - Código de barras
  - Cliente
  - Número de cliente
  - Número de línea de pedido
  - Estado del pedido
  - Empresa
  - Posición
- Auto-selección si hay un único resultado
- Dropdown con resultados

#### Panel de Detalles (Sidebar)
- Información completa del palet:
  - Glass ID (código de barras)
  - Prioridad
  - Código de documento
  - Cliente
  - Dimensiones totales
  - Peso total
  - Estado del pedido
  - Referencia de pedido
  - Fecha de entrega
  - Días en almacén
  - Zona/Subzona actual
  - Posición exacta
- Lista de pedidos agrupados (si aplica)
- Acciones disponibles:
  - 🟢 **Mover**: Modal para seleccionar nueva posición
  - 🟡 **Despachar**: (placeholder)
  - 🔵 **Liberar hueco**: Sin eliminar el palet
  - 🔴 **Eliminar**: Del sistema

#### Modal de Movimiento
- Selección de zona destino
- Selección de subzona
- Listado de posiciones disponibles
- Validación de capacidad
- Confirmación visual de cambios

#### Diseños de Mapa Dinámicos
- Selección de diferentes diseños de almacén
- Activación de mapas en Firestore
- Cuadrícula visual del mapa
- Etiquetas de zonas/subzonas
- Cálculo automático de tamaño

**Componentes:**
- `Warehouse.tsx` - Componente principal (2290 líneas)
- `RuleEditor.tsx` - Editor de reglas integrado
- **Hooks**: `useMapDesigns()`
- **Servicios**: Gestión de zonas, subzonas, reglas

**Características Técnicas:**
- Parser de fechas flexible (Firestore + ISO 8601)
- Generación automática de códigos de ubicación
- Cálculo de capacidades por subzona
- Agrupación por código de barras
- Normalización de posiciones
- Gestión de batch updates en Firestore (máximo 500 por batch)

---

### 4. **Alertas**
**Ruta:** `/alertas`  
**Acceso:** Encargado, Admin

**Funcionalidad:**
- Alertas de palets con prioridad alta (>30 días)
- Alertas por ubicación
- Filtrado por severidad
- Registro de alertas históricas
- Notificaciones en tiempo real
- Marcado como resuelto
- Búsqueda y filtrado avanzado

**Componentes:**
- `Alertas.tsx`
- **Servicios**: `AlertasService`

---

### 5. **Gestión de Camiones**
**Ruta:** `/camiones`  
**Acceso:** Encargado, Admin

**Funcionalidad:**

#### Listado de Camiones
- Grid responsive (1 columna móvil, 2 tablet, 3 desktop)
- Información por tarjeta:
  - Matrícula
  - Tipo de vehículo
  - Conductor
  - Capacidad de peso y volumen
  - Estado visual con color

#### Estados de Camión
| Estado | Color | Acciones |
|--------|-------|----------|
| 🟢 Disponible | Verde | Botón "Cargar" |
| 🔵 En ruta | Azul | "Cancelar ruta" / "Finalizar ruta" |
| 🔴 No disponible | Rojo | "Marcar disponible" |
| 🟡 Mantenimiento | Ámbar | Sin acciones |

#### Filtros
- Por estado (todos, disponible, en ruta, no disponible, mantenimiento)
- Búsqueda por:
  - Matrícula
  - Conductor
  - Tipo de vehículo
- Contador de camiones por estado

#### Acciones
- **Crear nuevo camión**: Modal con formulario
- **Editar camión**: Abre panel lateral
- **Eliminar camión**: Con confirmación
- **Iniciar carga**: Redirige a `/camiones/cargar/:matricula`
- **Finalizar ruta**: Con confirmación y lista de palets
- **Cancelar ruta**: Devuelve a estado "disponible"
- **Marcar disponible**: Después de descargar

#### Real-time Updates
- Suscripción a cambios de cargas
- Actualización instantánea de palets cargados
- Sincronización de estados

**Componentes:**
- `Camiones.tsx` - Listado principal (507 líneas)
- `CamionPanel.tsx` - Edición/creación
- **Servicios**: `CamionService`, `CargaCamionService`
- **Contexto**: `useAuth()` para obtener usuario actual

---

### 6. **Carga de Camiones**
**Ruta:** `/camiones/cargar/:matricula`  
**Acceso:** Encargado, Admin

**Funcionalidad:**

#### Flujo de Carga
1. **Selección de camión** (si no viene de `/camiones`)
2. **Búsqueda de palets disponibles**
3. **Arrastrar y soltar palets**
4. **Cálculo automático** de peso y volumen
5. **Definición de ruta** con múltiples paradas
6. **Confirmación final** e inicio de ruta

#### Búsqueda de Palets
- Búsqueda avanzada con múltiples criterios:
  - Cliente
  - Estado del pedido
  - Ubicación actual
  - Tipo de vidrio
  - Dimensiones
  - Fecha
- Filtrado en tiempo real
- Mostrar palets no ubicados o disponibles

#### Carrito de Carga
- Zona visual para arrastrar palets
- Cálculo en tiempo real:
  - Peso total
  - Volumen total
  - Porcentaje de ocupación
  - Advertencia si se excede capacidad
- Palets añadidos con:
  - ID
  - Cliente
  - Dimensiones
  - Peso
  - Botón para eliminar

#### Definición de Rutas
- Crear múltiples paradas
- Por cada parada:
  - Cliente destino
  - Ubicación de entrega
  - Palets a entregar
  - Orden de entrega
- Reorden de paradas
- Eliminación de paradas
- Validación de ruta (mínimo 1 parada)

#### Confirmación Final
- Resumen de:
  - Camión seleccionado
  - Total de palets
  - Peso y volumen
  - Paradas
- Confirmación con double-check
- Inicio de ruta

**Componentes:**
- `CargaCamion.tsx` - Componente principal (500+ líneas)
- Drag & drop library integrada
- **Servicios**: `iniciarRuta()`, `getCamiones()`

---

### 7. **Scanner Móvil**
**Ruta:** Automático en dispositivos móviles  
**Acceso:** Todos

**Funcionalidad:**

#### Detección Automática
- Detecta si es móvil
- Redirige automáticamente al scanner
- En desktop → Dashboard normal
- En móvil → Scanner QR

#### Escaneo de QR
- Lector de cámara en tiempo real
- Captura de código de barras
- Decodificación automática

#### Búsqueda de Palet
- Búsqueda fuzzy del código
- Normalización de búsqueda (espacios, mayúsculas)
- Debug detallado:
  - Hex encoding del código
  - Búsqueda normalizada
  - Comparación con BD
  - Logs de coincidencias

#### Ubicación y Asignación
- Vista de mapa de ubicación
- Recomendación automática según reglas
- Confirmación de ubicación
- Asignación a zona/área/posición

#### Verificación de Ubicación
- Confirmar ubicación actual del palet
- Actualizar ubicación si cambia
- Registro de cambios

#### Estados del Palet
- ✅ Encontrado: Palet existe y tiene ubicación
- ❓ No encontrado: Código no existe
- ⏳ En tránsito: En ruta hacia cliente
- ✔️ Entregado: Ya completó su ciclo

#### Interfaz
- Header con usuario actual
- Botón de logout
- Gran área de escaneo
- Botones de acción contextuales
- Detalle emergente con información
- Mapeo visual de ubicación

**Componentes:**
- `Scanner.tsx` - Componente principal (700+ líneas)
- `QRScanner.tsx` - Lector QR
- `MobileScanner.tsx` - Wrapper móvil
- **Servicios**: `verificarPalet()`, `entregarPaletEnRuta()`
- **Utilidades**: Recomendador de ubicación, parser de fechas

**Características Técnicas:**
- Detección de dispositivo por user-agent
- html5-qrcode integrado
- Búsqueda tolerante a errores
- Caché de búsquedas
- Manejo de errores robusto

---

### 8. **Configuración**
**Ruta:** `/configuracion`  
**Acceso:** Admin

**Sub-módulos:**

#### 8.1 **Gestión de Usuarios**
**Ruta:** `/configuracion/usuarios`
- Listar todos los usuarios registrados
- Cambiar roles: operario → encargado → admin
- Asignación de permisos por rol
- Edición de información de usuario
- Activar/desactivar usuarios

#### 8.2 **Gestión de Zonas**
**Ruta:** `/configuracion` (Modal integrado)
- Crear zonas del almacén
- Crear subzonas dentro de cada zona
- Establecer capacidades máximas
- Asignar dimensiones físicas
- Reorden de zonas/subzonas
- Eliminar zonas (si no hay palets)

#### 8.3 **Editor de Reglas (Rule Engine)**
**Ruta:** Integrado en `/almacen`
- **Crear/editar/eliminar reglas** de asignación automática
- **Prioridades**: Orden de evaluación
- **Condiciones personalizables**:
  - Por cliente específico
  - Por tipo de vidrio
  - Por tamaño (rango de dimensiones)
  - Por zona preferida
  - Combinación de múltiples condiciones
- **Acciones**:
  - Asignar a zona específica
  - Asignar a subzona específica
  - Cambiar estado automáticamente
- **Modos de aplicación**:
  - A nuevos palets solamente
  - A todos los palets existentes
  - Migración de datos

**Componentes:**
- `RuleEditor.tsx` - Editor de reglas (600+ líneas)
- `Configuracion.tsx` - Panel de configuración
- `GestionUsuarios.tsx` - Gestión de usuarios
- `ZoneManager.tsx` - Gestión de zonas
- **Hooks**: `useRules()`
- **Servicios**: `RuleEngine`

---

### 9. **Login**
**Ruta:** `/login`  
**Acceso:** Usuarios sin autenticar

**Funcionalidad:**
- Autenticación con Firebase
- Email y contraseña
- Manejo robusto de errores
- Redireccionamiento automático si está autenticado
- Estilo profesional y responsive
- Modo oscuro/claro

**Componentes:**
- `Login.tsx`
- **Contexto**: `useAuth()`
- **Servicios**: Firebase Auth

---

## 🔄 Flujos de Trabajo

### Flujo 1: Entrada de Palet al Almacén

```mermaid
Palet llega → Escaneo QR (móvil) → Búsqueda en BD → 
Motor de reglas → Asignación automática → 
Actualización de ubicación → Alerta si prioritario
```

**Detalles:**
1. Operario escanea código de barras con móvil
2. Sistema busca palet en Firestore
3. Motor de reglas (RuleEngine) calcula ubicación óptima
4. Sistema asigna zona + área + posición
5. Palet marcado como "En almacén"
6. Si >30 días → Alerta automática

---

### Flujo 2: Carga de Camión para Entrega

```mermaid
Seleccionar camión → Buscar palets → 
Arrastrar a carga → Validar capacidad → 
Definir paradas → Confirmar → Iniciar ruta
```

**Detalles:**
1. Encargado en `/camiones/cargar/:matricula`
2. Selecciona palets disponibles
3. Arrastra palets a la carga
4. Sistema valida peso y volumen
5. Añade paradas de entrega
6. Confirma y inicia ruta
7. Camión marcado como "En ruta"
8. Dashboard actualiza en tiempo real

---

### Flujo 3: Entrega y Descarga

```mermaid
En ruta → Confirmar entrega → 
Palets marcados como "Entregado" → 
Finalizar ruta → Registrar histórico → 
Camión → "No disponible"
```

**Detalles:**
1. Operario en ruta confirma entrega
2. Palets se marcan como "Entregado"
3. Encargado finaliza ruta
4. Sistema registra histórico
5. Camión regresa a "No disponible"
6. Admin marca como "Disponible"
7. Histórico disponible en dashboard

---

## 🏗️ Arquitectura

### Estructura de Carpetas

```
TriniGlass/
├── src/
│   ├── components/              # Componentes React (UI)
│   │   ├── Layout.tsx           # Layout principal con sidebar
│   │   ├── Resumen.tsx          # Dashboard
│   │   ├── Stock.tsx            # Inventario
│   │   ├── Warehouse.tsx        # Almacén visual
│   │   ├── Camiones.tsx         # Flota
│   │   ├── CargaCamion.tsx      # Carga
│   │   ├── Scanner.tsx          # Scanner móvil
│   │   ├── Login.tsx            # Autenticación
│   │   ├── Alertas.tsx          # Alertas
│   │   ├── Configuracion.tsx    # Configuración
│   │   ├── GestionUsuarios.tsx  # Gestión de usuarios
│   │   ├── ZoneManager.tsx      # Gestión de zonas
│   │   ├── RuleEditor.tsx       # Editor de reglas
│   │   ├── ProtectedRoute.tsx   # Rutas protegidas
│   │   ├── RoleRoute.tsx        # Rutas por rol
│   │   ├── KpiCard.tsx          # Componente de KPI
│   │   ├── CamionPanel.tsx      # Panel de camión
│   │   └── ...
│   │
│   ├── hooks/                   # Custom React Hooks
│   │   ├── useAuth.ts           # Contexto de auth
│   │   ├── useRules.ts          # Gestión de reglas
│   │   ├── useIsMobilePhone.ts  # Detectar móvil
│   │   ├── useWarehouseStats.ts # Estadísticas
│   │   ├── useFleetStats.ts     # Estadísticas flota
│   │   └── ...
│   │
│   ├── services/                # Lógica de negocio
│   │   ├── CamionService.ts     # Operaciones de camiones
│   │   ├── CargaCamionService.ts# Operaciones de carga
│   │   ├── AlertasService.ts    # Gestión de alertas
│   │   └── ...
│   │
│   ├── utils/                   # Utilidades
│   │   ├── RuleEngine.ts        # Motor de reglas
│   │   ├── validators.ts        # Validaciones
│   │   └── ...
│   │
│   ├── context/                 # React Context
│   │   └── useAuth.ts           # Contexto de autenticación
│   │
│   ├── firebase.ts              # Configuración de Firebase
│   ├── App.tsx                  # Componente raíz
│   └── main.tsx                 # Punto de entrada
│
├── firebase-seed/               # Scripts de inicialización
│   ├── seed.js                  # Datos mock
│   └── package.json
│
├── index.html                   # HTML principal
├── package.json                 # Dependencias
├── tsconfig.json                # Configuración TypeScript
├── tailwind.config.js           # Tailwind CSS
├── vite.config.ts               # Configuración Vite
└── README.md                    # Este archivo
```

### Flujo de Datos

```
┌─────────────────────────────────────────┐
│     Firebase Firestore (Base de Datos)  │
│   (Productos, Camiones, Usuarios, etc)  │
└────────────────┬────────────────────────┘
                 │
         Real-time Listeners
        (onSnapshot, getDocs)
                 │
                 ▼
┌─────────────────────────────────────────┐
│    Custom Hooks (React Hooks)           │
│  useWarehouseStats, useRules, useAuth   │
│         (State Management)              │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│     Services (Business Logic)           │
│  CamionService, CargaCamionService      │
│     AlertasService, RuleEngine          │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│      React Components (UI)              │
│  Stock, Warehouse, Camiones, etc        │
│          + Tailwind CSS                 │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│   Browser Display (User Interface)      │
│      Responsive & Dark Mode Ready       │
└─────────────────────────────────────────┘
```

---

## 🗄️ Base de Datos (Firestore)

### Colecciones y Esquemas

#### 1. **usuarios**
```typescript
{
  uid: string;                    // ID único Firebase
  email: string;                  // Email para login
  nombre: string;                 // Nombre completo
  rol: "admin" | "encargado" | "operario";
  activo: boolean;                // Usuario activo o inactivo
  createdAt: Timestamp;           // Fecha de creación
  lastLogin?: Timestamp;          // Último acceso
}
```

#### 2. **productos** (Palets)
```typescript
{
  id: string;                          // ID único del documento
  numero_linea_pedido: string;         // Referencia del pedido
  descripcion_producido_longitud: string; // Tipo de vidrio
  longitud: number;                    // Ancho en mm
  altura: number;                      // Alto en mm
  peso_pieza_kg: number;               // Peso en kg
  apellido_cliente: string;            // Cliente
  estado_pedido: string;               // Estado actual
  subzona: string;                     // Área dentro de zona
  codigo_barra: string;                // ID del código de barras
  codigo_cliente: string;              // Código de cliente
  fecha_linea_pedido: Timestamp;       // Fecha de entrada
  fecha_entrega?: Timestamp;           // Fecha esperada de salida
  vidrio_simple: boolean;              // Tipo de vidrio
  zona?: string;                       // Zona asignada
  posicion?: string;                   // Posición exacta (Z-S-F-C)
  prioridad?: string;                  // Alta, Media, Normal
  estadoAlerta?: boolean;              // Tiene alerta activa
}
```

#### 3. **camiones**
```typescript
{
  matricula: string;           // Identificador único
  conductor: string;           // Nombre del conductor
  tipo: string;                // Tipo de vehículo
  capacidadPeso: number;       // Capacidad en kg
  capacidadVolumen: number;    // Capacidad en m³
  estado: EstadoCamion;        // disponible | en_ruta | no_disponible | mantenimiento
  createdAt: Timestamp;        // Fecha de registro
  updatedAt: Timestamp;        // Última actualización
}
```

#### 4. **cargas**
```typescript
{
  id: string;
  matricula: string;           // Camión asignado
  palets: string[];            // IDs de palets cargados
  estado: string;              // Estado de la carga
  pesoTotal: number;           // Peso total cargado
  volumenTotal: number;        // Volumen total cargado
  paradas: Array<{
    cliente: string;           // Cliente destino
    ubicacion: string;         // Dirección de entrega
    palets: string[];          // Palets para esta parada
    orden: number;             // Orden de entrega
  }>;
  fechaInicio: Timestamp;      // Cuándo comenzó la ruta
  fechaFin?: Timestamp;        // Cuándo terminó
  conductor?: string;          // Conductor asignado
}
```

#### 5. **zonas**
```typescript
{
  id: string;                  // Identificador único
  nombre: string;              // Nombre de la zona
  codigo: string;              // Código corto (CMS, ZONA_1, etc)
  descripcion?: string;        // Descripción de uso
  capacidadMaxima?: number;    // Capacidad total
  ocupacionActual: number;     // Palets actuales
  posiciones: string[];        // Lista de posiciones disponibles
}
```

#### 6. **subzonas**
```typescript
{
  id: string;
  nombre: string;              // Nombre del área (A, B, C, etc)
  zonaId: string;              // Zona padre
  capacidadMaxima?: number;    // Máximo de palets
  descripcion?: string;        // Descripción
}
```

#### 7. **reglas_asignacion** (Rules)
```typescript
{
  id: string;
  prioridad: number;           // Orden de evaluación (1 = máxima)
  cliente?: string;            // Condición: cliente específico
  tipoVidrio?: string;         // Condición: tipo de vidrio
  tamanioMin?: { ancho: number; alto: number };
  tamanioMax?: { ancho: number; alto: number };
  zonaAsignada: string;        // Acción: zona destino
  subzonaAsignada?: string;    // Acción: subzona destino
  activa: boolean;             // La regla está habilitada
  aplicarANuevos: boolean;     // Aplicar a palets nuevos
  aplicarAExistentes: boolean; // Aplicar a palets existentes
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### 8. **alertas**
```typescript
{
  id: string;
  paletId: string;             // ID del palet afectado
  tipo: "prioridad" | "ubicacion" | "vencimiento" | "capacidad";
  severidad: "alta" | "media" | "baja";
  mensaje: string;             // Texto de la alerta
  createdAt: Timestamp;        // Cuándo se generó
  resuelta: boolean;           // Si se ha atendido
  resueltoEn?: Timestamp;      // Cuándo se resolvió
  resolvedBy?: string;         // Quién la resolvió
}
```

#### 9. **mapDesigns** (Diseños de Almacén)
```typescript
{
  id: string;
  nombre: string;              // Nombre del diseño
  activo: boolean;             // Diseño actualmente en uso
  gridSize: {
    cellWidth: number;         // Ancho de celda en píxeles
    cellHeight: number;        // Alto de celda en píxeles
  };
  areas: Array<{
    id: string;
    name: string;
    x: number;                 // Posición X
    y: number;                 // Posición Y
    width: number;             // Ancho en píxeles
    height: number;            // Alto en píxeles
    col: string;               // Columna (A, B, C, etc)
    subAreas?: Array<{         // Subáreas dentro del área
      id: string;
      name: string;
      x: number;
      y: number;
      width: number;
      height: number;
      col: string;
    }>;
  }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 👥 Roles y Permisos

### Operario
- ✅ Escanear códigos QR
- ✅ Ver inventario (lectura solo)
- ✅ Ver dashboard básico
- ✅ Confirmar entregas
- ❌ Editar ubicaciones
- ❌ Gestionar usuarios

### Encargado
- ✅ Todo lo de Operario
- ✅ Editar ubicaciones de palets
- ✅ Crear y gestionar rutas
- ✅ Cargar camiones
- ✅ Finalizar entregas
- ✅ Ver histórico completo
- ❌ Gestionar usuarios
- ❌ Cambiar roles

### Admin
- ✅ Todo lo de Encargado
- ✅ Crear/editar/eliminar usuarios
- ✅ Cambiar roles de usuarios
- ✅ Gestionar zonas y subzonas
- ✅ Crear/editar reglas de asignación
- ✅ Migrar datos
- ✅ Acceso a configuración avanzada
- ✅ Exportar datos

---

## 🔐 Seguridad

### Autenticación
- **Firebase Auth**: Tokens JWT seguros
- **Contraseñas**: Hasheadas por Firebase
- **Sessions**: Gestión automática

### Autorización
- **ProtectedRoute**: Todas las rutas protegidas
- **RoleRoute**: Acceso por rol de usuario
- **Firebase Rules**: Restricciones en base de datos

### Datos
- **HTTPS**: Certificados SSL en desarrollo
- **Variables de entorno**: Claves no expuestas en el código
- **Firestore Security Rules**: Control granular de acceso

### Sesión
- **Auto-logout**: Después de inactividad
- **Token refresh**: Automático
- **CORS**: Configurado correctamente

---

## 📝 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Inicia servidor en https://localhost:5173

# Linting
npm run lint            # Analiza código con ESLint

# Compilación
npm run build           # Compila para producción
tsc -b                  # Compila TypeScript

# Preview
npm run preview         # Vista previa de compilación
```

---

## 🤝 Contribución

1. Fork el repositorio
```bash
git fork https://github.com/RaulJimenezAyza/TriniGlass.git
```

2. Crea una rama para tu feature
```bash
git checkout -b feature/AmazingFeature
```

3. Commit tus cambios
```bash
git commit -m 'Add AmazingFeature'
```

4. Push a la rama
```bash
git push origin feature/AmazingFeature
```

5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto está bajo licencia **ISC**.

---

## 👨‍💻 Autor

**Raúl Jiménez Ayza**

- GitHub: [@RaulJimenezAyza](https://github.com/RaulJimenezAyza)
- Proyecto: TriniGlass

---

## 📞 Soporte

Para reportar bugs o solicitar features:
1. Abre un issue en [GitHub Issues](https://github.com/RaulJimenezAyza/TriniGlass/issues)
2. Describe el problema/feature de forma clara
3. Incluye pasos para reproducir (si es un bug)

---

## 🔄 Changelog

### v0.0.0 (Actual - Febrero 2025)
- ✅ Sistema base de gestión de almacén
- ✅ Panel de control con 6 gráficos interactivos
- ✅ Scanner QR móvil completamente funcional
- ✅ Gestión de flota de camiones
- ✅ Sistema de reglas para asignación automática
- ✅ Gestión de usuarios y roles
- ✅ Alertas inteligentes por prioridad
- ✅ Dark mode automático
- ✅ PWA (instalable offline)
- ✅ Responsive design (móvil, tablet, desktop)

---

## 🎯 Próximas Mejoras Planeadas

- [ ] Integración con sistemas ERP
- [ ] Reportes PDF exportables
- [ ] Notificaciones push en tiempo real
- [ ] Análisis predictivo de ocupación
- [ ] GPS en tiempo real para camiones
- [ ] Código de barras dinámicos
- [ ] Integración con básculas automáticas
- [ ] Dashboard de analytics avanzado

---

**Última actualización**: Mayo 2026  
**Versión**: 0.0.0  
**Estado**: En desarrollo activo

---

