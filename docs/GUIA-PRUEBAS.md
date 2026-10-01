# Guía para probar el sistema

Documento de arranque y recorrido funcional. No hace falta conocer el código:
seguí los pasos en orden y verificá lo que dice la columna **Qué tenés que ver**.

---

## 1. Antes de empezar

El sistema son **tres cosas**. Si una no está arriba, algo va a fallar:

| Qué | Puerto | Cómo se levanta |
|-----|--------|-----------------|
| Base de datos (PostgreSQL) | 5432 | `docker compose up -d postgres` |
| API (backend) | 3000 | `cd backend` → `pnpm run dev` |
| Pantallas (frontend) | 5173 | `cd frontend` → `pnpm dev` |

Verificá que todo responde:

```powershell
# Base y API
curl http://localhost:3000/health
# debe responder: {"status":"ok","database":"connected"}

# Pantallas
curl -o NUL -w "%{http_code}" http://localhost:5173/
# debe responder: 200
```

> **Si `docker` responde que no encuentra el demonio**, Docker Desktop está
> apagado. Abrilo y esperá unos segundos.

---

## 2. Credenciales

| Rol | Correo | Contraseña | Para qué |
|-----|--------|-----------|----------|
| Administrador | `admin@disprova.local` | `Admin123!` | Todo el panel |
| Vendedor | el que crees en Usuarios | la que le pongas | Su ruta y cobros |

El correo del admin ya viene escrito en el formulario, así que solo tecleás la
contraseña.

> **Ojo con esto:** si le errás a la contraseña 10 veces seguidas, la API
> devuelve `429` y te bloquea 15 minutos. Es a propósito (frena a quien
> adivina contraseñas), pero mientras aprendés es molesto. La pantalla te dice
> cuántos minutos faltan. Para desbloquearte de inmediato, reiniciá el backend
> en la terminal donde corre `pnpm run dev` con `Ctrl+C` y volvé a lanzarlo.

---

## 3. Escenario de recorrido

### Paso 1 — Ingreso

1. Abrí <http://localhost:5173>. Vas a ver la intro de marca y el login.
2. Entrá con `admin@disprova.local` / `Admin123!`.

**Qué tenés que ver:** el logo "DISPROVA GyG" en rojo y negro, la barra lateral
con los módulos agrupados y tu nombre con iniciales abajo a la izquierda.

> La intro de marca solo aparece **una vez por pestaña**. Para verla otra vez,
> abrí una pestaña nueva.

### Paso 2 — Panel del día (`Inicio`)

**Qué tenés que ver:** cuatro tarjetas (vendido hoy, cobrado hoy, saldos por
cobrar, más de 60 días) y tres tablas.

> **Los saldos van a salir en 0.** Es normal: la base no tiene movimientos de
> cartera todavía. Lo cargamos en el paso 7.

### Paso 3 — Catálogo (lo más fácil de verificar)

1. Andá a **Productos**.
2. Filtrá por categoría o buscá por nombre/SKU.
3. Entrá a un producto y cambiale el precio en la lista **Lista general**.
4. Creá un producto nuevo con una imagen.

**Qué tenés que ver:** la tabla con bordes suaves, el precio en rojo de marca y
que los cambios se guarden al volver atrás.

### Paso 4 — Pedidos (el módulo central)

**Opción A — ver los que ya existen**
1. Andá a **Pedidos**. Hay más de 500 de prueba.
2. Filtrá por estado: `borrador`, `confirmado`, `entregado_parcial`, `entregado`,
   `cancelado`.
3. Abrí uno y revisá su detalle.

**Opción B — crear uno como vendedor (recomendado)**
1. En **Usuarios** creá un vendedor y asignale una zona.
2. Abrí **Mi ruta** (el botón con borde dorado en la barra lateral).
3. Elegí un cliente, agregá productos, confirmá el pedido.
4. Volvé al panel y buscalo en **Pedidos** → debería estar en `confirmado`.
5. Andá a **Entregas** y marcá todo como entregado.

