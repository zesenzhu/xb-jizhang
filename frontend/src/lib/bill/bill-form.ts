import type { CategoryType } from '@/lib/api/category-types';
import { amountTextFromCents } from './amount';

export interface BillFormState {
  type: CategoryType;
  /** 键盘输入的金额文本，如 "0" / "12.5" / "12.50" */
  amountText: string;
  categoryId: string | null;
  /** ISO 字符串，默认打开抽屉时的当前时间 */
  occurredAt: string;
  accountId: string | null;
  title: string;
  note: string;
  payerId: string | null;
  /** 幂等键；重试复用，保存并继续时重新生成 */
  clientRequestId: string;
  /** 用户是否已经填过任何有效内容，用于关闭确认 */
  isDirty: boolean;
  submitting: boolean;
  error: string | null;
  /** 发生时间的即时校验结果，由事件处理器判定后写入 */
  timeError: string | null;
}

export type BillFormAction =
  | { kind: 'setType'; type: CategoryType }
  | { kind: 'setAmount'; amountText: string }
  | { kind: 'setCategory'; categoryId: string }
  | { kind: 'setOccurredAt'; occurredAt: string; timeError: string | null }
  | { kind: 'setAccount'; accountId: string | null }
  | { kind: 'setTitle'; title: string }
  | { kind: 'setNote'; note: string }
  | { kind: 'setPayer'; payerId: string | null }
  | { kind: 'submitStart' }
  | { kind: 'submitFailure'; error: string }
  | { kind: 'resetForNext'; clientRequestId: string; occurredAt: string }
  | { kind: 'reset'; now: Date; categoryId?: string | null; accountId?: string | null; payerId?: string | null }
  /** 整体灌入一份状态，用于详情编辑态预填（reset 带不了全部字段） */
  | { kind: 'hydrate'; state: BillFormState };

export const NOTE_MAX_LENGTH = 200;

export interface InitialBillFormOptions {
  now?: Date;
  clientRequestId?: string;
  /** 预选分类：上次用过的，或该类型第一个一级分类 */
  categoryId?: string | null;
  accountId?: string | null;
  payerId?: string | null;
}

export function createInitialBillForm(
  options: InitialBillFormOptions = {},
): BillFormState {
  const now = options.now ?? new Date();
  return {
    type: 'EXPENSE',
    amountText: '0',
    // 预选不算「填过」：isDirty 仍为 false，关闭时不该弹放弃确认。
    categoryId: options.categoryId ?? null,
    occurredAt: now.toISOString(),
    accountId: options.accountId ?? null,
    title: '',
    note: '',
    payerId: options.payerId ?? null,
    clientRequestId: options.clientRequestId ?? generateRequestId(),
    isDirty: false,
    submitting: false,
    error: null,
    timeError: null,
  };
}

/**
 * 用已有账单预填编辑表单。
 *
 * 编辑态与新建共用同一份字段与校验，只差初始值和提交方式；
 * 因此这里返回同一个 `BillFormState`，而不是另立一套编辑 state。
 */
export function billFormFromTransaction(bill: {
  type: CategoryType;
  amountCents: number;
  categoryId: string | null;
  occurredAt: string;
  accountId: string | null;
  title: string | null;
  note: string | null;
  payerId: string | null;
  clientRequestId: string;
}): BillFormState {
  return {
    type: bill.type,
    amountText: amountTextFromCents(bill.amountCents),
    categoryId: bill.categoryId,
    occurredAt: bill.occurredAt,
    accountId: bill.accountId,
    title: bill.title ?? '',
    note: (bill.note ?? '').slice(0, NOTE_MAX_LENGTH),
    payerId: bill.payerId,
    clientRequestId: bill.clientRequestId,
    // 预填不算脏：用户没改动时关闭不该弹放弃确认。
    isDirty: false,
    submitting: false,
    error: null,
    timeError: null,
  };
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 极旧浏览器兜底：保持 UUID v4 形状，满足后端 @IsUUID 校验。
  const random = (): string => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${random()}${random()}-${random()}-4${random().slice(1)}-a${random().slice(1)}-${random()}${random()}${random()}`;
}

export function billFormReducer(state: BillFormState, action: BillFormAction): BillFormState {
  switch (action.kind) {
    case 'setType':
      // 支出与收入分类不可交叉使用，切换类型必须清空已选分类。
      if (state.type === action.type) return state;
      return { ...state, type: action.type, categoryId: null, isDirty: true };

    case 'setAmount':
      return { ...state, amountText: action.amountText, isDirty: isDirtyAfter(state, { amountText: action.amountText }) };

    case 'setCategory':
      return { ...state, categoryId: action.categoryId, isDirty: true };

    case 'setOccurredAt':
      return { ...state, occurredAt: action.occurredAt, timeError: action.timeError, isDirty: true };

    case 'setAccount':
      return { ...state, accountId: action.accountId, isDirty: true };

    case 'setTitle':
      return { ...state, title: action.title, isDirty: isDirtyAfter(state, { title: action.title }) };

    case 'setNote':
      return {
        ...state,
        note: action.note.slice(0, NOTE_MAX_LENGTH),
        isDirty: isDirtyAfter(state, { note: action.note }),
      };

    case 'setPayer':
      return { ...state, payerId: action.payerId, isDirty: true };

    case 'submitStart':
      return { ...state, submitting: true, error: null };

    case 'submitFailure':
      return { ...state, submitting: false, error: action.error };

    case 'hydrate':
      return action.state;

    case 'reset':
      // 重新打开抽屉必须是干净状态：上次放弃的草稿不能残留，
      // 但分类/账户/付款人沿用调用方给的「上次选择」。
      return createInitialBillForm({
        now: action.now,
        categoryId: action.categoryId,
        accountId: action.accountId,
        payerId: action.payerId,
      });

    case 'resetForNext':
      // 保存并继续：清空金额/商家/备注，保留类型/时间/分类/账户/付款人。
      return {
        ...state,
        amountText: '0',
        title: '',
        note: '',
        clientRequestId: action.clientRequestId,
        occurredAt: action.occurredAt,
        isDirty: false,
        submitting: false,
        error: null,
        timeError: null,
      };

    default:
      return state;
  }
}

/** 金额非 0、或商家/备注非空即视为脏数据，用于关闭前的放弃确认。 */
function isDirtyAfter(state: BillFormState, patch: Partial<BillFormState>): boolean {
  const next = { ...state, ...patch };
  return (
    next.amountText !== '0' ||
    next.title.trim().length > 0 ||
    next.note.trim().length > 0 ||
    next.categoryId !== null
  );
}
