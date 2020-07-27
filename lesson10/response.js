const extname = require('path').extname;
const Stream = require('stream');
/* 
  https://www.npmjs.com/package/only
  Return whitelisted properties of an object.
*/
const only = require('only');
/* 
  https://www.npmjs.com/package/type-is
  Infer the content-type of a request.
*/
const typeis = require('type-is').is;
/* 
  https://www.npmjs.com/package/vary
  Manipulate the HTTP Vary header
*/
const vary = require('vary');
/* 
  https://www.npmjs.com/package/cache-content-type
  The same as mime-types's contentType method, but with result cached.
*/
const getType = require('cache-content-type');
/* 
  https://www.npmjs.com/package/content-disposition
  reate and parse HTTP Content-Disposition header
*/
const contentDisposition = require('content-disposition');
/* 
  https://www.npmjs.com/package/assert
  With browserify, simply require('assert') or use the assert global and you will get this module.
  The goal is to provide an API that is as functionally identical to the Node.js assert API as possible. Read the official docs for API documentation.
*/
const assert = require('assert');
/* 
  https://www.npmjs.com/package/statuses
  HTTP status utility for node.
  This module provides a list of status codes and messages sourced from a few different projects:
*/
const statuses = require('statuses');
/* 
  https://www.npmjs.com/package/on-finished
  Execute a callback when a HTTP request closes, finishes, or errors.
*/
const onFinish = require('on-finished');
/* 
  https://www.npmjs.com/package/destroy
  Destroy a stream.
  This module is meant to ensure a stream gets destroyed, handling different APIs and Node.js bugs.
*/
const destroy = require('destroy');
/* 
  https://www.npmjs.com/package/escape-html
  Escape string for use in HTML
*/
const escape = require('escape-html');
/* 
  https://www.npmjs.com/package/encodeurl
  Encode a URL to a percent-encoded form, excluding already-encoded sequences
*/
const encodeUrl = require('encodeurl');

