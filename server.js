const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

// carga variables desde un archivo .env local si existe (sin depender de ninguna libreria extra)
try {
  const envPath = path.join(__dirname, '.env');
  if(fs.existsSync(envPath)){
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line=>{
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if(m && m[1] && !(m[1] in process.env)){
        process.env[m[1]] = (m[2]||'').trim().replace(/^["']|["']$/g,'');
      }
    });
  }
} catch(e){ /* si falla la carga del .env, seguimos con las env vars del sistema nomas */ }

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

/* ===================== DUNGEON MASTER CON IA (OpenAI) — opcional ===================== */
// Si OPENAI_API_KEY no esta configurada, el juego funciona igual que siempre: el cliente
// interpreta los mensajes libres del jugador con una lista de palabras clave (sin IA).
// Si esta configurada, el servidor usa la IA SOLO para decidir cual de las opciones ya
// disponibles en la escena actual representa mejor lo que el jugador escribio — el motor
// de reglas (dados, dc, daño, xp) sigue siendo 100% el mismo de siempre, resuelto aca en
// el servidor. La IA nunca inventa ni ejecuta mecanicas por su cuenta.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
const AI_DM_ENABLED = !!OPENAI_API_KEY;
if(AI_DM_ENABLED) console.log('DM-IA activado (modelo: '+OPENAI_MODEL+')');
else console.log('DM-IA desactivado (no hay OPENAI_API_KEY configurada) — se usa el interprete de palabras clave.');

async function callOpenAIJson(messages, schema){
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer '+OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 200,
      response_format: { type:'json_schema', json_schema: { name:'dm_intent', strict:true, schema } }
    })
  });
  if(!resp.ok){
    const errText = await resp.text().catch(()=>String(resp.status));
    throw new Error('OpenAI API error '+resp.status+': '+errText.slice(0,300));
  }
  const data = await resp.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if(!content) throw new Error('Respuesta vacia de OpenAI');
  return JSON.parse(content);
}

async function classifyPlayerIntent(text, options, scene){
  const kinds = options.map(o=>o.kind).filter(Boolean);
  const enumList = kinds.concat(['none']);
  const optionsList = options.map(o=>'- "'+o.kind+'": '+o.label).join('\n');
  const sceneDesc = scene ? ('Tipo: '+scene.type+'\nTitulo: '+(scene.title||'-')+'\nDescripcion: '+(scene.text||'-')) : 'Sin escena activa.';
  const system = 'Sos el clasificador de intenciones de un Dungeon Master de un juego de rol por turnos, en español. '+
    'Tu unico trabajo es, dado un mensaje libre de un jugador, elegir cual de las acciones disponibles representa mejor '+
    'su intencion, o "none" si el mensaje no corresponde a ninguna (por ejemplo, si es charla entre jugadores o no tiene '+
    'relacion con la escena). Nunca inventes acciones fuera de la lista. Respondes solo en el formato JSON pedido.';
  const user = 'Acciones disponibles ahora mismo:\n'+optionsList+
    '\n\nEscena actual:\n'+sceneDesc+
    '\n\nMensaje del jugador: "'+String(text).slice(0,300)+'"\n\n'+
    'Elegi el "kind" mas apropiado (o "none") y escribi una "narracion" corta de Dungeon Master '+
    '(una sola oracion, en español, sin revelar si tiene exito o fracaso) reaccionando a como el jugador describe intentarlo.';
  const schema = {
    type:'object',
    properties:{
      kind:{ type:'string', enum: enumList },
      narration:{ type:'string' }
    },
    required:['kind','narration'],
    additionalProperties:false
  };
  return callOpenAIJson([
    { role:'system', content: system },
    { role:'user', content: user }
  ], schema);
}

/* ===================== DATOS DE JUEGO (autoritativos, en el servidor) ===================== */

const CLASSES = {
  guerrero:{ hitDie:10, primary:'FUE', specialName:'Golpe Firme', weapon:'Espada larga', weaponDie:8 },
  mago:{ hitDie:6, primary:'INT', specialName:'Dardo Arcano', weapon:'Daga', weaponDie:4 },
  picaro:{ hitDie:8, primary:'DES', specialName:'Golpe Furtivo', weapon:'Daga', weaponDie:4 },
  clerigo:{ hitDie:8, primary:'SAB', specialName:'Palabra Sagrada', weapon:'Maza', weaponDie:6 },
  barbaro:{ hitDie:12, primary:'FUE', specialName:'Furia', weapon:'Hacha de guerra a dos manos', weaponDie:12 },
  explorador:{ hitDie:10, primary:'DES', specialName:'Tiro Certero', weapon:'Arco largo', weaponDie:8 },
  paladin:{ hitDie:10, primary:'FUE', specialName:'Golpe Sagrado', weapon:'Espada larga', weaponDie:8 },
  bardo:{ hitDie:8, primary:'CAR', specialName:'Cancion Inspiradora', weapon:'Espada corta', weaponDie:6 },
  druida:{ hitDie:8, primary:'SAB', specialName:'Forma Salvaje', weapon:'Baston de druida', weaponDie:6 },
  monje:{ hitDie:8, primary:'DES', specialName:'Golpe Certero', weapon:'Golpes sin arma', weaponDie:6 }
};

const ALT_ABIL_BY_TYPE = { social:'FUE', exploracion:'FUE', trampa:'INT' };
const ROOM_ICON = { combate:'⚔', social:'💬', exploracion:'🧭', trampa:'⚠', hallazgo:'💰', puerta:'🚪' };
const MAP_POINTS_LEN = 10; // debe coincidir con MAP_POINTS.length en public/app.js

const ENEMIES = [
  {name:'Rata gigante', hp:9, ac:11, atk:2, dmg:[1,4], xp:15, init:2},
  {name:'Bandido', hp:14, ac:12, atk:3, dmg:[1,6], xp:25, init:1},
  {name:'Esqueleto errante', hp:13, ac:13, atk:3, dmg:[1,6], xp:25, init:0, image:'/enemies/esqueleto.jpg'},
  {name:'Lobo de las sombras', hp:16, ac:12, atk:4, dmg:[1,8], xp:30, init:3},
  {name:'Cultista menor', hp:12, ac:11, atk:2, dmg:[1,4,1], xp:20, init:1},
  {name:'Ogro joven', hp:28, ac:13, atk:5, dmg:[2,6], xp:50, init:-1},
  {name:'Araña venenosa', hp:11, ac:14, atk:3, dmg:[1,6], xp:22, init:3}
];
const GUARD_ENEMY = {name:'Guardia de la Cripta', hp:18, ac:15, atk:4, dmg:[1,8,1], xp:35, init:1, image:'/enemies/guardia.jpg'};

