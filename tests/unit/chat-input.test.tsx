import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getPlainTextFromRoot, setSelectionFromOffsets } from '@/pages/Chat/chat-composer-plaintext';
import { COMPOSER_ZWSP } from '@/pages/Chat/chat-skill-command';
import { MemoryRouter } from 'react-router-dom';
import { ChatInput } from '@/pages/Chat/ChatInput';

const { agentsState, chatState, gatewayState, skillsState } = vi.hoisted(() => ({
  agentsState: {
    agents: [] as Array<Record<string, unknown>>,
  },
  chatState: {
    currentAgentId: 'main',
  },
  gatewayState: {
    status: { state: 'running', port: 18789 },
  },
  skillsState: {
    skills: [
      {
        id: 'feishu',
        slug: 'feishu',
        name: 'Feishu',
        description: 'Feishu skill',
        enabled: true,
        icon: '⚙️',
      },
    ] as Array<Record<string, unknown>>,
    fetchSkills: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/stores/skills', () => ({
  useSkillsStore: (selector: (state: typeof skillsState) => unknown) => selector(skillsState),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: vi.fn(),
}));

function translate(key: string, vars?: Record<string, unknown>): string {
  switch (key) {
    case 'composer.attachFiles':
      return 'Attach files';
    case 'composer.pickAgent':
      return 'Choose agent';
    case 'composer.clearTarget':
      return 'Clear target agent';
    case 'composer.targetChip':
      return `@${String(vars?.agent ?? '')}`;
    case 'composer.agentPickerTitle':
      return 'Route the next message to another agent';
    case 'composer.gatewayDisconnectedPlaceholder':
      return 'Gateway not connected...';
    case 'composer.send':
      return 'Send';
    case 'composer.stop':
      return 'Stop';
    case 'composer.gatewayConnected':
      return 'connected';
    case 'composer.gatewayStatus':
      return `gateway ${String(vars?.state ?? '')} | port: ${String(vars?.port ?? '')} ${String(vars?.pid ?? '')}`.trim();
    case 'composer.retryFailedAttachments':
      return 'Retry failed attachments';
    case 'composer.skillPicker.open':
      return 'Select skill';
    case 'composer.skillPicker.searchPlaceholder':
      return 'Search skills';
    case 'composer.skillPicker.skillsLibrary':
      return 'Skills library';
    case 'composer.skillPicker.emptyEnabled':
      return 'No enabled skills';
    case 'composer.skillPicker.noResults':
      return 'No matching skills';
    case 'composer.skillPicker.removeToken':
      return 'Remove skill command';
    default:
      return key;
  }
}

function renderChatInput(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

describe('ChatInput agent targeting', () => {
  beforeEach(() => {
    agentsState.agents = [];
    chatState.currentAgentId = 'main';
    gatewayState.status = { state: 'running', port: 18789 };
  });

  it('hides the @agent picker when only one agent is configured', () => {
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'MiniMax',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
    ];

    renderChatInput(<ChatInput onSend={vi.fn()} />);

    expect(screen.queryByTitle('Choose agent')).not.toBeInTheDocument();
  });

  it('lets the user select an agent target and sends it with the message', async () => {
    const onSend = vi.fn();
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'MiniMax',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
      {
        id: 'research',
        name: 'Research',
        isDefault: false,
        modelDisplay: 'Claude',
        inheritedModel: false,
        workspace: '~/.openclaw/workspace-research',
        agentDir: '~/.openclaw/agents/research/agent',
        mainSessionKey: 'agent:research:desk',
        channelTypes: [],
      },
    ];

    renderChatInput(<ChatInput onSend={onSend} />);

    fireEvent.click(screen.getByTitle('Choose agent'));
    fireEvent.click(screen.getByText('Research'));

    expect(screen.getByText('@Research')).toBeInTheDocument();

    const composer = screen.getByTestId('chat-composer');
    composer.textContent = 'Hello direct agent';
    fireEvent.input(composer);
    await waitFor(() => {
      expect(getPlainTextFromRoot(composer as HTMLElement)).toBe('Hello direct agent');
    });
    fireEvent.click(screen.getByTitle('Send'));

    expect(onSend).toHaveBeenCalledWith('Hello direct agent', undefined, 'research');
  });

  it('inserts picked skill at caret and closes skill popover', async () => {
    renderChatInput(<ChatInput onSend={vi.fn()} disabled={false} sending={false} isEmpty />);
    const composer = screen.getByTestId('chat-composer');

    composer.textContent = 'hello world';
    fireEvent.input(composer);
    await waitFor(() => {
      expect(composer).toHaveTextContent('hello world');
    });
    setSelectionFromOffsets(composer, 6, 6);
    fireEvent.input(composer);

    fireEvent.click(screen.getByTitle('Select skill'));
    expect(screen.getByText('/feishu')).toBeInTheDocument();

    fireEvent.click(screen.getByText('/feishu'));

    await waitFor(() => {
      expect(getPlainTextFromRoot(composer as HTMLElement)).toBe(
        `hello ${COMPOSER_ZWSP}/feishu${COMPOSER_ZWSP}world`,
      );
    });
    expect(screen.queryByPlaceholderText('Search skills')).not.toBeInTheDocument();
  });
});
