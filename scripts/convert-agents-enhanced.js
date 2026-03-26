/**
 * Enhanced Convert Agents Script
 * Converts agency-agents-zh MD files to employee data with full content:
 * - soulContent: SOUL.md content (persona, tone, boundaries)
 * - agentsContent: AGENTS.md content (mission, deliverables, workflow)
 * - identityContent: IDENTITY.md content (emoji + name + vibe)
 *
 * Uses agency-agents-zh as source, with modern urban Chinese names
 */
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = 'C:/Users/zengqiaowen-pc/ClawX/agency-agents-zh';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', 'employees');

// Department mapping
const DEPARTMENT_MAPPING = {
  engineering: { id: 'engineering', nameZh: '研发', emoji: '💻' },
  design: { id: 'design', nameZh: '设计', emoji: '🎨' },
  marketing: { id: 'marketing', nameZh: '营销', emoji: '📢' },
  sales: { id: 'sales', nameZh: '销售', emoji: '💼' },
  product: { id: 'product', nameZh: '产品', emoji: '📦' },
  'project-management': { id: 'project-management', nameZh: '项目管理', emoji: '📋' },
  academic: { id: 'academic', nameZh: '学术', emoji: '📚' },
  'game-development': { id: 'game-development', nameZh: '游戏开发', emoji: '🎮' },
  strategy: { id: 'strategy', nameZh: '战略', emoji: '♟️' },
  support: { id: 'support', nameZh: '客服', emoji: '🎧' },
  testing: { id: 'testing', nameZh: '测试', emoji: '🧪' },
  specialized: { id: 'specialized', nameZh: '专门技能', emoji: '⭐' },
  'spatial-computing': { id: 'spatial-computing', nameZh: '空间计算', emoji: '🌐' },
  'paid-media': { id: 'paid-media', nameZh: '付费媒体', emoji: '📺' },
  finance: { id: 'finance', nameZh: '金融', emoji: '💰' },
  hr: { id: 'hr', nameZh: '人力资源', emoji: '👔' },
  legal: { id: 'legal', nameZh: '法务', emoji: '⚖️' },
  'supply-chain': { id: 'supply-chain', nameZh: '供应链', emoji: '🚚' },
};

