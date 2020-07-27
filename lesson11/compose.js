function compose(middleware) {
  return (context, next) => {
    // 最后一个被执行的中间件
    let index = -1
    // 开始执行
    return dispatch(0)
    function dispatch(i) {
      // 防止多次执行
      if (i <= index) return Promise.reject(new Error('next() called multiple times'))
      // 当前赋值
      index = i
      const fn = middleware[i]
      // 执行到最后一个中间件时正常不应该执行next,这时候next=undefined,即使有调用后续也有容错处理
      if (i === middleware.length) fn = next
      // 如果没有声明next则终止执行,开始回溯执行
      if (!fn) return Promise.resolve()
      try {
        // 中间件最终按序执行的代码,并且每个中间件都传递相同的上下文,防止被其中某些中间件改变影响后续执行,next即传入的dispatch.bind(null, i + 1)等于下一个中间件执行函数,因为是Promise函数所以可以利用async await中断让出当前函数控制权往下执行
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)))
      } catch (err) {
        // 容错中断
        return Promise.reject(err)
      }
    }
  }
}

module.exports = compose