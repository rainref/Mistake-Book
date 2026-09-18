const fs=require('node:fs')
const path=require('node:path')
const {spawnSync}=require('node:child_process')
const root=path.resolve(__dirname,'..')
const app=path.join(root,'miniprogram')
const compiler=process.argv[2] || 'C:/Program Files (x86)/Tencent/微信web开发者工具/resources/app.asar.unpacked/node_modules/wcc-exec'
const artifacts=path.join(root,'.verification')
fs.mkdirSync(artifacts,{recursive:true})
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
for(const [exe,ext,output] of [['wcc.exe','.wxml','wxml.js'],['wcsc.exe','.wxss','wxss.js']]){
 const files=walk(app).filter(f=>f.endsWith(ext)).map(f=>path.relative(app,f).replace(/\\/g,'/'))
 const result=spawnSync(path.join(compiler,exe),['-o',path.join(artifacts,output),...files],{cwd:app,encoding:'utf8',windowsHide:true})
 if(result.error)throw result.error
 if(result.status!==0){console.error(result.stderr||result.stdout);process.exit(result.status||1)}
 if(result.stderr)console.log(result.stderr.trim())
 console.log('PASS: official '+exe+' compiled '+files.length+' '+ext+' files')
}
