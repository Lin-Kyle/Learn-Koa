const Koa = require('./application');
const app = new Koa();

app.use((req, res) => {
  console.log('middleware1')
}).use((req, res) => {
  res.end('构建Application')
});

app.listen(3000); 