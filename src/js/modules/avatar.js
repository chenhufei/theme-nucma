/**
 * 成员头像与联系邮箱的唯一出口。
 *
 * 自定义头像功能已关闭：成员头像固定取 QQ 头像（q1.qlogo.cn），
 * 认领弹窗与后台表单都不再提供上传入口，插件侧也只写 QQ 头像地址。
 * 保留本模块是为了收敛「QQ 号 → 头像地址 / QQ 邮箱」的拼装规则，
 * 避免模板、脚本、插件三处各写一份字符串格式。
 */

/** 与成员自助申请写入的默认头像保持一致（q1.qlogo.cn s=640）。 */
export function defaultQqAvatar(qq) {
  var value = String(qq == null ? '' : qq).trim();
  if (!value) return '';
  return 'https://q1.qlogo.cn/g?b=qq&nk=' + encodeURIComponent(value) + '&s=640';
}

/** QQ 号 → QQ 邮箱；认领验证码只发这里。 */
export function qqMailbox(qq) {
  var value = String(qq == null ? '' : qq).trim();
  if (!/^\d{5,12}$/.test(value)) return '';
  return value + '@qq.com';
}
