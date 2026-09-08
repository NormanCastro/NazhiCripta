/* ================= DATOS (para UI del cliente) ================= */
const RACES = {
  humano:{name:'Humano', bonus:{FUE:1,DES:1,CON:1,INT:1,SAB:1,CAR:1}, desc:'Versatiles y ambiciosos, se adaptan a cualquier camino.'},
  elfo:{name:'Elfo', bonus:{DES:2}, desc:'Agiles y longevos, ligados a los bosques y la magia antigua.'},
  enano:{name:'Enano', bonus:{CON:2}, desc:'Resistentes forjadores de montaña, tercos y leales.'},
  mediano:{name:'Mediano', bonus:{DES:1,CAR:1}, desc:'Pequeños, afortunados y sorprendentemente valientes.'},
  orco:{name:'Orco', bonus:{FUE:2,CON:1}, desc:'Guerreros de fuerza descomunal y honor tribal.'},
  tiefling:{name:'Tiefling', bonus:{CAR:2,INT:1}, desc:'Marcados por un pacto ancestral, carismaticos y temidos.'}
};
const CLASSES = {
  guerrero:{name:'Guerrero', hitDie:10, primary:'FUE', desc:'Maestro del combate cuerpo a cuerpo, resistente y letal.', special:'Golpe Firme: una vez por combate, suma +4 a un ataque.'},
  mago:{name:'Mago', hitDie:6, primary:'INT', desc:'Estudioso de lo arcano, devastador con hechizos.', special:'Dardo Arcano: inflige 2d6 de daño magico ignorando armadura, una vez por combate.'},
  picaro:{name:'Picaro', hitDie:8, primary:'DES', desc:'Sigiloso, veloz y letal cuando nadie lo espera.', special:'Golpe Furtivo: si es su primer ataque en el combate, duplica el daño.'},
  clerigo:{name:'Clerigo', hitDie:8, primary:'SAB', desc:'Canaliza poder divino para sanar y proteger.', special:'Palabra Sagrada: cura 2d6+SAB puntos de vida, una vez por combate.'},
  barbaro:{name:'Barbaro', hitDie:12, primary:'FUE', desc:'Furia desatada; el mas resistente y salvaje en batalla.', special:'Furia: reduce el daño recibido a la mitad durante un turno, una vez por combate.'},
  explorador:{name:'Explorador', hitDie:10, primary:'DES', desc:'Cazador certero con el arco y conocedor del terreno.', special:'Tiro Certero: un ataque no puede fallar, una vez por combate.'}
};
const ABILS = ['FUE','DES','CON','INT','SAB','CAR'];
const ABIL_LABEL = {FUE:'Fuerza',DES:'Destreza',CON:'Constitucion',INT:'Inteligencia',SAB:'Sabiduria',CAR:'Carisma'};
const ORIGENES = [
  'crecio entre las callejuelas de un puerto comerciante, aprendiendo a sobrevivir con ingenio',
  'fue criado en un monasterio remoto, entre disciplina y silencio',
  'perdio a su familia en un incendio que aun visita sus pesadillas',
  'es el ultimo heredero de una casa noble caida en desgracia',
  'paso su infancia entre caravanas errantes, sin un hogar fijo',
  'fue entrenado desde niño por un mentor que desaparecio sin dejar rastro',
  'nacio en tierras fronterizas, entre dos reinos siempre al borde de la guerra',
  'fue encontrado de bebe en las ruinas de un templo olvidado'
];
const MOTIVACIONES = [
  'busca reunir el oro suficiente para reconstruir su pueblo natal',
  'quiere encontrar al responsable de la muerte de su mentor',
  'persigue un rumor sobre un tesoro perdido bajo las montañas',
  'huye de una deuda de sangre contraida en su juventud',
  'quiere probar que su nombre no esta maldito',
  'busca redimirse por un error que le costo caro a otros',
  'sueña con ser recordado en las canciones de los bardos',
  'protege un secreto de familia que nadie mas debe conocer'
];
const SECRETOS = [
  'lleva tatuado un simbolo que no recuerda haberse hecho',
  'una vez hizo un trato que todavia no ha terminado de pagar',
  'sabe leer un idioma antiguo que nadie mas reconoce',
  'tiene pesadillas recurrentes con una puerta de piedra',
  'guarda una carta sin abrir de alguien que creia muerto',
  'no puede recordar nada de los primeros diez años de su vida'
];

