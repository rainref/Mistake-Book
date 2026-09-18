const STATUS = { new: '待订正', reviewing: '复习中', mastered: '已掌握' }
const SUBJECTS = ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '其他']
function decorate(item) { return { ...item, statusLabel: STATUS[item.status] || '待订正', dateLabel: new Date(item.createdAt).toLocaleDateString() } }
function input(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) }
function error(page, e) { page.setData({ error: e.message || '操作失败，请重试' }) }
function confirm(title, content) { return new Promise(resolve => wx.showModal({ title, content, confirmColor: '#24654b', success: r => resolve(r.confirm), fail: () => resolve(false) })) }
function open(id) { wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(id) }) }
function filter(values) { getApp().globalData.libraryFilter = values; wx.switchTab({ url: '/pages/library/library' }) }
module.exports = { STATUS, SUBJECTS, decorate, input, error, confirm, open, filter }
