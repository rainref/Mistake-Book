const api=require('../../utils/api')
const ui=require('../../utils/ui')
Page({
 data:{id:'',item:null,fileID:'',sets:[],revealed:false,counts:[3,5],countIndex:0,difficulties:['基础','巩固','提高'],difficultyIndex:1,mode:'',loading:false,busy:false,error:''},
 onLoad(o){this.setData({id:o.id||'',mode:api.mode()})},
 onShow(){this.load()},
 async load(){this.setData({loading:true,error:''});try{const result=await api.call('mistake.get',{id:this.data.id});this.setData({item:ui.decorate(result.item),fileID:result.fileID,sets:result.sets.sort((a,b)=>b.createdAt-a.createdAt).map(s=>({...s,dateLabel:new Date(s.createdAt).toLocaleDateString()}))})}catch(e){ui.error(this,e)}finally{this.setData({loading:false})}},
 reveal(){this.setData({revealed:!this.data.revealed})},
 edit(){wx.navigateTo({url:'/pages/capture/capture?id='+encodeURIComponent(this.data.id)})},
 pick(e){this.pendingSetId=null;this.setData({[e.currentTarget.dataset.field]:Number(e.detail.value)})},
 async status(e){if(this.data.busy)return;this.setData({busy:true,error:''});try{const item=await api.call('mistake.status',{id:this.data.id,status:e.currentTarget.dataset.status});this.setData({item:ui.decorate(item)})}catch(error){ui.error(this,error)}finally{this.setData({busy:false})}},
 async generate(){if(this.data.busy)return;this.setData({busy:true,error:''});if(!this.pendingSetId)this.pendingSetId=api.uid();try{const set=await api.call('practice.generate',{mistakeId:this.data.id,setId:this.pendingSetId,count:this.data.counts[this.data.countIndex],difficulty:this.data.difficulties[this.data.difficultyIndex]});this.pendingSetId=null;wx.navigateTo({url:'/pages/practice/practice?id='+encodeURIComponent(set._id)})}catch(e){ui.error(this,e)}finally{this.setData({busy:false})}},
 practice(e){wx.navigateTo({url:'/pages/practice/practice?id='+encodeURIComponent(e.currentTarget.dataset.id)})},
 tag(e){ui.filter({subject:this.data.item.subject,chapter:this.data.item.chapter,knowledgePoint:e.currentTarget.dataset.name})},
 async preview(){try{const result=await wx.cloud.getTempFileURL({fileList:[this.data.fileID]});const url=result.fileList[0].tempFileURL;if(url)wx.previewImage({urls:[url]})}catch(e){ui.error(this,new Error('原图暂时无法打开，请重试'))}},
 async remove(){if(this.data.busy)return;if(!await ui.confirm('删除这道错题','错题将从学习库隐藏，关联练习也不再显示。此操作无法在小程序中撤销。'))return;try{await api.call('mistake.delete',{id:this.data.id});wx.navigateBack({fail(){wx.switchTab({url:'/pages/library/library'})}})}catch(e){ui.error(this,e)}}
})