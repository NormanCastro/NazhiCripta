const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

/* ===================== DATOS DE JUEGO (autoritativos, en el servidor) ===================== */

const CLASSES = {
  guerrero:{ hitDie:10, primary:'FUE', specialName:'Golpe Firme' },
  mago:{ hitDie:6, primary:'INT', specialName:'Dardo Arcano' },
  picaro:{ hitDie:8, primary:'DES', specialName:'Golpe Furtivo' },
  clerigo:{ hitDie:8, primary:'SAB', specialName:'Palabra Sagrada' },
  barbaro:{ hitDie:12, primary:'FUE', specialName:'Furia' },
  explorador:{ hitDie:10, primary:'DES', specialName:'Tiro Certero' },
  paladin:{ hitDie:10, primary:'FUE', specialName:'Golpe Sagrado' },
  bardo:{ hitDie:8, primary:'CAR', specialName:'Cancion Inspiradora' },
  druida:{ hitDie:8, primary:'SAB', specialName:'Forma Salvaje' },
  monje:{ hitDie:8, primary:'DES', specialName:'Golpe Certero' }
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
const SCENE_TYPES = ['combate','social','exploracion','trampa','hallazgo','puerta'];
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
    turnOrder: [],
    turnIndex: 0,
    usedSpecialThisScene: false,
    sceneFirstHit: true,
    enemyActsFirst: false,
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
    'El Dungeon Master alza una ceja: algo se mueve en las sombras. Tirá iniciativa.',
    'Sentís un escalofrío. El DM sonrie: "Preparate, esto se pone interesante." Tirá iniciativa.',
    'El aire se vuelve tenso. El DM susurra: "Tirá iniciativa antes de que sea tarde."',
    'El DM golpea la mesa con dos dedos: "Combate. Ya sabes que hacer: tirá iniciativa."'
  ],
  social: [
    'El DM te mira por encima de la pantalla: "Alguien quiere hablar con vos. ¿Como lo encaras?"',
    'Frente a vos hay alguien con quien podrias negociar. El DM espera tu decision.',
    'El DM sonrie con picardia: "Las palabras tambien son un arma. Usalas bien."'
  ],
  exploracion: [
    'El DM describe el entorno con cuidado: hay algo que requiere tu atencion.',
    '"Presta atencion a los detalles", dice el DM. "Este lugar esconde algo."',
    'El DM entrecierra los ojos mientras narra: el ambiente se siente cargado de historia.'
  ],
  trampa: [
    'El DM entrecierra los ojos: "Cuidado donde pisas."',
    'Algo no se siente bien en esta sala. El DM te lo advierte con la mirada.',
    'El DM sonrie de costado: "Esto podria salir mal si no tenes cuidado."'
  ],
  hallazgo: [
    'El DM señala un rincon: "Podria haber algo de valor ahi."',
    'El DM se queda callado un segundo, dejando que la curiosidad haga su trabajo.'
  ],
  puerta: [
    'El DM golpea la mesa: "Una puerta cerrada. ¿Como la resolves?"',
    'El DM te mira fijo: "Llave, fuerza, u otro camino. Vos decidis."'
  ],
  decision: [
    '¿Que haces? ¿Avanzas con cautela, te escondes, o atacas directo?',
    'El DM espera: ¿tu personaje actua con cabeza fria o se lanza de lleno?',
    'Tenes la palabra. ¿Como reacciona tu personaje ante esto?'
  ],
  victoria: [
    'El DM asiente, satisfecho: "Bien hecho, aventurero."',
    '"Impresionante", murmura el DM mientras anota algo en sus notas.',
    'El DM sonrie: "Uno menos. La cripta sigue esperando."'
  ],
  nivel: [
    'El DM sonrie: "Se nota que estas mejorando."',
    'El DM cierra su libreta un momento: "Estas mas fuerte que cuando empezaste."'
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

function broadcastParty(code){
  const party = parties[code];
  if(!party) return;
  party.updatedAt = Date.now();
  io.to(code).emit('state', party);
}

function currentTurnOrder(party){
  return party.turnOrder && party.turnOrder.length ? party.turnOrder : Object.keys(party.characters).sort();
}
function activePlayerId(party){
  const order = currentTurnOrder(party);
  if(!order.length) return null;
  return order[party.turnIndex % order.length];
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
  party.turnOrder = currentTurnOrder(party);
  party.status = 'idle';
  party.currentScene = null;
  party.turnIndex = (party.turnIndex||0) + 1;
}

function enemyTurn(party, playerId, furyActive){
  const sc = party.currentScene;
  if(!sc || !sc.enemy) return;
  const enemy = sc.enemy;
  const c = party.characters[playerId];
  const roll = rollDie(20);
  const total = roll + enemy.atk;
  const hit = total >= c.ac;
  pushLog(party, hit?'bad':'sys', enemy.name+' ataca a '+c.name+': d20('+roll+')+'+enemy.atk+' = '+total+' vs CA '+c.ac+' -> '+(hit?'golpea':'falla'));
  if(hit){
    let dmg = enemy.dmg.length===3 ? rollDie(enemy.dmg[1])+enemy.dmg[2] : rollDie(enemy.dmg[1]);
    if(furyActive){ dmg = Math.ceil(dmg/2); pushLog(party,'sys','La Furia reduce el golpe a la mitad.'); }
    const newHp = damagePlayer(party, playerId, dmg);
    pushLog(party, 'bad', c.name+' recibe '+dmg+' de daño.');
    if(newHp<=0){
      pushLog(party, 'bad', c.name+' cae, pero tras un breve respiro recupera fuerzas.');
      c.hp = c.maxHp;
      advanceTurn(party);
    }
  }
}

function startTurnForPlayer(party, playerId){
  if(party.status !== 'idle' || party.currentScene){
    return { error: 'Ya hay una escena en curso en esta fiesta.' };
  }
  const order = currentTurnOrder(party);
  const active = order.length ? order[party.turnIndex % order.length] : playerId;
  if(order.length && active !== playerId) return { error: 'No es tu turno.' };
  const myChar = party.characters[playerId];
  if(!myChar) return { error: 'No tenes personaje publicado en esta fiesta.' };

  const nextMapPos = (typeof myChar.mapPos==='number' && myChar.mapPos>=0) ? (myChar.mapPos+1) % MAP_POINTS_LEN : 0;
  const guardBias = GUARD_ROOM_INDEXES.includes(nextMapPos) && Math.random() < 0.6;
  const type = guardBias ? 'combate' : SCENE_TYPES[Math.floor(Math.random()*SCENE_TYPES.length)];
  let scene;
  if(type==='combate'){
    const base = guardBias ? GUARD_ENEMY : ENEMIES[Math.floor(Math.random()*ENEMIES.length)];
    const enemy = Object.assign({}, base, {maxHp: base.hp + (myChar.level-1)*4});
    enemy.hp = enemy.maxHp;
    const title = guardBias ? 'Un guardia te corta el paso!' : 'Emboscada! '+enemy.name;
    const text = guardBias ? 'Un guardia de la cripta, armado con espada y escudo, se planta frente a vos.' : 'Un '+enemy.name.toLowerCase()+' corta el paso.';
    scene = {type:'combate', title, text, enemy};
  } else if(type==='social'){
    scene = Object.assign({type:'social'}, SOCIAL_SCENES[Math.floor(Math.random()*SOCIAL_SCENES.length)]);
  } else if(type==='exploracion'){
    scene = Object.assign({type:'exploracion'}, EXPLORE_SCENES[Math.floor(Math.random()*EXPLORE_SCENES.length)]);
  } else if(type==='trampa'){
    scene = Object.assign({type:'trampa'}, TRAP_SCENES[Math.floor(Math.random()*TRAP_SCENES.length)]);
  } else if(type==='puerta'){
    scene = {type:'puerta', title:'Puerta cerrada', text:'Una pesada puerta de roble y hierro bloquea el paso. Podes buscar una llave escondida, forzarla, o tomar otro camino.'};
  } else {
    scene = {type:'hallazgo', title:'Un hallazgo silencioso', text:'Esta sala esta vacia, pero algo brilla entre los escombros.'};
  }

  pushLog(party, 'sys', myChar.name+' explora una nueva sala...');
  pushDM(party, scene.type);
  party.status = scene.type==='combate' ? 'combat' : 'event';
  party.currentScene = scene;
  party.turnOrder = order;
  party.usedSpecialThisScene = false;
  party.sceneFirstHit = true;
  party.enemyActsFirst = false;
  party.totalRooms = (party.totalRooms||0) + 1;
  party.roomHistory = (party.roomHistory||[]);
  party.roomHistory.push({type: scene.type, n: party.totalRooms});
  if(party.roomHistory.length > 10) party.roomHistory.shift();

  // avanza el token de ESTE jugador en el mapa (cada personaje tiene su propia posicion)
  myChar.mapPos = nextMapPos;
  myChar.lastRoomType = scene.type;

  // niebla: se despeja para toda la fiesta por donde alguien ya paso
  party.fogRevealed = party.fogRevealed || [];
  if(!party.fogRevealed.includes(myChar.mapPos)) party.fogRevealed.push(myChar.mapPos);

  if(scene.type==='combate'){
    const playerRoll = rollDie(20);
    const playerInit = playerRoll + mod(myChar.stats.DES);
    const enemyRoll = rollDie(20);
    const enemyInit = enemyRoll + (scene.enemy.init||0);
    party.enemyActsFirst = enemyInit > playerInit;
    pushLog(party, 'sys', 'Iniciativa: '+myChar.name+' d20('+playerRoll+')'+fmtMod(mod(myChar.stats.DES))+' = '+playerInit+' vs '+scene.enemy.name+' d20('+enemyRoll+')'+fmtMod(scene.enemy.init||0)+' = '+enemyInit+' -> actua primero: '+(party.enemyActsFirst?scene.enemy.name:myChar.name));
    if(party.enemyActsFirst){
      enemyTurn(party, playerId, false);
    }
  }
  return { ok:true };
}

function doAction(party, playerId, kind, clientRoll){
  const myChar = party.characters[playerId];
  if(!myChar) return { error:'No tenes personaje publicado.' };
  const order = currentTurnOrder(party);
  const active = order.length ? order[party.turnIndex % order.length] : playerId;
  if(order.length && active !== playerId) return { error:'No es tu turno.' };
  const sc = party.currentScene;
  if(!sc) return { error:'No hay escena activa.' };

  if(sc.type==='combate'){
    if(kind==='attack' || kind==='special'){
      const useSpecial = kind==='special';
      const cd = CLASSES[myChar.cls];
      const atkStat = mod(myChar.stats[cd.primary]);
      const enemy = sc.enemy;
      let hit = true, dmg = 0;

      if(useSpecial){
        if(party.usedSpecialThisScene) return { error:'Ya usaste tu habilidad especial en esta escena.' };
        if(myChar.cls==='mago'){
          dmg = rollDie(6)+rollDie(6);
          pushLog(party,'ok', myChar.name+' lanza Dardo Arcano: '+dmg+' de daño magico.');
        } else if(myChar.cls==='druida'){
          dmg = rollDie(8)+rollDie(8);
          pushLog(party,'ok', myChar.name+' invoca Forma Salvaje: un zarpazo de '+dmg+' de daño.');
        } else if(myChar.cls==='clerigo'){
          const heal = rollDie(6)+rollDie(6)+mod(myChar.stats.SAB);
          myChar.hp = Math.min(myChar.maxHp, myChar.hp+heal);
          pushLog(party,'ok', myChar.name+' usa Palabra Sagrada y recupera '+heal+' de vida.');
          party.usedSpecialThisScene = true;
          return { ok:true };
        } else if(myChar.cls==='bardo'){
          const heal = rollDie(6)+mod(myChar.stats.CAR);
          myChar.hp = Math.min(myChar.maxHp, myChar.hp+Math.max(1,heal));
          pushLog(party,'ok', myChar.name+' entona su Cancion Inspiradora y recupera '+Math.max(1,heal)+' de vida.');
          party.usedSpecialThisScene = true;
          return { ok:true };
        } else if(myChar.cls==='barbaro'){
          pushLog(party,'ok', myChar.name+' entra en Furia: el proximo golpe le hara la mitad de daño.');
          party.usedSpecialThisScene = true;
          enemyTurn(party, playerId, true);
          return { ok:true };
        } else {
          const roll = resolveRoll(clientRoll);
          const rk = rollKind(roll);
          const autoHit = myChar.cls==='explorador' || myChar.cls==='monje';
          if(rk==='fumble' && !autoHit) hit = false;
          else if(rk==='crit' || autoHit) hit = true;
          else hit = (roll+atkStat) >= enemy.ac;
          if(myChar.cls==='monje'){ dmg = rollDie(6)+rollDie(6)+atkStat; }
          else { dmg = rollDie(8) + atkStat + (myChar.cls==='guerrero'?4:0) + (myChar.cls==='paladin'?4:0) + (rk==='crit'?rollDie(8):0); }
          if(myChar.cls==='picaro' && party.sceneFirstHit) dmg *= 2;
          const flair = rk==='crit' ? ' ¡GOLPE CRITICO!' : (rk==='fumble' && !autoHit ? ' ¡PIFIA NATURAL!' : '');
          pushLog(party, hit?'ok':'bad', myChar.name+' usa su habilidad especial:'+flair+' '+(hit?'impacto por '+dmg+' de daño.':'aun asi falla.'));
          if(myChar.cls==='paladin' && hit){
            const heal = rollDie(4)+rollDie(4);
            myChar.hp = Math.min(myChar.maxHp, myChar.hp+heal);
            pushLog(party,'ok', myChar.name+' canaliza poder sagrado y recupera '+heal+' de vida.');
          }
        }
        party.usedSpecialThisScene = true;
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
          dmg = rollDie(8) + atkStat + (rk==='crit' ? rollDie(8) : 0);
          if(rk==='crit') pushLog(party,'ok','El critico duplica el dado de daño!');
          if(myChar.cls==='picaro' && party.sceneFirstHit){ dmg*=2; pushLog(party,'ok','Golpe Furtivo: daño duplicado!'); }
          pushLog(party,'ok', myChar.name+' inflige '+dmg+' de daño.');
        }
      }

      if(hit) enemy.hp -= dmg;
      party.sceneFirstHit = false;

      if(enemy.hp<=0){
        pushLog(party,'ok', enemy.name+' ha sido derrotado por '+myChar.name+'!');
        pushDM(party, 'victoria');
        const leveled = gainXpAndItem(party, playerId, enemy.xp, null);
        if(leveled) pushLog(party,'ok', leveled);
        advanceTurn(party);
        return { ok:true };
      }
      enemyTurn(party, playerId, false);
      return { ok:true };

    } else if(kind==='defend'){
      pushLog(party,'sys', myChar.name+' se cubre y se prepara para amortiguar el golpe.');
      party.sceneFirstHit = false;
      enemyTurn(party, playerId, true);
      return { ok:true };

    } else if(kind==='usepotion'){
      const potionName = 'Pocion menor de curacion';
      const idx = myChar.inventory.indexOf(potionName);
      if(idx===-1) return { error:'No tenes pociones para usar.' };
      myChar.inventory.splice(idx,1);
      const heal = rollDie(8)+2;
      myChar.hp = Math.min(myChar.maxHp, myChar.hp+heal);
      pushLog(party,'ok', myChar.name+' bebe una pocion y recupera '+heal+' de vida.');
      party.sceneFirstHit = false;
      enemyTurn(party, playerId, false);
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
      if(success){ advanceTurn(party); }
      else { enemyTurn(party, playerId, false); }
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
        damagePlayer(party, playerId, dmg);
        pushLog(party,'bad', 'Te lastimas el hombro en el intento y recibis '+dmg+' de daño.');
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

  // social / exploracion / trampa
  if(kind==='check' || kind==='check_alt'){
    const useAlt = kind==='check_alt';
    const abil = useAlt ? (ALT_ABIL_BY_TYPE[sc.type]||sc.abil) : sc.abil;
    const dc = useAlt ? sc.dc + 2 : sc.dc;
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
        damagePlayer(party, playerId, dmg);
        pushLog(party,'bad', myChar.name+' recibe '+dmg+' de daño.');
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

  socket.on('action', ({code, playerId, kind, clientRoll})=>{
    code = sanitizeCode(code);
    const party = getParty(code);
    const result = doAction(party, playerId, kind, clientRoll);
    if(result.error){ socket.emit('action_error', result.error); return; }
    broadcastParty(code);
  });

  socket.on('leave', ({code})=>{
    if(code) socket.leave(sanitizeCode(code));
  });

  socket.on('disconnect', ()=>{});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>{
  console.log('Cripta de Nazhi corriendo en el puerto '+PORT);
});