const SOCIAL_SCENES = [
  {title:'El mercader nervioso', text:'Un mercader te ofrece un mapa a cambio de que espantes a un rival suyo sin usar violencia.', abil:'CAR', dc:12,
   success:'Convences al rival de retirarse. El mercader, agradecido, te entrega el mapa y algo de oro.', fail:'El rival no se deja intimidar; la escena termina en un altercado menor.'},
  {title:'El guardia dudoso', text:'Un guardia bloquea el paso a las criptas exigiendo un permiso que no tenes.', abil:'CAR', dc:13,
   success:'Tu labia lo convence de mirar para otro lado.', fail:'El guardia no cede y tenes que buscar un camino mas largo.'},
  {title:'El anciano ermitaño', text:'Un ermitaño podria conocer secretos del lugar, pero es huraño y desconfiado.', abil:'SAB', dc:12,
   success:'Ganas su confianza y te da una pista valiosa sobre lo que sigue.', fail:'El ermitaño se cierra en banda y no dice mas.'}
];
const EXPLORE_SCENES = [
  {title:'Puente colgante', text:'Un puente viejo cruje sobre un abismo. Cruzarlo con cuidado requiere destreza.', abil:'DES', dc:12,
   success:'Cruzas sin problemas y encontras una moneda antigua en el otro lado.', fail:'Resbalas y te golpeas; perdes algo de vida.'},
  {title:'Inscripcion arcana', text:'Un muro cubierto de simbolos podria revelar un atajo si lograses interpretarlo.', abil:'INT', dc:13,
   success:'Descifras el mensaje y encontras un pasadizo oculto con un objeto util.', fail:'No lograsentender nada y seguis de largo.'},
  {title:'Sala derrumbada', text:'El techo de esta sala parece a punto de ceder. Moverse rapido y con fuerza puede evitar el derrumbe.', abil:'FUE', dc:12,
   success:'Apartas los escombros a tiempo y avanzas sin daño.', fail:'Parte del techo cae sobre vos antes de que puedas escapar.'}
];
const TRAP_SCENES = [
  {title:'Suelo de presion', text:'El piso tiene una losa sospechosa. Detectarla a tiempo requiere buen ojo.', abil:'SAB', dc:13,
   success:'Notas la trampa y la esquivas sin problema.', fail:'Pisas la losa y una descarga de dardos te alcanza.'},
  {title:'Cerradura envenenada', text:'Un cofre cerrado tiene una aguja escondida en la cerradura.', abil:'DES', dc:14,
   success:'Abris el cofre con destreza, evitando la aguja, y encontras algo de valor.', fail:'La aguja te pincha; el veneno te resta algo de vida.'}
];
const ITEMS = ['Pocion menor de curacion','Moneda de oro antigua','Gema pequeña','Pergamino ilegible','Daga ornamentada','Amuleto desgastado'];
const USABLE_SCENE_ITEMS = {
  'Antorcha': { scenes:['exploracion','trampa'], bonus:3, desc:'ilumina cada rincon del lugar' },
  'Cuerda (15m)': { scenes:['exploracion'], bonus:3, desc:'asegura el paso con la cuerda' }
};
const SCENE_TYPES = ['combate','social','exploracion','trampa','hallazgo','puerta'];
const FORK_SCENES = [
  {title:'El camino se divide', text:'El pasillo termina en una bifurcacion: dos corredores oscuros se abren ante ustedes. Van a tener que separarse para cubrir ambos.',
   paths:[{id:'A', label:'Tomar el pasillo izquierdo'},{id:'B', label:'Tomar el pasillo derecho'}]},
  {title:'Dos puertas identicas', text:'Encuentran dos puertas identicas, una al lado de la otra, ambas entreabiertas. No hay forma de saber que hay detras de cada una sin separarse.',
   paths:[{id:'A', label:'Entrar por la puerta de la izquierda'},{id:'B', label:'Entrar por la puerta de la derecha'}]},
  {title:'La sala se bifurca', text:'Una grieta profunda divide la sala en dos mitades. Se puede bordear por el muro, o cruzar directo por el centro.',
   paths:[{id:'A', label:'Bordear junto al muro'},{id:'B', label:'Cruzar por el centro'}]}
];
// rooms del mapa (indice 0-based) donde es mas probable toparse con un guardia armado
const GUARD_ROOM_INDEXES = [1, 9]; // 1 = Vestibulo de Guardianes, 9 = Celdas

function rollDie(sides){ return 1 + Math.floor(Math.random()*sides); }
function mod(val){ return Math.floor((val-10)/2); }
function fmtMod(m){ return m>=0? '+'+m : ''+m; }
function resolveRoll(clientRoll){
  const n = Number(clientRoll);
  if(Number.isInteger(n) && n>=1 && n<=20) return n;
  return rollDie(20);
}
function rollKind(roll){
  if(roll===20) return 'crit';
  if(roll===1) return 'fumble';
  return 'normal';
}

/* ===================== ESTADO EN MEMORIA (por sala/codigo) ===================== */

const parties = {}; // { [code]: partyObject }

function sanitizeCode(raw){
  return String(raw||'').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,24);
}

function blankParty(code){
  return {
    code,
    characters: {},
    status: 'idle',
    currentScene: null,
    turnQueue: [],
    log: [],
    chat: [],
    roomHistory: [],
    totalRooms: 0,
    fogRevealed: [],
    updatedAt: Date.now()
  };
}

function getParty(code){
  if(!parties[code]) parties[code] = blankParty(code);
  return parties[code];
}

function pushLog(party, kind, text){
  party.log.push({kind, text, ts: Date.now()});
  if(party.log.length > 80) party.log.shift();
}

