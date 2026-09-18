const v = require('./validation')
const { samples, practiceBank } = require('./examples')
const KEY = 'shicuo.demo.v1'
function initial() {
  const now = Date.now()
  return { profile: { _id: 'demo_profile', name: '小拾', grade: '八年级' }, items: samples.map((s,i) => ({ ...s, _id: 'demo_item_' + i, mediaId: '', revision: 1, deletedAt: 0, createdAt: now - i * 86400000, updatedAt: now })), sets: [], records: [] }
}
function read() { return wx.getStorageSync(KEY) || initial() }
function reset() { wx.setStorageSync(KEY, initial()) }
async function call(action, data = {}) {
  const db = read()
  const find = (items, id) => { const value = items.find(x => x._id === id && !x.deletedAt); if (!value) throw new Error('记录不存在'); return value }
  let result
  switch (action) {
    case 'bootstrap': result = { profile: db.profile, aiConfigured: false, subjects: v.SUBJECTS }; break
    case 'profile.save': db.profile = { ...db.profile, name: v.text(data.name,'称呼',30,true), grade: v.text(data.grade,'年级',20,true) }; result = db.profile; break
    case 'mistake.list': {
      const filtered = db.items.filter(x => !x.deletedAt && (!data.subject || x.subject === data.subject) && (!data.chapter || x.chapter === data.chapter) && (!data.knowledgePoint || x.knowledgePoints.includes(data.knowledgePoint)) && (!data.status || x.status === data.status) && (!data.query || x.questionText.toLowerCase().includes(data.query.toLowerCase()))).sort((a,b)=>b.createdAt-a.createdAt)
      const page = data.page || 1
      result = { items: filtered.slice((page-1)*20,page*20), hasMore: page*20 < filtered.length, page }; break
    }
    case 'mistake.get': {
      const item = find(db.items,data.id)
      result = { item, fileID: '', sets: db.sets.filter(s=>s.mistakeId === item._id).map(s=>({id:s._id,count:s.questions.length,difficulty:s.difficulty,createdAt:s.createdAt})) }; break
    }
    case 'mistake.save': {
      const old = db.items.find(x=>x._id === data.id)
      if (old?.deletedAt) throw new Error('错题已删除')
      if (old?.mutationId === data.mutationId) { result = old; break }
      if (old && old.revision !== data.revision) throw new Error('错题已更新，请重新打开')
      const item = v.mistake(data.item)
      const source = samples.find(s => s.questionText === item.questionText && s.subject === item.subject)
      result = { ...item, sampleKey: source?.sampleKey || '', _id: v.id(data.id), mutationId: v.id(data.mutationId), revision: (old?.revision || 0)+1, createdAt: old?.createdAt || Date.now(), updatedAt: Date.now(), deletedAt: 0 }
      if (old) db.items[db.items.indexOf(old)] = result; else db.items.push(result)
      break
    }
    case 'mistake.status': { const item=find(db.items,data.id); if (!['new','reviewing','mastered'].includes(data.status)) throw new Error('状态无效'); item.status=data.status; item.revision++; result=item; break }
    case 'mistake.delete': { find(db.items,data.id).deletedAt=Date.now(); result={deleted:true}; break }
    case 'analyze': throw new Error('演示模式不调用 AI。请点击“载入示例题”查看预置解析，真实识题请切换云开发模式')
    case 'practice.generate': {
      const item=find(db.items,data.mistakeId)
      const old=db.sets.find(s=>s._id===data.setId)
      if(old){result=old;break}
      const bank=practiceBank(item.sampleKey)
      if(!bank.length) throw new Error('此题没有预置练习。演示模式仅为三道示例题提供练习组；自录题生成练习需使用云开发模式')
      result={_id:data.setId,mistakeId:item._id,subject:item.subject,knowledgePoints:item.knowledgePoints,difficulty:'预置示例',questions:bank.slice(0,data.count===5?5:3),createdAt:Date.now()}
      db.sets.push(result); break
    }
    case 'practice.get': { const set=find(db.sets,data.id); find(db.items,set.mistakeId); result={set,records:db.records.filter(r=>r.setId===set._id)}; break }
    case 'practice.record': {
      const set=find(db.sets,data.setId); find(db.items,set.mistakeId)
      if (!set.questions.some(q=>q.id===data.questionId) || typeof data.isCorrect!=='boolean') throw new Error('作答信息无效')
      const key=data.setId+'_'+data.questionId+'_'+data.attemptId
      const old=db.records.find(r=>r._id===key)
      result=old || {_id:key,setId:set._id,mistakeId:set.mistakeId,subject:set.subject,questionId:data.questionId,attemptId:data.attemptId,answer:data.answer,isCorrect:data.isCorrect,createdAt:Date.now()}
      if(!old) db.records.push(result); break
    }
    case 'summary': {
      const items=db.items.filter(i=>!i.deletedAt)
      const records=db.records.filter(r=>items.some(i=>i._id===r.mistakeId))
      const tags=[]
      items.forEach(item=>item.knowledgePoints.forEach(name=>{
        const key=JSON.stringify([item.subject,item.chapter,name])
        let tag=tags.find(t=>t.key===key)
        if(!tag){tag={key,name,subject:item.subject,chapter:item.chapter,count:0,pending:0};tags.push(tag)}
        tag.count++;if(item.status!=='mastered')tag.pending++
      }))
      const activity=Array.from({length:7},(_,i)=>{
        const day=new Date(Date.now()+8*3600000-(6-i)*86400000).toISOString().slice(0,10)
        return {day:day.slice(5),count:records.filter(r=>new Date(r.createdAt+8*3600000).toISOString().slice(0,10)===day).length}
      })
      result={total:items.length,mastered:items.filter(i=>i.status==='mastered').length,pending:items.filter(i=>i.status!=='mastered').length,practiceCount:records.length,correctCount:records.filter(r=>r.isCorrect).length,tags:tags.sort((a,b)=>b.pending-a.pending),subjects:v.SUBJECTS.map(name=>({name,total:items.filter(i=>i.subject===name).length,pending:items.filter(i=>i.subject===name&&i.status!=='mastered').length})).filter(s=>s.total),activity}
      break
    }
    default: throw new Error('演示模式不支持此操作')
  }
  wx.setStorageSync(KEY,db)
  return JSON.parse(JSON.stringify(result))
}
module.exports={call,reset}
