# 📊 DataSense AI — Final Year Project

An AI-powered data analytics dashboard combining **Machine Learning**, **NLP**, and **interactive visualizations** in a full-stack web application.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, React Router, Chart.js, jsPDF |
| Backend | Python Flask, Flask-CORS |
| AI/ML | Scikit-learn (Linear Regression), NumPy |
| Data | Pandas, SQLite |
| Auth | Session-based, SHA-256 hashing |

---

## ✨ Features

1. **User Authentication** — Secure signup/login with encrypted passwords
2. **CSV Upload** — Upload any CSV dataset, auto-parsed
3. **Auto Dashboard** — Bar, Line, Pie charts generated instantly
4. **KPI Cards** — Total, Average, Max, Min for each numeric column
5. **AI Insights & Trend Detection** — Increasing / Decreasing / Stable per column
6. **ML Predictions** — Linear Regression forecasting with R² score
7. **NLP Chat Assistant** — Ask questions in plain English
8. **Dark / Light Mode** — Toggle between themes
9. **Export as PDF** — Full dashboard exported to PDF with table
10. **Interactive Charts** — Animated Chart.js visualizations
11. **Responsive UI** — Sidebar navigation, professional layout
12. **Real-Time Processing** — Instant results after CSV upload
13. **Integrated Platform** — AI + ML + NLP all in one

---

## 🛠️ Setup & Run

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm

---

### Step 1 — Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Backend runs on: **http://localhost:5000**

---

### Step 2 — Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs on: **http://localhost:3000**

> The React app proxies all `/api/*` requests to Flask automatically.

---

## 📁 Project Structure

```
dashboard-project/
├── backend/
│   ├── app.py              # Flask API (all routes)
│   ├── requirements.txt    # Python dependencies
│   ├── database.db         # SQLite (auto-created)
│   └── uploads/            # Uploaded CSVs (auto-created)
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── context/
    │   │   ├── AuthContext.jsx   # Login/register/logout state
    │   │   └── ThemeContext.jsx  # Dark/light theme
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   └── Dashboard.jsx     # Main dashboard (all sections)
    │   ├── App.jsx               # Routing
    │   ├── App.css               # All styles + CSS variables
    │   └── index.js
    └── package.json
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Create new account |
| POST | `/api/login` | Login |
| POST | `/api/logout` | Logout |
| GET | `/api/me` | Current user |
| POST | `/api/upload` | Upload CSV file |
| GET | `/api/data` | Get dataset info |
| GET | `/api/charts` | Get chart data |
| GET | `/api/kpi` | Get KPI summaries |
| GET | `/api/insights` | AI trend analysis |
| POST | `/api/predict` | ML forecast |
| POST | `/api/chat` | NLP chat query |
| GET | `/api/export-data` | Get data for PDF |

---

## 💬 NLP Chat — Sample Queries

- "Which column has the highest value?"
- "What is the average of Sales?"
- "Predict next revenue"
- "Show me the trend of Profit"
- "How many rows are in the dataset?"
- "What columns are available?"
- "What is the sum of Revenue?"
- "Is there any correlation?"

---

## 📸 Pages

1. **Register** — Name, email, password form
2. **Login** — Email, password form
3. **Dashboard / Overview** — KPI cards + charts
4. **Charts** — All visualizations (bar, line, pie)
5. **AI Insights** — Trend cards per column
6. **ML Predict** — Column selector + forecast chart
7. **NLP Chat** — Conversational data Q&A
8. **Raw Data** — Paginated data table

---

## 👩‍💻 Development Notes

- All styles use **CSS custom properties** for instant dark/light switching
- Charts use **Chart.js** via `react-chartjs-2`
- PDF export uses **jsPDF** + **jspdf-autotable**
- Flask sessions are cookie-based (set `SESSION_COOKIE_SAMESITE` for production)
- For production: replace SQLite with PostgreSQL, add HTTPS, use env vars for secrets
