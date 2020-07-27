const Koa = require('./application');
const app = new Koa();

app.use(async (ctx, next) => {
  console.log('middleware1 start')
  await next();
  console.log('middleware1 end')
});

app.use(async (ctx, next) => {
  console.log('middleware2 start')
  await next();
  console.log('middleware2 end')
});

app.use(async ctx => {
  ctx.body = '级联(洋葱圈模型及中间件传递)'
});

app.listen(3000); 