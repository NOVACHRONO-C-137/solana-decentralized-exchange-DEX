'use client';

import {
    Copy,
    Info,
    ExternalLink,
    Dot,
    MessageCircle,
    ArrowUpRight,
} from 'lucide-react';
import { useState } from 'react';

export default function AeroDEXDashboard() {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const pools = [
        {
            id: 'PLTR/LHMN',
            tokens: ['PLTR', 'LHMN'],
            fee: '0.25%',
            type: 'CLMM',
            typeColor: 'violet',
            poolId: 'ALmSuJP4xKZKBVSCL1RK7xYLQW7UtHPaWZzWRnD7r3u4',
        },
        {
            id: 'SOL/LHMN',
            tokens: ['SOL', 'LHMN'],
            fee: '0.05%',
            type: 'Standard',
            typeColor: 'blue',
            poolId: 'BLmSuJP4xKZKBVSCL1RK7xYLQW7UtHPaWZzWRnD7r3u5',
        },
        {
            id: 'RGR/SOL',
            tokens: ['RGR', 'SOL'],
            fee: '0.25%',
            type: 'Legacy',
            typeColor: 'orange',
            poolId: 'CLmSuJP4xKZKBVSCL1RK7xYLQW7UtHPaWZzWRnD7r3u6',
        },
    ];

    const holdings = [
        { symbol: 'SOL', name: 'Solana', balance: 12.4532, usd: 1854.8, color: '#14F195' },
        { symbol: 'LHMN', name: 'Lumen', balance: 4200.5, usd: 8401.0, color: '#8B5CF6' },
        { symbol: 'RGR', name: 'Ranger', balance: 2150.0, usd: 3870.12, color: '#3B82F6' },
    ];

    const rewards = [
        { token: 'LHMN', rate: '2.4', pool: 'LHMN-SOL Farm' },
        { token: 'RGR', rate: '1.8', pool: 'RGR-PLTR Farm' },
    ];

    return (
        <div className="min-h-screen bg-[#0d0e14] p-4 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
                {/* LEFT COLUMN */}
                <div className="space-y-6">
                    {/* Card 1: Wallet Overview */}
                    <div className="border border-white/8 rounded-2xl p-5 bg-[#161722]">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">
                                Wallet
                            </h3>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-xs font-semibold px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                                    Devnet
                                </span>
                            </div>
                        </div>

                        <div className="mb-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#14F195] to-cyan-400 flex items-center justify-center text-xs font-bold text-black">
                                    ◎
                                </div>
                                <span className="text-3xl font-bold text-white">12.4532</span>
                                <span className="text-lg font-semibold text-white/60">SOL</span>
                            </div>
                        </div>

                        <div className="mb-4 pb-4 border-b border-white/5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-xs text-white/50 font-mono">9qsg...erjq</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handleCopy}
                                        className="p-1 hover:bg-white/10 rounded transition-all duration-200"
                                    >
                                        <Copy className="w-3.5 h-3.5 text-white/60 hover:text-white" />
                                    </button>
                                    <a href="#" className="text-[#14F195] text-xs hover:underline flex items-center gap-0.5">
                                        View on Solscan <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Dot className="w-2 h-2 text-yellow-500 fill-current" />
                            <span className="text-xs text-white/60">Network: Devnet</span>
                        </div>
                    </div>

                    {/* Card 2: Portfolio Value */}
                    <div className="border border-white/8 rounded-2xl p-5 bg-[#161722]">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">
                                Portfolio Value
                            </h3>
                            <Info className="w-4 h-4 text-white/40" />
                        </div>

                        <div className="mb-6 text-center">
                            <div className="text-4xl font-bold text-white mb-1" style={{ textShadow: '0 0 20px rgba(20, 241, 149, 0.4)' }}>
                                $14,520.00
                            </div>
                            <span className="text-xs text-white/50">Estimated · Devnet prices</span>
                        </div>

                        <div className="space-y-3">
                            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden flex">
                                <div className="w-[45%] bg-[#14F195]" />
                                <div className="w-[30%] bg-blue-500" />
                                <div className="w-[15%] bg-purple-500" />
                                <div className="w-[10%] bg-orange-500" />
                            </div>

                            <div className="flex flex-wrap gap-3 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#14F195]" />
                                    <span className="text-white/60">SOL 45%</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="text-white/60">LHMN 30%</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                                    <span className="text-white/60">RGR 15%</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                                    <span className="text-white/60">Other 10%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Token Holdings */}
                    <div className="border border-white/8 rounded-2xl p-5 bg-[#161722]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">
                                Token Holdings
                            </h3>
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#14F195]/20 text-[#14F195]">
                                {holdings.length}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {holdings.map((token, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                                            style={{ background: `${token.color}40` }}
                                        >
                                            {token.symbol[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-white">{token.symbol}</div>
                                            <div className="text-xs text-white/50">{token.name}</div>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-sm font-bold text-white">{token.balance}</div>
                                        <div className="text-xs text-[#14F195]">${token.usd.toFixed(2)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="text-xs text-white/30 mt-4 pt-4 border-t border-white/5">
                            Prices from Raydium API
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="md:col-span-2 space-y-6">
                    {/* Card 4: My Pools */}
                    <div className="border border-white/8 rounded-2xl p-5 bg-[#161722]">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">
                                My Pools
                            </h3>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#14F195]/20 text-[#14F195]">
                                {pools.length}
                            </span>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex gap-2 mb-5 pb-5 border-b border-white/5 flex-wrap">
                            {['All', 'CLMM', 'Standard', 'Legacy'].map((tab) => (
                                <button
                                    key={tab}
                                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200 ${tab === 'All'
                                            ? 'bg-[#14F195]/20 text-[#14F195]'
                                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Pool Rows */}
                        <div className="space-y-3">
                            {pools.map((pool, idx) => (
                                <div
                                    key={idx}
                                    className="border border-white/5 rounded-xl p-4 bg-white/2 hover:bg-white/3 transition-all duration-200"
                                >
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        {/* Pool Info */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex -space-x-1">
                                                {pool.tokens.map((token, i) => (
                                                    <div
                                                        key={i}
                                                        className="w-6 h-6 rounded-full border border-[#161722] flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                                                        style={{
                                                            background:
                                                                i === 0 ? '#14F19540' : '#8B5CF640',
                                                        }}
                                                    >
                                                        {token[0]}
                                                    </div>
                                                ))}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white">{pool.id}</div>
                                                <div className="text-xs text-white/50 mt-1">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold bg-${pool.typeColor}-500/20 text-${pool.typeColor}-400 mr-2`}>
                                                        {pool.type}
                                                    </span>
                                                    <span className="text-[#14F195] font-semibold">{pool.fee}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Pool ID and Actions */}
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <div className="text-xs text-white/40 font-mono">
                                                {pool.poolId.slice(0, 8)}...
                                            </div>
                                            <button className="p-1 hover:bg-white/10 rounded transition-all duration-200">
                                                <Copy className="w-3.5 h-3.5 text-white/40 hover:text-white" />
                                            </button>
                                        </div>

                                        {/* Buttons */}
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg border border-[#14F195]/50 text-[#14F195] text-xs font-semibold hover:bg-[#14F195]/10 transition-all duration-200">
                                                Deposit
                                            </button>
                                            <button className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-white/60 text-xs font-semibold hover:bg-white/5 transition-all duration-200">
                                                Withdraw
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Empty State (hidden by default) */}
                        {/* <div className="py-8 text-center">
              <MessageCircle className="w-8 h-8 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/60 mb-4">No pools yet</p>
              <button className="px-4 py-2 rounded-lg bg-[#14F195]/20 text-[#14F195] text-sm font-semibold hover:bg-[#14F195]/30 transition-all duration-200">
                Create Pool
              </button>
            </div> */}
                    </div>

                    {/* Card 5: Farm Rewards */}
                    <div className="border border-white/8 rounded-2xl p-5 bg-[#161722]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">
                                Farm Rewards
                            </h3>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/20 text-green-400">
                                Active
                            </span>
                        </div>

                        <div className="space-y-4">
                            {rewards.map((reward, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                                            style={{
                                                background: idx === 0 ? '#8B5CF640' : '#3B82F640',
                                            }}
                                        >
                                            {reward.token[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-white">
                                                {reward.token} Rewards
                                            </div>
                                            <div className="text-xs text-white/50">{reward.pool}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-white">
                                                ~{reward.rate}
                                            </div>
                                            <div className="text-xs text-[#14F195] font-semibold">
                                                {reward.token}/day
                                            </div>
                                        </div>
                                        <button className="px-3 py-1.5 rounded-lg bg-[#14F195]/20 text-[#14F195] text-xs font-semibold hover:bg-[#14F195]/30 transition-all duration-200">
                                            Claim
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="text-xs text-white/30 mt-4 pt-4 border-t border-white/5">
                            Rewards accrue per block
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
