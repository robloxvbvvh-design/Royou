// Собирает одну HTML-страницу из трёх частей сайта: HTML, CSS и JS.
// Файл используется и в браузере (предпросмотр), и на сервере (публикация).
(function (root) {
  function composeSite(site) {
    var html = String(site.html || '');
    var style = site.css ? '<style>\n' + site.css + '\n</style>' : '';
    var script = site.js ? '<script>\n' + site.js + '\n</script>' : '';

    if (/<html[\s>]/i.test(html)) {
      html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, style + '</head>') : style + html;
      html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, script + '</body>') : html + script;
      return html;
    }

    var title = String(site.name || 'Мой сайт').replace(/[<>&]/g, '');
    return (
      '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + title + '</title>\n' + style + '\n</head>\n<body>\n' +
      html + '\n' + script + '\n</body>\n</html>'
    );
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { composeSite: composeSite };
  else root.composeSite = composeSite;
})(this);