module.exports = {

  flushHeaders() {
    this.res.flushHeaders();
  },

  inspect() {
    if (!this.res) return;
    const o = this.toJSON();
    o.body = this.body;
    return o;
  },

  toJSON() {
    return only(this, [
      'status',
      'message',
      'header'
    ]);
  },

  get type() {
    const type = this.get('Content-Type');
    if (!type) return '';
    return type.split(';', 1)[0];
  },

  // 返回传入数据是否指定类型之一
  is(type, ...types) {
    return typeis(this.req, type, ...types);
  },

  get header() {
    const { res } = this;
    return typeof res.getHeaders === 'function'
      ? res.getHeaders()
      : res._headers || {}; // Node < 7.7
  },

  get headers() {
    return this.header;
  },

  get(field) {
    return this.header[field.toLowerCase()] || '';
  },

  has(field) {
    return typeof this.res.hasHeader === 'function'
      ? this.res.hasHeader(field)
      // Node < 7.7
      : field.toLowerCase() in this.headers;
  },

  set type(type) {
    type = getType(type);
    if (type) {
      this.set('Content-Type', type);
    } else {
      this.remove('Content-Type');
    }
  },

  attachment(filename, options) {
    // 获取扩展名
    if (filename) this.type = extname(filename);
    // 重设Content-Disposition头字段
    this.set('Content-Disposition', contentDisposition(filename, options));
  },

  get headerSent() {
    return this.res.headersSent;
  },

  // 操纵改变头字段
  vary(field) {
    if (this.headerSent) return;

    vary(this.res, field);
  },

  set(field, val) {
    if (this.headerSent) return;

    if (2 === arguments.length) {
      if (Array.isArray(val)) val = val.map(v => typeof v === 'string' ? v : String(v));
      else if (typeof val !== 'string') val = String(val);
      this.res.setHeader(field, val);
    } else {
      for (const key in field) {
        this.set(key, field[key]);
      }
    }
  },

  append(field, val) {
    const prev = this.get(field);

    if (prev) {
      val = Array.isArray(prev)
        ? prev.concat(val)
        : [prev].concat(val);
    }

    return this.set(field, val);
  },

  remove(field) {
    if (this.headerSent) return;

    this.res.removeHeader(field);
  },

  get status() {
    return this.res.statusCode;
  },

  set status(code) {
    if (this.headerSent) return;
    // 断言
    assert(Number.isInteger(code), 'status code must be a number');
    assert(code >= 100 && code <= 999, `invalid status code: ${code}`);
    // 是否有明确状态
    this._explicitStatus = true;
    // 根据状态码做不同处理
    this.res.statusCode = code;
    if (this.req.httpVersionMajor < 2) this.res.statusMessage = statuses[code];
    if (this.body && statuses.empty[code]) this.body = null;
  },

  get message() {
    return this.res.statusMessage || statuses[this.status];
  },

  set message(msg) {
    this.res.statusMessage = msg;
  },

  get body() {
    return this._body;
  },

  set body(val) {
    const original = this._body;
    this._body = val;

    // no content
    if (null == val) {
      if (!statuses.empty[this.status]) this.status = 204;
      if (val === null) this._explicitNullBody = true;
      this.remove('Content-Type');
      this.remove('Content-Length');
      this.remove('Transfer-Encoding');
      return;
    }

    // set the status
    if (!this._explicitStatus) this.status = 200;

    // set the content-type only if not yet set
    const setType = !this.has('Content-Type');

    // string
    if ('string' === typeof val) {
      if (setType) this.type = /^\s*</.test(val) ? 'html' : 'text';
      this.length = Buffer.byteLength(val);
      return;
    }

    // buffer
    if (Buffer.isBuffer(val)) {
      if (setType) this.type = 'bin';
      this.length = val.length;
      return;
    }

    // stream
    if (val instanceof Stream) {
      // 当请求关闭,完成或者错误都会执行回调,这里是销毁Stream
      onFinish(this.res, destroy.bind(null, val));
      if (original != val) {
        val.once('error', err => this.ctx.onerror(err));
        // overwriting
        if (null != original) this.remove('Content-Length');
      }

      if (setType) this.type = 'bin';
      return;
    }

    // json
    this.remove('Content-Length');
    this.type = 'json';
  },

  set length(n) {
    this.set('Content-Length', n);
  },

  // 根据不同的响应体类型返回准确长度
  get length() {
    if (this.has('Content-Length')) {
      return parseInt(this.get('Content-Length'), 10) || 0;
    }

    const { body } = this;
    if (!body || body instanceof Stream) return undefined;
    if ('string' === typeof body) return Buffer.byteLength(body);
    if (Buffer.isBuffer(body)) return body.length;
    return Buffer.byteLength(JSON.stringify(body));
  },

  get writable() {
    // can't write any more after response finished
    // response.writableEnded is available since Node > 12.9
    // https://nodejs.org/api/http.html#http_response_writableended
    // response.finished is undocumented feature of previous Node versions
    // https://stackoverflow.com/questions/16254385/undocumented-response-finished-in-node-js
    if (this.res.writableEnded || this.res.finished) return false;

    const socket = this.res.socket;
    // There are already pending outgoing res, but still writable
    // https://github.com/nodejs/node/blob/v4.4.7/lib/_http_server.js#L486
    if (!socket) return true;
    return socket.writable;
  },

  redirect(url, alt) {
    // location
    if ('back' === url) url = this.ctx.get('Referrer') || alt || '/';
    this.set('Location', encodeUrl(url));

    // status
    if (!statuses.redirect[this.status]) this.status = 302;

    // html
    if (this.ctx.accepts('html')) {
      url = escape(url);
      this.type = 'text/html; charset=utf-8';
      this.body = `Redirecting to <a href="${url}">${url}</a>.`;
      return;
    }

    // text
    this.type = 'text/plain; charset=utf-8';
    this.body = `Redirecting to ${url}.`;
  },

  set lastModified(val) {
    if ('string' === typeof val) val = new Date(val);
    this.set('Last-Modified', val.toUTCString());
  },

  get lastModified() {
    const date = this.get('last-modified');
    if (date) return new Date(date);
  },

  set etag(val) {
    if (!/^(W\/)?"/.test(val)) val = `"${val}"`;
    this.set('ETag', val);
  },

  get etag() {
    return this.get('ETag');
  },

}