function rollDie(sides){ return 1 + Math.floor(Math.random()*sides); }
function rollMultiple(qty, sides){ const r=[]; for(let i=0;i<qty;i++) r.push(rollDie(sides)); return r; }
function mod(val){ return Math.floor((val-10)/2); }
function fmtMod(m){ return m>=0? '+'+m : ''+m; }

/* ================= ESTADO LOCAL (personaje solitario, antes de publicarlo) ================= */
let state = { race:null, cls:null, stats:null, name:'', story:'' };

function getPlayerId(){
  try{
    let id = localStorage.getItem('nazhi_player_id');
    if(!id){
      id = 'p_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g,'').slice(0,12) : (''+Date.now()+Math.random()).replace(/\D/g,'').slice(0,12));
      localStorage.setItem('nazhi_player_id', id);
    }
    return id;
  }catch(e){ return 'p_' + Math.random().toString(36).slice(2,10); }
}
function loadLocalChar(){
  try{
    const raw = localStorage.getItem('nazhi_solo_char');
    if(raw) state = JSON.parse(raw);
  }catch(e){}
}
function saveLocalChar(){
  try{ localStorage.setItem('nazhi_solo_char', JSON.stringify(state)); }catch(e){}
}

/* ================= TABS ================= */
document.getElementById('tabs').addEventListener('click', (e)=>{
  if(e.target.tagName!=='BUTTON') return;
  document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active');
  const tab = e.target.dataset.tab;
  document.querySelectorAll('.tab-content').forEach(s=>s.classList.add('hidden'));
  document.getElementById('tab-'+tab).classList.remove('hidden');
});

/* ================= TEMA ================= */
document.getElementById('themeToggle').addEventListener('click', ()=>{
  const cur = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', cur==='dark' ? 'light' : 'dark');
});

/* ================= CREACIÓN DE PERSONAJE ================= */
let selRace=null, selClass=null, rolledStats=null, generatedStory='';

function renderRaceGrid(){
  const grid = document.getElementById('raceGrid');
  grid.innerHTML='';
  Object.entries(RACES).forEach(([key,r])=>{
    const div = document.createElement('div');
    div.className='card';
    div.innerHTML = '<h3>'+r.name+'</h3><p>'+r.desc+'</p>';
    div.addEventListener('click', ()=>{
      selRace=key;
      grid.querySelectorAll('.card').forEach(c=>c.classList.remove('selected'));
      div.classList.add('selected');
      checkCreateReady();
    });
    grid.appendChild(div);
  });
}
function renderClassGrid(){
  const grid = document.getElementById('classGrid');
  grid.innerHTML='';
  Object.entries(CLASSES).forEach(([key,c])=>{
    const div = document.createElement('div');
    div.className='card';
    div.innerHTML = '<h3>'+c.name+'</h3><p>'+c.desc+'</p><p class="small-note">'+c.special+'</p>';
    div.addEventListener('click', ()=>{
      selClass=key;
      grid.querySelectorAll('.card').forEach(c2=>c2.classList.remove('selected'));
      div.classList.add('selected');
      checkCreateReady();
    });
    grid.appendChild(div);
  });
}

document.getElementById('rollStatsBtn').addEventListener('click', ()=>{
  const result = {};
  const raceBonus = selRace ? RACES[selRace].bonus : {};
  let html = '';
  ABILS.forEach(a=>{
    const rolls = rollMultiple(4,6).sort((x,y)=>y-x);
    const used = rolls.slice(0,3);
    const base = used.reduce((s,v)=>s+v,0);
    const withBonus = base + (raceBonus[a]||0);
    result[a]=withBonus;
    html += '<div class="stat-row"><span>'+ABIL_LABEL[a]+' <span class="small-note">(tirada: '+rolls.join(', ')+')</span></span><span class="stat-val">'+withBonus+' ('+fmtMod(mod(withBonus))+')</span></div>';
  });
  rolledStats = result;
  document.getElementById('statsResult').innerHTML = html + (selRace?'':'<p class="small-note">Elegi una raza para aplicar sus bonificaciones.</p>');
  checkCreateReady();
});

