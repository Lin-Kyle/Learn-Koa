const http = require('http')
const context = require('./context')
const request = require('./request')
const response = require('./response')

class Koa {

  constructor() {
    // 中间件队列
    this.middlewares = [];
    // 扩展属性
    this.context = Object.create(context);
    this.request = Object.create(request);
    this.response = Object.create(response);
  }

  // 启动服务器
  listen(...args) {
    const server = http.createServer((req, res) => {
      const ctx = this.createContext(req, res)
      // 先遍历执行
      this.middlewares.forEach(middleware => middleware(ctx))
    })
    server.listen(...args)
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
    request.response = response
    response.request = request

    // 赋值url
    context.originalUrl = request.originalUrl = req.url
    // 上下文状态
    context.state = {}
    return context
  }

  // 添加中间件
  use(middleware) {
    this.middlewares.push(middleware)
    return this
  }

}

module.exports = Koa