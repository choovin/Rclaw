import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { cloudApi } from '@/lib/cloud-api';
// import { getWechatOAuthRedirectUri } from '@/lib/wechat-oauth-redirect';

// 微信登录暂时关闭 —— 恢复时取消下方注释并同步 index.html 中的 wxLogin.js
// // WxLogin SDK 类型声明
// declare global {
//   interface Window {
//     WxLogin: new (config: {
//       self_redirect: boolean;
//       id: string;
//       appid: string;
//       scope: string;
//       redirect_uri: string;
//       state: string;
//       style?: string;
//       stylelite?: number;
//       href?: string;
//     }) => void;
//   }
// }

// // 解析查询字符串
// function parseQueryString(input: string): Record<string, string> {
//   const q = input.includes('?') ? new URL(input).search : input;
//   const params = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q);
//   const out: Record<string, string> = {};
//   for (const [k, v] of params.entries()) {
//     out[k] = v;
//   }
//   return out;
// }

type LoginTab = 'password' | 'sms';

export const LoginModal: React.FC = () => {
  const { loginModalOpen, closeLoginModal, setLoggedIn, syncUserInfoFromHost } = useAuthStore();
  const [activeTab, setActiveTab] = useState<LoginTab>('password');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [rememberMobile, setRememberMobile] = useState(true);
  const [smsCountdown, setSmsCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // // 微信登录状态
  // const [wechatQrLoading, setWechatQrLoading] = useState(false);
  // const [wechatError, setWechatError] = useState('');

  // Ref to store SMS timer ID for proper cleanup
  const smsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup SMS countdown timer on unmount
  useEffect(() => {
    return () => {
      if (smsTimerRef.current) {
        clearInterval(smsTimerRef.current);
        smsTimerRef.current = null;
      }
    };
  }, []);

  // Reset form state when modal closes
  useEffect(() => {
    if (!loginModalOpen) {
      setActiveTab('password');
      // 记住手机号 - 关闭弹窗时也保存
      if (rememberMobile && mobile) {
        localStorage.setItem('remembered_mobile', mobile);
      } else if (!rememberMobile) {
        localStorage.removeItem('remembered_mobile');
      }
      setPassword('');
      setCode('');
      setRememberMobile(true);
      setLoading(false);
      setError('');
      // setWechatQrLoading(false);
      // setWechatError('');
      // 不清空 smsCountdown，保持验证码倒计时继续
    }
    // 仅在开关弹窗时重置；关闭瞬间读取 mobile / rememberMobile，不随输入变化重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [loginModalOpen]);

  useEffect(() => {
    if (loginModalOpen && rememberMobile) {
      const savedMobile = localStorage.getItem('remembered_mobile');
      if (savedMobile) setMobile(savedMobile);
    }
  }, [loginModalOpen, rememberMobile]);

  // /**
  //  * 必须先请求 Host → 云端 social-auth-redirect，再检查 WxLogin。
  //  * 若在请求前判断 `window.WxLogin`，SDK 尚未加载时会直接 return，导致永远不会发网络请求（与 runnode LoginModal 顺序一致）。
  //  */
  // const loadWechatQrWidget = useCallback(async (signal: { cancelled: boolean }) => {
  //   setWechatQrLoading(true);
  //   setWechatError('');

  //   try {
  //     const redirectUri = getWechatOAuthRedirectUri();
  //     if (!redirectUri) {
  //       setWechatError(
  //         '无法解析微信回调地址：请正确配置 VITE_CLOUD_API_BASE_URL（与 RunNode 业务云根地址一致，微信开放平台登记同源域名）。',
  //       );
  //       setWechatQrLoading(false);
  //       return;
  //     }

  //     const result = await cloudApi.getWechatQr(redirectUri);
  //     if (signal.cancelled) return;

  //     if (!result.success || !result.data) {
  //       setWechatError(result.error || '获取微信登录参数失败');
  //       setWechatQrLoading(false);
  //       return;
  //     }

  //     const params = parseQueryString(result.data as string);

  //     if (!params.appid || !params.redirect_uri) {
  //       setWechatError('微信登录参数不完整');
  //       setWechatQrLoading(false);
  //       return;
  //     }

  //     await new Promise((resolve) => setTimeout(resolve, 100));
  //     if (signal.cancelled) return;

  //     if (typeof window.WxLogin !== 'function') {
  //       setWechatError('微信登录组件未加载，请检查网络或稍后点击重试');
  //       setWechatQrLoading(false);
  //       return;
  //     }

  //     const container = document.getElementById('wechat_qrcode_container');
  //     if (!container) {
  //       setWechatError('二维码容器不存在');
  //       setWechatQrLoading(false);
  //       return;
  //     }

  //     const existingIframe = container.querySelector('iframe');
  //     if (existingIframe) {
  //       existingIframe.remove();
  //     }

  //     new window.WxLogin({
  //       self_redirect: false,
  //       id: 'wechat_qrcode_container',
  //       appid: params.appid,
  //       scope: params.scope || 'snsapi_login',
  //       redirect_uri: encodeURIComponent(params.redirect_uri),
  //       state: params.state || '',
  //       style: 'white',
  //       stylelite: 1,
  //       href: '',
  //     });

  //     setWechatQrLoading(false);
  //   } catch (err) {
  //     if (signal.cancelled) return;
  //     console.error('微信登录初始化失败:', err);
  //     setWechatError('微信登录初始化失败');
  //     setWechatQrLoading(false);
  //   }
  // }, []);

  // // 打开登录弹窗时自动拉取微信扫码参数（与 runnode LoginModal watch open 行为一致）
  // useEffect(() => {
  //   if (!loginModalOpen) return;
  //   const sig = { cancelled: false };
  //   void loadWechatQrWidget(sig);
  //   return () => {
  //     sig.cancelled = true;
  //   };
  // }, [loginModalOpen, loadWechatQrWidget]);

  // // 监听 URL 参数变化（微信回调）
  // useEffect(() => {
  //   if (!loginModalOpen) return;

  //   const urlParams = new URLSearchParams(window.location.search);
  //   const code = urlParams.get('code');
  //   const state = urlParams.get('state');

  //   if (code && state) {
  //     // 检测到微信回调参数
  //     handleWechatCallback(code, state);
  //   }
  // }, [loginModalOpen]);

  // const handleWechatCallback = async (code: string, state: string) => {
  //   setError('');
  //   try {
  //     const result = await cloudApi.wechatLogin(code, state);
  //     if (result.success) {
  //       setLoggedIn(true, result.userInfo);
  //       // 清除 URL 参数
  //       window.history.replaceState({}, '', window.location.pathname);
  //       closeLoginModal();
  //     } else {
  //       setError(result.error || '微信登录失败');
  //     }
  //   } catch (err) {
  //     setError('网络错误');
  //   }
  // };

  const handleSendSms = async () => {
    if (!mobile) {
      setError('请输入手机号');
      return;
    }
    const result = await cloudApi.sendSms(mobile);
    if (!result.success) {
      setError(result.error || '发送失败');
      return;
    }
    setSmsCountdown(60);
    // Clear any existing timer before starting a new one
    if (smsTimerRef.current) {
      clearInterval(smsTimerRef.current);
    }
    smsTimerRef.current = setInterval(() => {
      setSmsCountdown((prev) => {
        if (prev <= 1) {
          if (smsTimerRef.current) {
            clearInterval(smsTimerRef.current);
            smsTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      let result;
      if (activeTab === 'password') {
        if (!mobile || !password) {
          setError('请输入手机号和密码');
          setLoading(false);
          return;
        }
        result = await cloudApi.login(mobile, password);
      } else {
        if (!mobile || !code) {
          setError('请输入手机号和验证码');
          setLoading(false);
          return;
        }
        result = await cloudApi.smsLogin(mobile, code);
      }

      if (result.success) {
        if (rememberMobile) {
          localStorage.setItem('remembered_mobile', mobile);
        } else {
          localStorage.removeItem('remembered_mobile');
        }
        setLoggedIn(true, result.userInfo);
        closeLoginModal();
        void syncUserInfoFromHost();
        void (async () => {
          const { toast } = await import('sonner');
          const syncResult = await cloudApi.syncPlatformProvider();
          if (!syncResult.success) {
            toast.error('模型网关配置同步失败，可稍后重试');
            return;
          }
          const { useProviderStore } = await import('@/stores/providers');
          await useProviderStore.getState().refreshProviderSnapshot();
        })();
      } else {
        setError(result.error || '登录失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  // const handleWechatLogin = () => {
  //   void loadWechatQrWidget({ cancelled: false });
  // };

  if (!loginModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={closeLoginModal} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-[460px] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">云账号登录</h2>
          <button onClick={closeLoginModal} className="p-1 hover:bg-accent rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex">
          {/*
          微信扫码区域（暂时关闭，恢复时取消注释并改回弹窗宽度 w-[800px]）
          <div className="flex w-[340px] shrink-0 flex-col items-center justify-center bg-secondary/30 px-5 pb-2.5 pt-8">
            <div className="relative mb-5 flex min-h-[160px] w-full flex-col items-center justify-center">
              <div
                id="wechat_qrcode_container"
                className="flex max-h-[160px] max-w-[160px] justify-center overflow-hidden rounded-md bg-white [&_iframe]:!h-[160px] [&_iframe]:!w-[160px] [&_iframe]:max-w-none [&_iframe]:border-0"
              />
              {wechatQrLoading && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 rounded-md bg-white/95 px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  加载中...
                </div>
              )}
              {!wechatQrLoading && typeof window.WxLogin !== 'function' && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-md bg-white/95 px-2 py-3 text-center text-sm text-muted-foreground shadow-sm">
                  点击下方按钮
                  <br />
                  获取微信二维码
                </div>
              )}
            </div>
            {wechatError && (
              <div className="mb-2 text-center text-xs text-red-500">{wechatError}</div>
            )}
            <button
              type="button"
              onClick={handleWechatLogin}
              disabled={wechatQrLoading}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {wechatQrLoading ? '加载中...' : '微信扫码登录'}
            </button>
          </div>
          */}

          {/* 登录表单区域 */}
          <div className="flex-1 p-6">
            {/* Tabs */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setActiveTab('password')}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'password'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                密码登录
              </button>
              <button
                onClick={() => setActiveTab('sms')}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'sms'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                验证码登录
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">手机号</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-secondary text-muted-foreground text-sm border border-r-0 rounded-l-md">
                    +86
                  </span>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="请输入手机号"
                    className="flex-1 px-3 py-2 border rounded-r-md text-sm"
                  />
                </div>
              </div>

              {activeTab === 'password' ? (
                <div>
                  <label className="block text-sm mb-1">密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                  {error && (
                    <div className="text-sm text-red-500 mt-1">{error}</div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm mb-1">验证码</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="请输入验证码"
                      className="flex-1 px-3 py-2 border rounded-md text-sm"
                    />
                    <button
                      onClick={handleSendSms}
                      disabled={smsCountdown > 0}
                      className="px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md disabled:opacity-50"
                    >
                      {smsCountdown > 0 ? `${smsCountdown}s` : '发送验证码'}
                    </button>
                  </div>
                  {error && (
                    <div className="text-sm text-red-500 mt-1">{error}</div>
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberMobile}
                  onChange={(e) => setRememberMobile(e.target.checked)}
                />
                记住手机号
              </label>

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? '登录中...' : '立即登录'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
