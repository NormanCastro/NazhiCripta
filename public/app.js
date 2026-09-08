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
  guerrero:{name:'Guerrero', hitDie:10, primary:'FUE', weapon:'Espada larga', weaponDie:8, desc:'Maestro del combate cuerpo a cuerpo, resistente y letal.', special:'Golpe Firme: una vez por combate, suma +4 a un ataque.'},
  mago:{name:'Mago', hitDie:6, primary:'INT', weapon:'Daga', weaponDie:4, desc:'Estudioso de lo arcano, devastador con hechizos.', special:'Dardo Arcano: inflige 2d6 de daño magico ignorando armadura, una vez por combate.'},
  picaro:{name:'Picaro', hitDie:8, primary:'DES', weapon:'Daga', weaponDie:4, desc:'Sigiloso, veloz y letal cuando nadie lo espera.', special:'Golpe Furtivo: si es su primer ataque en el combate, duplica el daño.'},
  clerigo:{name:'Clerigo', hitDie:8, primary:'SAB', weapon:'Maza', weaponDie:6, desc:'Canaliza poder divino para sanar y proteger.', special:'Palabra Sagrada: cura 2d6+SAB puntos de vida, una vez por combate.'},
  barbaro:{name:'Barbaro', hitDie:12, primary:'FUE', weapon:'Hacha de guerra a dos manos', weaponDie:12, desc:'Furia desatada; el mas resistente y salvaje en batalla.', special:'Furia: reduce el daño recibido a la mitad durante un turno, una vez por combate.'},
  explorador:{name:'Explorador', hitDie:10, primary:'DES', weapon:'Arco largo', weaponDie:8, desc:'Cazador certero con el arco y conocedor del terreno.', special:'Tiro Certero: un ataque no puede fallar, una vez por combate.'},
  paladin:{name:'Paladin', hitDie:10, primary:'FUE', weapon:'Espada larga', weaponDie:8, desc:'Guerrero sagrado que combate por sus ideales y sana sus propias heridas.', special:'Golpe Sagrado: +4 de daño extra y cura 2d4 de vida al impactar, una vez por combate.'},
  bardo:{name:'Bardo', hitDie:8, primary:'CAR', weapon:'Espada corta', weaponDie:6, desc:'Artista itinerante cuya musica y palabras inspiran y sanan.', special:'Cancion Inspiradora: recupera 1d6+Carisma de vida, una vez por combate.'},
  druida:{name:'Druida', hitDie:8, primary:'SAB', weapon:'Baston de druida', weaponDie:6, desc:'Guardian de la naturaleza que canaliza el poder salvaje.', special:'Forma Salvaje: un zarpazo salvaje inflige 2d8 de daño directo, una vez por combate.'},
  monje:{name:'Monje', hitDie:8, primary:'DES', weapon:'Golpes sin arma', weaponDie:6, desc:'Marcial disciplinado que golpea con velocidad y precision.', special:'Golpe Certero: dos golpes veloces que nunca fallan, 2d6+Destreza de daño, una vez por combate.'}
};
const ROOM_ICON = { combate:'⚔', social:'💬', exploracion:'🧭', trampa:'⚠', hallazgo:'💰', puerta:'🚪' };
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
    div.innerHTML = '<h3>'+c.name+'</h3><p>'+c.desc+'</p><p class="small-note">⚔️ Arma: '+c.weapon+' (d'+c.weaponDie+' de daño)</p><p class="small-note">'+c.special+'</p>';
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
  updateCharBar();
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
  // el resumen de personaje ahora vive en la sidebar persistente (charCardPanel),
  // que se actualiza en vivo desde el estado de la fiesta, no desde este objeto local.
}

/* ================= TIRADOR DE DADOS ================= */
const dicePanel = document.getElementById('dicePanel');
const diceFab = document.getElementById('diceFab');
diceFab.addEventListener('click', ()=> dicePanel.classList.toggle('hidden'));
let selDie = 20;
let pendingAction = null; // {kind, adv:'adv'|'disadv'|'normal'}
const diceTypeGrid = document.getElementById('diceTypeGrid');
[4,6,8,10,12,20,100].forEach(d=>{
  const b = document.createElement('button');
  b.textContent = 'd'+d;
  if(d===20) b.classList.add('sel');
  b.addEventListener('click', ()=>{
    if(pendingAction) return; // mientras hay una accion pendiente, el dado queda fijo en d20
    selDie = d;
    diceTypeGrid.querySelectorAll('button').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel');
  });
  diceTypeGrid.appendChild(b);
});

// Ventaja/Desventaja (regla real de D&D): con Ventaja se tiran 2d20 y se usa el mayor;
// con Desventaja, 2d20 y se usa el menor. Si aplicaran ambas a la vez, se cancelan y es tirada normal.
function computeAdvantage(kind){
  const p = partyCache;
  const myChar = p && p.characters[playerId];
  if(!myChar) return 'normal';
  let hasAdv = false, hasDisadv = false;

  // Desventaja: atacar o actuar mal herido (menos de 25% de vida) - manos temblorosas
  if(myChar.hp <= myChar.maxHp * 0.25) hasDisadv = true;

  // Ventaja: el Picaro golpeando por sorpresa (mientras nadie ataco todavia en este combate)
  const sc = p.currentScene;
  if(kind==='attack' && myChar.cls==='picaro' && sc && sc.type==='combate' && !sc.firstStrikeUsed) hasAdv = true;

  if(hasAdv && hasDisadv) return 'normal';
  if(hasAdv) return 'adv';
  if(hasDisadv) return 'disadv';
  return 'normal';
}

const ALT_ABIL_BY_TYPE = { social:'FUE', exploracion:'FUE', trampa:'INT' };

function computeRelevantMod(kind){
  const p = partyCache;
  const myChar = p && p.characters[playerId];
  if(!myChar) return 0;
  const sc = p.currentScene;
  const cd = CLASSES[myChar.cls];
  if(kind==='attack' || kind==='special') return mod(myChar.stats[cd.primary]);
  if(kind==='flee') return mod(myChar.stats.DES);
  if(kind==='search_key') return mod(myChar.stats.INT);
  if(kind==='force_door') return mod(myChar.stats.FUE);
  if(kind==='check' && sc) return mod(myChar.stats[sc.abil]);
  if(kind==='check_alt' && sc) return mod(myChar.stats[ALT_ABIL_BY_TYPE[sc.type]||sc.abil]);
  return 0;
}

