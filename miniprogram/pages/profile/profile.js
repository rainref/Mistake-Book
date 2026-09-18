const api=require('../../utils/api')
const ui=require('../../utils/ui')
Page({
 data:{mode:'',name:'',grades:['七年级','八年级','九年级','高一','高二','高三'],gradeIndex:0,aiConfigured:false,loading:false,saving:false,error:''},
 onShow(){this.setData({mode:api.mode()});if(api.mode()!=='setup')this.load()},
 async load(){this.setData({loading:true,error:''});try{const result=await api.bootstrap();this.setData({name:result.profile.name,gradeIndex:Math.max(0,this.data.grades.indexOf(result.profile.grade)),aiConfigured:result.aiConfigured})}catch(e){ui.error(this,e)}finally{this.setData({loading:false})}},
 input:ui.input,pick(e){this.setData({gradeIndex:Number(e.detail.value)})},
 async save(){if(this.data.saving)return;this.setData({saving:true,error:''});try{const profile=await api.call('profile.save',{name:this.data.name,grade:this.data.grades[this.data.gradeIndex]});getApp().globalData.profile=profile;wx.showToast({title:'已保存'})}catch(e){ui.error(this,e)}finally{this.setData({saving:false})}},
 stats(){wx.navigateTo({url:'/pages/stats/stats'})},
 aiConfig(){wx.navigateTo({url:'/pages/ai-config/ai-config'})},
 async demo(){if(await ui.confirm('进入本地演示','演示数据独立存于本机，使用预置示例，不会修改你的云端错题。'))api.setMode('demo')},
 cloud(){try{api.setMode('cloud')}catch(e){ui.error(this,e)}},
 async reset(){if(await ui.confirm('重置演示数据','仅删除本地演示中的修改并恢复预置示例。')){require('../../utils/demo').reset();this.load()}},
 privacy(){wx.showModal({title:'数据与使用说明',content:'云开发模式以微信身份隔离错题。上传图片会存入本应用云存储，并在你点击 AI 分析时发送给已配置的模型服务。请只上传题目区域。AI 输出可能有误，保存前请核对。实际错因、订正内容和练习作答由你填写，练习结果采用自评。演示模式的数据只保存在本机。',showCancel:false})}
})