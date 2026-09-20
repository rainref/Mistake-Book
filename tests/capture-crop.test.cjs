const test=require('node:test')
const assert=require('node:assert/strict')
const path=require('path')
// 模拟云开发模式下的 capture 页面：选图后调起微信原生裁剪，完成后压缩上传
function boot(){
 const store=new Map([['shicuo.mode','cloud']])
 const calls={chooseMedia:0,editSrc:[],editAvailable:true}
 global.getApp=()=>({globalData:{profile:null,libraryFilter:null}})
 global.wx={
  getStorageSync:k=>store.has(k)?structuredClone(store.get(k)):undefined,
  setStorageSync:(k,v)=>store.set(k,structuredClone(v)),
  removeStorageSync:k=>store.delete(k),
  chooseMedia:o=>{calls.chooseMedia++;o.success({tempFiles:[{tempFilePath:'tmp://picked.jpg'}]})},
  editImage:o=>{calls.editSrc.push(o.src);o.success({tempFilePath:'tmp://edited.jpg'})},
  compressImage:o=>o.success({tempFilePath:'tmp://compressed.jpg'}),
  getFileSystemManager:()=>({readFile:o=>o.success({data:Buffer.from([0xff,0xd8,1,2,3])})}),
  cloud:{
   callFunction:async({data})=>{
    if(data.action==='bootstrap')return {result:{ok:true,data:{profile:{_id:'alice',grade:'七年级'}}}}
    if(data.action==='media.prepare')return {result:{ok:true,data:{mediaId:'media_1',cloudPath:'media/1.jpg'}}}
    if(data.action==='media.commit')return {result:{ok:true,data:{ok:true}}}
    throw new Error('unexpected action '+data.action)
   },
   uploadFile:async()=>({fileID:'cloud://file.jpg'})
  },
  showToast(){},setNavigationBarTitle(){},stopPullDownRefresh(){},
  showModal:o=>o.success({confirm:true}),showActionSheet:o=>o.success({tapIndex:0}),
  navigateTo(){},redirectTo(){},switchTab(){},reLaunch(){},navigateBack(){}
 }
 function page(name){
  let definition
  global.Page=value=>{definition=value}
  const file=path.resolve(__dirname,'../miniprogram/pages/'+name+'/'+name+'.js')
  delete require.cache[require.resolve(file)];require(file)
  return {...definition,data:structuredClone(definition.data),setData(patch){Object.assign(this.data,structuredClone(patch))}}
 }
 return {page,calls}
}
async function ready(capture){await capture.onLoad({});assert.equal(capture.data.ready,true)}

test('选图后调起原生裁剪，上传的是裁剪结果',async()=>{
 const {page,calls}=boot()
 const capture=page('capture');await ready(capture)
 await capture.choose()
 assert.deepEqual(calls.editSrc,['tmp://picked.jpg'],'原生裁剪应收到选中的原图')
 assert.equal(capture.data.mediaId,'media_1')
 assert.equal(capture.data.photo,'cloud://file.jpg')
})

test('用户取消原生裁剪时保留原图继续上传，不报错',async()=>{
 const {page}=boot()
 global.wx.editImage=o=>o.fail({errMsg:'editImage:fail cancel'})
 const capture=page('capture');await ready(capture)
 await capture.choose()
 assert.equal(capture.data.mediaId,'media_1','取消裁剪后仍应上传原始选中图')
 assert.equal(capture.data.error,'')
})

test('旧版微信没有 editImage 时跳过裁剪直接上传原图',async()=>{
 const {page}=boot()
 delete global.wx.editImage
 const capture=page('capture');await ready(capture)
 await capture.choose()
 assert.equal(capture.data.mediaId,'media_1')
 assert.equal(capture.data.error,'')
})

test('选图被用户取消时不调裁剪也不上传、不报错',async()=>{
 const {page,calls}=boot()
 global.wx.chooseMedia=o=>o.fail({errMsg:'chooseMedia:fail cancel'})
 const capture=page('capture');await ready(capture)
 await capture.choose()
 assert.equal(calls.editSrc.length,0)
 assert.equal(capture.data.mediaId,'')
 assert.equal(capture.data.error,'')
})

test('上传失败时错误展示在页面上',async()=>{
 const {page}=boot()
 global.wx.cloud.uploadFile=async()=>{throw new Error('network down')}
 const capture=page('capture');await ready(capture)
 await capture.choose()
 assert.match(capture.data.error,/network down/)
 assert.equal(capture.data.mediaId,'')
})
