const api=require('../../utils/api')
const ui=require('../../utils/ui')
Page({
 data:{items:[],subjects:['全部学科',...ui.SUBJECTS],subjectIndex:0,states:['全部状态','待订正','复习中','已掌握'],stateIndex:0,chapter:'',knowledgePoint:'',query:'',page:0,hasMore:false,loading:false,error:''},
 onShow(){const filter=getApp().globalData.libraryFilter;if(filter){this.setData({subjectIndex:Math.max(0,this.data.subjects.indexOf(filter.subject)),chapter:filter.chapter||'',knowledgePoint:filter.knowledgePoint||'',query:'',stateIndex:0});getApp().globalData.libraryFilter=null}this.load(true)},
 onPullDownRefresh(){this.load(true).finally(()=>wx.stopPullDownRefresh())},
 onReachBottom(){if(this.data.hasMore&&!this.data.loading)this.load(false)},
 input:ui.input,
 pick(e){this.setData({[e.currentTarget.dataset.field]:Number(e.detail.value)});this.load(true)},
 search(){this.load(true)},
 clear(){this.setData({subjectIndex:0,stateIndex:0,chapter:'',knowledgePoint:'',query:''});this.load(true)},
 async load(reset){
  if(!reset&&this.data.loading)return
  const version=this.version=(this.version||0)+1
  const page=reset?1:this.data.page+1
  this.setData({loading:true,error:''})
  try{const result=await api.call('mistake.list',{page,subject:this.data.subjectIndex?this.data.subjects[this.data.subjectIndex]:'',status:['','new','reviewing','mastered'][this.data.stateIndex],chapter:this.data.chapter.trim(),knowledgePoint:this.data.knowledgePoint.trim(),query:this.data.query.trim()});if(version===this.version)this.setData({items:(reset?[]:this.data.items).concat(result.items.map(ui.decorate)),page:result.page,hasMore:result.hasMore})}
  catch(e){if(version===this.version)ui.error(this,e)}finally{if(version===this.version)this.setData({loading:false})}
 },
 open(e){ui.open(e.detail.id)},
 capture(){wx.navigateTo({url:'/pages/capture/capture'})}
})