// Modern urban Chinese names pool (200+ unique names)
const CHINESE_NAMES = {
  engineering: [
    '林浩然', '陈思远', '王明辉', '刘子轩', '周子安', '吴晋鹏', '张云起', '李泽言',
    '赵晨曦', '孙博远', '郑浩宇', '冯志强', '卫俊逸', '蒋雨泽', '沈墨白', '韩子墨',
    '杨天翔', '朱俊驰', '秦凯文', '尤鸿煊', '许志杰', '何俊豪', '吕嘉豪', '施承宇',
    '张哲瀚', '孔德明', '曹文轩', '严安澜', '华星辰', '金宇轩', '贝承宣', '郁飞羽',
    '单北辰', '杭修文', '焦博涵', '柴浩然', '松博延', '柏瑞霖', '沐子昂', '邬天佑',
    '臧文耀', '池宇航', '甘文霖', '柯子墨', '卓文耀', '童文耀', '颜文博', '戴文博',
    '鞠文耀', '鞠文博', '闵文耀', '席文博', '冉文耀', '仲文博', '鲁文耀', '危文博',
  ],
  design: [
    '林漾', '苏艺', '陈菲', '顾清', '陆漫', '叶知秋', '赵白鹿', '林诺',
    '苏晚', '姜小宁', '林之瑶', '顾言深', '沈言微', '陆诗瑶', '叶映雪', '赵念瑶',
    '林宛瑶', '苏诗言', '陈映瑶', '顾悦瑶', '陆之瑶', '叶思瑶', '赵静瑶', '林诗言',
    '苏静言', '陈思言', '顾诗语', '陆语嫣', '叶语嫣', '赵诗乔', '林映乔', '苏念乔',
    '陈悦乔', '顾诗乔', '陆静乔', '林之微', '苏映微', '陈思微', '顾念微', '陆诗微',
    '叶静微', '赵语微', '林诗微', '苏思微', '陈映微', '顾语微', '陆静微', '叶诗微',
  ],
  marketing: [
    '陈开怡', '夏宁', '张思嘉', '秦清', '丁夏', '吴芳', '郑采言', '徐斯',
    '林知语', '苏映晨', '陈诗语', '顾清语', '陆映语', '叶思语', '赵诗语', '林清语',
    '苏晨语', '陈映语', '顾夏语', '陆秋语', '叶冬语', '赵春语', '林夏语', '苏晴语',
    '陈雨语', '顾云语', '陆风语', '叶星语', '赵月语', '林日语', '苏时语', '陈光语',
    '顾明语', '陆亮语', '叶霞语', '林烟语', '苏雾语', '陈露语', '顾霜语', '陆雪语',
    '叶雨语', '赵风语', '林云语', '苏天语', '陈地语', '顾水语', '陆火语', '叶山语',
  ],
  sales: [
    '程开', '杨光', '许朗', '江浩', '孟晏', '陈就', '梁元', '蒋南孙',
    '林俊良', '陈立诚', '周明远', '吴俊杰', '郑浩然', '王志远', '李博达', '张子涵',
    '刘浩然', '陈明远', '周俊杰', '吴博达', '郑子涵', '王浩然', '李明远', '张俊杰',
    '林博达', '陈子涵', '周浩然', '吴明远', '郑俊杰', '王博达', '李子涵', '张浩然',
    '刘明远', '陈俊杰', '周博达', '吴子涵', '郑浩然', '王明远', '李俊杰', '张博达',
    '陈子涵', '林志远', '苏俊良', '陈立诚', '周博远', '吴俊豪', '郑志杰', '王俊逸',
  ],
  product: [
    '陈菲', '顾清', '陆漫漫', '沈绿以', '何洛洛', '苏九九', '顾七七', '林洛洛',
    '陈诗语', '顾清语', '陆映语', '叶思语', '赵诗语', '林清语', '苏映语', '陈思语',
    '顾诗语', '陆静语', '叶映语', '赵诗语', '林思语', '苏诗语', '陈思语', '顾思语',
    '陆静语', '叶诗语', '赵静语', '林诗语', '苏思语', '陈诗语', '顾思语', '陆思语',
    '叶静语', '赵思语', '林思语', '苏静语', '陈静语', '顾静语', '陆静语', '叶静语',
  ],
  'project-management': [
    '方思雨', '孟晓', '辛鹿鸣', '鹿鸣', '雨薇', '徐晓', '沈冰', '林静',
    '张晓', '顾筝', '陆既明', '秦小冲', '林动', '周翡', '吴楚之', '张翠山',
    '林诗语', '苏映语', '陈思语', '顾清语', '陆诗语', '叶静语', '赵映语', '林清语',
    '苏诗语', '陈静语', '顾思语', '陆诗语', '叶思语', '赵诗语', '林思语', '苏诗语',
  ],
  academic: [
    '叶春梅', '霍心', '心茹', '春茹', '林宛瑜', '秦文君', '唐微微', '苏洵',
    '苏辙', '苏轼', '唐宋', '林黛玉', '薛宝钗', '贾宝玉', '史湘云', '探春',
    '惜春', '迎春', '王熙凤', '贾母', '邢夫人', '尤氏', '李纨', '秦可卿',
    '林文博', '苏文华', '陈文彬', '顾文儒', '陆文雅', '叶文博', '赵文华', '林文昌',
    '苏文瑞', '陈文耀', '顾文博', '陆文华', '叶文彬', '赵文儒', '林文雅', '苏文博',
  ],
  'game-development': [
    '林星河', '苏云天', '陈墨白', '顾寒轩', '陆子墨', '叶青玄', '赵玄夜', '林云海',
    '苏天明', '陈修文', '顾言深', '陆北辰', '叶南风', '赵东阳', '林西岭', '苏中天',
    '陈博然', '顾浩然', '陆俊逸', '叶承宇', '赵立轩', '林宇航', '苏俊杰', '陈志远',
    '顾嘉豪', '陆子轩', '叶浩然', '赵俊豪', '林博达', '苏志杰', '陈宇航', '顾俊逸',
  ],
  strategy: [
    '林博远', '苏明远', '陈俊逸', '顾承宇', '陆修远', '叶德明', '赵文博', '林学文',
    '苏文华', '陈文彬', '顾文儒', '陆文雅', '叶文博', '赵文华', '林文昌', '苏文瑞',
    '陈文耀', '顾文博', '陆文华', '叶文彬', '赵文儒', '林文雅', '苏文博', '陈文华',
    '顾文耀', '陆文博', '叶文华', '赵文彬', '林文儒', '苏文雅', '陈文博', '顾文华',
  ],
  support: [
    '林漫妮', '苏小', '郝态度', '林动', '周让', '郑微微', '吴微微', '徐微微',
    '叶满', '林漾', '顾夜白', '陆本', '周宁', '陆既白', '陈白羊', '沈肯尼',
    '林静语', '苏映语', '陈思语', '顾清语', '陆诗语', '叶静语', '赵映语', '林清语',
    '苏诗语', '陈静语', '顾思语', '陆诗语', '叶思语', '赵诗语', '林思语', '苏诗语',
  ],
  testing: [
    '张伟', '李贞子', '贞子', '张丽', '张芃', '刘伟大', '陈伟', '周文', '赵洪',
    '李宁', '黄志忠', '包贝', '林博达', '苏志杰', '陈宇航', '顾俊逸', '陆子轩',
    '陈博然', '顾浩然', '陆宇航', '叶承宇', '赵立轩', '林俊杰', '苏志远', '陈俊豪',
    '林博远', '苏明远', '陈俊逸', '顾承宇', '陆修远', '叶德明', '赵文博', '林学文',
  ],
  integrations: [
    '林宇', '苏朗', '陈宇轩', '顾宇航', '陆子轩', '叶浩然', '赵俊豪', '林博达',
    '苏志杰', '陈宇航', '顾俊逸', '陆子轩', '叶浩然', '赵俊豪', '林博达', '苏志杰',
    '陈宇航', '顾俊逸', '陆子轩', '叶浩然', '赵俊豪', '林博达', '苏志杰', '陈宇航',
    '顾俊逸', '陆子轩', '叶浩然', '赵俊豪', '林博达', '苏志杰', '陈宇航', '顾俊逸',
  ],
  specialized: [
    '林专家', '苏顾问', '陈总监', '顾经理', '陆主管', '叶专员', '赵高级', '林资深',
    '苏首席', '陈高级', '顾资深', '陆首席', '叶高级', '赵资深', '林首席', '苏高级',
    '陈资深', '顾首席', '陆高级', '叶资深', '赵首席', '林高级', '苏资深', '陈首席',
    '顾高级', '陆资深', '叶首席', '赵高级', '林资深', '苏首席', '陈高级', '顾资深',
    '林总监', '苏经理', '陈主管', '顾专员', '陆高级', '叶资深', '赵首席', '林高级',
  ],
  'spatial-computing': [
    '林星际', '苏维度', '陈平行', '顾时空', '陆光年', '叶星河', '赵宇宙', '林莫比',
    '苏乌斯', '陈德雷', '顾阿萨', '陆奥丁', '叶雅典', '赵阿波', '林赫尔', '苏波塞',
    '陈宙斯', '顾雅典娜', '陆阿波罗', '叶赫尔墨', '赵波塞冬', '林维纳斯', '苏马尔斯',
    '陈朱庇特', '顾密涅瓦', '陆伏尔甘', '叶阿芙罗', '赵狄俄尼', '林巴克科斯', '苏阿瑞斯',
  ],
  'paid-media': [
    '林明远', '苏广明', '陈远航', '顾广厦', '陆飞翔', '叶蓝鲸', '赵巨浪', '林风暴',
    '苏烈火', '陈寒冰', '顾疾风', '陆骤雨', '叶闪电', '赵惊雷', '林朝霞', '苏夕阳',
    '陈星辰', '顾明月', '陆骄阳', '叶青云', '赵紫电', '林白虹', '苏碧落', '陈苍穹',
    '顾大地', '陆山川', '叶河岳', '赵湖海', '林明远', '苏广明', '陈远航', '顾广厦',
    '陆飞翔', '叶蓝鲸', '赵巨浪', '林风暴', '苏烈火', '陈寒冰', '顾疾风', '陆骤雨',
  ],
  finance: [
    '林财务', '苏会计', '陈审计', '顾风控', '陆分析', '叶投资', '赵融资', '林预算',
    '苏结算', '陈核算', '顾报表', '陆资金', '叶税务', '赵成本', '林利润', '苏资产',
    '陈负债', '顾权益', '陆收益', '叶现金', '赵支票', '林汇票', '苏信用', '陈借贷',
  ],
  hr: [
    '林招聘', '苏培训', '陈绩效', '顾薪酬', '陆员工', '叶关系', '赵晋升', '林离职',
    '苏合同', '陈福利', '顾考核', '陆档案', '叶职称', '赵评审', '林面试', '苏测评',
  ],
  legal: [
    '林法务', '苏律师', '陈顾问', '顾合规', '陆合同', '叶诉讼', '赵仲裁', '林知识产权',
    '苏公司法', '陈劳动法', '顾合同法', '陆贸易法', '叶金融法', '赵证券法', '林税法',
    '苏海关法', '陈国际法', '顾贸易法', '陆仲裁法', '叶调解法', '赵执行法', '林证据法',
  ],
  'supply-chain': [
    '林采购', '苏仓储', '陈物流', '顾配送', '陆运输', '叶库存', '赵供应商', '林调度',
    '苏运营', '陈协调', '顾优化', '陆流程', '叶计划', '赵预测', '林控制', '苏质量',
  ],
};

