import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateDigitalEmployeeDialog } from '@/pages/Agents/CreateDigitalEmployeeDialog';

const addEmployeeMock = vi.fn().mockResolvedValue(true);

const skillFieldInject = vi.hoisted(() => ({ slugs: null as string[] | null }));

vi.mock('@/stores/employees', () => ({
  useEmployeesStore: () => ({
    addEmployee: addEmployeeMock,
  }),
}));

const fetchSkillsMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/stores/skills', () => ({
  useSkillsStore: (sel: (s: { skills: unknown[]; loading: boolean; fetchSkills: () => Promise<void> }) => unknown) =>
    sel({
      skills: [],
      loading: false,
      fetchSkills: fetchSkillsMock,
    }),
}));

vi.mock('@/pages/Agents/CreateEmployeeSkillField', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Vitest mock factory must not close over ESM imports
  const R = require('react') as typeof import('react');
  return {
    CreateEmployeeSkillField: ({
      onSelectedSkillsChange,
    }: {
      onSelectedSkillsChange: (skills: { slug: string; title: string; description: string }[]) => void;
    }) => {
      R.useEffect(() => {
        if (skillFieldInject.slugs) {
          onSelectedSkillsChange(
            skillFieldInject.slugs.map((slug) => ({ slug, title: slug, description: '' })),
          );
        }
      }, [onSelectedSkillsChange]);
      return R.createElement('div', { 'data-testid': 'create-digital-employee-skills-section' });
    },
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('CreateDigitalEmployeeDialog', () => {
  beforeEach(() => {
    addEmployeeMock.mockClear();
    fetchSkillsMock.mockClear();
    skillFieldInject.slugs = null;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-test-123');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs Employee payload and calls addEmployee on submit', async () => {
    render(<CreateDigitalEmployeeDialog onClose={() => {}} />);

    fireEvent.change(screen.getByTestId('create-digital-employee-name-input'), {
      target: { value: '人类学家' },
    });
    fireEvent.change(screen.getByTestId('create-digital-employee-vibe-textarea'), {
      target: { value: '一句话 vibe' },
    });
    fireEvent.change(screen.getByTestId('create-digital-employee-soul-textarea'), {
      target: { value: '## soul' },
    });
    fireEvent.change(screen.getByTestId('create-digital-employee-agents-textarea'), {
      target: { value: '## agents' },
    });
    fireEvent.click(screen.getByTestId('create-digital-employee-emoji-option-0'));
    fireEvent.change(screen.getByTestId('create-digital-employee-color-input'), {
      target: { value: '#D97706' },
    });

    fireEvent.click(screen.getByTestId('create-digital-employee-submit-button'));

    await waitFor(() => expect(addEmployeeMock).toHaveBeenCalledTimes(1));
    const [employee] = addEmployeeMock.mock.calls[0];
    expect(employee.id).toBe('uuid-test-123');
    expect(employee.nameZh).toBe('人类学家');
    expect(employee.name).toBe('人类学家');
    expect(employee.department).toBe('custom');
    expect(employee.vibe).toBe('一句话 vibe');
    expect(employee.identityContent).toBe('一句话 vibe');
    expect(employee.description).toBe('一句话 vibe');
    expect(employee.soulContent).toBe('## soul');
    expect(employee.agentsContent).toBe('## agents');
    expect(employee.skipCatalogDetailFetch).toBe(true);
    expect(employee.skills).toBeUndefined();
  });

  it('keeps submit disabled and does not addEmployee when one-line description (vibe) is empty', () => {
    render(<CreateDigitalEmployeeDialog onClose={() => {}} />);

    fireEvent.change(screen.getByTestId('create-digital-employee-name-input'), {
      target: { value: '有名字无描述' },
    });
    fireEvent.change(screen.getByTestId('create-digital-employee-soul-textarea'), {
      target: { value: '## soul' },
    });
    fireEvent.change(screen.getByTestId('create-digital-employee-agents-textarea'), {
      target: { value: '## agents' },
    });
    fireEvent.click(screen.getByTestId('create-digital-employee-emoji-option-0'));
    fireEvent.change(screen.getByTestId('create-digital-employee-color-input'), {
      target: { value: '#D97706' },
    });

    const submit = screen.getByTestId('create-digital-employee-submit-button');
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(addEmployeeMock).not.toHaveBeenCalled();
  });
});

describe('CreateDigitalEmployeeDialog with skills selection', () => {
  beforeEach(() => {
    addEmployeeMock.mockClear();
    skillFieldInject.slugs = ['pdf-skill', 'doc-skill'];
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-test-456');
  });

  afterEach(() => {
    skillFieldInject.slugs = null;
    vi.restoreAllMocks();
  });

  it('passes skills on Employee when skill field reports selection', async () => {
    render(<CreateDigitalEmployeeDialog onClose={() => {}} />);

    fireEvent.change(screen.getByTestId('create-digital-employee-name-input'), {
      target: { value: '带技能员工' },
    });
    fireEvent.change(screen.getByTestId('create-digital-employee-vibe-textarea'), {
      target: { value: '一句话 vibe' },
    });
    fireEvent.change(screen.getByTestId('create-digital-employee-soul-textarea'), {
      target: { value: '## soul' },
    });
    fireEvent.change(screen.getByTestId('create-digital-employee-agents-textarea'), {
      target: { value: '## agents' },
    });
    fireEvent.click(screen.getByTestId('create-digital-employee-emoji-option-0'));
    fireEvent.change(screen.getByTestId('create-digital-employee-color-input'), {
      target: { value: '#D97706' },
    });

    fireEvent.click(screen.getByTestId('create-digital-employee-submit-button'));

    await waitFor(() => expect(addEmployeeMock).toHaveBeenCalledTimes(1));
    const [employee] = addEmployeeMock.mock.calls[0];
    expect(employee.skills).toEqual(['pdf-skill', 'doc-skill']);
  });
});
