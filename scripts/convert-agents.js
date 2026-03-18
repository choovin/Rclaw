/**
 * Convert Agents Script
 * Converts agency-agents-temp MD files to employee data format
 */
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', 'agency-agents-temp');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data', 'employees');

// Department mapping from folder name to our department type
const DEPARTMENT_MAPPING = {
  engineering: 'engineering',
  design: 'design',
  marketing: 'marketing',
  sales: 'sales',
  product: 'product',
  'project-management': 'project-management',
  academic: 'academic',
  'game-development': 'game-development',
  strategy: 'strategy',
  support: 'support',
  testing: 'testing',
  integrations: 'integrations',
  specialized: 'specialized',
  'spatial-computing': 'spatial-computing',
  'paid-media': 'paid-media',
};

// Chinese names from popular TV dramas
const CHINESE_NAMES = {
  engineering: ['韩商言', '于途', '肖奈', '何以琛', '封沉', '顾漫', '李现'],
  design: ['唐晶', '安迪', '林无敌', '苏明哲', '陈美嘉'],
  marketing: ['房似锦', '童薇', '樊书涛', '郡', '宁', '静'],
  sales: ['贺涵', '许半夏', '程开', '苏', '老', '白'],
  product: ['苏明玉', '安迪', '曲筱绡'],
  'project-management': ['方思雨', '孟晓', '辛', '鹿', '鸣'],
  academic: ['叶春梅', '霍', '心', '茹'],
  'game-development': ['韩商言', '小米', 'grunt', '令', '山', '古'],
  strategy: ['贺涵', '陈俊生', '魏', '深', '渊'],
  support: ['小张', '王', '漫', '妮'],
  testing: ['张伟', '李', '贞', '子'],
  integrations: ['Tony', 'Micheal', '林', '八', '斗'],
  specialized: ['专门人才'],
  'spatial-computing': ['未来', '科技', '星', '际', '凡'],
  'paid-media': ['广', '告', '狂', '人', '明', '远'],
};

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

function convertAgent(department, filename, content) {
  const { frontmatter, body } = parseFrontmatter(content);

  if (!frontmatter.name) {
    console.warn(`Skipping ${filename}: missing name`);
    return null;
  }

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
    department: DEPARTMENT_MAPPING[department] || 'specialized',
  };
}

function main() {
  console.log('Starting agent conversion...');

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
}

main();