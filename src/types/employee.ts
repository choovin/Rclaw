/**
 * Employee Types
 * Type definitions for digital employees
 */

export type Department =
  | 'engineering'
  | 'design'
  | 'marketing'
  | 'sales'
  | 'product'
  | 'project-management'
  | 'academic'
  | 'game-development'
  | 'strategy'
  | 'support'
  | 'testing'
  | 'integrations'
  | 'specialized'
  | 'spatial-computing'
  | 'paid-media';

export interface Employee {
  id: string;
  name: string;
  nameZh: string; // Chinese name from TV shows
  description: string;
  color: string;
  emoji: string;
  vibe: string;
  department: Department;
  skills?: string[];
  channels?: string[];
}

export interface EmployeeWithStatus extends Employee {
  addedAt?: number;
  isAdded: boolean;
}

export interface DepartmentInfo {
  id: Department;
  name: string;
  nameZh: string;
  emoji: string;
  description: string;
}

export const DEPARTMENT_MAP: Record<Department, DepartmentInfo> = {
  engineering: {
    id: 'engineering',
    name: 'Engineering',
    nameZh: '研发部',
    emoji: '💻',
    description: 'Software development and technical implementation',
  },
  design: {
    id: 'design',
    name: 'Design',
    nameZh: '设计部',
    emoji: '🎨',
    description: 'UI/UX design and visual design',
  },
  marketing: {
    id: 'marketing',
    name: 'Marketing',
    nameZh: '市场部',
    emoji: '📢',
    description: 'Marketing campaigns and brand management',
  },
  sales: {
    id: 'sales',
    name: 'Sales',
    nameZh: '销售部',
    emoji: '💼',
    description: 'Sales and business development',
  },
  product: {
    id: 'product',
    name: 'Product',
    nameZh: '产品部',
    emoji: '📦',
    description: 'Product management and strategy',
  },
  'project-management': {
    id: 'project-management',
    name: 'Project Management',
    nameZh: '项目管理',
    emoji: '📋',
    description: 'Project coordination and delivery',
  },
  academic: {
    id: 'academic',
    name: 'Academic',
    nameZh: '学术部',
    emoji: '🎓',
    description: 'Research and academic work',
  },
  'game-development': {
    id: 'game-development',
    name: 'Game Development',
    nameZh: '游戏开发',
    emoji: '🎮',
    description: 'Game design and development',
  },
  strategy: {
    id: 'strategy',
    name: 'Strategy',
    nameZh: '战略部',
    emoji: '♟️',
    description: 'Strategic planning and analysis',
  },
  support: {
    id: 'support',
    name: 'Support',
    nameZh: '客服部',
    emoji: '🎧',
    description: 'Customer support and service',
  },
  testing: {
    id: 'testing',
    name: 'Testing',
    nameZh: '测试部',
    emoji: '🧪',
    description: 'Quality assurance and testing',
  },
  integrations: {
    id: 'integrations',
    name: 'Integrations',
    nameZh: '集成部',
    emoji: '🔌',
    description: 'System integration and APIs',
  },
  specialized: {
    id: 'specialized',
    name: 'Specialized',
    nameZh: '专门技能',
    emoji: '⭐',
    description: 'Specialized skills and expertise',
  },
  'spatial-computing': {
    id: 'spatial-computing',
    name: 'Spatial Computing',
    nameZh: '空间计算',
    emoji: '🌐',
    description: 'AR/VR and spatial experiences',
  },
  'paid-media': {
    id: 'paid-media',
    name: 'Paid Media',
    nameZh: '付费媒体',
    emoji: '📺',
    description: 'Paid advertising and media buying',
  },
};