// Keywords that determine which bucket content goes to
const SOUL_KEYWORDS = ['identity', 'memory', 'communication', 'style', 'critical rule', 'rules you must follow', '身份', '记忆', '沟通', '风格', '关键规则'];

function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterStr = match[1];
  const body = content.slice(match[0].length);

  const frontmatter = {};
  const lines = frontmatterStr.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

function generateId(department, filename) {
  // Use filename slug (e.g., "engineering-ai-engineer" from "engineering-ai-engineer.md")
  const slug = filename.replace('.md', '');
  return `${department}-${slug}`;
}

/**
 * Split body content into SOUL and AGENTS content
 */
function splitBodyContent(body) {
  const lines = body.split('\n');
  let currentTarget = 'agents';
  let currentSection = '';
  let soulContent = '';
  let agentsContent = '';

  for (const line of lines) {
    if (line.match(/^##\s/)) {
      if (currentSection.trim()) {
        if (currentTarget === 'soul') {
          soulContent += currentSection;
        } else {
          agentsContent += currentSection;
        }
      }
      currentSection = '';

      const headerLower = line.toLowerCase();
      const isSoulHeader = SOUL_KEYWORDS.some(keyword => headerLower.includes(keyword));
      currentTarget = isSoulHeader ? 'soul' : 'agents';
    }

    currentSection += line + '\n';
  }

  if (currentSection.trim()) {
    if (currentTarget === 'soul') {
      soulContent += currentSection;
    } else {
      agentsContent += currentSection;
    }
  }

  return { soulContent: soulContent.trim(), agentsContent: agentsContent.trim() };
}

/**
 * Generate IDENTITY.md content from agency-agents-zh Chinese content
 */
function generateIdentityContent(name, emoji, vibe) {
  if (emoji && vibe) {
    return `# ${emoji} ${name}\n\n${vibe}`;
  }
  return `# 👤 ${name}`;
}

/**
 * Generate resume-style Chinese description from Chinese content
 */
function generateDescriptionZh(name, description, department) {
  if (!description) return '';

  // Clean up description
  let desc = description.trim();

  // If description already has good Chinese content, use it as-is
  if (desc.length > 20) {
    return desc;
  }

  return desc;
}

/**
 * Generate Chinese vibe (one-sentence personality)
 * Translates English vibes to Chinese or uses existing Chinese vibes
 */
function generateVibeZh(vibe, name) {
  if (!vibe) return '';

  // If vibe already has good Chinese content, use it
  if (/[\u4e00-\u9fa5]/.test(vibe)) {
    return vibe.length > 30 ? vibe.substring(0, 27) + '...' : vibe;
  }

  // Pattern-based translation for English vibes (talent headhunting style)
  const vibeLower = vibe.toLowerCase();
  const patterns = [
    // Data/Experiment
    { pattern: /data.driven/i, zh: '数据驱动，用实验验证一切' },
    { pattern: /experiment.*valid|hypothesis.*test/i, zh: '严谨假设，精准验证' },
    { pattern: /a.b.test|ab.test/i, zh: 'A/B测试专家' },
    { pattern: /statistical|statistic.*significance/i, zh: '统计分析见长' },
    { pattern: /systematic|rigorous/i, zh: '系统化思维' },
    { pattern: /results.orient|outcome.focus/i, zh: '结果导向' },

    // Engineering
    { pattern: /full.stack|fullstack/i, zh: '全栈开发专家' },
    { pattern: /frontend|front.end/i, zh: '前端开发专家' },
    { pattern: /backend|back.end/i, zh: '后端架构专家' },
    { pattern: /devops|sre|automation/i, zh: 'DevOps自动化实践者' },
    { pattern: /security|threat/i, zh: '安全工程专家' },
    { pattern: /database|data.*optim/i, zh: '数据库优化专家' },
    { pattern: /mobile|ios|android/i, zh: '移动端开发专家' },
    { pattern: /machine.learn|ai.*engineer|ml.*engineer/i, zh: 'AI工程专家' },
    { pattern: /embedded.*firmware|firmware/i, zh: '嵌入式开发专家' },
    { pattern: /git.*workflow|code.*review/i, zh: '代码质量守护者' },
    { pattern: /incident.*response|on.call/i, zh: '应急响应专家' },
    { pattern: /technical.*writer|document/i, zh: '技术文档专家' },

    // Design
    { pattern: /ui.*design|interface/i, zh: 'UI设计专家' },
    { pattern: /ux.*design|user.*experience/i, zh: '用户体验设计专家' },
    { pattern: /brand.*design|brand.*guardian/i, zh: '品牌设计守护者' },
    { pattern: /image.*prompt|prompt.*engine/i, zh: 'AI图像提示词专家' },
    { pattern: /inclusive|accessibility/i, zh: '无障碍设计专家' },
    { pattern: /visual.*story|storytell/i, zh: '视觉叙事专家' },
    { pattern: /whimsy|playful|fun/i, zh: '趣味设计注入者' },

    // Marketing
    { pattern: /seo|search.*optim/i, zh: 'SEO优化专家' },
    { pattern: /content.*creat|content.*market/i, zh: '内容营销专家' },
    { pattern: /social.*media|social.*strateg/i, zh: '社交媒体策略师' },
    { pattern: /growth.*hack|growth/i, zh: '增长黑客' },
    { pattern: /tiktok|douyin|short.*video/i, zh: '短视频运营专家' },
    { pattern: /ecommerce|e.commerce/i, zh: '电商运营专家' },
    { pattern: /livestream|live.*stream/i, zh: '直播带货专家' },
    { pattern: /wechat.*official|wechat/i, zh: '微信生态运营专家' },
    { pattern: /ai.*citation|ai.*refer/i, zh: 'AI引文优化专家' },

    // Sales
    { pattern: /sales.*coach|coach.*sales/i, zh: '销售教练' },
    { pattern: /deal.*strateg|negotiat/i, zh: '交易策略专家' },
    { pattern: /outbound|lead.*gener/i, zh: '外销拓展专家' },
    { pattern: /pipeline.*analyst|pipeline/i, zh: '销售管道分析师' },
    { pattern: /enterprise.*sale|account.*strateg/i, zh: '大客户战略专家' },

    // Product
    { pattern: /behavior.*nudge|nudge/i, zh: '行为设计专家' },
    { pattern: /feedback.*synth|synthes.*feedback/i, zh: '用户反馈整合专家' },
    { pattern: /sprint.*priorit|sprint/i, zh: '敏捷迭代专家' },
    { pattern: /trend.*research|trend/i, zh: '趋势研究专家' },

    // Project Management
    { pattern: /experiment.*track|experiment/i, zh: '实验项目管理专家' },
    { pattern: /jira.*workflow|jira/i, zh: 'Jira工作流专家' },
    { pattern: /project.*shepherd|shepherd/i, zh: '项目护航专家' },
    { pattern: /studio.*operat|operation/i, zh: '工作室运营专家' },
    { pattern: /producer/i, zh: '制作管理专家' },

    // Testing
    { pattern: /accessibilit.*audit|access/i, zh: '无障碍测试专家' },
    { pattern: /api.*test|api/i, zh: 'API测试专家' },
    { pattern: /performance.*benchmark|benchmark/i, zh: '性能基准测试专家' },
    { pattern: /evidence.*collect|evidence/i, zh: '测试证据收集专家' },
    { pattern: /reality.*check|reality/i, zh: '真实性验证专家' },
    { pattern: /workflow.*optim|workflow/i, zh: '流程优化测试专家' },

    // Support
    { pattern: /analytics.*report|analytics/i, zh: '数据分析专家' },
    { pattern: /executive.*summary|summary/i, zh: '高管报告专家' },
    { pattern: /finance.*track|finance/i, zh: '财务追踪专家' },
    { pattern: /infrastructure.*maintain|infrastructure/i, zh: '基础设施维护专家' },
    { pattern: /legal.*complian|compliance/i, zh: '合规审计专家' },
    { pattern: /support.*respond|support/i, zh: '客户响应专家' },

    // Game Development
    { pattern: /game.*audio|audio.*engine/i, zh: '游戏音频工程师' },
    { pattern: /level.*design|level/i, zh: '关卡设计师' },
    { pattern: /narrative.*design|story.*design/i, zh: '叙事设计师' },
    { pattern: /technical.*artist/i, zh: '技术美术专家' },

    // Spatial Computing
    { pattern: /spatial.*metal|metal/i, zh: '空间Metal图形工程师' },
    { pattern: /terminal.*integrat|terminal/i, zh: '终端集成专家' },
    { pattern: /vision.*os|visionos/i, zh: 'VisionOS空间开发专家' },
    { pattern: /xr.*immersive|immersive/i, zh: 'XR沉浸式开发专家' },
    { pattern: /cockpit.*interact|cockpit/i, zh: 'XR座舱交互专家' },
    { pattern: /xr.*interface/i, zh: 'XR界面架构师' },

    // Paid Media
    { pattern: /programmatic.*buy|programmatic/i, zh: '程序化广告买手' },
    { pattern: /search.*query|query/i, zh: '搜索Query分析师' },
    { pattern: /ppc/i, zh: 'PPC策略专家' },
    { pattern: /paid.*social|paid.*social/i, zh: '付费社交策略师' },
    { pattern: /creative.*strateg|creative/i, zh: '创意策略专家' },
    { pattern: /tracking.*specialist|tracking/i, zh: '广告追踪专家' },

    // Specialized
    { pattern: /blockchain.*audit|security.*audit/i, zh: '区块链安全审计专家' },
    { pattern: /compliance.*audit|governance/i, zh: '合规治理专家' },
    { pattern: /corporate.*training|training.*design/i, zh: '企业培训设计师' },
    { pattern: /data.*consolidat|data.*agent/i, zh: '数据整合专家' },
    { pattern: /mcp.*builder|mcp/i, zh: 'MCP构建专家' },
    { pattern: /salesforce/i, zh: 'Salesforce架构师' },
    { pattern: /workflow.*architect|workflow/i, zh: '工作流架构师' },
    { pattern: /supply.*chain|supply/i, zh: '供应链战略专家' },
    { pattern: /zk.*steward|zero.knowledge/i, zh: '零知识证明专家' },
    { pattern: /model.*qa|qa.*model/i, zh: '模型质量保障专家' },
    { pattern: /cultur.*intelligence|cultural/i, zh: '文化智能战略专家' },
    { pattern: /korean.*business|korean/i, zh: '韩中商务导航专家' },
    { pattern: /french.*consult|french.*market/i, zh: '法国市场咨询专家' },
    { pattern: /study.*abroad|abroad.*advisor/i, zh: '留学咨询顾问' },
    { pattern: /government.*digital|gov/i, zh: '政府数字化顾问' },
    { pattern: /healthcare.*complian|healthcare/i, zh: '医疗营销合规专家' },
    { pattern: /recommend.*competitor|ai.*recommend/i, zh: 'AI推荐优化专家' },

    // Academic
    { pattern: /cultural.*system|ethnographic/i, zh: '文化体系专家' },
    { pattern: /geography|geographic.*coherent/i, zh: '地理学专家' },
    { pattern: /history|historical.*coherence/i, zh: '历史学专家' },
    { pattern: /narratolog|narrative.*design/i, zh: '叙事学专家' },
    { pattern: /psycholog/i, zh: '心理学专家' },
    { pattern: /anthropolog/i, zh: '人类学专家' },
  ];

  for (const { pattern, zh } of patterns) {
    if (pattern.test(vibeLower)) {
      return zh;
    }
  }

  // Fallback: truncate long English vibes
  return vibe.length > 25 ? vibe.substring(0, 22) + '...' : vibe;
}

// Global counter for unique name assignment
let globalNameIndex = 0;
const usedNames = new Set();

function getUniqueName(department, filename) {
  const names = CHINESE_NAMES[department] || CHINESE_NAMES.specialized;

  for (let i = 0; i < names.length; i++) {
    const idx = (globalNameIndex + i) % names.length;
    const name = names[idx];
    if (!usedNames.has(name)) {
      usedNames.add(name);
      globalNameIndex++;
      return name;
    }
  }

  // Fallback: create unique name
  const fallback = `${department}-${globalNameIndex}`;
  usedNames.add(fallback);
  globalNameIndex++;
  return fallback;
}

function convertAgent(department, filename, content) {
  const { frontmatter, body } = parseFrontmatter(content);

  if (!frontmatter.name) {
    console.warn(`Skipping ${filename}: missing name`);
    return null;
  }

  const { soulContent, agentsContent } = splitBodyContent(body);

  const identityContent = generateIdentityContent(
    frontmatter.name,
    frontmatter.emoji,
    frontmatter.vibe
  );

  // nameZh is the unique modern Chinese name (different from the role-based name)
  const nameZh = getUniqueName(department, filename);

  // descriptionZh uses the Chinese description from agency-agents-zh
  const descriptionZh = generateDescriptionZh(frontmatter.name, frontmatter.description, department);

  // vibeZh uses the Chinese vibe from agency-agents-zh (or translated from English)
  const vibeZh = generateVibeZh(frontmatter.vibe, frontmatter.name);

  return {
    id: generateId(department, filename),
    name: frontmatter.name,  // Chinese role name from agency-agents-zh (e.g., "AI 工程师")
    nameZh,                  // Unique modern Chinese name (e.g., "林浩然")
    description: frontmatter.description || '',
    descriptionZh,
    vibeZh,
    color: frontmatter.color || 'blue',
    emoji: frontmatter.emoji || '👤',
    vibe: frontmatter.vibe || '',
    department: DEPARTMENT_MAPPING[department]?.id || 'specialized',
    departmentNameZh: DEPARTMENT_MAPPING[department]?.nameZh || '专门技能',
    soulContent,
    agentsContent,
    identityContent,
  };
}

function main() {
  console.log('Starting enhanced agent conversion...');
  console.log(`Source: ${AGENTS_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}`);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const folders = fs.readdirSync(AGENTS_DIR).filter((item) => {
    const itemPath = path.join(AGENTS_DIR, item);
    return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
  });

  const allEmployees = [];

  for (const folder of folders) {
    const folderPath = path.join(AGENTS_DIR, folder);

    if (!DEPARTMENT_MAPPING[folder]) {
      console.log(`Skipping ${folder}: not a recognized department`);
      continue;
    }

    const outputFolder = path.join(OUTPUT_DIR, folder);
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    // Recursively find all .md files in the department folder
    const findMdFiles = (dir, relativePath = '') => {
      const items = fs.readdirSync(dir);
      const mdFiles = [];
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          // Recurse into subdirectory
          mdFiles.push(...findMdFiles(fullPath, path.join(relativePath, item)));
        } else if (item.endsWith('.md')) {
          mdFiles.push({
            fullPath,
            relativePath: path.join(relativePath, item),
            filename: item,
          });
        }
      }
      return mdFiles;
    };

    const mdFiles = findMdFiles(folderPath);
    const files = mdFiles;

    console.log(`Processing ${folder}: ${files.length} files`);

    for (const fileInfo of files) {
      const { fullPath: filePath, relativePath, filename } = fileInfo;
      const content = fs.readFileSync(filePath, 'utf-8');

      const employee = convertAgent(folder, filename, content);

      if (employee) {
        allEmployees.push(employee);

        // Create output subdirectory if needed and write file
        const outputRelativePath = relativePath.replace('.md', '.json');
        const outputFile = path.join(outputFolder, outputRelativePath);
        const outputSubDir = path.dirname(outputFile);
        if (!fs.existsSync(outputSubDir)) {
          fs.mkdirSync(outputSubDir, { recursive: true });
        }
        fs.writeFileSync(outputFile, JSON.stringify(employee, null, 2), 'utf-8');
      }
    }
  }

  const indexPath = path.join(OUTPUT_DIR, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(allEmployees, null, 2), 'utf-8');

  console.log(`\nConversion complete!`);
  console.log(`Total employees: ${allEmployees.length}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);

  if (allEmployees.length > 0) {
    const sample = allEmployees[0];
    console.log(`\nSample employee:`);
    console.log(`  name: ${sample.name} (${sample.name})`);
    console.log(`  nameZh: ${sample.nameZh}`);
    console.log(`  descriptionZh: ${sample.descriptionZh}`);
    console.log(`  vibeZh: ${sample.vibeZh}`);
    console.log(`  soulContent: ${sample.soulContent ? '✓' : '✗'}`);
    console.log(`  agentsContent: ${sample.agentsContent ? '✓' : '✗'}`);
    console.log(`  identityContent: ${sample.identityContent ? '✓' : '✗'}`);
  }
}

main();
