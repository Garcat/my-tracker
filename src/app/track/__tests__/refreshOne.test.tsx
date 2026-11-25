import { render, screen, waitFor, act, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/lib/storage-api', () => ({
  loadSharedTrackingState: jest.fn(),
  saveSharedInputs: jest.fn(),
  saveSharedResults: jest.fn(),
  saveTrackingSnapshot: jest.fn(),
}));

import { loadSharedTrackingState, saveTrackingSnapshot } from '@/lib/storage-api';
import TrackApp from '../page';

const REFRESH_TIMEOUT_MS = 20000;

const makeResult = (status: string) => ({
  data: {
    hisList: [{ toStatus: status, createDate: '2026-11-20 10:00:00' }],
    wbInfo: { expressCode: 'E1' },
  },
  msg: 'ok',
  result: true,
});

// 取第一行结果的卡片（标题 div 所在的 p-4 容器）
const getRowCard = async (label: RegExp) => {
  const title = (await screen.findAllByText(label)).find((el) => el.tagName === 'DIV') as HTMLElement;
  return title.closest('.p-4') as HTMLElement;
};

const renderLoadedApp = async () => {
  render(<TrackApp />);
  await waitFor(() => expect(screen.queryByText(/Loading shared data/)).not.toBeInTheDocument());
  return getRowCard(/B0001/);
};

const setup = (fetchImpl: jest.Mock) => {
  (loadSharedTrackingState as jest.Mock).mockResolvedValue({
    inputs: ['B0001 招商', 'B0002'],
    results: [makeResult('到件'), makeResult('派送中')],
    lastTrackingFetchAt: new Date('2020-01-01T00:00:00').getTime(),
  });
  global.fetch = fetchImpl;
};

describe('单条刷新', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('成功后停止转圈、更新结果与「最后一次查询」时间并落库', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => makeResult('感谢使用') });
    setup(fetchMock);
    (saveTrackingSnapshot as jest.Mock).mockResolvedValue(undefined);

    const card = await renderLoadedApp();
    act(() => {
      fireEvent.click(within(card).getByRole('button'));
    });

    await waitFor(() => expect(within(card).getByText(/感谢使用/)).toBeInTheDocument());
    expect(document.querySelectorAll('.animate-spin')).toHaveLength(0);
    expect(within(card).queryByText(/刷新失败/)).not.toBeInTheDocument();
    // 时间已刷新（不再是 2020）
    await waitFor(() => expect(screen.getByText(/最后一次查询：/).textContent).not.toMatch(/2020/));
    expect(saveTrackingSnapshot).toHaveBeenCalled();
  });

  it('HTTP 失败时停止转圈、保留原状态并在该行提示错误', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
    setup(fetchMock);

    const card = await renderLoadedApp();
    act(() => {
      fireEvent.click(within(card).getByRole('button'));
    });

    await waitFor(() => expect(within(card).getByText(/刷新失败/)).toBeInTheDocument());
    expect(within(card).getByText(/HTTP 502/)).toBeInTheDocument();
    expect(within(card).getByText(/到件/)).toBeInTheDocument();
    expect(document.querySelectorAll('.animate-spin')).toHaveLength(0);
    // 失败不刷新时间、不落库
    expect(screen.getByText(/最后一次查询：/).textContent).toMatch(/2020/);
    expect(saveTrackingSnapshot).not.toHaveBeenCalled();
  });

  it('上游返回 result=false 时提示 msg 并保留原状态', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { hisList: [], wbInfo: { expressCode: '' } }, msg: '传递数据不正确', result: false }),
    });
    setup(fetchMock);

    const card = await renderLoadedApp();
    act(() => {
      fireEvent.click(within(card).getByRole('button'));
    });

    await waitFor(() => expect(within(card).getByText(/传递数据不正确/)).toBeInTheDocument());
    expect(within(card).getByText(/到件/)).toBeInTheDocument();
    expect(document.querySelectorAll('.animate-spin')).toHaveLength(0);
    expect(saveTrackingSnapshot).not.toHaveBeenCalled();
  });

  it('请求一直不返回时按超时中断，停止转圈并给出错误提示', async () => {
    const fetchMock = jest.fn(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('The user aborted a request.', 'AbortError')),
          );
        }),
    );
    setup(fetchMock);

    const card = await renderLoadedApp();
    jest.useFakeTimers();
    act(() => {
      fireEvent.click(within(card).getByRole('button'));
    });
    act(() => {
      jest.advanceTimersByTime(REFRESH_TIMEOUT_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });
    jest.useRealTimers();

    expect(within(card).getByText(/请求超时/)).toBeInTheDocument();
    expect(within(card).getByText(/到件/)).toBeInTheDocument();
    expect(document.querySelectorAll('.animate-spin')).toHaveLength(0);
  });
});
