import { create } from 'zustand';

/**
 * 本次会话内新建的邀请。
 *
 * 存在的唯一理由：账本邀请列表接口缺失（P5），但创建邀请的响应里带一次性 Token，
 * 撤销接口也需要 `invitationId`。把它留在内存里，Owner 才能在离开页面之前撤销刚发出的邀请。
 * 不持久化——刷新后 Token 与 id 已不可恢复，硬留着只会给出一个点了会 404 的按钮。
 */
export interface SessionInvitation {
  id: string;
  ledgerId: string;
  targetEmail: string;
  role: 'EDITOR' | 'VIEWER';
  expiresAt: string;
  /** 含一次性 Token 的完整邀请链接，仅本次会话可见 */
  inviteLink: string;
}

interface InvitationSessionState {
  byLedger: Record<string, SessionInvitation[]>;
  add: (ledgerId: string, invitation: SessionInvitation) => void;
  remove: (ledgerId: string, invitationId: string) => void;
  clear: () => void;
}

/**
 * 稳定的空数组。
 *
 * 选择器返回 `state.byLedger[id] ?? []` 时，每次渲染都会造出一个新数组，
 * `useSyncExternalStore` 会认为快照一直在变而无限重渲染。共用一个冻结常量才能保持引用稳定。
 */
const EMPTY_INVITATIONS: readonly SessionInvitation[] = Object.freeze([]);

export const useInvitationSessionStore = create<InvitationSessionState>((set) => ({
  byLedger: {},
  add: (ledgerId, invitation) =>
    set((state) => ({
      byLedger: {
        ...state.byLedger,
        [ledgerId]: [...(state.byLedger[ledgerId] ?? []), invitation],
      },
    })),
  remove: (ledgerId, invitationId) =>
    set((state) => ({
      byLedger: {
        ...state.byLedger,
        [ledgerId]: (state.byLedger[ledgerId] ?? []).filter((item) => item.id !== invitationId),
      },
    })),
  clear: () => set({ byLedger: {} }),
}));

/** 读取某账本本次会话新建的邀请；没有记录时返回同一个冻结空数组。 */
export function selectSessionInvitations(
  ledgerId: string,
): (state: InvitationSessionState) => readonly SessionInvitation[] {
  return (state) => state.byLedger[ledgerId] ?? EMPTY_INVITATIONS;
}
