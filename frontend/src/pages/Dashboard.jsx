import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "../api";
import toast from "react-hot-toast";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  LayoutDashboard, TrendingUp, TrendingDown, Minus, Brain,
  Bot, MessageSquare, Database, Upload, FileText, FolderOpen,
  Sun, Moon, BarChart2, ClipboardList, Sparkles, LogOut, Send
} from "lucide-react";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Title, Tooltip, Legend, Filler
);

const COLORS = {
  green: "#00e5a0",
  blue: "#0ea5e9",
  purple: "#8b5cf6",
  orange: "#f0a500",
  red: "#f85149",
};

const SECTIONS = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "charts", label: "Charts", Icon: BarChart2 },
  { id: "insights", label: "AI Insights", Icon: Brain },
  { id: "predict", label: "ML Predict", Icon: Bot },
  { id: "chat", label: "NLP Chat", Icon: MessageSquare },
  { id: "data", label: "Raw Data", Icon: Database },
];

const TrendIcon = ({ trend }) => {
  if (trend === "increasing") return <TrendingUp size={15} style={{ color: "#00e5a0" }} />;
  if (trend === "decreasing") return <TrendingDown size={15} style={{ color: "#f85149" }} />;
  return <Minus size={15} style={{ color: "#f0a500" }} />;
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [section, setSection] = useState("overview");
  const [dataInfo, setDataInfo] = useState(null);
  const [kpis, setKpis] = useState([]);
  const [charts, setCharts] = useState([]);
  const [insights, setInsights] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [numericCols, setNumericCols] = useState([]);
  const [predictCol, setPredictCol] = useState("");
  const [predictSteps, setPredictSteps] = useState(5);
  const [chatMessages, setChatMessages] = useState([
    { role: "bot", text: "Hi! I'm your AI data assistant. Upload a CSV and ask me anything about your data.", time: new Date().toLocaleTimeString() }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const fileRef = useRef(null);
  const dashboardRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [infoRes, kpiRes, chartRes] = await Promise.all([
        api.get("/api/data"),
        api.get("/api/kpi"),
        api.get("/api/charts"),
      ]);
      setDataInfo(infoRes.data);
      setNumericCols(infoRes.data.numeric_columns || []);
      setPredictCol(infoRes.data.numeric_columns?.[0] || "");
      setKpis(kpiRes.data.kpis || []);
      setCharts(chartRes.data.charts || []);
    } catch {
      // No data yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const res = await api.post("/api/upload", formData);
      toast.success(`✅ ${res.data.rows} rows loaded!`);
      await loadData();
      setSection("overview");
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const loadInsights = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/insights");
      setInsights(res.data.insights || []);
    } catch { toast.error("Failed to load insights"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (section === "insights" && dataInfo) loadInsights();
    if (section === "data" && !rawData && dataInfo) {
      api.get("/api/export-data").then(r => setRawData(r.data)).catch(() => { });
    }
  }, [section, dataInfo]);

  const runPrediction = async () => {
    if (!predictCol) return toast.error("Select a column");
    setLoading(true);
    try {
      const res = await api.post("/api/predict", { column: predictCol, steps: predictSteps });
      setPrediction(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Prediction failed");
    } finally { setLoading(false); }
  };

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q) return;
    const time = new Date().toLocaleTimeString();
    setChatMessages(m => [...m, { role: "user", text: q, time }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await api.post("/api/chat", { query: q });
      setChatMessages(m => [...m, { role: "bot", text: res.data.answer, time: new Date().toLocaleTimeString() }]);
    } catch {
      setChatMessages(m => [...m, { role: "bot", text: "Sorry, something went wrong.", time: new Date().toLocaleTimeString() }]);
    } finally { setChatLoading(false); }
  };

  const exportPDF = async () => {
    if (!dataInfo) return toast.error("No data to export");
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(0, 229, 160);
    doc.text("DataSense AI — Dashboard Report", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}  |  User: ${user.name}`, 14, 28);
    doc.text(`Dataset: ${dataInfo.rows} rows × ${dataInfo.columns.length} columns`, 14, 34);

    let y = 44;
    if (kpis.length) {
      doc.setFontSize(13); doc.setTextColor(30);
      doc.text("KPI Summary", 14, y); y += 6;
      const kpiTableData = kpis.map(k => [k.column, k.total, k.average, k.max, k.min]);
      autoTable(doc, {
        startY: y, head: [["Column", "Total", "Avg", "Max", "Min"]],
        body: kpiTableData,
        styles: { fontSize: 9 }, headStyles: { fillColor: [0, 90, 60] },
        margin: { left: 14, right: 14 }
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    if (rawData?.data?.length) {
      doc.setFontSize(13); doc.setTextColor(30);
      doc.text("Data Preview (Top 20 Rows)", 14, y); y += 6;
      autoTable(doc, {
        startY: y, head: [rawData.columns],
        body: rawData.data.slice(0, 20).map(row => rawData.columns.map(c => row[c] ?? "")),
        styles: { fontSize: 7 }, headStyles: { fillColor: [13, 17, 23] },
        margin: { left: 14, right: 14 }
      });
    }

    doc.save("datasense_dashboard.pdf");
    toast.success("PDF exported!");
  };

  const makeChartOptions = (title = "", color = COLORS.green) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: { backgroundColor: isDark ? "#21262d" : "#fff", titleColor: isDark ? "#e6edf3" : "#1a202c", bodyColor: isDark ? "#8b949e" : "#4a5568", borderColor: isDark ? "#30363d" : "#d1d9e0", borderWidth: 1, padding: 10, cornerRadius: 8 }
    },
    scales: {
      x: { grid: { color: isDark ? "#21262d" : "#e8edf2" }, ticks: { color: isDark ? "#6e7681" : "#718096", font: { size: 10 } }, border: { display: false } },
      y: { grid: { color: isDark ? "#21262d" : "#e8edf2" }, ticks: { color: isDark ? "#6e7681" : "#718096", font: { size: 10 } }, border: { display: false } }
    }
  });

  const makePieOptions = () => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { color: isDark ? "#8b949e" : "#4a5568", font: { size: 11 }, padding: 14 } },
      tooltip: { backgroundColor: isDark ? "#21262d" : "#fff", titleColor: isDark ? "#e6edf3" : "#1a202c", bodyColor: isDark ? "#8b949e" : "#4a5568", borderColor: isDark ? "#30363d" : "#d1d9e0", borderWidth: 1, padding: 10, cornerRadius: 8 }
    }
  });

  const renderChart = (ch) => {
    const colorOrder = [COLORS.green, COLORS.blue, COLORS.purple, COLORS.orange];
    const color = colorOrder[charts.indexOf(ch) % colorOrder.length];

    if (ch.type === "bar") {
      return <Bar options={makeChartOptions(ch.title, color)} data={{
        labels: ch.labels,
        datasets: [{ label: ch.title, data: ch.values, backgroundColor: `${color}33`, borderColor: color, borderWidth: 2, borderRadius: 4 }]
      }} />;
    }
    if (ch.type === "line") {
      return <Line options={makeChartOptions(ch.title, color)} data={{
        labels: ch.labels,
        datasets: [{ label: ch.title, data: ch.values, borderColor: color, backgroundColor: `${color}15`, borderWidth: 2, pointRadius: 3, fill: true, tension: 0.3 }]
      }} />;
    }
    if (ch.type === "pie") {
      return <Pie options={makePieOptions()} data={{
        labels: ch.labels,
        datasets: [{ data: ch.values, backgroundColor: [COLORS.green + "cc", COLORS.blue + "cc", COLORS.purple + "cc"], borderColor: isDark ? "#161b22" : "#fff", borderWidth: 2 }]
      }} />;
    }
    return null;
  };

  const kpiColors = ["green", "blue", "purple", "orange"];
  const kpiLabels = ["Total", "Average", "Maximum", "Minimum"];

  // ──────────────────────────────────
  return (
    <div className="dashboard-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo"><BarChart2 size={22} /></div>
          <div className="sidebar-title">DataSense AI</div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Main Menu</div>
          {SECTIONS.map(s => (
            <button key={s.id} className={`nav-item ${section === s.id ? "active" : ""}`} onClick={() => setSection(s.id)}>
              <span className="nav-icon"><s.Icon size={16} /></span> {s.label}
            </button>
          ))}
          <div className="nav-section-label" style={{ marginTop: "0.8rem" }}>Actions</div>
          <button className="nav-item" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <span className="nav-icon"><Upload size={16} /></span> {uploading ? "Uploading…" : "Upload CSV"}
          </button>
          <button className="nav-item" onClick={exportPDF}>
            <span className="nav-icon"><FileText size={16} /></span> Export PDF
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
            <div className="user-details">
              <div className="name">{user.name}</div>
              <div className="email">{user.email}</div>
            </div>
            <button className="icon-btn" onClick={logout} title="Logout" style={{ width: 28, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><LogOut size={14} /></button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main-content" ref={dashboardRef}>
        {/* TOPBAR */}
        <div className="topbar">
          <div className="topbar-title">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {(() => { const S = SECTIONS.find(s => s.id === section); return S ? <S.Icon size={20} /> : null; })()}
              {SECTIONS.find(s => s.id === section)?.label}
            </h2>
            <p>{dataInfo ? `${dataInfo.rows} rows · ${dataInfo.columns.length} columns` : "No data loaded"}</p>
          </div>
          <div className="topbar-actions">
            {dataInfo && <span className="chip green" style={{ fontSize: "0.72rem" }}>Data Loaded</span>}
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button className="btn-outline" onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><Upload size={14} /> Upload CSV</button>
            <button className="btn-outline" onClick={exportPDF} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><FileText size={14} /> PDF</button>
          </div>
        </div>

        <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} style={{ display: "none" }} />

        <div className="page-content">

          {/* ── OVERVIEW ── */}
          {section === "overview" && (
            <>
              {!dataInfo ? (
                <div className="upload-area" onClick={() => fileRef.current?.click()}>
                  <div className="upload-icon"><FolderOpen size={48} strokeWidth={1.5} /></div>
                  <h3>Upload your CSV to get started</h3>
                  <p>Click here or drag & drop your CSV file. The dashboard will auto-generate.</p>
                </div>
              ) : (
                <>
                  <div className="kpi-grid">
                    {kpis.slice(0, 4).map((k, i) => (
                      <div key={k.column + i} className={`kpi-card ${kpiColors[i % 4]}`}>
                        <div className="kpi-label">{kpiLabels[0]}</div>
                        <div className="kpi-col">{k.column}</div>
                        <div className="kpi-value">{k.total.toLocaleString()}</div>
                        <div className="kpi-sub">Avg: {k.average} · Max: {k.max}</div>
                      </div>
                    ))}
                    {kpis.length === 0 && [0, 1, 2, 3].map(i => (
                      <div key={i} className={`kpi-card ${kpiColors[i]}`}>
                        <div className="kpi-label">No Data</div>
                        <div className="kpi-value" style={{ fontSize: "1.2rem", opacity: 0.4 }}>—</div>
                      </div>
                    ))}
                  </div>

                  <div className="charts-grid">
                    {charts.slice(0, 4).map(ch => (
                      <div key={ch.id} className="chart-card">
                        <div className="chart-title">{ch.title}</div>
                        <div className="chart-wrap">{renderChart(ch)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><ClipboardList size={16} /> Dataset Summary</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.8rem" }}>
                      {[
                        { label: "Total Rows", val: dataInfo.rows },
                        { label: "Total Columns", val: dataInfo.columns.length },
                        { label: "Numeric Cols", val: dataInfo.numeric_columns.length },
                        { label: "Text Cols", val: dataInfo.string_columns.length },
                      ].map(item => (
                        <div key={item.label} style={{ background: "var(--bg3)", borderRadius: 8, padding: "0.8rem", textAlign: "center" }}>
                          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent)", fontFamily: "'Space Grotesk', sans-serif" }}>{item.val}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── CHARTS ── */}
          {section === "charts" && (
            <>
              {!dataInfo ? (
                <div className="empty-state"><div className="es-icon"><BarChart2 size={48} strokeWidth={1.2} /></div><h3>No data yet</h3><p>Upload a CSV to generate charts automatically.</p></div>
              ) : (
                <div className="charts-grid">
                  {charts.map(ch => (
                    <div key={ch.id} className="chart-card">
                      <div className="chart-title">{ch.title}</div>
                      <div className="chart-wrap">{renderChart(ch)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── AI INSIGHTS ── */}
          {section === "insights" && (
            <>
              {!dataInfo ? (
                <div className="empty-state"><div className="es-icon"><Brain size={48} strokeWidth={1.2} /></div><h3>No data yet</h3><p>Upload a CSV to see AI-powered insights.</p></div>
              ) : loading ? (
                <div className="loading"><div className="spinner" /> Analyzing data…</div>
              ) : (
                <>
                  <div className="card" style={{ marginBottom: "1.2rem" }}>
                    <div className="card-header">
                      <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><Brain size={16} /> AI Analysis <span className="badge">Auto-Generated</span></div>
                    </div>
                    <p style={{ color: "var(--text2)", fontSize: "0.85rem" }}>
                      Linear Regression was applied on each column to determine trends. Max, Min, Mean and Standard Deviation are computed for quick insights.
                    </p>
                  </div>
                  <div className="insights-grid">
                    {insights.map((ins) => (
                      <div key={ins.column} className="insight-card">
                        <div className="insight-col-name">{ins.column}</div>
                        <div className="insight-trend">
                          <TrendIcon trend={ins.trend} />
                          <span style={{ color: ins.trend === "increasing" ? COLORS.green : ins.trend === "decreasing" ? COLORS.red : COLORS.orange }}>
                            {ins.trend.charAt(0).toUpperCase() + ins.trend.slice(1)}
                          </span>
                        </div>
                        {[
                          ["Max Value", ins.max_value, COLORS.green],
                          ["Min Value", ins.min_value, COLORS.red],
                          ["Mean", ins.mean, COLORS.blue],
                          ["Std Dev", ins.std, COLORS.purple],
                          ["Slope", ins.slope, COLORS.orange],
                        ].map(([label, val, color]) => (
                          <div className="insight-row" key={label}>
                            <span>{label}</span>
                            <span style={{ color }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── ML PREDICT ── */}
          {section === "predict" && (
            <>
              {!dataInfo ? (
                <div className="empty-state"><div className="es-icon"><Bot size={48} strokeWidth={1.2} /></div><h3>No data yet</h3><p>Upload a CSV to use ML forecasting.</p></div>
              ) : (
                <>
                  <div className="card" style={{ marginBottom: "1.2rem" }}>
                    <div className="card-header">
                      <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><Bot size={16} /> Machine Learning Forecast <span className="badge">Linear Regression</span></div>
                    </div>
                    <div className="predict-controls">
                      <div>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Target Column</div>
                        <select className="predict-select" value={predictCol} onChange={e => setPredictCol(e.target.value)}>
                          {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Forecast Steps</div>
                        <input className="predict-steps" type="number" min="1" max="20" value={predictSteps} onChange={e => setPredictSteps(Number(e.target.value))} />
                      </div>
                      <button className="btn-accent" onClick={runPrediction} disabled={loading} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <Sparkles size={15} /> {loading ? "Running…" : "Run Prediction"}
                      </button>
                    </div>
                  </div>

                  {prediction && (
                    <>
                      <div className="kpi-grid" style={{ marginBottom: "1.2rem" }}>
                        {[
                          { label: "Column", val: prediction.column, color: "green" },
                          { label: "R² Score", val: prediction.r2_score, color: "blue" },
                          { label: "Slope", val: prediction.slope, color: "purple" },
                          { label: "Next Value", val: prediction.predicted[0], color: "orange" },
                        ].map((k, i) => (
                          <div key={k.label} className={`kpi-card ${k.color}`}>
                            <div className="kpi-label">{k.label}</div>
                            <div className="kpi-value" style={{ fontSize: "1.3rem" }}>{k.val}</div>
                          </div>
                        ))}
                      </div>
                      <div className="chart-card" style={{ height: 340 }}>
                        <div className="chart-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><TrendingUp size={15} /> Historical vs Predicted — {prediction.column}</div>
                        <div className="chart-wrap">
                          <Line
                            options={{ ...makeChartOptions(), plugins: { ...makeChartOptions().plugins, legend: { display: true, labels: { color: isDark ? "#8b949e" : "#4a5568" } } } }}
                            data={{
                              labels: [...prediction.historical_labels, ...prediction.predicted_labels],
                              datasets: [
                                {
                                  label: "Historical",
                                  data: [...prediction.historical, ...Array(prediction.predicted.length).fill(null)],
                                  borderColor: COLORS.blue, backgroundColor: COLORS.blue + "15",
                                  borderWidth: 2, pointRadius: 2, fill: true, tension: 0.3
                                },
                                {
                                  label: "Predicted",
                                  data: [...Array(prediction.historical.length - 1).fill(null), prediction.historical[prediction.historical.length - 1], ...prediction.predicted],
                                  borderColor: COLORS.green, backgroundColor: COLORS.green + "25",
                                  borderWidth: 2.5, pointRadius: 4, fill: true, tension: 0.3,
                                  borderDash: [5, 5]
                                }
                              ]
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* ── NLP CHAT ── */}
          {section === "chat" && (
            <>
              <div className="card" style={{ marginBottom: "1rem" }}>
                <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><MessageSquare size={16} /> NLP Data Assistant <span className="badge">AI Powered</span></div>
                <p style={{ color: "var(--text2)", fontSize: "0.82rem", marginTop: "0.5rem" }}>
                  Ask questions in plain English: "Which column has highest value?", "What is the trend of Sales?", "Predict next revenue", "How many rows?", "Show average of Price"
                </p>
              </div>
              <div className="chat-wrap">
                <div className="chat-messages">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`chat-msg ${msg.role}`}>
                      <div className="chat-bubble" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
                      <div className="chat-time">{msg.time}</div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="chat-msg bot">
                      <div className="chat-bubble" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                        <span style={{ color: "var(--text3)", fontSize: "0.82rem" }}>Thinking…</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="chat-input-area">
                  <input
                    className="chat-input" value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                    placeholder="Ask anything about your data…"
                    disabled={chatLoading}
                  />
                  <button className="chat-send-btn" onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    Send <Send size={14} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── RAW DATA ── */}
          {section === "data" && (
            <>
              {!dataInfo ? (
                <div className="empty-state"><div className="es-icon"><Database size={48} strokeWidth={1.2} /></div><h3>No data yet</h3><p>Upload a CSV to view the raw data.</p></div>
              ) : !rawData ? (
                <div className="loading"><div className="spinner" /> Loading data…</div>
              ) : (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><Database size={16} /> Raw Dataset <span className="badge">Top 50 rows</span></div>
                    <span style={{ fontSize: "0.78rem", color: "var(--text3)" }}>{dataInfo.rows} total rows · {dataInfo.columns.length} columns</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>{rawData.columns.map(c => <th key={c}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {rawData.data.map((row, i) => (
                          <tr key={i}>
                            {rawData.columns.map(c => <td key={c}>{row[c] ?? "—"}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}
