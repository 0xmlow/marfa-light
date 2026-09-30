#!/usr/bin/env node
// site/page.html is site/index.html without the document wrapper (the form a
// hosted artifact wants). Run after editing index.html so the two never drift.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'site', 'index.html'), 'utf8');
const body = src.slice(src.indexOf('<title>'), src.lastIndexOf('</body>'))
  .replace(/<\/head>\s*<body>\s*/, '\n');
fs.writeFileSync(path.join(ROOT, 'site', 'page.html'), body.trimEnd() + '\n');
console.log('wrote site/page.html', body.length, 'bytes');
