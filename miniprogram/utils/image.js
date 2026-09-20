async function pick() {
  const result = await new Promise((resolve, reject) => wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['camera', 'album'], sizeType: ['compressed'], success: resolve, fail: reject }))
  return result.tempFiles[0].tempFilePath
}
// 调起微信原生编辑界面（自由裁剪/旋转/涂鸦），返回编辑后的图片；旧版基础库或用户取消时退回原图
async function edit(filePath) {
  if (typeof wx.editImage !== 'function') return filePath
  try { return (await new Promise((resolve, reject) => wx.editImage({ src: filePath, success: resolve, fail: reject }))).tempFilePath }
  catch (_) { return filePath }
}
async function prepare(filePath) {
  try { filePath = (await new Promise((resolve, reject) => wx.compressImage({ src: filePath, quality: 65, compressedWidth: 1600, success: resolve, fail: reject }))).tempFilePath } catch (_) {}
  const file = await new Promise((resolve, reject) => wx.getFileSystemManager().readFile({ filePath, success: resolve, fail: reject }))
  if (file.data.byteLength > 3 * 1024 * 1024) throw new Error('图片压缩后仍超过 3 MB，请裁剪到单道题再上传')
  const bytes = new Uint8Array(file.data)
  const extension = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'png' : bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpg' : ''
  if (!extension) throw new Error('请选择 JPG 或 PNG 格式的题目图片')
  return { filePath, extension }
}
async function choose() { return prepare(await edit(await pick())) }
module.exports = { choose, pick, edit, prepare }
