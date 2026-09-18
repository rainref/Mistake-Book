const api=require('../../utils/api')
const ui=require('../../utils/ui')
const images=require('../../utils/image')
Page({
 data:{mode:'',id:'',editing:false,revision:0,subjects:ui.SUBJECTS,subjectIndex:0,questionText:'',chapter:'',answer:'',approach:'',stepsText:'',pointsText:'',pitfallsText:'',wrongReason:'',correction:'',grade:'七年级',status:'new',mediaId:'',photo:'',busy:false,loading:true,ready:false,error:'',progress:''},
 async onLoad(options){
  this.alive=true
  this.ready=false
  this.setData({loading:true,ready:false,error:''})
  this.setData({mode:api.mode(),id:options.id||api.uid(),editing:Boolean(options.id)})
  wx.setNavigationBarTitle({title:options.id?'编辑与订正':'整理新错题'})
  try{
   const boot=await api.bootstrap()
   this.draftKey='shicuo.draft.'+api.mode()+'.'+boot.profile._id+'.'+(options.id||'new')
   this.setData({grade:boot.profile.grade})
   if(options.id){const result=await api.call('mistake.get',{id:options.id});this.fill(result.item);this.setData({photo:result.fileID||''})}
   else{const draft=wx.getStorageSync(this.draftKey);if(draft){this.fill(draft.item);this.setData({id:draft.id,photo:draft.photo||''});wx.showToast({title:'已恢复未保存草稿',icon:'none'})}}
   this.ready=true
   this.setData({ready:true})
  }catch(e){ui.error(this,e)}finally{this.setData({loading:false})}
 },
 retry(){return this.onLoad(this.data.editing?{id:this.data.id}:{})},
 onUnload(){this.alive=false;if(!this.saved&&this.ready)this.draft()},
 fill(item){this.setData({subjectIndex:Math.max(0,ui.SUBJECTS.indexOf(item.subject)),questionText:item.questionText||'',chapter:item.chapter||'',answer:item.answer||'',approach:item.approach||'',stepsText:(item.steps||[]).join('\n'),pointsText:(item.knowledgePoints||[]).join('，'),pitfallsText:(item.pitfalls||[]).join('\n'),wrongReason:item.wrongReason||'',correction:item.correction||'',grade:item.grade||this.data.grade,status:item.status||'new',mediaId:item.mediaId||'',revision:item.revision||0})},
 item(){const d=this.data;return {questionText:d.questionText,subject:ui.SUBJECTS[d.subjectIndex],chapter:d.chapter,answer:d.answer,approach:d.approach,steps:d.stepsText.split('\n').map(s=>s.trim()).filter(Boolean),knowledgePoints:[...new Set(d.pointsText.split(/[，,、\n]/).map(s=>s.trim()).filter(Boolean))],pitfalls:d.pitfallsText.split('\n').map(s=>s.trim()).filter(Boolean),wrongReason:d.wrongReason,correction:d.correction,grade:d.grade,status:d.status,mediaId:d.mediaId}},
 draft(){if(this.draftKey)wx.setStorageSync(this.draftKey,{id:this.data.id,item:{...this.item(),revision:this.data.revision},photo:this.data.photo})},
 input(e){this.setData({[e.currentTarget.dataset.field]:e.detail.value});this.draft()},
 subject(e){this.setData({subjectIndex:Number(e.detail.value)});this.draft()},
 async choose(){
  if(this.data.busy||!this.ready)return
  this.setData({busy:true,error:'',progress:'选择并压缩图片…'})
  try{const image=await images.choose();this.setData({progress:'正在上传题目图片…'});const uploaded=await api.upload(image.filePath,image.extension);this.setData({mediaId:uploaded.mediaId,photo:uploaded.fileID});this.draft()}
  catch(e){if(!/cancel/i.test(e.errMsg||''))ui.error(this,e)}finally{this.setData({busy:false,progress:''})}
 },
 removePhoto(){this.setData({mediaId:'',photo:''});this.draft()},
 async sample(){
  const examples=require('../../utils/examples').samples
  const selection=await new Promise(resolve=>wx.showActionSheet({itemList:examples.map(s=>s.subject+' · '+s.chapter),success:r=>resolve(r.tapIndex),fail:()=>resolve(-1)}))
  if(selection<0)return
  this.fill({...examples[selection],revision:this.data.revision});this.setData({mediaId:'',photo:''});this.draft()
 },
 async analyze(){
  if(this.data.busy||!this.ready)return
  if((this.data.answer||this.data.stepsText)&&!await ui.confirm('重新分析题目','AI 会更新题干、分类和参考解析，你填写的实际错因与订正结果会保留。'))return
  this.setData({busy:true,error:'',progress:'正在识别题目、推导步骤与归纳知识点…'})
  try{
   const result=await api.call('analyze',{mediaId:this.data.mediaId,questionText:this.data.questionText,grade:this.data.grade,subject:ui.SUBJECTS[this.data.subjectIndex]})
   const personal={wrongReason:this.data.wrongReason,correction:this.data.correction,mediaId:this.data.mediaId,status:this.data.status,revision:this.data.revision}
   this.fill({...result,...personal,grade:this.data.grade});this.draft()
  }catch(e){ui.error(this,e)}finally{this.setData({busy:false,progress:''})}
 },
 async save(){
  if(this.data.busy||!this.ready)return
  this.setData({busy:true,error:'',progress:'正在保存错题…'})
  try{
   const item=require('../../utils/validation').mistake(this.item())
   const snapshot=JSON.stringify(item)
   if(this.saveSnapshot!==snapshot){this.saveSnapshot=snapshot;this.mutationId=api.uid()}
   let result
   try{
    result=await api.call('mistake.save',{id:this.data.id,item,revision:this.data.revision,mutationId:this.mutationId})
   }catch(e){
    // 该编号的记录已被删除（例如删除演示后，草稿仍指向旧编号）：换新编号按新题收录。
    if(e.code!=='NOT_FOUND')throw e
    this.setData({id:api.uid(),revision:0,editing:false})
    this.draft()
    result=await api.call('mistake.save',{id:this.data.id,item,revision:0,mutationId:this.mutationId})
   }
   this.saved=true;wx.removeStorageSync(this.draftKey)
   if(!this.alive)return
   wx.showToast({title:'已收录到错题库'})
   if(this.data.editing)wx.navigateBack()
   else wx.redirectTo({url:'/pages/detail/detail?id='+encodeURIComponent(result._id)})
  }catch(e){ui.error(this,e)}finally{if(this.alive)this.setData({busy:false,progress:''})}
 }
})
