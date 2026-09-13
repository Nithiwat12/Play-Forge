const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {test}=require('node:test'),assert=require('node:assert/strict');

let room;const sessions=[];
const prisma={room:{findUnique:async()=>room,update:async({data})=>Object.assign(room,data),updateMany:async({data})=>Object.assign(room,data)},roomPlayer:{update:async({where,data})=>Object.assign(room.players.find(p=>p.id===where.id),data),findMany:async()=>room.players,updateMany:async({data})=>{room.players.forEach(p=>Object.assign(p,data));return{count:room.players.length};}},gameSession:{create:async({data})=>{const s={...data,id:`s${sessions.length}`,history:[],startedAt:new Date()};sessions.push(s);return s;},update:async({where,data})=>Object.assign(sessions.find(s=>s.id===where.id),data),count:async()=>sessions.filter(s=>s.status==='COMPLETED').length,findMany:async()=>sessions.filter(s=>s.status==='COMPLETED')},gameHistory:{create:async({data})=>{sessions.find(s=>s.id===data.gameSessionId).history.push(data);return data;}},$transaction:async ops=>Promise.all(ops)};
const originalLoad=Module._load;Module._load=function(id,parent,main){if(id.endsWith('/config/prisma'))return{prisma};if(id==='bcryptjs')return{};return originalLoad.call(this,id,parent,main);};
const {GameRegistry}=require('../src/games/core/GameRegistry.ts'),{GameManager}=require('../src/games/core/GameManager.ts'),{RoomService}=require('../src/services/RoomService.ts'),{registerRoomSocket}=require('../src/socket/roomSocket.ts'),{registerGameSocket,abortRoomGame}=require('../src/socket/gameSocket.ts');
const {createServer}=require('node:http'),{Server}=require('socket.io'),{io:clientIO}=Module.createRequire(path.resolve(__dirname,'../../client/package.json'))('socket.io-client');
require('../src/games/ito/index.ts');
RoomService.joinRoom=async id=>{if(!room.players.some(p=>p.userId===id))throw new Error('not a member');return{...room,players:room.players.map(p=>({...p,username:p.user.username}))};};
const waitFor=(socket,event,predicate=()=>true)=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{socket.off(event,handler);reject(new Error(`Timed out: ${event}`));},4000);const handler=value=>{if(predicate(value)){clearTimeout(timeout);socket.off(event,handler);resolve(value);}};socket.on(event,handler);});
for(const mode of ['TABLE','ONLINE'])test(`Socket.IO ito ${mode}: private hands, consensus, reconnect, persisted result`,async()=>{
 const n=3;sessions.length=0;room={id:`ito-${mode}`,roomCode:'ITO123',roomName:'Ito test',createdAt:new Date(),status:'WAITING',hostId:'p1',gameId:'ito',settings:{ito:{mode,stages:1}},maxPlayers:n,game:{slug:'ito',name:'ito',minPlayers:2,maxPlayers:8},players:Array.from({length:n},(_,i)=>({id:`rp${i+1}`,userId:`p${i+1}`,user:{username:`Player${i+1}`},joinedAt:new Date(),isReady:true,isHost:i===0}))};
 const http=createServer(),io=new Server(http),clients=[];io.on('connection',socket=>{socket.data.user={id:socket.handshake.auth.id,username:socket.handshake.auth.id};registerRoomSocket(io,socket);registerGameSocket(io,socket);});await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
 const ack=(i,event,data)=>clients[i].timeout(4000).emitWithAck(event,data),send=(i,type,payload={})=>ack(i,'game:action',{roomId:room.id,actionType:`ito:${type}`,payload});
 try{
 for(let i=1;i<=n;i++){const c=clientIO(`http://127.0.0.1:${http.address().port}`,{transports:['websocket'],auth:{id:`p${i}`},forceNew:true});clients.push(c);await waitFor(c,'connect');assert.equal((await ack(i-1,'room:join',{roomCode:room.roomCode})).ok,true);}
 for(let i=0;i<n;i++)await ack(i,'room:ready',{roomId:room.id,isReady:true});
 assert.equal((await ack(1,'game:start',{roomId:room.id})).ok,false);
 const first=clients.map(c=>waitFor(c,'game:state'));assert.equal((await ack(0,'game:start',{roomId:room.id})).ok,true);
 const snapshots=await Promise.all(first),g=GameManager.getGame(room.id);
 for(let i=0;i<n;i++){assert.deepEqual(snapshots[i].private,g.getPrivateState(`p${i+1}`));for(const p of snapshots[i].public.players)for(const c of p.cards)assert.equal('value' in c,false);}
 const before=g.getPrivateState('p2');assert.equal((await ack(1,'room:pause',{roomId:room.id})).ok,true);assert.equal((await send(1,'clue',{cardId:before.cards[0].id,text:'blocked'})).ok,false);const rejoin=await ack(1,'room:join',{roomCode:room.roomCode});assert.equal(rejoin.ok,true);assert.deepEqual(rejoin.gameState.private,before);
 const cards=g.getPlayers().flatMap(p=>g.getPrivateState(p.userId).cards.map(c=>({...c,userId:p.userId}))).sort((a,b)=>a.value-b.value);
 if(mode==='ONLINE')for(const c of cards)assert.equal((await send(Number(c.userId.slice(1))-1,'clue',{cardId:c.id,text:'กาแฟอุ่น'})).ok,true);
 const ended=waitFor(clients[0],'game:end');
 for(const c of cards){const owner=Number(c.userId.slice(1))-1;assert.equal((await send(owner,'propose',{cardId:c.id})).ok,true);const p=g.getPublicState().proposal;for(let i=0;i<n;i++)if(i!==owner)assert.equal((await send(i,'vote',{proposalId:p.id,accept:true})).ok,true);}
 const result=await ended;assert.equal(result.result.winnerUserIds.length,n);assert.equal(sessions.length,1);assert.equal(sessions[0].history.length,1);assert.equal(sessions[0].history[0].resultData.details.mode,mode);assert.equal(room.status,'WAITING');assert.equal(GameManager.getGame(room.id),undefined);
 }finally{abortRoomGame(room.id);clients.forEach(c=>c.disconnect());await new Promise(resolve=>io.close(resolve));}
});
