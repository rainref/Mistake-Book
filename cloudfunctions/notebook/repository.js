'use strict'
// -502005 表示集合尚未创建：读取视为空数据，写入前先自动建集合。
function isMissingCollection(error) {
  const code = typeof error?.errCode === 'number' ? String(error.errCode) : ''
  const text = String(error?.errMsg || error?.message || '')
  return code === '-502005' || /collection not exists|Db or Table not exist/i.test(text)
}
function createRepository(db) {
  const ensured = new Map()
  async function ensure(collection) {
    if (typeof db.createCollection !== 'function') return
    let pending = ensured.get(collection)
    if (!pending) {
      pending = Promise.resolve(db.createCollection(collection)).catch(() => {})
      ensured.set(collection, pending)
    }
    await pending
  }
  async function get(collection, id) {
    try {
      const result = await db.collection(collection).where({ _id: id }).limit(1).get()
      return result.data[0] || null
    } catch (error) { if (isMissingCollection(error)) return null; throw error }
  }
  return {
    get,
    async change(collection, id, update) {
      await ensure(collection)
      return db.runTransaction(async transaction => {
        let old = null
        try { old = (await transaction.collection(collection).doc(id).get()).data || null }
        catch (error) { if (!/document.*(not exist|not found)|DOCUMENT_NOT_EXIST/i.test(error.message || error.errMsg || '')) throw error }
        const next = update(old)
        const { _id, ...data } = next
        await transaction.collection(collection).doc(id).set({ data })
        return { ...data, _id: id }
      })
    },
    async find(collection, where) {
      try {
        const records = []
        for (let skip = 0; ; skip += 100) {
          const result = await db.collection(collection).where(where).orderBy('_id', 'asc').skip(skip).limit(100).get()
          records.push(...result.data)
          if (result.data.length < 100) break
        }
        return records
      } catch (error) { if (isMissingCollection(error)) return []; throw error }
    },
    async listMistakes(owner, filters, page, pageSize) {
      const where = { _openid: owner, deletedAt: 0 }
      for (const key of ['subject', 'chapter', 'status']) if (filters[key]) where[key] = filters[key]
      if (filters.knowledgePoint) where.knowledgePoints = filters.knowledgePoint
      if (filters.query) where.questionText = db.RegExp({ regexp: filters.query.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&'), options: 'i' })
      try {
        const result = await db.collection('mistakes').where(where).orderBy('createdAt', 'desc').orderBy('_id', 'desc').skip((page - 1) * pageSize).limit(pageSize + 1).get()
        return { items: result.data.slice(0, pageSize), page, hasMore: result.data.length > pageSize }
      } catch (error) { if (isMissingCollection(error)) return { items: [], page, hasMore: false }; throw error }
    }
  }
}
module.exports = { createRepository }
