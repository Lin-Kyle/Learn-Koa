const http = require('http')

class Koa {

  constructor() {
    // 中间件队列
    this.middlewares = []
  }

  // 启动服务器
  listen(...args) {
    const server = http.createServer((req, res) => {
      // 先遍历执行
      this.middlewares.forEach(middleware => middleware(req, res))
    })
    return server.listen(...args)
  }

  // 添加中间件
  use(middleware) {
    this.middlewares.push(middleware)
    // 返回链式调用
    return this
  }

}

module.exports = Koa