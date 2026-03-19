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

  return {
    id: generateId(department, frontmatter.name),
    name: frontmatter.name,
    nameZh,
    description: frontmatter.description || '',
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