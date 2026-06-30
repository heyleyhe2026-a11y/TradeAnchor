# AI 多模型集成使用指南

## 🎯 支持的AI模型

### OpenAI (GPT系列)
| 模型ID | 显示名称 | 用途 | 最大Token |
|--------|---------|------|----------|
| `gpt-4o` | GPT-4o | **推荐** - 最新旗舰模型 | 4096 |
| `gpt-4-turbo` | GPT-4 Turbo | 高性能平衡版本 | 4096 |
| `gpt-3.5-turbo` | GPT-3.5 Turbo | 经济实惠选项 | 2048 |

### Anthropic (Claude系列)
| 模型ID | 显示名称 | 特点 |
|--------|---------|------|
| `claude-3-opus` | Claude 3 Opus | 最强推理能力，适合复杂分析 |
| `claude-3-sonnet` | Claude 3 Sonnet | 平衡性能与速度 |
| `claude-3-haiku` | Claude 3 Haiku | 快速响应，适合简单问题 |

### Google (Gemini系列)
| 模型ID | 显示名称 | 特点 |
|--------|---------|------|
| `gemini-pro` | Gemini Pro | Google最新大模型 |

---

## ⚙️ 配置方法

### 1. 环境变量配置 (`packages/backend/.env`)

```bash
# ====== OpenAI Configuration ======
OPENAI_API_KEY="sk-your-key-here"
OPENAI_BASE_URL="https://api.openai.com/v1"  # 或自定义端点如 https://api.gptsapi.net/v1
OPENAI_MODEL="gpt-4o"  # 默认使用的OpenAI模型

# ====== Anthropic Claude Configuration ======
ANTHROPIC_API_KEY="sk-ant-your-key-here"

# ====== Google Gemini Configuration ======
GOOGLE_AI_API_KEY="your-google-api-key-here"

# ====== Default Model ======
DEFAULT_AI_MODEL="gpt-4o"  # 系统默认模型
```

### 2. 获取API密钥

#### OpenAI API Key
- 访问：https://platform.openai.com/api-keys
- 创建新的API密钥
- 复制到 `.env` 文件的 `OPENAI_API_KEY`

#### Anthropic API Key
- 访问：https://console.anthropic.com/
- 注册/登录账号
- 在 API Keys 页面创建新密钥
- 复制到 `.env` 文件的 `ANTHROPIC_API_KEY`

#### Google AI API Key
- 访问：https://aistudio.google.com/app/apikey
- 登录Google账号
- 创建API密钥
- 复制到 `.env` 文件的 `GOOGLE_AI_API_KEY`

---

## 🚀 使用示例

### 通过API调用

#### 1. 查看可用模型
```bash
GET /v1/ai/models
Authorization: Bearer YOUR_JWT_TOKEN
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "gpt-4o",
      "displayName": "GPT-4o",
      "provider": "openai",
      "available": true
    },
    {
      "id": "claude-3-sonnet",
      "displayName": "Claude 3 Sonnet",
      "provider": "anthropic",
      "available": false
    }
  ]
}
```

#### 2. 使用指定模型生成报告
```bash
POST /v1/ai/reports
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "aiModel": "gpt-4o",        // 或 "claude-3-opus" 或 "gemini-pro"
  "locale": "zh"              // 可选："en" 或 "zh"
}
```

#### 3. 使用Claude进行追问
```bash
POST /v1/ai/questions
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "reportId": "your-report-id",
  "question": "分析我的交易模式",
  "locale": "zh"
}
# 系统会自动继承生成报告时使用的AI模型
```

---

## 💡 模型选择建议

### 场景推荐

| 使用场景 | 推荐模型 | 原因 |
|---------|---------|------|
| **深度交易分析** | `gpt-4o` 或 `claude-3-opus` | 最强推理能力，洞察深入 |
| **快速报告** | `claude-3-haiku` 或 `gemini-pro` | 响应速度快，成本低 |
| **中文分析** | `gpt-4o` 或 `claude-3-sonnet` | 中文理解能力强 |
| **成本敏感** | `gpt-3.5-turbo` | 性价比最高 |
| **复杂追问** | `claude-3-opus` | 长文本处理优秀 |

### 成本对比（估算）

| 模型 | 输入成本 (per 1K tokens) | 输出成本 (per 1K tokens) |
|-----|------------------------|------------------------|
| gpt-4o | $2.50 | $10.00 |
| gpt-4-turbo | $10.00 | $30.00 |
| claude-3-opus | $15.00 | $75.00 |
| claude-3-sonnet | $3.00 | $15.00 |
| gemini-pro | Free tier available | Free tier available |

---

## 🔧 架构说明

### 统一Provider架构 (`ai-provider.service.ts`)

