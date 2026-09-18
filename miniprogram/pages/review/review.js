const api=require('../../utils/api')
const ui=require('../../utils/ui')
Page({
 data:{summary:null,tags:[],subjects:['全部学科',...ui.SUBJECTS],subjectIndex:0,query:'',loading:false,error:''},
 onShow(){this.load()},onPullDownRefresh(){this.load().finally(()=>wx.stopPullDownRefresh())},
 async load(){this.setData({loading:true,error:''});try{const summary=await api.call('summary');this.setData({summary});this.filter()}catch(e){ui.error(this,e)}finally{this.setData({loading:false})}},
 input(e){this.setData({query:e.detail.value});this.filter()},
 pick(e){this.setData({subjectIndex:Number(e.detail.value)});this.filter()},
 filter(){const subject=this.data.subjectIndex?this.data.subjects[this.data.subjectIndex]:'';this.setData({tags:(this.data.summary?.tags||[]).filter(t=>(!subject||t.subject===subject)&&(!this.data.query||t.name.includes(this.data.query.trim())||t.chapter.includes(this.data.query.trim())))})},
 open(e){const tag=this.data.tags[e.currentTarget.dataset.index];ui.filter({subject:tag.subject,chapter:tag.chapter,knowledgePoint:tag.name})}
})