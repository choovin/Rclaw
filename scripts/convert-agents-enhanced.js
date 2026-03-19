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

// Chinese names from popular TV dramas
const CHINESE_NAMES = {
  engineering: ['韩商言', '于途', '肖奈', '何以琛', '封沉', '顾漫', '李现'],
  design: ['唐晶', '安迪', '林无敌', '苏明哲', '陈美嘉'],
  marketing: ['房似锦', '童薇', '樊书涛', '郡书', '宁静', '静蕾'],
  sales: ['贺涵', '许半夏', '程开', '苏明玉', '老白', '白凡'],
  product: ['苏明玉', '安迪', '曲筱绡'],
  'project-management': ['方思雨', '孟晓', '辛鹿鸣', '鹿鸣', '雨薇'],
  academic: ['叶春梅', '霍心', '心茹', '春茹'],
  'game-development': ['韩商言', '小米', 'grunt', '令山', '古川', '令古'],
  strategy: ['贺涵', '陈俊生', '魏渊', '深渊', '魏深'],
  support: ['小张', '王漫妮', '漫妮', '小王'],
  testing: ['张伟', '李贞子', '贞子', '张丽'],
  integrations: ['Tony', 'Micheal', '林八斗', '八斗', '林宇'],
  specialized: ['专门人才'],
  'spatial-computing': ['未来', '科技', '星际', '凡星', '宇凡'],
  'paid-media': ['广告狂人', '明远', '广明', '远航', '广厦'],
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

  const names = CHINESE_NAMES[department] || CHINESE_NAMES.specialized;
  const nameIndex = Math.abs(filename.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % names.length;
  const nameZh = names[nameIndex];

  // Generate Chinese description
  const descriptionZh = generateDescriptionZh(frontmatter.name, frontmatter.description, department);

  return {
    id: generateId(department, frontmatter.name),
    name: frontmatter.name,
    nameZh,
    description: frontmatter.description || '',
    descriptionZh, // 中文描述
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