```
┌─────────────────────────────────────────────┐
│              AI Provider Service             │
│                                             │
│   ┌─────────┐ ┌──────────┐ ┌────────────┐  │
│   │ OpenAI  │ │ Anthropic│  │   Google   │  │
│   │ Client  │ │  Client  │  │    Client  │  │
│   └────┬────┘ └────┬─────┘ └─────┬──────┘  │
│        │           │              │         │
│        ▼           ▼              ▼         │
│   ┌────────────────────────────────────┐    │
│   │     Unified generateCompletion()   │    │
│   │     - Auto-select provider by model│   │
│   │     - Error fallback mechanism    │    │
│   │     - Usage tracking & logging    │    │
│   └────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
  ai-report.service.ts   ai-question.service.ts
```

**核心特性：**
1. ✅ **统一接口**：一个方法调用所有模型
2. ✅ **自动路由**：根据model ID自动选择provider
3. ✅ **错误降级**：API失败时回退到规则引擎
4. ✅ **Token追踪**：记录每次调用的token消耗
5. ✅ **可扩展性**：添加新模型只需在MODEL_REGISTRY注册

---

## 🛡️ 安全最佳实践

### 1. 密钥安全
```bash
# ✅ 正确：环境变量存储
OPENAI_API_KEY="sk-xxx"  # 在 .env 文件中

# ❌ 错误：硬编码在代码中
const apiKey = 'sk-xxx'  # 绝对禁止！
```

### 2. 生产环境部署

#### Docker Compose
```yaml
services:
  backend:
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      GOOGLE_AI_API_KEY: ${GOOGLE_AI_API_KEY}
```

#### Kubernetes Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: tradewise-secrets
stringData:
  OPENAI_API_KEY: "CHANGE_ME"
  ANTHROPIC_API_KEY: "CHANGE_ME"
  GOOGLE_AI_API_KEY: "CHANGE_ME"
```

### 3. 监控与配额管理

查看API调用日志：
```bash
# 后端控制台输出
✓ Calling AI API for report generation { model: 'gpt-4o', provider: 'openai' }
✓ AI API call successful { tokensUsed: 450, model: 'gpt-4o' }
```

MongoDB中存储的元数据：
```json
{
  "metadata": {
    "generationTimeMs": 2340,
    "tokensUsed": 450,
    "dataPointsAnalyzed": 10
  }
}
```

---

## 🧪 测试命令行

### 测试所有模型连通性

```bash
# 1. 启动后端
cd packages/backend && pnpm dev

# 2. 测试OpenAI (GPT-4o)
curl -X POST http://localhost:3000/v1/ai/reports \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"aiModel":"gpt-4o","locale":"zh"}'

# 3. 测试Anthropic (Claude) - 需要配置API Key
curl -X POST http://localhost:3000/v1/ai/reports \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"aiModel":"claude-3-sonnet","locale":"en"}'

# 4. 测试Google Gemini - 需要配置API Key
curl -X POST http://localhost:3000/v1/ai/reports \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"aiModel":"gemini-pro","locale":"zh"}'
```

---

## 📈 扩展新模型

### 步骤1：在MODEL_REGISTRY添加定义

```typescript
// ai-provider.service.ts
export const MODEL_REGISTRY = {
  // ...existing models...

  // 新增模型
  'new-model-id': {
    provider: 'new-provider',
    displayName: 'New Model Name',
    maxTokens: 2048,
  },
} as const;
```

### 步骤2：实现Provider客户端

```typescript
// 在 AIProviderService 类中
private async generateNewProviderCompletion(
  model: string,
  messages: AIMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<AIResponse> {
  // 实现具体逻辑
}

// 在generateCompletion方法的switch中添加case
switch (config.provider) {
  case 'new-provider':
    return this.generateNewProviderCompletion(model, messages, options);
  // ...other cases
}
```

### 步骤3：更新环境变量

```bash
# .env
NEW_PROVIDER_API_KEY="your-key"
```

---

## ❓ 常见问题

### Q1: 如何切换默认模型？
修改 `.env` 中的 `DEFAULT_AI_MODEL` 变量：
```bash
DEFAULT_AI_MODEL="claude-3-sonnet"  # 改为Claude作为默认模型
```

### Q2: API调用失败怎么办？
系统会自动降级到规则引擎，返回基于统计数据的模板化分析。检查：
1. API密钥是否正确
2. 网络连接是否正常
3. 是否超出配额限制

### Q3: 如何监控各模型的成本？
查看数据库中的 `metadata.tokensUsed` 字段，或集成Sentry等监控系统。

### Q4: 支持自定义Base URL吗？
支持！通过环境变量设置：
```bash
# OpenAI兼容API（如Azure、代理服务等）
OPENAI_BASE_URL="https://your-custom-endpoint.com/v1"
```

### Q5: 如何禁用某个模型？
将对应的环境变量设空即可：
```bash
ANTHROPIC_API_KEY=""  # 禁用所有Claude模型
```

---

## 📞 技术支持

如有问题，请检查：
1. [OpenAI文档](https://platform.openai.com/docs)
2. [Anthropic文档](https://docs.anthropic.com/)
3. [Google AI Studio](https://aistudio.google.com/)
4. 项目Issue Tracker

---

**最后更新**: 2026年
**适用版本**: TradeWise v1.0+
