// 仅整理云调用传输层错误，不记录用户题目、图片或作答数据。
function cloudError(cause, env, functionName) {
  const raw = String(cause?.errMsg || cause?.message || '')
  const value = cause?.errCode ?? cause?.code
  const code = typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, 80) : ''
  let message
  if (/FUNCTION_NOT_FOUND|function\s+.{0,100}(?:not found|does not exist|not exist)/i.test(raw)) {
    message = '当前云环境中未找到 ' + functionName + ' 云函数。请右键 cloudfunctions/' + functionName + '，选择“上传并部署：云端安装依赖”。'
  } else if (/ENV_NOT_FOUND|INVALID_ENV|environment\s+.{0,100}(?:not found|does not exist|not exist)/i.test(raw)) {
    message = '云环境不存在或不可用，请核对环境 ID：' + env + '，并确认该环境已关联当前小程序。'
  } else if (/permission denied|PERMISSION_DENIED|unauthorized|not authorized/i.test(raw)) {
    message = '云调用权限不足，请确认当前小程序 AppID 已关联此云环境，且当前开发者拥有访问权限。'
  } else if (/timeout|timed out|TIME_LIMIT_EXCEEDED/i.test(raw)) {
    message = '云函数调用超时：识题等 AI 请求耗时较长（通常 20–50 秒），而云端函数执行超时常见为默认 20 秒。请在云开发控制台将 ' + functionName + ' 云函数的超时时间调大到 60 秒后重新部署；若当前使用的是开发者工具「本地调试」云函数，其超时固定为 20 秒，请改为云端调用后重试。'
  } else {
    message = '云函数连接失败：无法调用 ' + functionName + '。请确认它已部署到环境 ' + env + '，然后查看开发者工具控制台中的具体报错。'
  }
  if (code) message += '\n错误码：' + code
  const error = new Error(message)
  error.code = code || 'CLOUD_CALL_FAILED'
  // 常见凭据字段作脱敏，仅将传输错误用于开发者控制台排查。
  const safeMessage = raw.replace(/((?:api[_-]?key|authorization|password|secret|token)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]').slice(0, 1200)
  error.diagnostic = { env, functionName, code: error.code, message: safeMessage }
  return error
}
module.exports = { cloudError }
