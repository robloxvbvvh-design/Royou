require('http').createServer((q, r) => { r.writeHead(200, { 'content-type': 'application/json' });
  r.end(JSON.stringify({ results: [
    { title: 'Солнечная система', url: 'https://example.org/solar', content: 'В Солнечной системе восемь планет. Самая большая планета Солнечной системы — Юпитер, а самая маленькая — Меркурий. Плутон в 2006 году отнесли к карликовым планетам.' },
    { title: 'Планеты', url: 'https://example.org/planets', content: 'Планеты делятся на земную группу и газовые гиганты. Земля — третья планета от Солнца.' } ] })); }).listen(4020);