/* ===================== NARRADOR (Dungeon Master por reglas, sin IA real) ===================== */
const DM_LINES = {
  combate: [
    'El aire se enrarece de golpe. Algo se mueve entre las sombras al fondo de la sala, y el sonido de metal raspando piedra les eriza la piel a todos. El Dungeon Master alza una ceja: "Esto no va a resolverse hablando. Que cada uno tire su propia iniciativa."',
    'Un gruñido bajo retumba entre las paredes humedas. El DM deja la lapicera sobre la mesa y sonrie apenas: "Preparense. Esto se pone interesante." Cada integrante de la fiesta debe tirar su iniciativa por separado.',
    'Sin previo aviso, algo salta desde la oscuridad. El DM susurra, casi disfrutandolo: "Tiren iniciativa antes de que sea tarde — el orden de turnos va a depender de quien reaccione mas rapido."',
    'El DM golpea la mesa con dos dedos, marcando el ritmo: "Combate. Cada uno de ustedes tira su propio dado de iniciativa (d20 mas modificador de Destreza), y el orden queda armado segun el resultado."'
  ],
  social: [
    'Alguien se acerca desde las sombras de la sala, con un gesto que podria ser amistoso o no. El DM se acomoda los lentes: "Tienen una decision que tomar como grupo — ¿quien de ustedes quiere encargarse de hablar con esta persona? Cualquiera puede intentarlo."',
    'Frente al grupo hay alguien con quien podrian negociar, convencer, o incluso intimidar. El DM espera, mirando a todos por igual: "No hace falta que sea quien esta explorando ahora — cualquiera de la fiesta puede tomar la palabra, solo digan que quieren hacer."',
    'El ambiente se tensa apenas por un instante; hay una oportunidad de dialogo antes de que las cosas se compliquen. El DM sonrie con picardia: "Las palabras tambien son un arma. ¿Alguien del grupo quiere intentar usarlas?"'
  ],
  exploracion: [
    'El DM describe el entorno con cuidado, deteniendose en cada detalle: hay algo aqui que merece atencion, aunque no salta a la vista de inmediato. "Cualquiera de ustedes puede intentar investigar mas de cerca."',
    '"Presten atencion a los detalles", dice el DM, bajando la voz como si el lugar mismo pudiera escuchar. "Este sitio esconde algo, y no hace falta que sea siempre la misma persona quien lo busque."',
    'El DM entrecierra los ojos mientras narra: el ambiente se siente cargado de historia, de pasos que caminaron ahi mucho antes que ustedes. "¿Alguno quiere detenerse a mirar con mas cuidado?"'
  ],
  trampa: [
    'El DM entrecierra los ojos y baja el tono: "Cuidado donde pisan. Algo en esta sala no esta bien, y cualquiera del grupo podria notarlo si presta atencion."',
    'Un silencio incomodo se instala en la sala; algo aqui no se siente natural. El DM lo advierte con la mirada, sin apurar a nadie en particular: "Quien quiera arriesgarse a revisar, que lo diga."',
    'El DM sonrie de costado, casi con lastima anticipada: "Esto podria salir mal si no tienen cuidado. ¿Alguien se anima a intentarlo?"'
  ],
  hallazgo: [
    'El DM señala un rincon de la sala, donde algo brilla apenas entre los escombros: "Podria haber algo de valor ahi. Cualquiera puede ir a revisar, no hace falta turnarse."',
    'El DM se queda callado un segundo, dejando que la curiosidad del grupo haga su trabajo. "Alguien va a tener que decidirse a mirar mas de cerca."'
  ],
  puerta: [
    'El grupo llega frente a una puerta pesada, cerrada con algo mas que una simple traba. El DM golpea la mesa: "Tienen opciones: buscar una llave escondida, forzarla entre todos, o tomar otro camino. Discutanlo — cualquiera puede decidir que hacer."',
    'La puerta no se ve dispuesta a ceder facilmente. El DM los mira a todos por igual: "Llave, fuerza, o retirada. No importa quien de ustedes lo intente, la decision es del grupo."'
  ],
  decision: [
    '¿Que hacen? ¿Avanzan con cautela, se quedan atras, o se lanzan de lleno? Cualquiera de ustedes puede responder.',
    'El DM espera, recorriendo la mesa con la mirada: ¿el grupo actua con cabeza fria, o alguien se anima a arriesgarse?',
    'Tienen la palabra. ¿Como reacciona la fiesta ante esto? No hace falta que sea siempre la misma persona quien decida.'
  ],
  victoria: [
    'El enemigo cae y por un momento solo se escucha la respiracion agitada del grupo. El DM asiente, satisfecho: "Bien hecho. La cripta sigue esperando, pero por ahora respiren tranquilos."',
    '"Impresionante", murmura el DM mientras anota algo en sus notas, sin levantar la vista del todo. El silencio que sigue a la pelea se siente casi tan pesado como el combate mismo.',
    'El DM sonrie apenas: "Uno menos. Guarden fuerzas — no saben que mas los espera mas adelante."'
  ],
  nivel: [
    'El DM sonrie y deja la lapicera un momento: "Se nota que estan mejorando. La experiencia deja marca, para bien."',
    'El DM cierra su libreta un instante, como calculando algo: "Estan mas fuertes que cuando empezaron. Van a necesitarlo."'
  ]
};
function dmLine(category){
  const arr = DM_LINES[category];
  if(!arr || !arr.length) return null;
  return arr[Math.floor(Math.random()*arr.length)];
}
function pushDM(party, category){
  const line = dmLine(category);
  if(!line) return;
  party.log.push({kind:'dm', text: line, ts: Date.now()});
  if(party.log.length > 80) party.log.shift();
}

// El DM sugiere usar un objeto del inventario si alguien presente tiene algo util para esta escena.
function pushItemSuggestion(party, scene, memberIds){
  for(const itemName of Object.keys(USABLE_SCENE_ITEMS)){
    const def = USABLE_SCENE_ITEMS[itemName];
    if(!def.scenes.includes(scene.type)) continue;
    const ownerId = memberIds.find(id => party.characters[id] && party.characters[id].inventory.includes(itemName));
    if(ownerId){
      const ownerName = party.characters[ownerId].name;
      party.log.push({kind:'dm', text: 'El DM señala hacia '+ownerName+': "Esa '+itemName.toLowerCase()+' que llevas podria servirte aca."', ts: Date.now()});
      if(party.log.length > 80) party.log.shift();
      return;
    }
  }
}

function broadcastParty(code){
  const party = parties[code];
  if(!party) return;
  party.updatedAt = Date.now();
  io.to(code).emit('state', party);
}

function ensureInQueue(party, playerId){
  party.turnQueue = party.turnQueue || [];
  if(!party.turnQueue.includes(playerId)) party.turnQueue.push(playerId);
}
function removeFromQueue(party, playerId){
  party.turnQueue = (party.turnQueue||[]).filter(id=>id!==playerId);
}
function activePlayerId(party){
  const q = party.turnQueue || [];
  return q.length ? q[0] : null;
}

function gainXpAndItem(party, playerId, amount, item){
  const c = party.characters[playerId];
  if(!c) return '';
  c.xp += amount;
  let leveled = '';
  while(c.xp >= c.xpNext){
    c.xp -= c.xpNext;
    c.level++;
    c.xpNext = Math.floor(c.xpNext * 1.4);
    const gained = Math.max(1, rollDie(CLASSES[c.cls].hitDie) + mod(c.stats.CON));
    c.maxHp += gained;
    c.hp = c.maxHp;
    leveled += ' '+c.name+' sube a nivel '+c.level+'!';
    pushDM(party, 'nivel');
  }
  if(item) c.inventory.push(item);
  return leveled.trim();
}

function damagePlayer(party, playerId, dmg){
  const c = party.characters[playerId];
  if(!c) return 0;
  c.hp = Math.max(0, c.hp - dmg);
  return c.hp;
}