document.getElementById('genStoryBtn').addEventListener('click', ()=>{
  const origen = ORIGENES[Math.floor(Math.random()*ORIGENES.length)];
  const motivo = MOTIVACIONES[Math.floor(Math.random()*MOTIVACIONES.length)];
  const secreto = SECRETOS[Math.floor(Math.random()*SECRETOS.length)];
  const raceName = selRace ? RACES[selRace].name.toLowerCase() : 'aventurero';
  const clsName = selClass ? CLASSES[selClass].name.toLowerCase() : 'viajero';
  const nombre = document.getElementById('charName').value.trim() || 'Este heroe';
  generatedStory = nombre+', '+raceName+' de vocacion '+clsName+', '+origen+'. Hoy, '+motivo+'. Pocos saben que '+secreto+'.';
  document.getElementById('storyResult').innerHTML = '<p>'+generatedStory+'</p>';
  checkCreateReady();
});

function checkCreateReady(){
  const ready = selRace && selClass && rolledStats && generatedStory && document.getElementById('charName').value.trim();
  document.getElementById('createCharBtn').disabled = !ready;
}
document.getElementById('charName').addEventListener('input', checkCreateReady);

document.getElementById('createCharBtn').addEventListener('click', ()=>{
  const clsData = CLASSES[selClass];
  const conMod = mod(rolledStats.CON);
  state = {
    race: selRace, cls: selClass, stats: rolledStats,
    name: document.getElementById('charName').value.trim(), story: generatedStory,
    level:1, xp:0, xpNext:100,
    maxHp: clsData.hitDie + conMod + 4,
    hp: clsData.hitDie + conMod + 4,
    ac: 10 + mod(rolledStats.DES) + (selClass==='guerrero'?2:1),
    inventory: ['Raciones de viaje','Antorcha','Cuerda (15m)']
  };
  saveLocalChar();
  document.getElementById('createMsg').textContent = 'Personaje creado con exito! Ahora publicalo en la pestaña Fiesta.';
  renderSheet();
  updateCharBar();
  ['stepRace','stepClass','stepStats','stepName'].forEach(id=>document.getElementById(id).classList.add('hidden'));
  document.querySelector('#tab-personaje .panel.center').classList.add('hidden');
  document.getElementById('sheetPanel').classList.remove('hidden');
  updatePublishBlock();
});

document.getElementById('resetCharBtn').addEventListener('click', ()=>{
  if(!confirm('Seguro que queres borrar este personaje y crear uno nuevo?')) return;
  state = { race:null, cls:null, stats:null, name:'', story:'' };
  saveLocalChar();
  selRace=null; selClass=null; rolledStats=null; generatedStory='';
  document.getElementById('statsResult').innerHTML='';
  document.getElementById('storyResult').innerHTML='';
  document.getElementById('charName').value='';
  document.querySelectorAll('.card.selected').forEach(c=>c.classList.remove('selected'));
  document.getElementById('createCharBtn').disabled = true;
  document.getElementById('createMsg').textContent='';
  ['stepRace','stepClass','stepStats','stepName'].forEach(id=>document.getElementById(id).classList.remove('hidden'));
  document.querySelector('#tab-personaje .panel.center').classList.remove('hidden');
  document.getElementById('sheetPanel').classList.add('hidden');
  document.getElementById('charBar').classList.add('hidden');
  updatePublishBlock();
});

function renderSheet(){
  const c = CLASSES[state.cls]; const r = RACES[state.race];
  let statsHtml = ABILS.map(a=>'<div class="stat-row"><span>'+ABIL_LABEL[a]+'</span><span class="stat-val">'+state.stats[a]+' ('+fmtMod(mod(state.stats[a]))+')</span></div>').join('');
  document.getElementById('sheetContent').innerHTML =
    '<h3>'+state.name+' <span class="badge">Nivel '+state.level+'</span></h3>'+
    '<p><em>'+r.name+' - '+c.name+'</em></p>'+
    '<p>'+state.story+'</p>'+
    '<div class="stat-row"><span>Vida</span><span class="stat-val">'+state.hp+' / '+state.maxHp+'</span></div>'+
    '<div class="stat-row"><span>Clase de Armadura</span><span class="stat-val">'+state.ac+'</span></div>'+
    '<div class="stat-row"><span>Experiencia</span><span class="stat-val">'+state.xp+' / '+state.xpNext+'</span></div>'+
    '<h4 style="margin-top:12px;">Atributos</h4>'+statsHtml+
    '<h4 style="margin-top:12px;">Habilidad especial</h4><p class="small-note">'+c.special+'</p>'+
    '<h4 style="margin-top:12px;">Inventario</h4><p class="small-note">'+state.inventory.join(', ')+'</p>';
}

