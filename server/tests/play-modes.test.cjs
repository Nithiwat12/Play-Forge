const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {test}=require('node:test'),a=require('node:assert/strict');
const {SpyfallGame}=require('../src/games/spyfall/SpyfallGame.ts'),{WordHeadGame}=require('../src/games/wordhead/WordHeadGame.ts');
function create(C,mode){const g=new C('r',{playMode:mode});for(let i=0;i<3;i++)g.addPlayer({userId:`p${i}`,username:`Player${i}`});g.start();return g;}
for(const mode of ['TABLE','ONLINE'])test(`Spyfall ${mode}: question/answer relay and mode bypass protection`,()=>{
 const g=create(SpyfallGame,mode);try{const first=g.getPublicState().askerUserId;const next=g.getPlayers().find(p=>p.userId!==first).userId;const third=g.getPlayers().find(p=>p.userId!==first&&p.userId!==next).userId;
 if(mode==='ONLINE')a.throws(()=>g.handleAction(first,'spyfall:question',{toUserId:next,text:' '}));
 g.handleAction(first,'spyfall:question',{toUserId:next,...(mode==='ONLINE'?{text:'ที่นี่เสียงดังไหม'}:{})});
 if(mode==='ONLINE'){a.throws(()=>g.handleAction(next,'spyfall:question',{toUserId:third,text:'ไปยังไง'}));a.throws(()=>g.handleAction(next,'spyfall:answer',{}));g.handleAction(next,'spyfall:answer',{text:'เสียงดังช่วงเย็น'});a.equal(g.getPublicState().log.at(-1).text,'เสียงดังช่วงเย็น');}
 g.handleAction(next,'spyfall:question',{toUserId:third,...(mode==='ONLINE'?{text:'คนเยอะไหม'}:{})});a.equal(g.getPublicState().pendingQuestion.toUserId,third);
 }finally{g.end();}
});
for(const mode of ['TABLE','ONLINE'])test(`WordHead ${mode}: clues, spoken/typed guesses and voting`,()=>{
 const g=create(WordHeadGame,mode);try{const up=g.getPublicState().currentTurnUserId;const helpers=g.getPlayers().filter(p=>p.userId!==up);a.equal(g.getPrivateState(up).currentWord,null);
 if(mode==='ONLINE'){a.throws(()=>g.handleAction(helpers[0].userId,'wordhead:hint',{}));a.throws(()=>g.handleAction(up,'wordhead:answer',{}));}
 g.handleAction(helpers[0].userId,'wordhead:hint',mode==='ONLINE'?{hintText:'เป็นสิ่งมีชีวิต'}:{});
 g.handleAction(up,mode==='ONLINE'?'wordhead:guess':'wordhead:answer',mode==='ONLINE'?{guessText:'แมว'}:{});
 const guess=g.getPublicState().pendingGuess;a.ok(guess);if(mode==='ONLINE')a.equal(guess.text,'แมว');
 for(const h of helpers)g.handleAction(h.userId,'wordhead:markCorrect',{guessId:guess.id});a.notEqual(g.getPublicState().currentTurnUserId,up);
 }finally{g.end();}
});
test('removed game is absent from registry; invalid mode rejected',()=>{require('../src/games/registerGames.ts');const {GameRegistry}=require('../src/games/core/GameRegistry.ts');a.deepEqual(GameRegistry.listRegisteredSlugs().sort(),['ito','spyfall','wordhead']);const {roomSettingsSchema}=require('../src/utils/validators.ts');a.throws(()=>roomSettingsSchema.parse({playMode:'invalid'}));for(const mode of ['ONLINE','TABLE'])a.equal(roomSettingsSchema.parse({playMode:mode}).playMode,mode);});

