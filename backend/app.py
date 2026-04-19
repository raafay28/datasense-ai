from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
import json
import os
import hashlib
import sqlite3
from datetime import datetime
import pymysql
pymysql.install_as_MySQLdb()

# In production, serve React build from ../frontend/build
BUILD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "build")

app = Flask(__name__, static_folder=BUILD_DIR, static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", "dev-only-fallback-change-in-production")
CORS(app, supports_credentials=True, origins=["http://localhost:3000"])

DB_PATH = "database.db"
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ──────────────────────────────────────────
# DATABASE SETUP
# ──────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_db()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# ──────────────────────────────────────────
# AUTH ROUTES
# ──────────────────────────────────────────

@app.route("/api/register", methods=["POST"])
def register():
    data = request.json
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "Email already registered"}), 409

    conn.execute(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        (name, email, hash_password(password))
    )
    conn.commit()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    session["user_id"] = user["id"]
    session["user_name"] = user["name"]
    session["user_email"] = user["email"]

    return jsonify({"message": "Account created", "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}), 201


@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ? AND password = ?",
                        (email, hash_password(password))).fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    session["user_id"] = user["id"]
    session["user_name"] = user["name"]
    session["user_email"] = user["email"]

    return jsonify({"message": "Login successful", "user": {"id": user["id"], "name": user["name"], "email": user["email"]}})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})


@app.route("/api/me", methods=["GET"])
def me():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    return jsonify({"user": {"id": session["user_id"], "name": session["user_name"], "email": session["user_email"]}})


