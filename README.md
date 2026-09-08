# Cripta de Nazhi — Multijugador en vivo

Juego de rol tipo D&D para jugar entre varios amigos, con sincronización
en tiempo real (todos ven el mismo tablero, la misma bitácora y el mismo
chat al instante) y un servidor propio con Node.js + Socket.io.

## Qué incluye

- Creación de personaje (raza, clase, atributos con dados, historia de origen).
- Guía rápida de reglas (atributos, iniciativa, combate).
- Tirador de dados libre (d4 a d100).
- Fiesta: entrás con un código y te sincronizás en vivo con quien más
  esté con ese mismo código — sin copiar ni pegar nada.
- Chat en vivo dentro de la fiesta.
- Aventura cooperativa por turnos: combate, encuentros sociales, trampas
  y hallazgos, con iniciativa real (d20 + Destreza) al empezar cada combate.

## Cómo probarlo en tu computadora (antes de subirlo a internet)

Necesitás tener [Node.js](https://nodejs.org) instalado (versión 18 o más nueva).

```bash
cd cripta-nazhi-app
npm install
npm start
```

Abrí `http://localhost:3000` en el navegador. Para probar el multijugador
en tu misma máquina, abrí una segunda pestaña (o una ventana de incógnito)
con la misma dirección.

## Cómo ponerlo online para que tus amigos entren desde sus casas

Necesitás subir esta carpeta a un servicio de hosting que corra Node.js.
Estas opciones tienen plan gratuito y no piden tarjeta de crédito para
empezar:

### Opción A: Render (recomendada, la más simple)

1. Creá una cuenta gratis en [render.com](https://render.com).
2. Subí esta carpeta a un repositorio de GitHub (podés crear uno nuevo
   y arrastrar los archivos desde la web de GitHub, sin usar la terminal).
3. En Render: **New + → Web Service**, conectá tu repositorio.
4. Configuración:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Creá el servicio. Render te da una URL pública (algo como
   `https://cripta-de-nazhi.onrender.com`) — ese es el link que le pasás
   a tus amigos.

*Nota:* en el plan gratuito, el servidor "se duerme" después de un rato
sin uso y tarda unos 30-50 segundos en despertar la primera vez que
alguien entra. Después de eso funciona normal mientras haya gente jugando.

### Opción B: Railway

1. Cuenta gratis en [railway.app](https://railway.app).
2. **New Project → Deploy from GitHub repo** (mismo paso de subir a
   GitHub que en la Opción A).
3. Railway detecta automáticamente que es Node.js y lo despliega solo.
4. Te da una URL pública para compartir.

### Opción C: Replit (la más visual, todo desde el navegador)

1. Cuenta gratis en [replit.com](https://replit.com).
2. **Create App → Import from GitHub** (o subís los archivos directo
   con el botón de subir archivos de Replit, sin necesitar GitHub).
3. Replit detecta el `package.json` y corre `npm install` solo.
4. Apretás **Run** y te da una URL pública al instante.

## Cosas para tener en cuenta

- **La partida vive en la memoria del servidor.** Si el servidor se
  reinicia (por ejemplo, se "duerme" y despierta de nuevo en el plan
  gratuito, o hacés un nuevo despliegue), se pierden los personajes y el
  progreso de las fiestas activas. Para una partida casual entre amigos
  esto no suele ser un problema, pero si más adelante querés que el
  progreso se guarde para siempre, se puede agregar una base de datos
  (te lo puedo armar si lo necesitás).
- **Cualquiera con el link puede entrar** a cualquier código de fiesta
  que exista o inventar uno nuevo — no hay contraseñas. Para un grupo de
  amigos alcanza con usar un código que no sea obvio.
- El chat guarda como máximo los últimos 200 mensajes por fiesta (para
  no consumir memoria de más); los mensajes viejos se van descartando.

## Estructura del proyecto

```
cripta-nazhi-app/
├── package.json      → dependencias (express, socket.io)
├── server.js         → servidor: reglas del juego, dados, combate, salas
└── public/
    ├── index.html     → la página
    ├── style.css      → estilos
    └── app.js         → lógica del cliente (personaje, fiesta, chat, aventura)
```
