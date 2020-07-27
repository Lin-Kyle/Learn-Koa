const Koa = require('./application');
const app = new Koa();

app.use(ctx => {
  console.log('middleware1')
}).use(ctx => {
  ctx.res.end('上下文(Context)')
});

app.listen(3000); 