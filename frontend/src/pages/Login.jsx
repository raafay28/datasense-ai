import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error("Please fill in all fields");
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="dot">📊</div>
          <span>DataSense AI</span>
        </div>
        <h2>Sign in</h2>
        <p className="subtitle">Access your intelligent analytics dashboard</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input className="form-input" type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} autoFocus />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-input" type="password" name="password" placeholder="••••••••" value={form.password} onChange={handleChange} />
          </div>
          <button className="btn-primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>

        <p className="auth-link">
          Don't have an account? <Link to="/register">Create one free</Link>
        </p>
      </div>
    </div>
  );
}
