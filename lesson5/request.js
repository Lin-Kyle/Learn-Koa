/* 
  https://www.npmjs.com/package/only
  返回对象的白名单属性。 
*/
const only = require('only');
/* 
  https://www.npmjs.com/package/accepts
  基于negotiator的高级内容协商,从koa提取用于常规使用 
*/
const accepts = require('accepts');
/* 
  https://www.npmjs.com/package/typeis
  类型检查 
*/
const typeis = require('type-is');
/* 
  https://www.npmjs.com/package/content-type
  根据RFC 7231创建解析HTTP Content-Type头 
*/
const contentType = require('content-type');


module.exports = {

  // 检查实施
  inspect() {
    if (!this.req) return;
    return this.toJSON();
  },

  // 返回的指定配置的JSON表示数据
  toJSON() {
    return only(this, [
      'method',
      'url',
      'header'
    ]);
  },

  get header() {
    return this.req.headers
  },

  set header(val) {
    this.req.headers = val
  },

  // 同上效用,
  get headers() {
    return this.req.headers
  },

  set headers(val) {
    this.req.headers = val
  },

  // 返回对给定请求头值
  get(field) {
    const req = this.req;
    switch (field = field.toLowerCase()) {
      case 'referer':
      case 'referrer':
        return req.headers.referrer || req.headers.referer || '';
      default:
        return req.headers[field] || '';
    }
  },

  // 获取字符编码
  get charset() {
    try {
      const { parameters } = contentType.parse(this.req);
      return parameters.charset || '';
    } catch (e) {
      return '';
    }
  },

  // 返回解析后的内容长度
  get length() {
    const len = this.get('Content-Length');
    if (len === '') return;
    return ~~len;
  },

  /* 
    检查给定的“类型”是否可以接受，返回最佳匹配时为真，否则为假，其中情况你应该回应406“不可接受”。 
  */
  accepts(...args) {
    return this.accept.types(...args);
  },

  get accept() {
    return this._accept || (this._accept = accepts(this.req));
  },

  set accept(obj) {
    this._accept = obj;
  },

  // 根据“encodings”返回已接受的编码或最适合的编码(Accept-Encoding: gzip, deflate),返回['gzip', 'deflate']
  acceptsEncodings(...args) {
    return this.accept.encodings(...args);
  },

  // 根据“charsets”返回已接受的字符集或最适合的字符集(Accept-Charset: utf-8, iso-8859-1;q=0.2, utf-7;q=0.5), 返回['utf-8', 'utf-7', 'iso-8859-1']
  acceptsCharsets(...args) {
    return this.accept.charsets(...args);
  },

  // 根据“Language”返回已接受的语言或最适合的语言(Accept-Language: en;q=0.8, es, pt), 返回['es', 'pt', 'en']
  acceptsLanguages(...args) {
    return this.accept.languages(...args);
  },

  /* 
    检查进来的请求是否包含Content-Type头,其中是否包含给定的mime类型
      如果没有请求体,返回null
      如果没有内容类型, 返回false
      其他,返回第一个匹配的类型 
  */
  is(type, ...types) {
    return typeis(this.req, type, ...types);
  },

  // 返回请求mime类型void, 参数如“字符集”。
  get type() {
    const type = this.get('Content-Type');
    if (!type) return '';
    return type.split(';')[0];
  },

  get method() {
    return this.req.method;
  },

  set method(val) {
    this.req.method = val;
  },

  // 检查请求是否idempotent
  get idempotent() {
    const methods = ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE'];
    return !!~methods.indexOf(this.method);
  },
}