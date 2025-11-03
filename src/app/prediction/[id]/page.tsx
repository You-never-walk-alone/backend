'use client';

import { useState, useEffect, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, ArrowUp } from 'lucide-react';
import { ethers } from 'ethers';
import { useWallet } from '@/contexts/WalletContext'
import { getFollowStatus, toggleFollowPrediction } from '@/lib/follows'
import { supabase } from '@/lib/supabase'
import ChatPanel from '@/components/ChatPanel'
import ForumSection from '@/components/ForumSection'

interface PredictionDetail {
  id: number;
  title: string;
  description: string;
  category: string;
  deadline: string;
  minStake: number;
  criteria: string;
  referenceUrl: string;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  stats: {
    yesAmount: number;
    noAmount: number;
    totalAmount: number;
    participantCount: number;
    yesProbability: number;
    noProbability: number;
    betCount: number;
  };
  timeInfo: {
    createdAgo: string;
    deadlineIn: string;
    isExpired: boolean;
  };
}

export default function PredictionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [prediction, setPrediction] = useState<PredictionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [entered, setEntered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [staking, setStaking] = useState(false);
  const [stakeError, setStakeError] = useState<string | null>(null);
  const [stakeSuccess, setStakeSuccess] = useState<string | null>(null);
  
  // 关注功能相关状态
  const { account, connectWallet } = useWallet();
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPredictionDetail = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/predictions/${params.id}`);
        const contentType = response.headers.get('content-type') || '';
        let result: any = null;
        try {
          if (contentType.includes('application/json')) {
            result = await response.json();
          } else {
            throw new Error(`Unexpected content-type: ${contentType}`);
          }
        } catch (e) {
          console.error('解析响应失败:', e);
          setError('数据解析失败');
          return;
        }
        
        if (result.success) {
          setPrediction(result.data);
        } else {
          setError(result.message || '获取预测事件详情失败');
        }
      } catch (err) {
        setError('网络请求失败');
        console.error('获取预测事件详情失败:', err);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchPredictionDetail();
    }
  }, [params.id]);

  // 将当前查看的事件写入最近浏览（供热门页侧边栏展示）
  useEffect(() => {
    if (!prediction) return;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('recent_events') : null;
      const arr = raw ? JSON.parse(raw) : [];
      const item = { id: prediction.id, title: prediction.title, category: prediction.category, seen_at: new Date().toISOString() };
      const dedup = Array.isArray(arr) ? arr.filter((x: any) => Number(x?.id) !== Number(prediction.id)) : [];
      const next = [item, ...dedup].slice(0, 10);
      window.localStorage.setItem('recent_events', JSON.stringify(next));
    } catch {}
  }, [prediction?.id]);

  useEffect(() => {
    // 设置页面进入动画状态
    setEntered(true);
    
    const onScroll = () => {
      if (typeof window !== 'undefined') {
        setShowScrollTop(window.scrollY > 200);
      }
    };
    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    router.prefetch('/trending');
  }, [router]);

  // 获取关注状态和数量
  useEffect(() => {
    const fetchFollowStatus = async () => {
      if (!params.id) return;
      
      try {
        setFollowError(null);
        // 添加错误处理和重试逻辑
        let retries = 3;
        let status;
        
        while (retries > 0) {
          try {
            status = await getFollowStatus(Number(params.id), account || undefined);
            break;
          } catch (err) {
            console.warn(`获取关注状态尝试失败，剩余重试次数: ${retries-1}`, err);
            retries--;
            if (retries === 0) throw err;
            await new Promise(r => setTimeout(r, 500)); // 重试前等待500ms
          }
        }
        
        if (status) {
          setFollowing(!!status.following);
          setFollowersCount(status.followersCount);
        }
      } catch (error) {
        console.error('获取关注状态失败:', error);
        setFollowError('获取关注状态失败');
        // 设置默认值，避免UI显示错误
        setFollowing(false);
        setFollowersCount(0);
      }
    };

    fetchFollowStatus();
  }, [params.id, account]);

  // Supabase Realtime 订阅：针对当前预测事件的关注插入/删除，实时更新 followersCount 与 following
  useEffect(() => {
    const eid = Number(params.id);
    if (!Number.isFinite(eid)) return;

    const filterEq = `event_id=eq.${eid}`;
    const channel = supabase.channel(`event_follows_detail_${eid}`);

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_follows', filter: filterEq }, (payload: any) => {
        const uid = String((payload?.new || {}).user_id || '');
        // 非当前用户的插入，计数 +1；当前用户则同步 following 状态（避免与本地乐观重复叠加）
        if (!account || uid !== account) {
          setFollowersCount(c => c + 1);
        }
        if (account && uid === account) {
          setFollowing(true);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'event_follows', filter: filterEq }, (payload: any) => {
        const uid = String((payload?.old || {}).user_id || '');
        if (!account || uid !== account) {
          setFollowersCount(c => Math.max(0, c - 1));
        }
        if (account && uid === account) {
          setFollowing(false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id, account]);

  // 处理关注/取消关注
  const handleToggleFollow = async () => {
    if (!account) {
      try {
        await connectWallet();
      } catch (error) {
        setFollowError('钱包连接失败');
      }
      return;
    }

    setFollowLoading(true);
    setFollowError(null);

    try {
      const addr = account.toLowerCase();
      const newFollowing = await toggleFollowPrediction(following, Number(params.id), addr);
      setFollowing(newFollowing);
      
      // 重新获取关注数量
      const status = await getFollowStatus(Number(params.id), addr);
      setFollowersCount(status.followersCount);
    } catch (error) {
      console.error('关注操作失败:', error);
      const msg = error instanceof Error ? (error.message || '操作失败，请重试') : '操作失败，请重试';
      setFollowError(msg);
    } finally {
      setFollowLoading(false);
    }
  };

  // ERC20/合约 ABI（最小化）
  const erc20Abi = [
    'function decimals() view returns (uint8)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 value) returns (bool)'
  ];
  const foresightAbi = [
    'function getPredictionCount() view returns (uint256)',
    'function stake(uint256 _predictionId, uint256 _option, uint256 amount)'
  ];

  // 地址解析（基于 chainId）
  function resolveAddresses(chainId: number): { foresight: string; usdt: string } {
    const env = process.env as Record<string, string | undefined>;
  
    const defaultForesight = (env.NEXT_PUBLIC_FORESIGHT_ADDRESS || '').trim();
    const defaultUsdt = (env.NEXT_PUBLIC_USDT_ADDRESS || '').trim();
  
    const map: Record<number, { foresight?: string; usdt?: string }> = {
      137: {
        foresight: env.NEXT_PUBLIC_FORESIGHT_ADDRESS_POLYGON,
        usdt: env.NEXT_PUBLIC_USDT_ADDRESS_POLYGON,
      },
      80002: {
        foresight: env.NEXT_PUBLIC_FORESIGHT_ADDRESS_AMOY,
        usdt: env.NEXT_PUBLIC_USDT_ADDRESS_AMOY,
      },
      11155111: {
        foresight: env.NEXT_PUBLIC_FORESIGHT_ADDRESS_SEPOLIA,
        usdt: env.NEXT_PUBLIC_USDT_ADDRESS_SEPOLIA,
      },
      31337: {
        foresight: env.NEXT_PUBLIC_FORESIGHT_ADDRESS_LOCALHOST,
        usdt: env.NEXT_PUBLIC_USDT_ADDRESS_LOCALHOST,
      },
    };
  
    const fromMap = map[chainId] || {};
    const foresight = ((fromMap.foresight || defaultForesight) || '').trim();
    const usdt = ((fromMap.usdt || defaultUsdt) || '').trim();
  
    return { foresight, usdt };
  }
  
  // 将任意小数按指定 decimals 转为最小单位 BigInt
  function parseUnitsByDecimals(value: number | string, decimals: number): bigint {
    const str = typeof value === 'number' ? String(value) : value;
    try {
      return ethers.parseUnits(str, decimals);
    } catch {
      // 兜底处理，避免浮点误差
      const parts = str.split('.');
      if (parts.length === 1) {
        return BigInt(parts[0]) * (BigInt(10) ** BigInt(decimals));
      }
      const [intPart, fracRaw] = parts;
      const frac = (fracRaw || '').slice(0, decimals).padEnd(decimals, '0');
      return BigInt(intPart || '0') * (BigInt(10) ** BigInt(decimals)) + BigInt(frac || '0');
    }
  }

  const handleStake = async (option: 'yes' | 'no') => {
    try {
      setStakeError(null);
      setStakeSuccess(null);
      setStaking(true);

      if (!prediction) throw new Error('预测事件未加载');
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('请先连接钱包');
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      const chainIdNum = Number(network.chainId);
      const { foresight, usdt } = resolveAddresses(chainIdNum);
      if (!foresight || !usdt) {
        throw new Error('未配置当前网络的合约或USDT地址');
      }

      const account = await signer.getAddress();
      const token = new ethers.Contract(usdt, erc20Abi, signer);
      let decimals = 6;
      try {
        decimals = await token.decimals();
      } catch {}
      const amount = parseUnitsByDecimals(prediction.minStake, Number(decimals));

      // 先检查并授权
      const allowance: bigint = await token.allowance(account, foresight);
      if (allowance < amount) {
        const txApprove = await token.approve(foresight, amount);
        await txApprove.wait();
      }

      // 确认链上预测是否存在（默认使用 off-chain 的 id 作为链上 id）
      const foresightContract = new ethers.Contract(foresight, foresightAbi, signer);
      const count: bigint = await foresightContract.getPredictionCount();
      if (BigInt(prediction.id) >= count) {
        throw new Error('该事件尚未在链上创建，暂不可押注');
      }

      // 选项映射：yes -> 1, no -> 0
      const optionIndex = option === 'yes' ? 1 : 0;
      const txStake = await foresightContract.stake(prediction.id, optionIndex, amount);
      const receipt = await txStake.wait();

      setStakeSuccess(`押注成功，交易哈希：${receipt?.hash || ''}`);
    } catch (e: any) {
      setStakeError(e?.message || '押注失败');
    } finally {
      setStaking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载预测事件详情中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">加载失败</h2>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">预测事件不存在</h2>
          <p className="text-gray-600">请检查事件ID是否正确</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
        <div className={`max-w-4xl mx-auto transition-all duration-200 ease-out ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
          {/* 返回按钮 */}
          <button
            type="button"
            aria-label="返回上一页"
            title="返回上一页"
            onClick={() => {
              const hasHistory = typeof window !== 'undefined' && window.history && window.history.length > 1;
              const sameOriginReferrer = typeof document !== 'undefined' && document.referrer && (() => {
                try {
                  const ref = new URL(document.referrer);
                  return ref.origin === window.location.origin;
                } catch {
                  return false;
                }
              })();
              startTransition(() => {
                if (hasHistory && sameOriginReferrer) {
                  router.back();
                } else {
                  router.push('/trending');
                }
              });
            }}
            disabled={isPending}
            className="mb-6 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/60 backdrop-blur-md border border-gray-200 text-gray-700 hover:text-gray-800 hover:bg-white/75 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            )}
            <span className="text-sm font-medium">{isPending ? '返回中…' : '返回'}</span>
          </button>


          {/* 预测事件卡片 - 与creating预览保持一致 */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden">
            {/* 卡片头部 - 渐变背景 */}
            <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">
                      {prediction.category === '科技' ? '🚀' : 
                       prediction.category === '娱乐' ? '🎬' :
                       prediction.category === '时政' ? '🏛️' :
                       prediction.category === '天气' ? '🌤️' : '📊'}
                    </span>
                    <span className="text-sm font-medium bg-white/20 px-2 py-1 rounded-full">
                      {prediction.category}
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    prediction.status === 'active' ? 'bg-green-100/20 text-green-100' :
                    prediction.status === 'completed' ? 'bg-blue-100/20 text-blue-100' :
                    'bg-gray-100/20 text-gray-100'
                  }`}>
                    {prediction.status === 'active' ? '进行中' :
                     prediction.status === 'completed' ? '已结束' : '已取消'}
                  </span>
                </div>
                <h1 className="text-2xl font-bold leading-tight">{prediction.title}</h1>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-sm text-white/90">关注数 {followersCount}</span>
                  <button
                    type="button"
                    onClick={handleToggleFollow}
                    disabled={followLoading}
                    className="px-2.5 py-1 rounded-full text-sm font-medium bg-white/20 hover:bg-white/30 text-white disabled:opacity-60"
                  >
                    {followLoading ? '处理中…' : (following ? '已关注' : '关注')}
                  </button>
                  {followError && (
                    <span className="text-xs text-yellow-200">{followError}</span>
                  )}
                </div>
              </div>
            </div>

            {/* 卡片内容 */}
            <div className="p-6">
              {/* 时间信息 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>创建于 {prediction.timeInfo.createdAgo}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <span className={prediction.timeInfo.isExpired ? 'text-red-600' : 'text-orange-600'}>
                    {prediction.timeInfo.deadlineIn}
                  </span>
                </div>
              </div>

              {/* 描述 */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">事件描述</h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{prediction.description}</p>
              </div>

              {/* 判断标准 */}
              <div className="p-4 bg-gray-50 rounded-lg mb-6">
                <div className="flex items-center mb-2">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-600">判断标准</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{prediction.criteria}</p>
              </div>

              {/* 参考链接 */}
              {prediction.referenceUrl && (
                <div className="mb-6">
                  <a 
                    href={prediction.referenceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-purple-600 hover:text-purple-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    参考链接
                  </a>
                </div>
              )}

              {/* 押注统计 */}
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">押注统计</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{prediction.stats.participantCount}</div>
                    <div className="text-sm text-gray-600">参与人数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{prediction.stats.betCount}</div>
                    <div className="text-sm text-gray-600">押注次数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{prediction.stats.totalAmount.toFixed(2)} USDT</div>
                    <div className="text-sm text-gray-600">总押注金额</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{prediction.minStake} USDT</div>
                    <div className="text-sm text-gray-600">最小押注</div>
                  </div>
                </div>

                {/* 概率分布 */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>是 ({prediction.stats.yesProbability * 100}%)</span>
                    <span>否 ({prediction.stats.noProbability * 100}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${prediction.stats.yesProbability * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* 金额分布 */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>是: {prediction.stats.yesAmount.toFixed(2)} USDT</span>
                    <span>否: {prediction.stats.noAmount.toFixed(2)} USDT</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${prediction.stats.totalAmount > 0 ? (prediction.stats.yesAmount / prediction.stats.totalAmount) * 100 : 50}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 押注操作区域 */}
          {prediction.status === 'active' && !prediction.timeInfo.isExpired && (
            <div className="mt-6 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">参与押注</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => handleStake('yes')}
                  disabled={staking}
                  className="flex-1 py-3 px-4 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
                >
                  {staking ? '处理中…' : '支持 (预测达成)'}
                </button>
                <button
                  onClick={() => handleStake('no')}
                  disabled={staking}
                  className="flex-1 py-3 px-4 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                >
                  {staking ? '处理中…' : '反对 (预测不达成)'}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-3">最小押注金额: {prediction.minStake} USDT</p>
              {stakeError && (
                <p className="text-sm text-red-600 mt-2">{stakeError}</p>
              )}
              {stakeSuccess && (
                <p className="text-sm text-green-600 mt-2">{stakeSuccess}</p>
              )}
            </div>
          )}

          {/* 交流与社区 */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChatPanel eventId={Number(params.id)} />
            <ForumSection eventId={Number(params.id)} />
          </div>
        </div>
        {/* 悬浮回到顶部按钮 */}
        <button
          type="button"
          aria-label="回到顶部"
          title="回到顶部"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className={`${showScrollTop ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'} fixed bottom-8 right-8 z-50 w-10 h-10 bg-gradient-to-br from-white/90 to-pink-100/90 rounded-full shadow-lg border border-pink-200/50 backdrop-blur-sm overflow-hidden group hover:scale-110 hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-pink-300`}
        >
          {/* 背景质感效果 */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-pink-100/40 group-hover:from-white/60 group-hover:to-pink-100/60 transition-all duration-300"></div>
          
          {/* 箭头图标 */}
          <div className="relative z-10 flex items-center justify-center w-full h-full">
            <div className="animate-bounce">
              <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </div>
          </div>
          
          {/* 悬浮提示 */}
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            返回顶部
          </div>
        </button>
      </div>
    </div>
  );
}