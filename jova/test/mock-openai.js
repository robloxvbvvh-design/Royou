// Поддельный OpenAI-совместимый сервис для проверки (НЕ часть продукта).
const http = require('http');
const chunk = (res, o) => res.write('data: ' + JSON.stringify(o) + '\n\n');
http.createServer((req, res) => { let s = ''; req.on('data', c => s += c); req.on('end', () => {
  const b = JSON.parse(s), last = b.messages[b.messages.length - 1];
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  if (last.role === 'tool') {
    for (const t of ['По данным поиска: ', last.content.slice(0, 60)]) chunk(res, { choices: [{ delta: { content: t } }] });
    chunk(res, { choices: [{ delta: {}, finish_reason: 'stop' }] });
  } else if (b.tools && /найди/.test(last.content)) {
    chunk(res, { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'web_search', arguments: '{"query":' } }] } }] });
    chunk(res, { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"планеты"}' } }] } }] });
    chunk(res, { choices: [{ delta: {}, finish_reason: 'tool_calls' }] });
  } else {
    chunk(res, { choices: [{ delta: { content: 'Привет! Модель: ' + b.model + ', системный промпт ' + b.messages[0].content.length + ' симв.' } }] });
    chunk(res, { choices: [{ delta: {}, finish_reason: 'stop' }] });
  }
  chunk(res, { choices: [], usage: { prompt_tokens: 120, completion_tokens: 25 } }); res.write('data: [DONE]\n\n'); res.end(); }); }).listen(4040);
