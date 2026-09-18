const test=require('node:test')
const assert=require('node:assert/strict')
const path=require('node:path')
const {fixture}=require('./helpers.cjs')
const {AppError}=require('../cloudfunctions/notebook/validation')
// 模拟微信运行时：wx.cloud.callFunction 直接路由到真实 service 逻辑，复刻 index.js 的错误封装
function boot(){
 const store=new Map()
 const navigation=[]
 const f=fixture()
 global.getApp=()=>({globalData:{profile:null,libraryFilter:null}})
 global.wx={
  getStorageSync:k=>store.has(k)?structuredClone(store.get(k)):undefined,
  setStorageSync:(k,v)=>store.set(k,structuredClone(v)),
  removeStorageSync:k=>store.delete(k),
  cloud:{callFunction:async({data})=>{
   try{return {result:{ok:true,data:await f.service('alice',data.action,data.data||{})}}}
   catch(e){if(e instanceof AppError)return {result:{ok:false,error:{code:e.code,message:e.message}}};throw e}
  }},
  showToast(){},setNavigationBarTitle(){},stopPullDownRefresh(){},
  showModal:o=>o.success({confirm:true}),showActionSheet:o=>o.success({tapIndex:0}),
  navigateTo:o=>navigation.push(o.url),redirectTo:o=>navigation.push(o.url),switchTab:o=>navigation.push(o.url),reLaunch:o=>navigation.push(o.url),navigateBack:()=>navigation.push('back')
 }
 function page(name){
  let definition
  global.Page=value=>{definition=value}
  const file=path.resolve(__dirname,'../miniprogram/pages/'+name+'/'+name+'.js')
  delete require.cache[require.resolve(file)];require(file)
  return {...definition,data:structuredClone(definition.data),setData(patch){Object.assign(this.data,structuredClone(patch))}}
 }
 return {store,navigation,f,page}
}
test('保存成功→演示删除→旧编号再次保存：换新编号作为新题收录，不卡死',async()=>{
 const {store,navigation,f,page}=boot()
 store.set('shicuo.mode','cloud')
 const capture=page('capture')
 await capture.onLoad({})
 await capture.sample()
 await capture.save()
 assert.equal(capture.data.error,'')
 const firstId=capture.data.id
 assert.ok(f.tables.mistakes[firstId],'第一道错题应已入库')
 await f.service('alice','mistake.delete',{id:firstId})
 // 录题页仍持有已删除记录的编号（草稿恢复或重复编辑），再次保存
 const again=page('capture')
 await again.onLoad({})
 await again.sample()
 again.setData({id:firstId})
 await again.save()
 assert.equal(again.data.error,'')
 const secondId=again.data.id
 assert.notEqual(secondId,firstId)
 assert.ok(f.tables.mistakes[secondId]&&!f.tables.mistakes[secondId].deletedAt,'应以新编号重新入库')
 assert.match(navigation.at(-1),/pages\/detail\/detail\?id=/)
})
test('保存遇到其他错误（如冲突）时不吞错、不换编号',async()=>{
 const {store,f,page}=boot()
 store.set('shicuo.mode','cloud')
 const capture=page('capture')
 await capture.onLoad({})
 await capture.sample()
 await capture.save()
 assert.equal(capture.data.error,'')
 const firstId=capture.data.id
 // 模拟并发修改：内容变化产生新 mutationId，页面拿着旧 revision → 冲突不应被吞掉
 capture.input({currentTarget:{dataset:{field:'wrongReason'}},detail:{value:'移项时漏变号'}})
 await capture.save()
 assert.match(capture.data.error,/其他页面更新/)
 assert.equal(capture.data.id,firstId)
})