**Qué tenés que ver:** el estado del pedido cambia de `confirmado` a
`entregado_parcial` y luego a `entregado`. El stock baja en **Inventario**.

### Paso 5 — Inventario y lotes

1. Andá a **Inventario**.
2. Entrá al kardex de un producto controlado (un medicamento).
3. Revisá lote, vencimiento y cantidad.

**Qué tenés que ver:** los lotes se ordenan por **primero el que vence antes**
(FEFO). Un lote ya vencido se rechaza con el error `BATCH_EXPIRED`.

### Paso 6 — Clientes y zonas

1. **Clientes** → creá uno nuevo con su contacto.
2. Asignale una zona.
3. Abrí su detalle y generá un **enlace de catálogo** para él.

**Qué tenés que ver:** el enlace copia un token largo. Abrilo en otra pestaña:
es la tienda pública del cliente, con la animación de marca y la intro de video.

### Paso 7 — Cartera (saldo inicial)

Los clientes nacen con saldo 0. La deuda real se carga con un movimiento de
tipo `apertura` en el libro mayor, para que el saldo se explique movimiento por
movimiento.

Primero **simulá** (no escribe nada):

```powershell
curl -X POST http://localhost:3000/api/account/opening-balances `
  -H "Authorization: Bearer TU_TOKEN" -H "Content-Type: application/json" `
  -d '{"corte":"corte-prueba-1","modo":"simulacion","items":[{"clientId":1,"monto":"1250.00"}]}'
```

> **Cómo conseguir el token:** en el navegador, `F12` → pestaña *Application* →
> *Local Storage* → copiá el `accessToken`.

Si el cuadre está bien, repetí con `"modo":"commit"`. Después entrá a
**Cobranza** y verificá que el saldo y la antigüedad aparezcan.

> El `corte` solo se admite una vez. Si te equivocás de monto, creá otro corte
> con otro nombre; no repitas el mismo.


### Paso 8 — Caja

1. Entrá a **Mi ruta** → **Caja** y abrí una sesión.
2. Registrá un gasto.
3. Volvé al panel → **Cajas**: la sesión figura abierta y el total cuadra.

**Qué tenés que ver:** el total de la sesión coincide con la suma de
gastos + ventas registradas.

### Paso 9 — Facturación y devoluciones

1. Andá a un pedido entregado y emití su **factura**.
2. Creá una **devolución** devolviendo un producto.

**Qué tenés que ver:** la factura queda en estado `pendiente_certificacion` y la
devolución devuelve el stock al inventario.

### Paso 10 — Mensajería

1. **Mensajería** → creá una plantilla con una variable (`{{nombre}}`).
2. Generá un enlace de pedido y probá el envío.

**Qué tenés que ver:** aparece un enlace de WhatsApp. Ojo: el modo por defecto
**no** manda mensajes desde el servidor, solo arma el enlace — es lo esperado,
no es un error.

---

## 3 bis. La ruta de campo (el módulo del vendedor)

Es la pantalla que más cambió. **No hace falta que hoy haya ruta programada**:
entrás igual por la URL.

| Qué querés ver | Dónde |
|----------------|-------|
| Ruta del día | <http://localhost:5173/ruta> |
| Pedido con fotos por categoría | <http://localhost:5173/ruta/pedido/1> |
| Entregas | <http://localhost:5173/ruta/entregas> |
| Caja del vendedor | <http://localhost:5173/ruta/caja> |
| Cobro | <http://localhost:5173/ruta/cobro/1> |

**Qué tenés que ver:**

1. En todas las pantallas hay un botón **Panel** arriba a la derecha (en
   computadora, un menú lateral con **Volver al panel**). Desde la ruta se
   vuelve a la administración sin cerrar sesión. Al revés también: en el panel,
   el menú **Operación → Ruta de campo** abre la ruta.
