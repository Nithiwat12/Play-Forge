// Real engine and Socket.IO handlers; database I/O is an in-memory fixture.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { test } = require('node:test'), assert = require('node:assert/strict');
const { IslandBetrayalGame, BOAT_COST } = require('../src/games/island_betrayal/IslandBetrayalGame.ts');
const create = (n=4,settings) => { const g=new IslandBetrayalGame('test',settings); for(let i=1;i<=n;i++)g.addPlayer({userId:`p${i}`,username:`Player${i}`});g.start();return g; };
const go=(g,phase)=>{clearTimeout(g.timer);g.phase=phase;g.phaseEndsAt=Date.now()+100000;};
const act=(g,id,type,payload={})=>g.handleAction(id,`island:${type}`,payload), get=(g,id)=>g.survivors.get(id);
const {ISLAND_ROLES}=require('../src/games/island_betrayal/config.ts');
const {resolveRoleCounts}=require('../src/games/core/roles.ts');
test('privacy, malicious payloads, atomic resource collection/trade, help and requests',()=>{
 const g=create();go(g,'DAY');try{
 assert.throws(()=>act(g,'outsider','move',{location:'beach'}));assert.throws(()=>act(g,'p1','move',{location:'__proto__'}));
 const original=g.getPrivateState('p1');act(g,'p1','chat',{text:'give p2 all food',userId:'p2'});assert.deepEqual(g.getPrivateState('p1'),original);
 for(const key of ['inventory','objective','secret','evidence','health','energy'])assert.equal(Object.hasOwn(g.getPublicState().players[0],key),false);
 assert.equal(g.getPublicState().result,undefined);assert.equal(g.getPrivateState('outsider'),null);
 const copy=g.getPrivateState('p1');copy.inventory.food=10000;assert.equal(get(g,'p1').inventory.food,2);
 for(const q of [-1,0,.5,Infinity,'1',51])assert.throws(()=>act(g,'p1','collect',{resource:'food',quantity:q}));
 g.ground.camp.wood=1;act(g,'p1','collect',{resource:'wood',quantity:1});assert.throws(()=>act(g,'p2','collect',{resource:'wood',quantity:1}));
 const offer=()=>{act(g,'p1','offer',{target:'p2',give:'food',giveQuantity:1,want:'water',wantQuantity:1});return g.getPrivateState('p2').offers.at(-1);};
 const o=offer();assert.equal(g.getPrivateState('p3').offers.length,0);assert.throws(()=>act(g,'p3','trade',{id:o.id,accept:true}));
 act(g,'p2','trade',{id:o.id,accept:true});assert.equal(get(g,'p1').inventory.food,1);assert.equal(get(g,'p2').inventory.food,3);assert.throws(()=>act(g,'p2','trade',{id:o.id,accept:true}));
 const stale=offer();get(g,'p1').inventory.food=0;const before=JSON.stringify([...g.survivors.values()].map(p=>p.inventory));assert.throws(()=>act(g,'p2','trade',{id:stale.id,accept:true}));assert.equal(JSON.stringify([...g.survivors.values()].map(p=>p.inventory)),before);act(g,'p2','trade',{id:stale.id,accept:false});
 get(g,'p1').health=40;get(g,'p2').inventory.medicine=1;act(g,'p1','request',{kind:'help',resource:'medicine',quantity:1});const r=g.getPublicState().requests[0];assert.equal(r.health,40);act(g,'p2','fulfill',{id:r.id});assert.equal(get(g,'p1').health,65);assert.deepEqual(get(g,'p2').helped,['p1']);assert.throws(()=>act(g,'p2','fulfill',{id:r.id}));
 act(g,'p1','request',{kind:'resource',resource:'food',quantity:1});act(g,'p2','fulfill',{id:g.getPublicState().requests.at(-1).id});assert.equal(get(g,'p1').inventory.food,1);
 act(g,'p1','explore');assert.equal(get(g,'p1').energy,90);get(g,'p1').energy=0;assert.throws(()=>act(g,'p1','explore'));
 get(g,'p1').health=0;g.checkDeaths();for(const type of ['chat','offer','request','help','secret','escape','move','explore'])assert.throws(()=>act(g,'p1',type,{text:'dead message'}));
 }finally{g.end();}
});
test('role distribution at 4/6/8/10/12/15, configuration modes and immutable assignment',()=>{
 for(const n of [4,6,8,10,12,15]){const g=create(n);try{assert.equal([...g.survivors.values()].filter(p=>p.role==='spy').length,n<=6?1:n<=10?2:3);assert.equal(Object.hasOwn(g.getPublicState().players[0],'role'),false);assert.equal(g.getPrivateState('p1').allies.length,0);assert.throws(()=>act(g,'p1','role',{role:'spy'}));}finally{g.end();}}
 assert.equal(resolveRoleCounts(ISLAND_ROLES,{spy:{mode:'exact',count:2}},6).spy,2);assert.equal(resolveRoleCounts(ISLAND_ROLES,{spy:{mode:'percentage',percentage:25,maxCount:5}},12).spy,3);assert.equal(resolveRoleCounts(ISLAND_ROLES,{spy:{mode:'per_players',perPlayers:3,maxCount:4}},12).spy,4);
 for(const input of [{spy:{mode:'exact',count:4}},{spy:{mode:'exact',count:-1}},{unknown:{mode:'default'}}])assert.throws(()=>resolveRoleCounts(ISLAND_ROLES,input,4));
});
test('equal day/night timer, morning/discussion/vote, deadlines and restart-free rejoin',t=>{
 t.mock.timers.enable({apis:['Date','setTimeout','setInterval']});const g=create(4,{island:{cycleSeconds:60,discussionSeconds:15,voteSeconds:15}});
 try{t.mock.timers.tick(2000);assert.equal(g.phase,'DAY');const dayDuration=g.phaseEndsAt-Date.now();assert.throws(()=>act(g,'p1','endDay'));t.mock.timers.tick(60000);assert.equal(g.phase,'NIGHT');assert.equal(g.phaseEndsAt-Date.now(),dayDuration);assert.throws(()=>act(g,'p1','explore'));
 const before=g.getPrivateState('p1');g.removePlayer('p1');g.reconnectPlayer('p1');assert.deepEqual(g.getPrivateState('p1'),before);t.mock.timers.tick(60000);assert.equal(g.phase,'MORNING');t.mock.timers.tick(5000);assert.equal(g.phase,'DISCUSSION');t.mock.timers.tick(15000);assert.equal(g.phase,'VOTE');t.mock.timers.tick(15000);assert.equal(g.phase,'VOTE_RESULT');t.mock.timers.tick(5000);assert.equal(g.day,2);g.end();assert.equal(g.timer,null);assert.equal(g.worldTimer,null);
 }finally{g.end();t.mock.timers.reset();}
});
test('adjacency, energy, capacity, upgrades at camp only, drops/expiry and food energy caps',()=>{
 const g=create();go(g,'DAY');try{assert.throws(()=>act(g,'p1','move',{location:'beach'}));act(g,'p1','move',{location:'plains'});assert.equal(get(g,'p1').energy,95);get(g,'p1').energy=0;assert.throws(()=>act(g,'p1','move',{location:'beach'}));act(g,'p1','use',{resource:'food'});assert.equal(get(g,'p1').energy,25);
 const p=get(g,'p1');p.inventory.wood=5;assert.equal(g.used(p),8);g.ground.plains.wood=3;assert.throws(()=>act(g,'p1','collect',{resource:'wood',quantity:1}));act(g,'p1','drop',{resource:'wood',quantity:2});const d=g.drops.at(-1);assert.throws(()=>act(g,'p2','pickup',{id:d.id,resource:'wood',quantity:1}));act(g,'p1','pickup',{id:d.id,resource:'wood',quantity:1});d.expiresDay=g.day;assert.throws(()=>act(g,'p1','pickup',{id:d.id,resource:'wood',quantity:1}));
 p.inventory={...p.inventory,wood:0,rope:2,metal:2,parts:1};assert.throws(()=>act(g,'p1','upgrade'));p.location='camp';act(g,'p1','upgrade');assert.equal(g.capacity(p),12);assert.equal(p.inventory.parts,0);p.energy=95;p.inventory.food=1;act(g,'p1','use',{resource:'food'});assert.equal(p.energy,100);
 }finally{g.end();}
});
test('night kill validation, witness alerts without identities, hidden death and private state, death loot',()=>{
 const g=create();go(g,'NIGHT');g.monsters=[];try{const p=get(g,'p1'),t=get(g,'p2');p.role='spy';t.role='survivor';get(g,'p3').role='survivor';get(g,'p4').role='survivor';p.location='jungle';t.location='mountain';get(g,'p3').location='jungle';get(g,'p4').location='camp';
 assert.throws(()=>act(g,'p3','kill',{target:'p4'}));assert.throws(()=>act(g,'p1','kill',{target:'p2'}));t.location='jungle';const inventory={...t.inventory};act(g,'p1','kill',{target:'p2'});assert.equal(t.alive,false);assert.equal(g.getPrivateState('p2').alive,false);assert.equal(g.getPublicState().players.find(p=>p.userId==='p2').alive,true);assert.equal(g.used(t),0);assert.deepEqual(g.drops.at(-1).items,inventory);assert.equal(g.getPublicState().drops.some(d=>d.hiddenUntilMorning),false);
 const witness=g.getPrivateState('p3').evidence.at(-1);assert.ok(witness.includes('เงาคน'));assert.ok(!witness.includes('Player1')&&!witness.includes('Player2'));assert.ok(g.getPrivateState('p4').evidence.at(-1).includes('ที่ใดที่หนึ่ง'));
 assert.throws(()=>act(g,'p1','kill',{target:'p3'}));for(const type of ['move','drop','collect','vote','chat','kill','mission'])assert.throws(()=>act(g,'p2',type,{text:'dead'}));g.removePlayer('p1');g.reconnectPlayer('p1');assert.equal(p.nightUsed,true);
 g.advancePhase();assert.equal(g.getPublicState().players.find(p=>p.userId==='p2').alive,false);const result=g.end();assert.ok(result.details.timeline.some(l=>l.text.includes('Player1 ลอบฆ่า Player2')));
 }finally{g.end();}
});
test('only Spy at beach may sabotage at night; boat alone and killing last spy do not finish game',()=>{
 const g=create();go(g,'NIGHT');g.monsters=[];try{get(g,'p1').role='spy';get(g,'p2').role='survivor';g.boat.wood=6;assert.throws(()=>act(g,'p1','sabotage',{component:'wood'}));get(g,'p1').location='beach';get(g,'p2').location='beach';assert.throws(()=>act(g,'p2','sabotage',{component:'wood'}));act(g,'p1','sabotage',{component:'wood'});assert.equal(g.boat.wood,4);assert.ok(!g.getPublicState().logs.at(-1).text.includes('Player1'));
 go(g,'VOTE');for(const p of g.survivors.values())p.role=p.userId==='p1'?'spy':'survivor';act(g,'p1','vote',{target:'p2'});assert.throws(()=>act(g,'p1','vote',{target:'p3'}));for(const id of ['p2','p3','p4'])act(g,id,'vote',{target:'p1'});assert.equal(get(g,'p1').alive,false);assert.equal(g.isFinished(),false);assert.equal(g.phase,'VOTE_RESULT');assert.equal(g.voteResult.role,'spy');
 go(g,'DAY');g.boat={...BOAT_COST};g.maybeEscape();assert.equal(g.phase,'DAY');g.missions.forEach(m=>m.progress=m.quantity);g.maybeEscape();assert.equal(g.phase,'ESCAPE');get(g,'p3').location='camp';assert.throws(()=>act(g,'p3','escape',{choice:'BOARD'}));get(g,'p3').location='beach';act(g,'p3','escape',{choice:'BOARD'});assert.throws(()=>act(g,'p3','move',{location:'plains'}));g.finishEscape();assert.equal(g.end().details.survivorWin,true);
 }finally{g.end();}
});
test('vote ties configured as none/random/revote, dead/duplicate ballots and offline voters',()=>{
 for(const rule of ['none','random','revote']){const g=create(4,{island:{tieRule:rule,revealEliminatedRoles:false}});go(g,'VOTE');try{for(const[id,target]of [['p1','p3'],['p2','p4'],['p3','p4'],['p4','p3']])act(g,id,'vote',{target});if(rule==='revote'){assert.equal(g.phase,'VOTE');assert.equal(g.votes.size,0);g.resolveVote();}else assert.equal(g.living().length,rule==='none'?4:3);assert.equal(g.voteResult.role,undefined);}finally{g.end();}}
 const g=create();go(g,'VOTE');try{act(g,'p1','vote',{target:'p4'});act(g,'p2','vote',{target:'p4'});act(g,'p3','vote',{target:'p4'});g.removePlayer('p4');assert.equal(g.phase,'VOTE_RESULT');assert.equal(get(g,'p4').alive,false);}finally{g.end();}
});
test('monster scaling, nests, encounter options, group combat and gradual survival',()=>{
 const g=create();go(g,'DAY');try{const first=g.monsters[0].maxHp,count=g.monsters.length;g.day=5;g.spawnMonsters();assert.ok(g.monsters[0].maxHp>first);assert.ok(g.monsters.length>=count);g.nests.forEach(n=>n.hp=0);g.spawnMonsters();assert.ok(g.monsters.length<=16);
 const p=get(g,'p1'),m=g.monsters[0];p.location=m.location;p.inventory.food=2;g.encounter.set('p1',m.id);act(g,'p1','encounter',{choice:'DISTRACT'});assert.equal(g.encounter.has('p1'),false);assert.equal(p.inventory.food,1);g.encounter.set('p1',m.id);m.hp=1;act(g,'p1','encounter',{choice:'FIGHT'});assert.equal(m.hp,0);
 p.location='forest';g.nests[0].hp=20;p.energy=100;act(g,'p1','nest',{id:g.nests[0].id});assert.equal(g.nests[0].hp,0);const before=p.thirst;g.worldTick();assert.ok(p.thirst<before);
 }finally{g.end();}
});
test('simultaneous pickups and trade capacity are atomic; missions require physical location',()=>{
 const g=create();go(g,'DAY');try{g.ground.camp.wood=1;act(g,'p1','collect',{resource:'wood',quantity:1});assert.throws(()=>act(g,'p2','collect',{resource:'wood',quantity:1}));
 act(g,'p1','offer',{target:'p2',give:'food',giveQuantity:2,want:'water',wantQuantity:1});const o=g.getPrivateState('p2').offers[0];get(g,'p2').inventory.wood=4;const before=JSON.stringify([...g.survivors.values()].map(p=>p.inventory));assert.throws(()=>act(g,'p2','trade',{id:o.id,accept:true}));assert.equal(JSON.stringify([...g.survivors.values()].map(p=>p.inventory)),before);
 const m=g.missions[1];get(g,'p1').inventory[m.resource]=1;assert.throws(()=>act(g,'p1','mission',{id:m.id,quantity:1}));get(g,'p1').location=m.location;act(g,'p1','mission',{id:m.id,quantity:1});assert.equal(m.progress,1);
 }finally{g.end();}
});
let room;const sessions=[];
const prisma={room:{findUnique:async()=>room,update:async({data})=>Object.assign(room,data),updateMany:async({data})=>Object.assign(room,data)},roomPlayer:{update:async({where,data})=>Object.assign(room.players.find(p=>p.id===where.id),data),findMany:async()=>room.players,updateMany:async({data})=>{room.players.forEach(p=>Object.assign(p,data));return{count:room.players.length};}},gameSession:{create:async({data})=>{const s={...data,id:`s${sessions.length}`,history:[],startedAt:new Date()};sessions.push(s);return s;},update:async({where,data})=>Object.assign(sessions.find(s=>s.id===where.id),data),count:async()=>sessions.filter(s=>s.status==='COMPLETED').length,findMany:async()=>sessions.filter(s=>s.status==='COMPLETED')},gameHistory:{create:async({data})=>{sessions.find(s=>s.id===data.gameSessionId).history.push(data);return data;}},$transaction:async ops=>Promise.all(ops)};
const originalLoad=Module._load;Module._load=function(id,parent,main){if(id.endsWith('/config/prisma'))return{prisma};if(id==='bcryptjs')return{};return originalLoad.call(this,id,parent,main);};
const {GameRegistry}=require('../src/games/core/GameRegistry.ts'),{GameManager}=require('../src/games/core/GameManager.ts'),{RoomService}=require('../src/services/RoomService.ts'),{registerRoomSocket}=require('../src/socket/roomSocket.ts'),{registerGameSocket,abortRoomGame}=require('../src/socket/gameSocket.ts');
const {createServer}=require('node:http'),{Server}=require('socket.io'),{io:clientIO}=Module.createRequire(path.resolve(__dirname,'../../client/package.json'))('socket.io-client');
GameRegistry.register('island_betrayal',(id,config)=>new IslandBetrayalGame(id,config),ISLAND_ROLES);
RoomService.joinRoom=async id=>{if(!room.players.some(p=>p.userId===id))throw new Error('not a member');return{...room,players:room.players.map(p=>({...p,username:p.user.username}))};};
const waitFor=(socket,event,predicate=()=>true)=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{socket.off(event,handler);reject(new Error(`Timed out: ${event}`));},4000);const handler=value=>{if(predicate(value)){clearTimeout(timeout);socket.off(event,handler);resolve(value);}};socket.on(event,handler);});
for(const n of [4,6,8,10,12,15])test(`real Socket.IO ${n} players: join/start/actions/private state/rejoin/result persistence`,async()=>{
 sessions.length=0;room={id:`socket-${n}`,roomCode:'ISLAND',roomName:'Island test',createdAt:new Date(),status:'WAITING',hostId:'p1',gameId:'island',settings:{},maxPlayers:n,game:{slug:'island_betrayal',name:'Island Betrayal',minPlayers:4,maxPlayers:15},players:Array.from({length:n},(_,i)=>({id:`rp${i+1}`,userId:`p${i+1}`,user:{username:`Player${i+1}`},joinedAt:new Date(),isReady:true,isHost:i===0}))};
 const http=createServer(),io=new Server(http),clients=[];io.on('connection',socket=>{socket.data.user={id:socket.handshake.auth.id,username:socket.handshake.auth.id};registerRoomSocket(io,socket);registerGameSocket(io,socket);});await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
 const ack=(i,event,data)=>clients[i].timeout(4000).emitWithAck(event,data),send=(i,type,payload={})=>ack(i,'game:action',{roomId:room.id,actionType:`island:${type}`,payload});
 try{for(let i=1;i<=n;i++){const c=clientIO(`http://127.0.0.1:${http.address().port}`,{transports:['websocket'],auth:{id:`p${i}`},forceNew:true});clients.push(c);await waitFor(c,'connect');assert.equal((await ack(i-1,'room:join',{roomCode:'ISLAND'})).ok,true);}
 assert.equal((await ack(1,'room:roles',{roomId:room.id,roleConfig:{spy:{mode:'exact',count:1}}})).ok,false);
 assert.equal((await ack(0,'room:roles',{roomId:room.id,roleConfig:{}})).ok,true);assert.ok(room.players.every(p=>!p.isReady));
 for(let i=0;i<n;i++)assert.equal((await ack(i,'room:ready',{roomId:room.id,isReady:true})).ok,true);
 assert.equal((await ack(1,'game:start',{roomId:room.id})).ok,false);const first=clients.map(c=>waitFor(c,'game:state'));const startReply=await ack(0,'game:start',{roomId:room.id});assert.equal(startReply.ok,true,startReply.error);for(const s of await Promise.all(first)){assert.equal(s.public.players.length,n);assert.equal(Object.hasOwn(s.public.players[0],'objective'),false);assert.equal(s.private.inventory.food,2);}assert.equal(sessions.length,1);
 assert.equal((await ack(0,'room:roles',{roomId:room.id,roleConfig:{}})).ok,false);
 const g=GameManager.getGame(room.id);assert.equal([...g.survivors.values()].filter(p=>p.role==='spy').length,n<=6?1:n<=10?2:3);await waitFor(clients[0],'game:state',s=>s.public.phase==='DAY');for(let i=1;i<=n;i++)get(g,`p${i}`).inventory.valuable=i;const snapshots=clients.map(c=>waitFor(c,'game:state',s=>s.public.chat.at(-1)?.text==='Meeting at beach'));assert.equal((await send(0,'chat',{text:'Meeting at beach',userId:'p2'})).ok,true);for(const[i,s]of(await Promise.all(snapshots)).entries()){assert.equal(s.private.inventory.valuable,i+1);assert.equal(s.public.chat.at(-1).userId,'p1');}
 for(const p of g.survivors.values())p.inventory.valuable=0;
 for(const dest of ['plains','beach'])for(const r of await Promise.all(clients.map((_,i)=>send(i,'move',{location:dest}))))assert.equal(r.ok,true,r.error);assert.equal((await send(0,'explore')).ok,true);g.ground.beach.valuable=1;const pickupResults=await Promise.all(clients.map((_,i)=>send(i,'collect',{resource:'valuable',quantity:1})));assert.equal(pickupResults.filter(r=>r.ok).length,1);const available=Object.entries(g.ground.beach).find(([,q])=>q>0);assert.equal((await send(0,'collect',{resource:available[0],quantity:1})).ok,true);
 const before=g.getPrivateState('p2');assert.equal((await ack(1,'room:pause',{roomId:room.id})).ok,true);assert.equal((await send(1,'chat',{text:'blocked'})).ok,false);const rejoin=await ack(1,'room:join',{roomCode:'ISLAND'});assert.equal(rejoin.ok,true);assert.deepEqual(rejoin.gameState.private,before);
 g.missions.forEach(m=>m.progress=m.quantity);
 for(const[r,q]of Object.entries(BOAT_COST)){get(g,'p1').inventory[r]=q;assert.equal((await send(0,'contribute',{resource:r,quantity:q})).ok,true);}const ended=waitFor(clients[0],'game:end');for(let i=0;i<n;i++)assert.equal((await send(i,'escape',{choice:'BOARD'})).ok,true);await ended;assert.equal(sessions.length,1);assert.equal(sessions[0].history.length,1);assert.equal(sessions[0].history[0].resultData.details.players.length,n);assert.equal(sessions[0].status,'COMPLETED');assert.equal(room.status,'WAITING');assert.equal(sessions[0].history[0].resultData.match.numberOfRounds,1);
 }finally{abortRoomGame(room.id);clients.forEach(c=>c.disconnect());await new Promise(resolve=>io.close(resolve));}
});

test('setup lock serializes role updates and start, then releases after failure',async()=>{const {withRoomSetupLock}=require('../src/games/core/roomSetupLock.ts');const order=[];let release;const gate=new Promise(r=>release=r);const edit=withRoomSetupLock('lock',async()=>{order.push('edit');await gate;order.push('saved');});const start=withRoomSetupLock('lock',async()=>{order.push('start');});await Promise.resolve();await Promise.resolve();release();await Promise.all([edit,start]);assert.deepEqual(order,['edit','saved','start']);await assert.rejects(withRoomSetupLock('lock',async()=>{throw new Error('fail');}));assert.equal(await withRoomSetupLock('lock',async()=>true),true);});
