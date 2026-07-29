import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Fix 1 の回帰テスト：
// (a) localStorage.getItem が例外を投げても、getSnapshot（readAck）はそれを飲み込み、
//     レンダーがクラッシュせずモーダルが正常に開くこと。
// (b) localStorage.setItem が例外を投げても、cachedAck の更新とリスナー通知は必ず走り、
//     ユーザーがモーダルを閉じられること（オーバーレイに閉じ込められないこと）。
describe('DisclaimerModal — localStorage 障害時のフォールバック', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

  function stubThrowingLocalStorage() {
    const throwing = {
      getItem: vi.fn(() => {
        throw new Error('storage blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('storage blocked');
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } satisfies Storage;
    Object.defineProperty(window, 'localStorage', {
      value: throwing,
      configurable: true,
      writable: true,
    });
    return throwing;
  }

  afterEach(() => {
    cleanup();
    if (originalDescriptor) {
      Object.defineProperty(window, 'localStorage', originalDescriptor);
    }
    vi.resetModules();
  });

  it('getItem が throw してもレンダーはクラッシュせず、モーダルが開く', async () => {
    stubThrowingLocalStorage();
    vi.resetModules();
    const { DisclaimerModal } = await import('../src/components/layout/DisclaimerModal');

    expect(() => render(<DisclaimerModal />)).not.toThrow();
    expect(screen.queryByRole('dialog')).not.toBeNull();
  });

  it('setItem が throw しても、同意ボタンでモーダルを閉じられる（リスナー通知は必ず走る）', async () => {
    const storage = stubThrowingLocalStorage();
    vi.resetModules();
    const { DisclaimerModal } = await import('../src/components/layout/DisclaimerModal');

    render(<DisclaimerModal />);
    expect(screen.queryByRole('dialog')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '理解しました' }));

    // setItem は呼ばれた（永続化を試みた）が、失敗してもモーダルは閉じている。
    expect(storage.setItem).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape で閉じても setItem は呼ばれない（永続化しない）', async () => {
    const storage = stubThrowingLocalStorage();
    vi.resetModules();
    const { DisclaimerModal } = await import('../src/components/layout/DisclaimerModal');

    render(<DisclaimerModal />);
    expect(screen.queryByRole('dialog')).not.toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
