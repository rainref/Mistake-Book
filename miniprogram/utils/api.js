const config = require('../config')
const { cloudError } = require('./cloud-error')
function mode() { return wx.getStorageSync('shicuo.mode') === 'demo' ? 'demo' : config.cloudEnv ? 'cloud' : 'setup' }
function setMode(value) {
  if (value === 'cloud' && !config.cloudEnv) throw new Error('请先在 miniprogram/config.js 中填写云环境 ID')
  wx.setStorageSync('shicuo.mode', value)
  getApp().globalData.profile = null
  const current = getCurrentPages().slice(-1)[0]
  if (current && current.route === 'pages/index/index') {
    if (typeof current.onShow === 'function') current.onShow()
    return
  }
  wx.reLaunch({ url: '/pages/index/index' })
}
async function call(action, data = {}) {
  if (mode() === 'setup') throw new Error('尚未填写云环境 ID。请完成云开发配置，或选择体验本地演示')
  if (mode() === 'demo') return require('./demo').call(action, data)
  if (!wx.cloud) throw new Error('请升级微信或开发者工具基础库后重试')
  const startedEnv = config.cloudEnv
  let result
  try { result = (await wx.cloud.callFunction({ name: config.functionName, config: { env: startedEnv }, data: { action, data } })).result }
  catch (cause) {
    const error = cloudError(cause, startedEnv, config.functionName)
    console.error('[拾错] 云函数调用失败', { action, ...error.diagnostic })
    throw error
  }
  if (mode() !== 'cloud' || config.cloudEnv !== startedEnv) throw new Error('运行环境已切换，请重新打开页面')
  if (!result || !result.ok) {
    const error = new Error(result?.error?.message || '云服务返回异常，请重试')
    error.code = result?.error?.code
    throw error
  }
  return result.data
}
async function bootstrap() {
  const result = await call('bootstrap')
  getApp().globalData.profile = result.profile
  return result
}
function uid() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 13) + Math.random().toString(36).slice(2, 8) }
async function upload(filePath, extension) {
  if (mode() !== 'cloud') throw new Error('图片识别需要云开发模式；演示模式可载入示例或手动录题')
  const slot = await call('media.prepare', { extension })
  const result = await wx.cloud.uploadFile({ cloudPath: slot.cloudPath, filePath, config: { env: config.cloudEnv } })
  await call('media.commit', { mediaId: slot.mediaId, fileID: result.fileID })
  return { mediaId: slot.mediaId, fileID: result.fileID }
}
module.exports = { call, mode, setMode, bootstrap, uid, upload }
