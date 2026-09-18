const api=require('../../utils/api')
const ui=require('../../utils/ui')
Page({
 data:{summary:null,rate:0,masteryRate:0,activity:[],subjects:[],loading:false,error:''},
 onShow(){this.load()},
 async load(){this.setData({loading:true,error:''});try{const s=await api.call('summary');const max=Math.max(1,...s.activity.map(i=>i.count));this.setData({summary:s,rate:s.practiceCount?Math.round(s.correctCount/s.practiceCount*100):0,masteryRate:s.total?Math.round(s.mastered/s.total*100):0,subjects:s.subjects.map(i=>({...i,width:s.total?Math.round(i.total/s.total*100):0})),activity:s.activity.map(i=>({...i,height:Math.round(i.count/max*150)}))})}catch(e){ui.error(this,e)}finally{this.setData({loading:false})}}
})