function requestRoll(kind){
  const adv = computeAdvantage(kind);
  const relevantMod = computeRelevantMod(kind);
  pendingAction = { kind, adv };
  selDie = 20;
  diceTypeGrid.querySelectorAll('button').forEach(x=>x.classList.remove('sel'));
  diceTypeGrid.querySelectorAll('button')[5].classList.add('sel'); // d20 es el 6to boton (index 5)
  document.getElementById('diceQty').value = adv==='normal' ? 1 : 2;
  document.getElementById('diceQty').disabled = true;
  document.getElementById('diceMod').value = relevantMod;
  document.getElementById('diceMod').disabled = true;
  diceFab.classList.add('glow');
  dicePanel.classList.remove('hidden');
  let msg = 'Tirá el D20 para resolver tu accion. Modificador aplicado: '+fmtMod(relevantMod)+'.';
  if(adv==='adv') msg = '<span class="roll-highlight">¡Tenés VENTAJA!</span> Se tiran 2d20 y se usa el mayor. Modificador: '+fmtMod(relevantMod)+'.';
  else if(adv==='disadv') msg = '<span style="color:var(--accent);font-weight:bold;">Tenés DESVENTAJA</span> (mal herido). Se tiran 2d20 y se usa el menor. Modificador: '+fmtMod(relevantMod)+'.';
  document.getElementById('diceResult').innerHTML = '<p>'+msg+'</p>';
  renderAdventure();
}
function clearPendingAction(){
  pendingAction = null;
  diceFab.classList.remove('glow');
  document.getElementById('diceQty').disabled = false;
  document.getElementById('diceMod').disabled = false;
}

document.getElementById('diceRollBtn').addEventListener('click', ()=>{
  const adv = pendingAction ? pendingAction.adv : 'normal';
  const qty = pendingAction ? (adv==='normal' ? 1 : 2) : Math.max(1, Math.min(20, parseInt(document.getElementById('diceQty').value)||1));
  const die = pendingAction ? 20 : selDie;
  const modv = parseInt(document.getElementById('diceMod').value)||0;
  const rolls = rollMultiple(qty, die);
  const total = rolls.reduce((s,v)=>s+v,0) + modv;

  // valor efectivo que se usa para resolver la accion pendiente
  let effective = rolls[0];
  let advNote = '';
  if(pendingAction && die===20){
    if(adv==='adv'){ effective = Math.max(...rolls); advNote = ' (Ventaja: se usa el mayor, '+effective+')'; }
    else if(adv==='disadv'){ effective = Math.min(...rolls); advNote = ' (Desventaja: se usa el menor, '+effective+')'; }
  }

  let flair = '';
  if(die===20 && (qty===1 || pendingAction)){
    if(effective===20) flair = '<div class="roll-highlight">¡NATURAL 20 — CRITICO!</div>';
    else if(effective===1) flair = '<div style="color:var(--accent);font-weight:bold;">¡NATURAL 1 — PIFIA!</div>';
    renderDiceBox(effective);
  }
  document.getElementById('diceResult').innerHTML =
    '<div><strong>'+qty+'d'+die+(modv? fmtMod(modv):'')+'</strong></div>'+
    '<div>Tiradas: '+rolls.join(', ')+advNote+'</div>'+
    flair+
    '<div style="font-size:1.3rem;color:var(--accent-3);font-weight:bold;">Total: '+(effective+modv)+'</div>';

  if(pendingAction){
    const kind = pendingAction.kind;
    clearPendingAction();
    dicePanel.classList.add('hidden');
    sendActionWithRoll(kind, effective);
  }
});

function renderDiceBox(value){
  const shape = document.getElementById('d20Shape');
  if(!shape) return;
  document.getElementById('d20Value').textContent = value;
  shape.classList.remove('d20-crit','d20-fumble');
  if(value===20) shape.classList.add('d20-crit');
  else if(value===1) shape.classList.add('d20-fumble');
}

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
  renderCharCard(); // la sidebar de personaje se actualiza siempre, sin importar la pestaña activa
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
  const html = (partyCache.chat||[]).map(m=>{
    const mine = m.playerId===playerId ? ' me' : '';
    return '<div class="chat-msg'+mine+'"><span class="who">'+(m.name||'Anonimo')+':</span> '+escapeHtml(m.text)+'</div>';
  }).join('');
  const log = document.getElementById('chatLog');
  if(log){ log.innerHTML = html; log.scrollTop = log.scrollHeight; }
  renderUnifiedFeed();
}
function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function sendChat(inputId){
  if(!currentCode) return;
  const input = document.getElementById(inputId);
  const text = input.value.trim();
  if(!text) return;
  const myName = (partyCache && partyCache.characters[playerId] && partyCache.characters[playerId].name) || 'Anonimo';
  socket.emit('chat_send', {code: currentCode, playerId, name: myName, text});
  input.value='';
  if(inputId==='chatInputAdv') tryMatchIntent(text);
}
document.getElementById('chatSendBtn').addEventListener('click', ()=> sendChat('chatInput'));
document.getElementById('chatInput').addEventListener('keydown', (e)=>{ if(e.key==='Enter') sendChat('chatInput'); });
document.getElementById('chatSendBtnAdv').addEventListener('click', ()=> sendChat('chatInputAdv'));
document.getElementById('chatInputAdv').addEventListener('keydown', (e)=>{ if(e.key==='Enter') sendChat('chatInputAdv'); });

