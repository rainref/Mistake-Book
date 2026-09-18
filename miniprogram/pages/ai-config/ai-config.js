const api = require('../../utils/api')
const ui = require('../../utils/ui')
Page({
  data: { loading: true, saving: false, testing: false, error: '', message: '', providers: [], providerNames: [], providerIndex: 0, provider: null, apiKey: '', baseUrl: '', textModel: '', visionModel: '', saved: false, savedProvider: '', hasKey: false,
    formats: [{ id: 'openai', name: 'OpenAI 兼容（chat/completions）' }, { id: 'anthropic', name: 'Anthropic 兼容（/v1/messages）' }], formatNames: ['OpenAI 兼容（chat/completions）', 'Anthropic 兼容（/v1/messages）'], format: 'openai' },
  onLoad() { this.load() },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      const result = await api.call('ai.config.get')
      const providers = result.providers
      const providerNames = providers.map(item => item.name)
      const index = Math.max(0, providers.findIndex(item => item.id === result.config.provider))
      const provider = providers[index]
      this.setData({
        providers, providerNames, providerIndex: index, provider,
        apiKey: result.config.apiKey, baseUrl: result.config.baseUrl,
        textModel: result.config.textModel, visionModel: result.config.visionModel,
        format: result.config.format || provider.format || 'openai',
        saved: result.saved, savedProvider: result.saved ? result.config.provider : '', hasKey: result.hasKey
      })
    } catch (e) {
      // 旧版云函数没有 ai.config.* 动作，返回「不支持的操作」，提示重新部署。
      const stale = e && (e.code === 'INVALID_ACTION' || /不支持的操作/.test(e.message || ''))
      ui.error(this, stale ? { message: '云端函数尚未更新，缺少 AI 配置接口。请在微信开发者工具中右键 cloudfunctions/notebook，选择「上传并部署：云端安装依赖（不上传 node_modules）」后，回到本页重试。' } : e)
    } finally { this.setData({ loading: false }) }
  },
  pickProvider(e) {
    const index = Number(e.detail.value)
    const provider = this.data.providers[index]
    // 换供应商后，原先保存的 Key 与「已保存」状态不再适用于当前选择。
    const same = this.data.savedProvider === provider.id
    this.setData({
      providerIndex: index, provider, baseUrl: provider.baseUrl || '',
      textModel: provider.textModels[0] || '', visionModel: provider.visionModels[0] || '',
      format: provider.format || 'openai',
      apiKey: '', saved: same, hasKey: same && this.data.hasKey
    })
  },
  pickFormat(e) {
    const item = this.data.formats[Number(e.detail.value)]
    if (item) this.setData({ format: item.id })
  },
  fill(e) { this.setData({ [e.currentTarget.dataset.field]: e.currentTarget.dataset.value }) },
  input: ui.input,
  async save() {
    if (this.data.saving) return
    this.setData({ saving: true, error: '', message: '' })
    try {
      const result = await api.call('ai.config.save', {
        provider: this.data.provider.id, apiKey: this.data.apiKey, baseUrl: this.data.baseUrl,
        textModel: this.data.textModel, visionModel: this.data.visionModel, format: this.data.format
      })
      this.setData({ saved: true, savedProvider: this.data.provider.id, hasKey: result.hasKey, message: result.configured ? '已保存，模型配置完整。建议再做一次连接测试。' : '已保存，但模型名称未填完整，AI 功能仍不可用。' })
      wx.showToast({ title: '已保存' })
    } catch (e) { ui.error(this, e) } finally { this.setData({ saving: false }) }
  },
  async test() {
    if (this.data.testing) return
    this.setData({ testing: true, error: '', message: '' })
    try {
      const result = await api.call('ai.config.test')
      this.setData({ message: '连接成功（' + result.ms + 'ms）：' + (result.sample || '') })
    } catch (e) { ui.error(this, e) } finally { this.setData({ testing: false }) }
  }
})