function advanceTurn(party){
  // si la fiesta esta separada resolviendo una bifurcacion, pasa al siguiente subgrupo en vez
  // de volver a modo exploracion normal
  if(party.forkQueue && party.forkQueue.length){
    party.forkQueue.shift(); // el subgrupo actual ya termino su encuentro
    if(party.forkQueue.length){
      startForkGroupScene(party);
      return;
    }
    party.forkQueue = null;
    pushLog(party, 'sys', 'La fiesta vuelve a reunirse tras separarse.');
  }
  // el que acaba de jugar pasa al final de la cola; el siguiente frente de la cola juega despues
  const q = party.turnQueue || [];
  if(q.length){ const finished = q.shift(); q.push(finished); }
  party.turnQueue = q;
  party.status = 'idle';
  party.currentScene = null;
}

function resolveHealTarget(party, sc, playerId, targetId){
  // valida que el objetivo sea un aliado presente en este combate (o el mismo lanzador); si no, cura al lanzador
  if(targetId && targetId!==playerId && party.characters[targetId]){
    const inCombat = sc.combatOrder && sc.combatOrder.some(e=>e.type==='player' && e.id===targetId && !sc.fledIds.includes(targetId));
    if(inCombat) return party.characters[targetId];
  }
  return party.characters[playerId];
}

function resolveEnemyIfCurrent(party, sc){
  // Resuelve automaticamente los turnos del enemigo (y saltea jugadores que huyeron o estan caidos)
  // hasta que le toque a un jugador activo y consciente, o termine el combate.
  let guard = 0;
  while(guard < 12){
    const entry = sc.combatOrder[sc.combatIdx];
    if(!entry) return;
    if(entry.type==='player'){
      const c = party.characters[entry.id];
      if(sc.fledIds.includes(entry.id) || !c || c.hp<=0){
        sc.combatIdx = (sc.combatIdx+1) % sc.combatOrder.length;
        guard++; continue;
      }
      return; // le toca a un jugador presente y consciente -> se detiene aca, esperando su accion
    }
    // turno del enemigo: solo puede atacar a jugadores presentes, no huidos, y conscientes
    const targets = sc.combatOrder.filter(e=>e.type==='player' && !sc.fledIds.includes(e.id) && party.characters[e.id] && party.characters[e.id].hp>0);
    if(!targets.length){
      const anyoneLeft = sc.combatOrder.some(e=>e.type==='player' && !sc.fledIds.includes(e.id));
      if(anyoneLeft){
        // todo el grupo cayo inconsciente: para que el juego no quede trabado, se reaniman a duras penas
        pushLog(party,'bad','Todo el grupo cae ante '+sc.enemy.name+'... pero tras un tenso respiro, logran reanimarse a duras penas con 1 punto de vida.');
        sc.combatOrder.forEach(e=>{
          if(e.type==='player'){ const pc=party.characters[e.id]; if(pc && pc.hp<=0) pc.hp = 1; }
        });
      } else {
        pushLog(party,'sys','El grupo se retira y pierde de vista al enemigo.');
      }
      advanceTurn(party);
      return;
    }
    const target = targets[Math.floor(Math.random()*targets.length)];
    const tChar = party.characters[target.id];
    const roll = rollDie(20);
    const total = roll + sc.enemy.atk;
    const hit = total >= tChar.ac;
    pushLog(party, hit?'bad':'sys', sc.enemy.name+' ataca a '+tChar.name+': d20('+roll+')+'+sc.enemy.atk+' = '+total+' vs CA '+tChar.ac+' -> '+(hit?'golpea':'falla'));
    if(hit){
      let dmg = sc.enemy.dmg.length===3 ? rollDie(sc.enemy.dmg[1])+sc.enemy.dmg[2] : rollDie(sc.enemy.dmg[1]);
      if(sc.halfDamageFor === target.id){
        dmg = Math.ceil(dmg/2);
        pushLog(party,'sys', tChar.name+' amortigua el golpe a la mitad.');
        sc.halfDamageFor = null;
      }
      const newHp = damagePlayer(party, target.id, dmg);
      pushLog(party,'bad', tChar.name+' recibe '+dmg+' de daño.');
      if(newHp<=0){
        pushLog(party,'bad', tChar.name+' cae inconsciente. Necesita que alguien lo/la reanime con una pocion o con curacion antes de poder seguir participando.');
      }
    }
    sc.combatIdx = (sc.combatIdx+1) % sc.combatOrder.length;
    guard++;
  }
}

// Genera una escena de encuentro (combate/social/exploracion/trampa/puerta/hallazgo/bifurcacion)
// para el conjunto de miembros indicado. Reutilizable tanto para toda la fiesta como para un subgrupo.
function buildEncounterScene(party, memberIds, opts){
  opts = opts || {};
  const allowFork = opts.allowFork && memberIds.length > 1;
  const guardBias = opts.guardBias;
  let types = SCENE_TYPES.slice();
  if(allowFork) types.push('bifurcacion');
  const type = guardBias ? 'combate' : types[Math.floor(Math.random()*types.length)];
  let scene;

  if(type==='combate'){
    const avgLevel = memberIds.reduce((s,id)=>s+party.characters[id].level,0) / memberIds.length;
    const base = guardBias ? GUARD_ENEMY : ENEMIES[Math.floor(Math.random()*ENEMIES.length)];
    const extraHp = Math.max(0, memberIds.length-1) * 8; // mas dura si son varios
    const enemy = Object.assign({}, base, {maxHp: base.hp + Math.round((avgLevel-1)*4) + extraHp});
    enemy.hp = enemy.maxHp;
    const grupal = memberIds.length>1;
    const title = guardBias ? (grupal?'Un guardia les corta el paso!':'Un guardia te corta el paso!') : 'Emboscada! '+enemy.name;
    const text = guardBias
      ? ('Un guardia de la cripta, armado con espada y escudo, se planta frente a '+(grupal?'ustedes.':'vos.'))
      : ('Un '+enemy.name.toLowerCase()+' corta el paso'+(grupal?' al grupo.':'.'));
    scene = {type:'combate', title, text, enemy, usedSpecialBy:[], attackedIds:[], fledIds:[], halfDamageFor:null, firstStrikeUsed:false, groupMembers:memberIds};

    const combatOrder = memberIds.map(id=>{
      const c = party.characters[id];
      const roll = rollDie(20);
      const initVal = roll + mod(c.stats.DES);
      return {type:'player', id, name:c.name, roll, init:initVal};
    });
    const enemyRoll = rollDie(20);
    combatOrder.push({type:'enemy', id:'enemy', name:enemy.name, roll:enemyRoll, init: enemyRoll+(enemy.init||0)});
    combatOrder.sort((a,b)=> b.init - a.init);
    scene.combatOrder = combatOrder;
    scene.combatIdx = 0;
    pushLog(party,'sys','Iniciativa: '+combatOrder.map(e=> e.name+' d20('+e.roll+')'+fmtMod(e.init-e.roll)+'='+e.init).join(' | '));
    pushLog(party,'sys','Orden de turnos: '+combatOrder.map(e=>e.name).join(' -> '));
  } else if(type==='social'){
    scene = Object.assign({type:'social', groupMembers:memberIds}, SOCIAL_SCENES[Math.floor(Math.random()*SOCIAL_SCENES.length)]);
  } else if(type==='exploracion'){
    scene = Object.assign({type:'exploracion', groupMembers:memberIds}, EXPLORE_SCENES[Math.floor(Math.random()*EXPLORE_SCENES.length)]);
  } else if(type==='trampa'){
    scene = Object.assign({type:'trampa', groupMembers:memberIds}, TRAP_SCENES[Math.floor(Math.random()*TRAP_SCENES.length)]);
  } else if(type==='puerta'){
    scene = {type:'puerta', title:'Puerta cerrada', text:'Una pesada puerta de roble y hierro bloquea el paso. Podes buscar una llave escondida, forzarla, o tomar otro camino.', groupMembers:memberIds};
  } else if(type==='bifurcacion'){
    const f = FORK_SCENES[Math.floor(Math.random()*FORK_SCENES.length)];
    scene = {type:'bifurcacion', title:f.title, text:f.text, paths:f.paths, choices:{}, forkMembers:memberIds.slice(), groupMembers:memberIds};
  } else {
    scene = {type:'hallazgo', title:'Un hallazgo silencioso', text:'Esta sala esta vacia, pero algo brilla entre los escombros.', groupMembers:memberIds};
  }
  return scene;
}

