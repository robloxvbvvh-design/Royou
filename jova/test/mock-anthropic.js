// Поддельный Anthropic API для проверки конвейера без ключа. НЕ часть продукта.
const http = require('http');
const sse = (res, ev, d) => res.write(`event: ${ev}\ndata: ${JSON.stringify({ type: ev, ...d })}\n\n`);
http.createServer((req, res) => {
  let s = ''; req.on('data', c => s += c); req.on('end', () => {
    const b = JSON.parse(s), last = b.messages[b.messages.length - 1];
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    sse(res, 'message_start', { message: { usage: { input_tokens: 100 } } });
    const toolResult = Array.isArray(last.content) && last.content.find(c => c.type === 'tool_result');
    const txt = typeof last.content === 'string' ? last.content : '';
    if (toolResult) {
      sse(res, 'content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
      sse(res, 'content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'Готово: ' + toolResult.content } });
      sse(res, 'message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 20 } });
    } else if (/файл/.test(txt) && b.tools) {
      sse(res, 'content_block_start', { index: 0, content_block: { type: 'tool_use', id: 't1', name: 'write_file', input: {} } });
      sse(res, 'content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: '{"path":"hello/a.js",' } });
      sse(res, 'content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: '"content":"console.log(1)"}' } });
      sse(res, 'message_delta', { delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 30 } });
    } else {
      sse(res, 'content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
      ['При', 'вет! ', 'model=' + b.model].forEach(t => sse(res, 'content_block_delta', { index: 0, delta: { type: 'text_delta', text: t } }));
      sse(res, 'message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } });
    }
    res.end();
  });
}).listen(4010);