# ──────────────────────────────────────────
# CSV UPLOAD & PROCESSING
# ──────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
def upload_csv():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename.endswith(".csv"):
        return jsonify({"error": "Only CSV files are supported"}), 400

    filepath = os.path.join(UPLOAD_FOLDER, f"user_{session['user_id']}.csv")
    file.save(filepath)

    try:
        df = pd.read_csv(filepath)
        if df.empty:
            return jsonify({"error": "CSV is empty"}), 400
        return jsonify({"message": "File uploaded successfully", "rows": len(df), "columns": list(df.columns)}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to parse CSV: {str(e)}"}), 400


@app.route("/api/data", methods=["GET"])
def get_data():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    filepath = os.path.join(UPLOAD_FOLDER, f"user_{session['user_id']}.csv")
    if not os.path.exists(filepath):
        return jsonify({"error": "No data uploaded yet"}), 404

    df = pd.read_csv(filepath)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    string_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

    preview = df.head(10).replace({np.nan: None}).to_dict(orient="records")

    return jsonify({
        "columns": list(df.columns),
        "numeric_columns": numeric_cols,
        "string_columns": string_cols,
        "rows": len(df),
        "preview": preview
    })


# ──────────────────────────────────────────
# DASHBOARD / CHARTS
# ──────────────────────────────────────────

@app.route("/api/charts", methods=["GET"])
def get_charts():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    filepath = os.path.join(UPLOAD_FOLDER, f"user_{session['user_id']}.csv")
    if not os.path.exists(filepath):
        return jsonify({"error": "No data uploaded"}), 404

    df = pd.read_csv(filepath)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    if not numeric_cols:
        return jsonify({"error": "No numeric columns found"}), 400

    charts = []

    # Bar chart - all numeric columns avg
    bar_data = {col: round(df[col].mean(), 2) for col in numeric_cols}
    charts.append({
        "id": "bar_avg",
        "type": "bar",
        "title": "Column Averages",
        "labels": list(bar_data.keys()),
        "values": list(bar_data.values())
    })

    # Line chart - first numeric column trend
    first_col = numeric_cols[0]
    line_vals = df[first_col].dropna().tolist()
    charts.append({
        "id": "line_trend",
        "type": "line",
        "title": f"{first_col} — Trend Over Rows",
        "labels": [str(i+1) for i in range(len(line_vals))],
        "values": [round(v, 2) for v in line_vals]
    })

    # Pie chart — distribution of values in first col (bucketed)
    if len(line_vals) > 0:
        vals_arr = np.array(line_vals)
        low = np.sum(vals_arr < np.percentile(vals_arr, 33))
        mid = np.sum((vals_arr >= np.percentile(vals_arr, 33)) & (vals_arr < np.percentile(vals_arr, 66)))
        high = np.sum(vals_arr >= np.percentile(vals_arr, 66))
        charts.append({
            "id": "pie_dist",
            "type": "pie",
            "title": f"{first_col} — Value Distribution",
            "labels": ["Low", "Medium", "High"],
            "values": [int(low), int(mid), int(high)]
        })

    # Second numeric column if available
    if len(numeric_cols) >= 2:
        second_col = numeric_cols[1]
        second_vals = df[second_col].dropna().tolist()
        charts.append({
            "id": "line_second",
            "type": "line",
            "title": f"{second_col} — Trend",
            "labels": [str(i+1) for i in range(len(second_vals))],
            "values": [round(v, 2) for v in second_vals]
        })

    return jsonify({"charts": charts})


# ──────────────────────────────────────────
# KPI CARDS
# ──────────────────────────────────────────

@app.route("/api/kpi", methods=["GET"])
def get_kpi():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    filepath = os.path.join(UPLOAD_FOLDER, f"user_{session['user_id']}.csv")
    if not os.path.exists(filepath):
        return jsonify({"error": "No data uploaded"}), 404

    df = pd.read_csv(filepath)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    if not numeric_cols:
        return jsonify({"error": "No numeric data"}), 400

    kpis = []
    for col in numeric_cols[:4]:
        col_data = df[col].dropna()
        kpis.append({
            "column": col,
            "total": round(float(col_data.sum()), 2),
            "average": round(float(col_data.mean()), 2),
            "max": round(float(col_data.max()), 2),
            "min": round(float(col_data.min()), 2),
            "count": int(col_data.count())
        })

    return jsonify({"kpis": kpis})


# ──────────────────────────────────────────
# AI INSIGHTS & TREND DETECTION
# ──────────────────────────────────────────

@app.route("/api/insights", methods=["GET"])
def get_insights():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    filepath = os.path.join(UPLOAD_FOLDER, f"user_{session['user_id']}.csv")
    if not os.path.exists(filepath):
        return jsonify({"error": "No data uploaded"}), 404

    df = pd.read_csv(filepath)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    insights = []
    for col in numeric_cols:
        data = df[col].dropna()
        if len(data) < 2:
            continue

        # Trend detection using linear regression slope
        X = np.arange(len(data)).reshape(-1, 1)
        y = data.values
        model = LinearRegression().fit(X, y)
        slope = model.coef_[0]

        if slope > 0.01 * data.mean():
            trend = "increasing"
            trend_icon = "📈"
        elif slope < -0.01 * data.mean():
            trend = "decreasing"
            trend_icon = "📉"
        else:
            trend = "stable"
            trend_icon = "➡️"

        max_val = round(float(data.max()), 2)
        min_val = round(float(data.min()), 2)
        max_idx = int(data.idxmax())
        min_idx = int(data.idxmin())

        insights.append({
            "column": col,
            "trend": trend,
            "trend_icon": trend_icon,
            "slope": round(float(slope), 4),
            "max_value": max_val,
            "max_at_row": max_idx,
            "min_value": min_val,
            "min_at_row": min_idx,
            "mean": round(float(data.mean()), 2),
            "std": round(float(data.std()), 2),
            "summary": f"{col} is {trend}. Max is {max_val} at row {max_idx}, min is {min_val} at row {min_idx}. Average is {round(float(data.mean()), 2)}."
        })

    return jsonify({"insights": insights})


# ──────────────────────────────────────────
# ML PREDICTIONS
# ──────────────────────────────────────────

@app.route("/api/predict", methods=["POST"])
def predict():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    filepath = os.path.join(UPLOAD_FOLDER, f"user_{session['user_id']}.csv")
    if not os.path.exists(filepath):
        return jsonify({"error": "No data uploaded"}), 404

    data = request.json
    target_col = data.get("column")
    steps = int(data.get("steps", 5))

    df = pd.read_csv(filepath)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    if target_col not in numeric_cols:
        target_col = numeric_cols[0] if numeric_cols else None
    if not target_col:
        return jsonify({"error": "No numeric column available"}), 400

    series = df[target_col].dropna().values
    X = np.arange(len(series)).reshape(-1, 1)
    y = series

    model = LinearRegression()
    model.fit(X, y)

    future_X = np.arange(len(series), len(series) + steps).reshape(-1, 1)
    predictions = model.predict(future_X).tolist()

    r2 = round(model.score(X, y), 4)

    return jsonify({
        "column": target_col,
        "historical": [round(v, 2) for v in series.tolist()],
        "historical_labels": [str(i+1) for i in range(len(series))],
        "predicted": [round(v, 2) for v in predictions],
        "predicted_labels": [f"F{i+1}" for i in range(steps)],
        "r2_score": r2,
        "slope": round(float(model.coef_[0]), 4),
        "intercept": round(float(model.intercept_), 4)
    })


# ──────────────────────────────────────────
# NLP CHAT ASSISTANT
# ──────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def chat():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    filepath = os.path.join(UPLOAD_FOLDER, f"user_{session['user_id']}.csv")
    if not os.path.exists(filepath):
        return jsonify({"answer": "Please upload a CSV file first before asking questions."})

    query = request.json.get("query", "").lower().strip()
    df = pd.read_csv(filepath)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    all_cols = list(df.columns)

    # Find mentioned column
    mentioned_col = None
    for col in all_cols:
        if col.lower() in query:
            mentioned_col = col
            break

    # ── Intent detection ──
    # Highest value
    if any(k in query for k in ["highest", "maximum", "max", "largest", "biggest"]):
        if mentioned_col and mentioned_col in numeric_cols:
            val = df[mentioned_col].max()
            idx = df[mentioned_col].idxmax()
            return jsonify({"answer": f"The highest value in **{mentioned_col}** is **{round(float(val), 2)}** at row {idx}."})
        elif numeric_cols:
            col_maxes = {col: df[col].max() for col in numeric_cols}
            top_col = max(col_maxes, key=col_maxes.get)
            return jsonify({"answer": f"Column with highest overall value is **{top_col}** with a max of **{round(float(col_maxes[top_col]), 2)}**."})

    # Lowest value
    if any(k in query for k in ["lowest", "minimum", "min", "smallest"]):
        if mentioned_col and mentioned_col in numeric_cols:
            val = df[mentioned_col].min()
            idx = df[mentioned_col].idxmin()
            return jsonify({"answer": f"The lowest value in **{mentioned_col}** is **{round(float(val), 2)}** at row {idx}."})
        elif numeric_cols:
            col_mins = {col: df[col].min() for col in numeric_cols}
            bot_col = min(col_mins, key=col_mins.get)
            return jsonify({"answer": f"Column with lowest overall value is **{bot_col}** with a min of **{round(float(col_mins[bot_col]), 2)}**."})

    # Average
    if any(k in query for k in ["average", "mean", "avg"]):
        if mentioned_col and mentioned_col in numeric_cols:
            val = df[mentioned_col].mean()
            return jsonify({"answer": f"The average of **{mentioned_col}** is **{round(float(val), 2)}**."})
        elif numeric_cols:
            avgs = {col: round(float(df[col].mean()), 2) for col in numeric_cols}
            result = ", ".join([f"{c}: {v}" for c, v in avgs.items()])
            return jsonify({"answer": f"Averages — {result}"})

    # Sum / total
    if any(k in query for k in ["sum", "total"]):
        if mentioned_col and mentioned_col in numeric_cols:
            val = df[mentioned_col].sum()
            return jsonify({"answer": f"The total sum of **{mentioned_col}** is **{round(float(val), 2)}**."})
        elif numeric_cols:
            sums = {col: round(float(df[col].sum()), 2) for col in numeric_cols}
            result = ", ".join([f"{c}: {v}" for c, v in sums.items()])
            return jsonify({"answer": f"Column totals — {result}"})

    # Prediction
    if any(k in query for k in ["predict", "forecast", "next", "future"]):
        col = mentioned_col if mentioned_col in numeric_cols else (numeric_cols[0] if numeric_cols else None)
        if col:
            series = df[col].dropna().values
            X = np.arange(len(series)).reshape(-1, 1)
            model = LinearRegression().fit(X, series)
            next_val = model.predict([[len(series)]])[0]
            return jsonify({"answer": f"Based on Linear Regression, the predicted next value for **{col}** is **{round(float(next_val), 2)}**."})

    # Trend
    if any(k in query for k in ["trend", "increasing", "decreasing", "going up", "going down"]):
        col = mentioned_col if mentioned_col in numeric_cols else (numeric_cols[0] if numeric_cols else None)
        if col:
            series = df[col].dropna().values
            X = np.arange(len(series)).reshape(-1, 1)
            model = LinearRegression().fit(X, series)
            slope = model.coef_[0]
            trend = "increasing 📈" if slope > 0 else ("decreasing 📉" if slope < 0 else "stable ➡️")
            return jsonify({"answer": f"**{col}** is **{trend}** (slope = {round(float(slope), 4)})."})

    # Count / rows
    if any(k in query for k in ["how many", "count", "rows", "records"]):
        return jsonify({"answer": f"Your dataset has **{len(df)} rows** and **{len(df.columns)} columns**."})

    # List columns
    if any(k in query for k in ["columns", "fields", "variables", "what data"]):
        return jsonify({"answer": f"Your dataset has these columns: **{', '.join(all_cols)}**. Numeric: **{', '.join(numeric_cols) if numeric_cols else 'none'}**."})

    # Correlation
    if any(k in query for k in ["correlat", "relationship", "related"]):
        if len(numeric_cols) >= 2:
            corr = df[numeric_cols].corr().round(2).to_dict()
            top = []
            for c1 in numeric_cols:
                for c2 in numeric_cols:
                    if c1 < c2:
                        top.append((c1, c2, corr[c1][c2]))
            top.sort(key=lambda x: abs(x[2]), reverse=True)
            res = top[0]
            return jsonify({"answer": f"Strongest correlation: **{res[0]}** and **{res[1]}** with r = **{res[2]}**."})

    # Default fallback
    return jsonify({
        "answer": f"I can answer questions about your data. Try asking: 'Which column has the highest value?', 'What is the average of [column]?', 'Predict next sales', or 'Show me the trend'. Your dataset has {len(df)} rows and columns: {', '.join(all_cols[:5])}{'...' if len(all_cols) > 5 else ''}."
    })


# ──────────────────────────────────────────
# EXPORT DATA (for frontend PDF)
# ──────────────────────────────────────────

@app.route("/api/export-data", methods=["GET"])
def export_data():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    filepath = os.path.join(UPLOAD_FOLDER, f"user_{session['user_id']}.csv")
    if not os.path.exists(filepath):
        return jsonify({"error": "No data uploaded"}), 404

    df = pd.read_csv(filepath)
    return jsonify({
        "filename": "dashboard_export.csv",
        "data": df.head(50).replace({np.nan: None}).to_dict(orient="records"),
        "columns": list(df.columns)
    })


# ──────────────────────────────────────────
# SERVE REACT FRONTEND
# ──────────────────────────────────────────

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    """Serve React app for any non-API route."""
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
