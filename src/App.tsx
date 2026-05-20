import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Calculator, TrendingDown, DollarSign, AlertTriangle,
  Users, Clock, Minus, X, ExternalLink, BookOpen
} from 'lucide-react';
import { calculateSLScenarios, calculateCostAnalysis, type SLScenario, type CostAnalysis } from './erlang';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%';
const fmtMoney = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K';
  return '$' + fmt(n);
};

const TABS = [
  { id: 'erlang', label: 'Erlang Math', icon: Calculator },
  { id: 'costs', label: 'Hidden Costs', icon: AlertTriangle },
  { id: 'pnl', label: 'P&L Impact', icon: DollarSign },
  { id: 'alternatives', label: 'Real Alternatives', icon: TrendingDown },
] as const;

type TabId = (typeof TABS)[number]['id'];

function InputField({ label, value, onChange, min, max, step, prefix, suffix }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; prefix?: string; suffix?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-slate-400 mb-1 font-medium uppercase tracking-wider font-[IBM_Plex_Sans]">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-cyan-400 font-mono text-sm">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          min={min} max={max} step={step}
          className="w-full bg-[#0f1729] border border-[#1e293b] border-l-4 border-l-cyan-500 rounded-md px-3 py-2 text-slate-100 font-mono text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 outline-none"
        />
        {suffix && <span className="text-slate-500 text-sm">{suffix}</span>}
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtext, color = 'cyan' }: {
  label: string; value: string; subtext?: string; color?: 'cyan' | 'amber' | 'red' | 'green';
}) {
  const colors = {
    cyan: 'border-cyan-500/30 text-cyan-400',
    amber: 'border-amber-500/30 text-amber-400',
    red: 'border-red-500/30 text-red-400',
    green: 'border-green-500/30 text-green-400',
  };
  return (
    <div className={`bg-[#0f1729] border ${colors[color].split(' ')[0]} rounded-lg p-4`}>
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${colors[color].split(' ')[1]}`}>{value}</div>
      {subtext && <div className="text-xs text-slate-500 mt-1">{subtext}</div>}
    </div>
  );
}

function ErlangTab({ scenarios, selectedIdx, onSelect }: {
  scenarios: SLScenario[]; selectedIdx: number; onSelect: (i: number) => void;
}) {
  const chartData = scenarios.map(s => ({
    name: s.label,
    agents: s.requiredAgents,
    diff: s.agentDiff,
  }));

  return (
    <div className="space-y-6">
      <div className="bg-[#111927] border border-[#1e293b] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-1">Staffing by Service Level Target</h3>
        <p className="text-sm text-slate-400 mb-4">
          The Erlang curve is nonlinear — loosening SL yields diminishing returns. Click a row to model its costs.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-[#1e293b]">
                <th className="pb-2 pr-4">Target</th>
                <th className="pb-2 pr-4 text-right">Agents</th>
                <th className="pb-2 pr-4 text-right">Diff</th>
                <th className="pb-2 pr-4 text-right">% Change</th>
                <th className="pb-2 pr-4 text-right">ASA</th>
                <th className="pb-2 text-right">Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s, i) => (
                <tr
                  key={s.label}
                  onClick={() => onSelect(i)}
                  className={`border-b border-[#1e293b] cursor-pointer transition-colors ${i === selectedIdx ? 'bg-cyan-500/10' : 'hover:bg-[#141d30]'}`}
                >
                  <td className="py-3 pr-4 font-mono font-medium text-slate-200">{s.label}</td>
                  <td className="py-3 pr-4 text-right font-mono text-slate-300">{s.requiredAgents}</td>
                  <td className="py-3 pr-4 text-right font-mono">
                    {s.agentDiff === 0 ? (
                      <span className="text-slate-500"><Minus className="w-3 h-3 inline" /></span>
                    ) : (
                      <span className="text-green-400">{s.agentDiff}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono">
                    {s.pctDiff === 0 ? (
                      <span className="text-slate-500">baseline</span>
                    ) : (
                      <span className="text-green-400">{s.pctDiff.toFixed(1)}%</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-amber-400">{s.asa.toFixed(1)}s</td>
                  <td className="py-3 text-right font-mono text-slate-300">{fmtPct(s.occupancy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#111927] border border-[#1e293b] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Agent Reduction by Target</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#141d30', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Bar dataKey="agents" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={i === selectedIdx ? '#22d3ee' : '#334155'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300">
          <strong className="text-amber-400">Key insight:</strong> Larger centers see smaller percentage savings.
          The Erlang curve flattens — a 500-agent center saves only 3.5% going to 80/120, compared to 9.8% for a 50-agent center.
        </div>
      </div>
    </div>
  );
}

function CostCascadeTab({ analysis }: { analysis: CostAnalysis }) {
  const costs = [
    {
      label: 'Occupancy & Burnout',
      icon: Users,
      cost: analysis.hiddenCosts.attritionCost,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/5 border-orange-500/20',
      detail: `Occupancy rises from ${fmtPct(analysis.baselineOccupancy)} to ${fmtPct(analysis.newOccupancy)}. Higher occupancy reduces recovery time, driving emotional exhaustion and turnover.`,
    },
    {
      label: 'Abandonment & Lost Revenue',
      icon: Clock,
      cost: analysis.hiddenCosts.abandonmentCost,
      color: 'text-red-400',
      bgColor: 'bg-red-500/5 border-red-500/20',
      detail: `ASA increases from ${analysis.baselineASA.toFixed(1)}s to ${analysis.newASA.toFixed(1)}s. More callers abandon; ~30% never call back.`,
    },
    {
      label: 'AHT Creep',
      icon: TrendingDown,
      cost: analysis.hiddenCosts.ahtCreepCost,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/5 border-purple-500/20',
      detail: 'Customers who wait longer have higher AHT (5-15%). The increased load can require more agents than you removed.',
    },
    {
      label: 'CLV Erosion',
      icon: DollarSign,
      cost: analysis.hiddenCosts.clvErosionCost,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/5 border-cyan-500/20',
      detail: 'Long waits increase churn probability 10-30%. Even at conservative 20% attribution, the CLV loss is significant.',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-[#111927] border border-[#1e293b] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-1">The Hidden Cost Cascade</h3>
        <p className="text-sm text-slate-400 mb-4">
          Removing {analysis.agentsRemoved} agent{analysis.agentsRemoved !== 1 ? 's' : ''} saves {fmtMoney(analysis.visibleSavings)} — but triggers four cost cascades.
        </p>

        <div className="space-y-3">
          {costs.map(c => (
            <div key={c.label} className={`border rounded-xl p-4 ${c.bgColor}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                  <span className="font-medium text-slate-200">{c.label}</span>
                </div>
                <span className={`font-mono font-bold text-lg ${c.color}`}>-{fmtMoney(c.cost)}</span>
              </div>
              <p className="text-sm text-slate-400">{c.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MetricCard label="Visible Savings" value={`+${fmtMoney(analysis.visibleSavings)}`} color="green" />
        <MetricCard label="Hidden Costs" value={`-${fmtMoney(analysis.hiddenCosts.totalHiddenCost)}`} color="red" />
      </div>
    </div>
  );
}

function PnLTab({ analysis }: { analysis: CostAnalysis }) {
  const isNegative = analysis.netImpact < 0;
  const chartData = [
    { name: 'Savings', value: analysis.visibleSavings, fill: '#10b981' },
    { name: 'Attrition', value: -analysis.hiddenCosts.attritionCost, fill: '#f97316' },
    { name: 'Abandonment', value: -analysis.hiddenCosts.abandonmentCost, fill: '#ef4444' },
    { name: 'AHT Creep', value: -analysis.hiddenCosts.ahtCreepCost, fill: '#a855f7' },
    { name: 'CLV Erosion', value: -analysis.hiddenCosts.clvErosionCost, fill: '#22d3ee' },
  ];

  return (
    <div className="space-y-6">
      <div className={`border rounded-xl p-6 ${isNegative ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
        <div className="text-center">
          <div className="text-sm text-slate-400 uppercase tracking-wider mb-2">Net Annual Impact</div>
          <div className={`text-4xl font-bold font-mono ${isNegative ? 'text-red-400' : 'text-green-400'}`}>
            {isNegative ? '-' : '+'}{fmtMoney(Math.abs(analysis.netImpact))}
          </div>
          <div className={`text-sm mt-2 ${isNegative ? 'text-red-300' : 'text-green-300'}`}>
            {isNegative
              ? 'This trade is NPV-negative. Hidden costs exceed visible savings.'
              : 'This trade is NPV-positive, but verify hidden cost assumptions.'}
          </div>
        </div>
      </div>

      <div className="bg-[#111927] border border-[#1e293b] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">P&L Waterfall</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => fmtMoney(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#141d30', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9' }}
              formatter={(value) => [fmtMoney(Number(value)), '']}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#111927] border border-[#1e293b] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Line Item Detail</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-[#1e293b]">
              <th className="pb-2">Line Item</th>
              <th className="pb-2 text-right">Annual Impact</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#1e293b]">
              <td className="py-2 text-slate-300">Agent cost savings ({analysis.agentsRemoved} agents)</td>
              <td className="py-2 text-right font-mono text-green-400">+{fmtMoney(analysis.visibleSavings)}</td>
            </tr>
            <tr className="border-b border-[#1e293b]">
              <td className="py-2 text-slate-300">Incremental attrition (occupancy-driven)</td>
              <td className="py-2 text-right font-mono text-red-400">-{fmtMoney(analysis.hiddenCosts.attritionCost)}</td>
            </tr>
            <tr className="border-b border-[#1e293b]">
              <td className="py-2 text-slate-300">Abandoned-caller revenue loss</td>
              <td className="py-2 text-right font-mono text-red-400">-{fmtMoney(analysis.hiddenCosts.abandonmentCost)}</td>
            </tr>
            <tr className="border-b border-[#1e293b]">
              <td className="py-2 text-slate-300">AHT creep overtime/staffing</td>
              <td className="py-2 text-right font-mono text-red-400">-{fmtMoney(analysis.hiddenCosts.ahtCreepCost)}</td>
            </tr>
            <tr className="border-b border-[#1e293b]">
              <td className="py-2 text-slate-300">CLV erosion (20% attribution)</td>
              <td className="py-2 text-right font-mono text-red-400">-{fmtMoney(analysis.hiddenCosts.clvErosionCost)}</td>
            </tr>
            <tr className="font-semibold">
              <td className="py-3 text-slate-100">Net Impact</td>
              <td className={`py-3 text-right font-mono text-lg ${isNegative ? 'text-red-400' : 'text-green-400'}`}>
                {isNegative ? '-' : '+'}{fmtMoney(Math.abs(analysis.netImpact))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlternativesTab() {
  const alternatives = [
    {
      approach: 'Shift Catalog Optimization',
      mechanism: 'Better demand matching via split/staggered shifts',
      savings: '3-7% labor',
      sideEffects: 'Improved agent satisfaction',
      sustainable: true,
    },
    {
      approach: 'Real-Time Automation',
      mechanism: 'Recover idle time via platforms like Intradiem',
      savings: '$1,500-$2,500/agent/yr',
      sideEffects: 'Better training, coaching, break compliance',
      sustainable: true,
    },
    {
      approach: 'AI Containment',
      mechanism: 'Deflect 15-30% of contacts to AI',
      savings: '15-30% volume reduction',
      sideEffects: 'Requires investment; harder contacts remain',
      sustainable: true,
    },
    {
      approach: 'Shrinkage Reduction',
      mechanism: 'More productive hours from adherence',
      savings: '2-5% capacity gain',
      sideEffects: 'Requires adherence culture',
      sustainable: true,
    },
    {
      approach: 'Pool Consolidation',
      mechanism: 'Larger pools need fewer surplus agents',
      savings: '5-10% headcount per pool',
      sideEffects: 'Requires cross-training, system access review',
      sustainable: true,
    },
    {
      approach: 'Loosen SL (80/20 to 80/120)',
      mechanism: 'Remove 5-15 agents, tolerate longer waits',
      savings: '3-8% labor',
      sideEffects: 'Occupancy spike, AHT creep, abandonment, attrition, CLV erosion',
      sustainable: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-[#111927] border border-[#1e293b] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-1">How To Actually Reduce Workforce Cost</h3>
        <p className="text-sm text-slate-400 mb-4">
          Five approaches that deliver real savings without the hidden cost cascade.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-[#1e293b]">
                <th className="pb-2 pr-4">Approach</th>
                <th className="pb-2 pr-4">Mechanism</th>
                <th className="pb-2 pr-4">Typical Savings</th>
                <th className="pb-2 pr-4">Side Effects</th>
                <th className="pb-2">Sustainable</th>
              </tr>
            </thead>
            <tbody>
              {alternatives.map((a, i) => (
                <tr key={i} className={`border-b border-[#1e293b] ${!a.sustainable ? 'bg-red-500/5' : ''}`}>
                  <td className="py-3 pr-4 font-medium text-slate-200">{a.approach}</td>
                  <td className="py-3 pr-4 text-slate-400">{a.mechanism}</td>
                  <td className="py-3 pr-4 font-mono text-cyan-400">{a.savings}</td>
                  <td className="py-3 pr-4 text-slate-400">{a.sideEffects}</td>
                  <td className="py-3 text-center">
                    {a.sustainable
                      ? <span className="text-green-400 font-bold">&#10003;</span>
                      : <span className="text-red-400 font-bold">&#10007;</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-cyan-400 mb-3">Schedule Quality Index (SQI)</h3>
        <p className="text-sm text-slate-300 mb-4">
          The single most impactful lever. SQI measures how well your schedule matches demand:
        </p>
        <div className="bg-[#0f1729] rounded-lg p-4 font-mono text-sm text-cyan-300 mb-4">
          SQI = 1 - ( Sum |Staffed_i - Required_i| ) / ( Sum Required_i )
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { range: '0.90-1.00', label: 'Excellent', desc: 'Best-in-class WFM' },
            { range: '0.80-0.90', label: 'Good', desc: 'Competent WFM' },
            { range: '0.70-0.80', label: 'Moderate', desc: 'Traditional fixed shifts' },
            { range: 'Below 0.70', label: 'Poor', desc: 'Rigid, limited flexibility' },
          ].map(s => (
            <div key={s.range} className="bg-[#111927] border border-[#1e293b] rounded-lg p-3 text-center">
              <div className="font-mono text-cyan-400 font-bold">{s.range}</div>
              <div className="text-xs text-slate-300 font-medium mt-1">{s.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#111927] border border-[#1e293b] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-3">Having This Conversation with Your CFO</h3>
        <div className="space-y-3">
          {[
            'Show the Erlang math — savings are nonlinear, not proportional',
            'Present four cost categories that erode the savings',
            'Offer alternative cost-reduction approaches with better ROI',
            'Propose a controlled test if Finance insists on exploring SL changes',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <span className="text-sm text-slate-300">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const WIKI_URL = 'https://wiki.wfmlabs.org/wiki/The_Service_Level_Savings_Fallacy';

function AboutOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#111927] border border-[#1e293b] rounded-xl max-w-xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#111927] border-b border-[#1e293b] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Service Level Savings Fallacy</h2>
            <p className="text-xs text-cyan-400 font-mono uppercase tracking-wider mt-0.5">Interactive Calculator</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 text-sm text-slate-300 leading-relaxed">
          <p>
            This tool models the full economic impact of loosening contact center service level targets.
            It combines Erlang C queueing mathematics with four hidden cost cascades to produce a net P&L
            analysis — revealing why SL relaxation is typically NPV-negative.
          </p>
          <p>
            The widespread assumption is that relaxing SL from 80/20 to 80/120 will deliver proportional
            headcount savings. In reality, Erlang C's nonlinear mathematics yield only 3-8% reductions for
            mid-size centers, while four hidden costs erode the savings:
          </p>
          <ul className="space-y-2 ml-4">
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 mt-1">1.</span>
              <span><strong className="text-slate-100">Occupancy & Burnout</strong> — fewer agents means higher occupancy, less recovery time, and increased attrition</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 mt-1">2.</span>
              <span><strong className="text-slate-100">Abandonment</strong> — longer wait times drive callers to hang up; ~30% never call back</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 mt-1">3.</span>
              <span><strong className="text-slate-100">AHT Creep</strong> — frustrated customers have longer calls, increasing load beyond what was "saved"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 mt-1">4.</span>
              <span><strong className="text-slate-100">CLV Erosion</strong> — poor service experiences increase churn probability 10-30%</span>
            </li>
          </ul>
          <p>
            The tool also presents five legitimate cost-reduction alternatives that deliver sustainable
            savings without the hidden cost cascade: shift optimization, real-time automation, AI containment,
            shrinkage reduction, and pool consolidation.
          </p>

          <div className="border-t border-[#1e293b] pt-4 mt-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">Learn More</p>
            <a
              href={WIKI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/10 transition-colors group"
            >
              <BookOpen className="w-5 h-5 text-cyan-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200 group-hover:text-cyan-300 transition-colors">
                  The Service Level Savings Fallacy
                </div>
                <div className="text-xs text-slate-500">
                  Full article on WFM Labs Wiki — Erlang worked examples, human performance science, P&L modeling
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 flex-shrink-0 transition-colors" />
            </a>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#1e293b] text-xs text-slate-500">
          &copy; 2026 <a href="https://wfmlabs.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">WFM Labs</a>.
          This tool provides estimates for workforce planning purposes.
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<TabId>('erlang');
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState(3); // 80/90 default
  const [aboutOpen, setAboutOpen] = useState(false);

  // Center parameters
  const [callsPerHour, setCallsPerHour] = useState(1300);
  const [aht, setAht] = useState(360);
  const [loadedCost, setLoadedCost] = useState(60000);
  const [revenuePerContact, setRevenuePerContact] = useState(25);
  const [customerBase, setCustomerBase] = useState(2000000);
  const [clv, setClv] = useState(1200);

  const trafficIntensity = (callsPerHour * aht) / 3600;

  const scenarios = useMemo(
    () => calculateSLScenarios(trafficIntensity, aht, 0.80, [20, 30, 60, 90, 120]),
    [trafficIntensity, aht]
  );

  const analysis = useMemo(() => {
    if (selectedScenarioIdx === 0) return null;
    const baseline = scenarios[0];
    const selected = scenarios[selectedScenarioIdx];
    return calculateCostAnalysis(
      baseline.requiredAgents,
      selected.requiredAgents,
      trafficIntensity,
      aht,
      loadedCost,
      callsPerHour,
      revenuePerContact,
      customerBase,
      clv
    );
  }, [scenarios, selectedScenarioIdx, trafficIntensity, aht, loadedCost, callsPerHour, revenuePerContact, customerBase, clv]);

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      {/* Floating Toolbar */}
      <div className="fixed top-3 right-4 z-40 flex items-center gap-2">
        <button
          onClick={() => setAboutOpen(true)}
          className="w-9 h-9 rounded-lg bg-[#0b1120]/90 backdrop-blur-xl border border-[#1e293b] text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 flex items-center justify-center transition-all text-sm font-semibold"
          title="About this tool"
          aria-label="About"
        >
          ?
        </button>
      </div>

      {/* About Overlay */}
      <AboutOverlay open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
            The Service Level Savings Fallacy
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
            Loosening your SL target produces only 3-8% staffing reduction for mid-size centers,
            while hidden costs typically exceed savings — making this trade NPV-negative.
          </p>
          <p className="text-amber-400/70 text-xs mt-2 max-w-2xl mx-auto font-mono uppercase tracking-wider">
            Illustrative only — to model accurately, build occupancy assumptions back into the capacity plan
            with assumptions for increased AHT, absenteeism, attrition and CLV erosion
          </p>
        </div>

        {/* Input Panel */}
        <div className="bg-[#111927] border border-[#1e293b] rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Your Center Parameters</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <InputField label="Calls/Hour" value={callsPerHour} onChange={setCallsPerHour} min={10} step={10} />
            <InputField label="AHT (sec)" value={aht} onChange={setAht} min={30} step={10} />
            <InputField label="Agent Cost/yr" value={loadedCost} onChange={setLoadedCost} min={20000} step={5000} prefix="$" />
            <InputField label="Rev/Contact" value={revenuePerContact} onChange={setRevenuePerContact} min={0} step={5} prefix="$" />
            <InputField label="Customer Base" value={customerBase} onChange={setCustomerBase} min={1000} step={100000} />
            <InputField label="CLV" value={clv} onChange={setClv} min={100} step={100} prefix="$" />
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <span>Traffic Intensity: <strong className="text-cyan-400 font-mono">{trafficIntensity.toFixed(1)} Erlangs</strong></span>
            <span>Baseline (80/20): <strong className="text-slate-300 font-mono">{scenarios[0]?.requiredAgents ?? '—'} agents</strong></span>
          </div>
        </div>

        {/* Metrics */}
        {analysis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard label="Agents Removed" value={`${analysis.agentsRemoved}`} subtext={`${scenarios[selectedScenarioIdx].label} target`} />
            <MetricCard label="Visible Savings" value={fmtMoney(analysis.visibleSavings)} color="green" />
            <MetricCard label="Hidden Costs" value={fmtMoney(analysis.hiddenCosts.totalHiddenCost)} color="red" />
            <MetricCard
              label="Net Impact"
              value={`${analysis.netImpact < 0 ? '-' : '+'}${fmtMoney(Math.abs(analysis.netImpact))}`}
              color={analysis.netImpact < 0 ? 'red' : 'green'}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="bg-[#0f1729] rounded-t-xl border border-b-0 border-[#1e293b] flex overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                tab === t.id
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-[#141d30]'
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mb-8">
          {tab === 'erlang' && (
            <ErlangTab scenarios={scenarios} selectedIdx={selectedScenarioIdx} onSelect={setSelectedScenarioIdx} />
          )}
          {tab === 'costs' && analysis && (
            <CostCascadeTab analysis={analysis} />
          )}
          {tab === 'costs' && !analysis && (
            <div className="bg-[#111927] border border-[#1e293b] rounded-xl p-8 text-center text-slate-400">
              Select a scenario other than baseline (80/20) to see hidden costs.
            </div>
          )}
          {tab === 'pnl' && analysis && <PnLTab analysis={analysis} />}
          {tab === 'pnl' && !analysis && (
            <div className="bg-[#111927] border border-[#1e293b] rounded-xl p-8 text-center text-slate-400">
              Select a scenario other than baseline (80/20) to see P&L impact.
            </div>
          )}
          {tab === 'alternatives' && <AlternativesTab />}
        </div>

        {/* Footer */}
        <footer className="border-t border-[#1e293b] pt-4 pb-8 mt-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              &copy; 2026 <a href="https://wfmlabs.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">WFM Labs</a>
            </div>
            <div className="flex items-center gap-4">
              <a
                href={WIKI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-slate-500 hover:text-cyan-400 transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                Read the full article
              </a>
              <a href="https://wfmlabs.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
                WFM Labs
              </a>
            </div>
          </div>
          <div className="text-center text-[10px] text-slate-600 mt-3 max-w-2xl mx-auto">
            This tool provides estimates for workforce planning purposes. Results should be validated against your organization's specific needs.
          </div>
        </footer>
      </div>
    </div>
  );
}