test('player-authored words: private setup, complete derangement for 3–8 players, no future answers leaked',()=>{
 for(let n=3;n<=8;n++)for(let trial=0;trial<10;trial++){
 const g=new WordHeadGame('custom',{wordSource:'PLAYERS'});for(let i=0;i<n;i++)g.addPlayer({userId:`p${i}`,username:`P${i}`});g.start();
 try{a.equal(g.getPublicState().phase,'SUBMIT_WORDS');a.equal(g.getPublicState().turnStartedAt,null);
 for(let i=0;i<n;i++){
  const word=`โจทย์ลับเฉพาะคน${i}`;g.handleAction(`p${i}`,'wordhead:submitWord',{word});
  if(i<n-1){const state=g.getPublicState();a.equal(state.phase,'SUBMIT_WORDS');a.equal(JSON.stringify(state).includes(word),false);for(let j=0;j<n;j++){const priv=g.getPrivateState(`p${j}`);a.equal(priv.currentWord,null);if(j!==i)a.equal(JSON.stringify(priv).includes(word),false);}}
 }
 a.equal(g.getPublicState().phase,'TURN');a.equal(g.assignedWords.size,n);a.equal(new Set(g.assignedWords.values()).size,n);
 for(let i=0;i<n;i++)a.notEqual(g.assignedWords.get(`p${i}`),`โจทย์ลับเฉพาะคน${i}`);
 const up=g.getPublicState().currentTurnUserId;a.equal(g.getPrivateState(up).currentWord,null);a.equal(g.getPrivateState(up).submittedWord,null);a.equal(g.submissionTimer,null);
 }finally{g.end();}
 }
});
test('authored setup validates inputs, forbids duplicate submission and preserves reconnect',()=>{
 const g=new WordHeadGame('custom',{wordSource:'PLAYERS'});for(let i=0;i<3;i++)g.addPlayer({userId:`p${i}`,username:`P${i}`});g.start();
 try{for(const word of ['', ' ', 12, 'x'.repeat(61),'a\nb'])a.throws(()=>g.handleAction('p0','wordhead:submitWord',{word}));a.throws(()=>g.handleAction('outsider','wordhead:submitWord',{word:'ขโมย'}));a.throws(()=>g.handleAction('p0','wordhead:guess',{guessText:'ก่อนเริ่ม'}));
 g.handleAction('p0','wordhead:submitWord',{word:'คำทดสอบ'});a.throws(()=>g.handleAction('p0','wordhead:submitWord',{word:'แก้'}));a.throws(()=>g.handleAction('p1','wordhead:submitWord',{word:' คำทดสอบ '}));
 const before=g.getPrivateState('p0');g.removePlayer('p0');g.reconnectPlayer('p0');a.deepEqual(g.getPrivateState('p0'),before);a.equal(g.getPublicState().phase,'SUBMIT_WORDS');
 }finally{g.end();}a.equal(g.submissionTimer,null);
});
test('unfinished custom setup expires without winners or scores',t=>{
 t.mock.timers.enable({apis:['Date','setTimeout']});const g=new WordHeadGame('custom',{wordSource:'PLAYERS'});for(let i=0;i<3;i++)g.addPlayer({userId:`p${i}`,username:`P${i}`});g.start();g.handleAction('p0','wordhead:submitWord',{word:'ยังรอ'});t.mock.timers.tick(180001);a.equal(g.getPublicState().phase,'FINISHED');a.deepEqual(g.end().winnerUserIds,[]);a.deepEqual(g.end().details.scores,{});a.equal(g.submissionTimer,null);t.mock.timers.reset();
});
test('expanded system bank has 180 unique words and allocates all hands before turns',()=>{const {WORDHEAD_WORDS}=require('../src/games/wordhead/words.ts');a.equal(WORDHEAD_WORDS.length,180);a.equal(new Set(WORDHEAD_WORDS.map(w=>w.text)).size,180);const g=create(WordHeadGame,'ONLINE');try{a.equal(g.getPublicState().wordSource,'SYSTEM');a.equal(g.assignedWords.size,3);a.equal(new Set(g.assignedWords.values()).size,3);}finally{g.end();}});