2. **Pedido**: se abre por **categorías**, no por un campo de texto. Cada
   producto es una tarjeta con su **foto**, su precio y un botón **+**.
3. Si el producto se vende en varias presentaciones (fardo, media docena,
   docena), la tarjeta trae un **desplegable** con las presentaciones y el `+`
   suma sobre la que esté elegida: `+`, `+`, `+` = tres.
4. En el teléfono el total vive en una **barra fija abajo**; tocás y se abre la
   hoja con el detalle, la condición de pago y **Confirmar pedido**.
5. En computadora el pedido queda en una **columna lateral** y las tarjetas se
   reparten en varias columnas. No tenés que cambiar el tamaño de la ventana ni
   usar el modo teléfono del navegador.

**Cómo se ve en cada tamaño** (probá encogiendo y estirando la ventana):

| Ancho | Qué cambia |
|-------|------------|
| Teléfono | Dos tarjetas por fila, navegación abajo, pedido en hoja |
| Tablet / laptop chica | 3–4 tarjetas por fila, navegación abajo |
| Laptop / escritorio | Menú lateral fijo, hasta 5 tarjetas por fila, pedido en columna lateral |

> **Si en el pedido aparecen pocos productos**, no es una falla: solo se listan
> los que tienen **precio vigente en la lista del cliente**. Si abrís
> `Listas de precio` y el cliente no tiene la suya cargada, el vendedor no puede
> venderlo (el backend rechaza el pedido con `NO_PRICE`). Agregale el precio y
> la tarjeta aparece sola.

---

## 4. Roles: qué ve cada uno

| Módulo | Vendedor | Administrador |
|--------|:--------:|:-------------:|
| Inicio, Pedidos, Clientes | Sí | Sí |
| Productos, Categorías, Listas | Sí | Sí |
| Inventario, Zonas, Cajas | Sí | Sí |
| Facturación, Devoluciones, Mensajería | Sí | Sí |
| **Usuarios** | **No** | Sí |

**Cómo verificarlo:** creá un vendedor, cerrá sesión e ingresá con él. El módulo
**Usuarios** no debe aparecer en la barra lateral. Si aparece, hay un problema.

---

## 5. Problemas frecuentes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `429 Too Many Requests` al ingresar | 10 intentos fallidos en 15 min | Esperá lo que dice la pantalla, o reiniciá el backend |
| `EADDRINUSE` en el puerto 3000 | Hay otro backend corriendo | `docker compose stop backend` y volvé a lanzar `pnpm run dev` |
| `Cannot find module 'swagger-ui-express'` | La imagen de Docker quedó vieja | `docker compose up -d --build backend` |
| `getaddrinfo ENOTFOUND postgres` | `POSTGRES_HOST=postgres` en `.env` | Poné `POSTGRES_HOST=localhost` |
| `Cannot read properties of undefined (reading 'create')` al ingresar | Prisma Client desactualizado | `pnpm exec prisma generate` (con el backend detenido) |
| `500` en todos los endpoints | Falta la base de datos | `docker compose up -d postgres` |
| La intro de marca no aparece | Ya la viste en esta pestaña | Abrí una pestaña nueva |
| La intro no aparece y es pestaña nueva | El sistema pide menos movimiento | Activá *Animaciones* en Windows |

---

## 6. Comandos útiles

```powershell
# ¿Está vivo el backend y la base?
curl http://localhost:3000/health

# Documentación interactiva de la API
Start-Process http://localhost:3000/api/docs

# Ver la base de datos
cd backend; pnpm exec prisma studio

# Correr los tests
cd backend; pnpm test
```

Para los logs, `pnpm run dev` corre en primer plano: si algo falla, el error sale
ahí mismo, no en el navegador. **La consola del navegador (F12) es para el
frontend; los errores de la API salen en la terminal del backend.**
