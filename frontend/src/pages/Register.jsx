import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error("All fields required");
    if (form.password !== form.confirm) return toast.error("Passwords do not match");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success("Account created! Welcome aboard 🎉");
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed");
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
        <h2>Create account</h2>
        <p className="subtitle">Start analyzing your data with AI</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input className="form-input" type="text" name="name" placeholder="Enter your full name" value={form.name} onChange={handleChange} autoFocus />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input className="form-input" type="email" name="email" placeholder="Enter your email" value={form.email} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-input" type="password" name="password" placeholder="Min. 6 characters" value={form.password} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input className="form-input" type="password" name="confirm" placeholder="Repeat password" value={form.confirm} onChange={handleChange} />
          </div>
          <button className="btn-primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
            {loading ? "Creating account…" : "Create Account →"}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <p className="auth-footer">Made by Raafay</p>
      </div>
    </div>
  );
}
