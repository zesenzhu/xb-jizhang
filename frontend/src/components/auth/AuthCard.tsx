'use client'

import * as React from 'react'
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  WalletCards,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiRequestError } from '@/lib/api/errors'
import { loginUser, registerUser } from '@/lib/api/user-auth-api'
import { useAppStore } from '@/store/useAppStore'
import { useUserAuthStore } from '@/store/userAuthStore'
import { cn } from '@/lib/utils'

export interface AuthCardProps {
  onSuccess?: () => void
  defaultMode?: 'login' | 'register'
  className?: string
}

export function AuthCard({
  onSuccess,
  defaultMode = 'login',
  className,
}: AuthCardProps): React.JSX.Element {
  const [mode, setMode] = React.useState<'login' | 'register'>(defaultMode)
  const setCurrentUser = useUserAuthStore((state) => state.setCurrentUser)
  const setActiveLedger = useAppStore((state) => state.setActiveLedger)

  // 表单状态
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [nickname, setNickname] = React.useState('')
  const [email, setEmail] = React.useState('')

  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // 模式切换时清理错误
  const switchMode = (targetMode: 'login' | 'register'): void => {
    setMode(targetMode)
    setErrorMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErrorMessage(null)

    // 基础客户端校验
    const cleanUsername = username.trim()
    if (cleanUsername.length < 3 || cleanUsername.length > 32) {
      setErrorMessage('用户名长度必须在 3 到 32 个字符之间')
      return
    }

    if (mode === 'register') {
      if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
        setErrorMessage('用户名只允许包含字母、数字和下划线')
        return
      }
      if (password.length < 8 || password.length > 72) {
        setErrorMessage('密码长度至少需要 8 个字符（最长 72 字符）')
        return
      }
    } else {
      if (!password) {
        setErrorMessage('请输入密码')
        return
      }
    }

    try {
      setIsLoading(true)
      if (mode === 'login') {
        const result = await loginUser({
          username: cleanUsername,
          password,
        })
        setCurrentUser(result.user)
        setActiveLedger(result.ledgers[0] ?? null)
      } else {
        const result = await registerUser({
          username: cleanUsername,
          password,
          nickname: nickname.trim() || undefined,
          email: email.trim() || undefined,
        })
        setCurrentUser(result.user)
        setActiveLedger(result.defaultLedger)
      }
      onSuccess?.()
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('网络请求异常，请检查后端服务')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={cn(
        'w-full max-w-sm sm:max-w-md mx-auto rounded-3xl border border-slate-200/80 bg-white/95 backdrop-blur-md p-6 sm:p-8 shadow-xl shadow-slate-200/50',
        className,
      )}
    >
      {/* 头部品牌图标与标题 */}
      <div className="flex flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-ios-blue to-blue-600 text-white shadow-lg shadow-ios-blue/30">
          <WalletCards size={28} />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          {mode === 'login' ? '欢迎回到小宝记账' : '开启轻量共享记账'}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {mode === 'login'
            ? '随时随地记一笔，个人与多人账本云端协同'
            : '注册即可自动获赠默认个人账本，可邀好友共同记账'}
        </p>
      </div>

      {/* 移动端分段式 Tab 选择器 */}
      <div className="mt-6 flex rounded-2xl bg-slate-100 p-1 select-none">
        <button
          type="button"
          onClick={() => switchMode('login')}
          className={cn(
            'flex-1 rounded-xl py-2 text-xs font-semibold transition-all',
            mode === 'login'
              ? 'bg-white text-ios-blue shadow-xs'
              : 'text-slate-500 hover:text-slate-800',
          )}
        >
          账号登录
        </button>
        <button
          type="button"
          onClick={() => switchMode('register')}
          className={cn(
            'flex-1 rounded-xl py-2 text-xs font-semibold transition-all',
            mode === 'register'
              ? 'bg-white text-ios-blue shadow-xs'
              : 'text-slate-500 hover:text-slate-800',
          )}
        >
          免费注册
        </button>
      </div>

      {/* 错误提示胶囊 */}
      {errorMessage && (
        <div className="mt-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 border border-rose-200/60 animate-in fade-in">
          {errorMessage}
        </div>
      )}

      {/* 登录/注册表单 */}
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            用户名 <span className="text-rose-500">*</span>
          </label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={
              mode === 'login' ? '输入用户名' : '3-32位（英文/数字/下划线）'
            }
            autoComplete="username"
            startIcon={<User size={16} />}
            disabled={isLoading}
            required
          />
        </div>

        {mode === 'register' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              昵称{' '}
              <span className="text-slate-400 font-normal">
                （选填，在账本中向好友展示）
              </span>
            </label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="例如：宝哥、小明"
              startIcon={<Sparkles size={16} />}
              disabled={isLoading}
            />
          </div>
        )}

        {mode === 'register' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              安全邮箱{' '}
              <span className="text-slate-400 font-normal">
                （选填，用于找回账本）
              </span>
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              autoComplete="email"
              startIcon={<Mail size={16} />}
              disabled={isLoading}
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            密码 <span className="text-rose-500">*</span>
          </label>
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              mode === 'login' ? '输入密码' : '设置密码（至少 8 位）'
            }
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            startIcon={<Lock size={16} />}
            endIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="pointer-events-auto p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            disabled={isLoading}
            required
          />
        </div>

        <Button
          type="submit"
          variant="default"
          size="lg"
          className="w-full mt-4 h-12 rounded-2xl text-base shadow-ios-blue/25"
          isLoading={isLoading}
          loadingText={mode === 'login' ? '正在登录...' : '正在注册账号...'}
        >
          {mode === 'login' ? '立即登录' : '创建账号并进入'}
        </Button>
      </form>

      {/* 底部隐私与安全微标 */}
      <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck size={14} className="text-ios-blue" />
        <span>HttpOnly 级安全会话保护 · 离线自动同步</span>
      </div>
    </div>
  )
}
