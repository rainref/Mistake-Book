const api=require('../../utils/api')
const ui=require('../../utils/ui')
Page({
 data:{id:'',set:null,question:null,index:0,answer:'',revealed:false,showHint:false,records:[],currentRecords:[],attemptId:'',recorded:false,completed:0,correct:0,finished:false,loading:false,saving:false,error:''},
 onLoad(o){this.alive=true;this.setData({id:o.id||''});this.load()},
 onUnload(){this.alive=false;this.persist()},
 async load(){
  this.setData({loading:true,error:''})
  try{
   const boot=await api.bootstrap();this.key='shicuo.practice.'+api.mode()+'.'+boot.profile._id+'.'+this.data.id
   const result=await api.call('practice.get',{id:this.data.id})
   const draft=wx.getStorageSync(this.key)||{}
   const attemptId=draft.attemptId||api.uid()
   const index=Math.min(Math.max(0,draft.index||0),result.set.questions.length-1)
   this.setData({set:result.set,records:result.records,attemptId,index,answer:draft.answer||'',revealed:Boolean(draft.revealed),showHint:false})
   this.showQuestion(index,false)
  }catch(e){ui.error(this,e)}finally{this.setData({loading:false})}
 },
 persist(){if(this.key&&this.data.set)wx.setStorageSync(this.key,{attemptId:this.data.attemptId,index:this.data.index,answer:this.data.answer,revealed:this.data.revealed})},
 showQuestion(index,reset=true){
  const currentRecords=this.data.records.filter(r=>r.attemptId===this.data.attemptId)
  const question=this.data.set.questions[index]
  const record=currentRecords.find(r=>r.questionId===question.id)
  this.setData({index,question,currentRecords,recorded:Boolean(record),answer:record?record.answer:reset?'':this.data.answer,revealed:Boolean(record)||(!reset&&this.data.revealed),showHint:false,completed:currentRecords.length,correct:currentRecords.filter(r=>r.isCorrect).length,finished:currentRecords.length===this.data.set.questions.length})
  this.persist()
 },
 input(e){this.setData({answer:e.detail.value});this.persist()},
 hint(){this.setData({showHint:!this.data.showHint})},
 reveal(){this.setData({revealed:true});this.persist()},
 async record(e){
  if(this.data.saving||this.data.recorded||!this.data.revealed)return
  this.setData({saving:true,error:''})
  try{
   const record=await api.call('practice.record',{setId:this.data.id,questionId:this.data.question.id,attemptId:this.data.attemptId,answer:this.data.answer,isCorrect:e.currentTarget.dataset.correct==='yes'})
   this.setData({records:this.data.records.concat(record)});this.showQuestion(this.data.index,false)
  }catch(error){ui.error(this,error)}finally{this.setData({saving:false})}
 },
 async move(e){
  if(this.data.saving)return
  const next=this.data.index+Number(e.currentTarget.dataset.delta)
  if(next<0||next>=this.data.set.questions.length)return
  if(this.data.answer&&!this.data.recorded&&!await ui.confirm('切换题目','当前答案尚未记录结果，切换会清空这道题的未提交输入。'))return
  this.showQuestion(next)
 },
 async restart(){
  if(!await ui.confirm('再练一遍','开始新一轮作答，以前的练习记录会保留。'))return
  this.setData({attemptId:api.uid()});this.showQuestion(0)
 }
})
