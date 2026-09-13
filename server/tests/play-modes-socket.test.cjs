const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {test}=require('node:test'),assert=require('node:assert/strict');

let room;const sessions=[];
const prisma={room:{findUnique:async()=>room,update:async({data})=>Object.assign(room,data),updateMany:async({data})=>Object.assign(room,data)},roomPlayer:{update:async({where,data})=>Object.assign(room.players.find(p=>p.id===where.id),data),findMany:async()=>room.players,updateMany:async({data})=>{room.players.forEach(p=>Object.assign(p,data));return{count:room.players.length};}},gameSession:{create:async({data})=>{const s={...data,id:`s${sessions.length}`,history:[],startedAt:new Date()};sessions.push(s);return s;},update:async({where,data})=>Object.assign(sessions.find(s=>s.id===where.id),data),count:async()=>sessions.filter(s=>s.status==='COMPLETED').length,findMany:async()=>sessions.filter(s=>s.status==='COMPLETED')},gameHistory:{create:async({data})=>{sessions.find(s=>s.id===data.gameSessionId).history.push(data);return data;}},$transaction:async ops=>Promise.all(ops)};
const originalLoad=Module._load;Module._load=function(id,parent,main){if(id.endsWith('/config/prisma'))return{prisma};if(id==='bcryptjs')return{};return originalLoad.call(this,id,parent,main);};
const {GameRegistry}=require('../src/games/core/GameRegistry.ts'),{GameManager}=require('../src/games/core/GameManager.ts'),{RoomService}=require('../src/services/RoomService.ts'),{registerRoomSocket}=require('../src/socket/roomSocket.ts'),{registerGameSocket,abortRoomGame}=require('../src/socket/gameSocket.ts');
const {createServer}=require('node:http'),{Server}=require('socket.io'),{io:clientIO}=Module.createRequire(path.resolve(__dirname,'../../client/package.json'))('socket.io-client');
require('../src/games/registerGames.ts');
RoomService.joinRoom=async id=>{if(!room.players.some(p=>p.userId===id))throw new Error('not a member');return{...room,players:room.players.map(p=>({...p,username:p.user.username}))};};
const waitFor=(socket,event,predicate=()=>true)=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{socket.off(event,handler);reject(new Error(`Timed out: ${event}`));},4000);const handler=value=>{if(predicate(value)){clearTimeout(timeout);socket.off(event,handler);resolve(value);}};socket.on(event,handler);});

for(const slug of ['spyfall','wordhead'])for(const mode of ['TABLE','ONLINE'])test(`Socket.IO ${slug} ${mode}: mode rules, readable text, private reconnect`,async()=>{
 const n=3;sessions.length=0;room={id:`${slug}-${mode}`,roomCode:'MODE12',roomName:'Modes test',createdAt:new Date(),status:'WAITING',hostId:'p1',gameId:slug,settings:{playMode:mode},maxPlayers:n,game:{slug,name:slug,minPlayers:3,maxPlayers:8},players:Array.from({length:n},(_,i)=>({id:`rp${i+1}`,userId:`p${i+1}`,user:{username:`Player${i+1}`},joinedAt:new Date(),isReady:true,isHost:i===0}))};
 const http=createServer(),io=new Server(http),clients=[];io.on('connection',socket=>{socket.data.user={id:socket.handshake.auth.id,username:socket.handshake.auth.id};registerRoomSocket(io,socket);registerGameSocket(io,socket);});await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
 const ack=(i,event,data)=>clients[i].timeout(4000).emitWithAck(event,data),send=(id,type,payload={})=>ack(Number(id.slice(1))-1,'game:action',{roomId:room.id,actionType:`${slug}:${type}`,payload});
 try{
 for(let i=1;i<=n;i++){const c=clientIO(`http://127.0.0.1:${http.address().port}`,{transports:['websocket'],auth:{id:`p${i}`},forceNew:true});clients.push(c);await waitFor(c,'connect');assert.equal((await ack(i-1,'room:join',{roomCode:room.roomCode})).ok,true);}
 for(let i=0;i<n;i++)await ack(i,'room:ready',{roomId:room.id,isReady:true});
 const first=clients.map(c=>waitFor(c,'game:state'));assert.equal((await ack(0,'game:start',{roomId:room.id})).ok,true);const states=await Promise.all(first),g=GameManager.getGame(room.id);
 for(let i=0;i<n;i++)assert.deepEqual(states[i].private,g.getPrivateState(`p${i+1}`));
 if(slug==='spyfall'){
 const asker=g.getPublicState().askerUserId,next=g.getPlayers().find(p=>p.userId!==asker).userId;
 if(mode==='ONLINE')assert.equal((await send(asker,'question',{toUserId:next})).ok,false);
 const broadcasts=clients.map(c=>waitFor(c,'game:state',s=>s.public.log.some(e=>e.text==='คนเยอะไหม')));
 assert.equal((await send(asker,'question',{toUserId:next,text:'คนเยอะไหม'})).ok,true);for(const s of await Promise.all(broadcasts))assert.ok(s.public.log.some(e=>e.text==='คนเยอะไหม'));
 if(mode==='ONLINE')assert.equal((await send(next,'answer',{})).ok,false);
 assert.equal((await send(next,'answer',mode==='ONLINE'?{text:'ตอนเช้าคนเยอะ'}:{})).ok,true);assert.equal(g.getPublicState().askerUserId,next);
 }else{
 const up=g.getPublicState().currentTurnUserId,helper=g.getPlayers().find(p=>p.userId!==up).userId;
 if(mode==='ONLINE'){assert.equal((await send(helper,'hint',{})).ok,false);assert.equal((await send(up,'answer',{})).ok,false);}
 assert.equal((await send(helper,'hint',mode==='ONLINE'?{hintText:'สิ่งมีชีวิต'}:{})).ok,true);
 assert.equal((await send(up,mode==='ONLINE'?'guess':'answer',mode==='ONLINE'?{guessText:'แมว'}:{})).ok,true);
 assert.ok(g.getPublicState().pendingGuess);assert.equal(g.getPrivateState(up).currentWord,null);
 }
 // Reconnect someone without changing a pending question/guess's owner.
 const id=slug==='wordhead'?g.getPlayers().find(p=>p.userId!==g.getPublicState().currentTurnUserId).userId:'p2',i=Number(id.slice(1))-1;
 const before=g.getPrivateState(id);assert.equal((await ack(i,'room:pause',{roomId:room.id})).ok,true);const rejoin=await ack(i,'room:join',{roomCode:room.roomCode});assert.equal(rejoin.ok,true);assert.deepEqual(rejoin.gameState.private,before);
 }finally{abortRoomGame(room.id);clients.forEach(c=>c.disconnect());await new Promise(resolve=>io.close(resolve));}
});
