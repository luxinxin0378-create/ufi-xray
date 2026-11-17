# ufi-xray-panel

**UFI-TOOLS 的 Xray 面板插件** —— 给中兴 F50 / U30 Air 等展锐方案随身 WiFi（运行 [UFI-TOOLS](https://github.com/kanoqwq/UFI-TOOLS)）加一个网页端 Xray 管理面板：猫猫插件同款嵌入式卡片，全程浏览器操作，无需 SSH。

## 功能

- **嵌入式状态卡片**：主页显示 ● 运行状态（绿灯/PID/内核版本），点开关展开面板
- **内核安装**（v7.1 多源）：一键「从网络下载内核」——自动按序尝试 GitHub 镜像加速源 → 官方源，裸二进制/zip 均支持（zip 自动解压）；也可上传 `Xray-linux-arm64-v8a.zip` 或解压出的 `xray` 文件
- **节点导入**：粘贴 `vmess://` `vless://`（含 Reality）`trojan://` `ss://` 分享链接（多行批量）或 http(s) 订阅地址（设备端拉取，不经过第三方），自动解析写入配置
- **节点列表切换**（v7.0）：列出配置中所有节点，点「启用」即切换默认出站（自动改配置 + 重启核心生效）
- **两种代理模式**（v7.0）：「全局代理」与「规则分流·绕过大陆」（`geosite:cn`/`geoip:cn` 直连国内、其余走代理，DNS 双上游分流 + 透明流量嗅探）；「下载分流规则库」自动从 jsDelivr / GitHub 多源下载 lite 版并做内容校验
- **配置编辑**：面板内直接编辑 `config.json`，保存前自动 JSON 校验
- **运行日志**：面板内查看 xray 日志
- **开机自启 / 看门狗**（v6.3）：一键把启动命令挂进 UFI-TOOLS 官方钩子——
  - `/sdcard/ufi_tools_boot.sh`：设备开机后自动执行（拉起核心）
  - `/sdcard/ufi_tools_schedule.sh`：每 25~30 秒执行一次（进程看门狗 + 接管规则核对）
  - 只追加带标记的行，不覆盖钩子文件原有内容；可一键移除
- **全局接管**（亮点）：一键 iptables 透明代理——所有连上设备 WiFi 的终端**免设置自动走代理**，DNS 劫持到代理端解析，内网/管理页直连放行；开启时自动写 `.global_on` 记忆状态并挂自启钩子，**设备重启后自动恢复接管**
- **打开管理页自动恢复**：面板加载时自动检测核心是否存活、接管规则是否在位，缺了就静默补上（幂等，无副作用）
- **故障自愈**（v7.1）：规则库文件损坏（下载不完整/被错误页覆盖）时——校验环节当场删除坏文件；启动失败且日志指向 geo 文件问题时，**自动删除规则库并回退「全局代理」模式重新拉起**，设备必定能恢复工作

## 安装

1. 打开 UFI-TOOLS →「插件功能」（需开启高级功能）
2. 上传本仓库的 `ufi-xray-b1.js` → 点**「提交」**→ 刷新页面
3. 主页功能按钮下方出现 **● Xray** 卡片即成功

## 首次使用

1. 展开卡片 →「安装内核」→ 点「从网络下载内核」（全自动，约 33MB）或上传 [Xray-core Releases](https://github.com/XTLS/Xray-core/releases) 的 **`Xray-linux-arm64-v8a.zip`**
2. 「导入节点」粘贴你的 `vmess://` 链接（或订阅地址）→「解析导入到配置」；也可在「配置」区手工编辑（仓库内的 `config.json` 为示例模板，**节点参数需替换成你自己的**）
3. 「保存配置」→「启动」
4. 使用方式二选一：
   - **手动代理**：手机 WiFi 代理设为手动 `192.168.0.1 : 7890`
   - **全局接管**：展开卡片 →「全局接管」→ 开启，所有连 WiFi 的设备免设置直接用；开启时会自动完成开机自启配置，重启后一切照旧
   - **规则分流**：先点「下载分流规则库」（自动多源重试 + 内容校验），完成后点「规则分流·绕过大陆」

## 常见问题

- **之前下过规则库后核心起不来**（日志含 `geoip.dat` / `invalid body length`）：升级到 v7.1 后点「启动」即可——插件会自动删除损坏的规则库、回退全局代理模式并拉起核心；之后重新「下载分流规则库」再切规则分流即可
- **规则库下载一直失败**：设备网络访问 jsDelivr/GitHub 受限时，可在电脑上下载 `geoip-lite.dat` / `geosite-lite.dat`（[Loyalsoldier/v2ray-rules-dat](https://github.com/Loyalsoldier/v2ray-rules-dat/releases)）重命名为 `geoip.dat` / `geosite.dat` 放到设备 `/data/xray/` 目录
- **设备存储不足**：规则库下载前会检查 `/data` 剩余空间，不足 3MB 会提示先清理

## 说明与注意

- 本插件默认配置保留的是 **TCP + HTTP 伪装**（`vmess` 老式 `type=http`）的完整写法示例——这类节点在 Clash/mihomo 系工具里常因伪装参数丢失而超时，xray-core 原生完整支持
- 开机自启依赖 UFI-TOOLS 的「高级功能」开关（官方文档：开机自启/定时脚本仅在高级功能启用时生效）
- 开启全局接管后：节点不通时所有设备都会断网，点「关闭接管」即恢复直连（`.global_on` 会一并删除，重启后不会再恢复接管）
- 非 53 端口的 UDP 流量（QUIC/游戏）不接管，应用会自动回退 TCP
- 空间要求：`/data` 分区 ≥ 50MB 可用
- 仓库中不含任何真实节点信息（地址/UUID/Host 均为占位符），请自行填入自己的节点

## 致谢

- [UFI-TOOLS](https://github.com/kanoqwq/UFI-TOOLS) —— 随身 WiFi 管理框架（开机自启/定时脚本钩子机制）
- [Xray-core](https://github.com/XTLS/Xray-core) —— 代理内核
- [Loyalsoldier/v2ray-rules-dat](https://github.com/Loyalsoldier/v2ray-rules-dat) / [v2fly](https://github.com/v2fly) —— 分流规则库
- UI/插件框架参考自社区流行的猫猫 TProxy 插件

## 免责声明

本项目仅供学习与研究，请遵守所在地区法律法规，合法合规使用网络服务。
