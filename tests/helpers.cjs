const { createService } = require('../cloudfunctions/notebook/service')
const { PROVIDERS } = require('../cloudfunctions/notebook/ai')
const { samples, practiceBank } = require('../miniprogram/utils/examples')
function fixture(options={}) {
 const tables={}
 const clone=x=>x==null?null:structuredClone(x)
 const repo={
  async get(name,id){return clone(tables[name]?.[id])},
  async change(name,id,fn){tables[name]??={};const next={...fn(clone(tables[name][id])),_id:id};tables[name][id]=clone(next);return clone(next)},
  async find(name,where){return Object.values(tables[name]||{}).filter(x=>Object.entries(where).every(([k,v])=>x[k]===v)).map(clone)},
  async listMistakes(owner,f,page,size){const items=Object.values(tables.mistakes||{}).filter(x=>x._openid===owner&&!x.deletedAt&&(!f.subject||x.subject===f.subject)&&(!f.chapter||x.chapter===f.chapter)&&(!f.status||x.status===f.status)&&(!f.knowledgePoint||x.knowledgePoints.includes(f.knowledgePoint))&&(!f.query||x.questionText.toLowerCase().includes(f.query.toLowerCase()))).sort((a,b)=>b.createdAt-a.createdAt);return {items:clone(items.slice((page-1)*size,page*size)),page,hasMore:items.length>page*size}}
 }
 const calls={analyze:0,practice:0,read:0}
 const ai={PROVIDERS,configured:()=>true,async analyze(){calls.analyze++;return {...samples[0]}},async practice(config,{count}){calls.practice++;return {questions:practiceBank('equation').slice(0,count)}},...options.ai}
 const service=createService({repo,ai,storage:{async read(){calls.read++;return Buffer.from([0xff,0xd8,0,0])}},now:()=>Date.parse('2026-09-10T02:00:00Z'),uuid:()=> 'media_12345678',...options})
 const save=(owner='alice',id='mistake_12345678',item=samples[0],extra={})=>service(owner,'mistake.save',{id,item,mutationId:'mutation_12345678',...extra})
 return {service,repo,tables,calls,save}
}
module.exports={fixture}
