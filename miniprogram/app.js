const config = require('./config')
App({
  globalData: { profile: null, libraryFilter: null },
  onLaunch() {
    if (config.cloudEnv && wx.cloud) wx.cloud.init({ env: config.cloudEnv, traceUser: true })
  }
})
