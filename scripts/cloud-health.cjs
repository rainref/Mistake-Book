const automator=require('miniprogram-automator')
const config=require('../miniprogram/config')
const fs=require('node:fs')
const path=require('node:path')
;(async()=>{
 const mini=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'})
 try {
  const result=await mini.evaluate(async(env)=>{
   try{
    const response=await wx.cloud.callFunction({name:'notebook',config:{env},data:{action:'bootstrap',data:{}}})
    const r=response.result
    return r&&r.ok?{ok:true,aiConfigured:r.data.aiConfigured,profileCreated:Boolean(r.data.profile)}:{ok:false,error:r&&r.error,resultType:typeof r}
   }catch(e){return {ok:false,errCode:e.errCode,errMsg:e.errMsg||e.message}}
  },config.cloudEnv)
  console.log(JSON.stringify(result,null,2))
  fs.mkdirSync(path.join(__dirname,'../.verification'),{recursive:true})
  fs.writeFileSync(path.join(__dirname,'../.verification/cloud-health.json'),JSON.stringify(result,null,2))
 }finally{mini.disconnect()}
})().catch(e=>{console.error(e.message);process.exitCode=1})
