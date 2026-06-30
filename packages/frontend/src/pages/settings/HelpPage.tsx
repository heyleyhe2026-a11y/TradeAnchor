import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, TextField, IconButton, Paper, Avatar, Chip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';

interface Message {
  id: number;
  role: 'bot' | 'user';
  content: string;
  timestamp: Date;
}

// Bilingual knowledge base: each key maps to { en, zh }
// Last optimized: 2026.06 — synced with production feature set
const KB: Record<string, { en: string; zh: string }> = {
  // === Registration & Login ===
  register: {
    en: 'TradeAnchor (mytradewiseoc.com) supports email registration and Google OAuth login. Registration requires: email, password (≥8 chars with uppercase, lowercase, number, and special character), and country/region selection. Email verification is required to unlock AI reports, Community Plaza publishing, AI follow-up, and leaderboard participation. Google OAuth users are pre-verified. After registration, visit the Growth Plan page to complete onboarding tasks and earn initial credits.',
    zh: 'TradeAnchor（mytradewiseoc.com）支持邮箱注册和 Google 一键登录。注册需填写：邮箱、密码（≥8 位，含大小写字母、数字和特殊字符）及国家/地区。邮箱验证后方可使用 AI 报告、社区广场发帖、AI 追问和参与排行榜。Google 登录用户默认已验证。注册后建议前往「成长计划」完成新手任务，获取初始积分并熟悉核心功能。',
  },
  login: {
    en: 'You can log in with email + password, or click the Google button for OAuth one-click login. Once logged in, features unlock based on your subscription tier. If login fails, check your network, confirm your email is verified, or use "Forgot Password" on the login page.',
    zh: '您可通过邮箱+密码登录，或点击 Google 按钮一键登录。登录后按订阅方案解锁对应功能。若无法登录，请检查网络、确认邮箱已验证，或在登录页使用「忘记密码」功能。',
  },
  password: {
    en: '**Password Reset (验证码重置):**\n\n**From Login page:** Click "Forgot password?" below the password field → Enter your registered email → Click "Send Verification Code" → Check your inbox for a **6-digit code** → Enter code + new password within **1 minute** → Click "Reset Password".\n\n**From Settings:** Sidebar → Settings → "Reset Password" section → Click "Change Password" → Same flow (code sent to your registered email).\n\n**Rules:**\n• Code expires in 60 seconds — request a new code if expired\n• New password: ≥8 chars with uppercase, lowercase, number, and special character (@$!%*?&)\n• Google-only accounts can also set a password this way to enable email login\n• Need help? support@mytradewiseoc.com',
    zh: '**密码重置（验证码方式）：**\n\n**登录页入口：** 密码框下方点击「忘记密码？」→ 输入注册邮箱 → 点击「发送验证码」→ 在收件箱查收 **6 位数字验证码** → 在 **1 分钟内** 输入验证码和新密码 → 点击「重置密码」。\n\n**设置页入口：** 侧边栏 → 系统设置 →「密码重置」区域 → 点击「修改密码」→ 同样流程（验证码发送至注册邮箱）。\n\n**规则说明：**\n• 验证码 60 秒有效，过期请重新发送\n• 新密码：≥8 位，含大小写字母、数字和特殊字符（@$!%*?&）\n• 纯 Google 登录的账户也可通过此方式设置密码，启用邮箱登录\n• 需要帮助请联系 support@mytradewiseoc.com',
  },
  verify: {
    en: 'Email verification is mandatory to activate premium features. After registration, a verification email is sent automatically to your inbox — click the link inside to complete verification. Didn\'t receive it? Check your spam folder first, then use the "Resend Verification Email" button on the dashboard banner or Settings page. Your verification status is shown on the Subscription/Growth Plan page.',
    zh: '邮箱验证是激活高级功能的必要步骤。注册成功后会自动向您的收件箱发送验证邮件——点击邮件中的链接即可完成验证。如果未收到？请先检查垃圾邮件文件夹，然后在仪表板顶栏或设置页面找到"重新发送验证邮件"按钮。您的验证状态可在订阅管理/成长计划页面查看。',
  },
  oauth: {
    en: 'TradeAnchor currently supports **Google OAuth** login. Click the Google button on the Login or Register page to authorize — your account is created and linked automatically with no separate password needed. Google OAuth accounts are pre-verified and can use premium features immediately after login.',
    zh: 'TradeAnchor 目前支持 **Google 一键登录**。在登录或注册页面点击 Google 按钮完成授权——系统自动创建并关联账户，无需单独设置密码。Google 登录账号默认已验证，登录后即可使用高级功能。',
  },

  // === Dashboard Overview ===
  dashboard: {
    en: 'The Dashboard is your trading command center at mytradewiseoc.com. It displays:\n• **Welcome Header**: Personalized greeting and subtitle.\n• **Filter Bar**: Filter by Symbol (e.g., EURUSD, XAUUSD), Direction (Long/Short), Start/End Date.\n• **7 KPI Cards**: Total Trades, Total Investment, Total P&L, Win Rate, Avg P&L, Profit Factor, ROI — all color-coded green/red based on performance.\n• **Performance Breakdown**: Wins/Losses/Break-even counts plus Avg Win vs Avg Loss comparison.\n• **Quick Access**: Shortcuts to Add Trade, AI Reports, Trading Diary, Strategy Market.\n• **P&L Curve Chart**: Cumulative return (green area) + Monthly P&L (purple dashed) over time.\n• **Best/Worst Trade Cards**: Top performers and biggest losers by absolute P&L.\n• **Top Symbols Table**: Ranked list of symbols by total P&L with trade count.\n• **Trading Calendar**: Heatmap view of your trading activity filtered by current selections.',
    zh: '仪表板是您在 mytradewiseoc.com 上的交易指挥中心，包含以下模块：\n• **欢迎区**：个性化问候语。\n• **筛选栏**：按标的（如 EURUSD、XAUUSD）、方向（多头/空头）、起止日期过滤数据。\n• **7 大 KPI 卡片**：总交易数、总投资、总盈亏、胜率、平均盈亏、利润因子、ROI —— 全部根据表现以绿色/红色标识。\n• **绩效拆解面板**：盈利/亏损/持平次数 + 平均盈利 vs 平均亏损对比。\n• **快捷入口**：添加交易、AI 报告、交易日记、策略市场的快速导航。\n• **盈亏曲线图**：累计收益（绿色填充区域）+ 月度盈亏（紫色虚线）随时间变化趋势。\n• **最佳/最差交易卡片**：按绝对盈亏金额显示的顶级表现和最大亏损交易。\n• **热门标的表格**：按总盈亏排名的标的列表及交易次数。\n• **交易日历**：根据当前筛选条件展示的交易活动热力图视图。',
  },
  dashboardStats: {
    en: 'Dashboard KPI Cards explained:\n• **Trades**: Total number of recorded trades in the filtered period.\n• **Investment**: Sum of capital at risk = entry price × quantity ÷ leverage.\n• **Total P&L**: Net profit/loss after commission and swap (gross P&L minus all fees).\n• **Win Rate**: Percentage of trades with net P&L > 0.\n• **Avg P&L**: Average net P&L per trade.\n• **Profit Factor**: Sum of winning net P&L ÷ absolute sum of losing net P&L (∞ if no losses).\n• **ROI**: Net P&L ÷ total investment × 100%. Leverage affects investment only — it does not multiply P&L.\nAll stats update instantly when you change filters (symbol, direction, date range).',
    zh: '仪表板 KPI 指标卡详解：\n• **Trades（交易数）**：筛选时间段内的记录总数。\n• **Investment（总投资）**：风险资金 = 入场价 × 数量 ÷ 杠杆。\n• **Total P&L（总盈亏）**：扣除手续费与隔夜费后的净盈亏。\n• **Win Rate（胜率）**：净盈亏 > 0 的交易占比。\n• **Avg P&L（平均盈亏）**：每笔交易的平均净盈亏。\n• **Profit Factor（利润因子）**：盈利净额之和 ÷ 亏损净额绝对值之和（无亏损时为 ∞）。\n• **ROI（投资回报率）**：净盈亏 ÷ 总投资 × 100%。杠杆仅影响投入计算，不放大盈亏。\n更改任意筛选条件（标的、方向、日期范围）后，所有指标即时刷新。',
  },
  dashboardFilter: {
    en: 'Use the Dashboard Filter Bar to narrow down your analysis:\n• **Symbol**: Type a ticker symbol (e.g., XAUUSD, EURUSD, BTCUSD) to filter by instrument.\n• **Direction**: Choose Long (buy), Short (sell), or leave blank for all directions.\n• **Start/End Date**: Pick date range to analyze a specific period. All dashboard widgets (stats, P&L curve, best/worst trades, top symbols, calendar) respond to these filters in real time.',
    zh: '使用仪表板筛选栏缩小分析范围：\n• **Symbol（标的）**：输入代码（如 XAUUSD、EURUSD、BTCUSD）按品种过滤。\n• **Direction（方向）**：选择多头（买入）、空头（卖出）或不选则包含所有方向。\n• **起止日期**：选择日期范围分析特定时段。所有仪表板组件（统计卡片、盈亏曲线、最佳/最差交易、热门标的、日历）都会实时响应这些筛选条件。',
  },

  // === Trade Records ===
  trade: {
    en: '**Manual trade entry:** Sidebar → Trade Records (or Dashboard Quick Access) → "Add Trade" → Fill in: Symbol (e.g., XAUUSD), Direction (Long/Short), Entry/Exit Price, Quantity, Leverage (default 1), Commission, Swap, Entry/Exit Time → Create.\n\n**List management:** Filter by symbol, direction, date range; sort by date/P&L/symbol; paginated view (20 per page).\n\n**Batch actions:** Multi-select trades → Batch update leverage, or batch delete.\n\n**Free tier limit:** Max 500 trades total per account (not monthly). Pro/Premium: unlimited.',
    zh: '**手动录入：** 侧边栏 → 交易记录（或仪表板快捷入口）→「添加交易」→ 填写：标的（如 XAUUSD）、方向（多/空）、入场/出场价、数量、杠杆（默认 1）、手续费、隔夜费、入场/出场时间 → 创建。\n\n**列表管理：** 支持按标的、方向、日期筛选；按日期/盈亏/标的排序；分页展示（每页 20 条）。\n\n**批量操作：** 多选交易后可批量修改杠杆或批量删除。\n\n**免费版限制：** 账户内最多 500 条交易记录（总量限制，非按月重置）。专业版/高级版：无限。',
  },
  import: {
    en: '**Bulk Import** (CSV / Excel .xlsx / .xls) — 4-step wizard on Trade Records page:\n1. **Select broker preset** + upload file\n2. **Column mapping** (auto-detect + manual adjust)\n3. **Preview** (first 100 rows)\n4. **Confirm import**\n\n**Supported broker presets (8):** Generic CSV, MetaTrader 4, MetaTrader 5, cTrader, Interactive Brokers (IBKR), Charles Schwab, Futu/Moomoo, Tiger Securities.\n\n**Smart handling:** MT4/MT5 Profit column is net P&L (auto-converted to gross); cTrader Volume is in units (÷100,000 = lots); IBKR infers direction from closing side; configurable source timezone and quote currency.\n\nImported trades count toward the Free tier\'s 500-trade account limit.',
    zh: '**批量导入**（CSV / Excel .xlsx / .xls）—— 交易记录页四步向导：\n1. **选择券商预设** + 上传文件\n2. **列映射**（自动识别 + 手动调整）\n3. **预览**（前 100 行）\n4. **确认导入**\n\n**支持的券商预设（8 种）：** 通用 CSV、MetaTrader 4、MetaTrader 5、cTrader、盈透证券（IBKR）、Charles Schwab、富途/Moomoo、老虎证券。\n\n**智能处理：** MT4/MT5 的 Profit 列为净盈亏（自动还原为毛盈亏）；cTrader 的 Volume 为单位数（÷100,000 = 手数）；IBKR 根据平仓方向推断多空；可设置源时区和默认计价货币。\n\n导入的交易计入免费版 500 条账户总量限制。',
  },
  export: {
    en: '**Export options in TradeAnchor:**\n• **AI Reports**: Export any generated report as PDF from the AI Reports page.\n• **Credits Center**: Export credit transaction history as CSV (Growth Plan → click credits badge → Credits Center).\n• **Trade data**: Backend supports CSV/JSON export API; contact support@mytradewiseoc.com if you need a full data export.\n\nExported trade data includes symbol, direction, prices, quantities, dates, gross/net P&L, commission, swap, and ROI.',
    zh: '**TradeAnchor 数据导出方式：**\n• **AI 报告**：在 AI 报告页面可将已生成的报告导出为 PDF。\n• **积分中心**：在成长计划点击积分徽标进入积分中心，可导出积分流水 CSV。\n• **交易数据**：后端支持 CSV/JSON 导出接口；如需完整交易数据导出，请联系 support@mytradewiseoc.com。\n\n交易数据导出字段包括：标的、方向、价格、数量、日期、毛/净盈亏、手续费、隔夜费和 ROI。',
  },

  // === AI Reports ===
  ai: {
    en: 'AI Reports (sidebar → Analysis Center → AI Reports) use advanced AI models to analyze your trading data. Capabilities include:\n• Win rate & P&L breakdown by symbol, direction, holding period\n• Behavioral bias detection (overtrading, revenge trading, FOMO)\n• Personalized improvement suggestions\n• Asset-category-specific modules (US Stocks, Forex, Crypto, Futures, Mixed)\n\n**Monthly quota:** Free = 5, Pro = 50, Premium = 100. Beyond quota: 100 credits/report (confirmation dialog required). Reports can be exported as PDF.',
    zh: 'AI 报告（侧边栏 → 分析中心 → AI 报告）利用先进 AI 模型分析您的交易数据，核心能力：\n• 按标的、方向、持仓周期的胜率与盈亏拆解\n• 行为偏差检测（过度交易、报复性交易、FOMO 等）\n• 个性化改进建议\n• 按资产品类定制分析模块（美股、外汇、加密货币、期货、混合）\n\n**月度配额：** 免费版 5 次、专业版 50 次、高级版 100 次。超额部分 100 积分/份（需确认弹窗）。报告支持导出 PDF。',
  },
  aiReport: {
    en: 'Two report types are available when generating:\n\n**1. Deep Report (深度报告)**: Full multi-dimensional analysis — performance summary, pattern recognition, strengths/weaknesses, risk assessment, asset-specific insights, and actionable recommendations. Best for thorough periodic review.\n\n**2. Quick Report (快速报告)**: Snapshot-style analysis with key sentiment, support/resistance levels, short-term bias, stop-loss hints, and core risks. Best for fast check-ins.\n\nSelect asset category (US Stocks / Forex / Crypto / Futures / Mixed) and report type before generating. When monthly quota is exhausted, each extra report costs 100 credits with a mandatory confirmation dialog.',
    zh: '生成时可选择两种报告类型：\n\n**1. 深度报告（Deep Report）**：完整多维度分析——绩效概览、模式识别、优劣势、风险评估、品类专项洞察和可操作建议。适合全面定期复盘。\n\n**2. 快速报告（Quick Report）**：快照式分析，包含市场情绪、关键支撑/压力位、短期偏向、止损提示和核心风险。适合快速查看。\n\n生成前可选择资产品类（美股/外汇/加密货币/期货/混合）和报告类型。月度配额用尽后，每份额外报告消耗 100 积分，扣费前必须确认。',
  },
  aiFollowup: {
    en: 'AI Follow-up enables interactive deep-dive conversations after generating an AI report. Ask follow-up questions like "Why did my XAUUSD trades underperform?" or "How can I improve my exit strategy?"\n\n⚠️ **Critical Limitation**: Free tier users have ZERO access to AI Follow-up — this feature requires Pro or Premium subscription. Pro: 50 follows/month, Premium: 100 follows/month. When quota is exceeded, each follow-up costs 50 credits with a mandatory confirmation dialog showing cost and balance details.\n\nThis is one of the most powerful features for serious traders who want actionable insights beyond the initial report.',
    zh: 'AI 追问功能让您在生成 AI 报告后进行交互式深度对话。可以追问诸如"为什么我的 XAUUSD 交易表现不佳？"或"如何改进我的出场策略？"等问题。\n\n⚠️ **重要限制**：免费版用户**完全没有** AI 追问权限 —— 此功能必须订阅专业版或高级版才可使用。配额：专业版 50 次/月，高级版 100 次/月。额度用尽后每次追问消耗 50 积分，必须经过确认弹窗（显示成本和余额详情）才能扣费。\n\n这是认真交易者在初始报告之外获得可操作洞察的最强大功能之一。',
  },

  // === Credits System ===
  credit: {
    en: 'The Credits system extends usage beyond your plan quotas:\n\n**Earning Credits:**\n• Growth Plan tasks (e.g., first trade +300, first AI report +200, first post +200, first diary +100, verify email +50, import data +100)\n• Advanced task progress rewards (AI reports, follow-ups, posts, diary entries — up to 100 credits/action, max 2/day per task type)\n• Trade creation earnings (daily cap: 10 credits/day)\n\n**Spending Credits:**\n• Extra AI Report (beyond quota): **100 credits/report**\n• Extra AI Follow-up (beyond quota): **50 credits/follow-up**\n• Community attachment download (Free tier only): images free; PDF/Office = 100; MT4/MT5 scripts (.mq4/.ex4/.mq5/.ex5) = 200\n\n**Rules:** Credits expire 30 days after earning. Every deduction shows a confirmation dialog. Pro/Premium users download all community attachments for free.\n\n**View:** Growth Plan → click credits badge → Credits Center (history + CSV export).',
    zh: '积分系统用于在套餐配额之外扩展使用：\n\n**获取积分：**\n• 成长计划任务（如：首笔交易 +300、首份 AI 报告 +200、首帖 +200、首篇日记 +100、验证邮箱 +50、导入数据 +100）\n• 进阶任务进度奖励（AI 报告、追问、发帖、写日记等，每次最多 100 积分，每类任务每日上限 2 次）\n• 创建交易记录（每日上限 10 积分）\n\n**消耗积分：**\n• 超额 AI 报告：**100 积分/份**\n• 超额 AI 追问：**50 积分/次**\n• 社区附件下载（仅免费版）：图片免费；PDF/Office 文档 100 积分；MT4/MT5 源码（.mq4/.ex4/.mq5/.ex5）200 积分\n\n**规则：** 积分获取后 30 天有效。每次扣费前弹出确认弹窗。专业版/高级版用户下载社区附件全部免费。\n\n**查看：** 成长计划 → 点击积分徽标 → 积分中心（流水记录 + CSV 导出）。',
  },
  creditConfirm: {
    en: '**Credit Confirmation Dialog Explained:** This is a user-protection mechanism — TradeAnchor will NEVER silently deduct credits. Whenever you attempt an action that requires credits (extra AI report or follow-up beyond quota), a modal popup appears with four pieces of information:\n\n1. **Operation Name**: e.g., "Generate AI Report" or "AI Follow-up"\n2. **Cost**: Exact credit amount (100 or 50)\n3. **Current Balance**: Your available credits right now\n4. **Status**: Green checkmark (sufficient) or red warning (insufficient)\n\nOnly when you explicitly click the "Confirm" button will credits be deducted and the action proceed. If balance is insufficient, you\'ll see a link to visit the Credits Center to check details or find ways to earn more.',
    zh: '**积分确认弹窗说明：** 这是用户保护机制 —— TradeAnchor 绝不会在未经确认的情况下静默扣减积分。每当您尝试需要消耗积分的操作（超额 AI 报告或追问）时，模态弹窗会展示四项信息：\n\n1. **操作名称**：例如"生成 AI 报告"或"AI 追问"\n2. **消耗量**：精确的积分数值（100 或 50）\n3. **当前余额**：您当前的可用积分\n4. **状态**：绿色勾号（充足）或红色警告（不足）\n\n只有在您明确点击「确认」按钮后，系统才会扣除积分并继续执行操作。如果余额不足，将显示跳转链接前往积分中心查看详情或寻找赚取更多积分的途径。',
  },

  // === Playbooks / Community Plaza ===
  playbook: {
    en: '**Community Plaza (社区广场)** — sidebar → Journal → Community Plaza.\n\n**Tabs:** Browse Plaza, My Purchases, My Views, My Posts, New Post.\n\n**Features:**\n• Markdown editor with inline images and file attachments (PDF, Office, MT4/MT5 scripts, images, video — max 10MB/file)\n• 30+ preset tags (strategy type, asset class, analysis method)\n• Link related symbols/instruments\n• Comments & replies on post detail pages\n• Favorites, view counts, search & tag filtering\n\n**Publishing:** All email-verified users can publish free posts. Paid post pricing is a planned Premium feature (currently all posts are free).\n\n**Attachment downloads:** Pro/Premium = all free; Free tier = images free, documents 100 credits, MT scripts 200 credits.',
    zh: '**社区广场（Community Plaza）** — 侧边栏 → 日记 → 社区广场。\n\n**页面标签：** 广场浏览、我的购买、我的浏览、我的发布、发新帖。\n\n**功能：**\n• Markdown 编辑器，支持内嵌图片和附件（PDF、Office、MT4/MT5 源码、图片、视频等，单文件 ≤10MB）\n• 30+ 预设标签（策略类型、资产类别、分析方法）\n• 关联合约/标的代码\n• 帖子详情页支持评论与回复\n• 收藏、浏览量统计、搜索与标签筛选\n\n**发布权限：** 已完成邮箱验证的用户均可发布免费帖子。付费帖子定价为高级版规划功能（当前所有帖子均为免费）。\n\n**附件下载：** 专业版/高级版全部免费；免费版图片免费，文档 100 积分，MT 源码 200 积分。',
  },
  publishPlaybook: {
    en: '**Publishing a post:**\n1. Sidebar → Community Plaza → "New Post" tab\n2. Fill in:\n   • **Title** (required)\n   • **Description** (summary)\n   • **Content** (required, Markdown)\n   • **Tags** (strategy type, asset, analysis method)\n   • **Related Symbol** (optional)\n   • **Attachments** (optional: .pdf, .doc/.docx, .xls/.xlsx, .mq4/.ex4/.mq5/.ex5, images, .mp4)\n3. Click **Publish** — goes live immediately\n\n**Notes:**\n• Posts cannot be self-edited after publishing (contact support@mytradewiseoc.com for corrections)\n• All content must include risk disclaimers — no guaranteed return claims\n• Post authors earn 50% of credits spent by others downloading their attachments',
    zh: '**发布帖子步骤：**\n1. 侧边栏 → 社区广场 →「发新帖」标签\n2. 填写：\n   • **标题**（必填）\n   • **概述**（摘要）\n   • **内容**（必填，Markdown 格式）\n   • **标签**（策略类型、资产类别、分析方法）\n   • **关联标的**（可选）\n   • **附件**（可选：.pdf、.doc/.docx、.xls/.xlsx、.mq4/.ex4/.mq5/.ex5、图片、.mp4）\n3. 点击 **发布** —— 即刻上线\n\n**注意事项：**\n• 发布后暂不支持自行修改（修正请联系 support@mytradewiseoc.com）\n• 内容须包含风险提示，不得承诺保证收益\n• 帖子作者可获得他人下载附件所消耗积分的 50% 作为奖励',
  },

  // === Subscription & Plans (UPDATED 2026.06) ===
  subscription: {
    en: 'TradeAnchor offers **three subscription tiers**:\n\n| Tier | Price | Trade Limit | AI Reports | AI Follow-up | Key Extras |\n|------|-------|------------|-----------|-------------|------------|\n| **Free** | $0 | 500 total | 5/mo | ❌ Blocked | Dashboard, Calendar, Import, CS bot |\n| **Pro** | $19/mo or ¥139/mo | Unlimited | 50/mo | 50/mo | Full analytics, free attachment downloads |\n| **Premium** | $29/mo or ¥299/mo | Unlimited | 100/mo | 100/mo | 2× AI quota, paid posts (planned), API (planned) |\n\n**Upgrade:** Sidebar → Subscription → Select tier → Redirect to FastSpring checkout. Upgrade is immediate; downgrade applies next billing cycle.\n\nVisit **mytradewiseoc.com/pricing** for current pricing.',
    zh: 'TradeAnchor 提供 **三种订阅方案**：\n\n| 方案 | 价格 | 交易上限 | AI 报告 | AI 追问 | 核心特权 |\n|------|------|---------|--------|--------|----------|\n| **免费版** | $0 | 500 条（总量） | 5 次/月 | ❌ 不可用 | 仪表板、日历、导入、客服机器人 |\n| **专业版** | $19/月 或 ¥139/月 | 无限 | 50 次/月 | 50 次/月 | 完整分析、附件免费下载 |\n| **高级版** | $29/月 或 ¥299/月 | 无限 | 100 次/月 | 100 次/月 | 2 倍 AI 配额、付费帖（规划中）、API（规划中） |\n\n**升级路径**：侧边栏 → 订阅管理 → 选择方案 → 跳转 FastSpring 结账。升级即时生效，降级下一周期生效。\n\n请访问 **mytradewiseoc.com/pricing** 查看最新定价。',
  },
  upgrade: {
    en: 'Subscription management rules:\n• **Upgrade (Free→Pro/Premium)**: Immediate effect. Redirects to FastSpring secure checkout (credit/debit cards supported).\n• **Downgrade**: Takes effect at the NEXT billing cycle start. Current tier features remain until then.\n• **Auto-renewal**: Toggle on/off in Subscription page.\n• **Cancellation**: Cancel anytime; access continues until the paid period ends.\n• **Refund**: Prorated refunds available within 7 days of subscription start — contact support@mytradewiseoc.com.\n\nManage: Sidebar → Subscription.',
    zh: '订阅管理规则：\n• **升级（免费→专业/高级）**：即时生效，跳转 FastSpring 安全结账（支持信用卡/借记卡）。\n• **降级**：下一计费周期开始时生效，当前周期内保持完整权限。\n• **自动续费**：在订阅管理页可开关。\n• **取消订阅**：随时取消，付费期内继续享有访问权限。\n• **退款**：订阅开始后 7 天内可申请按比例退款 —— 联系 support@mytradewiseoc.com。\n\n管理入口：侧边栏 → 订阅管理。',
  },
  planFree: {
    en: '**Free Tier (免费版)** — Great for getting started:\n\n✅ **Included:** Up to 500 trades (account total), 5 AI reports/month, full dashboard (7 KPI cards, P&L curve, calendar, filters), CSV/Excel import, trading diary, community browsing & free posting, customer service bot, AI report PDF export.\n\n❌ **Not included:** AI Follow-up (blocked), unlimited trades, free community attachment downloads (images only), priority support.\n\n💡 Upgrade to Pro ($19/mo) when you need AI follow-up or exceed 500 trades.',
    zh: '**免费版** —— 适合初次体验：\n\n✅ **包含**：账户最多 500 条交易（总量）、每月 5 次 AI 报告、完整仪表板（7 个 KPI、盈亏曲线、日历、筛选）、CSV/Excel 导入、交易日记、社区浏览与免费发帖、客服机器人、AI 报告 PDF 导出。\n\n❌ **不包含**：AI 追问（不可用）、无限交易、社区附件免费下载（仅图片免费）、优先客服。\n\n💡 需要 AI 追问或超过 500 条交易时，建议升级专业版（$19/月）。',
  },
  planPro: {
    en: '**Pro Tier (专业版)** — $19/month or ¥139/month:\n\n✅ **Included:** Unlimited trades, 50 AI reports/month, 50 AI follow-ups/month, full dashboard analytics, trading calendar, CSV/Excel import, trading diary, community posting, **free community attachment downloads**, AI report PDF export.\n\n🔄 **Credit overflow:** Extra reports = 100 credits, extra follow-ups = 50 credits (confirmation dialog required).\n\n❌ **Not included:** Paid post pricing, API access, white-label export, priority support.\n\n💡 Best value for active traders who want AI insights and interactive follow-up.',
    zh: '**专业版** —— $19/月 或 ¥139/月：\n\n✅ **包含**：无限交易记录、每月 50 次 AI 报告、50 次 AI 追问、完整仪表板分析、交易日历、CSV/Excel 导入、交易日记、社区发帖、**社区附件免费下载**、AI 报告 PDF 导出。\n\n🔄 **积分溢出**：超额报告 100 积分/次，超额追问 50 积分/次（需确认弹窗）。\n\n❌ **不包含**：付费帖子定价、API 接口、白标导出、优先客服。\n\n💡 活跃交易者性价比之选，可获得 AI 分析与交互式追问。',
  },
  planPremium: {
    en: '**Premium Tier (高级版)** — $29/month or ¥299/month:\n\n✅ **All Pro features PLUS:**\n• 100 AI reports/month (2× Pro)\n• 100 AI follow-ups/month (2× Pro)\n• Free community attachment downloads\n• Paid post publishing (planned)\n• API access (planned)\n• White-label export (planned)\n• Priority support (planned)\n\n🔄 **Credit overflow:** Same rates as Pro when exceeding 100/month quotas.\n\n💡 Best for power users who need maximum AI capacity and future premium creator tools.',
    zh: '**高级版** —— $29/月 或 ¥299/月：\n\n✅ **专业版全部功能 +：**\n• 每月 100 次 AI 报告（专业版 2 倍）\n• 每月 100 次 AI 追问（专业版 2 倍）\n• 社区附件免费下载\n• 付费帖子发布（规划中）\n• API 接口（规划中）\n• 白标导出（规划中）\n• 优先客服（规划中）\n\n🔄 **积分溢出**：超出 100 次/月配额后，费率同专业版。\n\n💡 适合需要最大 AI 配额和未来创作者工具的深度用户。',
  },

  // === Permission Matrix ===
  permissionMatrix: {
    en: '**TradeAnchor Feature Permission Matrix** (2026.06):\n\n| Feature | Free | Pro ($19) | Premium ($29) |\n|---------|:----:|:---------:|:------------:|\n| Trade Limit | 500 total | Unlimited | Unlimited |\n| AI Reports / Month | 5 | 50 | 100 |\n| AI Follow-ups / Month | **❌ 0** | 50 | 100 |\n| Extra Report Cost | 100 credits | 100 credits | 100 credits |\n| Extra Follow-up Cost | N/A | 50 credits | 50 credits |\n| Community Post (Free) | ✅ | ✅ | ✅ |\n| Community Post (Paid) | ❌ | ❌ | Planned |\n| Attachment Download | Images only | ✅ All free | ✅ All free |\n| API Access | ❌ | ❌ | Planned |\n| White-label Export | ❌ | ❌ | Planned |\n| Priority Support | ❌ | ❌ | Planned |\n| Dashboard Analytics | ✅ Full | ✅ Full | ✅ Full |\n| CSV/Excel Import | ✅ | ✅ | ✅ |\n| AI Report PDF Export | ✅ | ✅ | ✅ |\n\n**Credit Rule**: Quota-exceeded operations always show a confirmation dialog before charging.',
    zh: '**TradeAnchor 功能权限矩阵**（2026.06 更新）：\n\n| 功能项 | 免费版 | 专业版($19) | 高级版($29) |\n|--------|:----:|:---------:|:------------:|\n| 交易上限 | 500 条总量 | 无限 | 无限 |\n| AI 报告/月 | 5 | 50 | 100 |\n| AI 追问/月 | **❌ 0** | 50 | 100 |\n| 超额报告成本 | 100积分/次 | 100积分/次 | 100积分/次 |\n| 超额追问成本 | 不适用 | 50积分/次 | 50积分/次 |\n| 社区发帖(免费) | ✅ | ✅ | ✅ |\n| 社区发帖(付费) | ❌ | ❌ | 规划中 |\n| 附件下载 | 仅图片免费 | ✅ 全部免费 | ✅ 全部免费 |\n| API 接口 | ❌ | ❌ | 规划中 |\n| 白标导出 | ❌ | ❌ | 规划中 |\n| 优先客服 | ❌ | ❌ | 规划中 |\n| 仪表板分析 | ✅ 完整 | ✅ 完整 | ✅ 完整 |\n| CSV/Excel 导入 | ✅ | ✅ | ✅ |\n| AI 报告 PDF 导出 | ✅ | ✅ | ✅ |\n\n**积分规则**：超出配额的操作均在扣费前展示确认弹窗。',
  },

  // === Growth Plan (Rewards) ===
  rewards: {
    en: '**Growth Plan (成长计划)** — sidebar → Account → Growth Plan.\n\n**Newbie tasks & rewards:**\n• First trade: +300 credits\n• First post: +200 credits\n• First AI report: +200 credits\n• First diary entry: +100 credits\n• Verify email: +50 credits\n• Import data: +100 credits\n\n**Advanced tasks:** Generate 5 AI reports (+500), 10 AI follow-ups (+1000), publish 3 posts (+300), write 7 diary entries (+700), first post browse (+300). Progress actions also earn per-action credits (100 each, max 2/day per type).\n\n**Badges:** Earned automatically on task completion, displayed on your profile.\n\n**Credits Center:** Growth Plan → click credits badge → view history & export CSV.',
    zh: '**成长计划** — 侧边栏 → 账户 → 成长计划。\n\n**新手任务与奖励：**\n• 首笔交易：+300 积分\n• 首帖发布：+200 积分\n• 首份 AI 报告：+200 积分\n• 首篇日记：+100 积分\n• 验证邮箱：+50 积分\n• 导入数据：+100 积分\n\n**进阶任务：** 生成 5 份 AI 报告（+500）、10 次 AI 追问（+1000）、发布 3 帖（+300）、写 7 篇日记（+700）、首次浏览帖子（+300）。进行中的操作也可获单次积分（每次 100，每类每日上限 2 次）。\n\n**徽章：** 完成任务自动获得，展示在个人资料页。\n\n**积分中心：** 成长计划 → 点击积分徽标 → 查看流水并导出 CSV。',
  },
  leaderboard: {
    en: '**Leaderboards (排行榜)** on the Growth Plan page:\n\n1. **Return Rate Leaderboard** — ROI ranking across 1M / 3M / 6M / 12M periods\n2. **Publisher Leaderboard** — top post authors\n3. **Sales Leaderboard** — top sellers\n4. **Views Leaderboard** — most-viewed posts\n\n**ROI ranking rules:**\n• Metric: ROI = net P&L ÷ investment × 100%\n• Period: closed trades by exit date (or entry date per your Settings → Calendar basis)\n• Minimum: 5 closed trades AND ≥$100 total investment in the period\n• Must opt-in via Settings → "Participate in Return Rate Leaderboard"\n• Email must be verified\n• Only display name shown (privacy protected)',
    zh: '**排行榜**（成长计划页面）：\n\n1. **收益率榜** — 1月/3月/6月/12月 ROI 排名\n2. **发布者榜** — 发帖数量排名\n3. **销售榜** — 销售额排名\n4. **浏览量榜** — 帖子浏览量排名\n\n**收益率榜规则：**\n• 指标：ROI = 净盈亏 ÷ 投入 × 100%\n• 周期：按平仓日统计（也可在设置中切换为按开仓日）\n• 门槛：周期内至少 5 笔已平仓交易且总投入 ≥ $100\n• 须在设置中开启「参与收益率排行榜」\n• 邮箱须已验证\n• 仅显示昵称，保护隐私',
  },
  roiMetrics: {
    en: '**ROI & P&L formulas (unified across TradeAnchor):**\n\n• **Gross P&L** = (exit − entry) × quantity (long; reversed for short) — stored in each trade.\n• **Net P&L** = gross P&L − commission − swap.\n• **Investment** = entry price × quantity ÷ leverage.\n• **ROI** = sum of net P&L ÷ sum of investment × 100%.\n\nLeverage affects investment only — it does **not** multiply P&L. Manual trade preview shows gross P&L; the trade list shows gross P&L, commission, swap, and net columns.',
    zh: '**ROI 与盈亏公式（全站统一）：**\n\n• **毛盈亏** = (出场价 − 入场价) × 数量（空头反向）— 存于每笔交易。\n• **净盈亏** = 毛盈亏 − 手续费 − 隔夜费。\n• **投入** = 入场价 × 数量 ÷ 杠杆。\n• **ROI** = 净盈亏之和 ÷ 投入之和 × 100%。\n\n杠杆只影响投入计算，**不会**放大盈亏。手动录入预览显示毛盈亏；交易列表展示毛盈亏、手续费、隔夜费与净盈利列。',
  },

  // === Other Features ===
  calendar: {
    en: '**Trading Calendar (交易日历)** — sidebar → Analysis Center → Trading Calendar.\n\n• **Heatmap view**: Green = profitable days, red = losing days, gray = no trades. Color intensity reflects P&L magnitude.\n• **Daily details**: Click any day to see trade count, P&L, investment, and ROI for that day.\n• **Time range**: Default 3-month view, adjustable.\n• **Dashboard version**: Embedded calendar on Dashboard responds to symbol/direction/date filters.\n• **Calendar basis setting**: Settings → "Calendar grouped by" → choose Exit Date (default) or Entry Date. This also affects leaderboard ROI calculations.\n\nUse it to spot overtrading clusters, dry spells, and winning/losing streaks.',
    zh: '**交易日历** — 侧边栏 → 分析中心 → 交易日历。\n\n• **热力图视图**：绿色=盈利日，红色=亏损日，灰色=无交易。颜色深浅反映盈亏幅度。\n• **日详情**：点击日期查看当日交易笔数、盈亏、投入和 ROI。\n• **时间范围**：默认展示 3 个月，可切换。\n• **仪表板版本**：仪表板内嵌日历响应标的/方向/日期筛选。\n• **日历分组设置**：设置 →「日历按」→ 选择平仓日（默认）或开仓日，此设置也影响排行榜 ROI 计算。\n\n用于识别过度交易期、空仓期和连胜/连败模式。',
  },
  diary: {
    en: 'The **Trading Journal/Diary (交易日记)** is your personal trading psychology lab:\n\n**What to record per trade:**\n• Emotional state before/during/after the trade (confident, fearful, FOMO, etc.)\n• Market observations (news events, technical levels, sentiment)\n• Rationale for entry and exit decisions\n• Lessons learned or mistakes to avoid\n\n**AI Integration**: Diary entries feed into your AI reports — the AI analyzes journal patterns alongside trade data to detect behavioral biases (revenge trading, overconfidence, hesitation patterns).\n\n**Best practice**: Write diary notes within 30 minutes of closing each trade while memories are fresh. Over time, your diary becomes an invaluable resource for reviewing what works and what doesn\'t in your trading approach.',
    zh: '**交易日记（Trading Journal/Diary）** 是您专属的交易心理实验室：\n\n**每笔交易应记录的内容：**\n• 交易前/中/后的心理状态（自信、恐惧、FOMO 等）\n• 市场观察（新闻事件、技术位、市场情绪）\n• 进场和出场决策的理由\n• 经验教训或需要避免的错误\n\n**AI 集成**：日记内容会被纳入您的 AI 报告分析 —— AI 结合日记模式和交易数据检测行为偏差（报复性交易、过度自信、犹豫不决模式）。\n\n**最佳实践**：在平仓后 30 分钟内撰写日记笔记，趁记忆犹新。随着时间的推移，日记将成为复盘哪些方法有效、哪些无效的无价资源。',
  },
  aiConfidence: {
    en: '**AI Trading Confidence (AI 交易置信度)** — Dashboard card with 4 dimension scores (0–100%):\n\n**1. Execution Consistency (执行一致性)** — Higher is better (green ≥70%):\n• Split all trades by entry time into first half vs second half\n• Compare win rates of both halves: score = max(0, 100 − |WR₁ − WR₂| × 200)\n• Bonus: + overall win rate × 30\n• Meaning: stable performance across time periods\n\n**2. Risk Exposure (风险暴露度)** — Higher is better:\n• Investment per trade = entry price × quantity ÷ leverage\n• Score = max(0, 100 − (max position ÷ avg position − 1) × 50)\n• Meaning: position sizes are relatively balanced (no extreme outliers)\n\n**3. Concentration Risk (集中度风险)** — Higher is better:\n• Based on number of unique symbols and max single-symbol trade share\n• Score = min(100, (unique symbols ÷ max(trades×0.3, 5)) × 60 + (1 − max symbol %) × 40)\n• Meaning: diversified across instruments, not over-concentrated on one symbol\n\n**4. Over-trading Severity (过度交易)** — Lower is better (displayed as risk, red = high):\n• trades per active day: <2 → low, 2–4 → medium, ≥4 → high (up to 95%)\n• Meaning: identifies days with excessive trade frequency\n\n**Overall score** = Consistency×35% + Risk Exposure×25% + Concentration×20% + (100 − Over-trading)×20%',
    zh: '**AI 交易置信度** — 仪表板卡片，展示 4 个维度评分（0–100%）：\n\n**1. 执行一致性** — 越高越好（≥70% 为绿色）：\n• 按入场时间将所有交易分为前半段和后半段\n• 比较两段胜率：得分 = max(0, 100 − |胜率₁ − 胜率₂| × 200)\n• 加成：+ 整体胜率 × 30\n• 含义：不同时段表现是否稳定\n\n**2. 风险暴露度** — 越高越好：\n• 每笔投入 = 入场价 × 数量 ÷ 杠杆\n• 得分 = max(0, 100 − (最大单笔投入 ÷ 平均投入 − 1) × 50)\n• 含义：仓位大小是否均衡（无极端大额交易）\n\n**3. 集中度风险** — 越高越好：\n• 基于交易品种数量和单一品种最大占比\n• 得分 = min(100, (品种数 ÷ max(交易数×0.3, 5)) × 60 + (1 − 最大品种占比) × 40)\n• 含义：是否分散在不同品种，避免过度集中于单一标的\n\n**4. 过度交易严重度** — 越低越好（红色=高风险）：\n• 每日交易笔数：<2 低、2–4 中、≥4 高（最高 95%）\n• 含义：识别交易频率过高的日子\n\n**综合得分** = 执行一致性×35% + 风险暴露度×25% + 集中度×20% + (100 − 过度交易)×20%',
  },
  tradeLeverage: {
    en: '**How to modify leverage on trade records:**\n\n**Single trade (manual entry/edit):**\n1. Trade Records → Click "Add Trade" (or edit an existing trade)\n2. Fill in the **Leverage** field (default: 1)\n3. Save — investment and ROI recalculate automatically\n\n**Batch update (multiple trades):**\n1. Trade Records → Check the boxes on the left of trades to select\n2. Click **"Batch Update Leverage (N)"** button in the toolbar\n3. Enter the new leverage value (integer ≥ 1)\n4. Confirm — all selected trades update at once\n\n**Note:** Leverage affects investment calculation (entry price × quantity ÷ leverage) but does NOT multiply P&L. MT4/MT5/cTrader imports default to leverage 1.',
    zh: '**交易记录修改杠杆的操作指引：**\n\n**单条修改（手动录入/编辑）：**\n1. 交易记录 → 点击「添加交易」（或编辑已有交易）\n2. 填写 **杠杆** 字段（默认 1）\n3. 保存 — 投入金额和 ROI 自动重新计算\n\n**批量修改（多条交易）：**\n1. 交易记录 → 勾选左侧复选框选中要修改的交易\n2. 点击工具栏 **「批量修改杠杆 (N)」** 按钮\n3. 输入新的杠杆值（整数 ≥ 1）\n4. 确认 — 所有选中交易的杠杆一次性更新\n\n**说明：** 杠杆仅影响投入计算（入场价 × 数量 ÷ 杠杆），不会放大盈亏。MT4/MT5/cTrader 导入默认杠杆为 1。',
  },
  dashboardPnl: {
    en: 'The **P&L Curve Chart (收益曲线图)** is located on the Dashboard between the Performance Breakdown and the Best/Worst Trades sections:\n\n**Visual elements:**\n• **Green filled area (cumulative)**: Shows cumulative P&L starting from zero — watch the overall trajectory of your trading journey.\n• **Purple dashed line (monthly)**: Shows month-by-month P&L volatility — identify which months were winners or losers.\n• **Dual Y-axis**: Left axis for cumulative P&L, right axis for monthly P&L.\n• **Interactive hover**: Hover over data points to see exact values for any month.\n• **Zero baseline**: Always starts from origin (0,0) so the curve reflects true net performance.\n\n**Pro tip**: Combine with the filter bar to isolate specific instruments (e.g., filter to XAUUSD only) and see how that single instrument contributes to your overall P&L curve.',
    zh: '**盈亏曲线图（P&L Curve Chart）** 位于仪表板的绩效拆解面板和最佳/最差交易卡片之间：\n\n**视觉元素：**\n• **绿色填充区域（累计）**：展示从零开始的累计盈亏 —— 观察整个交易旅程的整体走势。\n• **紫色虚线（月度）**：展示逐月盈亏波动 —— 快速识别哪些月份是赢家或输家。\n• **双 Y 轴**：左侧轴为累计盈亏，右侧轴为月度盈亏。\n• **悬停交互**：鼠标悬停在数据点上可查看任何月份的确切数值。\n• **零基线**：始终从原点 (0,0) 开始绘制，确保曲线反映真实净绩效。\n\n**专业技巧**：结合筛选栏隔离特定标的（如只筛选 XAUUSD），观察单个品种对整体盈亏曲线的贡献情况。',
  },
  riskDisclaimer: {
    en: 'A **Risk Disclaimer Banner (风险提示横幅)** is prominently displayed on key pages including the Landing Page, Login page, and Register page at mytradewiseoc.com.\n\n**Core message**: TradeAnchor\'s AI analysis tools (reports, follow-up suggestions, pattern detection) are provided for **informational and educational purposes only**. They do NOT constitute investment advice, financial recommendations, or buy/sell signals.\n\n**Your responsibility**: All trading decisions are solely your own. Financial markets involve substantial risk of loss. Past performance shown in analytics does not guarantee future results.\n\n**Legal context**: TradeAnchor is an analytics tool, not a licensed financial advisory service. Please consult qualified professionals before making financial decisions.',
    zh: '**风险提示横幅（Risk Disclaimer Banner）** 显眼地展示在首页、登录页和注册页等关键页面（mytradewiseoc.com）。\n\n**核心信息**：TradeAnchor 的 AI 分析工具（报告、追问建议、模式检测）仅供**信息参考和教育用途**。它们**不构成**投资建议、金融推荐或买卖信号。\n\n**您的责任**：所有交易决策完全由您自己承担。金融市场存在重大损失风险。分析中展示的历史业绩不代表未来结果。\n\n**法律声明**：TradeAnchor 是一款分析工具，并非持牌金融顾问服务。在做财务决定之前，请咨询合格的专业人士。',
  },
  language: {
    en: 'TradeAnchor supports **Simplified Chinese (简体中文)** and **English**:\n\n**How to switch**: Click the language selector in the top navigation bar (globe icon) on any page — including login, register, pricing, and the main app. Your preference is saved automatically.\n\n**What changes**: All UI labels, tooltips, error messages, notifications, and AI report output language follow your selection.\n\n**Customer Service bot**: Responds in the detected language of your query (Chinese question → Chinese answer, English → English).',
    zh: 'TradeAnchor 支持 **简体中文** 和 **English** 双语：\n\n**切换方式**：点击顶部导航栏的语言切换器（地球图标），登录页、注册页、定价页和主应用均可切换，偏好自动保存。\n\n**影响范围**：界面标签、提示文字、错误信息、通知和 AI 报告输出语言均跟随所选语言。\n\n**客服机器人**：根据您提问的语言自动匹配回复（中文提问→中文回答，英文提问→英文回答）。',
  },
  data: {
    en: '**Data Security & Privacy at TradeAnchor (mytradewiseoc.com):**\n\n• **Encryption**: All data is encrypted at rest (AES-256) and in transit (TLS 1.3).\n• **Storage**: Hosted on secure cloud infrastructure with regular automated backups.\n• **No sharing**: We never sell, rent, or share your personal trading data with third parties.\n• **Data ownership**: Your data belongs to you — export it anytime via CSV/JSON.\n• **Retention**: Even on Free tier, your data is retained as long as your account exists.\n• **Deletion**: Account deletion permanently removes all associated data per GDPR principles.\n• **Compliance**: We follow industry-standard security practices and data protection regulations.',
    zh: '**TradeAnchor（mytradewiseoc.com）的数据安全与隐私保护：**\n\n• **加密存储**：所有数据静态加密（AES-256）和传输加密（TLS 1.3）。\n• **托管环境**：托管于安全的云基础设施之上，配有定期自动备份。\n• **绝不共享**：我们永远不会出售、出租或向第三方分享您的个人交易数据。\n• **数据所有权**：您的数据归您所有 —— 随时可通过 CSV/JSON 导出。\n• **数据保留**：即使在免费版，只要您的账户存在，数据就会保留。\n• **删除权**：删除账户将按照 GDPR 原理永久移除所有关联数据。\n• **合规遵循**：我们遵循行业标准的安​​全实践和数据保护法规。',
  },
  settings: {
    en: '**Settings (设置)** — sidebar → Account → Settings.\n\n**Profile:** Update display name and avatar (PNG/JPG, max 5MB).\n\n**Preferences:**\n• Display timezone (affects date/time display)\n• Report base currency (USD, CNY, etc.)\n• Calendar grouping basis: Exit Date or Entry Date\n• Leaderboard opt-in: participate in Return Rate rankings\n\n**Notifications:** Email and push toggles for AI report ready alerts and P&L alerts.\n\n**Language:** Use the top-bar language switcher (not in Settings).\n\nFor account deletion or data export requests, contact support@mytradewiseoc.com.',
    zh: '**系统设置** — 侧边栏 → 账户 → 系统设置。\n\n**个人资料：** 修改显示名称和头像（PNG/JPG，≤5MB）。\n\n**偏好设置：**\n• 显示时区（影响日期时间展示）\n• 报告基准货币（USD、CNY 等）\n• 日历分组依据：平仓日或开仓日\n• 参与收益率排行榜开关\n\n**通知设置：** AI 报告就绪提醒、盈亏提醒的邮件/推送开关。\n\n**语言切换：** 使用顶部导航栏语言切换器（不在设置页内）。\n\n账户注销或完整数据导出需求，请联系 support@mytradewiseoc.com。',
  },
  payment: {
    en: '**Payment & Billing:**\n\nTradeAnchor subscriptions are processed via **FastSpring**, a secure global payment platform.\n\n**How to subscribe:** Sidebar → Subscription (or visit mytradewiseoc.com/pricing) → Select Pro ($19/mo) or Premium ($29/mo) → Redirect to FastSpring checkout → Pay with credit/debit card.\n\n**Billing:**\n• Pro: $19/month (¥139/month reference)\n• Premium: $29/month (¥299/month reference)\n• Auto-renewal managed in Subscription page\n• Upgrade: immediate; Downgrade: next billing cycle\n\n**Refund policy:** Prorated refunds within 7 days of subscription start. Contact support@mytradewiseoc.com.\n\n**Human support:** support@mytradewiseoc.com',
    zh: '**支付与账单：**\n\nTradeAnchor 订阅通过 **FastSpring** 安全支付平台处理。\n\n**订阅流程：** 侧边栏 → 订阅管理（或访问 mytradewiseoc.com/pricing）→ 选择专业版（$19/月）或高级版（$29/月）→ 跳转 FastSpring 结账 → 信用卡/借记卡支付。\n\n**账单说明：**\n• 专业版：$19/月（参考价 ¥139/月）\n• 高级版：$29/月（参考价 ¥299/月）\n• 自动续费在订阅管理页控制\n• 升级即时生效；降级下一周期生效\n\n**退款政策：** 订阅开始后 7 天内可申请按比例退款，联系 support@mytradewiseoc.com。\n\n**人工客服：** support@mytradewiseoc.com',
  },
  website: {
    en: 'TradeAnchor official website: **https://mytradewiseoc.com**\n\nOur platform helps traders of all levels record, analyze, and improve their trading performance using AI-powered analytics. Whether you trade Forex (EURUSD, GBPUSD), Commodities (XAUUSD, XAGUSD), Crypto (BTCUSD, ETHUSD), or Indices (SPX500, US30) — TradeAnchor supports all major asset classes.\n\nFor business inquiries, partnership proposals, or enterprise licensing, contact us at support@mytradewiseoc.com.',
    zh: 'TradeAnchor 官方网站：**https://mytradewiseoc.com**\n\n我们的平台帮助各级别交易者使用 AI 驱动的分析工具记录、分析和提升交易绩效。无论您交易外汇（EURUSD、GBPUSD）、大宗商品（XAUUSD、XAGUSD）、加密货币（BTCUSD、ETHUSD）还是指数（SPX500、US30）—— TradeAnchor 支持所有主流资产类别。\n\n商务合作、合作伙伴提案或企业许可请联系 support@mytradewiseoc.com。',
  },
};

