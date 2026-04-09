import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateDigitalEmployeeDialog } from '@/pages/Agents/CreateDigitalEmployeeDialog';

const addEmployeeMock = vi.fn().mockResolvedValue(true);

vi.mock('@/stores/employees', () => ({
  useEmployeesStore: () => ({
    addEmployee: addEmployeeMock,
  }),
}));

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
