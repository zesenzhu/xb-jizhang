'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, X } from 'lucide-react'
import type { AttachmentDraft } from '@/lib/api/attachment-types'
import { uploadAttachmentQueue } from '@/lib/bill/attachment-queue'
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_COUNT,
  createAttachmentDraft,
  validateAttachmentFiles,
} from '@/lib/bill/attachment-validation'
import { createTransaction } from '@/lib/api/transaction-api'
import { getNoteSuggestions } from '@/lib/api/note-api'
import { cn } from '@/lib/utils'
import { getCategories } from '@/lib/api/category-api'
import { getAccounts } from '@/lib/api/account-api'
import { ApiRequestError } from '@/lib/api/errors'
import { queryKeys, queryStaleTime } from '@/lib/query/query-config'
import { parseAmountText } from '@/lib/bill/amount'
import { useUserAuthStore } from '@/store/userAuthStore'
import {
  isAccountListResponse as isAccountSnapshot,
  isCategoryListResponse as isCategorySnapshot,
  useCachedLedgerSnapshot,
  usePersistLedgerSnapshot,
} from '@/lib/offline/query-snapshot'
import { createOfflineTransactionRecord } from '@/lib/offline/local-transaction'
import { enqueueOfflineTransaction, getLocalCacheStats } from '@/lib/offline/storage'
import type { OfflineAttachmentRecord } from '@/lib/offline/storage-types'
import {
  buildCategoryTree,
  resolveInitialCategoryId,
} from '@/lib/bill/category-tree'
import {
  NOTE_MAX_LENGTH,
  billFormReducer,
  createInitialBillForm,
} from '@/lib/bill/bill-form'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { useOfflineStore } from '@/store/offlineStore'
import { useBillMemoryStore } from '@/store/billMemoryStore'
import { AccountPickerSheet } from './AccountPickerSheet'
import { BillFormBody } from './BillFormBody'
import { SheetTypeSegment } from './SheetTypeSegment'

export interface BillCreateSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ledgerId: string
  ledgerName: string | null
  /** 当前成员角色，决定分类管理入口是否可见 */
  memberRole?: 'OWNER' | 'EDITOR' | 'VIEWER'
  /** 创建成功后回调，用于滚动到列表顶部 */
  onCreated?: () => void
}

