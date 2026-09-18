const test=require('node:test')
const assert=require('node:assert/strict')
const {createRepository}=require('../cloudfunctions/notebook/repository')
test('数据库事务仅吞掉“文档不存在”，其他错误继续抛出',async()=>{
 let written;let missing=true;let failure=null
 const doc={async get(){if(failure)throw failure;if(missing)throw {errMsg:'document.get:fail document with _id example does not exist'};return {data:{_id:'example_id',count:2}}},async set({data}){written=data}}
 const db={runTransaction:fn=>fn({collection:()=>({doc:()=>doc})})}
 const repo=createRepository(db)
 const first=await repo.change('collection','example_id',old=>({count:(old?.count||0)+1}))
 assert.equal(first.count,1);assert.deepEqual(written,{count:1})
 missing=false;const second=await repo.change('collection','example_id',old=>({...old,count:old.count+1}));assert.equal(second.count,3);assert.ok(!('_id' in written))
 failure=new Error('database collection not exists')
 await assert.rejects(repo.change('collection','example_id',()=>({count:1})),/database collection/)
})
test('集合未创建时读取视为空数据，写入前自动建集合并只建一次',async()=>{
 const created=[]
 let written
 const missing={errCode:-502005,errMsg:'collection.get:fail -502005 database collection not exists. [ResourceNotFound] Db or Table not exist: ai_settings.'}
 const chain={where(){return this},orderBy(){return this},skip(){return this},limit(){return this},async get(){throw missing}}
 const doc={async get(){throw {errMsg:'document.get:fail document with _id example does not exist'}},async set({data}){written=data}}
 const db={createCollection(name){created.push(name)},collection:()=>chain,runTransaction:fn=>fn({collection:()=>({doc:()=>doc})})}
 const repo=createRepository(db)
 assert.equal(await repo.get('ai_settings','example_id'),null)
 assert.deepEqual(await repo.find('ai_settings',{}),[])
 assert.deepEqual(await repo.listMistakes('alice',{},1,20),{items:[],page:1,hasMore:false})
 await repo.change('ai_settings','example_id',()=>({provider:'cloudbase'}))
 assert.deepEqual(written,{provider:'cloudbase'})
 await repo.change('ai_settings','example_id',()=>({provider:'kimi'}))
 assert.deepEqual(created,['ai_settings'])
})
test('无 createCollection 能力的适配（如旧 SDK）仍可写入',async()=>{
 let written
 const doc={async get(){throw {errMsg:'document.get:fail document with _id example does not exist'}},async set({data}){written=data}}
 const repo=createRepository({runTransaction:fn=>fn({collection:()=>({doc:()=>doc})})})
 await repo.change('profiles','example_id',()=>({name:'同学'}))
 assert.deepEqual(written,{name:'同学'})
})
test('云查询始终包含 owner 和删除标记，搜索被转义为字面量',async()=>{
 let where;let regexp;let limit
 const chain={where(value){where=value;return this},orderBy(){return this},skip(){return this},limit(value){limit=value;return this},async get(){return {data:[]}}}
 const db={collection:()=>chain,RegExp:value=>{regexp=value;return value}}
 const repo=createRepository(db)
 await repo.listMistakes('alice',{subject:'数学',chapter:'一元一次方程',knowledgePoint:'去括号',query:'a.*(x)'},1,20)
 assert.equal(where._openid,'alice');assert.equal(where.deletedAt,0);assert.equal(where.knowledgePoints,'去括号');assert.equal(regexp.regexp,'a\\.\\*\\(x\\)');assert.equal(limit,21)
})
