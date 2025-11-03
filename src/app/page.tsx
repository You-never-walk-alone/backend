"use client";

import TopNavBar from "@/components/TopNavBar";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Users,
  Sparkles,
  Target,
  Coins,
  BarChart3,
  ArrowRight,
  Eye,
  Plus,
  User,
  Zap,
  Shield,
  Globe,
  Award,
} from "lucide-react";
import Link from "next/link";

function BetDemo() {
  const [side, setSide] = useState<'YES'|'NO'>('YES');
  const [prob, setProb] = useState(0.62);
  const [amount, setAmount] = useState(100);
  const priceYes = prob;
  const priceNo = 1 - prob;
  const price = side === 'YES' ? priceYes : priceNo;
  const shares = amount > 0 && price > 0 ? amount / price : 0;
  const payoutIfWin = shares; // pays 1 per share
  const profitIfWin = payoutIfWin - amount;
  const format = (n:number) => n.toFixed(2);
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">下注演示</h3>
          <div className="text-sm text-gray-500">CPMM 简化演示</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="col-span-1">
            <div className="text-sm text-gray-600 mb-2">选择方向</div>
            <div className="flex gap-3">
              <button onClick={() => setSide('YES')} className={`px-4 py-2 rounded-xl font-semibold shadow ${side==='YES' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>YES</button>
              <button onClick={() => setSide('NO')} className={`px-4 py-2 rounded-xl font-semibold shadow ${side==='NO' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>NO</button>
            </div>
          </div>
          <div className="col-span-1">
            <div className="text-sm text-gray-600 mb-2">事件概率（价格）</div>
            <div className="flex items-center gap-3">
              <input type="range" min={1} max={99} value={Math.round(prob*100)} onChange={e=>setProb(Number(e.target.value)/100)} className="w-full" />
              <div className="text-gray-700 w-16 text-right">{Math.round(prob*100)}%</div>
            </div>
            <div className="text-xs text-gray-500 mt-1">YES 价格≈{format(priceYes)}，NO 价格≈{format(priceNo)}</div>
          </div>
          <div className="col-span-1">
            <div className="text-sm text-gray-600 mb-2">下注金额（ETH）</div>
            <input type="number" min={0} step={0.01} value={amount} onChange={e=>setAmount(Number(e.target.value))} className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white/90" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/70 rounded-2xl p-3 border border-white/20">
            <div className="text-sm text-gray-600">购买份额</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">{format(shares)} 份</div>
          </div>
          <div className="bg-white/70 rounded-2xl p-3 border border-white/20">
            <div className="text-sm text-gray-600">若胜收益</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">+{format(Math.max(0, profitIfWin))} ETH</div>
          </div>
          <div className="bg-white/70 rounded-2xl p-3 border border-white/20">
            <div className="text-sm text-gray-600">当前价格</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">{format(price)} </div>
          </div>
        </div>
        <div className="mt-6 flex justify-center">
          <button className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl">模拟下单</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const featuresRef = useRef<HTMLElement | null>(null);
  const [canvasHeight, setCanvasHeight] = useState<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type Shape = 'circle' | 'square' | 'triangle' | 'diamond' | 'ring' | 'pentagon' | 'hexagon' | 'octagon';
    const COLORS = [
      'rgba(255, 140, 180, 0.48)', // rose pink
      'rgba(179, 136, 255, 0.45)', // lilac purple
      'rgba(100, 200, 255, 0.42)', // sky blue
      'rgba(120, 230, 190, 0.44)', // mint green
      'rgba(255, 190, 120, 0.40)', // peach orange
    ];

    const LINK_DISTANCE = 90; // 粒子间连线的最大距离
    const CELL_SIZE = 24; // 空间哈希的网格大小（用于加速碰撞检测）

    class Particle {
      x: number;
      y: number;
      baseSize: number;
      size: number; // 动态尺寸（带脉动）
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
      shape: Shape;
      color: string;
      radius: number; // 碰撞半径（按形状外接圆估算）
      pulsePhase: number; // 脉动相位
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        // 统一基础尺寸，去除过小粒子
        this.baseSize = 6.6;
        this.size = this.baseSize;
        // 轻微飘动
        this.speedX = Math.random() * 0.6 - 0.3;
        this.speedY = Math.random() * 0.6 - 0.3;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() * 0.01) - 0.005;
        // 减少三角形频率，增加对称多边形（五/六/八边形）
        const shapesPool: Shape[] = ['circle','square','diamond','ring','pentagon','hexagon','octagon','circle','square','diamond','ring','pentagon','hexagon','circle','square','diamond','triangle'];
        this.shape = shapesPool[Math.floor(Math.random() * shapesPool.length)];
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.pulsePhase = Math.random() * Math.PI * 2;
        // 估算不同形状的外接圆半径，作为碰撞半径
        switch (this.shape) {
          case 'circle':
            this.radius = this.baseSize;
            break;
          case 'square': { // s = baseSize * 1.6，半径约 s * sqrt(2)/2
            const s = this.baseSize * 1.6;
            this.radius = (s * Math.SQRT2) / 2;
            break;
          }
          case 'triangle': { // s = baseSize * 2，半径近似 s/2
            const s = this.baseSize * 2;
            this.radius = s / 2;
            break;
          }
          case 'diamond': { // s = baseSize * 2，半径近似 s/2
            const s = this.baseSize * 2;
            this.radius = s / 2;
            break;
          }
          case 'ring':
            this.radius = this.baseSize * 1.4;
            break;
          case 'pentagon':
          case 'hexagon':
          case 'octagon':
            this.radius = this.baseSize * 1.8;
            break;
        }
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        // 轻微脉动但保持一致性（±3%）
        this.size = this.baseSize * (1 + 0.03 * Math.sin(this.pulsePhase));
        this.pulsePhase += 0.015;
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
      }
      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8; // 略强的光晕
        switch (this.shape) {
          case 'circle': {
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'square': {
            const s = this.size * 1.6;
            ctx.fillRect(-s / 2, -s / 2, s, s);
            break;
          }
          case 'triangle': {
            const s = this.size * 2;
            ctx.beginPath();
            ctx.moveTo(0, -s / 2);
            ctx.lineTo(s / 2, s / 2);
            ctx.lineTo(-s / 2, s / 2);
            ctx.closePath();
            ctx.fill();
            break;
          }
          case 'diamond': {
            const s = this.size * 2;
            ctx.beginPath();
            ctx.moveTo(0, -s / 2);
            ctx.lineTo(s / 2, 0);
            ctx.lineTo(0, s / 2);
            ctx.lineTo(-s / 2, 0);
            ctx.closePath();
            ctx.fill();
            break;
          }
          case 'ring': {
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 1.4, 0, Math.PI * 2);
            ctx.stroke();
            break;
          }
          case 'pentagon': {
            const r = this.size * 1.8;
            ctx.beginPath();
            for (let k = 0; k < 5; k++) {
              const ang = (Math.PI * 2 * k) / 5 - Math.PI / 2;
              const px = Math.cos(ang) * r;
              const py = Math.sin(ang) * r;
              if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;
          }
          case 'hexagon': {
            const r = this.size * 1.8;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
              const ang = (Math.PI * 2 * k) / 6 - Math.PI / 2;
              const px = Math.cos(ang) * r;
              const py = Math.sin(ang) * r;
              if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;
          }
          case 'octagon': {
            const r = this.size * 1.8;
            ctx.beginPath();
            for (let k = 0; k < 8; k++) {
              const ang = (Math.PI * 2 * k) / 8 - Math.PI / 2;
              const px = Math.cos(ang) * r;
              const py = Math.sin(ang) * r;
              if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
              }
            ctx.closePath();
            ctx.fill();
            break;
          }
        }
        ctx.restore();
      }
    }

    let particles: Particle[] = [];
    let animId = 0;
    // 鼠标交互：靠近时粒子加速散开
    let mouseX = 0, mouseY = 0, mouseActive = false;
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      mouseActive = true;
    };
    const onMouseLeave = () => { mouseActive = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);

    const resize = () => {
      const overlapPx = 48; // 与核心功能上边界轻微重叠
      const featuresTop = featuresRef.current ? (featuresRef.current as HTMLElement).offsetTop : Math.floor(window.innerHeight * 0.75);
      canvas.width = window.innerWidth;
      canvas.height = Math.max(300, featuresTop + overlapPx);
      setCanvasHeight(canvas.height);
      // 同步展示尺寸，避免 CSS 拉伸至整屏
      canvas.style.height = `${canvas.height}px`;
    };
    window.addEventListener("resize", resize);
    resize();

    // 粒子数量更少：基础 60，随面积缩放
    const baseCount = 60;
    const scaleFactor = Math.min(2, (canvas.width * canvas.height) / (1280 * 720));
    const particleCount = Math.floor(baseCount * scaleFactor);
    for (let i = 0; i < particleCount; i++) particles.push(new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 更新位置与尺寸
      particles.forEach((p) => p.update());

      // 鼠标靠近加速散开（径向推力）
      if (mouseActive) {
        const influenceR = 150; // 影响半径
        const forceBase = 0.12; // 基础加速度
        const maxSpeed = 1.4;   // 限制最大速度，避免失控
        for (const p of particles) {
          const dx = p.x - mouseX;
          const dy = p.y - mouseY;
          const dist = Math.hypot(dx, dy);
          if (dist > 0 && dist < influenceR) {
            const strength = 1 - (dist / influenceR);
            const accel = forceBase * strength;
            const nx = dx / dist;
            const ny = dy / dist;
            p.speedX += nx * accel;
            p.speedY += ny * accel;
            // 速度限制
            const v = Math.hypot(p.speedX, p.speedY);
            if (v > maxSpeed) {
              p.speedX = (p.speedX / v) * maxSpeed;
              p.speedY = (p.speedY / v) * maxSpeed;
            }
          }
        }
      }

      // 构建空间哈希网格
      const grid = new Map<string, number[]>();
      const keyOf = (x: number, y: number) => `${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`;
      particles.forEach((p, i) => {
        const key = keyOf(p.x, p.y);
        const cell = grid.get(key);
        if (cell) cell.push(i); else grid.set(key, [i]);
      });

      // 计算碰撞与连线（只检查邻近 3x3 单元格）
      const neighborsOffsets = [-1, 0, 1];
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const cx = Math.floor(p.x / CELL_SIZE);
        const cy = Math.floor(p.y / CELL_SIZE);
        for (const ox of neighborsOffsets) {
          for (const oy of neighborsOffsets) {
            const key = `${cx + ox},${cy + oy}`;
            const bucket = grid.get(key);
            if (!bucket) continue;
            for (const j of bucket) {
              if (j <= i) continue; // 避免重复处理对
              const q = particles[j];
              const dx = q.x - p.x;
              const dy = q.y - p.y;
              const dist = Math.hypot(dx, dy);
              // 连线：距离足够近绘制细线，透明度随距离衰减
              if (dist < LINK_DISTANCE) {
                const alpha = Math.max(0.05, (LINK_DISTANCE - dist) / LINK_DISTANCE * 0.40);
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = '#c4b5fd'; // 更柔和的薰衣草紫
                ctx.lineWidth = 0.7;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(q.x, q.y);
                ctx.stroke();
                ctx.restore();
              }
              // 碰撞：近似为圆形外接碰撞
              const rSum = p.radius + q.radius;
              if (dist > 0 && dist < rSum) {
                // 位置分离（各移一半，避免穿透）
                const overlap = rSum - dist;
                const nx = dx / dist;
                const ny = dy / dist;
                const sep = overlap * 0.5;
                p.x -= nx * sep;
                p.y -= ny * sep;
                q.x += nx * sep;
                q.y += ny * sep;

                // 简化的弹性反应：交换法线方向速度分量（等质量）
                const pNorm = p.speedX * nx + p.speedY * ny;
                const qNorm = q.speedX * nx + q.speedY * ny;
                const diff = qNorm - pNorm;
                p.speedX += diff * nx;
                p.speedY += diff * ny;
                q.speedX -= diff * nx;
                q.speedY -= diff * ny;

                // 轻微阻尼，避免颤动
                p.speedX *= 0.98; p.speedY *= 0.98;
                q.speedX *= 0.98; q.speedY *= 0.98;
              }
            }
          }
        }
      }

      // 绘制所有粒子（带光晕）
      particles.forEach((p) => p.draw());

      // 底部渐隐遮罩，增强与核心功能区域的衔接美观
      const fadeHeight = Math.min(160, canvas.height * 0.25);
      const grad = ctx.createLinearGradient(0, canvas.height - fadeHeight, 0, canvas.height);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  const features = [
    {
      title: "事件预测市场",
      desc: "创建事件，交易 Yes/No 份额，价格反映概率",
      icon: Target,
      color: "from-purple-400 to-indigo-400",
    },
    {
      title: "自动做市商",
      desc: "基于 CPMM 提供流动性，随时买卖无需撮合",
      icon: Zap,
      color: "from-blue-400 to-cyan-400",
    },
    {
      title: "代币化头寸",
      desc: "持仓可转让、合成或抵押，用途更灵活",
      icon: Coins,
      color: "from-green-400 to-emerald-400",
    },
    {
      title: "结算与预言机",
      desc: "采用可信预言机与治理流程进行结果结算",
      icon: Shield,
      color: "from-orange-400 to-amber-400",
    },
  ];

  const stats = [
    { label: "活跃用户", value: "10K+", icon: Users },
    { label: "预测事件", value: "500+", icon: BarChart3 },
    { label: "总交易量", value: "1M ETH", icon: TrendingUp },
    { label: "准确率", value: "85%", icon: Award },
  ];

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-pink-50 overflow-hidden text-black">
      <canvas
        ref={canvasRef}
        className="absolute left-0 right-0 top-0 pointer-events-none opacity-60"
        style={canvasHeight ? { height: `${canvasHeight}px` } : undefined}
      />

      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full blur-3xl"></div>
      </div>

      <TopNavBar />

      {/* Hero Section */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-10 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 relative z-20"
          >
            <motion.div
              className="relative inline-flex items-center justify-center mb-6 z-30"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <img
                src="/images/logo.png"
                alt="Foresight Logo"
                className="w-20 h-20 drop-shadow-xl relative z-30"
              />
            </motion.div>
            <motion.h1 
              className="text-5xl sm:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-6 relative z-30 leading-tight"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{ position: 'relative', zIndex: 30, lineHeight: '1.1' }}
            >
              Foresight
            </motion.h1>
            <p className="text-xl sm:text-2xl lg:text-3xl text-gray-600 max-w-4xl mx-auto mb-4 relative z-20">
              Your insight, the world's foresight.
            </p>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8 relative z-20">
              让预测更透明，让决策更聪明。基于区块链的去中心化预测市场平台
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 mb-6"
          >
            <BetDemo />
          </motion.div>

        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="relative z-10 py-12 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-white/70 ring-1 ring-black/10 text-purple-700 mb-4">
              <Sparkles className="w-4 h-4 mr-1" />
              功能概览
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
              核心功能
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              基于区块链技术的去中心化预测市场，为您提供透明、公正的预测交易体验
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group bg-white/85 backdrop-blur-xl rounded-3xl ring-1 ring-black/5 p-6 text-left hover:ring-black/10 hover:bg-white/95 transition-all duration-300"
              >
                {/* 顶部徽章与标题 */}
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/70 ring-1 ring-black/10 text-purple-700">
                    <feature.icon className="w-4 h-4 mr-1" />
                    {feature.title}
                  </div>
                  <button className="hidden lg:inline-flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm shadow hover:shadow-md">
                    了解更多
                  </button>
                </div>

                <h3 className="text-2xl font-bold text-gray-800 mb-2">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.desc}</p>

                {/* 内置小部件：根据不同功能展示差异化内容，参考 Uniswap 的丰富卡片 */}
                {index === 0 && (
                  <div className="rounded-2xl ring-1 ring-black/5 bg-white/80 p-4">
                    <div className="text-sm text-gray-500 mb-2">热门事件（示例）</div>
                    <div className="space-y-3">
                      {[
                        { name: '以太坊是否突破 $4,000', prob: 0.62, delta: +1.2 },
                        { name: '比特币减半影响积极', prob: 0.58, delta: +0.69 },
                        { name: 'AI 重大突破发生', prob: 0.31, delta: -0.24 },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                          <div className="truncate text-gray-800">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-700">{Math.round(item.prob * 100)}%</span>
                            <span className={item.delta >= 0 ? 'text-emerald-600 text-sm' : 'text-rose-600 text-sm'}>
                              {item.delta >= 0 ? `+${item.delta}%` : `${item.delta}%`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-white ring-1 ring-black/10 hover:bg-gray-50">
                        浏览全部事件
                      </button>
                    </div>
                  </div>
                )}

                {index === 1 && (
                  <div className="rounded-2xl ring-1 ring-black/5 bg-white/80 p-4">
                    <div className="text-sm text-gray-500 mb-2">CPMM 池状态（示例）</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-white/70 p-3">
                        <div className="text-xs text-gray-500">价格</div>
                        <div className="text-lg font-semibold text-gray-800">0.62</div>
                      </div>
                      <div className="rounded-xl bg-white/70 p-3">
                        <div className="text-xs text-gray-500">流动性</div>
                        <div className="text-lg font-semibold text-gray-800">12.5k</div>
                      </div>
                      <div className="rounded-xl bg-white/70 p-3">
                        <div className="text-xs text-gray-500">不变量 k</div>
                        <div className="text-lg font-semibold text-gray-800">3.1e6</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="h-2 rounded-full bg-gray-200">
                        <div className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: '62%' }}></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>NO</span><span>YES</span>
                      </div>
                    </div>
                  </div>
                )}

                {index === 2 && (
                  <div className="rounded-2xl ring-1 ring-black/5 bg-white/80 p-4">
                    <div className="text-sm text-gray-500 mb-2">持仓代币（示例）</div>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm">YES 120</span>
                      <span className="px-3 py-1.5 rounded-full bg-white ring-1 ring-black/10 text-gray-700 text-sm">NO 80</span>
                      <span className="px-3 py-1.5 rounded-full bg-white ring-1 ring-black/10 text-gray-700 text-sm">LP 45</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <button className="rounded-xl bg-white/70 px-3 py-2 text-sm text-gray-700">转让</button>
                      <button className="rounded-xl bg-white/70 px-3 py-2 text-sm text-gray-700">合成</button>
                      <button className="rounded-xl bg-white/70 px-3 py-2 text-sm text-gray-700">抵押</button>
                    </div>
                  </div>
                )}

                {index === 3 && (
                  <div className="rounded-2xl ring-1 ring-black/5 bg-white/80 p-4">
                    <div className="text-sm text-gray-500 mb-2">预言机与结算流程（示例）</div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2">
                        <Shield className="w-4 h-4 text-purple-600" />
                        <span className="text-gray-800 text-sm">Chainlink 数据馈送</span>
                        <span className="ml-auto text-emerald-600 text-xs">已接入</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2">
                        <Users className="w-4 h-4 text-pink-600" />
                        <span className="text-gray-800 text-sm">治理投票确认</span>
                        <span className="ml-auto text-amber-600 text-xs">进行中</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2">
                        <Award className="w-4 h-4 text-indigo-600" />
                        <span className="text-gray-800 text-sm">最终结算</span>
                        <span className="ml-auto text-gray-600 text-xs">T+1</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 底部 CTA（移动端展示） */}
                <div className="mt-4 lg:hidden">
                  <button className="inline-flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm shadow">
                    了解更多
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      

      {/* Footer */}
      <footer className="relative z-10 bg-white/80 backdrop-blur-sm border-t border-gray-200/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <img
                src="/images/logo.png"
                alt="Foresight Logo"
                className="w-10 h-10 drop-shadow-sm mr-3"
              />
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Foresight
              </span>
            </div>
            <p className="text-gray-600 mb-4">
              © 2025 Foresight 预测市场 | 用交易表达信念，价格反映概率
            </p>
            <div className="flex items-center justify-center text-sm text-gray-500">
              <Target className="w-4 h-4 mr-2" />
              让预测更透明，让决策更聪明
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
