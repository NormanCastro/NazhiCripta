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
  explorador:{ hitDie:10, primary:'DES', specialName:'Tiro Certero' }
};

const ENEMIES = [
  {name:'Rata gigante', hp:9, ac:11, atk:2, dmg:[1,4], xp:15, init:2},
  {name:'Bandido', hp:14, ac:12, atk:3, dmg:[1,6], xp:25, init:1},
  {name:'Esqueleto errante', hp:13, ac:13, atk:3, dmg:[1,6], xp:25, init:0},
  {name:'Lobo de las sombras', hp:16, ac:12, atk:4, dmg:[1,8], xp:30, init:3},
  {name:'Cultista menor', hp:12, ac:11, atk:2, dmg:[1,4,1], xp:20, init:1},
  {name:'Ogro joven', hp:28, ac:13, atk:5, dmg:[2,6], xp:50, init:-1},
  {name:'Araña venenosa', hp:11, ac:14, atk:3, dmg:[1,6], xp:22, init:3}
];

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
const SCENE_TYPES = ['combate','social','exploracion','trampa','hallazgo'];

function rollDie(sides){ return 1 + Math.floor(Math.random()*sides); }
function mod(val){ return Math.floor((val-10)/2); }
function fmtMod(m){ return m>=0? '+'+m : ''+m; }

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

  const type = SCENE_TYPES[Math.floor(Math.random()*SCENE_TYPES.length)];
  let scene;
  if(type==='combate'){
    const base = ENEMIES[Math.floor(Math.random()*ENEMIES.length)];
    const enemy = Object.assign({}, base, {maxHp: base.hp + (myChar.level-1)*4});
    enemy.hp = enemy.maxHp;
    scene = {type:'combate', title:'Emboscada! '+enemy.name, text:'Un '+enemy.name.toLowerCase()+' corta el paso.', enemy};
  } else if(type==='social'){
    scene = Object.assign({type:'social'}, SOCIAL_SCENES[Math.floor(Math.random()*SOCIAL_SCENES.length)]);
  } else if(type==='exploracion'){
    scene = Object.assign({type:'exploracion'}, EXPLORE_SCENES[Math.floor(Math.random()*EXPLORE_SCENES.length)]);
  } else if(type==='trampa'){
    scene = Object.assign({type:'trampa'}, TRAP_SCENES[Math.floor(Math.random()*TRAP_SCENES.length)]);
  } else {
    scene = {type:'hallazgo', title:'Un hallazgo silencioso', text:'Esta sala esta vacia, pero algo brilla entre los escombros.'};
  }

  pushLog(party, 'sys', myChar.name+' explora una nueva sala...');
  party.status = scene.type==='combate' ? 'combat' : 'event';
  party.currentScene = scene;
  party.turnOrder = order;
  party.usedSpecialThisScene = false;
  party.sceneFirstHit = true;
  party.enemyActsFirst = false;

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

function doAction(party, playerId, kind){
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
        } else if(myChar.cls==='clerigo'){
          const heal = rollDie(6)+rollDie(6)+mod(myChar.stats.SAB);
          myChar.hp = Math.min(myChar.maxHp, myChar.hp+heal);
          pushLog(party,'ok', myChar.name+' usa Palabra Sagrada y recupera '+heal+' de vida.');
          party.usedSpecialThisScene = true;
          return { ok:true };
        } else if(myChar.cls==='barbaro'){
          pushLog(party,'ok', myChar.name+' entra en Furia: el proximo golpe le hara la mitad de daño.');
          party.usedSpecialThisScene = true;
          enemyTurn(party, playerId, true);
          return { ok:true };
        } else {
          const roll = rollDie(20);
          hit = myChar.cls==='explorador' ? true : (roll+atkStat) >= enemy.ac;
          dmg = rollDie(8) + atkStat + (myChar.cls==='guerrero'?4:0);
          if(myChar.cls==='picaro' && party.sceneFirstHit) dmg *= 2;
          pushLog(party, hit?'ok':'bad', myChar.name+' usa su habilidad especial: '+(hit?'impacto por '+dmg+' de daño.':'aun asi falla.'));
        }
        party.usedSpecialThisScene = true;
      } else {
        const roll = rollDie(20);
        const total = roll+atkStat;
        hit = total >= enemy.ac;
        pushLog(party, hit?'ok':'bad', myChar.name+' ataca: d20('+roll+')'+fmtMod(atkStat)+' = '+total+' vs CA '+enemy.ac+' -> '+(hit?'Impacto!':'Falla'));
        if(hit){
          dmg = rollDie(8) + atkStat;
          if(myChar.cls==='picaro' && party.sceneFirstHit){ dmg*=2; pushLog(party,'ok','Golpe Furtivo: daño duplicado!'); }
          pushLog(party,'ok', myChar.name+' inflige '+dmg+' de daño.');
        }
      }

      if(hit) enemy.hp -= dmg;
      party.sceneFirstHit = false;

      if(enemy.hp<=0){
        pushLog(party,'ok', enemy.name+' ha sido derrotado por '+myChar.name+'!');
        const leveled = gainXpAndItem(party, playerId, enemy.xp, null);
        if(leveled) pushLog(party,'ok', leveled);
        advanceTurn(party);
        return { ok:true };
      }
      enemyTurn(party, playerId, false);
      return { ok:true };

    } else if(kind==='flee'){
      const roll = rollDie(20);
      const modv = mod(myChar.stats.DES);
      const success = (roll+modv) >= 12;
      pushLog(party, success?'ok':'bad', myChar.name+' intenta huir: d20('+roll+')'+fmtMod(modv)+' -> '+(success?'Escapa!':'No logra escapar.'));
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

  // social / exploracion / trampa
  if(kind==='check'){
    const modVal = mod(myChar.stats[sc.abil]);
    const roll = rollDie(20);
    const total = roll+modVal;
    const success = total >= sc.dc;
    pushLog(party, success?'ok':'bad', myChar.name+' tira '+sc.abil+': d20('+roll+')'+fmtMod(modVal)+' = '+total+' vs CD '+sc.dc+' -> '+(success?'Exito!':'Fallo'));
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
    character.playerId = playerId;
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

  socket.on('action', ({code, playerId, kind})=>{
    code = sanitizeCode(code);
    const party = getParty(code);
    const result = doAction(party, playerId, kind);
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
