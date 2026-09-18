const api = require('../../utils/api')
Component({ data: { mode: '' }, lifetimes: { attached() { this.setData({ mode: api.mode() }) } }, pageLifetimes: { show() { this.setData({ mode: api.mode() }) } } })
