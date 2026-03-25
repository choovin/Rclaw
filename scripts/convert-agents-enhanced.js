/**
 * Enhanced Convert Agents Script
 * Converts agency-agents-temp MD files to employee data with full content:
 * - soulContent: SOUL.md content (persona, tone, boundaries)
 * - agentsContent: AGENTS.md content (mission, deliverables, workflow)
 * - identityContent: IDENTITY.md content (emoji + name + vibe)
 */
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = 'C:/Users/zengqiaowen-pc/ClawX/agency-agents-temp';
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
  integrations: { id: 'integrations', nameZh: '集成', emoji: '🔗' },
  specialized: { id: 'specialized', nameZh: '专门技能', emoji: '⭐' },
  'spatial-computing': { id: 'spatial-computing', nameZh: '空间计算', emoji: '🌐' },
  'paid-media': { id: 'paid-media', nameZh: '付费媒体', emoji: '📺' },
};

// Chinese names from popular TV dramas - expanded for uniqueness
const CHINESE_NAMES = {
  engineering: [
    '韩商言', '于途', '肖奈', '何以琛', '封沉', '顾漫', '李现', 'DT', '小米', 'grunt',
    '令山', '古川', '令古', '索南', '沈教授', '言冰云', '陈湛', '卢 amp', '徐地址',
    '温苒', '宋焰', '许魏洲', '顾魏', '顾剑', '韩沉', '陆然', '邵江', '顾夜寻',
    '程巍', '陆展元', '沐春风', '韩太医', '温客行', '周子舒', '张成岭', '曹蔚宁'
  ],
  design: [
    '唐晶', '安迪', '林无敌', '苏明哲', '陈美嘉', '艾莉', '薇风', '乔菲', '苏澄',
    '苏晚', '姜小宁', '林漾', '顾佳', '王漫妮', '苏艺', '杜拉拉', '沈月伦', '温如',
    '郝非非', '朱锁锁', '蒋南孙', '唐柔', '苏苏', '莉莉安', '安妮', '斯黛拉', '费蕾娜'
  ],
  marketing: [
    '房似锦', '童薇', '樊书涛', '郡书', '宁静', '静蕾', '张乘乘', '张芝安', '珊曼妮',
    'Grace', 'Summer', 'Annie', 'Lisa', '陈开怡', '夏宁', '张思嘉', '吴芳', '郑采言',
    '秦清', '丁夏', '左小青', '顾明', '赵宽', '吴琅', '霍贝贝', '沈若鱼', '徐斯'
  ],
  sales: [
    '贺涵', '许半夏', '程开', '苏明玉', '老白', '白凡', '陈俊生', '唐晶', '凌玲',
    '子君', '俊生', '白光', '韩丁', '史奇', '程峥', '顾关', '陆川', '杨光', '许朗',
    '江浩', '孟晏', '陈就', '梁元', '蒋南孙', '谢洛杉矶', '周放', '宁夕', '陆既明'
  ],
  product: [
    '苏明玉', '安迪', '曲筱绡', '顾佳', '王漫妮', '朱锁锁', '蒋南孙', '唐柔', '苏苏',
    '陈菲', '顾清', '陆漫漫', '沈绿以', '何洛洛', '苏艺', '艾苏', '苏九九', '顾七七',
    '陆剧', '程焉', '商战', '沈月', '林略', '顾沈', '孟张', '白木', '苏白'
  ],
  'project-management': [
    '方思雨', '孟晓', '辛鹿鸣', '鹿鸣', '雨薇', '徐oyan', '沈冰', '林QUIET', '蒋南',
    '张晓', '陈不死', '顾筝', '陆既明', '秦小冲', '林动', '周翡', '吴楚之', '张翠山',
    '殷素素', '张无忌', '赵敏', '周芷若', '小昭', '蛛儿', '杨不悔', '殷离', '纪晓芙'
  ],
  academic: [
    '叶春梅', '霍心', '心茹', '春茹', '林宛瑜', '秦文君', '唐微微', '苏洵', '苏辙',
    '苏轼', '唐宋', '八贤', '林黛玉', '薛宝钗', '贾宝玉', '史湘云', '探春', '惜春',
    '迎春', '王熙凤', '贾母', '邢夫人', '尤氏', '李纨', '秦可卿', '巧姐', '妙玉'
  ],
  'game-development': [
    '韩商言', '小米', 'grunt', '令山', '古川', '令古', '索南', '沈教授', '言冰云',
    '令妃', '甄宓', '郭女王', '曹丕', '曹植', '司马懿', '司马昭', '曹操', '刘备',
    '关羽', '张飞', '赵云', '马超', '黄忠', '魏延', '姜维', '邓艾', '钟会', '张郃'
  ],
  strategy: [
    '贺涵', '陈俊生', '魏渊', '深渊', '魏深', '顾辉', '孟晚舟', '孟晚霞', '刘弗陵',
    '上官小妹', '许平君', '许谌', '曹c', '司马迁', '司马光', '司马相如', '东方朔',
    '张骞', '班超', '甘英', '郑和', '鉴真', '玄奘', '法显', '神秀', '慧能', '惠能'
  ],
  support: [
    '小张', '王漫妮', '漫妮', '小王', '贝微微', '二喜', '赵二喜', '林山水', '郑小小',
    '田二喜', '苏小' , '郝态度', '林动', '周让', '郑微微', '吴微微', '徐微微', '叶满',
    '林漾', '顾夜白', '陆本', '周宁', '陆既白', '陈白羊', '沈肯尼', '陆锦', '韩言之'
  ],
  testing: [
    '张伟', '李贞子', '贞子', '张丽', '张芃', '刘伟大', '陈伟', '周文', '赵洪',
    '李宁', '黄志忠', '包贝', '刘bp', '张一', '陈KE', '陆俊', '吴下', '冯j',
    '曹c', '司马光', '东方', '南宫', '上官', '欧阳', '诸葛', '慕容', '令狐', '独孤'
  ],
  integrations: [
    'Tony', 'Micheal', '林八斗', '八斗', '林宇', '泰勒', '杰克', '露西', '莉莉',
    '麦克', '大卫', '约翰', '汤姆', '安娜', '凯特', '马克', '大卫', '保罗', '汤姆',
    '罗伯特', '查尔斯', '乔治', '弗兰克', '阿什利', '艾米丽', '阿曼达', '克劳迪娅'
  ],
  specialized: [
    '专门人才', '首席专家', '资深顾问', '高级经理', '特邀嘉宾', '项目总监', '技术VP',
    '产品总监', '运营总监', '市场总监', '销售总监', '行政总监', '财务总监', '人力总监'
  ],
  'spatial-computing': [
    '未来', '科技', '星际', '凡星', '宇凡', '星河', '光年', '维度', '平行', '时空',
    '莫比', '乌斯', '德雷克', '阿萨', '奥丁', '雅典娜', '阿波罗', '赫尔墨斯', '波塞冬'
  ],
  'paid-media': [
    '广告狂人', '明远', '广明', '远航', '广厦', '飞翔', '蓝鲸', '巨浪', '风暴',
    '烈火', '寒冰', '疾风', '骤雨', '闪电', '惊雷', '朝霞', '夕阳', '星辰', '明月',
    '骄阳', '青云', '紫电', '白虹', '碧落', '苍穹', '大地', '山川', '河岳', '湖海'
  ],
};