export function BillCreateSheet({
  open,
  onOpenChange,
  ledgerId,
  ledgerName,
  memberRole,
  onCreated,
}: BillCreateSheetProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const [state, dispatch] = React.useReducer(billFormReducer, undefined, () =>
    createInitialBillForm(),
  )
  const [accountPickerOpen, setAccountPickerOpen] = React.useState(false)
  const [confirmDiscard, setConfirmDiscard] = React.useState(false)
  const [wasOpen, setWasOpen] = React.useState(open)
  const [showInactive, setShowInactive] = React.useState(false)
  const [categoryError, setCategoryError] = React.useState(false)
  const [attachmentDrafts, setAttachmentDrafts] = React.useState<
    AttachmentDraft[]
  >([])
  const [attachmentError, setAttachmentError] = React.useState<string | null>(
    null,
  )
  const [attachmentTransactionId, setAttachmentTransactionId] = React.useState<
    string | null
  >(null)
  const attachmentInputRef = React.useRef<HTMLInputElement | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const isOnline = useOfflineStore((store) => store.isOnline)
  const setSyncState = useOfflineStore((store) => store.setSyncState)
  const currentUser = useUserAuthStore((store) => store.currentUser)
  const remembered = useBillMemoryStore((store) => store.byLedger[ledgerId])
  const remember = useBillMemoryStore((store) => store.remember)

  const cachedCategories = useCachedLedgerSnapshot({
    userId: currentUser?.id ?? null,
    ledgerId,
    kind: 'categories',
    guard: isCategorySnapshot,
  })
  const cachedAccounts = useCachedLedgerSnapshot({
    userId: currentUser?.id ?? null,
    ledgerId,
    kind: 'accounts',
    guard: isAccountSnapshot,
  })

  // 每次打开都重置表单。用渲染期比较代替 effect，避免级联渲染与首帧闪旧值。
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) {
      dispatch({
        kind: 'reset',
        now: new Date(),
        categoryId: null,
        accountId: remembered?.accountId ?? null,
        payerId: remembered?.payerId ?? null,
      })
      setCategoryError(false)
      setConfirmDiscard(false)
      setAttachmentError(null)
      setAttachmentTransactionId(null)
      setAttachmentDrafts((drafts) => {
        drafts.forEach((draft) => URL.revokeObjectURL(draft.previewUrl))
        return []
      })
    }
  }

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(ledgerId),
    queryFn: () => getCategories(ledgerId, { pageSize: 100 }),
    staleTime: queryStaleTime.categories,
    enabled: open && Boolean(ledgerId),
  })

  const canManageCategories = memberRole === 'OWNER'
  const allCategoriesQuery = useQuery({
    queryKey: [...queryKeys.categories(ledgerId), 'withInactive'] as const,
    queryFn: () =>
      getCategories(ledgerId, { pageSize: 100, includeInactive: true }),
    staleTime: queryStaleTime.categories,
    enabled: open && canManageCategories && showInactive,
  })

  const noteSuggestionsQuery = useQuery({
    queryKey: queryKeys.transactions.noteSuggestions(ledgerId),
    queryFn: () => getNoteSuggestions(ledgerId, 10),
    staleTime: queryStaleTime.noteSuggestions,
    enabled: open && Boolean(ledgerId),
  })

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts(ledgerId),
    queryFn: () => getAccounts(ledgerId, { pageSize: 100 }),
    staleTime: queryStaleTime.accounts,
    enabled: open && Boolean(ledgerId),
  })

  usePersistLedgerSnapshot({
    userId: currentUser?.id ?? null,
    ledgerId,
    kind: 'categories',
    data: categoriesQuery.data,
    recordCount: categoriesQuery.data?.items.length,
  })
  usePersistLedgerSnapshot({
    userId: currentUser?.id ?? null,
    ledgerId,
    kind: 'accounts',
    data: accountsQuery.data,
    recordCount: accountsQuery.data?.items.length,
  })

  const categories = categoriesQuery.data?.items ?? cachedCategories.data?.items
  // 分类树只随数据与类型变化；切换支出/收入会换一整棵树，不适合每次渲染重建。
  const categoryNodes = React.useMemo(
    () =>
      buildCategoryTree(
        (categories ?? []).filter((category) => category.type === state.type),
      ),
    [categories, state.type],
  )
  const accounts = accountsQuery.data?.items ?? cachedAccounts.data?.items ?? []

  /**
   * 有效分类 = 用户本次选的，否则回退到「上次用过的 / 该类型第一个」。
   *
   * 不用 effect 写入 state：分类是异步加载的，等数据到位再 setState 会违反
   * react-hooks/set-state-in-effect，而且会和用户手选打架。
   * 直接在渲染期派生：`state.categoryId` 一旦被用户设定就不再回退，
   * 因此这里不存在「覆盖用户选择」的问题。
   */
  const effectiveCategoryId =
    state.categoryId ??
    resolveInitialCategoryId(
      categoryNodes,
      remembered?.categoryByType?.[state.type] ?? null,
    )

  // 下游（分类选择、路径文案、提交）统一消费这份带预选的状态。
  const formState = React.useMemo(
    () =>
      effectiveCategoryId === state.categoryId
        ? state
        : { ...state, categoryId: effectiveCategoryId },
    [state, effectiveCategoryId],
  )

  const amount = parseAmountText(state.amountText)
  // 未来时间由事件处理器判定后写入 state.timeError：渲染期不读取当前时钟。
  const isFutureTime = state.timeError !== null
  const canSubmit =
    amount.cents !== null &&
    effectiveCategoryId !== null &&
    !isFutureTime &&
    !state.submitting
  /**
   * 提交键的禁用只覆盖「无论怎么点都不可能成功」的情况：金额非法、时间为未来、离线。
   * 未选分类不在此列——用户需要能点一下，才看得到高亮和滚动引导。
   */
  const submitBlocked = amount.cents === null || isFutureTime

  const createMutation = useMutation({
    mutationFn: () =>
      createTransaction(ledgerId, {
        clientRequestId: state.clientRequestId,
        type: state.type,
        amountCents: amount.cents ?? 0,
        occurredAt: state.occurredAt,
        categoryId: effectiveCategoryId ?? '',
        accountId: state.accountId,
        title: state.title.trim() || null,
        note: state.note.trim() || null,
        payerId: state.payerId,
      }),
  })

  const addAttachmentFiles = (fileList: FileList | null): void => {
    if (!fileList) return
    const files = Array.from(fileList)
    const result = validateAttachmentFiles(files, attachmentDrafts.length)
    const nextDrafts: AttachmentDraft[] = result.accepted.map(
      createAttachmentDraft,
    )
    setAttachmentError(
      result.errors.length > 0 ? result.errors.join('；') : null,
    )
    setAttachmentDrafts((drafts) => [...drafts, ...nextDrafts])
    if (attachmentInputRef.current) attachmentInputRef.current.value = ''
  }

  const removeAttachment = (localId: string): void => {
    setAttachmentDrafts((drafts) => {
      const target = drafts.find((draft) => draft.localId === localId)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return drafts.filter((draft) => draft.localId !== localId)
    })
  }

  const uploadDrafts = async (transactionId: string): Promise<boolean> => {
    const drafts = attachmentDrafts.filter(
      (draft) => draft.status !== 'ATTACHED',
    )
    if (drafts.length === 0) return true
    let hasFailure = false
    await uploadAttachmentQueue({
      ledgerId,
      transactionId,
      drafts,
      onProgress: (progress) => {
        if (progress.status === 'FAILED') hasFailure = true
        setAttachmentDrafts((current) =>
          current.map((draft) =>
            draft.localId === progress.localId
              ? { ...draft, status: progress.status, error: progress.error }
              : draft,
          ),
        )
      },
    })
    return !hasFailure
  }

  const clearUploadedAttachments = (): void => {
    setAttachmentDrafts((drafts) => {
      drafts.forEach((draft) => URL.revokeObjectURL(draft.previewUrl))
      return []
    })
    setAttachmentError(null)
    setAttachmentTransactionId(null)
  }

  const retryAttachments = async (): Promise<void> => {
    if (!attachmentTransactionId || state.submitting) return
    dispatch({ kind: 'submitStart' })
    const attachmentsUploaded = await uploadDrafts(attachmentTransactionId)
    void queryClient.invalidateQueries({
      queryKey: queryKeys.transactions.all(ledgerId),
    })
    if (attachmentsUploaded) {
      clearUploadedAttachments()
      dispatch({ kind: 'submitFailure', error: '' })
      return
    }
    setAttachmentError('图片仍未全部上传成功，请稍后重试')
    dispatch({ kind: 'submitFailure', error: '' })
  }

  const submit = async (keepOpen: boolean): Promise<void> => {
    if (state.submitting) return

    if (effectiveCategoryId === null) {
      // 未选分类：分类区就在滚动容器顶部，滚回顶部并在标题上高亮。
      setCategoryError(true)
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      dispatch({ kind: 'submitFailure', error: '请选择分类' })
      return
    }

    if (!canSubmit || amount.cents === null) {
      dispatch({
        kind: 'submitFailure',
        error:
          amount.error ?? (isFutureTime ? '不能记未来的账' : '当前无法提交'),
      })
      return
    }

    dispatch({ kind: 'submitStart' })
    try {
      const payload = {
        clientRequestId: state.clientRequestId,
        type: state.type,
        amountCents: amount.cents,
        occurredAt: state.occurredAt,
        categoryId: effectiveCategoryId,
        accountId: state.accountId,
        title: state.title.trim() || null,
        note: state.note.trim() || null,
        payerId: state.payerId,
      }

      if (!isOnline) {
        if (!currentUser) {
          dispatch({ kind: 'submitFailure', error: '登录状态已失效，请重新登录后再试' })
          return
        }
        const localId = crypto.randomUUID()
        const now = new Date().toISOString()
        const offlineAttachments: OfflineAttachmentRecord[] = attachmentDrafts.map((draft) => ({
          localId: draft.localId,
          userId: currentUser.id,
          ledgerId,
          transactionLocalId: localId,
          clientRequestId: draft.clientRequestId,
          blob: draft.file,
          fileName: draft.file.name,
          mimeType: draft.file.type,
          sizeBytes: draft.file.size,
          status: 'LOCAL',
          attachmentId: null,
          lastError: null,
          createdAt: now,
          updatedAt: now,
        }))
        const category = categories?.find((item) => item.id === effectiveCategoryId) ?? null
        const account = accounts.find((item) => item.id === state.accountId) ?? null
        const record = createOfflineTransactionRecord({
          localId,
          user: currentUser,
          ledgerId,
          payload,
          category,
          account,
          payer: null,
          attachments: offlineAttachments,
          now,
        })
        await enqueueOfflineTransaction(record, offlineAttachments)
        const stats = await getLocalCacheStats(currentUser.id)
        setSyncState({
          syncStatus: 'idle',
          pendingCount: stats.pendingTransactionCount + stats.pendingAttachmentCount,
          lastSyncAt: stats.lastSyncAt,
        })
        remember(ledgerId, state.type, {
          categoryId: effectiveCategoryId,
          accountId: state.accountId,
          payerId: state.payerId,
        })
        clearUploadedAttachments()
        dispatch({
          kind: 'resetForNext',
          clientRequestId: crypto.randomUUID(),
          occurredAt: new Date().toISOString(),
        })
        if (!keepOpen) onOpenChange(false)
        onCreated?.()
        return
      }

      const transactionId =
        attachmentTransactionId ?? (await createMutation.mutateAsync()).id
      setAttachmentTransactionId(transactionId)
      const attachmentsUploaded = await uploadDrafts(transactionId)
      /*
       * 只等「账单已写入」就关面板，缓存刷新放到后台。
       * 之前这里串行 await 三组失效，等于等列表和四个统计查询全部回来才关抽屉，
       * 实测拖到 1-2 秒；用户感觉是「保存很慢」，其实数据早就写成功了。
       */
      void queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(ledgerId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.noteSuggestions(ledgerId),
      })
      void queryClient.invalidateQueries({
        queryKey: ['ledger', ledgerId, 'statistics'],
      })

      if (attachmentsUploaded) {
        clearUploadedAttachments()
        dispatch({
          kind: 'resetForNext',
          clientRequestId: crypto.randomUUID(),
          occurredAt: new Date().toISOString(),
        })
      } else {
        setAttachmentError('账单已保存，但部分图片上传失败，请重试')
        dispatch({
          kind: 'resetForNext',
          clientRequestId: crypto.randomUUID(),
          occurredAt: new Date().toISOString(),
        })
      }
      // 记下本次选择，下次打开直接预选。
      remember(ledgerId, state.type, {
        categoryId: effectiveCategoryId,
        accountId: state.accountId,
        payerId: state.payerId,
      })

      if (!keepOpen && attachmentsUploaded) onOpenChange(false)
      onCreated?.()
    } catch (error) {
      const message = !isOnline
        ? '无法保存到本机，请检查浏览器存储权限或清理缓存后重试'
        : error instanceof ApiRequestError
          ? error.code === 40321
            ? '你的账本权限已变化，请让账本所有者调整后再试'
            : error.message
          : '保存失败，请检查网络后重试'
      dispatch({ kind: 'submitFailure', error: message })
    }
  }

  const requestClose = React.useCallback((): boolean => {
    if ((state.isDirty || attachmentDrafts.length > 0) && !state.submitting) {
      setConfirmDiscard(true)
      return false
    }
    return true
  }, [state.isDirty, state.submitting, attachmentDrafts.length])

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        variant="full"
        onBeforeClose={requestClose}
      >
        {/*
          顶部固定：关闭 + 支出/收入 + 账本名，一行放完。
          分段器必须相对整行居中，所以左右两侧各占等宽槽位（关闭键 / 账本名），
          用 grid 三列而不是 flex + gap，避免账本名长短把 tabs 推偏。
        */}
        <div className="shrink-0">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-3">
            <button
              type="button"
              aria-label="关闭"
              onClick={() => {
                if (requestClose()) onOpenChange(false)
              }}
              className="flex size-9 shrink-0 items-center justify-center justify-self-start rounded-full bg-app-card-subtle text-text-muted active:scale-95"
            >
              <X size={18} />
            </button>
            <SheetTypeSegment
              value={state.type}
              onChange={(type) => dispatch({ kind: 'setType', type })}
            />
            <span className="min-w-0 justify-self-end truncate text-right text-xs text-text-muted">
              {ledgerName ?? ''}
            </span>
          </div>
          {state.error && (
            <div
              role="alert"
              className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="flex-1">{state.error}</span>
              <button
                type="button"
                aria-label="关闭提示"
                onClick={() => dispatch({ kind: 'submitFailure', error: '' })}
                className="shrink-0 text-rose-500"
              >
                <X size={13} />
              </button>
            </div>
          )}
          {attachmentError && (
            <div
              role="alert"
              className="mx-4 mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              {attachmentError}
            </div>
          )}
        </div>

        <BillFormBody
          state={formState}
          dispatch={dispatch}
          categoryNodes={categoryNodes}
          categories={categories ?? []}
          categoriesLoading={
            categoriesQuery.isPending && !categoriesQuery.data && !cachedCategories.data
          }
          categoriesError={
            categoriesQuery.isError && !categoriesQuery.data
              ? '分类加载失败'
              : null
          }
          onRetryCategories={() => void categoriesQuery.refetch()}
          categoryError={categoryError}
          onSelectCategory={(categoryId) => {
            setCategoryError(false)
            dispatch({ kind: 'setCategory', categoryId })
          }}
          accounts={accounts}
          onOpenAccountPicker={() => setAccountPickerOpen(true)}
          isOnline={isOnline}
          scrollRef={scrollRef}
          primaryText="完成"
          secondaryText="保存再记"
          onSubmit={() => void submit(false)}
          onSecondarySubmit={() => void submit(true)}
          submitDisabled={submitBlocked}
          attachmentDrafts={attachmentDrafts}
          onOpenAttachmentPicker={() => attachmentInputRef.current?.click()}
          onRemoveAttachment={removeAttachment}
          onRetryAttachments={() => void retryAttachments()}
          attachmentsDisabled={state.submitting}
          noteSuggestions={noteSuggestionsQuery.data?.items ?? []}
          categoryManage={
            canManageCategories
              ? {
                  ledgerId,
                  type: state.type,
                  canManage: canManageCategories,
                  // 未拉含停用列表前先用启用列表兜底，避免管理面板空白。
                  allCategories:
                    (showInactive
                      ? allCategoriesQuery.data?.items
                      : categories) ?? [],
                  isLoadingAll: showInactive && allCategoriesQuery.isPending,
                  showInactive,
                  onToggleInactive: () => setShowInactive((value) => !value),
                  onChanged: () => {
                    void categoriesQuery.refetch()
                    void allCategoriesQuery.refetch()
                  },
                }
              : undefined
          }
        />
      </BottomSheet>

      <input
        ref={attachmentInputRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => addAttachmentFiles(event.target.files)}
      />

      <AccountPickerSheet
        open={accountPickerOpen}
        onOpenChange={setAccountPickerOpen}
        accounts={accounts}
        selectedId={state.accountId}
        onSelect={(accountId) => dispatch({ kind: 'setAccount', accountId })}
      />

      <BottomSheet
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="放弃本次记账吗"
      >
        <div className="space-y-3 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <p className="text-sm text-text-muted">已填写的内容不会保存。</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              className="rounded-2xl border border-app-border py-2.5 text-sm text-text-main"
            >
              继续填写
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDiscard(false)
                setAttachmentDrafts((drafts) => {
                  drafts.forEach((draft) =>
                    URL.revokeObjectURL(draft.previewUrl),
                  )
                  return []
                })
                setAttachmentError(null)
                setAttachmentTransactionId(null)
                onOpenChange(false)
              }}
              className="rounded-2xl bg-rose-500 py-2.5 text-sm font-semibold text-white"
            >
              放弃
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
