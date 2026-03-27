import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { cloudApi } from '@/lib/cloud-api';

// WxLogin SDK 类型声明
declare global {
  interface Window {
    WxLogin: new (config: {
      self_redirect: boolean;
      id: string;
      appid: string;
      scope: string;
      redirect_uri: string;
      state: string;
      style?: string;
      stylelite?: number;
      href?: string;
    }) => void;
  }
}

// 解析查询字符串
function parseQueryString(input: string): Record<string, string> {
  const q = input.includes('?') ? new URL(input).search : input;
  const params = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  return out;
}

type LoginTab = 'password' | 'sms';

export const LoginModal: React.FC = () => {
  const { loginModalOpen, closeLoginModal, setLoggedIn } = useAuthStore();
  const [activeTab, setActiveTab] = useState<LoginTab>('password');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [rememberMobile, setRememberMobile] = useState(true);
  const [smsCountdown, setSmsCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 微信登录状态
  const [wechatQrLoading, setWechatQrLoading] = useState(false);
  const [wechatError, setWechatError] = useState('');

  // Ref to store SMS timer ID for proper cleanup
  const smsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wechatContainerRef = useRef<HTMLDivElement>(null);

  // Cleanup SMS countdown timer on unmount
  useEffect(() => {
    return () => {
      if (smsTimerRef.current) {
        clearInterval(smsTimerRef.current);
        smsTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (loginModalOpen && activeTab === 'password' && rememberMobile) {
      // 从 localStorage 读取记住的手机号
      const savedMobile = localStorage.getItem('remembered_mobile');
      if (savedMobile) setMobile(savedMobile);
    }
  }, [loginModalOpen, activeTab, rememberMobile]);

  // 监听 URL 参数变化（微信回调）
  useEffect(() => {
    if (!loginModalOpen) return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      // 检测到微信回调参数
      handleWechatCallback(code, state);
    }
  }, [loginModalOpen]);

  const handleWechatCallback = async (code: string, state: string) => {
    setError('');
    try {
      const result = await cloudApi.wechatLogin(code, state);
      if (result.success) {
        setLoggedIn(true, result.userInfo);
        // 清除 URL 参数
        window.history.replaceState({}, '', window.location.pathname);
        closeLoginModal();
      } else {
        setError(result.error || '微信登录失败');
      }
    } catch (err) {
      setError('网络错误');
    }
  };

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
      } else {
        setError(result.error || '登录失败');
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleWechatLogin = async () => {
    if (!window.WxLogin) {
      setWechatError('微信登录组件未加载');
      return;
    }

    setWechatQrLoading(true);
    setWechatError('');

    try {
      const result = await cloudApi.getWechatQr(window.location.origin);

      if (!result.success || !result.data) {
        setWechatError(result.error || '获取微信登录参数失败');
        setWechatQrLoading(false);
        return;
      }

      // 解析返回的查询字符串参数
      const params = parseQueryString(result.data as string);

      if (!params.appid || !params.redirect_uri) {
        setWechatError('微信登录参数不完整');
        setWechatQrLoading(false);
        return;
      }

      // 等待 DOM 渲染完成
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!wechatContainerRef.current) {
        setWechatError('二维码容器不存在');
        setWechatQrLoading(false);
        return;
      }

      // 清除之前的 iframe
      const existingIframe = wechatContainerRef.current.querySelector('iframe');
      if (existingIframe) {
        existingIframe.remove();
      }

      // 使用 WxLogin SDK 渲染二维码
      new window.WxLogin({
        self_redirect: false,
        id: 'wechat_qrcode_container',
        appid: params.appid,
        scope: params.scope || 'snsapi_login',
        redirect_uri: encodeURIComponent(params.redirect_uri),
        state: params.state || '',
        style: 'white',
        stylelite: 1,
        href: '',
      });

      setWechatQrLoading(false);
    } catch (err) {
      console.error('微信登录初始化失败:', err);
      setWechatError('微信登录初始化失败');
      setWechatQrLoading(false);
    }
  };

  if (!loginModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={closeLoginModal} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-[800px] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">云账号登录</h2>
          <button onClick={closeLoginModal} className="p-1 hover:bg-accent rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex">
          {/* 微信扫码区域 */}
          <div className="w-[280px] bg-secondary/30 p-6 flex flex-col items-center">
            <div
              ref={wechatContainerRef}
              id="wechat_qrcode_container"
              className="w-[160px] h-[160px] bg-white rounded-lg flex items-center justify-center mb-4"
            >
              {wechatQrLoading && (
                <div className="text-muted-foreground text-sm">加载中...</div>
              )}
              {!wechatQrLoading && !window.WxLogin && (
                <div className="text-muted-foreground text-sm text-center">
                  点击下方按钮<br />获取微信二维码
                </div>
              )}
            </div>
            {wechatError && (
              <div className="text-xs text-red-500 mb-2 text-center">{wechatError}</div>
            )}
            <button
              onClick={handleWechatLogin}
              disabled={wechatQrLoading}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {wechatQrLoading ? '加载中...' : '微信扫码登录'}
            </button>
          </div>

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
                </div>
              )}

              {activeTab === 'password' && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rememberMobile}
                    onChange={(e) => setRememberMobile(e.target.checked)}
                  />
                  记住手机号
                </label>
              )}

              {error && (
                <div className="text-sm text-red-500">{error}</div>
              )}

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
