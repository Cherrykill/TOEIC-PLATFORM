// Ghép dashboard.html (shell) với các file partials/ theo marker <!-- @include('partials/x.html') -->.
// Đọc lại mỗi request (admin dashboard ít traffic, không cần cache) để luôn phản ánh file mới nhất.
const fs = require('fs');
const path = require('path');

const ADMIN_DIR = path.join(__dirname, '..', 'public', 'admin');
const SHELL_PATH = path.join(ADMIN_DIR, 'dashboard.html');
const INCLUDE_RE = /^(\s*)<!-- @include\('(.+?)'\) -->$/;

function renderAdminDashboard() {
  const shell = fs.readFileSync(SHELL_PATH, 'utf8');
  const lines = shell.split('\n');
  const out = [];

  for (const line of lines) {
    const match = line.match(INCLUDE_RE);
    if (!match) {
      out.push(line);
      continue;
    }
    const relPath = match[2];
    const partialPath = path.join(ADMIN_DIR, relPath);
    if (!partialPath.startsWith(ADMIN_DIR)) {
      throw new Error(`Invalid partial path: ${relPath}`);
    }
    const content = fs.readFileSync(partialPath, 'utf8').replace(/\n$/, '');
    out.push(...content.split('\n'));
  }

  return out.join('\n');
}

module.exports = { renderAdminDashboard };
