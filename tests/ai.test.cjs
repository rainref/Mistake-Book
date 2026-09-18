const test=require('node:test')
const assert=require('node:assert/strict')
const {createAI,PROVIDERS}=require('../cloudfunctions/notebook/ai')
const v=require('../cloudfunctions/notebook/validation')
const {samples}=require('../miniprogram/utils/examples')
const PROVIDER_IDS=['deepseek','qwen','kimi','kimi-coding','glm','minimax']
test('解析合法 JSON 和带代码围栏 JSON，拒绝截断响应',()=>{
 assert.deepEqual(v.parseAI('{"a":1}'),{a:1})
 const fence=String.fromCharCode(96).repeat(3)
 assert.deepEqual(v.parseAI(fence+'json\n{"a":1}\n'+fence),{a:1})
 assert.throws(()=>v.parseAI('{"a":'),{code:'AI_FORMAT'})
})
test('内置供应商覆盖 deepseek / qwen / kimi / glm / minimax',()=>{
 const ids=PROVIDERS.map(p=>p.id)
 for(const id of PROVIDER_IDS){assert.ok(ids.includes(id),'缺少供应商 '+id);assert.equal(v.aiProvider(id),id)}
 for(const p of PROVIDERS.filter(x=>x.id!=='cloudbase')){
  assert.equal(p.needKey,true,p.id);assert.ok(p.baseUrl.startsWith('https://'),p.id)
  assert.ok(p.textModels.length,p.id);assert.ok(p.note,p.id)
 }
 assert.throws(()=>v.aiProvider('openai'),{message:'模型供应商无效'})
})
test('图片模型、文本模型来自用户配置，按用途分别选用',async()=>{
 const calls=[];const app={ai:()=>({createModel:provider=>({generateText:async input=>{calls.push({provider,input});return {text:JSON.stringify(samples[0])}}})})}
 const ai=createAI(app,{AI_PROVIDER:'text-provider'})
 const config={provider:'cloudbase',textModel:'text-test',visionModel:'vision-test'}
 await ai.analyze(config,{questionText:'解方程',grade:'七年级',subject:'数学'})
 await ai.analyze(config,{image:Buffer.from([0xff,0xd8,0,0]),questionText:'',grade:'七年级',subject:'数学'})
 assert.equal(calls[0].provider,'text-provider');assert.equal(calls[0].input.model,'text-test');assert.equal(calls[1].input.model,'vision-test');assert.ok(calls[1].input.messages[1].content[1].image_url.url.startsWith('data:image/jpeg;base64,'))
})
test('配置缺失时不伪造结果，模型异常不泄漏上游密钥',async()=>{
 const missing=createAI({},{})
 await assert.rejects(missing.analyze({},{questionText:'题目'}),{code:'AI_NOT_CONFIGURED'})
 await assert.rejects(missing.analyze({provider:'deepseek',apiKey:'sk-x',textModel:'deepseek-chat'},{image:Buffer.from([0xff,0xd8,0,0])}),{code:'AI_NOT_CONFIGURED'})
 const ai=createAI({ai:()=>({createModel:()=>({generateText:async()=>{throw new Error('Authorization: secret-123')}})})},{})
 await assert.rejects(ai.analyze({textModel:'model'},{questionText:'题目'}),e=>e.code==='AI_UNAVAILABLE'&&!e.message.includes('secret-123'))
})
test('Kimi Coding 供应商固定为 Anthropic 格式并区别于普通 Kimi',()=>{
 const coding=PROVIDERS.find(p=>p.id==='kimi-coding')
 assert.ok(coding,'缺少 kimi-coding 供应商')
 assert.equal(coding.format,'anthropic')
 assert.equal(coding.needKey,true)
 assert.equal(coding.baseUrl,'https://api.kimi.com/coding/v1/messages')
 assert.ok(coding.textModels.length);assert.ok(coding.visionModels.length);assert.ok(coding.note)
 assert.equal(v.aiProvider('kimi-coding'),'kimi-coding')
 const plain=PROVIDERS.find(p=>p.id==='kimi')
 assert.equal(plain.format||'openai','openai')
 assert.equal(plain.baseUrl,'https://api.moonshot.cn/v1/chat/completions')
})
function stubFetch(fn){const original=globalThis.fetch;globalThis.fetch=fn;return()=>{globalThis.fetch=original}}
const OK_TEXT=JSON.stringify({content:[{type:'text',text:'{"readable":true}'}]})
test('Anthropic 格式：system 提升为顶层参数，请求头与体符合规范',async()=>{
 const requests=[]
 const restore=stubFetch(async(url,options)=>{requests.push({url,options});return{status:200,ok:true,text:async()=>OK_TEXT}})
 try{
  const ai=createAI({},{})
  const config={provider:'kimi-coding',apiKey:'kk-123456',baseUrl:'https://api.kimi.com/coding/v1/messages',textModel:'kimi-k2-turbo-preview',format:'anthropic'}
  await ai.analyze(config,{questionText:'解方程',grade:'七年级',subject:'数学'})
  assert.equal(requests.length,1)
  assert.equal(requests[0].url,'https://api.kimi.com/coding/v1/messages')
  const headers=requests[0].options.headers
  assert.equal(headers['x-api-key'],'kk-123456')
  assert.equal(headers['authorization'],'Bearer kk-123456')
  assert.equal(headers['anthropic-version'],'2023-06-01')
  const body=JSON.parse(requests[0].options.body)
  assert.equal(body.model,'kimi-k2-turbo-preview')
  assert.equal(body.max_tokens,6000);assert.equal(body.temperature,0.3)
  assert.ok(body.system.includes('学科教师'))
  assert.equal(body.messages.length,1)
  assert.equal(body.messages[0].role,'user')
  assert.equal(typeof body.messages[0].content,'string')
 }finally{restore()}
})
test('Anthropic 格式：图片转 base64 source block，响应取 content 文本',async()=>{
 const requests=[]
 const restore=stubFetch(async(url,options)=>{requests.push({url,options});return{status:200,ok:true,text:async()=>OK_TEXT}})
 try{
  const ai=createAI({},{})
  const config={provider:'kimi-coding',apiKey:'kk',baseUrl:'https://api.kimi.com/coding/v1/messages',textModel:'kimi-k2-turbo-preview',visionModel:'kimi-k2-turbo-preview',format:'anthropic'}
  const result=await ai.analyze(config,{image:Buffer.from([0x89,0x50,0,0]),questionText:'',grade:'七年级',subject:'数学'})
  assert.deepEqual(result,{readable:true})
  const body=JSON.parse(requests[0].options.body)
  const content=body.messages[0].content
  assert.equal(content[0].type,'text')
  assert.equal(content[1].type,'image')
  assert.equal(content[1].source.type,'base64')
  assert.equal(content[1].source.media_type,'image/png')
  assert.equal(content[1].source.data,Buffer.from([0x89,0x50,0,0]).toString('base64'))
 }finally{restore()}
})
test('Anthropic 格式：未配置 format 时跟随供应商，显式 openai 覆盖生效，错误不泄漏 Key',async()=>{
 const requests=[]
 const restore=stubFetch(async(url,options)=>{requests.push({url,options});return{status:401,ok:false,text:async()=>JSON.stringify({error:{message:'invalid x-key'}})}})
 try{
  const ai=createAI({},{})
  // 不显式给 format：kimi-coding 默认走 Anthropic 请求头
  await assert.rejects(ai.test({provider:'kimi-coding',apiKey:'secret-key-abc',baseUrl:'https://api.kimi.com/coding/v1/messages',textModel:'kimi-k2-turbo-preview'}),e=>e.code==='AI_UNAVAILABLE'&&!e.message.includes('secret-key-abc'))
  assert.equal(requests[0].options.headers['x-api-key'],'secret-key-abc')
  // 显式 openai：回到 chat/completions 风格（system 作为消息，无顶层 system 参数）
  await assert.rejects(ai.test({provider:'kimi-coding',apiKey:'secret-key-abc',baseUrl:'https://x.example/v1/chat/completions',textModel:'kimi-k2-turbo-preview',format:'openai'}),{code:'AI_UNAVAILABLE'})
  const body=JSON.parse(requests[1].options.body)
  assert.ok(body.messages.some(m=>m.role==='system'))
  assert.ok(!('system' in body))
  assert.ok(!('x-api-key' in requests[1].options.headers))
 }finally{restore()}
})
test('连接测试失败给出分类提示，并回传打码后的上游错误原文',async()=>{
 const cases=[
  {status:401,body:JSON.stringify({error:{message:'invalid key sk-secret-abc'}}),hint:'拒绝访问',anthropic:false,masked:true},
  {status:404,body:JSON.stringify({error:{message:'model not found: k3'}}),hint:'接口地址与模型名称',anthropic:false,masked:false},
  {status:429,body:JSON.stringify({error:{message:'rate limit exceeded'}}),hint:'限流或额度不足',anthropic:false,masked:false},
  {status:500,body:'upstream crashed while checking sk-secret-abc',hint:'故障',anthropic:false,masked:true},
  {status:404,body:JSON.stringify({error:{message:'model not found: k3'}}),hint:'接口地址与模型名称',anthropic:true,masked:false},
 ]
 for(const item of cases){
  const restore=stubFetch(async()=>({status:item.status,ok:item.status>=200&&item.status<300,text:async()=>item.body}))
  try{
   const ai=createAI({},{})
   const config=item.anthropic
    ?{provider:'kimi-coding',apiKey:'sk-secret-abc',baseUrl:'https://api.kimi.com/coding/v1/messages',textModel:'kimi-k2-turbo-preview'}
    :{provider:'kimi',apiKey:'sk-secret-abc',baseUrl:'https://api.moonshot.cn/v1/chat/completions',textModel:'moonshot-v1-8k'}
   await assert.rejects(ai.test(config),e=>{
    assert.equal(e.code,'AI_UNAVAILABLE')
    assert.ok(e.message.includes(item.hint),'缺少分类提示：'+e.message)
    assert.ok(!e.message.includes('sk-secret-abc'),'泄漏了 API Key：'+e.message)
    assert.equal(e.message.includes('****'),item.masked,'打码与预期不符：'+e.message)
    return true
   })
  }finally{restore()}
 }
})
test('识题等日常路径仍不回传上游错误原文',async()=>{
 const restore=stubFetch(async()=>({status:404,ok:false,text:async()=>JSON.stringify({error:{message:'model not found: k3'}})}))
 try{
  const ai=createAI({},{})
  const config={provider:'kimi',apiKey:'sk-x',baseUrl:'https://api.moonshot.cn/v1/chat/completions',textModel:'moonshot-v1-8k'}
  await assert.rejects(ai.analyze(config,{questionText:'题目',grade:'七年级',subject:'数学'}),e=>e.code==='AI_UNAVAILABLE'&&!e.message.includes('model not found')&&!e.message.includes('k3'))
 }finally{restore()}
})
test('模型返回 200 但内容为空：区分截断/过滤/其他，细节只进服务端日志且脱敏',async()=>{ const logged=[]
 const original=console.error;console.error=(...args)=>logged.push(args)
 const config={provider:'kimi',apiKey:'sk-secret-abc',baseUrl:'https://api.moonshot.cn/v1/chat/completions',textModel:'moonshot-v1-8k'}
 const source={questionText:'解方程 3(x-2)=21',subject:'数学',chapter:'一元一次方程',grade:'七年级',approach:'去括号',wrongReason:'',knowledgePoints:['去括号']}
 try{
  const ai=createAI({},{})
  // 推理模型耗尽 token：finish_reason=length 且 content 为 null → 截断提示
  let restore=stubFetch(async()=>({status:200,ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'length',message:{content:null}}],usage:{completion_tokens:6000}})}))
  await assert.rejects(ai.practice(config,{source,count:3,difficulty:'巩固'}),e=>e.code==='AI_TRUNCATED'&&/截断/.test(e.message)&&/非推理/.test(e.message))
  restore()
  // 内容过滤：finish_reason=content_filter → 过滤提示
  restore=stubFetch(async()=>({status:200,ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'content_filter',message:{content:''}}]})}))
  await assert.rejects(ai.practice(config,{source,count:3,difficulty:'巩固'}),e=>e.code==='AI_UNAVAILABLE'&&/过滤/.test(e.message))
  restore()
  // 空 choices：无 finish_reason → 通用提示
  restore=stubFetch(async()=>({status:200,ok:true,text:async()=>JSON.stringify({choices:[]})}))
  await assert.rejects(ai.practice(config,{source,count:3,difficulty:'巩固'}),e=>e.code==='AI_UNAVAILABLE'&&/模型未返回内容/.test(e.message))
  restore()
  assert.ok(logged.length>=3,'空内容应写入服务端日志')
  assert.ok(!JSON.stringify(logged).includes('sk-secret-abc'),'日志不得泄漏 API Key')
 }finally{console.error=original}
})
test('Anthropic 格式：200 但无文本块时同样记录服务端日志并给出提示',async()=>{
 const logged=[]
 const original=console.error;console.error=(...args)=>logged.push(args)
 try{
  const ai=createAI({},{})
  const config={provider:'kimi-coding',apiKey:'kk-123456',baseUrl:'https://api.kimi.com/coding/v1/messages',textModel:'kimi-k2-turbo-preview'}
  const restore=stubFetch(async()=>({status:200,ok:true,text:async()=>JSON.stringify({content:[],stop_reason:'max_tokens'})}))
  try{
   await assert.rejects(ai.practice(config,{source:{questionText:'题',subject:'数学',chapter:'章',grade:'七年级',approach:'思路',wrongReason:'',knowledgePoints:['点']},count:3,difficulty:'巩固'}),e=>e.code==='AI_TRUNCATED'&&/截断/.test(e.message))
  }finally{restore()}
  assert.ok(logged.length>=1,'空内容应写入服务端日志')
  assert.ok(!JSON.stringify(logged).includes('kk-123456'),'日志不得泄漏 API Key')
 }finally{console.error=original}
})
test('DeepSeek 请求默认关闭思考模式，其他供应商不带该参数',async()=>{
 const requests=[]
 const restore=stubFetch(async(url,options)=>{requests.push({url,options});return{status:200,ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}]})}})
 try{
  const ai=createAI({},{})
  await ai.test({provider:'deepseek',apiKey:'sk-ds',baseUrl:'https://api.deepseek.com/chat/completions',textModel:'deepseek-v4-pro'})
  assert.deepEqual(JSON.parse(requests[0].options.body).thinking,{type:'disabled'})
  await ai.test({provider:'kimi',apiKey:'sk-km',baseUrl:'https://api.moonshot.cn/v1/chat/completions',textModel:'moonshot-v1-8k'})
  assert.ok(!('thinking' in JSON.parse(requests[1].options.body)),'非 DeepSeek 供应商不应带 thinking 参数')
 }finally{restore()}
})
test('截断防护：练习生成首次截断时自动压缩重试一次，连续截断才报错',async()=>{
 const okBody=JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({questions:[1,2,3].map(i=>({questionText:'练习'+i,answer:String(i),steps:['步骤'],hint:'',knowledgePoints:['知识点']}))})}}]})
 const cutBody=JSON.stringify({choices:[{finish_reason:'length',message:{content:'{"questions":[{"questionText":"半道题'}}]})
 // 首次截断 → 压缩重试成功；且重试提示词带压缩指令
 let calls=0;const bodies=[]
 const restore=stubFetch(async(url,options)=>{calls++;bodies.push(JSON.parse(options.body));return{status:200,ok:true,text:async()=>calls===1?cutBody:okBody}})
 try{
  const ai=createAI({},{})
  const config={provider:'deepseek',apiKey:'sk-x',baseUrl:'https://api.deepseek.com/chat/completions',textModel:'deepseek-chat'}
  const source={questionText:'解方程',subject:'数学',chapter:'一元一次方程',grade:'七年级',approach:'去括号',wrongReason:'',knowledgePoints:['去括号']}
  const result=await ai.practice(config,{source,count:3,difficulty:'巩固'})
  assert.equal(calls,2)
  assert.match(bodies[1].messages[1].content,/压缩|精简/)
  assert.equal(result.questions.length,3)
 }finally{restore()}
 // 连续两次截断 → 抛出截断错误
 let calls2=0
 const restore2=stubFetch(async()=>{calls2++;return{status:200,ok:true,text:async()=>cutBody}})
 try{
  const ai=createAI({},{})
  const config={provider:'deepseek',apiKey:'sk-x',baseUrl:'https://api.deepseek.com/chat/completions',textModel:'deepseek-chat'}
  const source={questionText:'解方程',subject:'数学',chapter:'一元一次方程',grade:'七年级',approach:'去括号',wrongReason:'',knowledgePoints:['去括号']}
  await assert.rejects(ai.practice(config,{source,count:3,difficulty:'巩固'}),e=>e.code==='AI_TRUNCATED'&&/截断/.test(e.message))
  assert.equal(calls2,2,'只应自动重试一次')
 }finally{restore2()}
})
test('截断防护：文本识题截断时重试；图片识题不自动重试（避免超出函数时长）',async()=>{
 const okAnalysis=JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({readable:true,questionText:'解方程 3(x-2)=21',subject:'数学',chapter:'一元一次方程',answer:'x=9',approach:'去括号再移项',steps:['去括号','移项求解'],knowledgePoints:['去括号']})}}]})
 const cutBody=JSON.stringify({choices:[{finish_reason:'length',message:{content:'{"readable":tr'}}]})
 const config={provider:'deepseek',apiKey:'sk-x',baseUrl:'https://api.deepseek.com/chat/completions',textModel:'deepseek-chat'}
 // 文本识题：截断 → 重试成功
 let calls=0
 const restore=stubFetch(async()=>{calls++;return{status:200,ok:true,text:async()=>calls===1?cutBody:okAnalysis}})
 try{
  const ai=createAI({},{})
  const result=await ai.analyze(config,{questionText:'解方程 3(x-2)=21',grade:'七年级',subject:'数学'})
  assert.equal(calls,2)
  assert.equal(result.subject,'数学')
 }finally{restore()}
 // 图片识题：截断 → 直接抛错不重试
 let calls2=0
 const restore2=stubFetch(async()=>{calls2++;return{status:200,ok:true,text:async()=>cutBody}})
 try{
  const ai=createAI({},{})
  await assert.rejects(ai.analyze({...config,visionModel:'vision-x'},{image:Buffer.from([0xff,0xd8,0,0]),questionText:'',grade:'七年级',subject:'数学'}),e=>e.code==='AI_TRUNCATED')
  assert.equal(calls2,1,'图片识题不应自动重试')
 }finally{restore2()}
})
test('内容非空但 finish_reason=length：截断的 JSON 按截断提示，不报格式错误',async()=>{ const logged=[]
 const original=console.error;console.error=(...args)=>logged.push(args)
 const config={provider:'kimi',apiKey:'sk-secret-abc',baseUrl:'https://api.moonshot.cn/v1/chat/completions',textModel:'moonshot-v1-8k'}
 const source={questionText:'解方程 3(x-2)=21',subject:'数学',chapter:'一元一次方程',grade:'七年级',approach:'去括号',wrongReason:'',knowledgePoints:['去括号']}
 try{
  const ai=createAI({},{})
  // JSON 写了一半被 max_tokens 掐断
  const half='{"questions":[{"questionText":"第一题","steps":["第一步'
  const truncated=JSON.stringify({choices:[{finish_reason:'length',message:{content:half}}],usage:{completion_tokens:6000}})
  const restore=stubFetch(async()=>({status:200,ok:true,text:async()=>truncated}))
  try{
   await assert.rejects(ai.practice(config,{source,count:3,difficulty:'巩固'}),e=>e.code==='AI_TRUNCATED'&&/截断/.test(e.message)&&/非推理/.test(e.message))
  }finally{restore()}
  // finish_reason=stop 的非法 JSON 仍走原「格式不完整」提示
  const bad=JSON.stringify({choices:[{finish_reason:'stop',message:{content:'不是 JSON'}}]})
  const restore2=stubFetch(async()=>({status:200,ok:true,text:async()=>bad}))
  try{
   await assert.rejects(ai.practice(config,{source,count:3,difficulty:'巩固'}),e=>e.code==='AI_FORMAT'&&/格式不完整/.test(e.message))
  }finally{restore2()}
  assert.ok(logged.length>=1,'截断应写入服务端日志')
  assert.ok(!JSON.stringify(logged).includes('sk-secret-abc'),'日志不得泄漏 API Key')
 }finally{console.error=original}
})