function startForkGroupScene(party){
  const next = party.forkQueue[0];
  const scene = buildEncounterScene(party, next.members, {});
  pushLog(party, 'sys', 'Mientras tanto, '+next.members.map(id=>party.characters[id].name).join(' y ')+' avanzan por su camino...');
  pushDM(party, scene.type);
  pushItemSuggestion(party, scene, next.members);
  party.status = scene.type==='combate' ? 'combat' : 'event';
  party.currentScene = scene;
  if(scene.type==='combate') resolveEnemyIfCurrent(party, scene);
}

function getEffectiveTurnLeader(party){
  // el primer personaje consciente (hp>0) en la cola de turnos; si todos estan caidos, devuelve el frente igual
  const q = party.turnQueue || [];
  for(const id of q){
    const c = party.characters[id];
    if(c && c.hp > 0) return id;
  }
  return q.length ? q[0] : null;
}

function startTurnForPlayer(party, playerId){
  if(party.status !== 'idle' || party.currentScene){
    return { error: 'Ya hay una escena en curso en esta fiesta.' };
  }
  const leader = getEffectiveTurnLeader(party);
  if(leader && leader !== playerId){
    return { error: 'No es tu turno.' };
  }
  const myChar = party.characters[playerId];
  if(!myChar) return { error: 'No tenes personaje publicado en esta fiesta.' };
  if(myChar.hp <= 0) return { error: 'Estas caido — necesitas que te reanimen antes de poder explorar.' };

  // la posicion "actual" de la fiesta es la de cualquier personaje ya ubicado (todos deberian coincidir)
  const placedPositions = Object.values(party.characters).map(c=>c.mapPos).filter(v=>typeof v==='number' && v>=0);
  const currentSharedPos = placedPositions.length ? placedPositions[0] : -1;
  const nextMapPos = (currentSharedPos>=0) ? (currentSharedPos+1) % MAP_POINTS_LEN : 0;
  const guardBias = GUARD_ROOM_INDEXES.includes(nextMapPos) && Math.random() < 0.6;
  const presentIds = Object.keys(party.characters); // la fiesta se mueve junta: todos estan presentes

  const scene = buildEncounterScene(party, presentIds, {allowFork:true, guardBias});

  pushLog(party, 'sys', myChar.name+' explora una nueva sala...');
  pushDM(party, scene.type);
  pushItemSuggestion(party, scene, presentIds);
  party.status = scene.type==='combate' ? 'combat' : 'event';
  party.currentScene = scene;
  party.totalRooms = (party.totalRooms||0) + 1;
  party.roomHistory = (party.roomHistory||[]);
  party.roomHistory.push({type: scene.type, n: party.totalRooms});
  if(party.roomHistory.length > 10) party.roomHistory.shift();

  // la fiesta se mueve junta: todos los personajes avanzan a la misma sala
  Object.values(party.characters).forEach(ch=>{
    ch.mapPos = nextMapPos;
    ch.lastRoomType = scene.type;
  });

  // niebla: se despeja para toda la fiesta por donde alguien ya paso
  party.fogRevealed = party.fogRevealed || [];
  if(!party.fogRevealed.includes(myChar.mapPos)) party.fogRevealed.push(myChar.mapPos);

  if(scene.type==='combate'){
    resolveEnemyIfCurrent(party, scene); // por si el enemigo saco mas iniciativa que todos
  }
  return { ok:true };
}

