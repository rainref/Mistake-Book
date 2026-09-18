'use strict'
const v = require('./validation')
const { AppError } = v
const crypto = require('node:crypto')
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
function createService({ repo, ai, storage, env = process.env, now = () => Date.now(), uuid = () => crypto.randomUUID().replace(/-/g, ''), dailyLimit = 30 }) {
  const aiDocId = owner => digest('ai-settings:' + owner)
  function defaultAIConfig() {
    return {
      provider: env.AI_PROVIDER || 'cloudbase', apiKey: env.AI_API_KEY || '', baseUrl: env.AI_BASE_URL || '',
      textModel: env.AI_TEXT_MODEL || '', visionModel: env.AI_VISION_MODEL || '', format: ''
    }
  }
  async function readAIConfig(owner) {
    const record = await repo.get('ai_settings', aiDocId(owner))
    if (!record) return null
    return {
      provider: record.provider || 'cloudbase', apiKey: record.apiKey || '', baseUrl: record.baseUrl || '',
      textModel: record.textModel || '', visionModel: record.visionModel || '', format: record.format || '', updatedAt: record.updatedAt || 0
    }
  }
  async function aiConfig(owner) { return (await readAIConfig(owner)) || defaultAIConfig() }
  function maskKey(key) {
    if (!key) return ''
    if (key.length <= 8) return '****'
    return key.slice(0, 3) + '****' + key.slice(-4)
  }
  async function own(collection, recordId, owner) {
    const record = await repo.get(collection, v.id(recordId))
    if (!record || record._openid !== owner || record.deletedAt) throw new AppError('记录不存在或无权访问', 'NOT_FOUND')
    return record
  }
  async function quota(owner) {
    const day = new Date(now() + 8 * 3600000).toISOString().slice(0, 10)
    await repo.change('ai_usage', digest(owner + ':' + day), old => {
      if ((old?.count || 0) >= dailyLimit) throw new AppError('今日 AI 使用次数已达上限，明天再来，也可以手动整理错题', 'QUOTA')
      return { _openid: owner, day, count: (old?.count || 0) + 1 }
    })
  }
  return async function run(owner, action, data = {}) {
    if (!owner || typeof owner !== 'string') throw new AppError('请从微信小程序进入', 'UNAUTHORIZED')
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('请求格式无效')
    switch (action) {
      case 'bootstrap': {
        const profile = await repo.change('profiles', digest(owner), old => old || { _openid: owner, name: '同学', grade: '七年级', createdAt: now() })
        return { profile, aiConfigured: ai.configured(await aiConfig(owner)), subjects: v.SUBJECTS }
      }
      case 'profile.save':
        return repo.change('profiles', digest(owner), old => ({ ...old, _openid: owner, name: v.text(data.name, '称呼', 30, true), grade: v.text(data.grade, '年级', 20, true), updatedAt: now() }))
      case 'media.prepare': {
        const mediaId = uuid()
        const extension = data.extension === 'png' ? 'png' : 'jpg'
        const cloudPath = 'mistakes/' + owner + '/' + mediaId + '.' + extension
        await repo.change('media', mediaId, () => ({ _openid: owner, cloudPath, fileID: '', createdAt: now() }))
        return { mediaId, cloudPath }
      }
      case 'media.commit': {
        const media = await own('media', data.mediaId, owner)
        const fileID = v.text(data.fileID, '图片地址', 1024, true)
        if (!fileID.startsWith('cloud://') || !fileID.endsWith('/' + media.cloudPath)) throw new AppError('图片与上传凭证不匹配')
        return repo.change('media', media._id, old => {
          if (!old || old._openid !== owner || (old.fileID && old.fileID !== fileID)) throw new AppError('上传凭证无效')
          return { ...old, fileID }
        })
      }
      case 'analyze': {
        const started = Date.now()
        const questionText = v.text(data.questionText, '题目', 6000)
        if (!data.mediaId && !questionText) throw new AppError('请上传题目图片或输入题目')
        let media = null
        if (data.mediaId) {
          media = await own('media', data.mediaId, owner)
          if (!media.fileID) throw new AppError('图片尚未上传完成')
        }
        // 限额校验先于图片下载：参数无效不消耗额度，额度不足也不必下载图片。
        await quota(owner)
        let image = null
        if (media) {
          image = await storage.read(media.fileID)
          console.log('[拾错] analyze 图片下载完成', { bytes: image ? image.length : 0, ms: Date.now() - started })
          if (!image || image.length > 3 * 1024 * 1024) throw new AppError('图片需小于 3 MB')
        }
        const aiStarted = Date.now()
        const result = v.analysis(await ai.analyze(await aiConfig(owner), { image, questionText, grade: v.text(data.grade, '年级', 20), subject: v.text(data.subject, '学科', 10) }))
        console.log('[拾错] analyze 完成', { totalMs: Date.now() - started, aiMs: Date.now() - aiStarted })
        return result
      }
      case 'mistake.save': {
        const recordId = v.id(data.id)
        const fields = v.mistake(data.item || {})
        if (fields.mediaId) await own('media', fields.mediaId, owner)
        const mutationId = v.id(data.mutationId)
        return repo.change('mistakes', recordId, old => {
          if (old && (old._openid !== owner || old.deletedAt)) throw new AppError('记录不存在或无权修改', 'NOT_FOUND')
          if (old?.mutationId === mutationId) return old
          if (old && old.revision !== data.revision) throw new AppError('这道题已在其他页面更新，请重新打开后编辑', 'CONFLICT')
          return { ...fields, _openid: owner, mutationId, revision: (old?.revision || 0) + 1, createdAt: old?.createdAt || now(), updatedAt: now(), deletedAt: 0 }
        })
      }
      case 'mistake.list': {
        const filters = {
          subject: v.text(data.subject, '学科', 10), chapter: v.text(data.chapter, '章节', 80),
          knowledgePoint: v.text(data.knowledgePoint, '知识点', 60), query: v.text(data.query, '搜索内容', 100),
          status: ['new', 'reviewing', 'mastered'].includes(data.status) ? data.status : ''
        }
        const page = Math.max(1, Math.min(10000, Number.isInteger(data.page) ? data.page : 1))
        return repo.listMistakes(owner, filters, page, 20)
      }
      case 'mistake.get': {
        const item = await own('mistakes', data.id, owner)
        const fileID = item.mediaId ? (await own('media', item.mediaId, owner)).fileID : ''
        const sets = await repo.find('practice_sets', { _openid: owner, mistakeId: item._id })
        return { item, fileID, sets: sets.map(s => ({ id: s._id, createdAt: s.createdAt, count: s.questions.length, difficulty: s.difficulty })) }
      }
      case 'mistake.status': {
        if (!['new', 'reviewing', 'mastered'].includes(data.status)) throw new AppError('复习状态无效')
        await own('mistakes', data.id, owner)
        return repo.change('mistakes', data.id, old => {
          if (!old || old._openid !== owner || old.deletedAt) throw new AppError('错题已删除', 'NOT_FOUND')
          return { ...old, status: data.status, revision: old.revision + 1, updatedAt: now() }
        })
      }
      case 'mistake.delete': {
        await own('mistakes', data.id, owner)
        await repo.change('mistakes', data.id, old => {
          if (!old || old._openid !== owner) throw new AppError('无权删除', 'NOT_FOUND')
          return { ...old, deletedAt: now(), revision: old.revision + 1 }
        })
        return { deleted: true }
      }
      case 'practice.generate': {
        const source = await own('mistakes', data.mistakeId, owner)
        const setId = v.id(data.setId)
        const existing = await repo.get('practice_sets', setId)
        if (existing) {
          if (existing._openid !== owner || existing.mistakeId !== source._id) throw new AppError('练习组编号无效')
          return existing
        }
        const count = [3, 5].includes(data.count) ? data.count : 3
        const difficulty = ['基础', '巩固', '提高'].includes(data.difficulty) ? data.difficulty : '巩固'
        await quota(owner)
        const questions = v.practice(await ai.practice(await aiConfig(owner), { source, count, difficulty }), count)
        await own('mistakes', source._id, owner)
        return repo.change('practice_sets', setId, old => {
          if (old && (old._openid !== owner || old.mistakeId !== source._id)) throw new AppError('练习组编号无效')
          return old || { _openid: owner, mistakeId: source._id, subject: source.subject, knowledgePoints: source.knowledgePoints, difficulty, questions, createdAt: now() }
        })
      }
      case 'practice.get': {
        const set = await own('practice_sets', data.id, owner)
        await own('mistakes', set.mistakeId, owner)
        return { set, records: await repo.find('practice_records', { _openid: owner, setId: set._id }) }
      }
      case 'practice.record': {
        const set = await own('practice_sets', data.setId, owner)
        await own('mistakes', set.mistakeId, owner)
        if (!set.questions.some(q => q.id === data.questionId)) throw new AppError('练习题不存在')
        if (typeof data.isCorrect !== 'boolean') throw new AppError('请选择作答结果')
        const attemptId = v.id(data.attemptId)
        const answer = v.text(data.answer, '我的答案', 6000)
        return repo.change('practice_records', digest(owner + ':' + set._id + ':' + data.questionId + ':' + attemptId), old => old || {
          _openid: owner, setId: set._id, mistakeId: set.mistakeId, questionId: data.questionId, attemptId,
          subject: set.subject, answer, isCorrect: data.isCorrect, createdAt: now()
        })
      }
      case 'summary': {
        const items = await repo.find('mistakes', { _openid: owner, deletedAt: 0 })
        const validIds = new Set(items.map(x => x._id))
        const records = (await repo.find('practice_records', { _openid: owner })).filter(r => validIds.has(r.mistakeId))
        const taxonomy = new Map()
        for (const item of items) for (const name of item.knowledgePoints) {
          const key = JSON.stringify([item.subject, item.chapter, name])
          const tag = taxonomy.get(key) || { key, subject: item.subject, chapter: item.chapter, name, count: 0, pending: 0 }
          tag.count++; if (item.status !== 'mastered') tag.pending++
          taxonomy.set(key, tag)
        }
        const subjects = v.SUBJECTS.map(name => ({ name, total: items.filter(i => i.subject === name).length, pending: items.filter(i => i.subject === name && i.status !== 'mastered').length })).filter(s => s.total)
        const activity = Array.from({ length: 7 }, (_, i) => {
          const day = new Date(now() + 8 * 3600000 - (6 - i) * 86400000).toISOString().slice(0, 10)
          return { day: day.slice(5), count: records.filter(r => new Date(r.createdAt + 8 * 3600000).toISOString().slice(0, 10) === day).length }
        })
        return { total: items.length, mastered: items.filter(i => i.status === 'mastered').length, pending: items.filter(i => i.status !== 'mastered').length, practiceCount: records.length, correctCount: records.filter(r => r.isCorrect).length, subjects, tags: [...taxonomy.values()].sort((a, b) => b.pending - a.pending), activity }
      }
      case 'ai.config.get': {
        const saved = await readAIConfig(owner)
        const config = saved || defaultAIConfig()
        return {
          providers: ai.PROVIDERS,
          config: { ...config, apiKey: saved ? maskKey(config.apiKey) : '' },
          hasKey: Boolean(config.apiKey), saved: Boolean(saved), updatedAt: saved ? saved.updatedAt : 0
        }
      }
      case 'ai.config.save': {
        const provider = v.aiProvider(data.provider || 'cloudbase')
        const meta = ai.PROVIDERS.find(item => item.id === provider)
        const textModel = v.text(data.textModel, '文本模型', 80)
        const visionModel = v.text(data.visionModel, '视觉模型', 80)
        const baseUrl = v.text(data.baseUrl, '接口地址', 300)
        const format = v.aiFormat(data.format)
        if (!textModel && !visionModel) throw new AppError('请至少填写一个模型名称')
        let apiKey = v.text(data.apiKey, 'API Key', 300)
        const previous = await readAIConfig(owner)
        // 前端回填的是掩码，视为「不修改」。
        if (apiKey && /\*{3,}/.test(apiKey)) apiKey = previous ? previous.apiKey : ''
        if (provider !== 'cloudbase' && !apiKey) throw new AppError('该供应商需要填写 API Key')
        const finalBaseUrl = baseUrl || (meta ? meta.baseUrl : '')
        if (provider !== 'cloudbase' && !finalBaseUrl) throw new AppError('请填写模型接口地址')
        const next = { _openid: owner, provider, apiKey, baseUrl: finalBaseUrl, textModel, visionModel, format, updatedAt: now() }
        await repo.change('ai_settings', aiDocId(owner), () => next)
        return { saved: true, configured: ai.configured(next), hasKey: Boolean(apiKey) }
      }
      case 'ai.config.test': {
        const config = await aiConfig(owner)
        if (!ai.configured(config)) throw new AppError('请先填写并保存模型配置', 'AI_NOT_CONFIGURED')
        return ai.test(config)
      }
      default: throw new AppError('不支持的操作', 'INVALID_ACTION')
    }
  }
}
module.exports = { createService }
