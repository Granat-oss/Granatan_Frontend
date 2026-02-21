import { useState, useMemo, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './index.css';

// Transposed Table Component for Weekly View
const WeeklyTransposedTable = ({ data, searchAsin, isParent }) => {
  const grouped = useMemo(() => {
    const groups = {};
    const lowerSearch = (searchAsin || '').toLowerCase();

    data.forEach(row => {
      const keyStr = isParent ? row.ParentASIN : `${row.ASIN} / ${row.SKU}`;
      const parentStr = isParent ? '' : row.Parent;

      if (lowerSearch) {
        if (!keyStr.toLowerCase().includes(lowerSearch) && !(parentStr && parentStr.toLowerCase().includes(lowerSearch))) {
          return;
        }
      }

      if (!groups[keyStr]) groups[keyStr] = [];
      groups[keyStr].push(row);
    });

    Object.values(groups).forEach(arr => {
      arr.sort((a, b) => a.Week.localeCompare(b.Week));
    });

    return groups;
  }, [data, searchAsin, isParent]);

  const metricsStr = ["Total Sales", "Total Units", "Sessions", "Amz Conv %", "PPC Spend", "PPC Sales", "PPC Orders", "PPC Clicks", "PPC vs Total %", "Org Conv %", "TACOS %", "ACOS %"];

  const renderTable = (identifier, rows) => {
    const weeks = [...new Set(rows.map(r => r.Week))].sort();

    return (
      <div key={identifier} className="glass animate-fade-in" style={{ marginBottom: '32px', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Item: <span style={{ color: '#ff8a00' }}>{identifier}</span></h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <th style={{ padding: '14px 24px', width: '200px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '12px' }}>KEY METRICS</th>
                {weeks.map(w => (
                  <th key={w} style={{ padding: '14px 24px', color: '#fff', fontWeight: '600', fontSize: '13px' }}>{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricsStr.map(metric => (
                <tr key={metric} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '12px 24px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500' }}>{metric}</td>
                  {weeks.map(w => {
                    const rowForWeek = rows.find(r => r.Week === w);
                    let val = rowForWeek ? rowForWeek[metric] : '-';
                    const isCurrency = metric.includes('Sales') || metric.includes('Spend');
                    if (val !== '-' && isCurrency && typeof val === 'number') {
                      val = `$${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                    }
                    return <td key={w} style={{ padding: '12px 24px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>{val}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const keys = Object.keys(grouped);
  // Sort keys alphabetically so it's consistent
  keys.sort();

  if (keys.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No matching ASINs found for filter.</div>;
  }

  const toRender = searchAsin ? keys : keys.slice(0, 5);

  return (
    <div>
      {!searchAsin && <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', textAlign: 'center' }}>Showing top 5 items. Use the Search Bar to find a specific ASIN.</p>}
      {toRender.map(k => renderTable(k, grouped[k]))}
    </div>
  );
};


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const [view, setView] = useState('Overview'); // 'Overview', 'Child', 'Parent'
  const [searchAsin, setSearchAsin] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

  // LIVE DATA STATE
  const [monthlyData, setMonthlyData] = useState([]);
  const [childData, setChildData] = useState([]);
  const [parentData, setParentData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('Never');

  const fetchS3Data = async () => {
    setIsLoading(true);
    try {
      const listRes = await fetch('https://granatan-backend.onrender.com/api/reports/list?prefix=archive/');
      const listData = await listRes.json();

      if (listData.success && listData.data.length > 0) {
        const files = listData.data.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

        const latestMonthly = files.find(f => f.key.includes('Monthly_Report'));
        const latestChild = files.find(f => f.key.includes('Computed_Sales_Child'));
        const latestParent = files.find(f => f.key.includes('Computed_Sales_Parent'));

        if (latestMonthly) {
          const res = await fetch(`https://granatan-backend.onrender.com/api/reports/get?key=${encodeURIComponent(latestMonthly.key)}`);
          const data = await res.json();
          if (data.success) setMonthlyData(data.data);
        }
        if (latestChild) {
          const res = await fetch(`https://granatan-backend.onrender.com/api/reports/get?key=${encodeURIComponent(latestChild.key)}`);
          const data = await res.json();
          if (data.success) setChildData(data.data);
        }
        if (latestParent) {
          const res = await fetch(`https://granatan-backend.onrender.com/api/reports/get?key=${encodeURIComponent(latestParent.key)}`);
          const data = await res.json();
          if (data.success) setParentData(data.data);
        }
        setLastUpdate(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to fetch from S3 Bridge:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) { fetchS3Data(); }
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'Granatan2026') {
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
  };

  const parseValue = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = val.toString().replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? val : num;
  };

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  // Filter Monthly Table Data
  const filteredMonthlyData = useMemo(() => {
    let data = [...monthlyData];
    if (searchAsin) {
      const lowerSearch = searchAsin.toLowerCase();
      data = data.filter(item =>
        (item.ASIN && item.ASIN.toLowerCase().includes(lowerSearch)) ||
        (item["Parent ASIN"] && item["Parent ASIN"].toLowerCase().includes(lowerSearch))
      );
    }
    if (sortConfig.key) {
      data.sort((a, b) => {
        const valA = parseValue(a[sortConfig.key]);
        const valB = parseValue(b[sortConfig.key]);
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [searchAsin, monthlyData, sortConfig]);

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 50% -20%, #2a1600, #0a0a0c)'
      }}>
        <div className="glass animate-fade-in" style={{
          padding: '48px', borderRadius: '24px', width: '100%', maxWidth: '420px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,138,0,0.05)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #ff8a00, #ff5e00)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto',
              boxShadow: '0 8px 24px rgba(255, 138, 0, 0.3)'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px' }}>Granatan DS</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>Data Lake Dashboard login</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="input-container">
              <label>Manager ID</label>
              <input type="text" className="input-field" placeholder="Enter your username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="input-container" style={{ marginBottom: '32px' }}>
              <label>Password</label>
              <input type="password" className="input-field" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ borderColor: error ? '#ff3333' : 'var(--border)' }} />
              {error && <span style={{ color: '#ff3333', fontSize: '12px', marginTop: '4px' }}>Incorrect password (try Granatan2026)</span>}
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '15px' }}>
              Secure Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  const getViewTitle = () => {
    if (view === 'Overview') return 'Sales Summary Month';
    if (view === 'Child') return 'Sales Summary Child (Weekly)';
    if (view === 'Parent') return 'Sales Summary Parent (Weekly)';
  };

  return (
    <div className="app-container animate-fade-in">
      {/* SIDEBAR */}
      <nav className="sidebar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #ff8a00, #ff5e00)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            </div>
            <span style={{ fontSize: '18px', fontWeight: '600' }}>Granatan DS</span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '16px', letterSpacing: '0.5px' }}>VIEWS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div onClick={() => setView('Overview')} style={{ background: view === 'Overview' ? 'rgba(255,255,255,0.05)' : 'transparent', padding: '10px 14px', borderRadius: '8px', color: view === 'Overview' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M18 17l-5-5-4 4-5-5" /></svg>
              Sales Summary Month
            </div>
            <div onClick={() => setView('Child')} style={{ background: view === 'Child' ? 'rgba(255,255,255,0.05)' : 'transparent', padding: '10px 14px', borderRadius: '8px', color: view === 'Child' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
              Sales Summary Child
            </div>
            <div onClick={() => setView('Parent')} style={{ background: view === 'Parent' ? 'rgba(255,255,255,0.05)' : 'transparent', padding: '10px 14px', borderRadius: '8px', color: view === 'Parent' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              Sales Summary Parent
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ff8a00', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>O</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13px', fontWeight: '600' }}>{username || 'Manager'}</p>
            <p style={{ cursor: 'pointer', color: '#ff8a00', fontSize: '11px', marginTop: '2px' }} onClick={handleLogout}>Sign Out</p>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '32px', letterSpacing: '-1px', marginBottom: '8px' }}>
              {getViewTitle()}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
              Synchronized from AWS S3 Lake • Last update: {lastUpdate}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Search ASIN or Parent..."
                value={searchAsin}
                onChange={(e) => setSearchAsin(e.target.value)}
                style={{ width: '220px', paddingLeft: '34px' }}
              />
              <svg style={{ position: 'absolute', left: '10px', top: '10px', opacity: 0.5 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </div>

            <button className="btn-primary" onClick={fetchS3Data} disabled={isLoading}>
              {isLoading ? 'Syncing...' : 'Refresh S3'}
            </button>
          </div>
        </header>

        {view === 'Overview' && (
          <div className="animate-fade-in">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
              <div className="glass" style={{ padding: '24px', borderRadius: '16px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>Total Sales (Filtered)</p>
                <h2 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.5px' }}>
                  ${filteredMonthlyData.reduce((sum, item) => sum + parseFloat(item['Total Sales']), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h2>
              </div>
              <div className="glass" style={{ padding: '24px', borderRadius: '16px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>PPC Spend (Filtered)</p>
                <h2 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.5px' }}>
                  ${filteredMonthlyData.reduce((sum, item) => sum + parseFloat(item['PPC Spend']), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h2>
              </div>
              <div className="glass" style={{ padding: '24px', borderRadius: '16px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>Total Units (Filtered)</p>
                <h2 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.5px' }}>
                  {filteredMonthlyData.reduce((sum, item) => sum + parseFloat(item['Total Units']), 0).toLocaleString()}
                </h2>
              </div>
            </div>

            <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', overflowX: 'auto', marginBottom: '40px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1200px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {["Month", "ASIN", "Parent ASIN", "Total Sales", "Total Units", "Sessions", "Amz Conv %", "PPC Spend", "PPC Sales", "PPC Orders", "PPC Clicks", "PPC vs Total %", "Org Conv %", "TACOS %", "ACOS %"].map(header => (
                      <th
                        key={header}
                        onClick={() => handleSort(header)}
                        style={{ padding: '16px 12px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '11px', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
                      >
                        {header}
                        {sortConfig.key === header && (
                          <span style={{ marginLeft: '4px', color: '#ff8a00' }}>
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMonthlyData.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {["Month", "ASIN", "Parent ASIN", "Total Sales", "Total Units", "Sessions", "Amz Conv %", "PPC Spend", "PPC Sales", "PPC Orders", "PPC Clicks", "PPC vs Total %", "Org Conv %", "TACOS %", "ACOS %"].map(col => (
                        <td key={col} style={{ padding: '14px 12px', fontSize: '13px', color: col === 'ASIN' ? '#fff' : 'var(--text-primary)', fontWeight: col === 'ASIN' ? '600' : '400', whiteSpace: 'nowrap' }}>
                          {col.includes('Sales') || col.includes('Spend') ? `$${parseFloat(row[col]).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {isLoading && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#ff8a00' }}>📥 Securely fetching data from AWS S3...</div>
              )}
              {!isLoading && filteredMonthlyData.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No data available. Click Refresh S3.</div>
              )}
            </div>
          </div>
        )}

        {view === 'Child' && (
          <WeeklyTransposedTable data={childData} searchAsin={searchAsin} isParent={false} />
        )}

        {view === 'Parent' && (
          <WeeklyTransposedTable data={parentData} searchAsin={searchAsin} isParent={true} />
        )}

      </main>
    </div>
  );
}

export default App;
