# Cripta de Nazhi — Multijugador en vivo

Juego de rol tipo D&D para jugar entre varios amigos, con sincronización
en tiempo real (todos ven el mismo tablero, la misma bitácora y el mismo
chat al instante) y un servidor propio con Node.js + Socket.io.

## Qué incluye

- Creación de personaje: 10 clases clásicas de D&D (Guerrero, Mago, Pícaro,
  Clérigo, Bárbaro, Explorador, Paladín, Bardo, Druida, Monje), 6 razas,
  atributos con dados, historia de origen generada.
- Guía rápida de reglas (atributos, iniciativa, combate).
- **Vos tirás los dados**: cuando una acción necesita una tirada, el botón
  D20 flotante se ilumina — lo tocás vos y ese resultado decide la acción.
- Hoja de personaje accesible en cualquier momento desde la pestaña Aventura
  (vida, CA, atributos, inventario, habilidad especial).
- Mapa de progreso: vas viendo las salas que tu fiesta ya recorrió y de qué
  tipo fue cada una.
- Más variedad de acciones en combate: Atacar, Habilidad especial,
  Defenderse (reduce el daño que recibís), beber Poción de curación, o
  Intentar huir. En escenas no-combate podés intentar el enfoque sugerido
  o probar uno alternativo (más difícil, pero distinto).
- Fiesta: entrás con un código y te sincronizás en vivo con quien más
  esté con ese mismo código — sin copiar ni pegar nada.
- Chat en vivo dentro de la fiesta.
- Aventura cooperativa por turnos, con iniciativa real (d20 + Destreza)
  al empezar cada combate.
- **DM controlado por IA (opcional)**: si configurás una API key de
  OpenAI, el juego entiende mejor lo que escribís en el chat de Aventura
  en lenguaje natural ("le miento al guardia", "me escondo detrás de las
  cajas") y elige sola la acción que corresponde. Sin la key configurada,
  el juego sigue funcionando igual que siempre con un sistema de palabras
  clave (sin IA).

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

## DM controlado por IA (opcional, con OpenAI)

Por defecto el juego no necesita ninguna IA para funcionar: interpreta lo
que escribís en el chat de Aventura con una lista de palabras clave
("atacar", "huir", "defenderme", etc). Si querés que entienda frases más
libres y naturales, podés conectarle la API de OpenAI.

**Cómo funciona:** la IA nunca tira dados ni cambia vida/inventario por
su cuenta. Solo lee tu mensaje y decide cuál de las acciones *ya
disponibles* en la escena actual representa mejor lo que quisiste decir
(por ejemplo, "trato de convencerlo de que somos aliados" → elige la
opción de Persuasión que ya estaba en pantalla). Todo lo demás — dados,
daño, experiencia, reglas — lo sigue resolviendo el servidor exactamente
igual que siempre. Si la IA no está configurada, falla, o no reconoce
nada, el juego cae automáticamente al sistema de palabras clave, así que
nunca te vas a quedar trabado.

**Para activarlo**, definí esta variable de entorno donde corras el
servidor:

```
OPENAI_API_KEY=sk-tu-api-key-de-openai
```

Opcionalmente también podés elegir el modelo (por defecto usa
`gpt-5-mini`, que es barato y anda bien para esto):

```
OPENAI_MODEL=gpt-5-mini
```

- **En tu computadora:** copiá `.env.example` a `.env` y completá tu key
  ahí (el servidor lo lee solo al arrancar, no hace falta ninguna
  librería extra).
- **En Render/Railway/Replit:** cada uno tiene una sección de
  "Environment Variables" / "Secrets" en la configuración del servicio —
  agregás `OPENAI_API_KEY` (y opcionalmente `OPENAI_MODEL`) ahí, no en un
  archivo.

Cada mensaje libre que un jugador escribe durante su turno hace **una
llamada a la API de OpenAI**, así que tiene un costo asociado a tu cuenta
de OpenAI (chico, pero real) — podés revisarlo en el dashboard de
OpenAI. Si en algún momento querés desactivarlo, alcanza con borrar o
vaciar la variable `OPENAI_API_KEY`.

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
   - *(Opcional, para el DM-IA)* En **Environment**, agregá una variable
     `OPENAI_API_KEY` con tu key de OpenAI.
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
5. *(Opcional, para el DM-IA)* En la pestaña **Variables** del proyecto,
   agregá `OPENAI_API_KEY` con tu key de OpenAI.

### Opción C: Replit (la más visual, todo desde el navegador)

1. Cuenta gratis en [replit.com](https://replit.com).
2. **Create App → Import from GitHub** (o subís los archivos directo
   con el botón de subir archivos de Replit, sin necesitar GitHub).
3. Replit detecta el `package.json` y corre `npm install` solo.
4. Apretás **Run** y te da una URL pública al instante.
5. *(Opcional, para el DM-IA)* En la pestaña **Secrets** (el ícono de
   candado), agregá `OPENAI_API_KEY` con tu key de OpenAI.

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
├── server.js         → servidor: reglas del juego, dados, combate, salas, DM-IA
├── .env.example      → plantilla para tu OPENAI_API_KEY local (copiala a .env)
└── public/
    ├── index.html     → la página
    ├── style.css      → estilos
    └── app.js         → lógica del cliente (personaje, fiesta, chat, aventura)
```
