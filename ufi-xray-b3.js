//<script>
// Xray 面板 v7（猫猫框架版）— 框架结构与 TProxy.js（猫猫 v9.1.0）保持一致：
// IIFE 接收全局 runShellWithRoot；挂载点 .functions-container；折叠用页面 collapseGen。
// 功能：安装内核 / 启停 / 节点导入 + 节点列表切换启用（vmess/vless/trojan/ss/订阅）/
//       配置编辑 / 日志 / 开机自启（挂 UFI-TOOLS 官方 boot.sh + schedule.sh 看门狗）/
//       全局接管状态持久化 / 代理模式：全局代理 & 规则分流·绕过大陆（geoip/geosite）。
((hostRunShellWithRoot) => {
  'use strict';

  /* ---------------- 常量 ---------------- */
  const DIR = '/data/xray';
  const BIN = DIR + '/xray';
  const CFG = DIR + '/config.json';
  const LOGF = DIR + '/xray.log';
  const START_SH_PATH = DIR + '/start.sh';
  const UPLOAD_DIR = '/data/data/com.minikano.f50_sms/files';
  // 内核多源：逐个尝试，任一成功即用（裸二进制优先；zip 源需设备有 unzip/busybox）
  const CORE_URLS = [
    'https://ghfast.top/https://github.com/luxinxin0378-create/ufi-xray/releases/download/v1.0/xray',
    'https://github.com/luxinxin0378-create/ufi-xray/releases/download/v1.0/xray',
    'https://ghfast.top/https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-arm64-v8a.zip',
    'https://gh-proxy.com/https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-arm64-v8a.zip',
    'https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-arm64-v8a.zip'
  ]; // 前 2 条：本项目仓库托管的 v26.11.9 arm64 内核（镜像加速优先）；后 3 条：Xray 官方 zip 兜底
  const PANEL_ID = 'IFRAME_XRAY';
  const STYLE_ID = 'kano_xray_style';
  const BASE = (typeof KANO_baseURL === 'string' && KANO_baseURL) || '/api';
  const COMMON_HEADERS = (typeof common_headers === 'object' && common_headers) || {};
  const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36';

  const DEFAULT_CONFIG = [
    '{',
    '  "log": { "loglevel": "warning" },',
    '  "inbounds": [',
    '    { "tag": "http-in",  "listen": "0.0.0.0", "port": 7890, "protocol": "http",  "settings": {} },',
    '    { "tag": "socks-in", "listen": "0.0.0.0", "port": 7891, "protocol": "socks", "settings": { "auth": "noauth", "udp": true } },',
    '    { "tag": "dns-in", "listen": "0.0.0.0", "port": 1053, "protocol": "dokodemo-door", "settings": { "address": "8.8.8.8", "port": 53, "network": "tcp,udp" } },',
    '    { "tag": "tp-in", "listen": "0.0.0.0", "port": 7893, "protocol": "dokodemo-door", "settings": { "network": "tcp", "followRedirect": true }, "streamSettings": { "sockopt": { "tproxy": "redirect" } } }',
    '  ],',
    '  "outbounds": [',
    '    {',
    '      "tag": "proxy",',
    '      "protocol": "vmess",',
    '      "settings": { "vnext": [ {',
    '        "address": "your.server.com",',
    '        "port": 443,',
    '        "users": [ { "id": "00000000-0000-0000-0000-000000000000", "alterId": 0, "security": "auto", "level": 8 } ]',
    '      } ] },',
    '      "streamSettings": {',
    '        "network": "tcp",',
    '        "tcpSettings": { "header": {',
    '          "type": "http",',
    '          "request": {',
    '            "version": "1.1", "method": "GET", "path": ["/"],',
    '            "headers": {',
    '              "Host": ["your.disguise.host"],',
    '              "User-Agent": ["Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36"],',
    '              "Accept-Encoding": ["gzip, deflate"],',
    '              "Connection": ["keep-alive"],',
    '              "Pragma": ["no-cache"]',
    '            }',
    '          },',
    '          "response": {',
    '            "version": "1.1", "status": "200", "reason": "OK",',
    '            "headers": {',
    '              "Content-Type": ["application/octet-stream", "video/mpeg"],',
    '              "Transfer-Encoding": ["chunked"],',
    '              "Connection": ["keep-alive"],',
    '              "Pragma": ["no-cache"]',
    '            }',
    '          }',
    '        } }',
    '      }',
    '    },',
    '    { "tag": "direct", "protocol": "freedom", "settings": {} }',
    '  ],',
    '  "routing": {',
    '    "rules": [',
    '      { "type": "field", "ip": [',
    '        "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8",',
    '        "169.254.0.0/16", "100.64.0.0/10"',
    '      ], "outboundTag": "direct" }',
    '    ]',
    '  }',
    '}'
  ].join('\n');

  const START_SH = [
    '#!/system/bin/sh',
    'DIR=/data/xray',
    'if [ -f "$DIR/.user_stopped" ]; then echo USER_STOPPED; exit 0; fi',
    '[ -x "$DIR/xray" ] || exit 0',
    '[ -f "$DIR/config.json" ] || exit 0',
    'if [ -f "$DIR/xray.pid" ] && kill -0 "$(cat "$DIR/xray.pid")" 2>/dev/null; then',
    '  echo RUNNING',
    'else',
    '  if pidof xray >/dev/null 2>&1; then',
    '    pidof xray > "$DIR/xray.pid"',
    '    echo RUNNING',
    '  else',
    '    cd "$DIR" || exit 1',
    '    nohup "$DIR/xray" run -c "$DIR/config.json" >> "$DIR/xray.log" 2>&1 &',
    '    echo $! > "$DIR/xray.pid"',
    '    sleep 2',
    '    if pidof xray >/dev/null 2>&1; then echo STARTED; else echo START_FAIL; exit 1; fi',
    '  fi',
    'fi',
    'if [ -f "$DIR/.global_on" ] && [ -f "$DIR/global.sh" ]; then',
    '  if iptables -t nat -C PREROUTING -j XRAY_TP 2>/dev/null; then',
    '    echo GLOBAL_OK',
    '  else',
    '    sh "$DIR/global.sh" >/dev/null 2>&1',
    '    echo GLOBAL_RESTORED',
    '  fi',
    'fi'
  ].join('\n');

  /* ---------------- 开机自启（UFI-TOOLS 官方钩子） ----------------
   * /sdcard/ufi_tools_boot.sh     设备开机后执行（高级功能开启时生效）
   * /sdcard/ufi_tools_schedule.sh 每 25~30 秒执行一次（兼作看门狗与接管核对）
   * 只追加带标记的行，绝不覆盖官方文件内容。 */
  const BOOT_FILE = '/sdcard/ufi_tools_boot.sh';
  const SCHED_FILE = '/sdcard/ufi_tools_schedule.sh';
  const START_LINE = 'sh /data/xray/start.sh >/dev/null 2>&1 &';

  const BOOT_INSTALL_CMD = [
    'F=' + BOOT_FILE,
    'touch "$F" || exit 1',
    'if grep -q xray-ufi-autostart "$F" 2>/dev/null; then echo BOOT_ALREADY; else',
    '  printf "\\n" >> "$F"',
    '  echo "# xray-ufi-autostart" >> "$F"',
    "  echo '" + START_LINE + "' >> \"$F\"",
    '  echo BOOT_OK',
    'fi'
  ].join('\n');

  const SCHED_INSTALL_CMD = [
    'F=' + SCHED_FILE,
    'touch "$F" || exit 1',
    'if grep -q xray-ufi-watchdog "$F" 2>/dev/null; then echo SCHED_ALREADY; else',
    '  printf "\\n" >> "$F"',
    '  echo "# xray-ufi-watchdog" >> "$F"',
    "  echo '" + START_LINE + "' >> \"$F\"",
    '  echo SCHED_OK',
    'fi'
  ].join('\n');

  const AUTOSTAT_CMD = [
    'grep -q xray-ufi-autostart ' + BOOT_FILE + ' 2>/dev/null && echo BOOT_YES',
    'grep -q xray-ufi-watchdog ' + SCHED_FILE + ' 2>/dev/null && echo SCHED_YES',
    'echo END'
  ].join('\n');

  const AUTO_REMOVE_CMD = [
    'for F in ' + BOOT_FILE + ' ' + SCHED_FILE + '; do',
    '  [ -f "$F" ] || continue',
    '  grep -v xray-ufi-autostart "$F" | grep -v xray-ufi-watchdog | grep -v \'sh /data/xray/start.sh\' > "$F.tmp" && mv "$F.tmp" "$F"',
    'done',
    'echo REMOVED'
  ].join('\n');

  /* ---------------- 规则分流（geoip / geosite 分流规则库） ----------------
   * 下载 v2fly 官方 lite 版规则库（约 1MB/个）到 /data/xray/，
   * xray 默认在二进制所在目录查找 geoip.dat / geosite.dat。多 CDN 源依次尝试。 */
  const GEO_SOURCES = [
    { file: 'geoip.dat',
      urls: [
        'https://cdn.jsdelivr.net/gh/v2fly/geoip@release/geoip-lite.dat',
        'https://fastly.jsdelivr.net/gh/v2fly/geoip@release/geoip-lite.dat',
        'https://testingcf.jsdelivr.net/gh/v2fly/geoip@release/geoip-lite.dat',
        'https://ghfast.top/https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geoip-lite.dat',
        'https://gh-proxy.com/https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geoip-lite.dat',
        'https://raw.githubusercontent.com/Loyalsoldier/v2ray-rules-dat/release/geoip-lite.dat',
        'https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geoip-lite.dat'
      ], minSize: 100000 },
    { file: 'geosite.dat',
      urls: [
        'https://cdn.jsdelivr.net/gh/v2fly/domain-list-community@release/geosite-lite.dat',
        'https://fastly.jsdelivr.net/gh/v2fly/domain-list-community@release/geosite-lite.dat',
        'https://testingcf.jsdelivr.net/gh/v2fly/domain-list-community@release/geosite-lite.dat',
        'https://ghfast.top/https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite-lite.dat',
        'https://gh-proxy.com/https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite-lite.dat',
        'https://raw.githubusercontent.com/Loyalsoldier/v2ray-rules-dat/release/geosite-lite.dat',
        'https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite-lite.dat'
      ], minSize: 100000 }
  ];
  const DNS_OUT_TAG = 'dns-out';
  const TP_IN_TAG = 'tp-in';
  const DNS_IN_TAG = 'dns-in';
  const PRIVATE_IPS = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8', '169.254.0.0/16', '100.64.0.0/10'];

  /* ---------------- 基础工具 ---------------- */
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const shQ = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

  // 猫猫同款：hostRunShellWithRoot.call(globalThis, cmd, timeout) → 解析 {success, content}
  async function sh(cmd, timeout = 15000) {
    if (typeof hostRunShellWithRoot !== 'function') {
      throw new Error('设备接口未就绪（页面主脚本未加载完成，请刷新页面重试）');
    }
    let response;
    try {
      response = await hostRunShellWithRoot.call(globalThis, cmd, timeout);
    } catch (e) {
      throw new Error('设备命令执行失败：' + ((e && e.message) || String(e)));
    }
    let content = '';
    if (typeof response === 'string') content = response;
    else if (response && typeof response === 'object') {
      const candidates = [
        response.data && response.data.content,
        response.data && response.data.result,
        response.result,
        response.content
      ].filter((v) => typeof v === 'string');
      content = candidates[0] || '';
    }
    const ok = !(response && typeof response === 'object' &&
      (response.success === false || (response.data && response.data.success === false)));
    if (!ok && !content) throw new Error('root_shell 返回失败（高级功能是否已开启？）');
    return content;
  }

  function utf8ToB64(s) { return btoa(unescape(encodeURIComponent(s))); }

  async function writeFile(path, content) {
    const b = utf8ToB64(content);
    await sh('mkdir -p ' + DIR);
    await sh('rm -f ' + shQ(path + '.b64'));
    for (let i = 0; i < b.length; i += 3800) {
      await sh("echo '" + b.slice(i, i + 3800) + "' >> " + shQ(path + '.b64'));
    }
    await sh("base64 -d " + shQ(path + '.b64') + " > " + shQ(path) + " && rm -f " + shQ(path + '.b64'));
  }

  async function findCurl() {
    const out = (await sh('command -v curl 2>/dev/null || find /data/data/com.minikano.f50_sms -name curl -type f 2>/dev/null | head -n 1; true', 10000)).trim();
    return out.split('\n').filter(Boolean).pop() || '';
  }

  /* ---------------- 节点解析（v5 已验证逻辑） ---------------- */
  function b64DecodeUtf8(s) {
    s = String(s).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    try { return decodeURIComponent(escape(bin)); } catch (e) { return bin; }
  }
  function intPort(v) { const p = parseInt(v, 10); return p > 0 ? p : 443; }

  function httpObfsHeader(j) {
    return {
      type: 'http',
      request: {
        version: '1.1', method: 'GET', path: [j.path || '/'],
        headers: {
          'Host': [j.host || j.add],
          'User-Agent': [j.fp || DEFAULT_UA],
          'Accept-Encoding': ['gzip, deflate'],
          'Connection': ['keep-alive'],
          'Pragma': ['no-cache']
        }
      },
      response: {
        version: '1.1', status: '200', reason: 'OK',
        headers: {
          'Content-Type': ['application/octet-stream', 'video/mpeg'],
          'Transfer-Encoding': ['chunked'],
          'Connection': ['keep-alive'],
          'Pragma': ['no-cache']
        }
      }
    };
  }

  function applyTransport(ss, net, p) {
    switch (net) {
      case 'ws':
        ss.wsSettings = { path: p.path || '/' };
        if (p.host) ss.wsSettings.headers = { Host: p.host };
        break;
      case 'grpc':
        ss.grpcSettings = { serviceName: p.serviceName || p.path || '', multiMode: false };
        break;
      case 'h2':
        ss.h2Settings = { host: [p.host || ''], path: p.path || '/' };
        if (!ss.security || ss.security === 'none') { ss.security = 'tls'; ss.tlsSettings = {}; }
        break;
      case 'httpupgrade':
        ss.httpupgradeSettings = { host: p.host || '', path: p.path || '/' };
        break;
      case 'xhttp':
        ss.xhttpSettings = { host: p.host || '', path: p.path || '/' };
        break;
      case 'kcp':
        ss.mkcpSettings = { header: { type: p.headerType || 'none' } };
        break;
      default:
        if ((p.headerType || '').toLowerCase() === 'http') ss.tcpSettings = { header: httpObfsHeader(p.raw || {}) };
        break;
    }
  }

  function applyTls(ss, security, o) {
    if (security === 'reality') {
      ss.security = 'reality';
      ss.realitySettings = {
        serverName: o.sni || o.fallbackHost || '',
        fingerprint: o.fp || 'chrome',
        publicKey: o.pbk || '',
        shortId: o.sid || '',
        spiderX: o.spx || '/'
      };
    } else if (security === 'tls') {
      ss.security = 'tls';
      ss.tlsSettings = { serverName: o.sni || o.fallbackHost || '', allowInsecure: !!o.insecure };
      if (o.fp) ss.tlsSettings.fingerprint = o.fp;
      if (o.alpn) ss.tlsSettings.alpn = [o.alpn];
    } else {
      ss.security = 'none';
    }
    if (ss.tlsSettings && !ss.tlsSettings.serverName && o.fallbackHost) ss.tlsSettings.serverName = o.fallbackHost;
    if (ss.realitySettings && !ss.realitySettings.serverName && o.fallbackHost) ss.realitySettings.serverName = o.fallbackHost;
  }

  function parseVmess(body, name) {
    const j = JSON.parse(b64DecodeUtf8(body));
    const net = (j.net || 'tcp').toLowerCase();
    const ss = { network: net };
    const tls = String(j.tls || '').toLowerCase();
    applyTls(ss, tls === 'tls' ? 'tls' : (tls === 'reality' ? 'reality' : 'none'), {
      sni: j.sni, fp: j.fp, alpn: j.alpn, insecure: j.insecure === '1' || j.insecure === 1,
      pbk: j.pbk, sid: j.sid, spx: j.spx, fallbackHost: j.host || j.add
    });
    applyTransport(ss, net, { host: j.host, path: j.path, headerType: j.type, raw: j });
    return {
      tag: name || j.ps || (j.add + ':' + j.port),
      protocol: 'vmess',
      settings: { vnext: [{ address: j.add, port: intPort(j.port), users: [{ id: j.id, alterId: parseInt(j.aid, 10) || 0, security: j.scy || 'auto', level: 8 }] }] },
      streamSettings: ss
    };
  }

  function parseVless(line, name) {
    const m = line.match(/^vless:\/\/([^@/?#]+)@\[?([^\]:/?#]+)\]?:(\d+)(?:\?([^#]*))?/i);
    if (!m) throw new Error('vless 链接格式无法解析');
    const q = new URLSearchParams(m[4] || '');
    const net = (q.get('type') || 'tcp').toLowerCase();
    const ss = { network: net };
    const sec = (q.get('security') || 'none').toLowerCase();
    applyTls(ss, sec, {
      sni: q.get('sni'), fp: q.get('fp'), alpn: q.get('alpn'),
      insecure: q.get('allowInsecure') === '1' || q.get('insecure') === '1',
      pbk: q.get('pbk'), sid: q.get('sid'), spx: q.get('spx'), fallbackHost: m[2]
    });
    applyTransport(ss, net, {
      host: q.get('host'), path: q.get('path'),
      headerType: q.get('headerType'), serviceName: q.get('serviceName')
    });
    return {
      tag: name || (m[2] + ':' + m[3]),
      protocol: 'vless',
      settings: { vnext: [{ address: m[2], port: parseInt(m[3], 10), users: [{ id: m[1], encryption: q.get('encryption') || 'none', flow: q.get('flow') || '', level: 8 }] }] },
      streamSettings: ss
    };
  }

  function parseTrojan(line, name) {
    const m = line.match(/^trojan:\/\/([^@/?#]+)@\[?([^\]:/?#]+)\]?:(\d+)(?:\?([^#]*))?/i);
    if (!m) throw new Error('trojan 链接格式无法解析');
    const q = new URLSearchParams(m[4] || '');
    const net = (q.get('type') || 'tcp').toLowerCase();
    const ss = { network: net };
    const sec = (q.get('security') || 'tls').toLowerCase();
    applyTls(ss, sec === 'none' ? 'none' : sec, {
      sni: q.get('sni'), fp: q.get('fp'), alpn: q.get('alpn'),
      insecure: q.get('allowInsecure') === '1', fallbackHost: m[2]
    });
    applyTransport(ss, net, {
      host: q.get('host'), path: q.get('path'),
      headerType: q.get('headerType'), serviceName: q.get('serviceName')
    });
    return {
      tag: name || (m[2] + ':' + m[3]),
      protocol: 'trojan',
      settings: { servers: [{ address: m[2], port: parseInt(m[3], 10), password: decodeURIComponent(m[1]) }] },
      streamSettings: ss
    };
  }

  function parseSS(line, name) {
    const body = line.slice(5);
    let host, port, method, pass;
    const at = body.lastIndexOf('@');
    if (at >= 0) {
      const ui = body.slice(0, at);
      const hp = body.slice(at + 1).split('/')[0];
      let dec; try { dec = b64DecodeUtf8(ui); } catch (e) { dec = ui; }
      if (dec.indexOf(':') < 0) dec = ui;
      const ci = dec.indexOf(':');
      method = dec.slice(0, ci); pass = dec.slice(ci + 1);
      const parts = hp.split(':'); port = parseInt(parts.pop(), 10); host = parts.join(':');
    } else {
      const d = b64DecodeUtf8(body);
      const ci2 = d.indexOf(':'), at2 = d.lastIndexOf('@');
      method = d.slice(0, ci2); pass = d.slice(ci2 + 1, at2);
      const parts2 = d.slice(at2 + 1).split(':'); port = parseInt(parts2.pop(), 10); host = parts2.join(':');
    }
    if (!host || !(port > 0)) throw new Error('ss 链接格式无法解析');
    return {
      tag: name || (host + ':' + port),
      protocol: 'shadowsocks',
      settings: { servers: [{ address: host, port: port, method: method, password: pass }] }
    };
  }

  function parseShareLink(line) {
    let name = '';
    const hash = line.indexOf('#');
    if (hash >= 0) {
      try { name = decodeURIComponent(line.slice(hash + 1)); } catch (e) { name = line.slice(hash + 1); }
      line = line.slice(0, hash);
    }
    if (/^vmess:\/\//i.test(line)) return parseVmess(line.slice(8), name);
    if (/^vless:\/\//i.test(line)) return parseVless(line, name);
    if (/^trojan:\/\//i.test(line)) return parseTrojan(line, name);
    if (/^ss:\/\//i.test(line)) return parseSS(line, name);
    return null;
  }

  function extractLinks(txt) {
    txt = String(txt || '').trim();
    if (/:\/\//.test(txt)) {
      return txt.split(/\s+/).filter((s) => /^(vmess|vless|trojan|ss):\/\//i.test(s));
    }
    return b64DecodeUtf8(txt).split(/\s+/).filter((s) => /^(vmess|vless|trojan|ss):\/\//i.test(s));
  }

  // 订阅：设备端 curl 直拉（应用自带 curl / 系统 curl），不走浏览器
  async function fetchSubscription(url) {
    const C = await findCurl();
    if (!C) throw new Error('设备上没找到 curl，无法拉取订阅；请直接粘贴节点分享链接');
    const out = await sh(C + ' -sL --max-time 30 ' + shQ(url) + ' | head -c 600000; true', 45000);
    const txt = String(out || '').trim();
    if (!txt) throw new Error('订阅拉取为空（设备网络是否正常？）');
    return txt;
  }

  function uniqTag(name, used) {
    let t = String(name || '').replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 20) || '节点';
    const base = t; let i = 2;
    while (used.indexOf(t) >= 0) t = base + '-' + (i++);
    used.push(t);
    return t;
  }

  /* ---------------- 业务动作 ---------------- */
  async function readVersion() {
    return (await sh(BIN + ' version 2>/dev/null | head -n 1; true', 8000)).trim();
  }

  async function readPid() {
    return (await sh('pidof xray 2>/dev/null; true', 8000)).trim();
  }

  async function installFromUpload(file) {
    log('上传中：' + file.name + '（' + (Math.round(file.size / 10485.76) / 100) + ' MB）…');
    const fd = new FormData();
    fd.append('file', file, file.name);
    const res = await fetch(BASE + '/upload_img', { method: 'POST', headers: COMMON_HEADERS, body: fd });
    if (!res.ok) throw new Error('上传接口 HTTP ' + res.status);
    const result = await res.json().catch(() => null);
    let name = result && typeof result.url === 'string' && result.url.trim();
    if (!name) throw new Error((result && result.error) || '上传失败：接口未返回文件名');
    name = String(name).replace(/^\/+/, '').split('/').pop();
    if (!name || name.indexOf('..') >= 0) throw new Error('上传路径异常');
    log('上传完成：' + name + '，安装到 ' + BIN + ' …');
    const isZip = /\.zip$/i.test(name);
    const UP = shQ(UPLOAD_DIR + '/' + name);
    let cmd;
    if (isZip) {
      // zip 包：解压取出里面的 xray（依次尝试 unzip / busybox unzip）
      cmd = 'mkdir -p ' + DIR + ' && mv ' + UP + ' ' + DIR + '/pkg.zip && cd ' + DIR + ' && U=""' +
        ' && command -v unzip >/dev/null 2>&1 && U=unzip' +
        ' ; if [ -z "$U" ] && command -v busybox >/dev/null 2>&1; then U="busybox unzip"; fi' +
        ' && if [ -n "$U" ]; then' +
        ' $U -o pkg.zip -d pkg_tmp >/dev/null 2>&1' +
        ' ; F=$(find pkg_tmp -type f -name xray 2>/dev/null | head -n 1)' +
        ' ; [ -z "$F" ] && F=$(find pkg_tmp -type f 2>/dev/null | head -n 1)' +
        ' ; if [ -n "$F" ]; then mv "$F" ' + BIN + '; fi' +
        ' ; rm -rf pkg_tmp pkg.zip' +
        ' ; else echo __NO_UNZIP__; fi' +
        ' ; chmod +x ' + BIN + ' 2>/dev/null' +
        ' ; ' + BIN + ' version 2>&1 | head -n 1; true';
    } else {
      cmd = 'mkdir -p ' + DIR + ' && mv ' + UP + ' ' + BIN + ' && chmod +x ' + BIN + ' && ' +
        BIN + ' version 2>&1 | head -n 1; true';
    }
    const out = await sh(cmd, isZip ? 120000 : 40000);
    if (out.indexOf('__NO_UNZIP__') >= 0) {
      if (/xray/i.test(out)) {
        // zip 没解开，但设备上已有可运行的内核（version 已输出），不视为失败
        log('设备无解压工具，zip 未解开；检测到已有可用内核，不影响使用');
        await sh('rm -f ' + DIR + '/pkg.zip; true').catch(() => {});
        return out.replace('__NO_UNZIP__', '').trim() + '（注：本次 zip 未解压，使用的是设备上已有内核）';
      }
      throw new Error('设备上没有解压工具（unzip/busybox 都不存在）。请改用「从网络下载内核」按钮，或在电脑/手机上先把 zip 解压，上传解压出的无后缀 xray 文件。');
    }
    if (!/xray/i.test(out)) throw new Error('安装后验证异常：' + out);
    return out.trim();
  }

  async function downloadCore() {
    const C = await findCurl();
    if (!C) throw new Error('设备上没找到 curl，无法网络下载；请改用上传方式');
    let lastErr = '';
    for (let i = 0; i < CORE_URLS.length; i++) {
      const u = CORE_URLS[i];
      log('尝试下载源 ' + (i + 1) + '/' + CORE_URLS.length + '（' + u.split('/')[2] + '）…');
      setMsg('');
      let out = '';
      try {
        out = await sh(
          'mkdir -p ' + DIR + ' && rm -f ' + DIR + '/xray.tmp && ' + C + ' -sL --max-time 420 -o ' + DIR + '/xray.tmp ' + shQ(u) + ';' +
          ' if head -c 4 ' + DIR + '/xray.tmp 2>/dev/null | grep -q ELF; then' +
          ' mv ' + DIR + '/xray.tmp ' + BIN + ' && chmod +x ' + BIN + ' && echo __OK__ && ' + BIN + ' version 2>&1 | head -n 1;' +
          ' elif head -c 2 ' + DIR + '/xray.tmp 2>/dev/null | grep -q "^PK"; then' +
          ' mv ' + DIR + '/xray.tmp ' + DIR + '/pkg.zip && cd ' + DIR + ' && U=""' +
          ' ; command -v unzip >/dev/null 2>&1 && U=unzip' +
          ' ; [ -z "$U" ] && command -v busybox >/dev/null 2>&1 && U="busybox unzip"' +
          ' ; if [ -n "$U" ]; then' +
          ' $U -o pkg.zip -d pkg_tmp >/dev/null 2>&1' +
          ' ; F=$(find pkg_tmp -type f -name xray 2>/dev/null | head -n 1)' +
          ' ; [ -z "$F" ] && F=$(find pkg_tmp -type f 2>/dev/null | head -n 1)' +
          ' ; if [ -n "$F" ]; then mv "$F" ' + BIN + '; chmod +x ' + BIN + '; echo __OK__; ' + BIN + ' version 2>&1 | head -n 1; else echo __PKG_BAD__; fi' +
          ' ; rm -rf pkg_tmp pkg.zip' +
          ' ; else echo __NO_UNZIP__; rm -f ' + DIR + '/pkg.zip; fi' +
          ' ; cd /; true' +
          ' else rm -f ' + DIR + '/xray.tmp; echo __DL_FAIL__; fi; true', 460000);
      } catch (e) { lastErr = (e && e.message) || e; log('源 ' + (i + 1) + ' 失败：' + lastErr + '，换下一个源…'); continue; }
      if (out.indexOf('__OK__') >= 0 && /xray/i.test(out.replace(/__OK__\n?/, ''))) {
        return out.replace(/__OK__\n?/, '').trim() + '（源：' + u.split('/')[2] + '）';
      }
      if (out.indexOf('__NO_UNZIP__') >= 0) {
        lastErr = '该源返回 zip 包但设备无解压工具';
        log(lastErr + '，换下一个源…');
        continue;
      }
      lastErr = '下载失败或内容无效';
      log('源 ' + (i + 1) + ' 失败，换下一个源…');
    }
    throw new Error('所有下载源均失败（' + lastErr + '）。可稍后重试，或改用「上传并安装」方式');
  }

  let __GEO_FIX__ = false; // 防自动回退递归
  // 有接管记忆（.global_on）但规则不在时，恢复 iptables（停止核心时规则被撤销，启动后按记忆恢复）
  async function restoreGlobalIfRemembered() {
    try {
      const g = await sh('[ -f ' + DIR + '/.global_on ] && [ -f ' + DIR + '/global.sh ] && echo YES || echo NO; true', 8000);
      if (g.indexOf('YES') < 0) return;
      await sh('sh ' + DIR + '/global.sh', 20000);
      log('已恢复记忆的全局接管状态');
    } catch (e) {}
  }

  async function startCore() {
    const chk = await sh('[ -x ' + BIN + ' ] && echo OK || echo NOBIN; true');
    if (chk.indexOf('NOBIN') >= 0) throw new Error('还没安装内核：先在「安装内核」上传 xray 文件');
    let chk2 = await sh('[ -f ' + CFG + ' ] && echo OK || echo NOCONF; true');
    if (chk2.indexOf('NOCONF') >= 0) {
      await writeFile(CFG, DEFAULT_CONFIG);
      log('未发现配置，已写入默认配置（示例节点）');
    }
    await sh(
      'rm -f ' + DIR + '/.user_stopped; cd ' + DIR + ' && nohup ./xray run -c ' + CFG + ' >> ' + LOGF + ' 2>&1 & ' +
      'echo $! > ' + DIR + '/xray.pid; echo STARTED', 15000);
    await wait(1500);
    const pid = await readPid();
    if (!pid) {
      const tail = await tailLog(15);
      if (!__GEO_FIX__ && /geoip\.dat|geosite\.dat|geodata/i.test(tail)) {
        __GEO_FIX__ = true;
        try {
          log('检测到规则库文件损坏导致启动失败：自动删除规则库并回退「全局代理」模式…');
          await sh('rm -f ' + DIR + '/geoip.dat ' + DIR + '/geosite.dat; true');
          const conf = JSON.parse(await loadConfig());
          await rewriteAndApply(conf, 'global');
          const p2 = await readPid();
          if (p2) {
            log('已自动回退为「全局代理」模式并启动成功。修复规则库：点「下载分流规则库」后再切换规则分流');
            await restoreGlobalIfRemembered();
            return p2;
          }
        } catch (e2) {
          log('自动回退失败：' + ((e2 && e2.message) || e2));
        } finally {
          __GEO_FIX__ = false;
        }
      }
      throw new Error('启动失败，日志末尾：\n' + tail);
    }
    await restoreGlobalIfRemembered();
    return pid;
  }

  async function stopCore() {
    return sh(
      '[ -f ' + DIR + '/xray.pid ] && kill "$(cat ' + DIR + '/xray.pid)" 2>/dev/null; ' +
      'PIDS=$(pidof xray 2>/dev/null); [ -n "$PIDS" ] && kill $PIDS 2>/dev/null; ' +
      'sleep 1; PIDS=$(pidof xray 2>/dev/null); [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null; ' +
      'rm -f ' + DIR + '/xray.pid; touch ' + DIR + '/.user_stopped; ' +
      'iptables -t nat -D PREROUTING -j XRAY_TP 2>/dev/null; ' +
      'iptables -t nat -F XRAY_TP 2>/dev/null; ' +
      'iptables -t nat -X XRAY_TP 2>/dev/null; ' +
      'echo STOPPED', 15000);
  }

  async function loadConfig() {
    const out = await sh('cat ' + CFG + ' 2>/dev/null; echo __EOF__; true');
    const idx = out.indexOf('__EOF__');
    return (idx >= 0 ? out.slice(0, idx) : out).trim() || DEFAULT_CONFIG;
  }

  async function saveConfig(text) {
    JSON.parse(text); // 语法校验，失败会抛
    await writeFile(CFG, text);
  }

  async function tailLog(n) {
    const out = await sh('tail -n ' + (n || 80) + ' ' + LOGF + ' 2>/dev/null; echo __EOF__; true');
    const idx = out.indexOf('__EOF__');
    return (idx >= 0 ? out.slice(0, idx) : out).trim() || '（日志为空）';
  }

  async function ensureAutoStart() {
    await writeFile(START_SH_PATH, START_SH);
    await writeFile(DIR + '/global.sh', GLOBAL_SH);
    await sh('chmod 755 ' + START_SH_PATH + ' ' + DIR + '/global.sh');
    const bootOut = await sh(BOOT_INSTALL_CMD, 15000);
    const schedOut = await sh(SCHED_INSTALL_CMD, 15000);
    const bootOk = bootOut.indexOf('BOOT_OK') >= 0 || bootOut.indexOf('BOOT_ALREADY') >= 0;
    const schedOk = schedOut.indexOf('SCHED_OK') >= 0 || schedOut.indexOf('SCHED_ALREADY') >= 0;
    if (!bootOk && !schedOk) throw new Error('开机自启挂载失败（/sdcard 不可写？需开启高级功能）');
    const parts = [];
    parts.push(bootOk ? '开机脚本已挂' : '开机脚本挂载失败');
    parts.push(schedOk ? '看门狗已挂（每25~30秒自动核对）' : '看门狗挂载失败');
    if (!bootOk || !schedOk) {
      throw new Error(parts.join('；') + '。请确认已开启「高级功能」后重试');
    }
    return '开机自启已配置：' + parts.join('；') +
      '。设备重启后会自动拉起核心，并按 .global_on 记忆恢复全局接管。';
  }

  async function removeAutoStart() {
    const out = await sh(AUTO_REMOVE_CMD, 15000);
    if (out.indexOf('REMOVED') < 0) throw new Error('移除失败，输出：' + out);
    return '已移除开机自启与看门狗（/sdcard 两个钩子文件中的 Xray 条目已清理）';
  }

  async function autoStartStatus() {
    const out = await sh(AUTOSTAT_CMD, 8000);
    return {
      boot: out.indexOf('BOOT_YES') >= 0,
      sched: out.indexOf('SCHED_YES') >= 0
    };
  }

  /* ---------------- 全局接管（iptables 透明代理） ---------------- */
  const GLOBAL_SH = [
    '#!/system/bin/sh',
    'iptables -t nat -N XRAY_TP 2>/dev/null',
    'iptables -t nat -F XRAY_TP',
    'iptables -t nat -A XRAY_TP -d 10.0.0.0/8 -j RETURN',
    'iptables -t nat -A XRAY_TP -d 172.16.0.0/12 -j RETURN',
    'iptables -t nat -A XRAY_TP -d 192.168.0.0/16 -j RETURN',
    'iptables -t nat -A XRAY_TP -d 127.0.0.0/8 -j RETURN',
    'iptables -t nat -A XRAY_TP -d 169.254.0.0/16 -j RETURN',
    'iptables -t nat -A XRAY_TP -d 100.64.0.0/10 -j RETURN',
    'iptables -t nat -A XRAY_TP -p udp --dport 53 -j REDIRECT --to-ports 1053',
    'iptables -t nat -A XRAY_TP -p tcp --dport 53 -j REDIRECT --to-ports 1053',
    'iptables -t nat -A XRAY_TP -p tcp -j REDIRECT --to-ports 7893',
    'iptables -t nat -C PREROUTING -j XRAY_TP 2>/dev/null || iptables -t nat -A PREROUTING -j XRAY_TP',
    'echo GLOBAL_APPLIED'
  ].join('\n');

  async function globalStatus() {
    const out = await sh(
      'if iptables -t nat -S PREROUTING 2>/dev/null | grep -q XRAY_TP || ' +
      'iptables -t nat -L PREROUTING -n 2>/dev/null | grep -q XRAY_TP; then echo GLOBAL_ON; ' +
      'else echo GLOBAL_OFF; fi; true', 10000);
    return out.indexOf('GLOBAL_ON') >= 0;
  }

  /* ---------------- 代理模式（全局代理 / 规则分流·绕过大陆） ----------------
   * 模式差异全部在 xray 配置层（routing + dns-out + tp-in sniffing），
   * iptables 接管规则不变：切换模式无需重打 iptables，重启核心即生效。
   * dns-in(dokodemo) → routing 拦截 → dns-out（protocol: dns）：
   *   全局代理：8.8.8.8 经节点出站解析；
   *   规则分流：geosite:cn 域名用 223.5.5.5 直连解析，其余 8.8.8.8 经节点。 */
  function detectMode(conf) {
    try {
      const rs = (conf && conf.routing && conf.routing.rules) || [];
      return rs.some((r) => r && Array.isArray(r.domain) && r.domain.indexOf('geosite:cn') >= 0) ? 'rule' : 'global';
    } catch (e) { return 'global'; }
  }

  function rewriteConfigForMode(conf, mode) {
    conf.inbounds = Array.isArray(conf.inbounds) ? conf.inbounds : [];
    // 1) dns-in：透明 DNS 入站（1053），不再固定转发，交由 routing 送到 dns-out
    let dnsIn = conf.inbounds.find((i) => i && i.tag === DNS_IN_TAG);
    if (!dnsIn) {
      dnsIn = { tag: DNS_IN_TAG, listen: '0.0.0.0', port: 1053, protocol: 'dokodemo-door',
        settings: { network: 'tcp,udp' } };
      conf.inbounds.push(dnsIn);
    } else {
      dnsIn.listen = dnsIn.listen || '0.0.0.0';
      dnsIn.port = 1053;
      dnsIn.protocol = 'dokodemo-door';
      dnsIn.settings = { network: 'tcp,udp' };
    }
    // 2) tp-in：透明代理入站（7893）；规则分流模式开启嗅探，把 IP 连接还原出域名以命中 geosite
    let tpIn = conf.inbounds.find((i) => i && i.tag === TP_IN_TAG);
    if (!tpIn) {
      tpIn = { tag: TP_IN_TAG, listen: '0.0.0.0', port: 7893, protocol: 'dokodemo-door',
        settings: { network: 'tcp', followRedirect: true },
        streamSettings: { sockopt: { tproxy: 'redirect' } } };
      conf.inbounds.push(tpIn);
    } else {
      tpIn.port = 7893;
      tpIn.protocol = 'dokodemo-door';
      tpIn.settings = { network: 'tcp', followRedirect: true };
      tpIn.streamSettings = { sockopt: { tproxy: 'redirect' } };
    }
    tpIn.sniffing = (mode === 'rule')
      ? { enabled: true, destOverride: ['http', 'tls'] }
      : { enabled: false };
    // 3) dns-out：DNS 出站
    conf.outbounds = Array.isArray(conf.outbounds) ? conf.outbounds : [];
    let dnsOut = conf.outbounds.find((o) => o && o.tag === DNS_OUT_TAG);
    if (!dnsOut) conf.outbounds.push({ tag: DNS_OUT_TAG, protocol: 'dns', settings: {} });
    dnsOut = conf.outbounds.find((o) => o && o.tag === DNS_OUT_TAG);
    dnsOut.protocol = 'dns';
    dnsOut.settings = (mode === 'rule')
      ? { servers: [ { address: '223.5.5.5', domains: ['geosite:cn'] }, { address: '8.8.8.8' } ] }
      : { servers: [ { address: '8.8.8.8' } ] };
    // 4) routing 全量重写（dns 拦截最前 → 域名直连 → IP 直连）
    // 注意：内网直连一律用明文 CIDR（PRIVATE_IPS），不得引用 geoip:private——
    // 那样即使「全局代理」模式也会强制读取 geoip.dat，规则库缺失/损坏时核心无法启动
    const rules = [ { type: 'field', inboundTag: [DNS_IN_TAG], outboundTag: DNS_OUT_TAG } ];
    if (mode === 'rule') {
      rules.push({ type: 'field', domain: ['geosite:cn'], outboundTag: 'direct' });
    }
    rules.push({ type: 'field',
      ip: PRIVATE_IPS.concat(mode === 'rule' ? ['geoip:cn'] : []),
      outboundTag: 'direct' });
    conf.routing = { domainStrategy: mode === 'rule' ? 'IPIfNonMatch' : 'AsIs', rules: rules };
    return true;
  }

  async function rewriteAndApply(conf, mode) {
    rewriteConfigForMode(conf, mode);
    await writeFile(CFG, JSON.stringify(conf, null, 2));
    await stopCore();
    await wait(800);
    await startCore();
    log('核心已重启，' + (mode === 'rule' ? '规则分流·绕过大陆' : '全局代理') + '模式生效');
  }

  async function checkGeoFiles() {
    // 双重校验：大小 <100KB 或内容为 HTML/zip/gzip 开头都算坏文件，检测到立即删除
    const out = await sh(
      'for F in geoip.dat geosite.dat; do' +
      ' P=' + DIR + '/$F; S=$(stat -c%s "$P" 2>/dev/null || echo 0); B=""' +
      ' ; if [ "$S" -lt 100000 ]; then echo "$F:BAD:$S:size"; rm -f "$P"' +
      ' ; elif head -c 1 "$P" 2>/dev/null | grep -q "<"; then echo "$F:BAD:$S:html"; rm -f "$P"' +
      ' ; elif head -c 2 "$P" 2>/dev/null | grep -q "$(printf \'\\037\\213\')"; then echo "$F:BAD:$S:gzip"; rm -f "$P"' +
      ' ; elif head -c 2 "$P" 2>/dev/null | grep -q "^PK"; then echo "$F:BAD:$S:zip"; rm -f "$P"' +
      ' ; else echo "$F:OK:$S"; fi' +
      ' ; done; true', 10000);
    const bad = [];
    let ipSize = 0, siteSize = 0;
    const re = /(geoip|geosite)\.dat:(OK|BAD):(\d+)(?::(\w+))?/g;
    let m;
    while ((m = re.exec(out)) !== null) {
      if (m[1] === 'geoip') ipSize = parseInt(m[3], 10) || 0;
      else siteSize = parseInt(m[3], 10) || 0;
      if (m[2] === 'BAD') bad.push(m[1] + '.dat（' + (m[4] || 'size') + '，' + m[3] + ' 字节，已自动删除）');
    }
    return { ok: bad.length === 0, missing: bad, ipSize: ipSize, siteSize: siteSize };
  }

  async function downloadGeoData() {
    const C = await findCurl();
    if (!C) throw new Error('设备上没找到 curl，无法下载规则库；可在电脑上下载后于「配置」区说明手动放置');
    const dfOut = await sh('df -m ' + DIR + ' 2>/dev/null | tail -n 1 | awk \'{print $4}\'; true', 10000);
    const freeMB = parseInt(dfOut.trim(), 10) || 0;
    if (freeMB > 0 && freeMB < 3) {
      throw new Error('设备存储空间不足（' + DIR + ' 仅剩 ' + freeMB + ' MB）。请先清理空间（如删除旧日志/内核包），再下载规则库');
    }
    const results = [];
    for (const g of GEO_SOURCES) {
      const dest = DIR + '/' + g.file;
      let ok = false;
      for (const url of g.urls) {
        log('下载 ' + g.file + ' ← ' + url.split('/')[2] + ' …');
        let out = '';
        try {
          out = await sh(
            C + ' -sL --max-time 180 -o ' + dest + ' ' + shQ(url) + ' 2>/dev/null; ' +
            'if [ ! -s ' + dest + ' ]; then echo "SIZE:0"' +
            ' ; elif head -c 1 ' + dest + ' 2>/dev/null | grep -q "<"; then rm -f ' + dest + '; echo BADHTML' +
            ' ; elif head -c 2 ' + dest + ' 2>/dev/null | grep -q "$(printf \'\\037\\213\')"; then rm -f ' + dest + '; echo BADGZIP' +
            ' ; elif head -c 2 ' + dest + ' 2>/dev/null | grep -q "^PK"; then rm -f ' + dest + '; echo BADZIP' +
            ' ; else echo "SIZE:$(stat -c%s ' + dest + ' 2>/dev/null || echo 0)"; fi; true', 200000);
        } catch (e) { out = 'SIZE:0'; }
        const m = out.match(/SIZE:(\d+)/);
        const sz = m ? parseInt(m[1], 10) : 0;
        if (out.indexOf('BADHTML') >= 0 || out.indexOf('BADGZIP') >= 0 || out.indexOf('BADZIP') >= 0) {
          log(url.split('/')[2] + ' 返回的内容不是规则库（HTML/压缩包），已丢弃，换下一个源…');
          continue;
        }
        if (sz >= g.minSize) { ok = true; results.push(g.file + '（' + Math.round(sz / 1024) + ' KB）'); break; }
        log(url.split('/')[2] + ' 未成功（' + sz + ' 字节），换下一个源…');
      }
      if (!ok) throw new Error(g.file + ' 所有下载源均失败（设备网络访问 jsDelivr/GitHub 受限？）。可稍后重试，或手动下载该文件上传。');
    }
    return '规则库下载完成并校验通过：' + results.join('、') + '。现在可以点「规则分流模式」了';
  }

  async function switchMode(mode) {
    const pid = await readPid();
    if (!pid) throw new Error('核心未运行：先点「启动」再切换模式');
    if (mode === 'rule') {
      const g = await checkGeoFiles();
      if (!g.ok) throw new Error('规则库不完整（缺 ' + g.missing.join('、') + '）：请先点「下载分流规则库」，或手动放置到 ' + DIR);
    }
    const raw = await loadConfig();
    let conf;
    try { conf = JSON.parse(raw); } catch (e) { throw new Error('config.json 不是有效 JSON，请先在「配置」区修复后重试'); }
    const cur = detectMode(conf);
    if (cur === mode) {
      await rewriteAndApply(conf, mode);
      return '当前已是「' + (mode === 'rule' ? '规则分流·绕过大陆' : '全局代理') + '」模式，已重新应用配置并重启核心。';
    }
    log('切换代理模式：' + (cur === 'rule' ? '规则分流' : '全局代理') + ' → ' + (mode === 'rule' ? '规则分流·绕过大陆' : '全局代理') + '…');
    await rewriteAndApply(conf, mode);
    return mode === 'rule'
      ? '已切换为「规则分流·绕过大陆」模式：国内域名/IP 直连不走节点，其余走代理（节点挂了国内仍可用）。'
      : '已切换为「全局代理」模式：全部流量经节点出站。';
  }

  async function enableGlobal() {
    const pid = await readPid();
    if (!pid) throw new Error('核心未运行：先点「启动」，再开全局接管');
    const raw = await loadConfig();
    let conf;
    try { conf = JSON.parse(raw); } catch (e) { throw new Error('config.json 不是有效 JSON，请先在「配置」区修复后重试'); }
    let mode = detectMode(conf);
    if (mode === 'rule') {
      const g = await checkGeoFiles();
      if (!g.ok) {
        log('规则分流模式但规则库不完整（缺 ' + g.missing.join('、') + '），本次自动回退为全局代理模式');
        mode = 'global';
      }
    }
    await rewriteAndApply(conf, mode);
    await writeFile(DIR + '/global.sh', GLOBAL_SH);
    await sh('touch ' + DIR + '/.global_on && sh ' + DIR + '/global.sh', 15000);
    const on = await globalStatus();
    if (!on) throw new Error('iptables 规则未生效（设备内核可能不支持 nat REDIRECT）。核心配置已就绪，可点「关闭接管」回退后反馈日志');
    // 开启成功 → 自动把启动命令挂进官方开机钩子，重启后自动恢复接管状态
    try {
      await ensureAutoStart();
      log('已自动配置开机自启：重启后自动拉起核心并恢复全局接管');
    } catch (e2) {
      log('开机自启自动配置未完成（' + ((e2 && e2.message) || e2) + '）');
    }
    return '全局接管已开启（模式：' + (mode === 'rule' ? '规则分流·绕过大陆' : '全局代理') + '）：所有连 WiFi 的设备免设置即走代理。\n状态已记住：只要开机自启配置成功，设备重启后会自动拉起核心并恢复接管。';
  }

  async function disableGlobal() {
    await sh(
      'iptables -t nat -D PREROUTING -j XRAY_TP 2>/dev/null; ' +
      'iptables -t nat -F XRAY_TP 2>/dev/null; ' +
      'rm -f ' + DIR + '/.global_on; echo GLOBAL_OFF', 15000);
    const on = await globalStatus();
    if (on) throw new Error('iptables 规则未能移除，请手动执行：iptables -t nat -D PREROUTING -j XRAY_TP');
    return '全局接管已关闭：设备流量恢复直连（.global_on 已删除，重启后不会再自动恢复接管）';
  }

  /* ---------------- 面板状态与 UI ---------------- */
  const el = {};
  let statusTimer = null;
  let busy = false;

  function log(text) {
    if (!el['xr-log']) return;
    const line = document.createElement('div');
    line.textContent = '[' + new Date().toTimeString().slice(0, 8) + '] ' + text;
    el['xr-log'].appendChild(line);
    el['xr-log'].scrollTop = el['xr-log'].scrollHeight;
  }

  function setMsg(text, isError) {
    if (!el['xr-msg']) return;
    el['xr-msg'].textContent = text || '';
    el['xr-msg'].style.display = text ? 'block' : 'none';
    el['xr-msg'].style.color = isError ? '#fda4af' : '#bfdbfe';
  }

  // 猫猫同款状态圆点
  function renderStatus(state, text) {
    const label = document.getElementById('running_xray');
    if (!label) return;
    while (label.firstChild) label.removeChild(label.firstChild);
    const dot = document.createElement('span');
    dot.className = 'mm-status-dot';
    dot.setAttribute('aria-hidden', 'true');
    const color = { healthy: '#38c878', stopped: '#ef646a', error: '#ef646a', checking: '#e6b652', unknown: '#8b96a6' }[state] || '#8b96a6';
    Object.assign(dot.style, { display: 'inline-block', flex: '0 0 10px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color, boxShadow: '0 0 0 3px ' + color + '20' });
    const caption = document.createElement('span');
    caption.className = 'mm-status-text';
    caption.textContent = text;
    Object.assign(label.style, { display: 'inline-flex', alignItems: 'center', gap: '8px' });
    label.dataset.state = state;
    label.appendChild(dot);
    label.appendChild(caption);
  }

  async function refresh() {
    try {
      renderStatus('checking', 'Xray - 检测中');
      const pid = await readPid();
      const ver = await readVersion();
      let userStopped = false;
      if (!pid && ver) {
        try {
          userStopped = (await sh('[ -f ' + DIR + '/.user_stopped ] && echo YES || echo NO; true', 8000)).indexOf('YES') >= 0;
        } catch (e) {}
      }
      if (pid) renderStatus('healthy', 'Xray - 运行中');
      else if (ver) renderStatus('stopped', 'Xray - 已停止' + (userStopped ? '（手动停止）' : ''));
      else renderStatus('stopped', 'Xray - 未安装');
      let gState = '未知';
      try { gState = (await globalStatus()) ? '已开启' : '关闭'; } catch (e) {}
      const gText = '全局接管：' + gState + (gState === '已开启' ? '（所有连 WiFi 设备自动走代理）' : '');
      if (el['xr-status']) {
        el['xr-status'].textContent =
          '内核：' + (ver || '未安装') + '\n进程：' + (pid ? 'PID ' + pid : '无' + (userStopped ? '（手动停止，点「启动」恢复）' : '')) +
          '\n端口：HTTP 7890 / SOCKS 7891（手机 WiFi 代理指向 192.168.0.1:7890）\n' + gText;
      }
      if (el['xr-global']) el['xr-global'].textContent = gText;
      let asText = '自启状态：未检测';
      try {
        const as = await autoStartStatus();
        asText = (as.boot && as.sched)
          ? '自启状态：已配置（开机钩子 + 看门狗，重启后自动恢复核心与接管）'
          : (as.boot || as.sched)
            ? '自启状态：部分配置（' + (as.boot ? '仅开机钩子' : '仅看门狗') + '），建议点「一键配置开机自启」'
            : '自启状态：未配置（重启后核心不会自动运行）';
      } catch (e) { asText = '自启状态：检测失败（是否已开启高级功能？）'; }
      if (el['xr-autostat']) el['xr-autostat'].textContent = asText;
      // 代理模式 + 节点数 + 规则库
      let modeText = '代理模式：未知';
      try {
        const conf = JSON.parse(await loadConfig());
        const mode = detectMode(conf);
        const n = proxyNodes(conf).length;
        let geo = '';
        try {
          const g = await checkGeoFiles();
          geo = g.ok ? '' : '（规则库缺 ' + g.missing.join('、') + '）';
        } catch (e) { geo = ''; }
        modeText = '代理模式：' + (mode === 'rule' ? '规则分流·绕过大陆（国内直连，其余走代理）' : '全局代理（全部经节点出站）') +
          (geo ? ' ' + geo : '') + ' ｜ 节点：' + n + ' 个';
      } catch (e) { modeText = '代理模式：读取失败（config.json 是否有效？）'; }
      if (el['xr-modestat']) el['xr-modestat'].textContent = modeText;
    } catch (e) {
      renderStatus('unknown', 'Xray - 状态未知');
      log('状态读取失败：' + ((e && e.message) || e));
    }
  }

  async function guard(fn, okMsg) {
    if (busy) return;
    busy = true;
    setMsg('');
    try {
      const r = await fn();
      if (okMsg) log(okMsg);
      if (r) setMsg(String(r), false);
      await refresh();
    } catch (e) {
      const m = (e && e.message) || String(e);
      log('失败：' + m);
      setMsg(m, true);
    } finally {
      busy = false;
    }
  }

  function uniqNames(nodes) {
    const used = [];
    nodes.forEach((n, i) => { n.tag = uniqTag(n.tag || ('节点' + (i + 1)), used); });
    return nodes;
  }

  async function applyNodesToConfig(raw) {
    const lines = String(raw || '').split(/\s+/).map((s) => s.trim()).filter(Boolean);
    if (!lines.length) throw new Error('请先粘贴节点分享链接或订阅地址');
    let links = [];
    for (const L of lines) {
      if (/^https?:\/\//i.test(L)) {
        log('设备端拉取订阅：' + L);
        const sub = extractLinks(await fetchSubscription(L));
        log('订阅解析到 ' + sub.length + ' 条节点链接');
        links = links.concat(sub);
      } else if (/^(vmess|vless|trojan|ss):\/\//i.test(L)) {
        links.push(L);
      } else {
        log('跳过无法识别的行：' + L.slice(0, 40));
      }
    }
    if (!links.length) throw new Error('没有解析到节点链接（订阅可能是 Clash YAML 格式，暂不支持）');
    const nodes = [];
    const errors = [];
    for (const L of links) {
      try {
        const n = parseShareLink(L);
        if (n) nodes.push(n);
      } catch (e) { errors.push(((e && e.message) || e) + ' ← ' + L.slice(0, 36)); }
    }
    if (!nodes.length) throw new Error('全部解析失败：\n' + errors.join('\n'));
    if (errors.length) log(errors.length + ' 条解析失败已跳过');
    let cur;
    try { cur = JSON.parse(el['xr-config'].value || ''); } catch (e) { cur = null; }
    if (!cur || typeof cur !== 'object' || !cur.outbounds) {
      try { cur = JSON.parse(await loadConfig()); } catch (e) { cur = null; }
      if (!cur || typeof cur !== 'object') cur = JSON.parse(DEFAULT_CONFIG);
    }
    uniqNames(nodes);
    const keep = (cur.outbounds || []).filter((o) => o && (o.protocol === 'freedom' || o.protocol === 'blackhole' || o.protocol === 'dns'));
    cur.outbounds = nodes.concat(keep);
    if (!cur.inbounds) cur.inbounds = JSON.parse(DEFAULT_CONFIG).inbounds;
    el['xr-config'].value = JSON.stringify(cur, null, 2);
    return '已导入 ' + nodes.length + ' 个节点（第 1 个为默认出站）：' + nodes.map((n) => n.tag).join('、') +
      '。请点「保存配置」写入设备，再点「重启」生效。';
  }

  /* ---------------- 节点列表（切换启用节点） ----------------
   * xray 默认出站 = outbounds 数组第一个；启用某节点即把它移到首位并重启核心。 */
  const PROXY_PROTOCOLS = ['vmess', 'vless', 'trojan', 'shadowsocks'];

  function proxyNodes(conf) {
    return (conf.outbounds || []).filter((o) => o && PROXY_PROTOCOLS.indexOf(o.protocol) >= 0);
  }

  function nodeDesc(n) {
    try {
      if (n.protocol === 'vmess' || n.protocol === 'vless') {
        return n.protocol + ' ' + n.settings.vnext[0].address + ':' + n.settings.vnext[0].port;
      }
      return n.protocol + ' ' + n.settings.servers[0].address + ':' + n.settings.servers[0].port;
    } catch (e) { return n.protocol + '（地址未解析）'; }
  }

  async function renderNodeList() {
    if (!el['xr-nodelist']) return;
    const raw = await loadConfig();
    let conf;
    try { conf = JSON.parse(raw); } catch (e) { throw new Error('config.json 不是有效 JSON，无法列出节点'); }
    const nodes = proxyNodes(conf);
    const box = el['xr-nodelist'];
    if (!nodes.length) {
      box.textContent = '（配置中还没有代理节点：先在「导入节点」区导入，或在「配置」区手工添加）';
      return;
    }
    const first = conf.outbounds[0];
    const activeTag = (first && PROXY_PROTOCOLS.indexOf(first.protocol) >= 0) ? (first.tag || '') : '';
    box.textContent = '';
    nodes.forEach((n) => {
      const tag = n.tag || '(未命名)';
      const isActive = tag === activeTag;
      const row = document.createElement('div');
      row.className = 'xr-nrow';
      const dot = document.createElement('span');
      dot.className = 'xr-ndot';
      dot.textContent = isActive ? '●' : '○';
      dot.style.color = isActive ? '#38c878' : '#64748b';
      const info = document.createElement('span');
      info.className = 'xr-ninfo';
      info.textContent = tag + ' · ' + nodeDesc(n) + (isActive ? ' · 当前启用' : '');
      const btn = document.createElement('button');
      if (isActive) { btn.textContent = '启用中'; btn.disabled = true; }
      else { btn.textContent = '启用'; btn.className = 'xr-primary'; btn.addEventListener('click', () => guard(() => activateNode(tag))); }
      row.appendChild(dot);
      row.appendChild(info);
      row.appendChild(btn);
      box.appendChild(row);
    });
    if (!activeTag) {
      const tip = document.createElement('div');
      tip.className = 'xr-nnote';
      tip.textContent = '当前默认出站不是代理节点（direct），点任意「启用」即恢复代理出站。';
      box.appendChild(tip);
    }
  }

  async function activateNode(tag) {
    const raw = await loadConfig();
    let conf;
    try { conf = JSON.parse(raw); } catch (e) { throw new Error('config.json 不是有效 JSON'); }
    const nodes = proxyNodes(conf);
    const node = nodes.find((n) => (n.tag || '') === tag);
    if (!node) throw new Error('未找到节点「' + tag + '」，请刷新列表后重试');
    const idx = conf.outbounds.indexOf(node);
    if (idx === 0) { await renderNodeList(); return '「' + tag + '」已是当前启用节点'; }
    conf.outbounds.splice(idx, 1);
    conf.outbounds.unshift(node);
    await writeFile(CFG, JSON.stringify(conf, null, 2));
    await stopCore();
    await wait(800);
    await startCore();
    await renderNodeList();
    return '已切换启用节点：' + tag + '（核心已重启生效）';
  }

  /* ---------------- 挂载（猫猫同款流程） ---------------- */
  (async () => {
    // 等页面容器就绪（猫猫同款：最多 100 次 × 100ms）
    let waitTimes = 0;
    while (!document.querySelector('.functions-container') && waitTimes < 100) {
      await wait(100);
      waitTimes++;
    }
    const container = document.querySelector('.functions-container');
    if (!container) {
      try { (typeof createToast === 'function') && createToast('Xray 面板初始化失败：未找到页面容器。', 'red'); } catch (e) {}
      return;
    }

    // 清理旧面板（防重复）
    const oldPanel = document.querySelector('#' + PANEL_ID);
    if (oldPanel) oldPanel.remove();
    const oldStyle = document.querySelector('#' + STYLE_ID);
    if (oldStyle) oldStyle.remove();

    // 样式（作用域限定在面板内，复用页面折叠类）
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + PANEL_ID + '{width:100%;margin-top:12px;}',
      '#' + PANEL_ID + ' *{box-sizing:border-box;}',
      '#' + PANEL_ID + ' .xr-box{padding:10px;border:1px solid rgba(148,163,184,.18);border-radius:16px;background:rgba(15,23,42,.36);}',
      '#' + PANEL_ID + ' .xr-status{white-space:pre-wrap;word-break:break-all;font-size:.6rem;line-height:1.6;margin:0 0 10px;padding:7px 9px;border:1px solid rgba(96,165,250,.22);border-radius:12px;background:rgba(15,23,42,.46);color:#bfdbfe;}',
      '#' + PANEL_ID + ' .xr-btns{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;}',
      '#' + PANEL_ID + ' .xr-btns>button{flex:1 1 30%;min-width:88px;min-height:34px;font-size:.62rem;font-weight:700;}',
      '#' + PANEL_ID + ' button{border:1px solid rgba(148,163,184,.25);border-radius:9px;padding:5px 9px;background:linear-gradient(180deg,rgba(51,65,85,.94),rgba(30,41,59,.94));color:#e5edf7;box-shadow:0 1px 0 rgba(255,255,255,.06) inset;cursor:pointer;}',
      '#' + PANEL_ID + ' button:hover{filter:brightness(1.08);}',
      '#' + PANEL_ID + ' button:disabled{opacity:.55;filter:grayscale(.35);}',
      '#' + PANEL_ID + ' .xr-primary{background:linear-gradient(180deg,rgba(37,99,235,.95),rgba(30,64,175,.95));border-color:rgba(147,197,253,.35);}',
      '#' + PANEL_ID + ' .xr-danger{background:linear-gradient(180deg,rgba(127,29,29,.95),rgba(69,10,10,.95));border-color:rgba(252,165,165,.35);}',
      '#' + PANEL_ID + ' details{border:1px solid rgba(148,163,184,.18);border-radius:14px;background:rgba(15,23,42,.44);overflow:hidden;margin-bottom:8px;}',
      '#' + PANEL_ID + ' details>summary{cursor:pointer;list-style:none;min-height:32px;padding:7px 9px;font-size:.62rem;font-weight:800;color:#dbeafe;background:rgba(30,41,59,.55);display:flex;align-items:center;justify-content:space-between;gap:8px;}',
      '#' + PANEL_ID + ' details>summary::after{content:\'+\';font-size:.72rem;opacity:.72;}',
      '#' + PANEL_ID + ' details[open]>summary::after{content:\'-\';}',
      '#' + PANEL_ID + ' details>summary::-webkit-details-marker{display:none;}',
      '#' + PANEL_ID + ' details>div{padding:9px;}',
      '#' + PANEL_ID + ' textarea{width:100%;background:#0e1320;color:#cfe3ff;border:1px solid #2a3550;border-radius:8px;padding:8px;font:11px/1.5 monospace;resize:vertical;}',
      '#' + PANEL_ID + ' .xr-config{height:180px;}',
      '#' + PANEL_ID + ' .xr-nodes{height:84px;}',
      '#' + PANEL_ID + ' .xr-logbox{width:100%;height:150px;overflow:auto;background:#0e1320;color:#9fd6a0;border:1px solid #2a3550;border-radius:8px;padding:8px;font:11px/1.5 monospace;white-space:pre-wrap;word-break:break-all;margin:0 0 8px;}',
      '#' + PANEL_ID + ' .xr-tip{color:#7d8ba1;font-size:.58rem;line-height:1.6;margin-top:6px;}',
      '#' + PANEL_ID + ' .xr-msg{display:none;color:#bfdbfe;font-size:.6rem;margin:8px 0 0;white-space:pre-wrap;word-break:break-all;padding:7px 9px;border-radius:10px;background:rgba(15,23,42,.5);border:1px solid rgba(96,165,250,.22);}',
      '#' + PANEL_ID + ' input[type=file]{font-size:.58rem;color:#9fb6d9;max-width:220px;}',
      '#' + PANEL_ID + ' .xr-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}',
      '#' + PANEL_ID + ' .xr-nrow{display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:6px;border:1px solid rgba(148,163,184,.2);border-radius:10px;background:rgba(15,23,42,.42);}',
      '#' + PANEL_ID + ' .xr-nrow .xr-ndot{flex:0 0 12px;font-size:.7rem;}',
      '#' + PANEL_ID + ' .xr-nrow .xr-ninfo{flex:1 1 auto;font-size:.6rem;line-height:1.5;color:#dbeafe;word-break:break-all;}',
      '#' + PANEL_ID + ' .xr-nrow button{flex:0 0 auto;min-height:28px;font-size:.58rem;}',
      '#' + PANEL_ID + ' .xr-nnote{font-size:.58rem;color:#e6b652;margin-top:4px;}'
    ].join('\n');
    document.head.appendChild(style);

    // 面板 HTML（猫猫同款结构：title 行 + collapse 折叠区）
    container.insertAdjacentHTML('afterend', `
<div id="${PANEL_ID}" class="kano-mm-root">
  <div class="title kano-mm-title">
    <div class="kano-mm-title-left"><strong id="running_xray">Xray</strong><span class="kano-mm-badge">Xray</span></div>
    <div style="display:inline-block;" id="collapse_xray_btn"></div>
  </div>
  <div class="collapse" id="collapse_xray" data-name="close" style="height:0px;overflow:hidden;">
    <div class="collapse_box kano-mm-box">
      <pre class="xr-status" id="xr-status">状态：读取中…</pre>
      <div class="xr-btns">
        <button id="xr-start" class="xr-primary">启动</button>
        <button id="xr-stop" class="xr-danger">停止</button>
        <button id="xr-restart">重启</button>
        <button id="xr-refresh">刷新状态</button>
      </div>
      <details>
        <summary><span>安装内核（Xray-linux-arm64 的 xray 文件）</span></summary>
        <div>
          <div class="xr-row">
            <input type="file" id="xr-file">
            <button id="xr-install" class="xr-primary">上传并安装</button>
          </div>
          <div class="xr-row" style="margin-top:8px;">
            <button id="xr-download" class="xr-primary">从网络下载内核（推荐）</button>
          </div>
          <div class="xr-tip">推荐直接点「从网络下载」：设备自动下载并安装内核，无需上传大文件。也可以上传 Xray-linux-arm64-v8a.zip（自动解压）或解压出的无后缀 xray 文件。安装完自动验证版本。</div>
        </div>
      </details>
      <details>
        <summary><span>导入节点（vmess/vless/trojan/ss 分享链接，可多行；或订阅地址）</span></summary>
        <div>
          <textarea class="xr-nodes" id="xr-nodes" placeholder="vmess://xxxx 每行一条，可批量粘贴&#10;也可以直接粘贴 http(s):// 订阅地址（设备端拉取）"></textarea>
          <div class="xr-row" style="margin-top:8px;">
            <button id="xr-import" class="xr-primary">解析导入到配置</button>
          </div>
          <div class="xr-tip">导入后第 1 个节点为默认出站；订阅通过设备端 curl 拉取，不经过第三方。Clash YAML 格式订阅暂不支持。</div>
        </div>
      </details>
      <details>
        <summary><span>节点列表（查看 / 切换启用节点）</span></summary>
        <div>
          <pre id="xr-nodelist" style="margin:0 0 8px;color:#dbeafe;font:11px/1.6 monospace;white-space:pre-wrap;word-break:break-all;">读取中…</pre>
          <div class="xr-row">
            <button id="xr-reloadnodes" class="xr-primary">刷新节点列表</button>
          </div>
          <div class="xr-tip">● 为当前启用节点（xray 默认出站）。点「启用」会把该节点移到首位并自动重启核心生效（已连接设备会断流几秒）。可随时切换。</div>
        </div>
      </details>
      <details>
        <summary><span>配置 config.json</span></summary>
        <div>
          <textarea class="xr-config" id="xr-config"></textarea>
          <div class="xr-row" style="margin-top:8px;">
            <button id="xr-loadconf">读取</button>
            <button id="xr-saveconf" class="xr-primary">保存配置</button>
            <button id="xr-defconf">恢复默认</button>
          </div>
          <div class="xr-tip">保存前自动做 JSON 语法校验；保存后需点上方「重启」生效。</div>
        </div>
      </details>
      <details>
        <summary><span>运行日志</span></summary>
        <div>
          <pre class="xr-logbox" id="xr-log"></pre>
          <div class="xr-row">
            <button id="xr-viewlog">查看 xray 日志</button>
            <button id="xr-clearlog" class="xr-danger">清空面板日志</button>
          </div>
        </div>
      </details>
      <details>
        <summary><span>开机自启 / 看门狗（重启后自动恢复）</span></summary>
        <div>
          <pre id="xr-autostat" style="margin:0 0 8px;color:#9fd6ff;font:11px/1.5 monospace;">自启状态：检测中…</pre>
          <div class="xr-row">
            <button id="xr-writestart" class="xr-primary">一键配置开机自启</button>
            <button id="xr-unstart" class="xr-danger">移除开机自启</button>
          </div>
          <div class="xr-tip">原理：把启动命令挂进 UFI-TOOLS 官方钩子 ${BOOT_FILE}（开机后执行）与 ${SCHED_FILE}（每 25~30 秒执行一次，兼作进程看门狗 + 全局接管核对）。只追加带标记的行，不会覆盖钩子文件原有内容。需已开启「高级功能」。点「开启全局接管」时会自动完成本配置，无需重复操作。</div>
        </div>
      </details>
      <details>
        <summary><span>全局接管（连 WiFi 设备免设置走代理）</span></summary>
        <div>
          <pre id="xr-global" style="margin:0 0 8px;color:#9fd6ff;font:11px/1.5 monospace;">全局接管：检测中…</pre>
          <div class="xr-row">
            <button id="xr-gon" class="xr-primary">开启全局接管</button>
            <button id="xr-goff" class="xr-danger">关闭接管</button>
          </div>
          <pre id="xr-modestat" style="margin:8px 0;color:#9fd6ff;font:11px/1.5 monospace;white-space:pre-wrap;">代理模式：检测中…</pre>
          <div class="xr-row">
            <button id="xr-mode-global" class="xr-primary">全局代理模式</button>
            <button id="xr-mode-rule" class="xr-primary">规则分流·绕过大陆</button>
            <button id="xr-geodl">下载分流规则库</button>
          </div>
          <div class="xr-tip">两种模式的区别：<br>· <b>全局代理</b>：所有流量都经节点出站（现状默认）。<br>· <b>规则分流·绕过大陆</b>：国内域名/IP 直连不走节点，其余走代理——更省流量，节点挂了国内仍可用。首次使用先点「下载分流规则库」（约 1MB，自动多源重试），下载完点「规则分流」即可；切换模式自动重启核心生效，接管开关与 iptables 不受影响。<br>开启接管时自动配置开机自启钩子并写入 .global_on 记忆，设备重启后自动拉起核心并恢复接管；打开管理页也会自动补拉起。节点不通时走代理的设备会断网（规则分流模式下国内不受影响），点「关闭接管」即恢复全部直连。非 53 端口的 UDP 流量（如 QUIC/游戏）不接管，应用会自动回退 TCP。</div>
        </div>
      </details>
      <div class="xr-msg" id="xr-msg"></div>
    </div>
  </div>
</div>
`);

    // 收集元素引用
    ['status', 'msg', 'file', 'nodes', 'config', 'log', 'global', 'autostat', 'modestat', 'nodelist',
      'start', 'stop', 'restart', 'refresh', 'install', 'download',
      'import', 'loadconf', 'saveconf', 'defconf', 'viewlog', 'clearlog', 'writestart', 'unstart',
      'gon', 'goff', 'mode-global', 'mode-rule', 'geodl', 'reloadnodes'
    ].forEach((k) => { el['xr-' + k] = document.getElementById('xr-' + k); });

    // 折叠开关（页面全局 collapseGen，猫猫同款用法；带自动补挂与自绘兜底）
    let collapseBound = false;
    function bindCollapse() {
      if (collapseBound) return;
      const btn = document.getElementById('collapse_xray_btn');
      if (!btn) return;
      if (btn.childElementCount > 0) { collapseBound = true; return; }
      try {
        if (typeof collapseGen === 'function') {
          collapseGen('#collapse_xray_btn', '#collapse_xray', 'collapse_xray', (e) => {
            if (e === 'open') refresh();
          });
          collapseBound = btn.childElementCount > 0;
        } else if (typeof createSwitch === 'function') {
          // 兜底：页面 collapseGen 不可用时用 createSwitch 自绘开关
          const sw = createSwitch({
            value: false, className: 'collapse_xray',
            onChange: (v) => {
              const c = document.getElementById('collapse_xray');
              if (!c) return;
              c.dataset.name = v ? 'open' : 'close';
              try { localStorage.setItem('collapse_xray', c.dataset.name); } catch (e) {}
              if (v) refresh();
            }
          });
          btn.appendChild(sw);
          collapseBound = true;
        }
      } catch (e) { console.error('Xray 面板折叠初始化失败', e); }
    }
    bindCollapse();

    // 事件绑定
    const on = (id, fn) => { const b = el[id]; if (b) b.addEventListener('click', fn); };

    on('xr-start', () => guard(startCore, '核心已启动'));
    on('xr-stop', () => guard(stopCore, '核心已停止'));
    on('xr-restart', () => guard(async () => { await stopCore(); await wait(800); await startCore(); return '核心已重启'; }));
    on('xr-refresh', () => guard(refresh));

    on('xr-install', () => guard(async () => {
      const f = el['xr-file'] && el['xr-file'].files && el['xr-file'].files[0];
      if (!f) throw new Error('请先选择 xray 内核文件（zip 或解压后的 xray 均可）');
      const v = await installFromUpload(f);
      if (el['xr-file']) el['xr-file'].value = '';
      return '安装完成：' + v;
    }));

    on('xr-download', () => guard(async () => {
      const v = await downloadCore();
      return '下载安装完成：' + v;
    }));

    on('xr-import', () => guard(async () => {
      const raw = (el['xr-nodes'] && el['xr-nodes'].value) || '';
      return applyNodesToConfig(raw);
    }));

    on('xr-loadconf', () => guard(async () => {
      el['xr-config'].value = await loadConfig();
      return '已读取设备上的 config.json';
    }));

    on('xr-saveconf', () => guard(async () => {
      await saveConfig(el['xr-config'].value || '');
      await renderNodeList().catch(() => {});
      return '配置已保存，点「重启」生效';
    }));

    on('xr-defconf', () => guard(() => {
      el['xr-config'].value = DEFAULT_CONFIG;
      return '已载入默认配置（示例节点），点「保存配置」写入设备';
    }));

    on('xr-viewlog', () => guard(async () => {
      const t = await tailLog(100);
      log('---- xray 日志末尾 ----\n' + t + '\n---- 结束 ----');
      return '';
    }));

    on('xr-clearlog', () => {
      if (el['xr-log']) el['xr-log'].textContent = '';
    });

    on('xr-writestart', () => guard(ensureAutoStart));
    on('xr-unstart', () => guard(removeAutoStart));

    on('xr-gon', () => guard(enableGlobal));
    on('xr-goff', () => guard(disableGlobal));
    on('xr-mode-global', () => guard(() => switchMode('global')));
    on('xr-mode-rule', () => guard(() => switchMode('rule')));
    on('xr-geodl', () => guard(downloadGeoData));
    on('xr-reloadnodes', () => guard(renderNodeList));

    // 初始化
    log('Xray 面板 v7.0 已加载（节点列表切换 + 规则分流 + 开机自启 + 接管记忆）。首次使用：安装内核 → 导入节点 → 启动 → 开全局接管');
    // 静默自恢复（幂等）：核心未运行则拉起；有 .global_on 则恢复全局接管状态
    try {
      const r = await sh('sh ' + START_SH_PATH + ' 2>/dev/null; echo __SREND__', 20000);
      if (r.indexOf('USER_STOPPED') >= 0) log('核心处于手动停止状态，不自动拉起（点「启动」恢复）');
      else if (r.indexOf('STARTED') >= 0) log('检测到核心未运行，已自动拉起');
      else if (r.indexOf('START_FAIL') >= 0) log('核心自动拉起失败，请查看 xray 日志或手动点「启动」');
      if (r.indexOf('GLOBAL_RESTORED') >= 0) log('已恢复上次记忆的全局接管状态');
      if (r.indexOf('GLOBAL_OK') >= 0) log('全局接管规则仍在，无需恢复');
    } catch (e) {
      log('自恢复检查跳过：' + ((e && e.message) || e));
    }
    await refresh();
    guard(renderNodeList).catch(() => {});
    if (statusTimer) clearInterval(statusTimer);
    statusTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      bindCollapse(); // 页面重绘/竞态冲掉开关时自动补挂
      // 面板本体被冲掉时也自动重建
      if (!document.getElementById(PANEL_ID)) { location.reload(); return; }
      refresh();
    }, 10000);
  })().catch((e) => console.error('Xray 面板初始化失败', e));
})(typeof runShellWithRoot === 'function' ? runShellWithRoot : null);
//</script >