function doAction(party, playerId, kind, clientRoll, targetId, itemName){
  const myChar = party.characters[playerId];
  if(!myChar) return { error:'No tenes personaje publicado.' };
  const sc = party.currentScene;
  if(!sc) return { error:'No hay escena activa.' };

  // fuera de combate, cualquier miembro presente de la fiesta puede resolver la decision
  // (el grupo discute y quien quiera puede actuar — no solo a quien "le toca" explorar).
  // si la escena tiene groupMembers (por ejemplo, un subgrupo separado tras una bifurcacion),
  // solo esos miembros pueden interactuar con ella.
  if(sc.groupMembers && !sc.groupMembers.includes(playerId)){
    return { error:'No estas en esta escena — tu personaje esta en otra parte de la cripta ahora mismo.' };
  }
  if(myChar.hp <= 0 && sc.type!=='combate'){
    return { error:'Estas caido — necesitas que te reanimen antes de poder actuar.' };
  }

  if(sc.type==='bifurcacion'){
    if(kind!=='choose_path') return { error:'Accion invalida.' };
    const pathId = targetId; // reutilizamos el campo targetId para mandar el id del camino elegido
    if(!sc.paths.some(p=>p.id===pathId)) return { error:'Camino invalido.' };
    if(sc.choices[playerId]) return { error:'Ya elegiste tu camino, esperando al resto del grupo.' };
    sc.choices[playerId] = pathId;
    pushLog(party,'sys', myChar.name+' elige: '+(sc.paths.find(p=>p.id===pathId)||{}).label+'.');
    const stillWaiting = sc.forkMembers.filter(id=>!sc.choices[id]);
    if(stillWaiting.length){
      return { ok:true };
    }
    // todos eligieron -> armar los subgrupos y arrancar el primero
    const groups = {};
    sc.forkMembers.forEach(id=>{ const p=sc.choices[id]; (groups[p]=groups[p]||[]).push(id); });
    const groupOrder = Object.keys(groups);
    pushLog(party,'sys','La fiesta se separa: '+groupOrder.map(gid=>{
      const label = (sc.paths.find(p=>p.id===gid)||{}).label || gid;
      return label+' ('+groups[gid].map(id=>party.characters[id].name).join(', ')+')';
    }).join(' | '));
    party.forkQueue = groupOrder.map(gid=>({pathId:gid, members:groups[gid]}));
    startForkGroupScene(party);
    return { ok:true };
  }

  if(sc.type==='combate'){
    const combatOrder = sc.combatOrder || [];
    const currentEntry = combatOrder[sc.combatIdx];
    if(!currentEntry || currentEntry.type!=='player' || currentEntry.id!==playerId){
      return { error:'No es tu turno de combate (mira la bitacora para ver el orden de iniciativa).' };
    }

    if(kind==='attack' || kind==='special'){
      const useSpecial = kind==='special';
      const cd = CLASSES[myChar.cls];
      const atkStat = mod(myChar.stats[cd.primary]);
      const enemy = sc.enemy;
      let hit = true, dmg = 0;
      let healOnly = false;

      if(useSpecial){
        if(sc.usedSpecialBy.includes(playerId)) return { error:'Ya usaste tu habilidad especial en este combate.' };
        sc.usedSpecialBy.push(playerId);
        if(myChar.cls==='mago'){
          dmg = rollDie(6)+rollDie(6);
          pushLog(party,'ok', myChar.name+' lanza Dardo Arcano: '+dmg+' de daño magico.');
        } else if(myChar.cls==='druida'){
          dmg = rollDie(8)+rollDie(8);
          pushLog(party,'ok', myChar.name+' invoca Forma Salvaje: un zarpazo de '+dmg+' de daño.');
        } else if(myChar.cls==='clerigo'){
          const target = resolveHealTarget(party, sc, playerId, targetId);
          const heal = rollDie(6)+rollDie(6)+mod(myChar.stats.SAB);
          target.hp = Math.min(target.maxHp, target.hp+heal);
          pushLog(party,'ok', myChar.name+' usa Palabra Sagrada sobre '+(target===myChar?'si mismo':target.name)+' y recupera '+heal+' de vida.');
          healOnly = true;
        } else if(myChar.cls==='bardo'){
          const target = resolveHealTarget(party, sc, playerId, targetId);
          const heal = rollDie(6)+mod(myChar.stats.CAR);
          target.hp = Math.min(target.maxHp, target.hp+Math.max(1,heal));
          pushLog(party,'ok', myChar.name+' entona su Cancion Inspiradora sobre '+(target===myChar?'si mismo':target.name)+' y recupera '+Math.max(1,heal)+' de vida.');
          healOnly = true;
        } else if(myChar.cls==='barbaro'){
          pushLog(party,'ok', myChar.name+' entra en Furia: el proximo golpe que reciba sera la mitad de daño.');
          sc.halfDamageFor = playerId;
          healOnly = true;
        } else {
          const roll = resolveRoll(clientRoll);
          const rk = rollKind(roll);
          const autoHit = myChar.cls==='explorador' || myChar.cls==='monje';
          if(rk==='fumble' && !autoHit) hit = false;
          else if(rk==='crit' || autoHit) hit = true;
          else hit = (roll+atkStat) >= enemy.ac;
          if(myChar.cls==='monje'){ dmg = rollDie(6)+rollDie(6)+atkStat; }
          else {
            const wDie = cd.weaponDie || 8;
            dmg = rollDie(wDie) + atkStat + (myChar.cls==='guerrero'?4:0) + (myChar.cls==='paladin'?4:0) + (rk==='crit'?rollDie(wDie):0);
          }
          if(myChar.cls==='picaro' && !sc.firstStrikeUsed) dmg *= 2;
          const flair = rk==='crit' ? ' ¡GOLPE CRITICO!' : (rk==='fumble' && !autoHit ? ' ¡PIFIA NATURAL!' : '');
          pushLog(party, hit?'ok':'bad', myChar.name+' usa su habilidad especial:'+flair+' '+(hit?'impacto por '+dmg+' de daño.':'aun asi falla.'));
          if(myChar.cls==='paladin' && hit){
            const heal = rollDie(4)+rollDie(4);
            myChar.hp = Math.min(myChar.maxHp, myChar.hp+heal);
            pushLog(party,'ok', myChar.name+' canaliza poder sagrado y recupera '+heal+' de vida.');
          }
        }
      } else {
        const roll = resolveRoll(clientRoll);
        const rk = rollKind(roll);
        const total = roll+atkStat;
        if(rk==='fumble'){
          hit = false;
          pushLog(party,'bad', myChar.name+' ataca: d20(1) — ¡PIFIA NATURAL! Falla automaticamente, pase lo que pase el modificador.');
        } else if(rk==='crit'){
          hit = true;
          pushLog(party,'ok', myChar.name+' ataca: d20(20) — ¡GOLPE CRITICO! Impacto automatico.');
        } else {
          hit = total >= enemy.ac;
          pushLog(party, hit?'ok':'bad', myChar.name+' ataca: d20('+roll+')'+fmtMod(atkStat)+' = '+total+' vs CA '+enemy.ac+' -> '+(hit?'Impacto!':'Falla'));
        }
        if(hit){
          const wDie = cd.weaponDie || 8;
          dmg = rollDie(wDie) + atkStat + (rk==='crit' ? rollDie(wDie) : 0);
          if(rk==='crit') pushLog(party,'ok','El critico duplica el dado de daño!');
          if(myChar.cls==='picaro' && !sc.firstStrikeUsed){ dmg*=2; pushLog(party,'ok','Golpe Furtivo: daño duplicado!'); }
          pushLog(party,'ok', myChar.name+' inflige '+dmg+' de daño con su '+cd.weapon.toLowerCase()+'.');
        }
      }

      if(!healOnly){
        if(!sc.attackedIds.includes(playerId)) sc.attackedIds.push(playerId);
        sc.firstStrikeUsed = true;
        if(hit) enemy.hp -= dmg;

        if(enemy.hp<=0){
          pushLog(party,'ok', enemy.name+' ha sido derrotado por '+myChar.name+'!');
          pushDM(party, 'victoria');
          const leveled = gainXpAndItem(party, playerId, enemy.xp, null);
          if(leveled) pushLog(party,'ok', leveled);
          advanceTurn(party);
          return { ok:true };
        }
      }

      sc.combatIdx = (sc.combatIdx+1) % combatOrder.length;
      resolveEnemyIfCurrent(party, sc);
      return { ok:true };

    } else if(kind==='defend'){
      pushLog(party,'sys', myChar.name+' se cubre y se prepara para amortiguar el golpe.');
      sc.halfDamageFor = playerId;
      sc.combatIdx = (sc.combatIdx+1) % combatOrder.length;
      resolveEnemyIfCurrent(party, sc);
      return { ok:true };

    } else if(kind==='usepotion'){
      const potionName = 'Pocion menor de curacion';
      const idx = myChar.inventory.indexOf(potionName);
      if(idx===-1) return { error:'No tenes pociones para usar.' };
      const target = resolveHealTarget(party, sc, playerId, targetId);
      myChar.inventory.splice(idx,1);
      const heal = rollDie(4)+rollDie(4)+2; // las pociones de curacion usan D4 segun las reglas
      const wasDowned = target.hp<=0;
      target.hp = Math.min(target.maxHp, target.hp+heal);
      if(target===myChar){
        pushLog(party,'ok', myChar.name+' bebe una pocion y recupera '+heal+' de vida.');
      } else {
        pushLog(party,'ok', myChar.name+' le da una pocion a '+target.name+(wasDowned?', reanimandolo/a':'')+' — recupera '+heal+' de vida.');
      }
      sc.combatIdx = (sc.combatIdx+1) % combatOrder.length;
      resolveEnemyIfCurrent(party, sc);
      return { ok:true };

    } else if(kind==='flee'){
      const roll = resolveRoll(clientRoll);
      const rk = rollKind(roll);
      const modv = mod(myChar.stats.DES);
      let success;
      if(rk==='fumble') success=false;
      else if(rk==='crit') success=true;
      else success = (roll+modv) >= 12;
      const flair = rk==='crit' ? ' ¡GOLPE DE SUERTE!' : (rk==='fumble' ? ' ¡PIFIA NATURAL!' : '');
      pushLog(party, success?'ok':'bad', myChar.name+' intenta huir:'+flair+' d20('+roll+')'+fmtMod(modv)+' -> '+(success?'Escapa!':'No logra escapar.'));
      if(success) sc.fledIds.push(playerId);
      sc.combatIdx = (sc.combatIdx+1) % combatOrder.length;
      resolveEnemyIfCurrent(party, sc);
      return { ok:true };
    }
    return { error:'Accion invalida para combate.' };
  }

  // escenas no-combate
  if(sc.type==='hallazgo'){
    if(kind==='collect'){
      const item = ITEMS[Math.floor(Math.random()*ITEMS.length)];
      pushLog(party,'ok', myChar.name+' revuelve entre los escombros y encuentra: '+item+'.');
      const leveled = gainXpAndItem(party, playerId, 10, item);
      if(leveled) pushLog(party,'ok', leveled);
      advanceTurn(party);
      return { ok:true };
    } else if(kind==='skip'){
      pushLog(party,'sys', myChar.name+' decide no perder tiempo y avanza.');
      advanceTurn(party);
      return { ok:true };
    }
    return { error:'Accion invalida.' };
  }

  if(sc.type==='puerta'){
    if(kind==='search_key'){
      const roll = resolveRoll(clientRoll);
      const rk = rollKind(roll);
      const modVal = mod(myChar.stats.INT);
      let success;
      if(rk==='fumble') success=false; else if(rk==='crit') success=true; else success=(roll+modVal)>=13;
      const flair = rk==='crit' ? ' ¡NATURAL 20!' : (rk==='fumble' ? ' ¡PIFIA NATURAL!' : '');
      pushLog(party, success?'ok':'bad', myChar.name+' busca la llave:'+flair+' d20('+roll+')'+fmtMod(modVal)+' -> '+(success?'La encuentra!':'No la encuentra.'));
      if(success){
        pushLog(party,'ok', 'Con la llave en mano, abris la puerta sin problemas.');
        const leveled = gainXpAndItem(party, playerId, 15, null);
        if(leveled) pushLog(party,'ok', leveled);
      } else {
        pushLog(party,'bad', 'Buscas un buen rato sin suerte; perdes tiempo pero no te lastimas.');
      }
      advanceTurn(party);
      return { ok:true };
    } else if(kind==='force_door'){
      const roll = resolveRoll(clientRoll);
      const rk = rollKind(roll);
      const modVal = mod(myChar.stats.FUE);
      let success;
      if(rk==='fumble') success=false; else if(rk==='crit') success=true; else success=(roll+modVal)>=14;
      const flair = rk==='crit' ? ' ¡NATURAL 20!' : (rk==='fumble' ? ' ¡PIFIA NATURAL!' : '');
      pushLog(party, success?'ok':'bad', myChar.name+' fuerza la puerta:'+flair+' d20('+roll+')'+fmtMod(modVal)+' -> '+(success?'Cede de un golpe!':'No cede.'));
      if(success){
        pushLog(party,'ok', 'La puerta revienta hacia adentro entre astillas.');
        const leveled = gainXpAndItem(party, playerId, 20, null);
        if(leveled) pushLog(party,'ok', leveled);
      } else {
        const dmg = rollDie(4);
        const newHp = damagePlayer(party, playerId, dmg);
        pushLog(party,'bad', 'Te lastimas el hombro en el intento y recibis '+dmg+' de daño.');
        if(newHp<=0) pushLog(party,'bad', myChar.name+' cae inconsciente. Necesita que alguien lo/la reanime con una pocion o con curacion.');
      }
      advanceTurn(party);
      return { ok:true };
    } else if(kind==='skip'){
      pushLog(party,'sys', myChar.name+' decide no arriesgarse con la puerta y toma otro camino.');
      advanceTurn(party);
      return { ok:true };
    }
    return { error:'Accion invalida.' };
  }

  if(kind==='use_item'){
    if(sc.type==='combate' || sc.type==='puerta' || sc.type==='hallazgo' || sc.type==='bifurcacion'){
      return { error:'No es el momento de usar eso.' };
    }
    const def = USABLE_SCENE_ITEMS[itemName];
    if(!def || !def.scenes.includes(sc.type)) return { error:'Eso no te sirve en esta situacion.' };
    const idx = myChar.inventory.indexOf(itemName);
    if(idx===-1) return { error:'No tenes ese objeto.' };
    if(sc.dcReduction) return { error:'Ya usaste algo para ayudarte en esta escena.' };
    myChar.inventory.splice(idx,1);
    sc.dcReduction = def.bonus;
    pushLog(party,'ok', myChar.name+' usa su '+itemName.toLowerCase()+': '+def.desc+' (la dificultad de la prueba baja '+def.bonus+' puntos).');
    return { ok:true };
  }

  // social / exploracion / trampa
  if(kind==='check' || kind==='check_alt'){
    const useAlt = kind==='check_alt';
    const abil = useAlt ? (ALT_ABIL_BY_TYPE[sc.type]||sc.abil) : sc.abil;
    const dc = Math.max(5, (useAlt ? sc.dc + 2 : sc.dc) - (sc.dcReduction||0));
    const modVal = mod(myChar.stats[abil]);
    const roll = resolveRoll(clientRoll);
    const rk = rollKind(roll);
    const total = roll+modVal;
    let success;
    if(rk==='fumble') success=false;
    else if(rk==='crit') success=true;
    else success = total >= dc;
    const prefix = useAlt ? 'Con un enfoque distinto, ' : '';
    const flair = rk==='crit' ? ' ¡NATURAL 20!' : (rk==='fumble' ? ' ¡PIFIA NATURAL!' : '');
    pushLog(party, success?'ok':'bad', prefix+myChar.name+' tira '+abil+':'+flair+' d20('+roll+')'+fmtMod(modVal)+' = '+total+' vs CD '+dc+' -> '+(success?'Exito!':'Fallo'));
    if(success){
      pushLog(party,'ok', sc.success);
      const item = Math.random()<0.4 ? ITEMS[Math.floor(Math.random()*ITEMS.length)] : null;
      const leveled = gainXpAndItem(party, playerId, 20, item);
      if(item) pushLog(party,'ok', myChar.name+' consigue: '+item+'.');
      if(leveled) pushLog(party,'ok', leveled);
    } else {
      pushLog(party,'bad', sc.fail);
      if(sc.type!=='social'){
        const dmg = rollDie(6);
        const newHp = damagePlayer(party, playerId, dmg);
        pushLog(party,'bad', myChar.name+' recibe '+dmg+' de daño.');
        if(newHp<=0) pushLog(party,'bad', myChar.name+' cae inconsciente. Necesita que alguien lo/la reanime con una pocion o con curacion.');
      }
    }
    advanceTurn(party);
    return { ok:true };
  } else if(kind==='skip'){
    pushLog(party,'sys', myChar.name+' prefiere no arriesgarse y avanza.');
    advanceTurn(party);
    return { ok:true };
  }
  return { error:'Accion invalida.' };
}

