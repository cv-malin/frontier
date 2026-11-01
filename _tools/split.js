const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');
const raw = fs.readFileSync(SRC, 'utf8');

const iStyleOpen = raw.indexOf('<style>');
const iStyleClose = raw.indexOf('</style>') + '</style>'.length;
const iBody = raw.indexOf('<body>');
const iScriptOpen = raw.indexOf('<script>');
const iScriptClose = raw.lastIndexOf('</script>');

const head = raw.slice(0, iBody);
const bodyPreScript = raw.slice(iBody, iScriptOpen);
const script = raw.slice(iScriptOpen + '<script>'.length, iScriptClose);
const tail = raw.slice(iScriptClose + '</script>'.length);

const marks = [
  ['   5 · 相机与画布', '1-core.js', '核心与地图'],
  ['   7 · A* 寻路', '2-render.js', '渲染'],
  ['   16 · 图标', '3-sim.js', '模拟'],
  ['   22 · 初始化与主循环', '4-ui.js', '界面'],
  [null, '5-boot.js', '启动']
];

const idxs = marks.slice(0, 4).map(([m]) => {
  const i = script.indexOf(m);
  if (i < 0) throw new Error('标记未找到: ' + m);
  return script.lastIndexOf('/* =====', i);
});

const cuts = [0, ...idxs, script.length];
const dir = path.join(ROOT, 'js');
fs.mkdirSync(dir, { recursive: true });

const banner = (name, title) =>
  `/* =====================================================================\n   ${name} · ${title}\n   边陲 v1.5 · 模块化拆分（原单文件第 ${name.split('-')[0]} 部分）\n   ===================================================================== */\n\n`;

for (let i = 0; i < 5; i++) {
  const [_, file, title] = marks[i];
  let chunk = script.slice(cuts[i], cuts[i + 1]);
  if (i > 0) chunk = chunk.replace(/^\s*\n/, '');
  fs.writeFileSync(path.join(dir, file), banner(file, title) + chunk, 'utf8');
  console.log(file.padEnd(14), chunk.split('\n').length, '行');
}

const shell = head +
  bodyPreScript +
  ['1-core.js', '2-render.js', '3-sim.js', '4-ui.js', '5-boot.js']
    .map(f => `<script src="js/${f}"></script>`).join('\n') +
  '\n' + tail;

fs.writeFileSync(path.join(ROOT, 'index.html'), shell, 'utf8');
fs.writeFileSync(path.join(ROOT, '_src_full.js'), script, 'utf8');
console.log('index.html 壳:', shell.split('\n').length, '行');
