const test=require('node:test')
const assert=require('node:assert/strict')
const path=require('node:path')
const app={globalData:{profile:null,libraryFilter:null}}
const store=new Map()
const navigation=[]
let cloudCalls=0
global.getApp=()=>app
global.wx={
 getStorageSync:k=>store.has(k)?structuredClone(store.get(k)):undefined,
 setStorageSync:(k,v)=>store.set(k,structuredClone(v)),
 removeStorageSync:k=>store.delete(k),
 cloud:{callFunction:async()=>{cloudCalls++;throw new Error('no cloud in demo')}},
 showToast(){},setNavigationBarTitle(){},stopPullDownRefresh(){},
 showModal:o=>o.success({confirm:true}),showActionSheet:o=>o.success({tapIndex:0}),
 navigateTo:o=>navigation.push(o.url),redirectTo:o=>navigation.push(o.url),switchTab:o=>navigation.push(o.url),reLaunch:o=>navigation.push(o.url),navigateBack:()=>navigation.push('back')
}
function page(name){
 let definition
 global.Page=value=>{definition=value}
 const file=path.resolve(__dirname,'../miniprogram/pages/'+name+'/'+name+'.js')
 delete require.cache[require.resolve(file)];require(file)
 const instance={...definition,data:structuredClone(definition.data),setData(patch){Object.assign(this.data,structuredClone(patch))}}
 return instance
}
async function until(check){for(let i=0;i<30;i++){if(check())return;await new Promise(r=>setImmediate(r))}throw new Error('Page did not settle')}
test('从示例录题、保存、筛选、生成练习到多轮作答的页面闭环',async()=>{
 store.clear();store.set('shicuo.mode','demo')
 const api=require('../miniprogram/utils/api')
 const index=page('index');await index.load();assert.equal(index.data.summary.total,3)
 const capture=page('capture');await capture.onLoad({});await capture.sample()
 capture.input({currentTarget:{dataset:{field:'wrongReason'}},detail:{value:'我漏乘了括号中的常数项'}})
 capture.input({currentTarget:{dataset:{field:'correction'}},detail:{value:'每一项都乘 3，移项后得到 x = 11。'}})
 await capture.save();assert.equal(capture.data.error,'')
 const itemId=capture.data.id
 const detail=page('detail');detail.onLoad({id:itemId});await detail.load()
 assert.equal(detail.data.item.wrongReason,'我漏乘了括号中的常数项')
 assert.equal(detail.data.revealed,false);detail.reveal();assert.equal(detail.data.revealed,true)
 detail.tag({currentTarget:{dataset:{name:'去括号'}}})
 const library=page('library');library.onShow();await until(()=>!library.data.loading)
 assert.equal(library.data.knowledgePoint,'去括号');assert.equal(library.data.items.length,2)
 await detail.generate();assert.equal(detail.data.error,'')
 const setId=decodeURIComponent(navigation.at(-1).split('id=')[1])
 const practice=page('practice');practice.onLoad({id:setId});await until(()=>!practice.data.loading)
 assert.equal(practice.data.set.questions.length,3)
 practice.input({detail:{value:'x=6'}});practice.reveal()
 await practice.record({currentTarget:{dataset:{correct:'yes'}}})
 await practice.record({currentTarget:{dataset:{correct:'yes'}}})
 assert.equal(practice.data.completed,1)
 await practice.move({currentTarget:{dataset:{delta:1}}})
 practice.input({detail:{value:'x=9'}});practice.onUnload()
 const resume=page('practice');resume.onLoad({id:setId});await until(()=>!resume.data.loading)
 assert.equal(resume.data.index,1);assert.equal(resume.data.answer,'x=9');assert.equal(resume.data.completed,1)
 resume.reveal();await resume.record({currentTarget:{dataset:{correct:'no'}}})
 await resume.move({currentTarget:{dataset:{delta:1}}});resume.reveal();await resume.record({currentTarget:{dataset:{correct:'yes'}}})
 assert.equal(resume.data.finished,true);assert.equal(resume.data.completed,3)
 await resume.restart();assert.equal(resume.data.completed,0);assert.equal(resume.data.revealed,false)
 resume.reveal();await resume.record({currentTarget:{dataset:{correct:'yes'}}})
 const summary=await api.call('summary');assert.equal(summary.practiceCount,4);assert.equal(summary.correctCount,3)
 const edit=page('capture');await edit.onLoad({id:itemId});await edit.sample();await edit.save();assert.equal(edit.data.error,'')
 const stats=page('stats');await stats.load();assert.equal(stats.data.rate,75)
 const review=page('review');await review.load();assert.ok(review.data.tags.length>0)
 assert.equal(cloudCalls,0)
})
test('手工录题不会获得伪造 AI 结果，云失败也不会偷偷进入演示',async()=>{
 const api=require('../miniprogram/utils/api');store.set('shicuo.mode','demo')
 await assert.rejects(api.call('analyze',{questionText:'任意题目'}),/演示模式不调用 AI/)
 const item=await api.call('mistake.save',{id:'manual_item_1234',mutationId:'mutation_manual_1234',item:{subject:'数学',questionText:'手动输入的新题目',chapter:'待归类',knowledgePoints:[],steps:[],pitfalls:[]}})
 await assert.rejects(api.call('practice.generate',{mistakeId:item._id,setId:'manual_set_12345',count:3}),/没有预置练习/)
 const config=require('../miniprogram/config');const before=config.cloudEnv;config.cloudEnv='test-env'
 store.delete('shicuo.mode')
 await assert.rejects(api.call('summary'),/云函数连接失败/)
 assert.equal(api.mode(),'cloud');config.cloudEnv=before
})
test('新题草稿在离开录入页后恢复，保存后清理',async()=>{
 store.set('shicuo.mode','demo')
 const capture=page('capture');await capture.onLoad({})
 capture.input({currentTarget:{dataset:{field:'questionText'}},detail:{value:'求 2 + 3 的值。'}});capture.onUnload()
 const restored=page('capture');await restored.onLoad({})
 assert.equal(restored.data.questionText,'求 2 + 3 的值。')
 await restored.save();assert.equal(restored.data.error,'');assert.equal(store.has(restored.draftKey),false)
})
test('AI 配置页跟随供应商切换请求格式，可覆盖并随保存上传',async()=>{
 const api=require('../miniprogram/utils/api')
 store.delete('shicuo.mode')
 assert.equal(api.mode(),'cloud')
 const {PROVIDERS}=require('../cloudfunctions/notebook/ai')
 const calls=[]
 const throwing=wx.cloud.callFunction
 wx.cloud.callFunction=async o=>{
  calls.push(o)
  if(o.data.action==='ai.config.get')return{result:{ok:true,data:{providers:PROVIDERS,config:{provider:'kimi',apiKey:'',baseUrl:'https://api.moonshot.cn/v1/chat/completions',textModel:'moonshot-v1-8k',visionModel:'',format:''},hasKey:false,saved:true,updatedAt:1}}}
  return{result:{ok:true,data:{saved:true,configured:true,hasKey:true}}}
 }
 try{
  const aiPage=page('ai-config');await aiPage.load()
  assert.equal(aiPage.data.error,'')
  assert.equal(aiPage.data.format,'openai')
  const index=aiPage.data.providers.findIndex(p=>p.id==='kimi-coding')
  assert.ok(index>=0)
  aiPage.pickProvider({detail:{value:String(index)}})
  assert.equal(aiPage.data.format,'anthropic')
  assert.equal(aiPage.data.baseUrl,'https://api.kimi.com/coding/v1/messages')
  aiPage.pickFormat({detail:{value:'0'}})
  assert.equal(aiPage.data.format,'openai')
  await aiPage.save()
  assert.equal(aiPage.data.saved,true)
  assert.equal(calls.at(-1).data.data.format,'openai')
  assert.equal(calls.at(-1).data.data.provider,'kimi-coding')
 }finally{wx.cloud.callFunction=throwing}
})
