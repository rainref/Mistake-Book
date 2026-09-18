'use strict'
class AppError extends Error {
  constructor(message, code = 'INVALID_INPUT') { super(message); this.code = code }
}
const SUBJECTS = ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '其他']
const AI_PROVIDERS = ['cloudbase', 'deepseek', 'qwen', 'kimi', 'kimi-coding', 'glm', 'minimax']
function aiProvider(value) {
  const id = text(value, '模型供应商', 20)
  if (!AI_PROVIDERS.includes(id)) throw new AppError('模型供应商无效')
  return id
}
function aiFormat(value) {
  const id = text(value, '请求格式', 20)
  if (id && id !== 'openai' && id !== 'anthropic') throw new AppError('请求格式无效')
  return id
}
function text(value, label, max = 6000, required = false) {
  if (value == null && !required) return ''
  if (typeof value !== 'string') throw new AppError(label + '格式错误')
  const result = value.trim()
  if (required && !result) throw new AppError('请填写' + label)
  if (result.length > max) throw new AppError(label + '最多 ' + max + ' 字')
  return result
}
function id(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(value)) throw new AppError('记录编号无效')
  return value
}
// 条目归一为安全数据：非字符串转文本、超长截断、超出条数只取前 N 条、空条目剔除。
// AI 输出形态多变，校验以收敛为目标，而不是一遇偏差就拒绝整张结果。
function list(value, label, maxItems = 12, maxText = 200) {
  const items = looseList(value).map(item => {
    if (typeof item !== 'string') item = item == null ? '' : (typeof item === 'object' ? JSON.stringify(item) : String(item))
    return item.trim().slice(0, maxText)
  }).filter(Boolean)
  return [...new Set(items)].slice(0, maxItems)
}
// AI 偶发把数组字段输出成一段文字：按行与常见分隔符拆分归一；确实缺失时视为空数组，交给后续必填校验。
function looseList(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return value.split(/[，,、;；\n]/).map(s => s.trim()).filter(Boolean)
  return []
}
function analysis(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('AI 返回格式无效', 'AI_FORMAT')
  if (value.readable === false) throw new AppError('图片题目不完整或不清晰，请重拍或补充题干', 'IMAGE_UNCLEAR')
  const subject = text(value.subject, '学科', 10, true)
  if (!SUBJECTS.includes(subject)) throw new AppError('请选择有效学科')
  const steps = list(value.steps, '解题步骤', 12, 2000)
  const knowledgePoints = list(value.knowledgePoints, '知识点', 12, 60)
  if (!steps.length || !knowledgePoints.length) throw new AppError('解析必须包含步骤和知识点', 'AI_FORMAT')
  return {
    questionText: text(value.questionText, '题目', 6000, true), subject,
    chapter: text(value.chapter, '章节', 80, true), answer: text(value.answer, '参考答案', 4000, true),
    approach: text(value.approach, '解题思路', 3000, true), steps, knowledgePoints,
    pitfalls: list(value.pitfalls, '易错点', 12, 500)
  }
}
function mistake(value) {
  const subject = text(value.subject, '学科', 10, true)
  if (!SUBJECTS.includes(subject)) throw new AppError('请选择有效学科')
  return {
    questionText: text(value.questionText, '题目', 6000, true), subject,
    chapter: text(value.chapter, '章节', 80) || '待归类', answer: text(value.answer, '参考答案', 4000),
    approach: text(value.approach, '解题思路', 3000), steps: list(value.steps || [], '解题步骤', 12, 2000),
    knowledgePoints: list(value.knowledgePoints || [], '知识点', 12, 60), pitfalls: list(value.pitfalls || [], '易错点', 12, 500),
    wrongReason: text(value.wrongReason, '我的错因', 3000), correction: text(value.correction, '订正结果', 6000),
    grade: text(value.grade, '年级', 20),
    status: ['new', 'reviewing', 'mastered'].includes(value.status) ? value.status : 'new',
    mediaId: value.mediaId ? id(value.mediaId) : ''
  }
}
function practice(value, count) {
  if (!value || !Array.isArray(value.questions) || value.questions.length !== count) throw new AppError('AI 未返回完整练习组，请重试', 'AI_FORMAT')
  const questions = value.questions.map((q, i) => ({
    id: 'q' + (i + 1), questionText: text(q.questionText, '练习题目', 4000, true),
    answer: text(q.answer, '练习答案', 3000, true), steps: list(q.steps, '练习解析', 10, 2000),
    hint: text(q.hint, '提示', 1000), knowledgePoints: list(q.knowledgePoints, '练习知识点', 12, 60)
  }))
  if (new Set(questions.map(q => q.questionText)).size !== count || questions.some(q => !q.steps.length)) throw new AppError('练习题重复或解析不完整，请重试', 'AI_FORMAT')
  return questions
}
function parseAI(raw) {
  if (typeof raw !== 'string' || raw.length > 100000) throw new AppError('AI 返回内容异常', 'AI_FORMAT')
  const fence = String.fromCharCode(96).repeat(3)
  let cleaned = raw.trim()
  if (cleaned.startsWith(fence) && cleaned.endsWith(fence)) cleaned = cleaned.slice(3, -3).replace(/^json\s*/i, '').trim()
  try { return JSON.parse(cleaned) } catch (_) { throw new AppError('AI 返回格式不完整，请重新生成', 'AI_FORMAT') }
}
module.exports = { AppError, SUBJECTS, AI_PROVIDERS, aiProvider, aiFormat, text, id, list, analysis, mistake, practice, parseAI }