// Keywords that determine which bucket content goes to
const SOUL_KEYWORDS = ['identity', 'memory', 'communication', 'style', 'critical rule', 'rules you must follow'];

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

function generateId(department, name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  return `${department}-${slug}`;
}

/**
 * Split body content into SOUL and AGENTS content
 * Based on convert.sh logic - uses ## header keywords to classify
 */
function splitBodyContent(body) {
  const lines = body.split('\n');
  let currentTarget = 'agents'; // default bucket
  let currentSection = '';
  let soulContent = '';
  let agentsContent = '';

  for (const line of lines) {
    // Detect ## headers (with or without emoji prefixes)
    if (line.match(/^##\s/)) {
      // Flush previous section
      if (currentSection.trim()) {
        if (currentTarget === 'soul') {
          soulContent += currentSection;
        } else {
          agentsContent += currentSection;
        }
      }
      currentSection = '';

      // Classify this header by keyword (case-insensitive)
      const headerLower = line.toLowerCase();

      const isSoulHeader = SOUL_KEYWORDS.some(keyword => headerLower.includes(keyword));
      currentTarget = isSoulHeader ? 'soul' : 'agents';
    }

    currentSection += line + '\n';
  }

  // Flush final section
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
 * Generate IDENTITY.md content
 */
function generateIdentityContent(name, emoji, vibe) {
  if (emoji && vibe) {
    return `# ${emoji} ${name}\n\n${vibe}`;
  }
  return `# 👤 ${name}`;
}

/**
 * Generate Chinese description from English description
 * Simple pattern-based translation
 */
function generateDescriptionZh(name, description, department) {
  if (!description) return '';

  // Remove the English name from description to avoid false matching
  let descWithoutName = description.replace(new RegExp(name, 'gi'), '').trim();

  const descLower = descWithoutName.toLowerCase();

  // Domain keyword mapping to Chinese
  const domainToChinese = {
    // Engineering
    'software': '软件开发',
    'developer': '软件开发',
    'engineer': '工程开发',
    'technical': '技术',
    'code': '编码',
    'architecture': '架构设计',
    'devops': 'DevOps',
    'data': '数据处理',
    'security': '安全',
    'system': '系统',
    'programming': '编程',
    'algorithm': '算法',
    'backend': '后端开发',
    'frontend': '前端开发',
    'full-stack': '全栈开发',
    'infrastructure': '基础设施',
    'cloud': '云计算',
    'machine learning': '机器学习',
    'llm': '大语言模型',
    'blockchain': '区块链',
    'solidity': '智能合约',
    'ai': '人工智能',

    // Design
    'ui': 'UI设计',
    'ux': 'UX设计',
    'visual': '视觉设计',
    'brand': '品牌设计',
    'graphic': '图形设计',
    'product design': '产品设计',
    'experience': '用户体验',
    'prompt': '提示词工程',
    'photography': '摄影',
    'image': '图像',
    'inclusive': '无障碍设计',
    'accessibility': '无障碍设计',
    'illustration': '插画',
    'animation': '动画',
    'motion': '动效',
    'figma': 'Figma设计',
    'prototyping': '原型设计',

    // Marketing
    'marketing': '市场营销',
    'seo': 'SEO优化',
    'content': '内容营销',
    'social': '社交媒体',
    'growth': '增长策略',
    'campaign': '营销活动',
    'strategy': '策略规划',
    'analytics': '数据分析',
    'media': '媒体运营',
    'advertising': '广告投放',
    'copywriting': '文案写作',
    'video': '视频制作',
    'podcast': '播客运营',
    'twitter': '推特运营',
    'instagram': 'INS运营',
    'weibo': '微博运营',
    'zhihu': '知乎运营',
    'douyin': '抖音运营',
    'ecommerce': '电商运营',
    'livestream': '直播带货',
    'app store': '应用商店优化',
    'baidu': '百度SEO',

    // Sales
    'sales': '销售',
    'business': '商务',
    'deal': '交易',
    'account': '客户管理',
    'pipeline': '销售管道',
    'revenue': '营收',
    'customer': '客户服务',
    'discovery': '需求发现',
    'proposal': '方案撰写',
    'crm': 'CRM管理',
    'outbound': '外销拓展',
    'inbound': '内销转化',
    'enterprise': '企业销售',
    'partnership': '合作关系',

    // Product
    'product': '产品管理',
    'manager': '产品经理',
    'roadmap': '产品规划',
    'feature': '功能设计',
    'user': '用户研究',
    'market': '市场分析',
    'launch': '产品发布',
    'planning': '产品规划',
    'requirement': '需求分析',
    'specification': '规格定义',
    'agile': '敏捷管理',
    'scrum': 'Scrum管理',

    // Project Management
    'project': '项目管理',
    'management': '管理',
    'workflow': '工作流程',
    'jira': 'Jira配置',
    'operations': '运营管理',
    'studio': '工作室管理',
    'experiment': '实验管理',
    'tracker': '进度追踪',
    'shepherd': '项目引领',
    'producer': '制作管理',
    'steward': '流程管理',

    // Academic
    'cultural': '文化研究',
    'geography': '地理学',
    'historical': '历史研究',
    'narrative': '叙事学',
    'psychological': '心理学',
    'anthropology': '人类学',
    'ethnographic': '民族志',
    'research': '研究分析',
    'theory': '理论研究',

    // Game Development
    'game': '游戏开发',
    'level': '关卡设计',
    'narrative': '叙事设计',
    'audio': '音频设计',
    'unity': 'Unity开发',
    'unreal': 'Unreal开发',
    'engine': '游戏引擎',
    'player': '玩家体验',
    'world': '世界观构建',
    'environment': '环境设计',

    // Strategy
    'strategic': '战略规划',
    'corporate': '企业战略',
    'competitive': '竞争分析',
    'market': '市场战略',
    'advisor': '战略咨询',
    'consultant': '咨询顾问',

    // Support
    'support': '客户支持',
    'service': '服务管理',
    'finance': '财务管理',
    'infrastructure': '基础设施',
    'executive': '行政事务',
    'report': '报表分析',
    'help': '帮助支持',
    'responder': '响应处理',
    'maintainer': '运维维护',
    'tracker': '追踪分析',

    // Testing
    'testing': '测试工程',
    'qa': '质量保证',
    'quality': '质量管理',
    'accessibility': '无障碍测试',
    'performance': '性能测试',
    'evidence': '证据收集',
    'workflow': '流程测试',
    'reality': '真实性验证',
    'benchmark': '基准测试',
    'auditor': '审计检查',
    'validator': '验证测试',

    // Integrations
    'integration': '系统集成',
    'api': 'API集成',
    'platform': '平台对接',
    'connector': '连接器开发',
    'middleware': '中间件',
    'webhook': 'Webhook配置',
    'automation': '自动化',

    // Spatial Computing
    'xr': 'XR技术',
    'ar': '增强现实',
    'vr': '虚拟现实',
    'spatial': '空间计算',
    'metal': 'Metal图形',
    'immersive': '沉浸式体验',
    'apple': 'Apple平台',
    'vision': 'Vision Pro',
    '3d': '3D开发',
    'reality': '现实增强',

    // Paid Media
    'ppc': '点击付费',
    'programmatic': '程序化广告',
    'search': '搜索广告',
    'creative': '创意策略',
    'tracking': '追踪分析',
    'audit': '广告审计',
    'bid': '出价策略',
    'campaign': '广告投放',
    'google': 'Google广告',
    'facebook': 'Facebook广告',
  };

  const roleKeywords = {
    engineer: '工程师',
    developer: '开发者',
    designer: '设计师',
    manager: '经理',
    specialist: '专家',
    analyst: '分析师',
    strategist: '策略师',
    consultant: '顾问',
    architect: '架构师',
    lead: '负责人',
    director: '总监',
    coordinator: '协调员',
    associate: '助理',
    intern: '实习生',
    expert: '专家',
    master: '大师',
    ninja: '高手',
    guru: '大师',
    wizard: '专家',
    champion: '冠军',
    steward: '管家',
    shepherd: '引领者',
    guardian: '守护者',
    coach: '教练',
    mentor: '导师',
    advisor: '顾问',
    researcher: '研究员',
    historian: '历史学家',
    anthropologist: '人类学家',
    geographer: '地理学家',
    narrator: '叙事专家',
    psychologist: '心理学家',
    reporter: '报告员',
    maintainer: '维护工程师',
    responder: '客服专员',
    auditor: '审计员',
    checker: '检查员',
    producer: '制作人',
    tracker: '追踪员',
    curator: '策展人',
    creator: '创作者',
    optimizer: '优化师',
    buyer: '买手',
  };

  // Find matching role title
  let title = '专家';
  const roleKeys = Object.keys(roleKeywords);
  for (const roleKey of roleKeys) {
    if (descLower.includes(roleKey)) {
      title = roleKeywords[roleKey];
      break;
    }
  }

  // Find matching domain
  let domain = '';
  const domainKeys = Object.keys(domainToChinese);
  for (const kw of domainKeys) {
    if (descLower.includes(kw)) {
      domain = domainToChinese[kw];
      break;
    }
  }

  // Use Chinese name if available
  const displayName = name;

  // Generate description
  if (domain) {
    return `${displayName}是一位专业的${title}，专注于${domain}领域，拥有丰富的行业经验和专业知识。`;
  }

  return `${displayName}是一位专业的${title}，在相关领域拥有丰富的经验。`;
}

/**
 * Generate Chinese vibe from English vibe
 * 人才猎头风格：简洁有力，6-15字
 */
function generateVibeZh(vibe) {
  if (!vibe) return '';

  const vibeLower = vibe.toLowerCase();

  // Pattern-based translation with talent recruitment style
  const patterns = [
    // Experiment/Data driven
    { pattern: /data driven|experiments?.*data|let the data/i, zh: '让数据驱动决策' },
    { pattern: /experiment.*design|design.*experiment/i, zh: '用实验设计验证想法' },
    { pattern: /hypothesis.*validat|validat.*hypothesis/i, zh: '严谨假设，精准验证' },
    { pattern: /a.b test|ab test/i, zh: 'A/B测试专家' },
    { pattern: /statistical|statistic.*significance/i, zh: '统计分析见长' },
    { pattern: /results.*decide|decide.*results/i, zh: '用数据说话' },
    { pattern: /systematic|rigorous/i, zh: '系统化思维' },

    // Engineering
    { pattern: /full.?stack|full.?stack.*develop/i, zh: '全栈开发专家' },
    { pattern: /frontend|front.?end/i, zh: '前端开发专家' },
    { pattern: /backend|back.?end/i, zh: '后端架构专家' },
    { pattern: /devops|sre|automation/i, zh: 'DevOps自动化实践者' },
    { pattern: /security|threat.*detect/i, zh: '安全工程专家' },
    { pattern: /database|data.*optimi/i, zh: '数据库优化专家' },
    { pattern: /mobile|ios|android|app.*builder/i, zh: '移动端开发专家' },
    { pattern: /ai.*engineer|machine.?learn/i, zh: 'AI工程专家' },
    { pattern: /embedded.*firmware|firmware/i, zh: '嵌入式开发专家' },
    { pattern: /git.*workflow|code.*review/i, zh: '代码质量守护者' },
    { pattern: /incident.*response|on.?call/i, zh: '应急响应专家' },
    { pattern: /technical.*writer|document/i, zh: '技术文档专家' },

    // Design
    { pattern: /ui.*design|interface.*design/i, zh: 'UI设计专家' },
    { pattern: /ux.*design|user.*experience/i, zh: '用户体验设计专家' },
    { pattern: /brand.*guardian|brand.*design/i, zh: '品牌设计守护者' },
    { pattern: /image.*prompt|prompt.*engine/i, zh: 'AI图像提示词专家' },
    { pattern: /inclusive.*visual|accessibility/i, zh: '无障碍设计专家' },
    { pattern: /visual.*story|storytell/i, zh: '视觉叙事专家' },
    { pattern: /whimsy|playful|fun/i, zh: '趣味设计注入者' },

    // Marketing
    { pattern: /seo|search.*optim/i, zh: 'SEO优化专家' },
    { pattern: /content.*creat|content.*market/i, zh: '内容营销专家' },
    { pattern: /social.*media|social.*strateg/i, zh: '社交媒体策略师' },
    { pattern: /growth.*hack|growth.*market/i, zh: '增长黑客' },
    { pattern: /tiktok|douyin|short.*video/i, zh: '短视频运营专家' },
    { pattern: /ecommerce|e.?commerce/i, zh: '电商运营专家' },
    { pattern: /livestream|live.*stream/i, zh: '直播带货专家' },
    { pattern: /wechat.*official|wechat.*account/i, zh: '微信生态运营专家' },

    // Sales
    { pattern: /sales.*coach|coach.*sales/i, zh: '销售教练' },
    { pattern: /deal.*strateg|negotiat/i, zh: '交易策略专家' },
    { pattern: /outbound|lead.*gener/i, zh: '外销拓展专家' },
    { pattern: /pipeline.*analyst|pipeline/i, zh: '销售管道分析师' },
    { pattern: /account.*strateg|enterprise.*sale/i, zh: '大客户战略专家' },

    // Product
    { pattern: /behavior.*nudge|nudge.*engine/i, zh: '行为设计专家' },
    { pattern: /feedback.*synth|synthes.*feedback/i, zh: '用户反馈整合专家' },
    { pattern: /sprint.*priorit|sprint/i, zh: '敏捷迭代专家' },
    { pattern: /trend.*research|trend.*analyst/i, zh: '趋势研究专家' },

    // Project Management
    { pattern: /experiment.*track|experiment.*design/i, zh: '实验项目管理专家' },
    { pattern: /jira.*workflow|jira/i, zh: 'Jira工作流专家' },
    { pattern: /project.*shepherd|shepherd/i, zh: '项目护航专家' },
    { pattern: /studio.*operat|operation/i, zh: '工作室运营专家' },
    { pattern: /producer|product.*manage/i, zh: '制作管理专家' },

    // Testing
    { pattern: /accessibilit.*audit|access.*audit/i, zh: '无障碍测试专家' },
    { pattern: /api.*test|api.*audit/i, zh: 'API测试专家' },
    { pattern: /performance.*benchmark|benchmark/i, zh: '性能基准测试专家' },
    { pattern: /evidence.*collect|evidence/i, zh: '测试证据收集专家' },
    { pattern: /reality.*check|reality.*check/i, zh: '真实性验证专家' },
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
    { pattern: /level.*design|level.*design/i, zh: '关卡设计师' },
    { pattern: /narrative.*design|story.*design/i, zh: '叙事设计师' },
    { pattern: /technical.*artist/i, zh: '技术美术专家' },

    // Spatial Computing
    { pattern: /spatial.*metal|metal.*engine/i, zh: '空间Metal图形工程师' },
    { pattern: /terminal.*integrat|terminal/i, zh: '终端集成专家' },
    { pattern: /vision.*os|visionos/i, zh: 'VisionOS空间开发专家' },
    { pattern: /xr.*immersive|immersive/i, zh: 'XR沉浸式开发专家' },
    { pattern: /cockpit.*interact|cockpit/i, zh: 'XR座舱交互专家' },
    { pattern: /xr.*interface|interface.*architect/i, zh: 'XR界面架构师' },

    // Paid Media
    { pattern: /programmatic.*buy|programmatic/i, zh: '程序化广告买手' },
    { pattern: /search.*query|query.*analyst/i, zh: '搜索 Query 分析师' },
    { pattern: /ppc.*strateg|ppc/i, zh: 'PPC策略专家' },
    { pattern: /paid.*social|paid.*social.*strateg/i, zh: '付费社交策略师' },
    { pattern: /creative.*strateg|creative/i, zh: '创意策略专家' },
    { pattern: /tracking.*specialist|tracking/i, zh: '广告追踪专家' },

    // Specialized
    { pattern: /blockchain.*audit|security.*audit/i, zh: '区块链安全审计专家' },
    { pattern: /compliance.*audit|governance/i, zh: '合规治理专家' },
    { pattern: /corporate.*training|training.*design/i, zh: '企业培训设计师' },
    { pattern: /data.*consolidat|data.*agent/i, zh: '数据整合专家' },
    { pattern: /identity.*graph|identity.*graph/i, zh: '身份图谱专家' },
    { pattern: /agentic.*identity|trust.*architect/i, zh: 'Agent身份信任架构师' },
    { pattern: /mcp.*builder|mcp/i, zh: 'MCP构建专家' },
    { pattern: /salesforce.*architect|salesforce/i, zh: 'Salesforce架构师' },
    { pattern: /workflow.*architect|workflow/i, zh: '工作流架构师' },
    { pattern: /supply.*chain|supply.*chain/i, zh: '供应链战略专家' },
    { pattern: /zk.*steward|zero.?knowledge/i, zh: '零知识证明专家' },
    { pattern: /model.*qa|qa.*model/i, zh: '模型质量保障专家' },
    { pattern: /cultur.*intelligence|cultural/i, zh: '文化智能战略专家' },
    { pattern: /korean.*business|korean.*nav/i, zh: '韩中商务导航专家' },
    { pattern: /french.*consult|french.*market/i, zh: '法国市场咨询专家' },
    { pattern: /study.*abroad|abroad.*advisor/i, zh: '留学咨询顾问' },
    { pattern: /government.*digital|gov.*digital/i, zh: '政府数字化顾问' },
    { pattern: /healthcare.*complian|healthcare/i, zh: '医疗营销合规专家' },
  ];

  for (const { pattern, zh } of patterns) {
    if (pattern.test(vibeLower)) {
      return zh;
    }
  }

  // Fallback: extract key phrase and translate
  return vibe.length > 20 ? vibe.substring(0, 15) + '...' : vibe;
}

// Global counter for unique name assignment
let globalNameIndex = 0;
const usedNames = new Set();

// Flatten all names for global unique assignment (deduplicated)
const ALL_NAMES = [...new Set(Object.values(CHINESE_NAMES).flat())];

function getUniqueName(department, filename) {
  const names = CHINESE_NAMES[department] || CHINESE_NAMES.specialized;

  // First try to get a name specific to this department that hasn't been used
  for (let i = 0; i < names.length; i++) {
    const idx = (globalNameIndex + i) % names.length;
    const name = names[idx];
    if (!usedNames.has(name)) {
      usedNames.add(name);
      globalNameIndex++;
      return name;
    }
  }

  // Fallback: use global name pool
  const globalIdx = globalNameIndex % ALL_NAMES.length;
  const name = ALL_NAMES[globalIdx];
  usedNames.add(name);
  globalNameIndex++;
  return name;
}

function convertAgent(department, filename, content) {
  const { frontmatter, body } = parseFrontmatter(content);

  if (!frontmatter.name) {
    console.warn(`Skipping ${filename}: missing name`);
    return null;
  }

  // Split body content
  const { soulContent, agentsContent } = splitBodyContent(body);

  // Generate identity content
  const identityContent = generateIdentityContent(
    frontmatter.name,
    frontmatter.emoji,
    frontmatter.vibe
  );

  const nameZh = getUniqueName(department, filename);

  // Generate Chinese description
  const descriptionZh = generateDescriptionZh(frontmatter.name, frontmatter.description, department);

  // Generate Chinese vibe
  const vibeZh = generateVibeZh(frontmatter.vibe);

  return {
    id: generateId(department, frontmatter.name),
    name: frontmatter.name,
    nameZh,
    description: frontmatter.description || '',
    descriptionZh, // 中文描述
    vibeZh,         // 新增：中文风格
    color: frontmatter.color || 'blue',
    emoji: frontmatter.emoji || '👤',
    vibe: frontmatter.vibe || '',
    department: DEPARTMENT_MAPPING[department]?.id || 'specialized',
    departmentNameZh: DEPARTMENT_MAPPING[department]?.nameZh || '专门技能',
    // Enhanced fields
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

  // Get all department folders
  const folders = fs.readdirSync(AGENTS_DIR).filter((item) => {
    const itemPath = path.join(AGENTS_DIR, item);
    return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
  });

  const allEmployees = [];

  for (const folder of folders) {
    const folderPath = path.join(AGENTS_DIR, folder);

    // Skip non-department folders
    if (!DEPARTMENT_MAPPING[folder]) {
      console.log(`Skipping ${folder}: not a recognized department`);
      continue;
    }

    // Create department folder in output
    const outputFolder = path.join(OUTPUT_DIR, folder);
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    // Get all MD files in folder
    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith('.md'));

    console.log(`Processing ${folder}: ${files.length} files`);

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      const employee = convertAgent(folder, file, content);

      if (employee) {
        allEmployees.push(employee);

        // Write individual employee file
        const outputFile = path.join(outputFolder, file.replace('.md', '.json'));
        fs.writeFileSync(outputFile, JSON.stringify(employee, null, 2), 'utf-8');
      }
    }
  }

  // Write all employees index file
  const indexPath = path.join(OUTPUT_DIR, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(allEmployees, null, 2), 'utf-8');

  console.log(`\nConversion complete!`);
  console.log(`Total employees: ${allEmployees.length}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);

  // Verify output
  if (allEmployees.length > 0) {
    const sample = allEmployees[0];
    console.log(`\nSample employee: ${sample.nameZh} (${sample.name})`);
    console.log(`  soulContent: ${sample.soulContent ? '✓' : '✗'}`);
    console.log(`  agentsContent: ${sample.agentsContent ? '✓' : '✗'}`);
    console.log(`  identityContent: ${sample.identityContent ? '✓' : '✗'}`);
  }
}

main();