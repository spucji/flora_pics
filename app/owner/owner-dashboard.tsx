"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Consultation = {
  id: number; reference: string; bouquetId: string; bouquetName: string; size: string;
  materialPlan: string; priceRange: string; scene: string; deliveryDate: string;
  budget: string; customerName: string; contact: string; note: string;
  status: "pending" | "contacted" | "completed"; createdAt: string;
};

const statusText = { pending: "待联系", contacted: "已联系", completed: "已完成" };

export default function OwnerDashboard({ email, signOutPath }: { email: string; signOutPath: string }) {
  const [items, setItems] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | Consultation["status"]>("all");

  useEffect(() => { fetch("/api/owner/consultations").then(async response => {
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error); return payload;
  }).then(payload => setItems(payload.consultations)).catch(cause => setError(cause.message)).finally(()=>setLoading(false)); }, []);

  async function updateStatus(id: number, status: Consultation["status"]) {
    const response = await fetch("/api/owner/consultations", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id,status}) });
    if (response.ok) setItems(current => current.map(item => item.id === id ? { ...item, status } : item));
  }

  const visible = filter === "all" ? items : items.filter(item => item.status === filter);
  return <main className="owner-dashboard">
    <aside><Link className="owner-brand" href="/"><b>F</b><span>FLORA<small>OWNER STUDIO</small></span></Link><nav><button className="active">咨询单 <i>{items.length}</i></button><Link href="/owner/editor">花礼与场景管理 <span>→</span></Link></nav><div className="owner-account"><small>已登录店主</small><span>{email}</span><a href={signOutPath}>退出登录</a></div></aside>
    <section className="owner-content"><header><div><small>CONSULTATION DESK</small><h1>顾客咨询单</h1></div><Link href="/">打开顾客页 ↗</Link></header>
      <div className="owner-filters">{(["all","pending","contacted","completed"] as const).map(value => <button className={filter===value?"active":""} onClick={()=>setFilter(value)} key={value}>{value==="all"?"全部":statusText[value]} <span>{value==="all"?items.length:items.filter(item=>item.status===value).length}</span></button>)}</div>
      {loading ? <div className="owner-empty">正在读取咨询单…</div> : error ? <div className="owner-empty error">{error}</div> : visible.length === 0 ? <div className="owner-empty">还没有这个状态的咨询单。</div> : <div className="consultation-list">{visible.map(item => <article key={item.id}><div className="ticket-head"><div><small>{item.reference}</small><h2>{item.bouquetName}</h2></div><select value={item.status} onChange={event=>updateStatus(item.id,event.target.value as Consultation["status"])}><option value="pending">待联系</option><option value="contacted">已联系</option><option value="completed">已完成</option></select></div><div className="ticket-grid"><p><span>款式</span>{item.bouquetId} · {item.size}</p><p><span>花材方案</span>{item.materialPlan}</p><p><span>参考价</span>¥{item.priceRange}</p><p><span>场景 / 日期</span>{item.scene||"未填写"}{item.deliveryDate?` · ${item.deliveryDate}`:""}</p><p><span>预算</span>{item.budget||"未填写"}</p><p><span>顾客</span>{item.customerName||"未留称呼"}{item.contact?` · ${item.contact}`:""}</p></div>{item.note&&<blockquote>{item.note}</blockquote>}<footer>提交时间：{item.createdAt}</footer></article>)}</div>}
    </section>
  </main>;
}
