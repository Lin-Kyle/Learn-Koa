const http = require('http')
const compose = require('./compose');
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
    // 将启动回调抽离
    const server = http.createServer(this.callback())
    server.listen(...args)
  }

  // 启动回调
  callback() {
    // 洋葱圈模型流程控制的核心,下面详解
    const fn = compose(this.middlewares)

    return (req, res) => {
      // 强制中间件重新实现新上下文
      const ctx = this.createContext(req, res)
      return this.hadnleRequest(ctx, fn)
    }
  }

  // 回调请求
  hadnleRequest(ctx, fnMiddleware) {
    // 响应处理
    const handleResoponse = () => respond(ctx)
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

// 响应增强
function respond(ctx) {
  const res = ctx.res
  let body = ctx.body
  body = JSON.stringify(body)
  res.end(body)
}

module.exports = Koa