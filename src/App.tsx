import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ShieldCheck, 
  Filter, 
  ArrowUpDown, 
  Info, 
  RefreshCw,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AnalyzedMatch {
  id: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  date: string;
  probModel: number;
  oddAvg: number;
  bestOdd: number;
  probImplied: number;
  edge: number;
  ev: number;
  confidence: string;
  isTeamYHome: boolean;
}

export default function App() {
  const [matches, setMatches] = useState<AnalyzedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLeague, setFilterLeague] = useState('All');
  const [minEdge, setMinEdge] = useState(0);
  const [sortBy, setSortBy] = useState<'ev' | 'edge' | 'date'>('ev');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/analysis');
      const data = await response.json();
      setMatches(data);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/sync', { method: 'POST' });
      await fetchMatches();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const filteredMatches = matches
    .filter(m => filterLeague === 'All' || m.league === filterLeague)
    .filter(m => m.edge >= minEdge)
    .sort((a, b) => {
      if (sortBy === 'ev') return b.ev - a.ev;
      if (sortBy === 'edge') return b.edge - a.edge;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

  const leagues = ['All', ...new Set(matches.map(m => m.league))];

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">FootyValue <span className="text-emerald-500">AI</span></h1>
          </div>
          
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-all text-sm font-medium border border-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Market Definition Banner */}
        <div className="mb-8 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-4">
          <div className="p-2 bg-emerald-500/10 rounded-xl">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-emerald-400 font-semibold mb-1">Target Combined Market</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              U3.5 Goals (1st Half) + U3.5 Goals (2nd Half) + Team Y Wins a Half + Over 5.5 Corners.
              <br />
              <span className="text-zinc-500 italic">Analyzed via Monte Carlo Simulation (20,000 iterations).</span>
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
              <Filter className="w-3 h-3" /> League
            </label>
            <select 
              value={filterLeague}
              onChange={(e) => setFilterLeague(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            >
              {leagues.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
              <TrendingUp className="w-3 h-3" /> Min Edge (%)
            </label>
            <input 
              type="number"
              value={minEdge * 100}
              onChange={(e) => setMinEdge(Number(e.target.value) / 100)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              placeholder="0.0"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
              <ArrowUpDown className="w-3 h-3" /> Sort By
            </label>
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              {(['ev', 'edge', 'date'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                    sortBy === s ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end">
            <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Total Value Found</span>
              <span className="text-lg font-mono font-bold text-emerald-500">{filteredMatches.length}</span>
            </div>
          </div>
        </div>

        {/* Match List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin" />
            <p className="text-zinc-500 font-medium">Running simulations and fetching odds...</p>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl">
            <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">No value bets found with current filters.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {filteredMatches.map((match) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={match.id}
                  className="group relative bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] transition-all cursor-pointer overflow-hidden"
                >
                  {/* Confidence Badge */}
                  <div className={`absolute top-0 right-0 px-4 py-1 rounded-bl-xl text-[10px] font-black uppercase tracking-widest ${
                    match.confidence === 'High' ? 'bg-emerald-500 text-black' : 'bg-amber-500 text-black'
                  }`}>
                    {match.confidence} Confidence
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    {/* Match Info */}
                    <div className="lg:col-span-4">
                      <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        {match.league} • {new Date(match.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="text-lg font-bold flex items-center gap-2">
                            {match.homeTeam}
                            {match.isTeamYHome && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">TEAM Y</span>}
                          </div>
                          <div className="text-lg font-bold flex items-center gap-2">
                            {match.awayTeam}
                            {!match.isTeamYHome && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">TEAM Y</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="lg:col-span-5 grid grid-cols-3 gap-4 border-l border-white/10 pl-8">
                      <div>
                        <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Model Prob.</div>
                        <div className="text-xl font-mono font-bold text-white">{(match.probModel * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Best Odd</div>
                        <div className="text-xl font-mono font-bold text-emerald-500">{match.bestOdd.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Implied</div>
                        <div className="text-xl font-mono font-bold text-zinc-400">{(match.probImplied * 100).toFixed(1)}%</div>
                      </div>
                    </div>

                    {/* Value Metrics */}
                    <div className="lg:col-span-3 flex items-center justify-end gap-6">
                      <div className="text-right">
                        <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Edge</div>
                        <div className={`text-2xl font-mono font-bold ${match.edge > 0.05 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                          +{(match.edge * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="h-12 w-px bg-white/10" />
                      <div className="text-right">
                        <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">EV</div>
                        <div className={`text-2xl font-mono font-bold ${match.ev > 0.2 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                          {match.ev > 0 ? '+' : ''}{match.ev.toFixed(2)}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-emerald-500 transition-colors ml-2" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="mt-20 border-t border-white/5 py-12 bg-black/40">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center">
                <Info className="w-4 h-4 text-zinc-400" />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-widest">Methodology</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Our model uses Poisson distribution for goal modeling and Monte Carlo simulations (20k runs per match) to estimate the probability of complex combined markets.
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-zinc-400" />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-widest">Risk Warning</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Historical performance does not guarantee future results. Betting involves risk. Use the Edge and EV metrics as statistical indicators, not as financial advice.
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-zinc-400" />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-widest">Data Sources</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Stats provided by football-data.org. Odds aggregated from The Odds API. Data is updated every 6 hours or upon manual refresh.
            </p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-white/5 text-center">
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
            &copy; 2026 FootyValue AI • Professional Football Analytics
          </p>
        </div>
      </footer>
    </div>
  );
}
