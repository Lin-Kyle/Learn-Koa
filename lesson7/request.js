const stringify = require('url').format;
const net = require('net');
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
/* 
  https://www.npmjs.com/package/url
  这个模块具有与node.js核心URL模块相同的URL解析和解析工具。 
*/
const URL = require('url').URL;
/* 
  https://www.npmjs.com/package/parseurl
  Parse a URL with memoization 
*/
const parse = require('parseurl');
/* 
  https://www.npmjs.com/package/querystringjs
  一个查询字符串解析实用程序，可以正确处理一些边界情况。当您想要正确地处理查询字符串时，请使用此选项。 
*/
const qs = require('querystring');
/* 
  https://www.npmjs.com/package/fresh
  HTTP响应测试 
*/
const fresh = require('fresh');

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

  // 缓存解析后的URL
  get URL() {
    /* 
      istanbul ignore else 
      */
    if (!this.memoizedURL) {
      const originalUrl = this.originalUrl || ''; // avoid undefined in template string
      try {
        this.memoizedURL = new URL(`${this.origin}${originalUrl}`);
      } catch (err) {
        this.memoizedURL = Object.create(null);
      }
    }
    return this.memoizedURL;
  },

  get url() {
    return this.req.url;
  },

  set url(val) {
    this.req.url = val;
  },

  // 当使用TLS请求返回http或者https协议字符串,当代理设置"X-Forwarded-Proto"头会被信任,如果你正在启用一个http反向代理这将被启动
  get protocol() {
    if (this.socket.encrypted) return 'https';
    if (!this.app.proxy) return 'http';
    const proto = this.get('X-Forwarded-Proto');
    return proto ? proto.split(/\s*,\s*/, 1)[0] : 'http';
  },

  // 是否https
  get secure() {
    return 'https' === this.protocol;
  },

  // 解析Host头,当启动代理支持X-Forwarded-Host
  get host() {
    const proxy = this.app.proxy;
    let host = proxy && this.get('X-Forwarded-Host');
    if (!host) {
      if (this.req.httpVersionMajor >= 2) host = this.get(':authority');
      if (!host) host = this.get('Host');
    }
    if (!host) return '';
    return host.split(/\s*,\s*/, 1)[0];
  },

  get hostname() {
    const host = this.host;
    if (!host) return '';
    if ('[' === host[0]) return this.URL.hostname || ''; // IPv6
    return host.split(':', 1)[0];
  },

  /* 
    返回数组类型子域名
  
    子域名是主机在主域名之前以点分隔的部分
    应用程序的域。默认情况下，应用程序的域是最后两个域
    主机的一部分。这可以通过设置“app.subdomainOffset”来改变。
  
    例如，如果域名是“tobi.ferrets.example.com”:
    如果app.subdomainOffset没有设置。子域是["ferrets", "tobi"]
    如果app.subdomainOffset是3。子域["tobi"]。 
  */
  get subdomains() {
    const offset = this.app.subdomainOffset;
    const hostname = this.hostname;
    if (net.isIP(hostname)) return [];
    return hostname
      .split('.')
      .reverse()
      .slice(offset);
  },

  get origin() {
    return `${this.protocol}://${this.host}`;
  },

  get href() {
    // support: `GET http://example.com/foo`
    if (/^https?:\/\//i.test(this.originalUrl)) return this.originalUrl;
    return this.origin + this.originalUrl;
  },

  get path() {
    return parse(this.req).pathname;
  },

  set path(path) {
    const url = parse(this.req);
    if (url.pathname === path) return;

    url.pathname = path;
    url.path = null;

    this.url = stringify(url);
  },

  get querystring() {
    if (!this.req) return '';
    return parse(this.req).query || '';
  },

  set querystring(str) {
    const url = parse(this.req);
    if (url.search === `?${str}`) return;

    url.search = str;
    url.path = null;

    this.url = stringify(url);
  },

  get query() {
    const str = this.querystring;
    const c = this._querycache = this._querycache || {};
    return c[str] || (c[str] = qs.parse(str));
  },

  set query(obj) {
    this.querystring = qs.stringify(obj);
  },

  get search() {
    if (!this.querystring) return '';
    return `?${this.querystring}`;
  },

  set search(str) {
    this.querystring = str;
  },

  // 检查请求是否最新,Last-Modified或者ETag是否匹配
  get fresh() {
    const method = this.method;
    const s = this.ctx.status;

    // GET or HEAD for weak freshness validation only
    if ('GET' !== method && 'HEAD' !== method) return false;

    // 2xx or 304 as per rfc2616 14.26
    if ((s >= 200 && s < 300) || 304 === s) {
      return fresh(this.header, this.response.header);
    }

    return false;
  },

  // 检查是否旧请求,Last-Modified或者ETag是否改变
  get stale() {
    return !this.fresh;
  },
}