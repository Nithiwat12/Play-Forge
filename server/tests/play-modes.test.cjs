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
