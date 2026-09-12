// Real engine and Socket.IO handlers; database I/O is an in-memory fixture.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { test } = require('node:test'), assert = require('node:assert/strict');
const { IslandBetrayalGame, BOAT_COST } = require('../src/games/island_betrayal/IslandBetrayalGame.ts');
const create = (n=4) => { const g=new IslandBetrayalGame('test'); for(let i=1;i<=n;i++)g.addPlayer({userId:`p${i}`,username:`Player${i}`});g.start();return g; };
const go=(g,phase)=>{clearTimeout(g.timer);g.phase=phase;g.phaseEndsAt=Date.now()+100000;};
const act=(g,id,type,payload={})=>g.handleAction(id,`island:${type}`,payload), get=(g,id)=>g.survivors.get(id);
test('authoritative timer, full day loop, no client end-day, idempotent cleanup',t=>{
 t.mock.timers.enable({apis:['Date','setTimeout']});const g=create();
 try{assert.equal(g.phase,'DAY_START');t.mock.timers.tick(2000);assert.equal(g.phase,'ACTION');const deadline=g.phaseEndsAt;
 act(g,'p1','move',{location:'jungle'});assert.equal(g.phaseEndsAt,deadline);assert.throws(()=>act(g,'p1','endDay'));
 t.mock.timers.tick(300000);assert.equal(g.phase,'SECRET');assert.throws(()=>act(g,'p1','explore'));
 t.mock.timers.tick(30000);assert.equal(g.phase,'EVENT');t.mock.timers.tick(3000);assert.equal(g.phase,'SURVIVAL');assert.equal(get(g,'p1').inventory.water,1);
 t.mock.timers.tick(3000);assert.equal(g.day,2);t.mock.timers.tick(2000);assert.equal(g.phase,'ACTION');const r=g.end();t.mock.timers.tick(1000000);assert.deepEqual(g.end(),r);
 }finally{g.end();t.mock.timers.reset();}
});
test('privacy, malicious payloads, atomic resource collection/trade, help and requests',()=>{
 const g=create();go(g,'ACTION');try{
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
 act(g,'p1','explore');assert.equal(get(g,'p1').energy,8);get(g,'p1').energy=0;assert.throws(()=>act(g,'p1','explore'));
 get(g,'p1').health=0;g.checkDeaths();for(const type of ['chat','offer','request','help','secret','escape','move','explore'])assert.throws(()=>act(g,'p1',type,{text:'dead message'}));
 }finally{g.end();}
});
test('night locks, all voters, anonymous theft/sabotage, investigation, help, departure/rejoin',()=>{
 const g=create(8);go(g,'SECRET');try{
 g.boat.wood=3;get(g,'p3').inventory.food=0;get(g,'p3').inventory.water=0;get(g,'p3').inventory.metal=1;
 act(g,'p1','secret',{kind:'STEAL',target:'p3'});act(g,'p2','secret',{kind:'SABOTAGE',component:'wood'});act(g,'p3','secret',{kind:'INVESTIGATE',target:'p1'});act(g,'p4','secret',{kind:'HELP',target:'p6',resource:'food'});act(g,'p5','secret',{kind:'INVESTIGATE',target:'boat'});act(g,'p6','secret',{kind:'SKIP'});act(g,'p7','secret',{kind:'SKIP'});
 assert.equal(g.phase,'SECRET');g.removePlayer('p1');g.reconnectPlayer('p1');assert.throws(()=>act(g,'p1','secret',{kind:'SKIP'}));assert.equal(JSON.stringify(g.getPublicState()).includes('STEAL'),false);g.removePlayer('p8');assert.equal(g.phase,'EVENT');assert.equal(g.boat.wood,2);assert.equal(get(g,'p2').sabotages,1);assert.equal(get(g,'p1').inventory.metal,1);assert.equal(get(g,'p3').inventory.metal,0);assert.deepEqual(get(g,'p4').helped,['p6']);
 assert.ok(g.getPrivateState('p3').evidence.some(e=>e.includes('หายไป')));assert.ok(g.getPrivateState('p3').evidence.some(e=>e.includes('ความเชื่อมั่น')));
 const logs=g.getPublicState().logs.map(l=>l.text).join(' ');assert.ok(!logs.includes('Player1 ขโมย'));assert.ok(!logs.includes('Player2 ทำลาย'));
 const before=g.getPrivateState('p8');g.reconnectPlayer('p8');assert.deepEqual(g.getPrivateState('p8'),before);assert.throws(()=>g.reconnectPlayer('outsider'));const r=g.end();assert.ok(r.details.timeline.some(l=>l.text.includes('Player1 ขโมย')));
 }finally{g.end();}
});
test('boat complete, seat cap, rescue, objectives, truth and no double finish',()=>{
 const g=create(8);go(g,'ACTION');try{get(g,'p1').location='beach';for(const [r,q]of Object.entries(BOAT_COST)){get(g,'p1').inventory[r]=q;act(g,'p1','contribute',{resource:r,quantity:q});}assert.equal(g.phase,'ESCAPE');assert.equal(g.seats,5);assert.throws(()=>act(g,'p1','explore'));
 get(g,'p1').inventory.rope=1;get(g,'p1').objective=0;get(g,'p1').inventory.valuable=2;act(g,'p1','escape',{choice:'BOARD'});act(g,'p1','escape',{choice:'RESCUE',target:'p2'});for(const id of ['p3','p4','p5'])act(g,id,'escape',{choice:'BOARD'});assert.throws(()=>act(g,'p6','escape',{choice:'BOARD'}));for(const id of ['p6','p7','p8'])act(g,id,'escape',{choice:'STAY'});assert.equal(g.phase,'FINISHED');const r=g.end();assert.equal(r.winnerUserIds.length,5);assert.equal(r.details.scores.p1,2);assert.deepEqual(g.end(),r);
 }finally{g.end();}
});
test('late action rejection, absent night voters, starvation death and ten-day cap',()=>{
 const g=create();go(g,'ACTION');try{g.phaseEndsAt=Date.now()-1;assert.throws(()=>act(g,'p1','explore'));assert.equal(g.phase,'SECRET');for(let i=1;i<=4;i++)g.removePlayer(`p${i}`);assert.equal(g.phase,'EVENT');for(const p of g.survivors.values()){p.health=1;p.hunger=0;p.thirst=0;p.inventory.food=0;p.inventory.water=0;}g.survive();assert.equal(g.phase,'FINISHED');}finally{g.end();}
 const h=create();try{h.day=11;h.beginDay();assert.equal(h.isFinished(),true);}finally{h.end();}
});
let room;const sessions=[];
const prisma={room:{findUnique:async()=>room,update:async({data})=>Object.assign(room,data),updateMany:async({data})=>Object.assign(room,data)},roomPlayer:{findMany:async()=>room.players,updateMany:async({data})=>{room.players.forEach(p=>Object.assign(p,data));return{count:room.players.length};}},gameSession:{create:async({data})=>{const s={...data,id:`s${sessions.length}`,history:[],startedAt:new Date()};sessions.push(s);return s;},update:async({where,data})=>Object.assign(sessions.find(s=>s.id===where.id),data),count:async()=>sessions.filter(s=>s.status==='COMPLETED').length,findMany:async()=>sessions.filter(s=>s.status==='COMPLETED')},gameHistory:{create:async({data})=>{sessions.find(s=>s.id===data.gameSessionId).history.push(data);return data;}},$transaction:async ops=>Promise.all(ops)};
const originalLoad=Module._load;Module._load=function(id,parent,main){if(id.endsWith('/config/prisma'))return{prisma};if(id==='bcryptjs')return{};return originalLoad.call(this,id,parent,main);};
const {GameRegistry}=require('../src/games/core/GameRegistry.ts'),{GameManager}=require('../src/games/core/GameManager.ts'),{RoomService}=require('../src/services/RoomService.ts'),{registerRoomSocket}=require('../src/socket/roomSocket.ts'),{registerGameSocket,abortRoomGame}=require('../src/socket/gameSocket.ts');
const {createServer}=require('node:http'),{Server}=require('socket.io'),{io:clientIO}=Module.createRequire(path.resolve(__dirname,'../../client/package.json'))('socket.io-client');
GameRegistry.register('island_betrayal',id=>new IslandBetrayalGame(id));
RoomService.joinRoom=async id=>{if(!room.players.some(p=>p.userId===id))throw new Error('not a member');return{...room,players:room.players.map(p=>({...p,username:p.user.username}))};};
const waitFor=(socket,event,predicate=()=>true)=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{socket.off(event,handler);reject(new Error(`Timed out: ${event}`));},4000);const handler=value=>{if(predicate(value)){clearTimeout(timeout);socket.off(event,handler);resolve(value);}};socket.on(event,handler);});
for(const n of [4,8])test(`real Socket.IO ${n} players: join/start/actions/private state/rejoin/result persistence`,async()=>{
 sessions.length=0;room={id:`socket-${n}`,roomCode:'ISLAND',roomName:'Island test',createdAt:new Date(),status:'WAITING',hostId:'p1',gameId:'island',settings:{},maxPlayers:n,game:{slug:'island_betrayal',name:'Island Betrayal',minPlayers:4,maxPlayers:8},players:Array.from({length:n},(_,i)=>({userId:`p${i+1}`,user:{username:`Player${i+1}`},joinedAt:new Date(),isReady:true,isHost:i===0}))};
 const http=createServer(),io=new Server(http),clients=[];io.on('connection',socket=>{socket.data.user={id:socket.handshake.auth.id,username:socket.handshake.auth.id};registerRoomSocket(io,socket);registerGameSocket(io,socket);});await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
 const ack=(i,event,data)=>clients[i].timeout(4000).emitWithAck(event,data),send=(i,type,payload={})=>ack(i,'game:action',{roomId:room.id,actionType:`island:${type}`,payload});
 try{for(let i=1;i<=n;i++){const c=clientIO(`http://127.0.0.1:${http.address().port}`,{transports:['websocket'],auth:{id:`p${i}`},forceNew:true});clients.push(c);await waitFor(c,'connect');assert.equal((await ack(i-1,'room:join',{roomCode:'ISLAND'})).ok,true);}
 assert.equal((await ack(1,'game:start',{roomId:room.id})).ok,false);const first=clients.map(c=>waitFor(c,'game:state'));const startReply=await ack(0,'game:start',{roomId:room.id});assert.equal(startReply.ok,true,startReply.error);for(const s of await Promise.all(first)){assert.equal(s.public.players.length,n);assert.equal(Object.hasOwn(s.public.players[0],'objective'),false);assert.equal(s.private.inventory.food,2);}assert.equal(sessions.length,1);
 const g=GameManager.getGame(room.id);await waitFor(clients[0],'game:state',s=>s.public.phase==='ACTION');for(let i=1;i<=n;i++)get(g,`p${i}`).inventory.valuable=i;const snapshots=clients.map(c=>waitFor(c,'game:state',s=>s.public.chat.at(-1)?.text==='Meeting at beach'));assert.equal((await send(0,'chat',{text:'Meeting at beach',userId:'p2'})).ok,true);for(const[i,s]of(await Promise.all(snapshots)).entries()){assert.equal(s.private.inventory.valuable,i+1);assert.equal(s.public.chat.at(-1).userId,'p1');}
 assert.equal((await send(0,'move',{location:'beach'})).ok,true);assert.equal((await send(0,'explore')).ok,true);const available=Object.entries(g.ground.beach).find(([,q])=>q>0);assert.equal((await send(0,'collect',{resource:available[0],quantity:1})).ok,true);
 const before=g.getPrivateState('p2');assert.equal((await ack(1,'room:pause',{roomId:room.id})).ok,true);assert.equal((await send(1,'chat',{text:'blocked'})).ok,false);const rejoin=await ack(1,'room:join',{roomCode:'ISLAND'});assert.equal(rejoin.ok,true);assert.deepEqual(rejoin.gameState.private,before);
 for(const[r,q]of Object.entries(BOAT_COST)){get(g,'p1').inventory[r]=q;assert.equal((await send(0,'contribute',{resource:r,quantity:q})).ok,true);}const ended=waitFor(clients[0],'game:end');for(let i=0;i<n;i++)assert.equal((await send(i,'escape',{choice:i<5?'BOARD':'STAY'})).ok,true);await ended;assert.equal(sessions.length,1);assert.equal(sessions[0].history.length,1);assert.equal(sessions[0].history[0].resultData.details.players.length,n);assert.equal(sessions[0].status,'COMPLETED');assert.equal(room.status,'WAITING');assert.equal(sessions[0].history[0].resultData.match.numberOfRounds,1);
 }finally{abortRoomGame(room.id);clients.forEach(c=>c.disconnect());await new Promise(resolve=>io.close(resolve));}
});
