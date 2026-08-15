"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function LoginForm({ configured }: { configured: boolean }) {
  const [error, setError] = useState(configured ? "" : "店主账号尚未在服务器中配置。");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const returnTo = new URLSearchParams(window.location.search).get("return_to") || "/owner";
    try {
      const response = await fetch("/api/owner/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: data.get("username"), password: data.get("password"), returnTo }) });
      const payload = await response.json() as { error?: string; redirect?: string };
      if (!response.ok) throw new Error(payload.error || "登录失败，请稍后重试。");
      window.location.assign(payload.redirect || "/owner");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败，请稍后重试。");
      setSubmitting(false);
    }
  }

  return <main className="owner-access owner-login"><div>
    <Link className="owner-login-brand" href="/">HUAXULI FLORA · 花礼目录</Link>
    <span>OWNER ACCESS</span><h1>店主登录</h1>
    <p>两位店主使用同一组账号与密码，即可管理花礼、咨询单和会员记录。</p>
    <form onSubmit={submit}>
      <label>店主账号<input name="username" autoComplete="username" required /></label>
      <label>登录密码<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <div className="owner-login-error" role="alert">{error}</div>}
      <button disabled={submitting || !configured}>{submitting ? "正在登录…" : "进入店主后台"}</button>
    </form>
    <Link className="secondary" href="/">返回顾客页</Link>
  </div></main>;
}
