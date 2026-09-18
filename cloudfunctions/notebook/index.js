'use strict'
const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')
const { createService } = require('./service')
const { createRepository } = require('./repository')
const { createAI } = require('./ai')
const { AppError } = require('./validation')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
exports.main = async event => {
  try {
    const context = cloud.getWXContext()
    if (!context.OPENID) throw new AppError('请从微信小程序进入', 'UNAUTHORIZED')
    const app = tcb.init({ env: context.ENV || process.env.TCB_ENV, timeout: 50000 })
    const run = createService({
      repo: createRepository(cloud.database()), ai: createAI(app, process.env), env: process.env,
      storage: { async read(fileID) { return (await cloud.downloadFile({ fileID })).fileContent } },
      dailyLimit: Math.max(1, Math.min(100, Number(process.env.AI_DAILY_LIMIT) || 30))
    })
    return { ok: true, data: await run(context.OPENID, event.action, event.data) }
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: { code: error.code, message: error.message } }
    console.error('notebook failure', { code: error.errCode || error.code || 'INTERNAL', message: error.message, stack: error.stack })
    const detail = String(error.errMsg || error.message || 'INTERNAL').slice(0, 200)
    return { ok: false, error: { code: 'INTERNAL', message: '服务暂时不可用：' + detail, detail } }
  }
}
