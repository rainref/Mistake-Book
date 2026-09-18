const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const appRoot = path.join(root, 'miniprogram')
function walk(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='node_modules'?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]) }
const files=[...walk(appRoot),...walk(path.join(root,'cloudfunctions'))]
for(const file of files) {
 const source=fs.readFileSync(file,'utf8')
 if(file.endsWith('.json')) JSON.parse(source)
 if(file.endsWith('.js')) new vm.Script(source,{filename:file})
}
const project=JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8'))
assert.equal(project.miniprogramRoot,'miniprogram/')
assert.equal(project.cloudfunctionRoot,'cloudfunctions/')
const app=JSON.parse(fs.readFileSync(path.join(appRoot,'app.json'),'utf8'))
for(const page of app.pages) for(const ext of ['js','json','wxml','wxss']) assert.ok(fs.existsSync(path.join(appRoot,page+'.'+ext)),page+'.'+ext+' missing')
for(const tab of app.tabBar.list) assert.ok(app.pages.includes(tab.pagePath))
const components={...(app.usingComponents||{})}
for(const file of files.filter(f=>f.endsWith('.json')&&!f.endsWith('project.config.json')&&!f.endsWith('sitemap.json'))) {
 let json=null
 try{json=JSON.parse(fs.readFileSync(file,'utf8'))}catch(_){continue}
 Object.assign(components,json.usingComponents||{})
}
for(const [name,component] of Object.entries(components)) for(const ext of ['js','json','wxml','wxss']) assert.ok(fs.existsSync(path.join(appRoot,component+'.'+ext)),name+' missing '+ext)
for(const file of files.filter(f=>f.endsWith('.wxml'))) {
 const wxml=fs.readFileSync(file,'utf8')
 let definition
 const js=fs.readFileSync(file.replace('.wxml','.js'),'utf8')
 vm.runInNewContext(js,{require:name=>require(path.resolve(path.dirname(file),name)),Page:x=>{definition=x},Component:x=>{definition=x},Date,Math})
 const handlers=definition.methods||definition
 for(const match of wxml.matchAll(/(?:bind(?::[a-z]+|[a-z]+)|catch(?::[a-z]+|[a-z]+))="([A-Za-z_$][\w$]*)"/g)) assert.equal(typeof handlers[match[1]],'function',file+' handler missing '+match[1])
}
assert.equal(fs.readFileSync(path.join(appRoot,'utils/validation.js'),'utf8'),fs.readFileSync(path.join(root,'cloudfunctions/notebook/validation.js'),'utf8'),'client/server validation differs')
const frontend=files.filter(f=>f.startsWith(appRoot)).map(f=>fs.readFileSync(f,'utf8')).join('\n')
assert.ok(!frontend.includes('127.0.0.1:3000'),'old HTTP backend dependency')
assert.ok(!frontend.includes('next-auth'),'old auth dependency')
console.log('PASS: JavaScript / JSON syntax, ' + app.pages.length + ' page routes, components, WXML handlers, shared validation and independent cloud architecture.')
