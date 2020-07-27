const Cookies = require('cookies');
const util = require('util');
/* 
  Create HTTP errors for Express, Koa, Connect, etc. with ease.
  https://github.com/jshttp/http-errors
*/
const createError = require('http-errors');
/* 
  Assert with status codes. Like ctx.throw() in Koa, but with a guard.
  https://github.com/jshttp/http-assert
*/
const httpAssert = require('http-assert');
/* 
  HTTP status utility for node.
  This module provides a list of status codes and messages sourced from a few different projects:
  https://github.com/jshttp/statuses
*/
const statuses = require('statuses');
/* 
  Node method and accessor delegation utilty.
  https://github.com/tj/node-delegates
*/
const delegate = require('delegates');

// symbol值作为对象属性的标识符
const COOKIES = Symbol('context#cookies');

// 赋值
const proto = module.exports = {
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
  },

  /* 
    The API of this module is intended to be similar to the Node.js assert module.
    Each function will throw an instance of HttpError from the http-errors module when the assertion fails.
    * @param {Mixed} test
    * @param {Number} status
    * @param {String} message
    * @api public
  */
  assert: httpAssert,

  /* 
    * @param {String|Number|Error} err, msg or status
    * @param {String|Number|Error} [err, msg or status]
    * @param {Object} [props]
    * @api public
  */
  throw(...args) {
    throw createError(...args);
  },

  onerror(err) {
    // 这里之所以没用全等,我觉得可能是因为双等下null == undefined 也返回true
    if (null == err) return

    const isNativeError = Object.prototype.toString.call(err) === '[object Error]' || err instanceof Error;
    // 创建一个格式化后的字符串，使用第一个参数作为一个类似 printf 的格式的字符串，该字符串可以包含零个或多个格式占位符。 每个占位符会被对应参数转换后的值所替换
    if (!isNativeError) err = new Error(util.format('non-error thrown: %j', err))

    let headerSent = false;
    if (this.headerSent || !this.writable) {
      headerSent = err.headerSent = true;
    }

    // delegate
    this.app.emit('error', err, this);

    // 在这里我们做不了任何事情,将其委托给应用层级的处理程序和日志
    if (headerSent) {
      return;
    }

    const { res } = this;
    // 清除头字段
    if (typeof res.getHeaderNames === 'function') {
      res.getHeaderNames().forEach(name => res.removeHeader(name));
    } else {
      res._headers = {}; // Node < 7.7
    }
    // 设置指定的
    this.set(err.headers);
    // 强制text/plain
    this.type = 'text';

    let statusCode = err.status || err.statusCode;
    // ENOENT support
    if ('ENOENT' === err.code) statusCode = 404;
    // default to 500
    if ('number' !== typeof statusCode || !statuses[statusCode]) statusCode = 500;
    // respond
    const code = statuses[statusCode];
    const msg = err.expose ? err.message : code;
    this.status = err.status = statusCode;
    this.length = Buffer.byteLength(msg);
    res.end(msg);
  },

  inspect() {
    if (this === proto) return this;
    return this.toJSON();
  },

  // 这里我们在每个对象上显式地调用. tojson()，否则迭代将由于getter而失败，并导致诸如clone()之类的实用程序失败。
  toJSON() {
    return {
      request: this.request.toJSON(),
      response: this.response.toJSON(),
      app: this.app.toJSON(),
      originalUrl: this.originalUrl,
      req: '<original node req>',
      res: '<original node res>',
      socket: '<original node socket>'
    };
  },
}

/**
 * Response delegation.
 */
delegate(proto, 'response')
  .method('attachment')
  .method('redirect')
  .method('remove')
  .method('vary')
  .method('has')
  .method('set')
  .method('append')
  .method('flushHeaders')
  .access('status')
  .access('message')
  .access('body')
  .access('length')
  .access('type')
  .access('lastModified')
  .access('etag')
  .getter('headerSent')
  .getter('writable');

/**
 * Request delegation.
 */
delegate(proto, 'request')
  .method('acceptsLanguages')
  .method('acceptsEncodings')
  .method('acceptsCharsets')
  .method('accepts')
  .method('get')
  .method('is')
  .access('querystring')
  .access('idempotent')
  .access('socket')
  .access('search')
  .access('method')
  .access('query')
  .access('path')
  .access('url')
  .access('accept')
  .getter('origin')
  .getter('href')
  .getter('subdomains')
  .getter('protocol')
  .getter('host')
  .getter('hostname')
  .getter('URL')
  .getter('header')
  .getter('headers')
  .getter('secure')
  .getter('stale')
  .getter('fresh')
  .getter('ips')
  .getter('ip');