/** Detect whether query is primarily English (true) or Chinese (false) */
function isEnglishQuery(query: string): boolean {
  const latin = (query.match(/[a-zA-Z]/g) || []).length;
  const cjk = (query.match(/[\u4e00-\u9fff]/g) || []).length;
  return latin > cjk;
}

function findAnswer(query: string): string | null {
  const q = query.toLowerCase();

  // Ordered keyword rules — more specific terms first, broader ones later
  const rules: [RegExp[], string][] = [
    // Register & Auth
    [[/sign\s*up/, /register/, /账号/, /注册/], 'register'],
    [[/login/, /signin/, /登入/, /登录/], 'login'],
    [[/password/, /reset/, /重置/, /密码/, /忘记密码/, /forgot/], 'password'],
    [[/ai.*confidence|置信|置信度|执行一致性|风险暴露|集中度|过度交易/], 'aiConfidence'],
    [[/leverage|杠杆|批量.*杠杆|batch.*leverage/], 'tradeLeverage'],
    [[/verif/, /验证/, /verify.*email/], 'verify'],
    [[/oauth/, /google/, /第三方/, /一键登录/], 'oauth'],

    // === Dashboard (HIGH PRIORITY — must precede AI to avoid false matches) ===
    [[/dashboard|仪表板|主页|首页概览|kpi|指标卡|统计卡片/], 'dashboard'],
    [[/stats?|指标|kpi.*card|数据概览|七.*卡|7.*card|winrate|胜率|profit.?factor|利润因子/], 'dashboardStats'],
    [[/roi|投资回报|收益率.*公式|net.*pnl|净盈亏.*计算|leverage.*pnl|杠杆.*盈亏/], 'roiMetrics'],
    [[/filter|筛选|过滤|symbol.*filter|日期.*范围|direction.*filter/], 'dashboardFilter'],

    // === Subscription & Plans (HIGH PRIORITY) ===
    [[/plan(s)?\s*(are|available|option|tier|offer|exist)/i, /什么.*方案/, /哪些.*方案/, /方案.*有/, /available.*plan/i], 'subscription'],
    [[/subscri/, /订阅/, /pricing/, /方案/, /会员/, /tier/], 'subscription'],
    [[/upgrade/, /downgrade/, /升级.*方案/, /降级/], 'upgrade'],
    [[/\bfree\b/, /\bfree.*tier/, /免费/, /基础/], 'planFree'],
    [[/\bpro\b/, /\$19/, /¥139/, /专业/], 'planPro'],
    [[/\bpremium\b/, /\$29/, /¥299/, /高级/, /vip/], 'planPremium'],
    [[/pay(ment)?|bill(?:ing)?|付费|支付|账单|扣款|退款|fastspring|stripe|paypal/], 'payment'],
    [[/mt4|mt5|ctrader|ibkr|schwab|futu|tiger|券商|broker|盈透|富途|老虎/], 'import'],
    [[/website|官网|网址|域名|mytradewiseoc\.com|TradeAnchor.*com/], 'website'],

    // Trades
    [[/add.*trade/, /new.*trade/, /添加.*交易/, /记录.*交易/], 'trade'],
    [[/trade/, /记录/, /trading/], 'trade'],
    [[/import/, /csv/, /excel/, /批量/, /上传.*文件/], 'import'],
    [[/export/, /导出/, /download/, /下载/], 'export'],

    // AI Reports — use \b boundaries to avoid matching "ai" inside words like "available"
    [[/ai.*(deep|dive|深度|深入|quick|快速)/, /deep.*report/, /quick.*report/, /深度.*报告/, /快速.*报告/, /生成.*报告/], 'aiReport'],
    [[/ai.*report/, /ai.*报告/, /report.*generat/], 'aiReport'],
    [[/follow.?up/, /追问/, /followup/], 'aiFollowup'],
    [[/\bai\b/, /智能/, /复盘/, /gpt/, /claude/, /gemini/], 'ai'],
    [[/报告/], 'ai'],

    // Credits
    [[/credit/, /credits/, /积分/, /点数/, /points/], 'credit'],
    [[/确认|confirm.*credit|credit.*confirm|扣费前|消耗.*积分/, /积分确认/], 'creditConfirm'],

    // Playbooks
    [[/publish.*playbook/, /发布.*策略/, /上传.*playbook/], 'publishPlaybook'],
    [[/playbook/, /社区/, /广场/, /帖子/, /策略/, /marketplace/, /手册/], 'playbook'],
    [[/附件|attachment|下载.*附件|mq4|ex4/], 'playbook'],

    // Permission Matrix
    [[/permission/, /权限/, /矩阵/, /matrix/, /配额|quota|额度.*多少/, /free.*follow.?up|免费.*追问/], 'permissionMatrix'],

    // Rewards
    [[/reward/, /growth.*plan/, /成长/, /任务/, /task/, /徽章/, /新手/], 'rewards'],
    [[/leaderboard/, /排行/, /ranking/, /收益.*排/], 'leaderboard'],

    // Other Features
    [[/calendar/, /日历/, /交易日/], 'calendar'],
    [[/diary/, /journal/, /笔记/, /日记/], 'diary'],
    [[/pnl|收益曲线|盈亏.*曲线|cumulative|累计.*收益/], 'dashboardPnl'],
    [[/risk.*disclaimer|风险提示|免责声明|investment.*advice|投资.*建议/], 'riskDisclaimer'],
    [[/language/, /语言/, /中文/, /english|多语言|切换.*语言/], 'language'],
    [[/data.*secur/, /privacy/, /隐私/, /数据安全/, /safe/], 'data'],
    [[/setting(s)?|设置|偏好|profile|个人资料|通知.*设置|安全.*设置/], 'settings'],
  ];

  for (const [patterns, key] of rules) {
    if (patterns.some(p => p.test(q))) {
      const entry = KB[key];
      if (!entry) continue;
      return isEnglishQuery(query) ? entry.en : entry.zh;
    }
  }

  return null;
}