function updateCharBar(){
  const bar = document.getElementById('charBar');
  if(!state.race || !state.cls){ bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const c = CLASSES[state.cls]; const r = RACES[state.race];
  document.getElementById('charBarContent').innerHTML =
    '<strong>'+state.name+'</strong> - '+r.name+' '+c.name+' - Nv.'+state.level+
    ' <span>Vida '+state.hp+'/'+state.maxHp+'</span>'+
    ' <span>CA '+state.ac+'</span>'+
    ' <span>XP '+state.xp+'/'+state.xpNext+'</span>';
}

/* ================= TIRADOR DE DADOS ================= */
const dicePanel = document.getElementById('dicePanel');
document.getElementById('diceFab').addEventListener('click', ()=> dicePanel.classList.toggle('hidden'));
let selDie = 20;
const diceTypeGrid = document.getElementById('diceTypeGrid');
[4,6,8,10,12,20,100].forEach(d=>{
  const b = document.createElement('button');
  b.textContent = 'd'+d;
  if(d===20) b.classList.add('sel');
  b.addEventListener('click', ()=>{
    selDie = d;
    diceTypeGrid.querySelectorAll('button').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel');
  });
  diceTypeGrid.appendChild(b);
});
document.getElementById('diceRollBtn').addEventListener('click', ()=>{
  const qty = Math.max(1, Math.min(20, parseInt(document.getElementById('diceQty').value)||1));
  const modv = parseInt(document.getElementById('diceMod').value)||0;
  const rolls = rollMultiple(qty, selDie);
  const total = rolls.reduce((s,v)=>s+v,0) + modv;
  document.getElementById('diceResult').innerHTML =
    '<div><strong>'+qty+'d'+selDie+(modv? fmtMod(modv):'')+'</strong></div>'+
    '<div>Tiradas: '+rolls.join(', ')+'</div>'+
    '<div style="font-size:1.3rem;color:var(--accent-3);font-weight:bold;">Total: '+total+'</div>';
});

/* ================= SOCKET.IO / FIESTA EN VIVO ================= */
const playerId = getPlayerId();
const socket = io();
let currentCode = null;
let partyCache = null;

socket.on('connect', ()=>{
  document.getElementById('connMsg').textContent = '';
  if(currentCode) socket.emit('join', {code: currentCode, playerId});
});
socket.on('disconnect', ()=>{
  document.getElementById('connMsg').textContent = 'Desconectado del servidor, intentando reconectar...';
});
socket.on('action_error', (msg)=>{
  alert(msg);
});
socket.on('state', (party)=>{
  partyCache = party;
  renderPartyRoster();
  updatePublishBlock();
  renderChat();
  refreshAdventureTab();
});

document.getElementById('joinPartyBtn').addEventListener('click', ()=>{
  const raw = document.getElementById('partyCodeInput').value;
  const code = String(raw||'').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,24);
  if(!code){ document.getElementById('joinPartyMsg').textContent = 'Escribi un codigo valido (letras y numeros).'; return; }
  currentCode = code;
  try{ localStorage.setItem('nazhi_party_code', code); }catch(e){}
  socket.emit('join', {code, playerId});
  document.getElementById('noPartyPanel').classList.add('hidden');
  document.getElementById('inPartyPanel').classList.remove('hidden');
  document.getElementById('partyCodeLabel').textContent = code;
  document.getElementById('joinPartyMsg').textContent = '';
});

document.getElementById('leavePartyBtn').addEventListener('click', ()=>{
  if(currentCode) socket.emit('leave', {code: currentCode});
  currentCode = null;
  partyCache = null;
  try{ localStorage.removeItem('nazhi_party_code'); }catch(e){}
  document.getElementById('noPartyPanel').classList.remove('hidden');
  document.getElementById('inPartyPanel').classList.add('hidden');
  document.getElementById('partyCodeInput').value='';
  refreshAdventureTab();
});