/* ===================== SOCKET.IO ===================== */

io.on('connection', (socket)=>{
  let joinedCode = null;
  let joinedPlayerId = null;

  socket.on('join', ({code, playerId})=>{
    code = sanitizeCode(code);
    if(!code || !playerId) return;
    joinedCode = code;
    joinedPlayerId = playerId;
    socket.join(code);
    const party = getParty(code);
    socket.emit('state', party);
  });

  socket.on('publish_character', ({code, playerId, character})=>{
    code = sanitizeCode(code);
    const party = getParty(code);
    const existing = party.characters[playerId];
    character.playerId = playerId;
    character.mapPos = existing ? existing.mapPos : -1;
    character.lastRoomType = existing ? existing.lastRoomType : null;
    party.characters[playerId] = character;
    ensureInQueue(party, playerId);
    pushLog(party, 'sys', (character.name||'Un jugador')+' se unio a la fiesta.');
    broadcastParty(code);
  });

  socket.on('chat_send', ({code, playerId, name, text})=>{
    code = sanitizeCode(code);
    const party = getParty(code);
    if(!text || !text.trim()) return;
    party.chat.push({ playerId, name: name||'Anonimo', text: String(text).slice(0,500), ts: Date.now() });
    if(party.chat.length > 200) party.chat.shift();
    broadcastParty(code);
  });

  socket.on('start_turn', ({code, playerId})=>{
    code = sanitizeCode(code);
    const party = getParty(code);
    const result = startTurnForPlayer(party, playerId);
    if(result.error){ socket.emit('action_error', result.error); return; }
    broadcastParty(code);
  });

  socket.on('action', ({code, playerId, kind, clientRoll, targetId, itemName})=>{
    code = sanitizeCode(code);
    const party = getParty(code);
    const result = doAction(party, playerId, kind, clientRoll, targetId, itemName);
    if(result.error){ socket.emit('action_error', result.error); return; }
    broadcastParty(code);
  });

  // comer raciones de viaje — funciona en cualquier momento, no requiere escena activa
  socket.on('eat_rations', ({code, playerId})=>{
    code = sanitizeCode(code);
    const party = getParty(code);
    const c = party.characters[playerId];
    if(!c){ socket.emit('action_error','No tenes personaje publicado.'); return; }
    if(c.hp<=0){ socket.emit('action_error','Estas caido, no podes comer ahora.'); return; }
    if(c.hp>=c.maxHp){ socket.emit('action_error','Ya estas con la vida al maximo.'); return; }
    const idx = c.inventory.indexOf('Raciones de viaje');
    if(idx===-1){ socket.emit('action_error','No tenes raciones de viaje.'); return; }
    c.inventory.splice(idx,1);
    const heal = rollDie(4);
    c.hp = Math.min(c.maxHp, c.hp+heal);
    pushLog(party,'ok', c.name+' come sus raciones de viaje y recupera '+heal+' de vida.');
    broadcastParty(code);
  });

  // reanimar a un aliado caido con una pocion — funciona en cualquier momento, no requiere
  // que haya una escena de combate activa (por si alguien cae fuera de una pelea).
  socket.on('revive', ({code, playerId, targetId})=>{
    code = sanitizeCode(code);
    const party = getParty(code);
    const reviver = party.characters[playerId];
    const target = party.characters[targetId];
    if(!reviver){ socket.emit('action_error','No tenes personaje publicado.'); return; }
    if(!target){ socket.emit('action_error','Ese personaje no existe.'); return; }
    if(reviver.hp<=0){ socket.emit('action_error','Estas caido, no podes ayudar a nadie ahora.'); return; }
    if(target.hp>0){ socket.emit('action_error', target.name+' no esta caido.'); return; }
    const idx = reviver.inventory.indexOf('Pocion menor de curacion');
    if(idx===-1){ socket.emit('action_error','No tenes pociones para usar.'); return; }
    reviver.inventory.splice(idx,1);
    const heal = rollDie(4)+rollDie(4)+2;
    target.hp = Math.min(target.maxHp, heal);
    pushLog(party, 'ok', reviver.name+' usa una pocion en '+target.name+' y lo/la reanima con '+heal+' de vida.');
    broadcastParty(code);
  });

  socket.on('leave', ({code})=>{
    if(code) socket.leave(sanitizeCode(code));
  });

  // Clasificacion de intencion via IA (OpenAI) — NO modifica el estado de la partida.
  // Solo le dice al cliente cual de las opciones ya disponibles conviene ejecutar; el
  // cliente sigue disparando la accion real por el canal 'action' de siempre, que es
  // donde vive toda la logica de reglas/dados/daño (el server sigue siendo la autoridad).
  socket.on('classify_intent', async (payload, ack)=>{
    if(typeof ack !== 'function') return;
    if(!AI_DM_ENABLED){ ack({disabled:true}); return; }
    try{
      const { text, options, scene } = payload || {};
      if(!text || !String(text).trim() || !Array.isArray(options) || !options.length){
        ack({disabled:false, kind:'none'});
        return;
      }
      const result = await classifyPlayerIntent(text, options, scene);
      ack({ disabled:false, kind: result.kind, narration: result.narration });
    } catch(err){
      console.error('classify_intent error:', err.message);
      ack({ disabled:false, error:true });
    }
  });

  socket.on('disconnect', ()=>{});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>{
  console.log('Cripta de Nazhi corriendo en el puerto '+PORT);
});
