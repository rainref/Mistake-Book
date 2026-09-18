const samples = [
  { sampleKey: 'equation', subject: '数学', chapter: '一元一次方程', grade: '七年级', questionText: '解方程：3(x − 2) = 2x + 5。', answer: 'x = 11', approach: '先去括号，再把含未知数的项移到同一边，最后合并同类项。', steps: ['去括号：3x − 6 = 2x + 5。括号外的 3 要乘到括号内每一项。', '移项：3x − 2x = 5 + 6。移项时改变符号。', '合并同类项：x = 11。代回原方程，两边均为 27。'], knowledgePoints: ['去括号', '移项与变号', '一元一次方程'], pitfalls: ['漏乘括号中的常数项。', '把 −6 移到右边后忘记变成 +6。'], wrongReason: '去括号时只乘了 x，忘记乘 −2。', correction: '重新列式：3x − 6 = 2x + 5，所以 x = 11。', status: 'reviewing' },
  { sampleKey: 'ohm', subject: '物理', chapter: '欧姆定律', grade: '九年级', questionText: '一个电阻两端的电压是 6 V，通过它的电流是 0.3 A。求电阻的阻值。', answer: '20 Ω', approach: '先确认已知量的单位，再由 I = U/R 变形求 R。', steps: ['已知 U = 6 V，I = 0.3 A，单位已经统一。', '由欧姆定律 I = U/R，得 R = U/I。', '代入：R = 6 ÷ 0.3 = 20 Ω。'], knowledgePoints: ['欧姆定律', '公式变形'], pitfalls: ['误把 R 写成 U × I。', '忽略电流单位 mA 与 A 的换算。'], wrongReason: '', correction: '', status: 'new' },
  { sampleKey: 'english', subject: '英语', chapter: '现在完成时', grade: '八年级', questionText: '用括号内动词的适当形式填空：She ____ (live) here since 2020.', answer: 'has lived', approach: 'since 引导过去的时间起点，表示持续到现在的状态，使用现在完成时。', steps: ['识别时间标志 since 2020。', '主语 She 是第三人称单数，助动词使用 has。', 'live 的过去分词是 lived，所以填 has lived。'], knowledgePoints: ['现在完成时', 'since 与 for'], pitfalls: ['把表示持续至今的动作写成一般过去时。', '主语是 She 时误用 have。'], wrongReason: '', correction: '', status: 'mastered' }
]
function practiceBank(key) {
  if (key === 'equation') return [ [2, 1, 4], [4, 2, 1], [5, 1, 7], [3, 4, 6], [6, 2, 8] ].map(([a,b,c], index) => ({
    id: 'q' + (index + 1), questionText: '解方程：' + a + '(x − ' + b + ') = ' + (a - 1) + 'x + ' + c + '。',
    answer: 'x = ' + (a * b + c), hint: '去括号时，让括号外的数乘到每一项。', knowledgePoints: ['一元一次方程', '去括号', '移项与变号'],
    steps: ['去括号：' + a + 'x − ' + (a*b) + ' = ' + (a-1) + 'x + ' + c + '。', '移项合并：x = ' + c + ' + ' + (a*b) + ' = ' + (a*b+c) + '。', '把求得的 x 代回原方程检查。']
  }))
  if (key === 'ohm') return [[12,0.4],[9,0.3],[4,0.2],[10,0.5],[6,0.2]].map(([u,i],index) => ({
    id: 'q' + (index+1), questionText: '某电阻两端电压为 ' + u + ' V，通过电流为 ' + i + ' A，求电阻。', answer: (u/i) + ' Ω',
    hint: '根据 I = U/R 变形。', knowledgePoints: ['欧姆定律', '公式变形'], steps: ['电压和电流已经使用国际单位。','R = U/I = ' + u + ' ÷ ' + i + ' = ' + (u/i) + ' Ω。']
  }))
  if (key === 'english') return [
    ['He ____ (work) here since 2021.', 'has worked', '主语 He 用 has；work 的过去分词为 worked。'],
    ['We ____ (know) each other for five years.', 'have known', '主语 We 用 have；know 的过去分词为 known。'],
    ['I ____ (live) in this city since 2019.', 'have lived', '主语 I 用 have；live 的过去分词为 lived。'],
    ['They ____ (be) friends for ten years.', 'have been', '主语 They 用 have；be 的过去分词为 been。'],
    ['She ____ (teach) English since 2018.', 'has taught', '主语 She 用 has；teach 的过去分词为 taught。']
  ].map(([questionText,answer,step],index) => ({id:'q'+(index+1),questionText,answer,hint:'注意 since / for 表示持续至今的时间。',knowledgePoints:['现在完成时','since 与 for'],steps:['动作或状态从过去持续到现在，使用现在完成时。',step]}))
  return []
}
module.exports = { samples, practiceBank }