function renderPartyRoster(){
  if(!partyCache) return;
  const grid = document.getElementById('partyRoster');
  const ids = Object.keys(partyCache.characters);
  if(ids.length===0){ grid.innerHTML = '<p class="small-note">Todavia no hay personajes publicados en esta fiesta.</p>'; return; }
  grid.innerHTML = ids.map(id=>{
    const c = partyCache.characters[id];
    const you = id===playerId ? ' <span class="badge">Vos</span>' : '';
    return '<div class="card"><h3>'+c.name+you+'</h3><p>'+RACES[c.race].name+' '+CLASSES[c.cls].name+' - Nv.'+c.level+'</p><p class="small-note">Vida '+c.hp+'/'+c.maxHp+'</p></div>';
  }).join('');
}

function updatePublishBlock(){
  if(!partyCache) return;
  const hasSoloChar = !!(state.race && state.cls);
  const hasPartyChar = !!partyCache.characters[playerId];
  document.getElementById('noSoloCharMsg').classList.toggle('hidden', hasSoloChar);
  document.getElementById('publishCharBtn').classList.toggle('hidden', !hasSoloChar);
  document.getElementById('hasPartyCharMsg').classList.toggle('hidden', !hasPartyChar);
  document.getElementById('publishCharBtn').textContent = hasPartyChar ? 'Actualizar mi personaje en la fiesta' : 'Publicar mi personaje en esta fiesta';
}

document.getElementById('publishCharBtn').addEventListener('click', ()=>{
  if(!currentCode || !state.race || !state.cls) return;
  const character = {
    name: state.name, race: state.race, cls: state.cls, stats: state.stats,
    level: state.level, xp: state.xp, xpNext: state.xpNext,
    maxHp: state.maxHp, hp: state.hp, ac: state.ac,
    inventory: state.inventory.slice(), story: state.story
  };
  socket.emit('publish_character', {code: currentCode, playerId, character});
});

/* ================= CHAT ================= */
function renderChat(){
  if(!partyCache) return;
  const log = document.getElementById('chatLog');
  log.innerHTML = (partyCache.chat||[]).map(m=>{
    const mine = m.playerId===playerId ? ' me' : '';
    return '<div class="chat-msg'+mine+'"><span class="who">'+(m.name||'Anonimo')+':</span> '+escapeHtml(m.text)+'</div>';
  }).join('');
  log.scrollTop = log.scrollHeight;
}
function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
document.getElementById('chatSendBtn').addEventListener('click', sendChat);
document.getElementById('chatInput').addEventListener('keydown', (e)=>{ if(e.key==='Enter') sendChat(); });
function sendChat(){
  if(!currentCode) return;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if(!text) return;
  const myName = (partyCache && partyCache.characters[playerId] && partyCache.characters[playerId].name) || 'Anonimo';
  socket.emit('chat_send', {code: currentCode, playerId, name: myName, text});
  input.value='';
}

/* ================= AVENTURA (reacciona al estado del servidor) ================= */
document.getElementById('startAdvBtn').addEventListener('click', ()=>{
  if(!currentCode) return;
  socket.emit('start_turn', {code: currentCode, playerId});
});

function refreshAdventureTab(){
  const hasChar = !!(partyCache && partyCache.characters[playerId]);
  document.getElementById('noCharWarning').classList.toggle('hidden', hasChar);
  if(!hasChar){
    document.getElementById('adventureIntro').classList.add('hidden');
    document.getElementById('adventureBoard').classList.add('hidden');
    return;
  }
  renderAdventure();
}