function getFallbackResponse(isEn: boolean): string {
  return isEn
    ? "I couldn't find an exact match, but you can try these topics:\n• Dashboard overview & KPI cards\n• How to add/import trades (MT4/MT5/cTrader/IBKR etc.)\n• AI Reports (Quick/Deep) & Follow-up\n• Subscription plans (Free/Pro/Premium) & FastSpring payment\n• Credits system & Growth Plan tasks\n• Community Plaza & attachments\n• Trading calendar & journal diary\n• Settings, language, data security\n\nOr email us: support@mytradewiseoc.com"
    : '我没有找到完全匹配的答案。您可以尝试以下话题：\n• 仪表板概览与 KPI 指标卡\n• 如何添加/导入交易（MT4/MT5/cTrader/IBKR 等）\n• AI 报告（快速/深度）与追问\n• 订阅方案（免费/专业/高级）与 FastSpring 支付\n• 积分系统与成长计划任务\n• 社区广场与附件下载\n• 交易日历与交易日记\n• 设置、语言、数据安全\n\n或发送邮件：support@mytradewiseoc.com';
}

export default function HelpPage() {
  const { t } = useTranslation();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'bot',
      content: t('cs.welcomeMessage'),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 800));

    const answerKey = findAnswer(text);
    const answer = answerKey ?? getFallbackResponse(isEnglishQuery(text));

    const botMsg: Message = {
      id: Date.now() + 1,
      role: 'bot',
      content: answer,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <Paper sx={{ borderRadius: 3, px: 3, py: 2.5, mb: 2, bgcolor: '#161b22', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: 'linear-gradient(135deg,#00d4aa,#00a888)', width: 44, height: 44 }}>
          <SupportAgentIcon sx={{ color: '#0a0e17' }} />
        </Avatar>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>
            TradeAnchor {t('cs.title')}
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 12.5 }}>
            {t('cs.subtitle')}
          </Typography>
        </Box>
        <Chip label={t('cs.online')} size="small" sx={{ ml: 'auto', bgcolor: '#059669', color: '#fff', fontWeight: 600, fontSize: 11 }} />
      </Paper>

      {/* Messages Area */}
      <Paper
        sx={{
          flex: 1, overflowY: 'auto', px: 2.5, py: 2, mb: 2,
          borderRadius: 3, bgcolor: '#0d1117',
          border: '1px solid rgba(255,255,255,0.06)',
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 10 },
        }}
      >
        {/* Quick suggestions */}
        {messages.length <= 1 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', mb: 1.5 }}>
              {t('cs.quickTopics')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {[
                { key: 'cs.topicRegister', query: t('cs.qRegister') },
                { key: 'cs.topicTrade', query: t('cs.qTrade') },
                { key: 'cs.topicAI', query: t('cs.qAI') },
                { key: 'cs.topicPlan', query: t('cs.qPlan') },
                { key: 'cs.topicImport', query: t('cs.qImport') },
                { key: 'cs.topicCredit', query: t('cs.qCredit') },
              ].map(item => (
                <Chip
                  key={item.key}
                  label={item.query}
                  variant="outlined"
                  size="small"
                  clickable
                  onClick={() => { setInput(item.query); }}
                  sx={{
                    borderColor: 'rgba(0,212,170,0.35)',
                    color: '#cbd5e1',
                    '&:hover': { bgcolor: 'rgba(0,212,170,0.08)', borderColor: '#00d4aa', color: '#00d4aa' },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {messages.map(msg => (
          <Box key={msg.id} sx={{ display: 'flex', gap: 1.5, mb: 2, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'bot' && (
              <Avatar sx={{ width: 32, height: 32, flexShrink: 0, bgcolor: 'linear-gradient(135deg,#00d4aa,#00a888)' }}>
                <SupportAgentIcon sx={{ fontSize: 18, color: '#0a0e17' }} />
              </Avatar>
            )}
            <Box sx={{
              maxWidth: '75%',
              px: 2.2, py: 1.4, borderRadius: 3,
              bgcolor: msg.role === 'user' ? '#00d4aa' : '#1a2332',
              border: msg.role === 'bot' ? '1px solid rgba(255,255,255,0.1)' : 'none',
              color: msg.role === 'user' ? '#0a0e17' : '#e8edf5',
              fontSize: 14,
              lineHeight: 1.75,
              wordBreak: 'break-word',
              ...(msg.role === 'user' ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }),
            }}>
              <Typography sx={{ whiteSpace: 'pre-line', fontSize: 14, color: 'inherit', fontWeight: 400 }}>{msg.content}</Typography>
              {msg.role === 'bot' && (
                <Box sx={{ mt: 1, pt: 0.8, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton size="small" sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}>
                    <ThumbDownIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11.5 }}>
                    {t('cs.notSatisfiedHint')}
                  </Typography>
                </Box>
              )}
            </Box>
            {msg.role === 'user' && (
              <Avatar sx={{ width: 32, height: 32, flexShrink: 0, bgcolor: '#374151' }}>
                <PersonIcon sx={{ fontSize: 18, color: '#9ca3af' }} />
              </Avatar>
            )}
          </Box>
        ))}

        {isTyping && (
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
            <Avatar sx={{ width: 32, height: 32, flexShrink: 0, bgcolor: 'linear-gradient(135deg,#00d4aa,#00a888)' }}>
              <SupportAgentIcon sx={{ fontSize: 18, color: '#0a0e17' }} />
            </Avatar>
            <Box sx={{ px: 2.2, py: 1.4, borderRadius: 3, borderBottomLeftRadius: 4, bgcolor: '#1a2332', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Box sx={{ display: 'flex', gap: 0.5, py: 0.3 }}>
                {[0, 1, 2].map(i => (
                  <Box key={i} sx={{
                    width: 7, height: 7, borderRadius: '50%', bgcolor: '#94a3b8',
                    animation: `bounce 1s ease-in-out ${i * 0.16}s infinite`,
                  }} />
                ))}
              </Box>
              <style>{'@keyframes bounce{0%,80%,100%{transform:scale(0.6);opacity:.4}40%{transform:scale(1);opacity:1}}'}</style>
            </Box>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Paper>

      {/* Contact email hint */}
      <Box sx={{
        px: 2, py: 1.5, mb: 1.5, borderRadius: 2,
        bgcolor: 'rgba(234,179,8,0.04)', border: '1px solid rgba(234,179,8,0.12)',
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        <EmailIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
        <Typography variant="body2" sx={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5, flex: 1 }}>
          {t('cs.contactHint', 'Need human support? Email us at')}
          <Typography component="span" sx={{ color: '#fbbf24', fontWeight: 600, mx: 0.5, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            onClick={() => window.location.href = 'mailto:support@mytradewiseoc.com'}
          >
            support@mytradewiseoc.com
          </Typography>
        </Typography>
      </Box>

      {/* Input Area */}
      <Paper sx={{ p: 1.5, borderRadius: 3, bgcolor: '#161b22', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          fullWidth multiline maxRows={3}
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('cs.inputPlaceholder')}
          slotProps={{
            input: {
              disableUnderline: true,
              sx: { '& textarea': { color: '#e8edf5', fontSize: 14, '&::placeholder': { color: '#64748b' } } },
            },
          }}
          sx={{ flex: 1 }}
        />
        <IconButton
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          sx={{
            bgcolor: input.trim() ? '#00d4aa' : 'transparent',
            color: input.trim() ? '#0a0e17' : '#475569',
            minWidth: 42, height: 42,
            borderRadius: 2,
            transition: 'all .2s',
            '&:hover:not(:disabled)': { bgcolor: '#00eebb', transform: 'scale(1.05)' },
            '&:disabled': { color: '#334155' },
          }}
        >
          <SendIcon />
        </IconButton>
      </Paper>
    </Box>
  );
}
