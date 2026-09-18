const api=require('../../utils/api')
const ui=require('../../utils/ui')
Page({
  data:{mode:'',loading:false,error:'',name:'同学',summary:null,recent:[]},
  onShow(){this.setData({mode:api.mode()});if(api.mode()!=='setup')this.load()},
  onPullDownRefresh(){this.load().finally(()=>wx.stopPullDownRefresh())},
  async load(){if(api.mode()==='setup')return;this.setData({loading:true,error:''});try{const [boot,summary,list]=await Promise.all([api.bootstrap(),api.call('summary'),api.call('mistake.list',{page:1})]);this.setData({name:boot.profile.name,summary,recent:list.items.slice(0,3).map(ui.decorate)})}catch(e){ui.error(this,e)}finally{this.setData({loading:false})}},
  demo(){api.setMode('demo')},
  capture(){wx.navigateTo({url:'/pages/capture/capture'})},
  library(){wx.switchTab({url:'/pages/library/library'})},
  review(){wx.switchTab({url:'/pages/review/review'})},
  stats(){wx.navigateTo({url:'/pages/stats/stats'})},
  open(e){ui.open(e.detail.id)}
})