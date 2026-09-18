const test=require('node:test')
const assert=require('node:assert/strict')
const v=require('../cloudfunctions/notebook/validation')
test('练习组：AI 把 steps/knowledgePoints 输出成字符串时按行与分隔符拆分归一',()=>{
 const result=v.practice({questions:[
  {questionText:'题一',answer:'1',steps:'第一步：去括号\n第二步：移项求解',hint:'提示一',knowledgePoints:'去括号,移项'},
  {questionText:'题二',answer:'2',steps:['直接给出数组'],hint:'提示二',knowledgePoints:['合并同类项']},
  {questionText:'题三',answer:'3',steps:'1. 分析题意 2. 列式计算',hint:'',knowledgePoints:'通分、约分'}
 ]},3)
 assert.equal(result.length,3)
 assert.deepEqual(result[0].steps,['第一步：去括号','第二步：移项求解'])
 assert.deepEqual(result[0].knowledgePoints,['去括号','移项'])
 assert.deepEqual(result[2].knowledgePoints,['通分','约分'])
})
test('练习组：steps 确实缺失仍拒绝，提示解析不完整',()=>{
 assert.throws(()=>v.practice({questions:[
  {questionText:'题一',answer:'1',hint:'',knowledgePoints:['点']},
  {questionText:'题二',answer:'2',steps:['步'],hint:'',knowledgePoints:['点']},
  {questionText:'题三',answer:'3',steps:['步'],hint:'',knowledgePoints:['点']}
 ]},3),{message:/解析不完整/})
})
test('识题解析：steps/knowledgePoints/pitfalls 为字符串时同样归一',()=>{
 const result=v.analysis({readable:true,questionText:'解方程 3(x-2)=21',subject:'数学',chapter:'一元一次方程',answer:'x=9',approach:'先去括号再移项',steps:'步骤一：去括号得 3x-6=21\n步骤二：移项求解',knowledgePoints:'去括号，移项',pitfalls:'漏乘常数项\n忘记变号'})
 assert.deepEqual(result.steps,['步骤一：去括号得 3x-6=21','步骤二：移项求解'])
 assert.deepEqual(result.knowledgePoints,['去括号','移项'])
 assert.deepEqual(result.pitfalls,['漏乘常数项','忘记变号'])
})
test('练习组：条目形态异常（非字符串/过多/超长）一律收敛为可用数据，不整张拒绝',()=>{
 const longStep='长'.repeat(2500)
 const result=v.practice({questions:[
  {questionText:'题一',answer:'1',steps:[42,{why:'漏变号'},'正常步骤',longStep],hint:'',knowledgePoints:['点']},
  {questionText:'题二',answer:'2',steps:Array.from({length:14},(_,i)=>'步骤'+(i+1)),hint:'',knowledgePoints:['点']},
  {questionText:'题三',answer:'3',steps:['步'],hint:'',knowledgePoints:[{name:'去括号'}]}
 ]},3)
 assert.deepEqual(result[0].steps.slice(0,3),['42','{"why":"漏变号"}','正常步骤'])
 assert.equal(result[0].steps[3].length,2000,'超长单条应截断到上限而不是报错')
 assert.equal(result[1].steps.length,10,'过多条目应截断到上限')
 assert.deepEqual(result[2].knowledgePoints,['{"name":"去括号"}'])
})
test('识题解析：知识点条目非字符串时转文本，不再报知识点格式错误',()=>{
 const result=v.analysis({readable:true,questionText:'题干',subject:'数学',chapter:'章节',answer:'答案',approach:'思路',steps:['步'],knowledgePoints:[123,'去括号']})
 assert.deepEqual(result.knowledgePoints,['123','去括号'])
})
