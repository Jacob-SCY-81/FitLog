/**
 * 中国大陆手机号规范化与校验工具
 * 
 * 规范：
 * 1. 中国大陆 11 位移动电话号码；
 * 2. 号段以 1 开头，第二位为 3-9 (符合最新工信部号段)；
 * 3. 统一清洗空格、短横线及国际字冠；
 * 4. 服务端最终入库与缓存标准输出统一为 E.164 格式：+8613800138000。
 */

const MAINLAND_MOBILE_REGEX = /^1[3-9]\d{9}$/;

/**
 * 清洗输入字符串中的常见分隔符与前缀，提取纯数字主体
 * @param {any} input 
 * @returns {string} 纯数字字符串
 */
function cleanDigits(input) {
  if (typeof input !== 'string') return '';
  let str = input.trim().replace(/[\s\-_]/g, '');
  // 去除可能携带的国际冠字或区号前缀
  if (str.startsWith('+86')) {
    str = str.slice(3);
  } else if (str.startsWith('0086')) {
    str = str.slice(4);
  } else if (str.startsWith('86') && str.length === 13) {
    str = str.slice(2);
  }
  return str;
}

/**
 * 校验是否为合法中国大陆手机号
 * @param {any} input 
 * @returns {boolean}
 */
export function isValidMainlandMobile(input) {
  const digits = cleanDigits(input);
  return MAINLAND_MOBILE_REGEX.test(digits);
}

/**
 * 规范化中国大陆手机号为 +86138xxxxxxxx
 * 若不合法则抛出带有 HTTP 400 状态码的明确异常
 * @param {any} input 
 * @returns {string} 规范化后的手机号，如 "+8613800138000"
 */
export function normalizePhone(input) {
  if (!input || typeof input !== 'string') {
    const err = new Error('手机号不能为空');
    err.statusCode = 400;
    err.errorCode = 'PHONE_REQUIRED';
    throw err;
  }

  const digits = cleanDigits(input);
  if (!MAINLAND_MOBILE_REGEX.test(digits)) {
    const err = new Error('请输入有效的11位中国大陆手机号');
    err.statusCode = 400;
    err.errorCode = 'INVALID_PHONE_NUMBER';
    throw err;
  }

  return `+86${digits}`;
}

/**
 * 安全尝试规范化手机号，不抛出异常
 * @param {any} input 
 * @returns {string|null} 规范化手机号或 null
 */
export function tryNormalizePhone(input) {
  try {
    return normalizePhone(input);
  } catch {
    return null;
  }
}
