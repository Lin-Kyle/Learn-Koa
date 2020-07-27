const Cookies = require('cookies');

// symbol值作为对象属性的标识符
const COOKIES = Symbol('context#cookies');

module.exports = {
  get cookies() {
    if (!this[COOKIES]) {
      this[COOKIES] = new Cookies(this.req, this.res, {
        // 使用凭证启用基于SHA1 HMAC的加密签名
        keys: this.app.keys,
        // 明确指定连接是否安全，而不是此模块检查请求
        secure: this.requset.secure
      })
    }
    return this[COOKIES]
  },

  set cookies(_cookies) {
    this[COOKIES] = _cookies
  }
}