function renderAdventure(){
  const p = partyCache;
  const introEl = document.getElementById('adventureIntro');
  const boardEl = document.getElementById('adventureBoard');

  const turnOrder = (p.turnOrder && p.turnOrder.length) ? p.turnOrder : Object.keys(p.characters).sort();
  const activePlayer = turnOrder.length ? turnOrder[p.turnIndex % turnOrder.length] : null;
  const activeName = activePlayer && p.characters[activePlayer] ? p.characters[activePlayer].name : null;
  const myTurn = activePlayer === playerId;

  renderLog();

  if(p.status==='idle' || !p.currentScene){
    introEl.classList.remove('hidden');
    boardEl.classList.add('hidden');
    document.getElementById('partyTurnInfo').textContent = myTurn || !activeName
      ? 'Es tu turno de explorar la cripta.'
      : ('Es el turno de '+activeName+'. Estas viendo la fiesta en vivo — esperá tu turno.');
    document.getElementById('startAdvBtn').disabled = !(myTurn || !activeName);
    return;
  }

  introEl.classList.add('hidden');
  boardEl.classList.remove('hidden');
  const sc = p.currentScene;
  document.getElementById('sceneTitle').textContent = sc.title || '-';
  document.getElementById('sceneText').textContent = sc.text || '';
  document.getElementById('actorNote').textContent = myTurn
    ? 'Es tu turno de decidir.'
    : ('Esta escena la esta jugando '+(activeName||'otro jugador')+'. La estas viendo en vivo.');

  const enemyBlock = document.getElementById('enemyBlock');
  const choicesDiv = document.getElementById('choices');
  choicesDiv.innerHTML = '';

  if(sc.type==='combate' && sc.enemy){
    enemyBlock.classList.remove('hidden');
    document.getElementById('enemyName').textContent = sc.enemy.name;
    document.getElementById('enemyHpText').textContent = Math.max(0,sc.enemy.hp)+' / '+sc.enemy.maxHp+' PV';
    document.getElementById('enemyHpBar').style.width = Math.max(0,(sc.enemy.hp/sc.enemy.maxHp)*100)+'%';
    if(myTurn){
      const myChar = p.characters[playerId];
      const c = CLASSES[myChar.cls];
      addChoice('Atacar', ()=>sendAction('attack'));
      addChoice(c.special.split(':')[0], ()=>sendAction('special'), p.usedSpecialThisScene);
      addChoice('Intentar huir', ()=>sendAction('flee'));
    }
  } else {
    enemyBlock.classList.add('hidden');
    if(myTurn){
      if(sc.type==='hallazgo'){
        addChoice('Recoger el hallazgo', ()=>sendAction('collect'));
        addChoice('Seguir de largo', ()=>sendAction('skip'));
      } else {
        addChoice('Intentar ('+ABIL_LABEL[sc.abil]+', CD '+sc.dc+')', ()=>sendAction('check'));
        addChoice('Evitar la situacion', ()=>sendAction('skip'));
      }
    }
  }
}

function addChoice(label, fn, disabled){
  const btn = document.createElement('button');
  btn.className='choice-btn';
  btn.textContent = label;
  if(disabled){ btn.disabled=true; btn.style.opacity=0.5; }
  btn.addEventListener('click', fn);
  document.getElementById('choices').appendChild(btn);
}

function sendAction(kind){
  if(!currentCode) return;
  socket.emit('action', {code: currentCode, playerId, kind});
}

function renderLog(){
  const log = document.getElementById('advLog');
  const entries = (partyCache && partyCache.log) || [];
  log.innerHTML = entries.map(l=>{
    const tagClass = l.kind==='ok'?'ok':(l.kind==='bad'?'bad':'');
    const tagText = l.kind==='ok'?'OK':(l.kind==='bad'?'X':'-');
    return '<p><span class="tag '+tagClass+'">'+tagText+'</span> '+l.text+'</p>';
  }).join('');
  log.scrollTop = log.scrollHeight;
}

/* ================= INIT ================= */
loadLocalChar();
renderRaceGrid();
renderClassGrid();
if(state.race && state.cls){
  renderSheet();
  updateCharBar();
  ['stepRace','stepClass','stepStats','stepName'].forEach(id=>document.getElementById(id).classList.add('hidden'));
  document.querySelector('#tab-personaje .panel.center').classList.add('hidden');
  document.getElementById('sheetPanel').classList.remove('hidden');
}

try{
  const savedCode = localStorage.getItem('nazhi_party_code');
  if(savedCode){
    document.getElementById('partyCodeInput').value = savedCode;
    currentCode = savedCode;
    document.getElementById('noPartyPanel').classList.add('hidden');
    document.getElementById('inPartyPanel').classList.remove('hidden');
    document.getElementById('partyCodeLabel').textContent = savedCode;
    if(socket.connected) socket.emit('join', {code: savedCode, playerId});
  }
}catch(e){}
