const http = require('http')
const Stream = require('stream');
const compose = require('./compose');
const context = require('./context')
const request = require('./request')
const response = require('./response')
/* 
  A tiny JavaScript debugging utility modelled after Node.js core's debugging technique. Works in Node.js and web browsers.
  https://github.com/visionmedia/debug
*/
const debug = require('debug')('koa:application');
/* 
  Is this a native generator function?
  https://github.com/inspect-js/is-generator-function
*/
const isGeneratorFunction = require('is-generator-function');
/* 
  Convert koa legacy ( 0.x & 1.x ) generator middleware to modern promise middleware ( 2.x ).
  https://github.com/koajs/convert
 */
const convert = require('koa-convert');
const deprecate = require('depd')('koa');
/* 
  Execute a callback when a HTTP request closes, finishes, or errors.
  https://www.npmjs.com/package/on-finished
*/
const onFinished = require('on-finished');
/* 
  HTTP status utility for node.
  This module provides a list of status codes and messages sourced from a few different projects:
  https://www.npmjs.com/package/statuses
*/
const statuses = require('statuses');
/* 
  https://www.npmjs.com/package/only
  返回对象的白名单属性。 
*/
const only = require('only');


class Koa {

  /**
  * @param {object} [options] Application options
  * @param {string} [options.env='development'] Environment
  * @param {string[]} [options.keys] Signed cookie keys
  * @param {boolean} [options.proxy] Trust proxy headers
  * @param {number} [options.subdomainOffset] Subdomain offset
  * @param {boolean} [options.proxyIpHeader] proxy ip header, default to X-Forwarded-For
  * @param {boolean} [options.maxIpsCount] max ips read from proxy ip header, default to 0 (means infinity)
  */
  constructor(options) {
    super();
    // 可选项
    options = options || {};
    // cookies签名
    if (options.keys) this.keys = options.keys;
    // 中间件队列
    this.middlewares = [];
    // 扩展属性
    this.context = Object.create(context);
    this.request = Object.create(request);
    this.response = Object.create(response);
    // 增加配置项
    this.proxy = options.proxy || false;
    this.subdomainOffset = options.subdomainOffset || 2;
    this.proxyIpHeader = options.proxyIpHeader || 'X-Forwarded-For';
    this.maxIpsCount = options.maxIpsCount || 0;
    this.env = options.env || process.env.NODE_ENV || 'development';
  }

  // 启动服务器
  listen(...args) {
    debug('listen');
    // 将启动回调抽离
    const server = http.createServer(this.callback())
    server.listen(...args)
  }

  // 启动回调
  callback() {
    // 洋葱圈模型流程控制的核心,下面详解
    const fn = compose(this.middlewares)

    // 增加监听事件
    if (!this.listenerCount('error')) this.on('error', this.onerror);

    return (req, res) => {
      // 强制中间件重新实现新上下文
      const ctx = this.createContext(req, res)
      return this.hadnleRequest(ctx, fn)
    }
  }

  // 回调请求
  hadnleRequest(ctx, fnMiddleware) {
    const res = ctx.res;
    res.statusCode = 404;
    const onerror = err => ctx.onerror(err);
    // 响应处理
    const handleResoponse = () => respond(ctx)
    onFinished(res, onerror);
    return fnMiddleware(ctx).then(handleResoponse)
  }

  // 创建上下文
  createContext(req, res) {
    // 扩展对象
    const context = Object.create(this.context)
    const request = context.request = Object.create(this.request)
    const response = context.response = Object.create(this.response)

    // 关联实例,请求体,响应体
    context.app = request.app = response.app = this
    context.req = request.req = response.req = req
    context.res = request.res = response.res = res
    request.ctx = response.ctx = context;
    request.response = response
    response.request = request

    // 赋值url
    context.originalUrl = request.originalUrl = req.url
    // 上下文状态
    context.state = {}
    return context
  }

  // 添加中间件
  use(fn) {
    if (typeof fn !== 'function') throw new TypeError('middleware must be a function!');
    if (isGeneratorFunction(fn)) {
      deprecate('Support for generators will be removed in v3. ' +
        'See the documentation for examples of how to convert old middleware ' +
        'https://github.com/koajs/koa/blob/master/docs/migration.md');
      fn = convert(fn);
    }
    debug('use %s', fn._name || fn.name || '-');
    this.middlewares.push(fn)
    return this
  }

  onerror(err) {
    // When dealing with cross-globals a normal `instanceof` check doesn't work properly.
    // See https://github.com/koajs/koa/issues/1466
    // We can probably remove it once jest fixes https://github.com/facebook/jest/issues/2549.
    const isNativeError =
      Object.prototype.toString.call(err) === '[object Error]' ||
      err instanceof Error;
    if (!isNativeError) throw new TypeError(util.format('non-error thrown: %j', err));

    if (404 === err.status || err.expose) return;
    if (this.silent) return;

    const msg = err.stack || err.toString();
    console.error(`\n${msg.replace(/^/gm, '  ')}\n`);
  }

  toJSON() {
    return only(this, [
      'subdomainOffset',
      'proxy',
      'env'
    ]);
  }

  inspect() {
    return this.toJSON();
  }
};

// 响应增强
function respond(ctx) {

  // allow bypassing koa
  if (false === ctx.respond) return;

  if (!ctx.writable) return;

  const res = ctx.res
  let body = ctx.body
  const code = ctx.status;

  // 如果状态码需要一个空的主体
  if (statuses.empty[code]) {
    // strip headers
    ctx.body = null;
    return res.end();
  }

  if ('HEAD' === ctx.method) {
    if (!res.headersSent && !ctx.response.has('Content-Length')) {
      const { length } = ctx.response;
      if (Number.isInteger(length)) ctx.length = length;
    }
    return res.end();
  }

  // status body
  if (null == body) {
    if (ctx.response._explicitNullBody) {
      ctx.response.remove('Content-Type');
      ctx.response.remove('Transfer-Encoding');
      return res.end();
    }
    if (ctx.req.httpVersionMajor >= 2) {
      body = String(code);
    } else {
      body = ctx.message || String(code);
    }
    if (!res.headersSent) {
      ctx.type = 'text';
      ctx.length = Buffer.byteLength(body);
    }
    return res.end(body);
  }

  // responses
  if (Buffer.isBuffer(body)) return res.end(body);
  if ('string' === typeof body) return res.end(body);
  if (body instanceof Stream) return body.pipe(res);

  body = JSON.stringify(body)
  if (!res.headersSent) {
    ctx.length = Buffer.byteLength(body);
  }
  res.end(body)
}

module.exports = Koa