/* ================= "HABLAR CON EL DM" — reconocimiento de palabras clave (sin IA) ================= */
const INTENT_KEYWORDS = {
  attack: ['atacar','ataco','atacá','ataque','pego','pegar','pegarle','golpear','golpeo','pelear','peleo','le doy','embisto','embestir','le pego con todo','voy al frente','cargo contra el'],
  special: ['especial','habilidad','uso mi habilidad','uso mi especial','hechizo','lanzo un hechizo','uso mi poder','uso mi don'],
  defend: ['defender','defenderme','defiendo','cubrirme','cubro','esconderme','escondo','protegerme','proteger','me cubro','me pongo a cubierto','me resguardo','bloqueo','levanto el escudo','me quedo atras cubriendome'],
  usepotion: ['pocion','poción','curarme','curar','beber','tomar pocion','bebo la pocion','me curo','tomo mi pocion'],
  flee: ['huir','huyo','escapar','escapo','correr','corro','irme','retirarme','retirada','me voy','salgo corriendo','abandono la pelea','no quiero pelear','mejor me retiro'],
  collect: ['recoger','recojo','agarrar','agarro','tomar','revisar','busco algo','lo agarro','voy a buscarlo','me lo llevo','junto lo que brilla'],
  search_key: ['buscar llave','busco la llave','llave','busco por una llave','reviso si hay una llave','trato de encontrar la llave'],
  force_door: ['forzar','romper','empujar','forzarla','la empujo','le doy una patada','trato de romperla','la fuerzo con el hombro'],
  check: ['intentar','probar','investigar','intento','pruebo','investigo','reviso','me fijo','presto atencion','analizo','voy a analizar','quiero investigar','me acerco a mirar','examino el lugar'],
  check_alt: ['otro enfoque','alternativa','de otra forma','diferente','de otra manera','probar distinto','con otra estrategia','a mi manera'],
  skip: ['seguir de largo','ignorar','avanzar','pasar de largo','evitar','no arriesgarme','sigo','prefiero retroceder','retrocedo','no quiero arriesgarme','mejor no','paso de esto','sigamos caminando','continuamos'],
  choose_path_A: ['izquierda','izquierdo','pasillo izquierdo','puerta izquierda','voy por la izquierda','tomo la izquierda','bordear','bordeo el muro','junto al muro','voy por el muro'],
  choose_path_B: ['derecha','derecho','pasillo derecho','puerta derecha','voy por la derecha','tomo la derecha','centro','cruzar','cruzo por el centro','voy por el centro'],
  use_torch: ['antorcha','uso mi antorcha','uso la antorcha','ilumino','prendo la antorcha','saco la antorcha'],
  use_rope: ['cuerda','uso mi cuerda','uso la cuerda','ato la cuerda','aseguro con la cuerda']
};
const RATIONS_KEYWORDS = ['raciones','como mis raciones','como algo','comer','me como algo','saco mis raciones'];
function normalizeText(s){
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function getActivePlayerId(p){
  if(!p) return null;
  const sc = p.currentScene;
  if(sc && sc.type==='combate' && sc.combatOrder && sc.combatOrder.length){
    const entry = sc.combatOrder[sc.combatIdx];
    return entry && entry.type==='player' ? entry.id : null;
  }
  const q = (p.turnQueue && p.turnQueue.length) ? p.turnQueue : Object.keys(p.characters||{}).sort();
  return q.length ? q[0] : null;
}
function findNamedTarget(norm, excludeSelf){
  const p = partyCache;
  const chars = (p && p.characters) || {};
  for(const id of Object.keys(chars)){
    if(excludeSelf && id===playerId) continue;
    const c = chars[id];
    if(!c || !c.name) continue;
    if(norm.includes(normalizeText(c.name))) return id;
  }
  return null;
}

function tryMatchIntent(text){
  clearIntentHint();
  const p = partyCache;
  const hint = document.getElementById('intentHint');
  const norm0 = normalizeText(text);
  const myChar0 = p && p.characters[playerId];

  // "comer raciones" funciona en cualquier momento, no depende de que haya una escena activa
  if(myChar0 && RATIONS_KEYWORDS.some(kw=>norm0.includes(normalizeText(kw)))){
    if(!myChar0.inventory.includes('Raciones de viaje')){
      hint.textContent = 'ℹ️ No tenes raciones de viaje.';
    } else if(myChar0.hp<=0){
      hint.textContent = 'ℹ️ Estas caido, no podes comer ahora.';
    } else if(myChar0.hp>=myChar0.maxHp){
      hint.textContent = 'ℹ️ Ya estas con la vida al maximo.';
    } else {
      sendEatRations();
      hint.textContent = '✅ Hecho: comes tus raciones de viaje.';
    }
    hint.classList.remove('hidden');
    return;
  }

  if(!p || !p.currentScene){
    hint.textContent = 'ℹ️ No hay ninguna escena activa ahora mismo para interpretar acciones.';
    hint.classList.remove('hidden');
    return;
  }
  const sc = p.currentScene;
  const isCombat = sc.type==='combate';
  const activePlayer = getActivePlayerId(p);
  // en combate solo se interpreta en tu turno; fuera de combate, cualquiera de la fiesta puede actuar
  if(isCombat && activePlayer !== playerId){
    const activeName = p.characters[activePlayer] ? p.characters[activePlayer].name : 'otro jugador';
    hint.textContent = 'ℹ️ No es tu turno de combate (le toca a '+activeName+') — tu mensaje se mando al chat, pero no interpreto acciones fuera de tu turno en combate.';
    hint.classList.remove('hidden');
    return;
  }
  const myChar = p.characters[playerId];
  if(!myChar){
    hint.textContent = 'ℹ️ Todavia no tenes personaje publicado en esta fiesta.';
    hint.classList.remove('hidden');
    return;
  }
  const norm = normalizeText(text);
  const availableButtons = Array.from(document.querySelectorAll('#choices .choice-btn:not(:disabled)'));
  if(!availableButtons.length){
    hint.textContent = 'ℹ️ Hay una escena activa, pero todavia no hay opciones para elegir.';
    hint.classList.remove('hidden');
    return;
  }

  for(const btn of availableButtons){
    const kind = btn.dataset.kind;
    const keywords = INTENT_KEYWORDS[kind];
    if(!keywords) continue;
    if(keywords.some(kw => norm.includes(normalizeText(kw)))){
      // acciones que pueden apuntar a un aliado nombrado: se ejecutan directo, sin pasar por el selector de objetivo
      if(kind==='special' && isCombat && HEAL_SPECIAL_CLASSES.includes(myChar.cls)){
        const target = findNamedTarget(norm, false) || playerId;
        sendActionWithTarget('special', target);
        hint.textContent = '✅ Hecho: '+(target===playerId?'te curas a vos mismo/a':'curas a '+p.characters[target].name)+'.';
      } else if(kind==='usepotion' && isCombat){
        const target = findNamedTarget(norm, false) || playerId;
        sendActionWithTarget('usepotion', target);
        hint.textContent = '✅ Hecho: '+(target===playerId?'usas la pocion en vos mismo/a':'le das la pocion a '+p.characters[target].name)+'.';
      } else if(kind==='choose_path_A' || kind==='choose_path_B'){
        sendActionWithTarget('choose_path', kind==='choose_path_A'?'A':'B');
        hint.textContent = '✅ Hecho: '+btn.textContent;
      } else {
        // el resto: ejecuta directo tocando la accion real del boton (si pide tirada, el D20 se ilumina igual)
        btn.click();
        hint.textContent = '✅ Hecho: '+btn.textContent;
      }
      hint.classList.remove('hidden');
      return;
    }
  }
  hint.textContent = '🤔 No reconocí ninguna accion en eso. Probá con palabras como "atacar", "huir", "defenderme"...';
  hint.classList.remove('hidden');
}
function clearIntentHint(){
  document.querySelectorAll('#choices .choice-btn.choice-hint').forEach(b=>b.classList.remove('choice-hint'));
  const hint = document.getElementById('intentHint');
  if(hint){ hint.classList.add('hidden'); hint.textContent=''; }
}

/* ================= AVENTURA (reacciona al estado del servidor) ================= */
const ROLL_REQUIRED_KINDS = ['attack','special','flee','check','check_alt','search_key','force_door'];
let viewMode = 'scene'; // 'scene' | 'map'
let quickPanelMode = null; // 'habilidades' | 'inventario' | 'registro' | null

document.getElementById('startAdvBtn').addEventListener('click', ()=>{
  if(!currentCode) return;
  socket.emit('start_turn', {code: currentCode, playerId});
});

document.getElementById('viewToggleBtn').addEventListener('click', ()=>{
  viewMode = viewMode==='map' ? 'scene' : 'map';
  applyViewMode();
});

function applyViewMode(){
  const hasScene = !!(partyCache && partyCache.currentScene);
  document.getElementById('adventureIntro').classList.toggle('hidden', hasScene || viewMode==='map');
  document.getElementById('sceneView').classList.toggle('hidden', !hasScene || viewMode==='map');
  document.getElementById('mapView').classList.toggle('hidden', viewMode!=='map');
  document.getElementById('viewToggleBtn').textContent = viewMode==='map' ? '📖 Ver escena' : '🔍 Ver mapa';
  document.getElementById('viewerHeading').textContent = viewMode==='map' ? 'Mapa de la cripta' : (hasScene ? (partyCache.currentScene.title||'Escena') : 'La Cripta te espera');
}

document.getElementById('btnHabilidades').addEventListener('click', ()=> toggleQuickPanel('habilidades'));
document.getElementById('btnInventario').addEventListener('click', ()=> toggleQuickPanel('inventario'));
document.getElementById('btnHoja').addEventListener('click', ()=> toggleQuickPanel('hoja'));

function toggleQuickPanel(mode){
  quickPanelMode = (quickPanelMode===mode) ? null : mode;
  renderQuickPanel();
}

function renderQuickPanel(){
  const panel = document.getElementById('quickSubPanel');
  const c = partyCache && partyCache.characters[playerId];
  if(!quickPanelMode || !c){ panel.classList.add('hidden'); panel.innerHTML=''; return; }
  panel.classList.remove('hidden');
  const cd = CLASSES[c.cls];
  if(quickPanelMode==='habilidades'){
    const statsHtml = ABILS.map(a=>'<div class="stat-row"><span>'+ABIL_LABEL[a]+'</span><span class="stat-val">'+c.stats[a]+' ('+fmtMod(mod(c.stats[a]))+')</span></div>').join('');
    panel.innerHTML = '<h4 style="margin:0 0 6px 0;">Arma</h4><p class="small-note">'+cd.weapon+' — daño d'+cd.weaponDie+'</p>'+
      '<h4 style="margin:10px 0 4px 0;">Habilidad especial</h4><p class="small-note">'+cd.special+'</p>'+
      '<h4 style="margin:10px 0 4px 0;">Atributos</h4>'+statsHtml;
  } else if(quickPanelMode==='inventario'){
    const hasRations = c.inventory.includes('Raciones de viaje');
    const canEat = hasRations && c.hp>0 && c.hp<c.maxHp;
    panel.innerHTML = '<h4 style="margin:0 0 6px 0;">Inventario</h4>'+
      (c.inventory.length ? '<ul style="margin:0;padding-left:18px;">'+c.inventory.map(i=>'<li class="small-note">'+i+'</li>').join('')+'</ul>' : '<p class="small-note">(vacio)</p>')+
      (hasRations ? '<button class="action gold" style="margin-top:8px;" onclick="sendEatRations()"'+(canEat?'':' disabled')+'>Comer raciones (recupera algo de vida)</button>' : '')+
      '<p class="small-note" style="margin-top:6px;">La Antorcha y la Cuerda se pueden usar directamente durante escenas de exploracion o trampas, cuando aparezcan como opcion.</p>';
  } else if(quickPanelMode==='hoja'){
    const statsHtml = ABILS.map(a=>'<div class="stat-row"><span>'+ABIL_LABEL[a]+'</span><span class="stat-val">'+c.stats[a]+' ('+fmtMod(mod(c.stats[a]))+')</span></div>').join('');
    panel.innerHTML = '<h4 style="margin:0 0 4px 0;">'+c.name+' <span class="badge">Nivel '+c.level+'</span></h4>'+
      '<p class="small-note" style="margin:0 0 8px 0;">'+RACES[c.race].name+' — '+cd.name+' — '+cd.weapon+' (d'+cd.weaponDie+')</p>'+
      '<div class="stat-row"><span>Vida</span><span class="stat-val">'+c.hp+' / '+c.maxHp+'</span></div>'+
      '<div class="stat-row"><span>Clase de Armadura</span><span class="stat-val">'+c.ac+'</span></div>'+
      '<div class="stat-row"><span>Experiencia</span><span class="stat-val">'+c.xp+' / '+c.xpNext+'</span></div>'+
      '<h4 style="margin:10px 0 4px 0;">Atributos</h4>'+statsHtml+
      '<h4 style="margin:10px 0 4px 0;">Inventario</h4>'+
      (c.inventory.length ? '<ul style="margin:0;padding-left:18px;">'+c.inventory.map(i=>'<li class="small-note">'+i+'</li>').join('')+'</ul>' : '<p class="small-note">(vacio)</p>');
  }
}

function refreshAdventureTab(){
  const hasChar = !!(partyCache && partyCache.characters[playerId]);
  document.getElementById('noCharWarning').classList.toggle('hidden', hasChar);
  document.getElementById('adventureLayout').classList.toggle('hidden', !hasChar);
  if(!hasChar){
    return;
  }
  renderAdventure();
  renderRoomMap();
  renderCharCard();
  renderPartyCard();
  renderQuickPanel();
  renderTurnStrip();
}

const ROOM_NAME = {
  combate:'Camara de Combate', social:'Salon de Encuentro', exploracion:'Corredor Antiguo',
  trampa:'Camara de Trampas', hallazgo:'Boveda del Tesoro', puerta:'Puerta Cerrada'
};

// Puntos fijos sobre TU imagen de mapa (public/dungeon-map.jpg), en % del ancho/alto.
// Cada nueva sala que un jugador explora avanza SU PROPIO token al siguiente punto.
// "image" (opcional) es la ilustracion que se muestra en el visor cuando un jugador esta ahi.
const MAP_POINTS = [
  {x:6,  y:9,  label:'Entrada de la Cueva', image:'/scenes/room1-entrada-cueva.jpg'},
  {x:13, y:23, label:'Vestibulo de Guardianes', image:'/scenes/room2-vestibulo-guardianes.jpg'},
  {x:11, y:39, label:'Corredor Olvidado'},
  {x:4,  y:51, label:'Gran Salon', image:'/scenes/room4-gran-salon.jpg'},
  {x:14, y:71, label:'Caverna del Pantano'},
  {x:42, y:47, label:'Cruce del Puente'},
  {x:40, y:17, label:'Camara del Ritual'},
  {x:61, y:23, label:'Sala de los Sarcofagos'},
  {x:79, y:11, label:'Circulo Sagrado'},
  {x:83, y:46, label:'Celdas', image:'/scenes/room10-celdas.jpg'}
];
const DOOR_SCENE_IMAGE = '/scenes/escena-puerta-cerrada.jpg';
const TOKEN_COLORS = ['#d9a53d','#3fae8c','#d1543f','#7a9fd9','#c76bd9','#8fd93f'];
function colorForPlayer(playerId){
  let h=0; for(let i=0;i<playerId.length;i++) h=(h*31+playerId.charCodeAt(i))>>>0;
  return TOKEN_COLORS[h % TOKEN_COLORS.length];
}

function ensureMapDom(){
  const mapEl = document.getElementById('roomMap');
  if(document.getElementById('mapImg')) return; // ya existe, no recrear (asi los tokens no pierden su animacion)
  mapEl.innerHTML =
    '<div id="mapWrap" style="position:relative;">'+
      '<img id="mapImg" src="/dungeon-map.jpg" alt="Mapa de la cripta" style="width:100%;display:block;border-radius:8px;border:2px solid var(--border);">'+
      '<svg id="mapFog" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"></svg>'+
      '<div id="mapTokens" style="position:absolute;inset:0;"></div>'+
    '</div>';
}

function renderFog(revealedSet){
  const fogEl = document.getElementById('mapFog');
  let svg = '<defs><filter id="fogSoft" x="-50%" y="-50%" width="200%" height="200%">'+
            '<feGaussianBlur stdDeviation="2.2"/></filter></defs>';
  svg += '<mask id="fogMask"><rect x="0" y="0" width="100" height="100" fill="white"/>';
  revealedSet.forEach(idx=>{
    const pt = MAP_POINTS[idx];
    if(pt) svg += '<circle cx="'+pt.x+'" cy="'+pt.y+'" r="13" fill="black" filter="url(#fogSoft)"/>';
  });
  svg += '</mask>';
  svg += '<rect x="0" y="0" width="100" height="100" fill="rgba(6,5,4,0.86)" mask="url(#fogMask)"/>';
  fogEl.innerHTML = svg;
}

function renderRoomMap(){
  const p = partyCache;
  const chars = (p && p.characters) || {};
  const ids = Object.keys(chars).filter(id => typeof chars[id].mapPos === 'number' && chars[id].mapPos >= 0);
  if(!ids.length){
    document.getElementById('roomMap').innerHTML = '<p class="small-note">Todavia no exploraste ninguna sala.</p>';
    return;
  }
  ensureMapDom();

  const activePlayerId = p.currentScene ? getActivePlayerId(p) : null;

  // niebla: se despeja donde la fiesta ya paso (mas la posicion actual de cada uno)
  const revealed = new Set(p.fogRevealed||[]);
  ids.forEach(id=> revealed.add(chars[id].mapPos));
  renderFog(revealed);

  const container = document.getElementById('mapTokens');
  // sacar tokens de jugadores que ya no existen (raro, pero por las dudas)
  Array.from(container.children).forEach(el=>{
    const id = el.dataset.playerId;
    if(id && !ids.includes(id)) el.remove();
  });

  ids.forEach(id=>{
    const c = chars[id];
    const pt = MAP_POINTS[c.mapPos];
    const isActive = id === activePlayerId;
    let el = container.querySelector('[data-player-id="'+CSS.escape(id)+'"]');
    if(!el){
      el = document.createElement('div');
      el.dataset.playerId = id;
      el.className = 'map-token-el';
      container.appendChild(el);
    }
    // si varios personajes comparten sala, los separamos un poco para que no se tapen entre si
    const sameRoomIds = ids.filter(oid=>chars[oid].mapPos===c.mapPos).sort();
    const idxInGroup = sameRoomIds.indexOf(id);
    const groupSize = sameRoomIds.length;
    const spread = 3.2; // % de desplazamiento entre tokens que comparten sala
    const offsetX = groupSize>1 ? (idxInGroup - (groupSize-1)/2) * spread : 0;
    el.style.left = (pt.x+offsetX)+'%';
    el.style.top = pt.y+'%';
    el.style.borderColor = isActive ? 'var(--accent-3)' : colorForPlayer(id);
    el.style.background = isActive
      ? 'radial-gradient(circle, var(--accent-3), #0f3d22)'
      : 'radial-gradient(circle, '+colorForPlayer(id)+', #08130c)';
    el.classList.toggle('map-token-active', isActive);
    el.innerHTML = '<span>'+(isActive ? (ROOM_ICON[c.lastRoomType]||'🧭') : (c.name||'?').charAt(0).toUpperCase())+'</span>';
    el.title = c.name+' — Sala '+(c.mapPos+1)+': '+pt.label+(c.lastRoomType?(' ('+(ROOM_NAME[c.lastRoomType]||'')+')'):'');
  });
}

const CLASS_ICON = {
  guerrero:'⚔️', mago:'🔮', picaro:'🗡️', clerigo:'✨', barbaro:'🪓',
  explorador:'🏹', paladin:'🛡️', bardo:'🎵', druida:'🌿', monje:'🥋'
};

function hpBarColor(pct, downed){
  if(downed) return '#3a4a3f';
  return pct>50 ? 'var(--accent-2)' : (pct>20 ? 'var(--accent-3)' : 'var(--accent)');
}

function renderCharCard(){
  const panel = document.getElementById('charCardPanel');
  if(!panel) return;
  const c = partyCache && partyCache.characters[playerId];
  if(!c){ panel.innerHTML = '<p class="small-note">Publica tu personaje en la Fiesta.</p>'; return; }
  const cd = CLASSES[c.cls];
  const hpPct = Math.max(0, Math.min(100, Math.round((c.hp/c.maxHp)*100)));
  const downed = c.hp<=0;
  const sceneForSpecial = partyCache.currentScene;
  const specialReady = !(sceneForSpecial && sceneForSpecial.type==='combate' && sceneForSpecial.usedSpecialBy && sceneForSpecial.usedSpecialBy.includes(playerId));
  panel.innerHTML =
    '<div class="char-card-head">'+
      '<div class="avatar-ring" style="'+ringStyle(hpPct, specialReady?100:0, downed)+'"><div class="avatar-ring-inner">'+(CLASS_ICON[c.cls]||'🧙')+'</div></div>'+
      '<div><div class="cc-name">'+c.name+'</div><div class="cc-sub">'+cd.name+' — Nivel '+c.level+'</div></div>'+
    '</div>'+
    '<div class="ring-legend">'+
      '<span><span class="dot" style="background:'+hpBarColor(hpPct,downed)+';"></span>Vida: '+(downed?'Caido':(c.hp+'/'+c.maxHp))+'</span>'+
      '<span><span class="dot" style="background:var(--accent-2);"></span>Especial: '+(specialReady?'Lista':'Usada')+'</span>'+
    '</div>'+
    '<div class="stat-row-mini stat-row" style="margin-top:8px;"><span>Clase de Armadura</span><span class="stat-val">'+c.ac+'</span></div>'+
    '<div class="stat-row-mini stat-row"><span>Experiencia</span><span class="stat-val">'+c.xp+' / '+c.xpNext+'</span></div>'+
    (downed ? '<p class="small-note" style="color:var(--accent);margin-top:8px;">⚠️ Estas caido/a e inconsciente. No podes actuar hasta que un aliado te reanime con una pocion o con curacion.</p>' : '');
}

function ringStyle(hpPct, specialPct, downed){
  if(downed){
    return 'background: conic-gradient(from 0deg, #3a4a3f 0deg 360deg);';
  }
  const blueEnd = 180 * (specialPct/100);
  const greenEnd = 180 + 180 * (hpPct/100);
  const hpColor = hpBarColor(hpPct, false);
  return 'background: conic-gradient(from 0deg, '+
    'var(--accent-2) 0deg '+blueEnd+'deg, '+
    'var(--bg) '+blueEnd+'deg 180deg, '+
    hpColor+' 180deg '+greenEnd+'deg, '+
    'var(--bg) '+greenEnd+'deg 360deg);';
}

function renderPartyCard(){
  const panel = document.getElementById('partyCardPanel');
  if(!panel) return;
  const p = partyCache;
  const chars = (p && p.characters) || {};
  const ids = Object.keys(chars).filter(id=>id!==playerId);
  if(!ids.length){ panel.innerHTML = '<h4 style="margin:0;">Fiesta</h4><p class="small-note">Nadie mas se unio todavia.</p>'; return; }
  const myChar = chars[playerId];
  const iAmDowned = myChar && myChar.hp<=0;
  const iHavePotion = myChar && myChar.inventory && myChar.inventory.includes('Pocion menor de curacion');
  panel.innerHTML = '<h4 style="margin:0 0 10px 0;">Fiesta</h4>' + ids.map(id=>{
    const c = chars[id];
    const pct = Math.max(0, Math.min(100, Math.round((c.hp/c.maxHp)*100)));
    const downed = c.hp<=0;
    const canRevive = downed && !iAmDowned && iHavePotion;
    return '<div class="party-member-row">'+
      '<div class="avatar-ring small" style="'+ringStyle(pct, 100, downed)+'"><div class="avatar-ring-inner">'+(CLASS_ICON[c.cls]||'🧙')+'</div></div>'+
      '<div class="pm-info">'+
        '<div class="pm-name"><span>'+c.name+'</span><span class="clevel">Nv.'+c.level+'</span></div>'+
        '<div class="small-note">'+(downed?'Caido — inconsciente':(c.hp+' / '+c.maxHp+' PV'))+'</div>'+
        (canRevive ? '<button class="action gold" style="margin-top:4px;padding:4px 10px;font-size:0.75rem;" onclick="sendRevive(\''+id+'\')">Reanimar con pocion</button>' : '')+
        (downed && !canRevive && !iAmDowned ? '<div class="small-note" style="color:var(--accent);">Necesita una pocion o curacion para reanimarse.</div>' : '')+
      '</div>'+
    '</div>';
  }).join('');
}
function sendRevive(targetId){
  if(!currentCode) return;
  socket.emit('revive', {code: currentCode, playerId, targetId});
}

function renderAdventure(){
  const p = partyCache;

  const activePlayer = getActivePlayerId(p);
  const activeName = activePlayer && p.characters[activePlayer] ? p.characters[activePlayer].name : null;
  const myTurn = activePlayer === playerId;

  renderUnifiedFeed();
  renderRoomMap();

  if(p.status==='idle' || !p.currentScene){
    clearPendingAction();
    document.getElementById('partyTurnInfo').textContent = myTurn || !activeName
      ? 'Es tu turno de explorar la cripta.'
      : ('Es el turno de '+activeName+'. Estas viendo la fiesta en vivo — esperá tu turno.');
    document.getElementById('startAdvBtn').disabled = !(myTurn || !activeName);
    applyViewMode();
    return;
  }

  const sc = p.currentScene;
  const isCombat = sc.type==='combate';
  // fuera de combate, cualquier miembro de la fiesta puede resolver la escena (el grupo decide en conjunto)
  const myChar = p.characters[playerId];
  const inGroup = !sc.groupMembers || sc.groupMembers.includes(playerId);
  const canAct = isCombat ? myTurn : (!!myChar && inGroup);

  document.getElementById('sceneTitle').textContent = sc.title || '-';
  document.getElementById('sceneText').textContent = sc.text || '';
  document.getElementById('actorNote').textContent = isCombat
    ? (myTurn ? 'Es tu turno de decidir.' : ('Esta escena la esta jugando '+(activeName||'otro jugador')+'. La estas viendo en vivo.'))
    : (inGroup ? 'Cualquiera de la fiesta puede responder a esto — hablenlo por el chat si quieren.' : 'Tu personaje esta en otra parte de la cripta ahora mismo — esta escena no es tuya.');
  applyViewMode();
  renderSceneImage(sc);

  const enemyBlock = document.getElementById('enemyBlock');
  const choicesDiv = document.getElementById('choices');
  const rollPrompt = document.getElementById('rollPrompt');
  choicesDiv.innerHTML = '';
  clearIntentHint();

  if(isCombat && sc.enemy){
    enemyBlock.classList.remove('hidden');
    document.getElementById('enemyName').textContent = sc.enemy.name;
    document.getElementById('enemyHpText').textContent = Math.max(0,sc.enemy.hp)+' / '+sc.enemy.maxHp+' PV';
    document.getElementById('enemyHpBar').style.width = Math.max(0,(sc.enemy.hp/sc.enemy.maxHp)*100)+'%';
  } else {
    enemyBlock.classList.add('hidden');
  }

  if(!canAct){
    rollPrompt.classList.add('hidden');
    return;
  }

  if(pendingAction){
    rollPrompt.classList.remove('hidden');
    let advTag = '';
    if(pendingAction.adv==='adv') advTag = ' <strong style="color:var(--accent-2);">(con Ventaja)</strong>';
    else if(pendingAction.adv==='disadv') advTag = ' <strong style="color:var(--accent);">(con Desventaja)</strong>';
    rollPrompt.innerHTML = '<span class="roll-highlight">El dado D20 esta brillando — tocalo para tirar tu accion.</span>'+advTag;
    addChoice('Cancelar', ()=>{ clearPendingAction(); renderAdventure(); });
    return;
  }
  rollPrompt.classList.add('hidden');

  if(isCombat && sc.enemy){
    const cd = CLASSES[myChar.cls];
    const hasPotion = myChar.inventory.includes('Pocion menor de curacion');
    const HEAL_CLASSES = ['clerigo','bardo'];
    addChoice('Atacar', ()=>sendAction('attack'), false, 'attack');
    const specialUsed = !!(sc.usedSpecialBy && sc.usedSpecialBy.includes(playerId));
    if(HEAL_CLASSES.includes(myChar.cls)){
      addChoice(cd.special.split(':')[0], ()=>showHealTargetPicker(), specialUsed, 'special');
    } else {
      addChoice(cd.special.split(':')[0], ()=>sendAction('special'), specialUsed, 'special');
    }
    addChoice('Defenderse (reduce el daño que recibis)', ()=>sendAction('defend'), false, 'defend');
    addChoice('Usar pocion de curacion', ()=>showPotionTargetPicker(), !hasPotion, 'usepotion');
    addChoice('Intentar huir', ()=>sendAction('flee'), false, 'flee');
  } else if(sc.type==='hallazgo'){
    addChoice('Recoger el hallazgo', ()=>sendAction('collect'), false, 'collect');
    addChoice('Seguir de largo', ()=>sendAction('skip'), false, 'skip');
  } else if(sc.type==='puerta'){
    addChoice('Buscar la llave escondida', ()=>sendAction('search_key'), false, 'search_key');
    addChoice('Forzar la puerta', ()=>sendAction('force_door'), false, 'force_door');
    addChoice('Tomar otro camino', ()=>sendAction('skip'), false, 'skip');
  } else if(sc.type==='bifurcacion'){
    if(sc.choices && sc.choices[playerId]){
      const chosen = sc.paths.find(p2=>p2.id===sc.choices[playerId]);
      const waitingOn = (sc.forkMembers||[]).filter(id=>!sc.choices[id]).map(id=>p.characters[id]?p.characters[id].name:id);
      choicesDiv.innerHTML = '<p class="small-note">Elegiste: <strong>'+(chosen?chosen.label:'')+'</strong>. Esperando a que elijan: '+(waitingOn.length?waitingOn.join(', '):'nadie mas, ya deberian estar avanzando...')+'</p>';
    } else {
      (sc.paths||[]).forEach(pathOpt=>{
        addChoice(pathOpt.label, ()=>sendActionWithTarget('choose_path', pathOpt.id), false, pathOpt.id==='A'?'choose_path_A':'choose_path_B');
      });
    }
  } else {
    const USABLE_ITEMS_CLIENT = {
      'Antorcha': {scenes:['exploracion','trampa'], label:'Usar la antorcha para ver mejor'},
      'Cuerda (15m)': {scenes:['exploracion'], label:'Usar la cuerda para asegurar el paso'}
    };
    if(!sc.dcReduction){
      Object.entries(USABLE_ITEMS_CLIENT).forEach(([itemName, def])=>{
        if(def.scenes.includes(sc.type) && myChar.inventory.includes(itemName)){
          const kind = itemName==='Antorcha' ? 'use_torch' : 'use_rope';
          addChoice(def.label, ()=>sendUseItem(itemName), false, kind);
        }
      });
    } else {
      addChoice('(Ya usaste algo para ayudarte aca — la dificultad ya bajo)', ()=>{}, true, 'item_used');
    }
    addChoice('Intentar ('+ABIL_LABEL[sc.abil]+', CD '+Math.max(5,sc.dc-(sc.dcReduction||0))+')', ()=>sendAction('check'), false, 'check');
    addChoice('Probar otro enfoque (mas dificil, CD '+Math.max(5,sc.dc+2-(sc.dcReduction||0))+')', ()=>sendAction('check_alt'), false, 'check_alt');
    addChoice('Evitar la situacion', ()=>sendAction('skip'), false, 'skip');
  }
}

function sendUseItem(itemName){
  if(!currentCode) return;
  socket.emit('action', {code: currentCode, playerId, kind:'use_item', itemName});
}
function sendEatRations(){
  if(!currentCode) return;
  socket.emit('eat_rations', {code: currentCode, playerId});
}

function showHealTargetPicker(){
  const p = partyCache;
  const sc = p.currentScene;
  const choicesDiv = document.getElementById('choices');
  choicesDiv.innerHTML = '';
  const presentIds = (sc.combatOrder||[]).filter(e=>e.type==='player' && !(sc.fledIds||[]).includes(e.id)).map(e=>e.id);
  presentIds.forEach(id=>{
    const c = p.characters[id];
    if(!c) return;
    const label = (id===playerId ? 'Curarme a mi mismo' : 'Curar a '+c.name) + ' ('+c.hp+'/'+c.maxHp+' PV)' + (c.hp<=0?' — CAIDO':'');
    addChoice(label, ()=>sendActionWithTarget('special', id));
  });
  addChoice('Cancelar', ()=>renderAdventure());
}
function showPotionTargetPicker(){
  const p = partyCache;
  const sc = p.currentScene;
  const choicesDiv = document.getElementById('choices');
  choicesDiv.innerHTML = '';
  const presentIds = (sc.combatOrder||[]).filter(e=>e.type==='player' && !(sc.fledIds||[]).includes(e.id)).map(e=>e.id);
  presentIds.forEach(id=>{
    const c = p.characters[id];
    if(!c) return;
    const label = (id===playerId ? 'Bebermela yo' : 'Darsela a '+c.name) + ' ('+c.hp+'/'+c.maxHp+' PV)' + (c.hp<=0?' — CAIDO, se reanima':'');
    addChoice(label, ()=>sendActionWithTarget('usepotion', id));
  });
  addChoice('Cancelar', ()=>renderAdventure());
}
function sendActionWithTarget(kind, targetId){
  if(!currentCode) return;
  socket.emit('action', {code: currentCode, playerId, kind, targetId});
}

function renderSceneImage(sc){
  const box = document.getElementById('sceneImageBox');
  const p = partyCache;
  const myChar = p && p.characters[playerId];

  if(sc.type==='combate' && sc.enemy){
    const chars = (p && p.characters) || {};
    const ids = Object.keys(chars);
    const enemyImgHtml = sc.enemy.image
      ? '<img src="'+sc.enemy.image+'" alt="'+sc.enemy.name+'">'
      : '<div class="scene-image-placeholder" style="height:100%;display:flex;align-items:center;justify-content:center;"><span class="sip-icon">💀</span></div>';
    const partyIconsHtml = '<div class="vs-party-label">Party</div>' + ids.map(id=>{
      const c = chars[id];
      return '<div class="avatar-ring small" style="'+ringStyle(Math.max(0,Math.min(100,Math.round((c.hp/c.maxHp)*100))), 100, c.hp<=0)+'; margin:0 auto;"><div class="avatar-ring-inner">'+(CLASS_ICON[c.cls]||'🧙')+'</div></div>'
    }).join('');
    box.innerHTML =
      '<div class="vs-box">'+
        '<div class="vs-enemy">'+enemyImgHtml+'<div class="vs-enemy-name">'+sc.enemy.name+'</div></div>'+
        '<div class="vs-divider">VS</div>'+
        '<div class="vs-party">'+partyIconsHtml+'</div>'+
      '</div>';
    return;
  }

  let src = null;
  if(sc.type==='puerta'){
    src = DOOR_SCENE_IMAGE;
  } else if(myChar && typeof myChar.mapPos==='number' && myChar.mapPos>=0){
    const pt = MAP_POINTS[myChar.mapPos];
    if(pt && pt.image) src = pt.image;
  }
  if(src){
    box.innerHTML = '<img src="'+src+'" alt="'+(sc.title||'Escena')+'" style="width:100%;height:100%;object-fit:cover;border-radius:6px;display:block;">';
  } else {
    box.innerHTML = '<div class="scene-image-placeholder"><span class="sip-icon">🖼️</span><span class="small-note">Imagen de la escena (proximamente)</span></div>';
  }
}

function renderTurnStrip(){
  const el = document.getElementById('turnStrip');
  const label = document.querySelector('#turnStripPanel .small-note');
  if(!el) return;
  const p = partyCache;
  const chars = (p && p.characters) || {};
  const sc = p && p.currentScene;

  if(sc && sc.type==='combate' && sc.combatOrder && sc.combatOrder.length){
    if(label) label.textContent = 'Orden de iniciativa en este combate';
    el.innerHTML = sc.combatOrder.map((entry,i)=>{
      const isActive = i===sc.combatIdx;
      const fled = entry.type==='player' && sc.fledIds && sc.fledIds.includes(entry.id);
      const icon = entry.type==='enemy' ? '💀' : (CLASS_ICON[chars[entry.id] && chars[entry.id].cls] || '🧙');
      return '<div class="turn-strip-item'+(isActive?' active':'')+'" style="'+(fled?'opacity:0.3;':'')+'" title="'+entry.name+' (iniciativa '+entry.init+')'+(fled?' — huyo':'')+'">'+icon+'</div>';
    }).join('');
    return;
  }

  if(label) label.textContent = 'Orden de turno (quien explora a continuacion)';
  const turnQueue = (p && p.turnQueue && p.turnQueue.length) ? p.turnQueue : Object.keys(chars).sort();
  if(!turnQueue.length){ el.innerHTML = '<p class="small-note">Nadie en la fiesta todavia.</p>'; return; }
  el.innerHTML = turnQueue.map((id,i)=>{
    const c = chars[id];
    if(!c) return '';
    const isActive = i===0;
    return '<div class="turn-strip-item'+(isActive?' active':'')+'" title="'+c.name+'">'+(CLASS_ICON[c.cls]||'🧙')+'</div>';
  }).join('');
}

function addChoice(label, fn, disabled, kind){
  const btn = document.createElement('button');
  btn.className='choice-btn';
  btn.textContent = label;
  if(kind) btn.dataset.kind = kind;
  if(disabled){ btn.disabled=true; btn.style.opacity=0.5; }
  btn.addEventListener('click', ()=>{ clearIntentHint(); fn(); });
  document.getElementById('choices').appendChild(btn);
}

const NO_ROLL_SPECIAL_CLASSES = ['mago','druida','barbaro'];
const HEAL_SPECIAL_CLASSES = ['clerigo','bardo'];

function sendAction(kind){
  if(!currentCode) return;
  if(kind==='special'){
    const myChar = partyCache && partyCache.characters[playerId];
    if(myChar && NO_ROLL_SPECIAL_CLASSES.includes(myChar.cls)){
      socket.emit('action', {code: currentCode, playerId, kind});
      return;
    }
  }
  if(ROLL_REQUIRED_KINDS.includes(kind)){
    requestRoll(kind);
    return;
  }
  socket.emit('action', {code: currentCode, playerId, kind});
}

function sendActionWithRoll(kind, clientRoll){
  if(!currentCode) return;
  socket.emit('action', {code: currentCode, playerId, kind, clientRoll});
}

function renderUnifiedFeed(){
  const feedEl = document.getElementById('unifiedFeed');
  if(!feedEl || !partyCache) return;
  const logEntries = (partyCache.log||[]).map(l=>Object.assign({kindGroup:'log'}, l));
  const chatEntries = (partyCache.chat||[]).map(m=>Object.assign({kindGroup:'chat'}, m));
  const all = logEntries.concat(chatEntries).sort((a,b)=> (a.ts||0) - (b.ts||0));

  feedEl.innerHTML = all.map(e=>{
    if(e.kindGroup==='chat'){
      const mine = e.playerId===playerId ? ' me' : '';
      return '<div class="chat-msg'+mine+'"><span class="who">'+(e.name||'Anonimo')+':</span> '+escapeHtml(e.text)+'</div>';
    }
    if(e.kind==='dm'){
      return '<p class="dm-line"><span class="tag dm">🎭 DM</span> <em>'+e.text+'</em></p>';
    }
    const tagClass = e.kind==='ok'?'ok':(e.kind==='bad'?'bad':'');
    const tagText = e.kind==='ok'?'OK':(e.kind==='bad'?'X':'-');
    return '<p><span class="tag '+tagClass+'">'+tagText+'</span> '+e.text+'</p>';
  }).join('');
  feedEl.scrollTop = feedEl.scrollHeight;
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
